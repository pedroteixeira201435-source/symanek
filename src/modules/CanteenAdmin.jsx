import React, { useState, useEffect, useCallback } from 'react'
import { StatCard, Tabs, Panel, Badge, Modal, Toast, useToast } from '../ui.jsx'
import { fmtN } from '../lib/format.js'
import {
  getCanteenSummary, listCanteenProducts, listTillSessions,
  canteenProductUpsert, canteenProductDelete, canteenInventoryAdjust, canteenTillClose,
} from '../api.js'

export default function CanteenAdmin({ role, openPOS }) {
  const readOnly = role.id === 'bursar' // bursar: sales reports only
  const [tab, setTab] = useState('Sales Dashboard')
  const tabs = readOnly ? ['Sales Dashboard', 'Till Sessions'] : ['Sales Dashboard', 'Inventory', 'Till Sessions']

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
        {!readOnly && <button className="btn amber sm" onClick={openPOS}>Open POS screen</button>}
      </div>
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === 'Sales Dashboard' && <Sales />}
      {tab === 'Inventory' && <Inventory />}
      {tab === 'Till Sessions' && <TillSessions />}
    </>
  )
}

function Empty({ children }) { return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)' }}>{children}</div> }

function Sales() {
  const [sum, setSum] = useState(null)
  useEffect(() => { getCanteenSummary().then(setSum).catch(() => {}) }, [])
  const top = sum?.top_sellers || []
  return (
    <>
      <div className="stat-row c3">
        <StatCard icon="💵" label="Sales Today" value={fmtN(sum?.sales_today || 0)} delta="today" />
        <StatCard icon="🧾" label="Transactions" value={sum?.transactions || 0} delta="today" deltaTone="neutral" />
        <StatCard icon="🧺" label="Avg Basket" value={fmtN(sum?.avg_basket || 0)} delta="per sale" />
      </div>
      <Panel title="Top sellers today" flush>
        {top.length === 0 ? <Empty>No sales recorded today.</Empty> : (
          <table className="data">
            <thead><tr><th>Item</th><th className="num">Units</th><th className="num">Revenue</th></tr></thead>
            <tbody>
              {top.map((t) => (
                <tr key={t.item || t.name}><td style={{ fontWeight: 600 }}>{t.item || t.name}</td><td className="num">{t.units}</td><td className="num">{fmtN(t.revenue)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  )
}

function Inventory() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showIn, setShowIn] = useState(false)
  const [edit, setEdit] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [toast, showToast] = useToast()

  const reload = useCallback(() => listCanteenProducts().then(setItems).catch(() => setItems([])), [])
  useEffect(() => { reload().finally(() => setLoading(false)) }, [reload])

  const saveItem = async (e) => {
    e.preventDefault(); const f = e.target
    try {
      await canteenProductUpsert({
        id: edit?.id ?? null, name: f.name.value.trim(), category: f.category.value,
        price: Number(f.price.value), stock: Number(f.stock.value), reorder: Number(f.reorder.value),
      })
    } catch (err) { showToast('Could not save' + (err?.message ? `: ${err.message}` : '')); return }
    setEdit(null); setShowNew(false); await reload(); showToast('Product saved')
  }
  const remove = async (it) => {
    try { await canteenProductDelete(it.id) } catch (err) { showToast('Could not delete' + (err?.message ? `: ${err.message}` : '')); return }
    await reload(); showToast(`${it.name} removed`)
  }
  const stockIn = async (e) => {
    e.preventDefault(); const f = e.target
    try { await canteenInventoryAdjust(f.item.value, Number(f.qty.value)) } catch (err) { showToast('Could not receive stock' + (err?.message ? `: ${err.message}` : '')); return }
    setShowIn(false); await reload(); showToast('Stock received')
  }

  const form = (init) => (
    <form onSubmit={saveItem}>
      <div className="field"><label>Item</label><input name="name" defaultValue={init?.name || ''} required /></div>
      <div className="grid2" style={{ gap: 12 }}>
        <div className="field"><label>Category</label>
          <select name="category" defaultValue={init?.cat || 'Food'}><option>Food</option><option>Drink</option><option>Snack</option><option>Stationery</option><option>Other</option></select>
        </div>
        <div className="field"><label>Price (N$)</label><input name="price" type="number" step="0.5" defaultValue={init?.price ?? 0} required /></div>
      </div>
      <div className="grid2" style={{ gap: 12 }}>
        <div className="field"><label>In stock</label><input name="stock" type="number" defaultValue={init?.stock ?? 0} /></div>
        <div className="field"><label>Reorder at</label><input name="reorder" type="number" defaultValue={init?.reorder ?? 0} /></div>
      </div>
      <button className="btn primary" type="submit">Save product</button>
    </form>
  )

  if (loading) return <Panel title="Inventory" flush><Empty>Loading…</Empty></Panel>
  return (
    <>
      <Panel
        title="Inventory"
        subtitle="Low-stock items flagged · click an item to edit"
        actions={
          <span style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost sm" onClick={() => setShowIn(true)} disabled={items.length === 0}>+ Stock in</button>
            <button className="btn primary sm" onClick={() => setShowNew(true)}>+ New product</button>
          </span>
        }
        flush
      >
        {items.length === 0 ? <Empty>No products yet — add one to start.</Empty> : (
          <table className="data">
            <thead><tr><th>Item</th><th>Category</th><th className="num">In stock</th><th className="num">Reorder at</th><th className="num">Price</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {items.map((it) => {
                const low = it.stock <= it.reorder
                return (
                  <tr key={it.id} style={low ? { background: 'var(--red-soft)' } : undefined}>
                    <td style={{ fontWeight: 600, cursor: 'pointer' }} onClick={() => setEdit(it)}>{it.name}</td>
                    <td>{it.cat || '—'}</td>
                    <td className="num" style={low ? { color: 'var(--red)', fontWeight: 700 } : undefined}>{it.stock}</td>
                    <td className="num">{it.reorder}</td>
                    <td className="num">{fmtN(it.price)}</td>
                    <td><Badge tone={low ? 'red' : 'green'}>{low ? 'Reorder' : 'OK'}</Badge></td>
                    <td><button className="btn ghost sm" onClick={() => remove(it)}>Delete</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Panel>

      {(edit || showNew) && (
        <Modal title={edit ? `Edit — ${edit.name}` : 'New product'} onClose={() => { setEdit(null); setShowNew(false) }} width={420}>
          {form(edit)}
        </Modal>
      )}
      {showIn && (
        <Modal title="Stock in" onClose={() => setShowIn(false)}>
          <form onSubmit={stockIn}>
            <div className="field"><label>Item</label><select name="item">{items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}</select></div>
            <div className="field"><label>Quantity received</label><input name="qty" type="number" min="1" defaultValue="24" required /></div>
            <button className="btn primary" type="submit">Receive stock</button>
          </form>
        </Modal>
      )}
      <Toast msg={toast} />
    </>
  )
}

function TillSessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState(null)
  const [counted, setCounted] = useState('')
  const [toast, showToast] = useToast()

  const reload = useCallback(() => listTillSessions().then(setSessions).catch(() => setSessions([])), [])
  useEffect(() => { reload().finally(() => setLoading(false)) }, [reload])

  const open = (t) => { setSel(t); setCounted(String(t.expected || 0)) }
  const variance = sel ? (Number(counted) || 0) - Number(sel.expected || 0) : 0
  const reconcile = async () => {
    try { await canteenTillClose(sel.id, Number(counted) || 0) } catch (err) { showToast('Could not close' + (err?.message ? `: ${err.message}` : '')); return }
    setSel(null); await reload(); showToast('Till closed & reconciled')
  }
  const fmtTime = (t) => (t ? new Date(t).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')

  if (loading) return <Panel title="Till sessions" flush><Empty>Loading…</Empty></Panel>
  return (
    <>
      <Panel title="Till sessions" subtitle="Cash reconciliation per shift · click a session" flush>
        {sessions.length === 0 ? <Empty>No till sessions yet.</Empty> : (
          <table className="data">
            <thead><tr><th>Opened</th><th>Closed</th><th className="num">Float</th><th className="num">Expected</th><th className="num">Counted</th><th className="num">Variance</th><th>Status</th></tr></thead>
            <tbody>
              {sessions.map((t) => (
                <tr key={t.id} style={{ cursor: t.status === 'open' ? 'pointer' : 'default' }} onClick={() => t.status === 'open' && open(t)}>
                  <td className="mono" style={{ fontSize: 12.5 }}>{fmtTime(t.opened_at)}</td>
                  <td className="mono" style={{ fontSize: 12.5 }}>{fmtTime(t.closed_at)}</td>
                  <td className="num">{fmtN(t.float_amt)}</td>
                  <td className="num">{t.expected != null ? fmtN(t.expected) : '—'}</td>
                  <td className="num">{t.counted != null ? fmtN(t.counted) : '—'}</td>
                  <td className="num" style={{ color: Number(t.variance) === 0 ? 'var(--green)' : 'var(--red)' }}>{t.counted != null ? fmtN(t.variance) : '—'}</td>
                  <td><Badge tone={t.status === 'open' ? 'amber' : 'gray'}>{t.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {sel && (
        <Modal title="Close till session" onClose={() => setSel(null)} width={420}>
          <div className="cf-row"><span>Opened</span><span className="mono">{fmtTime(sel.opened_at)}</span></div>
          <div className="cf-row"><span>Float</span><span className="mono">{fmtN(sel.float_amt)}</span></div>
          <div className="cf-row"><span>Expected (sales + float)</span><span className="mono">{fmtN(sel.expected || 0)}</span></div>
          <div className="field" style={{ margin: '12px 0 8px' }}>
            <label>Cash counted (N$)</label>
            <input type="number" value={counted} onChange={(e) => setCounted(e.target.value)} />
          </div>
          <div className="cf-row" style={{ marginBottom: 14 }}>
            <span>Variance</span>
            <span className="mono" style={{ fontWeight: 700, color: variance === 0 ? 'var(--green)' : 'var(--red)' }}>
              {variance === 0 ? 'Balanced' : `${variance > 0 ? '+' : '−'} ${fmtN(Math.abs(variance))}`}
            </span>
          </div>
          <button className="btn primary" onClick={reconcile}>Close & reconcile</button>
        </Modal>
      )}
      <Toast msg={toast} />
    </>
  )
}
