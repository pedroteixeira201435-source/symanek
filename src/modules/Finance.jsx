import React, { useState } from 'react'
import { StatCard, Tabs, Panel, Badge, Progress, Modal, Toast, useToast } from '../ui.jsx'
import { FIN_STATS, EXPENSE_BREAKDOWN, COLLECTION_BY_BAND, INVOICES, FEE_STRUCTURE, PAYMENTS, DEBTORS, SPONSORS, BUDGET, fmtN } from '../data.js'
import { Donut } from '../ui.jsx'

const INV_TONE = { Paid: 'green', Partial: 'orange', Overdue: 'red', Pending: 'gray' }
const PAY_TONE = { 'Bank transfer': 'teal', Cash: 'green', Card: 'blue' }

export default function Finance() {
  const [tab, setTab] = useState('Overview')
  // lifted so a payment recorded on an invoice appears in the Payments tab
  const [payments, setPayments] = useState(PAYMENTS)
  const [expenses, setExpenses] = useState(EXPENSE_BREAKDOWN)

  const addPayment = (inv, amt, method) =>
    setPayments((ps) => [{ date: '04 Jul 2026', invoice: inv.id, learner: inv.learner, method, amount: amt }, ...ps])

  const addExpense = (cat, amount) =>
    setExpenses((es) => {
      const next = es.some((e) => e.cat === cat)
        ? es.map((e) => (e.cat === cat ? { ...e, amount: e.amount + amount } : e))
        : [...es, { cat, amount, pct: 0 }]
      const total = next.reduce((s, e) => s + e.amount, 0)
      return next.map((e) => ({ ...e, pct: Math.round((e.amount / total) * 100) }))
    })

  return (
    <>
      <Tabs tabs={['Overview', 'Collections', 'Invoices', 'Payments', 'Sponsorships', 'Budget', 'Fee Structure', 'Expenses']} active={tab} onChange={setTab} />
      {tab === 'Overview' && <Overview expenses={expenses} />}
      {tab === 'Collections' && <Collections />}
      {tab === 'Budget' && <Budget />}
      {tab === 'Invoices' && <Invoices onPayment={addPayment} />}
      {tab === 'Payments' && <Payments payments={payments} />}
      {tab === 'Sponsorships' && <Sponsorships />}
      {tab === 'Fee Structure' && <FeeStructure />}
      {tab === 'Expenses' && <Expenses expenses={expenses} onAdd={addExpense} />}
    </>
  )
}

// bursar's daily work queue: who do I chase today, and where is each case?
const STAGE_TONE = { New: 'gray', 'Reminder sent': 'blue', 'Letter sent': 'orange', 'Payment plan': 'teal', 'Suspension list': 'red' }
const NEXT_STAGE = { New: 'Reminder sent', 'Reminder sent': 'Letter sent', 'Letter sent': 'Suspension list' }

