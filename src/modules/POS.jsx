import React, { useMemo, useState } from 'react'
import { POS_PRODUCTS, POS_CATS, SCHOOL, STUDENT_ACCOUNTS, fmtN } from '../data.js'
import { Toast, useToast, Modal } from '../ui.jsx'

// SELLER-ONLY screen. Full-screen route with no sidebar and no admin
// data — this is the locked-down view the spec demos to the client.
export default function POS({ attendant, onLogout, adminPeek }) {
  const [cat, setCat] = useState('Popular')
  const [cart, setCart] = useState([]) // [{id, name, price, qty}]
  const [pay, setPay] = useState('Cash')
  const [toast, showToast] = useToast()
  // live shift state — checkout decrements stock and feeds reconciliation
  const [stock, setStock] = useState(() => Object.fromEntries(POS_PRODUCTS.map((p) => [p.id, p.stock])))
  const [shift, setShift] = useState({ cash: 2926, card: 1254, account: 318, txns: 187 })
  const [showClose, setShowClose] = useState(false)
  const [showPay, setShowPay] = useState(false)
  const [tender, setTender] = useState(null) // cash received, null = exact
  // prepaid student accounts — guardian tops up, learner pays by card number
  const [balances, setBalances] = useState(() => Object.fromEntries(STUDENT_ACCOUNTS.map((a) => [a.id, a.balance])))
  const [acct, setAcct] = useState(STUDENT_ACCOUNTS[0].id)
  const [receipt, setReceipt] = useState(null) // last completed sale
  const sessionTotal = shift.cash + shift.card + shift.account

  const products = useMemo(
    () => POS_PRODUCTS.filter((p) => (cat === 'Popular' ? p.popular : p.cat === cat)),
    [cat]
  )

  const inCart = (id) => cart.find((l) => l.id === id)?.qty || 0

  const add = (p) => {
    if (inCart(p.id) >= stock[p.id]) return // can't sell more than stock
    setCart((c) => {
      const hit = c.find((l) => l.id === p.id)
      if (hit) return c.map((l) => (l.id === p.id ? { ...l, qty: l.qty + 1 } : l))
      return [...c, { id: p.id, name: p.name, price: p.price, qty: 1 }]
    })
  }

  const bump = (id, d) =>
    setCart((c) =>
      c
        .map((l) => (l.id === id ? { ...l, qty: l.qty + d } : l))
        .filter((l) => l.qty > 0)
    )

  const subtotal = cart.reduce((s, l) => s + l.price * l.qty, 0)
  const count = cart.reduce((s, l) => s + l.qty, 0)
  const [disc, setDisc] = useState(0) // % — staff/bulk discounts
  const discount = Math.round(subtotal * (disc / 100))
  const total = subtotal - discount

  // sensible cash-tender suggestions: exact + common notes that cover the total
  const tenderOptions = useMemo(() => {
    const opts = [total]
    ;[Math.ceil(total / 10) * 10, 50, 100, 200].forEach((n) => {
      if (n > total && !opts.includes(n)) opts.push(n)
    })
    return opts.slice(0, 4)
  }, [total])
  const received = tender ?? total
  const change = received - total

  const acctInfo = STUDENT_ACCOUNTS.find((a) => a.id === acct)
  const acctBalance = balances[acct]
  const insufficient = pay === 'Account' && acctBalance < total

  const confirmSale = () => {
    setStock((s) => {
      const next = { ...s }
      cart.forEach((l) => { next[l.id] -= l.qty })
      return next
    })
    setShift((sh) => ({
      ...sh,
      txns: sh.txns + 1,
      [pay.toLowerCase()]: sh[pay.toLowerCase()] + total,
    }))
    if (pay === 'Account') setBalances((b) => ({ ...b, [acct]: b[acct] - total }))
    setReceipt({
      lines: cart, total, discount, pay,
      change: pay === 'Cash' ? change : 0,
      acct: pay === 'Account' ? { ...acctInfo, after: acctBalance - total } : null,
      no: shift.txns + 1,
    })
    showToast(
      pay === 'Cash' && change > 0
        ? `Sale complete — ${fmtN(total)} · change ${fmtN(change)}`
        : pay === 'Account'
        ? `Sale complete — ${fmtN(total)} from ${acctInfo.name}'s account`
        : `Sale complete — ${fmtN(total)} (${pay})`
    )
    setCart([])
    setDisc(0)
    setShowPay(false)
    setTender(null)
  }

  return (
    <div className="pos">
      <div className="pos-left">
        <div className="pos-head">
          <div className="plogo">S</div>
          <div>
            <div className="ptitle">Canteen POS</div>
            <div className="psub">{SCHOOL.name}</div>
          </div>
          <div className="shift">
            <span className="sdot" /> Shift open · 07:05
          </div>
          <div className="ptotal">{fmtN(sessionTotal)} today</div>
          <button className="btn ghost sm" onClick={() => (adminPeek ? onLogout() : setShowClose(true))}>
            {adminPeek ? '← Back to admin' : '⎋ Close shift'}
          </button>
        </div>

        <div className="pos-cats">
          {POS_CATS.map((c) => (
            <button key={c} className={`pos-cat ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>

        <div className="pos-products">
          {products.map((p) => {
            const left = stock[p.id]
            return (
              <button key={p.id} className="ptile" onClick={() => add(p)} disabled={left === 0} style={left === 0 ? { opacity: 0.45 } : undefined}>
                <span className="emoji">{p.emoji}</span>
                <span className="pname">{p.name}</span>
                <span className="pprice">{fmtN(p.price)}</span>
                <span className={`pstock ${left <= 12 ? 'low' : ''}`}>
                  {left === 0 ? 'Sold out' : left <= 12 ? `⚠ ${left} left` : `${left} in stock`}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="pos-cart">
        <div className="cart-head">
          <h3>Current Order {count > 0 && `· ${count} item${count > 1 ? 's' : ''}`}</h3>
          <div className="attendant" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>Attendant: {attendant}</span>
            {cart.length > 0 && (
              <button
                className="btn red-ghost sm"
                onClick={() => { setCart([]); setDisc(0); showToast('Sale cleared — cart emptied') }}
              >
                ✕ Clear sale
              </button>
            )}
          </div>
        </div>

        <div className="cart-items">
          {cart.length === 0 ? (
            <div className="cart-empty">
              <div className="big">🛒</div>
              Tap a product to start an order
            </div>
          ) : (
            cart.map((l) => (
              <div key={l.id} className="cart-line">
                <div className="cl-info">
                  <div className="cl-name">{l.name}</div>
                  <div className="cl-unit">{fmtN(l.price)} each</div>
                </div>
                <div className="qty">
                  <button onClick={() => bump(l.id, -1)}>−</button>
                  <span className="q">{l.qty}</span>
                  <button onClick={() => bump(l.id, 1)}>+</button>
                </div>
                <div className="cl-total">{fmtN(l.price * l.qty)}</div>
              </div>
            ))
          )}
        </div>

        <div className="cart-foot">
          <div className="cf-row">
            <span>Subtotal</span>
            <span className="mono">{fmtN(subtotal)}</span>
          </div>
          <div className="cf-row" style={{ alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Discount
              {[0, 5, 10].map((d) => (
                <button
                  key={d}
                  className={`pos-cat ${disc === d ? 'active' : ''}`}
                  style={{ padding: '2px 8px', fontSize: 11 }}
                  onClick={() => setDisc(d)}
                >
                  {d}%
                </button>
              ))}
            </span>
            <span className="mono" style={{ color: discount > 0 ? 'var(--red)' : 'var(--ink)' }}>
              {discount > 0 ? '− ' + fmtN(discount) : 'N$ 0'}
            </span>
          </div>
          <div className="cf-row total">
            <span>TOTAL</span>
            <span className="amt">{fmtN(total)}</span>
          </div>
          <div className="pay-toggle">
            {['Cash', 'Card', 'Account'].map((m) => (
              <button key={m} className={pay === m ? 'active' : ''} onClick={() => setPay(m)}>
                {m === 'Cash' ? '💵' : m === 'Card' ? '💳' : '🎓'} {m}
              </button>
            ))}
          </div>
          <button className="charge-btn" disabled={cart.length === 0} onClick={() => { setTender(null); setShowPay(true) }}>
            Charge {fmtN(total)}
          </button>
        </div>
      </div>

      {showPay && (
        <Modal title={`Take payment — ${pay}`} onClose={() => setShowPay(false)}>
          {cart.map((l) => (
            <div key={l.id} className="cf-row" style={{ padding: '3px 0', fontSize: 13 }}>
              <span>{l.qty} × {l.name}</span>
              <span className="mono">{fmtN(l.price * l.qty)}</span>
            </div>
          ))}
          {discount > 0 && (
            <div className="cf-row" style={{ padding: '3px 0', fontSize: 13 }}>
              <span>Discount ({disc}%)</span>
              <span className="mono" style={{ color: 'var(--red)' }}>− {fmtN(discount)}</span>
            </div>
          )}
          <div className="cf-row total" style={{ marginTop: 8 }}>
            <span>TOTAL</span><span className="amt">{fmtN(total)}</span>
          </div>
          {pay === 'Cash' && (
            <>
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '14px 0 8px' }}>Cash received</div>
              <div className="pay-toggle">
                {tenderOptions.map((n) => (
                  <button key={n} className={received === n ? 'active' : ''} onClick={() => setTender(n)}>
                    {n === subtotal ? 'Exact' : fmtN(n)}
                  </button>
                ))}
              </div>
              <div className="cf-row" style={{ marginTop: 10, fontWeight: 700 }}>
                <span>Change due</span>
                <span className="mono" style={{ color: change > 0 ? 'var(--green)' : 'var(--ink)' }}>{fmtN(change)}</span>
              </div>
            </>
          )}
          {pay === 'Account' && (
            <>
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '14px 0 8px' }}>Student account</div>
              <select className="inline" style={{ width: '100%' }} value={acct} onChange={(e) => setAcct(e.target.value)}>
                {STUDENT_ACCOUNTS.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} · {a.id} — {fmtN(balances[a.id])}</option>
                ))}
              </select>
              <div className="cf-row" style={{ marginTop: 10, fontWeight: 700 }}>
                <span>Balance after sale</span>
                <span className="mono" style={{ color: insufficient ? 'var(--red)' : 'var(--green)' }}>
                  {insufficient ? 'Insufficient funds' : fmtN(acctBalance - subtotal)}
                </span>
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn primary" disabled={insufficient} onClick={confirmSale} style={insufficient ? { opacity: 0.5 } : undefined}>
              {pay === 'Cash' ? 'Confirm — cash in drawer' : pay === 'Card' ? 'Confirm — card approved' : 'Confirm — debit account'}
            </button>
            <button className="btn ghost" onClick={() => setShowPay(false)}>Back</button>
          </div>
        </Modal>
      )}

      {receipt && (
        <Modal title={`Receipt — sale #${receipt.no}`} onClose={() => setReceipt(null)} width={360}>
          <div style={{ textAlign: 'center', marginBottom: 10 }}>
            <div style={{ fontWeight: 700 }}>{SCHOOL.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>Canteen · Fri, 3 Jul 2026 · {attendant}</div>
          </div>
          {receipt.lines.map((l) => (
            <div key={l.id} className="cf-row" style={{ padding: '3px 0', fontSize: 13 }}>
              <span>{l.qty} × {l.name}</span>
              <span className="mono">{fmtN(l.price * l.qty)}</span>
            </div>
          ))}
          {receipt.discount > 0 && (
            <div className="cf-row" style={{ fontSize: 13 }}><span>Discount</span><span className="mono">− {fmtN(receipt.discount)}</span></div>
          )}
          <div className="cf-row total"><span>TOTAL · {receipt.pay}</span><span className="amt">{fmtN(receipt.total)}</span></div>
          {receipt.change > 0 && (
            <div className="cf-row" style={{ fontSize: 13 }}><span>Change</span><span className="mono">{fmtN(receipt.change)}</span></div>
          )}
          {receipt.acct && (
            <div className="cf-row" style={{ fontSize: 13 }}>
              <span>{receipt.acct.name} · balance</span>
              <span className="mono" style={{ fontWeight: 600 }}>{fmtN(receipt.acct.after)}</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="btn primary" onClick={() => { setReceipt(null); showToast('Receipt printed') }}>🖨 Print</button>
            <button className="btn ghost" onClick={() => setReceipt(null)}>Skip</button>
          </div>
        </Modal>
      )}

      {showClose && (
        <Modal title="Close shift — reconciliation" onClose={() => setShowClose(false)}>
          <div className="cf-row"><span>Attendant</span><span>{attendant}</span></div>
          <div className="cf-row"><span>Shift opened</span><span>07:05</span></div>
          <div className="cf-row"><span>Transactions</span><span className="mono">{shift.txns}</span></div>
          <div className="cf-row" style={{ marginTop: 8 }}><span>Cash takings</span><span className="mono">{fmtN(shift.cash)}</span></div>
          <div className="cf-row"><span>Card takings</span><span className="mono">{fmtN(shift.card)}</span></div>
          <div className="cf-row"><span>Student accounts</span><span className="mono">{fmtN(shift.account)}</span></div>
          <div className="cf-row total"><span>Total to bank</span><span className="amt">{fmtN(sessionTotal)}</span></div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '12px 0 16px' }}>
            The session is logged to Till Sessions for admin reconciliation.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn primary" onClick={onLogout}>Confirm & close shift</button>
            <button className="btn ghost" onClick={() => setShowClose(false)}>Keep selling</button>
          </div>
        </Modal>
      )}

      <Toast msg={toast} />
    </div>
  )
}
