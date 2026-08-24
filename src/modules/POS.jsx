import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Panel, Badge, Modal, Toast, useToast } from '../ui.jsx'
import { fmtN } from '../lib/format.js'
import { listCanteenProducts, listCanteenAccounts, canteenRecordSale } from '../api.js'

export default function POS({ attendant = 'Seller', onLogout, adminPeek = false }) {
  const [toast, showToast] = useToast()
  const [products, setProducts] = useState([])
  const [accounts, setAccounts] = useState([])
  const [cart, setCart] = useState([])
  const [pay, setPay] = useState('cash')
  const [loading, setLoading] = useState(true)
  const [receipt, setReceipt] = useState(null)
  const reload = useCallback(() => Promise.all([
    listCanteenProducts().then(setProducts).catch(() => setProducts([])),
    listCanteenAccounts().then(setAccounts).catch(() => setAccounts([])),
  ]), [])
  useEffect(() => { reload().finally(() => setLoading(false)) }, [reload])
  const cats = useMemo(() => [...new Set(products.map((p) => p.cat || p.category || 'Other'))], [products])
  const total = cart.reduce((s, l) => s + l.price * l.qty, 0)
  const add = (p) => setCart((cs) => {
    const cur = cs.find((x) => x.id === p.id)
    return cur ? cs.map((x) => x.id === p.id ? { ...x, qty: x.qty + 1 } : x) : [...cs, { id: p.id, name: p.name, price: Number(p.price || 0), qty: 1 }]
  })
  const checkout = async () => {
    if (cart.length === 0) return showToast('Cart is empty')
    try {
      const res = await canteenRecordSale({ total, pay, lines: cart })
      setReceipt(res); setCart([]); await reload(); showToast('Sale recorded')
    } catch (err) { showToast('Could not record sale: ' + (err?.message || err)) }
  }
  if (loading) return <Panel title="Canteen POS" flush><Empty>Loading...</Empty></Panel>
  return (
    <div className={adminPeek ? '' : 'pos-shell'}>
      <Panel title="Canteen POS" subtitle={`${attendant} · products from backend`} actions={onLogout && <button className="btn ghost sm" onClick={onLogout}>Close</button>}>
        {products.length === 0 ? <Empty>No canteen products yet.</Empty> : cats.map((cat) => (
          <div key={cat} style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{cat}</div>
            <div className="grid2">{products.filter((p) => (p.cat || p.category || 'Other') === cat).map((p) => (
              <button key={p.id} className="btn ghost" style={{ justifyContent: 'space-between' }} onClick={() => add(p)}>
                <span>{p.name}</span><span>{fmtN(p.price)}</span>
              </button>
            ))}</div>
          </div>
        ))}
      </Panel>
      <Panel title="Cart" subtitle={`${cart.length} line${cart.length === 1 ? '' : 's'}`}>
        {cart.length === 0 ? <Empty>No items selected.</Empty> : cart.map((l) => <div key={l.id} className="cf-row" style={{ padding: '8px 0' }}><span>{l.qty} x {l.name}</span><strong>{fmtN(l.qty * l.price)}</strong></div>)}
        <div className="cf-row" style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 8 }}><span>Total</span><span className="amt">{fmtN(total)}</span></div>
        <div className="field"><label>Payment method</label><select value={pay} onChange={(e) => setPay(e.target.value)}><option value="cash">Cash</option><option value="account">Student account</option><option value="card">Card</option></select></div>
        {pay === 'account' && accounts.length === 0 && <div className="di-sub">No student accounts available.</div>}
        <button className="btn primary" onClick={checkout} disabled={cart.length === 0}>Record sale</button>
      </Panel>
      {receipt && <Modal title="Receipt" onClose={() => setReceipt(null)}><pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(receipt, null, 2)}</pre></Modal>}
      <Toast msg={toast} />
    </div>
  )
}

function Empty({ children }) {
  return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)' }}>{children}</div>
}
