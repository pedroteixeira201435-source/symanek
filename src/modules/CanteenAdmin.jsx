import React, { useState } from 'react'
import { StatCard, Tabs, Panel, Badge, Modal, Toast, useToast } from '../ui.jsx'
import { CANTEEN_STATS, TOP_SELLERS, HOURLY_SALES, INVENTORY, TILL_SESSIONS, fmtN } from '../data.js'

export default function CanteenAdmin({ role, openPOS }) {
  const readOnly = role.id === 'bursar' // bursar: sales reports only
  const [tab, setTab] = useState('Sales Dashboard')
  const tabs = readOnly ? ['Sales Dashboard', 'Till Sessions'] : ['Sales Dashboard', 'Inventory', 'Till Sessions']

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
        {!readOnly && (
          <button className="btn amber sm" onClick={openPOS}>Open POS screen</button>
        )}
      </div>
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === 'Sales Dashboard' && <Sales />}
      {tab === 'Inventory' && <Inventory />}
      {tab === 'Till Sessions' && <TillSessions />}
    </>
  )
}

function Sales() {
  const max = Math.max(...HOURLY_SALES.map((h) => h.v))
  return (
    <>
      <div className="stat-row c4">
        <StatCard icon="💵" label="Sales Today" value={fmtN(CANTEEN_STATS.salesToday)} delta="+12% vs avg day" />
        <StatCard icon="🧾" label="Transactions" value={CANTEEN_STATS.transactions} delta="Since 07:05" deltaTone="neutral" />
        <StatCard icon="🧺" label="Avg Basket" value={fmtN(CANTEEN_STATS.avgBasket)} delta="+N$ 1.10 vs yesterday" />
        <StatCard icon="📊" label="Gross Margin" value={`${CANTEEN_STATS.margin}%`} delta="Target 38%" />
      </div>

      <div className="grid2">
        <Panel title="Top sellers today" flush>
          <table className="data">
            <thead>
              <tr><th>Item</th><th className="num">Units</th><th className="num">Revenue</th></tr>
            </thead>
            <tbody>
              {TOP_SELLERS.map((t) => (
                <tr key={t.item}>
                  <td style={{ fontWeight: 600 }}>{t.item}</td>
                  <td className="num">{t.units}</td>
                  <td className="num">{fmtN(t.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Hourly sales" subtitle="Peak at break time (10h)">
          <div className="chart">
            {HOURLY_SALES.map((h) => (
              <div key={h.h} className="bar-wrap">
                <span className="bval">{h.v}</span>
                <div className={`bar ${h.h === '10h' ? 'amber' : ''}`} style={{ height: `${(h.v / max) * 100}%` }} />
                <span className="blabel">{h.h}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  )
}

function Inventory() {
  const [items, setItems] = useState(INVENTORY)
  const [showIn, setShowIn] = useState(false)
  const [edit, setEdit] = useState(null)
  const [toast, showToast] = useToast()

  const saveItem = (e) => {
    e.preventDefault()
    const f = e.target
    const price = Number(f.price.value) || edit.price
    const reorder = Number(f.reorder.value) || edit.reorder
    setItems((list) => list.map((it) => (it.item === edit.item ? { ...it, price, reorder } : it)))
    setEdit(null)
    showToast(`${edit.item} updated — price ${fmtN(price)}, reorder at ${reorder}`)
  }

  const stockIn = (e) => {
    e.preventDefault()
    const f = e.target
    const qty = Number(f.qty.value) || 0
    const name = f.item.value
    setItems((list) => list.map((it) => (it.item === name ? { ...it, stock: it.stock + qty } : it)))
    setShowIn(false)
    showToast(`+${qty} units of ${name} received into stock`)
  }

  return (
    <>
    <Panel
      title="Inventory"
      subtitle="Low-stock items flagged · click an item to edit price / reorder point"
      actions={<button className="btn primary sm" onClick={() => setShowIn(true)}>+ Stock in</button>}
      flush
    >
      <table className="data">
        <thead>
          <tr>
            <th>Item</th><th>Category</th><th className="num">In stock</th><th className="num">Reorder at</th>
            <th className="num">Cost</th><th className="num">Price</th><th className="num">Margin</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const low = it.stock <= it.reorder
            const margin = Math.round(((it.price - it.cost) / it.price) * 100)
            return (
              <tr key={it.item} style={{ cursor: 'pointer', ...(low ? { background: 'var(--red-soft)' } : {}) }} onClick={() => setEdit(it)}>
                <td style={{ fontWeight: 600 }}>{it.item}</td>
                <td>{it.cat}</td>
                <td className="num" style={low ? { color: 'var(--red)', fontWeight: 700 } : undefined}>{it.stock}</td>
                <td className="num">{it.reorder}</td>
                <td className="num">{fmtN(it.cost)}</td>
                <td className="num">{fmtN(it.price)}</td>
                <td className="num">{margin}%</td>
                <td><Badge tone={low ? 'red' : 'green'}>{low ? 'Reorder' : 'OK'}</Badge></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Panel>

    {edit && (
      <Modal title={`Edit — ${edit.item}`} onClose={() => setEdit(null)} width={400}>
        <form onSubmit={saveItem}>
          <div className="grid2" style={{ gap: 12 }}>
            <div className="field"><label>Selling price (N$)</label><input name="price" type="number" step="0.5" defaultValue={edit.price} /></div>
            <div className="field"><label>Reorder point</label><input name="reorder" type="number" defaultValue={edit.reorder} /></div>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 14 }}>
            Cost {fmtN(edit.cost)} · current stock {edit.stock} · margin recalculates automatically
          </div>
          <button className="btn primary" type="submit">Save item</button>
        </form>
      </Modal>
    )}

    {showIn && (
      <Modal title="Stock in" onClose={() => setShowIn(false)}>
        <form onSubmit={stockIn}>
          <div className="field">
            <label>Item</label>
            <select name="item">
              {items.map((it) => (
                <option key={it.item}>{it.item}</option>
              ))}
            </select>
          </div>
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
  const [sessions, setSessions] = useState(TILL_SESSIONS)
  const [sel, setSel] = useState(null) // index of session in modal
  const [counted, setCounted] = useState('')
  const [toast, showToast] = useToast()

  const open = (i) => { setSel(i); setCounted(String(sessions[i].cash)) }
  const s = sel !== null ? sessions[sel] : null
  const variance = s ? (Number(counted) || 0) - s.cash : 0

  const reconcile = () => {
    setSessions((list) => list.map((x, i) => (i === sel ? { ...x, closed: '14:00', status: 'Closed' } : x)))
    setSel(null)
    showToast(
      variance === 0
        ? 'Till closed — cash balanced, no variance'
        : `Till closed — variance of ${fmtN(Math.abs(variance))} ${variance > 0 ? 'over' : 'short'} logged`
    )
  }

  return (
    <>
    <Panel title="Till sessions" subtitle="Cash vs card reconciliation per shift · click a session" flush>
      <table className="data">
        <thead>
          <tr>
            <th>Seller</th><th>Opened</th><th>Closed</th><th className="num">Txns</th>
            <th className="num">Cash</th><th className="num">Card</th><th className="num">Total</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((t, i) => (
            <tr key={i} style={{ cursor: 'pointer' }} onClick={() => open(i)}>
              <td style={{ fontWeight: 600 }}>
                {t.seller}
                {t.day && <span style={{ color: 'var(--ink-faint)', fontWeight: 400, fontSize: 12 }}> · {t.day}</span>}
              </td>
              <td className="mono" style={{ fontSize: 12.5 }}>{t.opened}</td>
              <td className="mono" style={{ fontSize: 12.5 }}>{t.closed}</td>
              <td className="num">{t.txns}</td>
              <td className="num">{fmtN(t.cash)}</td>
              <td className="num">{fmtN(t.card)}</td>
              <td className="num" style={{ fontWeight: 700 }}>{fmtN(t.cash + t.card)}</td>
              <td><Badge tone={t.status === 'Open' ? 'amber' : 'gray'}>{t.status}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>

    {s && (
      <Modal title={`Till session — ${s.seller}${s.day ? ' · ' + s.day : ''}`} onClose={() => setSel(null)} width={420}>
        <div className="cf-row"><span>Opened / closed</span><span className="mono">{s.opened} / {s.closed}</span></div>
        <div className="cf-row"><span>Transactions</span><span className="mono">{s.txns}</span></div>
        <div className="cf-row"><span>Card takings</span><span className="mono">{fmtN(s.card)}</span></div>
        <div className="cf-row"><span>Cash expected</span><span className="mono">{fmtN(s.cash)}</span></div>
        {s.status === 'Open' ? (
          <>
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
          </>
        ) : (
          <div className="cf-row total"><span>Banked total</span><span className="amt">{fmtN(s.cash + s.card)}</span></div>
        )}
      </Modal>
    )}
    <Toast msg={toast} />
    </>
  )
}
