import React, { useState, useEffect } from 'react'
import { StatCard, Panel, Progress, Toast, useToast, Icon } from '../ui.jsx'
import { fmtN } from '../lib/format.js'
import {
  getDashboardStats, getFinanceStats, getFeeTrend, getCashflow, getActivityFeed, getWorkQueue,
} from '../api.js'

const linkStyle = {
  background: 'none', border: 'none', padding: 0, font: 'inherit',
  color: 'var(--blue)', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer',
}

// area line chart — fees in vs money out, from real monthly aggregates
function CashflowChart({ data }) {
  const W = 560, H = 170, PAD = 34
  const inK = (v) => (v || 0) / 1000
  const max = Math.max(10, ...data.map((d) => Math.max(inK(d.income), inK(d.expense)))) * 1.15
  const x = (i) => PAD + (i * (W - PAD * 2)) / Math.max(1, data.length - 1)
  const y = (v) => H - 24 - (v / max) * (H - 44)
  const path = (key) => data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(inK(d[key]))}`).join(' ')
  const area = (key) => `${path(key)} L${x(data.length - 1)},${H - 24} L${x(0)},${H - 24} Z`
  const ticks = [0, max * 0.25, max * 0.5, max * 0.75, max].map((v) => Math.round(v))

  return (
    <>
      <svg className="linechart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD} x2={W - PAD} y1={y(v)} y2={y(v)} stroke="#e4ebf2" strokeWidth="1" />
            <text x={PAD - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="#8798a5">{v}</text>
          </g>
        ))}
        <path d={area('income')} fill="rgba(47, 111, 167, 0.12)" />
        <path d={area('expense')} fill="rgba(192, 114, 7, 0.08)" />
        <path d={path('income')} fill="none" stroke="var(--amber)" strokeWidth="2.2" />
        <path d={path('expense')} fill="none" stroke="var(--orange)" strokeWidth="2.2" />
        {data.map((d, i) => (
          <g key={d.month}>
            <circle cx={x(i)} cy={y(inK(d.income))} r="3" fill="var(--amber)" />
            <circle cx={x(i)} cy={y(inK(d.expense))} r="3" fill="var(--orange)" />
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="#8798a5">{(d.month || '').slice(5)}</text>
          </g>
        ))}
      </svg>
      <div className="lc-legend">
        <span className="li"><span className="sw" style={{ background: 'var(--amber)' }} /> Fees in (N$k)</span>
        <span className="li"><span className="sw" style={{ background: 'var(--orange)' }} /> Expenses out (N$k)</span>
      </div>
    </>
  )
}

const QUEUE_DEFS = [
  { key: 'pending_applications', label: 'Applications awaiting review', mod: 'admissions', sev: 'orange' },
  { key: 'pending_proofs', label: 'Payment proofs to confirm', mod: 'finance', sev: 'red' },
  { key: 'pending_leave', label: 'Leave requests pending', mod: 'hr', sev: 'blue' },
  { key: 'active_holds', label: 'Active holds on student records', mod: 'students', sev: 'gray' },
]

export default function Dashboard({ go }) {
  const [stats, setStats] = useState(null)
  const [fin, setFin] = useState(null)
  const [trend, setTrend] = useState([])
  const [cashflow, setCashflow] = useState([])
  const [activity, setActivity] = useState([])
  const [queue, setQueue] = useState(null)
  const [toast, showToast] = useToast()

  useEffect(() => {
    getDashboardStats().then(setStats).catch(() => {})
    getFinanceStats().then(setFin).catch(() => {})
    getFeeTrend().then(setTrend).catch(() => {})
    getCashflow().then(setCashflow).catch(() => {})
    getActivityFeed().then(setActivity).catch(() => {})
    getWorkQueue().then(setQueue).catch(() => {})
  }, [])

  const enrolChart = (stats?.enrolment_by_programme || []).map((p) => ({ label: p.name, count: p.count }))
  const maxEnrol = Math.max(1, ...enrolChart.map((g) => g.count))
  const collected = Number(fin?.collected || 0)
  const invoiced = Number(fin?.invoiced || 0)
  const outstanding = Number(fin?.outstanding || 0)
  const pct = invoiced > 0 ? Math.round((collected / invoiced) * 100) : 0
  const queueItems = QUEUE_DEFS.map((d) => ({ ...d, n: Number(queue?.[d.key] || 0) }))
  const openCount = queueItems.reduce((s, q) => s + q.n, 0)

  return (
    <>
      <div className="banner">
        <Icon name="alert" size={18} />
        <div>
          <strong>{openCount} item(s) need attention</strong> — see the action queue below.
          Jump to <button style={linkStyle} onClick={() => go('finance')}>Finance</button> or{' '}
          <button style={linkStyle} onClick={() => go('admissions')}>Admissions</button>.
        </div>
      </div>

      <div className="stat-row c5">
        <StatCard icon="🎓" label="Enrolled Students" value={stats ? stats.enrolled_students : '—'} delta={stats ? `${stats.total_students} total` : ''} onClick={() => go('students')} />
        <StatCard icon="🧑‍🏫" label="Staff Members" value={stats ? stats.staff_count : '—'} onClick={() => go('hr')} />
        <StatCard icon="💰" label="Fees Collected" value={fin ? fmtN(collected) : '—'} delta={fin ? `${pct}% of invoiced` : ''} deltaTone="neutral" onClick={() => go('finance')} />
        <StatCard icon="🧾" label="Outstanding" value={fin ? fmtN(outstanding) : '—'} delta={fin ? `${fin.debtors} debtor(s)` : ''} deltaTone="down" onClick={() => go('finance')} />
        <StatCard icon="📚" label="Active Programmes" value={stats ? stats.programmes_count : '—'} onClick={() => go('programmes')} />
      </div>

      <div className="grid31">
        <Panel title="Cash flow — fees in vs money out" subtitle="Last 6 months">
          {cashflow.length === 0 ? <Empty>No cash-flow data yet.</Empty> : <CashflowChart data={cashflow} />}
        </Panel>

        <Panel title="Action queue" subtitle={`${openCount} open`}>
          {queueItems.every((q) => q.n === 0) ? (
            <Empty>Nothing pending — you’re all caught up.</Empty>
          ) : (
            queueItems.filter((q) => q.n > 0).map((t) => (
              <div key={t.key} className="wq-item" onClick={() => go(t.mod)} style={{ cursor: 'pointer' }}>
                <span className="wq-sev" style={{ background: `var(--${t.sev === 'gray' ? 'ink-faint' : t.sev})` }} />
                <div style={{ flex: 1 }}>
                  <div className="wq-task">{t.label}</div>
                  <div className="wq-meta">click to open</div>
                </div>
                <span className="mono" style={{ fontWeight: 700 }}>{t.n}</span>
              </div>
            ))
          )}
        </Panel>
      </div>

      <div className="grid31">
        <Panel title="Enrolment by programme">
          {enrolChart.length === 0 ? (
            <Empty>No enrolments yet.</Empty>
          ) : (
            <div className="chart" style={{ height: 150 }}>
              {enrolChart.map((g) => (
                <div key={g.label} className="bar-wrap">
                  <span className="bval">{g.count}</span>
                  <div className="bar" style={{ height: `${(g.count / maxEnrol) * 100}%` }} />
                  <span className="blabel">{g.label}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Fee collection" subtitle="This year">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <span className="mono" style={{ fontSize: 22, fontWeight: 600, color: 'var(--petrol-900)' }}>{fmtN(collected)}</span>
            <span style={{ color: 'var(--ink-faint)', fontSize: 13 }}>/ {fmtN(invoiced)}</span>
          </div>
          <Progress pct={pct} tone="amber" />
          <div style={{ marginTop: 14 }}>
            {[
              ['Collected', fmtN(collected), 'var(--green)'],
              ['Outstanding', fmtN(outstanding), 'var(--red)'],
              ['Debtors', fin?.debtors ?? 0, 'var(--orange)'],
            ].map(([l, v, c]) => (
              <div key={l} className="cf-row" style={{ padding: '5px 0' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: c, display: 'inline-block' }} />{l}
                </span>
                <span className="mono" style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
            <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => go('finance')}>Open collections queue →</button>
          </div>
        </Panel>
      </div>

      <Panel title="Recent activity" subtitle="Across all modules">
        {activity.length === 0 ? (
          <Empty>No recent activity.</Empty>
        ) : (
          activity.slice(0, 8).map((f, i) => (
            <div key={i} className="feed-item">
              <div className="ficon" style={{ background: 'var(--petrol-50)' }}><Icon name="dot" size={12} /></div>
              <div>
                <div className="ftext">{f.action}{f.entity ? ` — ${f.entity}` : ''}</div>
                <div className="ftime">{f.actor} · {f.at ? new Date(f.at).toLocaleString('en-GB') : ''}</div>
              </div>
            </div>
          ))
        )}
      </Panel>

      <Toast msg={toast} />
    </>
  )
}

function Empty({ children }) {
  return <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-faint)' }}>{children}</div>
}