function Collections() {
  const [debtors, setDebtors] = useState(DEBTORS)
  const [planFor, setPlanFor] = useState(null)
  const [toast, showToast] = useToast()
  const totalOut = debtors.reduce((s, d) => s + d.balance, 0)

  const advance = (id) => {
    const d = debtors.find((d) => d.id === id)
    const next = NEXT_STAGE[d.stage]
    if (!next) return
    setDebtors((ds) => ds.map((x) => (x.id === id ? { ...x, stage: next } : x)))
    showToast(`${d.learner} — ${next === 'Suspension list' ? 'moved to suspension list (principal notified)' : next.toLowerCase()}`)
  }

  const logPromise = (id) => {
    setDebtors((ds) => ds.map((x) => (x.id === id ? { ...x, promise: '15 Jul 2026' } : x)))
    const d = debtors.find((d) => d.id === id)
    showToast(`Promise to pay logged for ${d.learner} — alert set for 15 Jul`)
  }

  const startPlan = (e) => {
    e.preventDefault()
    const months = Number(e.target.months.value)
    setDebtors((ds) => ds.map((x) => (x.id === planFor.id ? { ...x, stage: 'Payment plan' } : x)))
    showToast(`Payment plan for ${planFor.learner}: ${months} × ${fmtN(Math.ceil(planFor.balance / months))} /month`)
    setPlanFor(null)
  }

  // debtor aging — the auditor's first question
  const buckets = [
    ['0–30 days', debtors.filter((d) => d.daysOver <= 30)],
    ['31–60 days', debtors.filter((d) => d.daysOver > 30 && d.daysOver <= 60)],
    ['60+ days', debtors.filter((d) => d.daysOver > 60)],
  ].map(([label, ds]) => [label, ds.reduce((s, d) => s + d.balance, 0), ds.length])

  return (
    <>
      <Panel title="Debtor aging" subtitle="Outstanding balances by days overdue">
        {buckets.map(([label, amt, n], i) => (
          <div key={label} className="hbar-row">
            <span className="hlabel">{label}</span>
            <Progress pct={totalOut ? (amt / totalOut) * 100 : 0} tone={i === 0 ? '' : 'amber'} />
            <span className="hval">{fmtN(amt)} · {n} acc</span>
          </div>
        ))}
      </Panel>

      <Panel
        title="Collections queue — who to chase today"
        subtitle={`${debtors.length} accounts · ${fmtN(totalOut)} outstanding · sorted by days overdue`}
        flush
      >
        <table className="data">
          <thead>
            <tr>
              <th>Student / next of kin</th><th className="num">Balance</th><th className="num">Days over</th>
              <th>Stage</th><th>Promise to pay</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {[...debtors].sort((a, b) => b.daysOver - a.daysOver).map((d) => (
              <tr key={d.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{d.learner} ({d.grade})</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>{d.guardian}</div>
                </td>
                <td className="num" style={{ color: 'var(--red)', fontWeight: 600 }}>{fmtN(d.balance)}</td>
                <td className="num">{d.daysOver}</td>
                <td><Badge tone={STAGE_TONE[d.stage]}>{d.stage}</Badge></td>
                <td>
                  {d.promise ? (
                    <Badge tone="amber">📌 {d.promise}</Badge>
                  ) : (
                    <button className="btn ghost sm" onClick={() => logPromise(d.id)}>Log promise</button>
                  )}
                </td>
                <td>
                  <span style={{ display: 'flex', gap: 6 }}>
                    {NEXT_STAGE[d.stage] && (
                      <button className="btn primary sm" onClick={() => advance(d.id)}>
                        {NEXT_STAGE[d.stage] === 'Suspension list' ? 'Escalate' : 'Send ' + NEXT_STAGE[d.stage].split(' ')[0].toLowerCase()}
                      </button>
                    )}
                    {d.stage !== 'Payment plan' && (
                      <button className="btn ghost sm" onClick={() => setPlanFor(d)}>Plan</button>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {planFor && (
        <Modal title={`Payment plan — ${planFor.learner}`} onClose={() => setPlanFor(null)} width={400}>
          <form onSubmit={startPlan}>
            <div className="cf-row"><span>Outstanding balance</span><span className="mono" style={{ fontWeight: 700 }}>{fmtN(planFor.balance)}</span></div>
            <div className="field" style={{ marginTop: 12 }}>
              <label>Instalments (months)</label>
              <select name="months"><option>2</option><option>3</option><option>4</option></select>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 14 }}>
              Student signs the agreement · missed instalment re-opens the collections case automatically
            </div>
            <button className="btn primary" type="submit">Create plan</button>
          </form>
        </Modal>
      )}
      <Toast msg={toast} />
    </>
  )
}

// third-party funders: NSFAF/NTA/corporate bursaries — billed to the
// sponsor, not the guardian; a claim has its own dunning lifecycle
const CLAIM_TONE = { Paid: 'green', 'Claim submitted': 'blue', 'Awaiting PO': 'orange', 'Internal transfer': 'purple' }

function Sponsorships() {
  const [sponsors, setSponsors] = useState(SPONSORS)
  const [toast, showToast] = useToast()
  const billed = sponsors.reduce((s, x) => s + x.billed, 0)
  const received = sponsors.reduce((s, x) => s + x.received, 0)

  const chase = (id) => {
    const s = sponsors.find((x) => x.id === id)
    setSponsors((ss) => ss.map((x) => (x.id === id ? { ...x, status: 'Claim submitted' } : x)))
    showToast(`Claim ${s.ref} submitted to ${s.sponsor} — follow-up alert set for 20 Jul`)
  }

  return (
    <>
      <div className="stat-row c4">
        <StatCard icon="🤝" label="Active sponsors" value={sponsors.length} delta="NSFAF + NTA + corporate" deltaTone="neutral" />
        <StatCard icon="🎓" label="Sponsored students" value="61" delta="7% of enrolment" deltaTone="neutral" />
        <StatCard icon="🧾" label="Billed to sponsors" value={fmtN(billed)} delta="Term 3" deltaTone="neutral" />
        <StatCard icon="⏳" label="Claims outstanding" value={fmtN(billed - received)} delta="2 claims pending" deltaTone="down" />
      </div>

      <Panel
        title="Sponsorships & bursaries"
        subtitle="Sponsor invoices bypass guardian dunning · claims tracked to payout"
        flush
      >
        <table className="data">
          <thead>
            <tr>
              <th>Sponsor</th><th>Students covered</th><th className="num">Coverage</th>
              <th className="num">Billed</th><th className="num">Received</th><th>Claim status</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sponsors.map((s) => (
              <tr key={s.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{s.sponsor}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>{s.type} · {s.ref}</div>
                </td>
                <td style={{ fontSize: 12.5 }}>{s.learners.join(', ')}</td>
                <td className="num">{s.coverage}%</td>
                <td className="num">{fmtN(s.billed)}</td>
                <td className="num" style={{ color: s.received > 0 ? 'var(--green)' : 'var(--ink-faint)', fontWeight: 600 }}>
                  {fmtN(s.received)}
                </td>
                <td><Badge tone={CLAIM_TONE[s.status]}>{s.status}</Badge></td>
                <td>
                  {s.status === 'Awaiting PO' ? (
                    <button className="btn primary sm" onClick={() => chase(s.id)}>Submit claim</button>
                  ) : s.status === 'Claim submitted' ? (
                    <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>awaiting payout</span>
                  ) : (
                    <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Toast msg={toast} />
    </>
  )
}

// budget control: approved budget vs actual spend per category
function Budget() {
  const [toast, showToast] = useToast()
  const tBudget = BUDGET.reduce((s, b) => s + b.budget, 0)
  const tActual = BUDGET.reduce((s, b) => s + b.actual, 0)

  return (
    <>
      <div className="stat-row c4">
        <StatCard icon="🎯" label="Approved budget" value={fmtN(tBudget)} delta="Term 3" deltaTone="neutral" />
        <StatCard icon="🧾" label="Actual spend" value={fmtN(tActual)} delta={`${Math.round((tActual / tBudget) * 100)}% consumed`} deltaTone="neutral" />
        <StatCard icon="📉" label="Variance" value={fmtN(tBudget - tActual)} delta={tBudget >= tActual ? 'Under budget' : 'Over budget'} deltaTone={tBudget >= tActual ? 'up' : 'down'} />
        <StatCard icon="⚠️" label="Lines over budget" value={BUDGET.filter((b) => b.actual > b.budget).length} delta="Materials & Transport" deltaTone="down" />
      </div>

      <Panel
        title="Budget vs actual — Term 3"
        subtitle="Board-approved budget · overspend needs a virement approved by the principal"
        actions={<button className="btn ghost sm" onClick={() => showToast('Budget report exported for the board pack')}>⬇ Export</button>}
        flush
      >
        <table className="data">
          <thead>
            <tr>
              <th>Category</th><th className="num">Budget</th><th className="num">Actual</th>
              <th className="num">Variance</th><th style={{ width: '26%' }}>Consumed</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {BUDGET.map((b) => {
              const pct = Math.round((b.actual / b.budget) * 100)
              const over = b.actual > b.budget
              return (
                <tr key={b.cat}>
                  <td style={{ fontWeight: 600 }}>{b.cat}</td>
                  <td className="num">{fmtN(b.budget)}</td>
                  <td className="num">{fmtN(b.actual)}</td>
                  <td className="num" style={{ color: over ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
                    {over ? '−' : '+'} {fmtN(Math.abs(b.budget - b.actual))}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Progress pct={pct} tone={over ? 'amber' : ''} />
                      <span className="mono" style={{ fontSize: 12 }}>{pct}%</span>
                    </div>
                  </td>
                  <td>{over ? <Badge tone="red">Over</Badge> : pct >= 90 ? <Badge tone="orange">Watch</Badge> : <Badge tone="green">On track</Badge>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Panel>
      <Toast msg={toast} />
    </>
  )
}

function Payments({ payments }) {
  const total = payments.reduce((s, p) => s + p.amount, 0)
  return (
    <Panel title="Payments received" subtitle={`${payments.length} recent payments · ${fmtN(total)} listed`} flush>
      <table className="data">
        <thead>
          <tr><th>Date</th><th>Invoice</th><th>Student</th><th>Method</th><th className="num">Amount</th></tr>
        </thead>
        <tbody>
          {payments.map((p, i) => (
            <tr key={i}>
              <td>{p.date}</td>
              <td className="mono" style={{ fontSize: 12.5 }}>{p.invoice}</td>
              <td style={{ fontWeight: 600 }}>{p.learner}</td>
              <td><Badge tone={PAY_TONE[p.method]}>{p.method}</Badge></td>
              <td className="num" style={{ color: 'var(--green)', fontWeight: 600 }}>{fmtN(p.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}

function Overview({ expenses }) {
  return (
    <>
      <div className="stat-row c4">
        <StatCard icon="💰" label="Fees Collected" value={fmtN(FIN_STATS.collected)} delta="87% of target" deltaTone="neutral" />
        <StatCard icon="⏳" label="Outstanding" value={fmtN(FIN_STATS.outstanding)} delta="94 students in arrears" deltaTone="down" />
        <StatCard icon="🧾" label="Total Expenses" value={fmtN(FIN_STATS.expenses)} delta="Term to date" deltaTone="neutral" />
        <StatCard icon="📈" label="Net Position" value={fmtN(FIN_STATS.net)} delta="Positive" />
      </div>

      <div className="grid2">
        <Panel title="Term fees — position" subtitle="Billed N$ 1,630,000">
          <Donut
            center="87%"
            segs={[
              ['Collected', FIN_STATS.collected, 'var(--petrol-600)'],
              ['Outstanding', FIN_STATS.outstanding, 'var(--amber)'],
            ]}
          />
        </Panel>

        <Panel title="Expense breakdown" subtitle="Term 3 to date">
          {expenses.map((e) => (
            <div key={e.cat} className="hbar-row">
              <span className="hlabel">{e.cat}</span>
              <Progress pct={e.pct} tone={e.cat === 'Salaries' ? '' : 'amber'} />
              <span className="hval">{e.pct}%</span>
            </div>
          ))}
        </Panel>

        <Panel title="Collection by programme" flush>
          <table className="data">
            <thead>
              <tr><th>Band</th><th className="num">Billed</th><th className="num">Collected</th><th className="num">Rate</th><th /></tr>
            </thead>
            <tbody>
              {COLLECTION_BY_BAND.map((b) => (
                <tr key={b.band}>
                  <td style={{ fontWeight: 600 }}>{b.band}</td>
                  <td className="num">{fmtN(b.billed)}</td>
                  <td className="num">{fmtN(b.collected)}</td>
                  <td className="num">{b.rate}%</td>
                  <td>
                    <Badge tone={b.rate >= 85 ? 'green' : b.rate >= 75 ? 'orange' : 'red'}>
                      {b.rate >= 85 ? 'On track' : b.rate >= 75 ? 'Watch' : 'Behind'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  )
}

function Invoices({ onPayment }) {
  const [invoices, setInvoices] = useState(INVOICES)
  const [payMethod, setPayMethod] = useState('Bank transfer')
  const [sel, setSel] = useState(null) // invoice open in detail modal
  const [showNew, setShowNew] = useState(false)
  const [payAmt, setPayAmt] = useState('')
  const [toast, showToast] = useToast()

  const open = (inv) => { setSel(inv); setPayAmt(String(inv.balance)) }

  const recordPayment = () => {
    const amt = Math.min(Number(payAmt) || 0, sel.balance)
    if (amt <= 0) return
    const updated = {
      ...sel,
      balance: sel.balance - amt,
      status: sel.balance - amt <= 0 ? 'Paid' : 'Partial',
    }
    setInvoices((list) => list.map((i) => (i.id === sel.id ? updated : i)))
    onPayment(sel, amt, payMethod)
    setSel(null)
    showToast(`Payment of ${fmtN(amt)} recorded on ${sel.id} — see Payments tab`)
  }

  const createInvoice = (e) => {
    e.preventDefault()
    const f = e.target
    const amount = Number(f.amount.value) || 0
    const inv = {
      id: `INV-${2214 + invoices.length}`,
      learner: f.learner.value || 'New learner',
      grade: f.grade.value,
      amount,
      balance: amount,
      due: '15 Aug 2026',
      status: 'Pending',
    }
    setInvoices((list) => [inv, ...list])
    setShowNew(false)
    showToast(`${inv.id} issued to ${inv.learner}`)
  }

  // derive mock payment history from status (no extra dataset needed)
  const history = (inv) =>
    inv.amount - inv.balance > 0
      ? [{ date: '28 Jun 2026', method: 'Bank transfer', amt: inv.amount - inv.balance }]
      : []

  return (
    <>
      <Panel
        title="Invoices"
        subtitle="Semester 2, 2026 · 842 issued · click a row for details"
        actions={
          <>
            <button className="btn ghost sm" onClick={() => showToast('Invoices exported to CSV')}>⬇ Export</button>
            <button className="btn primary sm" onClick={() => setShowNew(true)}>+ New invoice</button>
          </>
        }
        flush
      >
        <table className="data">
          <thead>
            <tr>
              <th>Invoice</th><th>Student</th><th>Programme</th>
              <th className="num">Amount</th><th className="num">Balance</th><th>Due</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} style={{ cursor: 'pointer' }} onClick={() => open(inv)}>
                <td className="mono" style={{ fontSize: 12.5 }}>{inv.id}</td>
                <td style={{ fontWeight: 600 }}>{inv.learner}</td>
                <td>{inv.grade}</td>
                <td className="num">{fmtN(inv.amount)}</td>
                <td className="num" style={{ color: inv.balance > 0 ? 'var(--red)' : 'var(--ink-faint)' }}>
                  {fmtN(inv.balance)}
                </td>
                <td>{inv.due}</td>
                <td><Badge tone={INV_TONE[inv.status]}>{inv.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {sel && (
        <Modal title={`${sel.id} — ${sel.learner}`} onClose={() => setSel(null)}>
          <div className="cf-row"><span>Programme</span><span>{sel.grade}</span></div>
          <div className="cf-row"><span>Amount</span><span className="mono">{fmtN(sel.amount)}</span></div>
          <div className="cf-row"><span>Due date</span><span>{sel.due}</span></div>
          <div className="cf-row"><span>Status</span><Badge tone={INV_TONE[sel.status]}>{sel.status}</Badge></div>
          <div className="cf-row total"><span>Balance</span><span className="amt">{fmtN(sel.balance)}</span></div>

          <div style={{ margin: '16px 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)' }}>
            PAYMENT HISTORY
          </div>
          {history(sel).length === 0 ? (
            <div style={{ color: 'var(--ink-faint)', fontSize: 13, padding: '6px 0 14px' }}>No payments yet</div>
          ) : (
            history(sel).map((p, i) => (
              <div key={i} className="cf-row" style={{ borderBottom: '1px solid #e9eef3', padding: '8px 0' }}>
                <span>{p.date} · {p.method}</span>
                <span className="mono" style={{ color: 'var(--green)', fontWeight: 600 }}>{fmtN(p.amt)}</span>
              </div>
            ))
          )}

          {sel.balance > 0 && (
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <input
                className="inline"
                type="number"
                min="1"
                max={sel.balance}
                value={payAmt}
                onChange={(e) => setPayAmt(e.target.value)}
                style={{ width: 120 }}
              />
              <select className="inline" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                <option>Bank transfer</option><option>Cash</option><option>Card</option>
              </select>
              <button className="btn green" onClick={recordPayment}>Record payment</button>
            </div>
          )}
        </Modal>
      )}

      {showNew && (
        <Modal title="New invoice" onClose={() => setShowNew(false)}>
          <form onSubmit={createInvoice}>
            <div className="field"><label>Student</label><input name="learner" placeholder="Full name" required /></div>
            <div className="grid2" style={{ gap: 12 }}>
              <div className="field">
                <label>Programme</label>
                <select name="grade">
                  <option>8A</option><option>9C</option><option>10B</option><option>11A</option>
                  <option>12A</option><option>Voc</option><option>AdEd</option>
                </select>
              </div>
              <div className="field"><label>Amount (N$)</label><input name="amount" type="number" defaultValue="11200" required /></div>
            </div>
            <button className="btn primary" type="submit">Issue invoice</button>
          </form>
        </Modal>
      )}

      <Toast msg={toast} />
    </>
  )
}

function FeeStructure() {
  const [fees, setFees] = useState(FEE_STRUCTURE)
  const [sel, setSel] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [toast, showToast] = useToast()

  const addBand = (e) => {
    e.preventDefault()
    const f = e.target
    const band = { band: f.band.value, tuition: Number(f.tuition.value) || 0, levy: Number(f.levy.value) || 0, learners: 0 }
    setFees((fs) => [...fs, band])
    setShowNew(false)
    showToast(`Fee band "${band.band}" created — ${fmtN(band.tuition + band.levy)}/term`)
  }

  const save = (e) => {
    e.preventDefault()
    const f = e.target
    const tuition = Number(f.tuition.value) || 0
    const levy = Number(f.levy.value) || 0
    setFees((fs) => fs.map((x) => (x.band === sel.band ? { ...x, tuition, levy } : x)))
    setSel(null)
    showToast(`Fee structure updated — ${sel.band}: ${fmtN(tuition + levy)}/term`)
  }

  return (
    <>
    <Panel
      title="Fee structure"
      subtitle="Per learner, per term · NamRA-aligned · click a band to edit"
      actions={<button className="btn primary sm" onClick={() => setShowNew(true)}>+ Add band</button>}
      flush
    >
      <table className="data">
        <thead>
          <tr>
            <th>Grade band</th><th className="num">Tuition</th><th className="num">Levy</th>
            <th className="num">Total / term</th><th className="num">Students</th><th className="num">Term revenue</th>
          </tr>
        </thead>
        <tbody>
          {fees.map((f) => {
            const total = f.tuition + f.levy
            return (
              <tr key={f.band} style={{ cursor: 'pointer' }} onClick={() => setSel(f)}>
                <td style={{ fontWeight: 600 }}>{f.band}</td>
                <td className="num">{fmtN(f.tuition)}</td>
                <td className="num">{fmtN(f.levy)}</td>
                <td className="num" style={{ fontWeight: 600 }}>{fmtN(total)}</td>
                <td className="num">{f.learners}</td>
                <td className="num">{fmtN(total * f.learners)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Panel>

    {sel && (
      <Modal title={`Edit fees — ${sel.band}`} onClose={() => setSel(null)} width={400}>
        <form onSubmit={save}>
          <div className="grid2" style={{ gap: 12 }}>
            <div className="field"><label>Tuition (N$/term)</label><input name="tuition" type="number" defaultValue={sel.tuition} /></div>
            <div className="field"><label>Levy (N$/term)</label><input name="levy" type="number" defaultValue={sel.levy} /></div>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 14 }}>
            Applies to {sel.learners} students from next term · NamRA reporting updates automatically
          </div>
          <button className="btn primary" type="submit">Save fees</button>
        </form>
      </Modal>
    )}

    {showNew && (
      <Modal title="New fee band" onClose={() => setShowNew(false)} width={420}>
        <form onSubmit={addBand}>
          <div className="field"><label>Band name</label><input name="band" placeholder="e.g. Diploma programmes (per semester)" required /></div>
          <div className="grid2" style={{ gap: 12 }}>
            <div className="field"><label>Tuition (N$)</label><input name="tuition" type="number" defaultValue="12500" /></div>
            <div className="field"><label>Levy (N$)</label><input name="levy" type="number" defaultValue="1800" /></div>
          </div>
          <button className="btn primary" type="submit">Create band</button>
        </form>
      </Modal>
    )}
    <Toast msg={toast} />
    </>
  )
}

function Expenses({ expenses, onAdd }) {
  const [showLog, setShowLog] = useState(false)
  const [toast, showToast] = useToast()
  const total = expenses.reduce((s, e) => s + e.amount, 0)

  const log = (e) => {
    e.preventDefault()
    const f = e.target
    const amount = Number(f.amount.value) || 0
    onAdd(f.cat.value, amount)
    setShowLog(false)
    showToast(`${fmtN(amount)} logged under ${f.cat.value}`)
  }

  return (
    <>
    <Panel
      title="Expenses"
      subtitle={`Term 3 to date · ${fmtN(total)}`}
      actions={<button className="btn primary sm" onClick={() => setShowLog(true)}>+ Log expense</button>}
      flush
    >
      <table className="data">
        <thead>
          <tr><th>Category</th><th className="num">Amount</th><th className="num">% of total</th><th style={{ width: '32%' }}>Distribution</th></tr>
        </thead>
        <tbody>
          {expenses.map((e) => (
            <tr key={e.cat}>
              <td style={{ fontWeight: 600 }}>{e.cat}</td>
              <td className="num">{fmtN(e.amount)}</td>
              <td className="num">{e.pct}%</td>
              <td><Progress pct={e.pct} tone={e.cat === 'Salaries' ? '' : 'amber'} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>

    {showLog && (
      <Modal title="Log expense" onClose={() => setShowLog(false)} width={400}>
        <form onSubmit={log}>
          <div className="field">
            <label>Category</label>
            <select name="cat">
              {expenses.map((e) => <option key={e.cat}>{e.cat}</option>)}
              <option>Other</option>
            </select>
          </div>
          <div className="field"><label>Amount (N$)</label><input name="amount" type="number" min="1" defaultValue="2500" required /></div>
          <button className="btn primary" type="submit">Log expense</button>
        </form>
      </Modal>
    )}
    <Toast msg={toast} />
    </>
  )
}
