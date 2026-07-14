import React, { useState } from 'react'
import { StatCard, Panel, Progress, Badge, Toast, useToast } from '../ui.jsx'
import { ENROLMENT_BY_GRADE, FEE_COLLECTION, ACTIVITY_FEED, CASHFLOW, WORK_QUEUE, SCHOOL, fmtN } from '../data.js'

const linkStyle = {
  background: 'none', border: 'none', padding: 0, font: 'inherit',
  color: 'var(--blue)', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer',
}

// area line chart in the style of the reference dashboard (Expense vs Profit)
function CashflowChart() {
  const W = 560, H = 170, PAD = 30
  const max = 560 // N$k axis ceiling
  const x = (i) => PAD + (i * (W - PAD * 2)) / (CASHFLOW.length - 1)
  const y = (v) => H - 24 - (v / max) * (H - 44)
  const path = (key) => CASHFLOW.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d[key])}`).join(' ')
  const area = (key) =>
    `${path(key)} L${x(CASHFLOW.length - 1)},${H - 24} L${x(0)},${H - 24} Z`

  return (
    <>
      <svg className="linechart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {[0, 140, 280, 420, 560].map((v) => (
          <g key={v}>
            <line x1={PAD} x2={W - PAD} y1={y(v)} y2={y(v)} stroke="#e4ebf2" strokeWidth="1" />
            <text x={PAD - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="#8798a5">{v}</text>
          </g>
        ))}
        <path d={area('in_')} fill="rgba(47, 111, 167, 0.12)" />
        <path d={area('out')} fill="rgba(192, 114, 7, 0.08)" />
        <path d={path('in_')} fill="none" stroke="var(--amber)" strokeWidth="2.2" />
        <path d={path('out')} fill="none" stroke="var(--orange)" strokeWidth="2.2" strokeDasharray="1 0" />
        {CASHFLOW.map((d, i) => (
          <g key={d.m}>
            <circle cx={x(i)} cy={y(d.in_)} r="3" fill="var(--amber)" />
            <circle cx={x(i)} cy={y(d.out)} r="3" fill="var(--orange)" />
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#8798a5">
              {d.m}{i >= 4 ? '*' : ''}
            </text>
          </g>
        ))}
      </svg>
      <div className="lc-legend">
        <span className="li"><span className="sw" style={{ background: 'var(--amber)' }} /> Fees in (N$k)</span>
        <span className="li"><span className="sw" style={{ background: 'var(--orange)' }} /> Salaries + expenses out (N$k)</span>
        <span className="li">* projected</span>
      </div>
    </>
  )
}

function printTermReport() {
  const w = window.open('', '_blank', 'width=760,height=900')
  const rows = ENROLMENT_BY_GRADE.map((g) => `<tr><td>${g.grade}</td><td>${g.count}</td></tr>`).join('')
  w.document.write(`<html><head><title>Term Report — ${SCHOOL.name}</title>
    <style>body{font-family:Arial,sans-serif;padding:36px;color:#24333e}h1{font-size:20px}h2{font-size:14px;margin-top:22px;border-bottom:1px solid #ccc;padding-bottom:4px}
    table{border-collapse:collapse;margin-top:8px}td,th{border:1px solid #ccc;padding:5px 12px;font-size:12px;text-align:left}p{font-size:12.5px}</style></head><body>
    <h1>${SCHOOL.name} — Semester 2, 2026 · Management Report</h1>
    <p>Prepared for the Board · ${new Date().toDateString()} · Symanek Suite</p>
    <h2>Enrolment (${SCHOOL.learners} learners · ${SCHOOL.staff} staff)</h2><table>${rows}</table>
    <h2>Fee collection</h2>
    <p>Collected: N$ 1,420,000 of N$ 1,630,000 target (87%) · Outstanding: N$ 210,000 · 94 students in arrears</p>
    <h2>Cash position (projection to Dec)</h2>
    <p>Peak inflow Sep (fees). Nov–Dec projected net negative (13th cheque) — reserve required: ±N$ 507,000.</p>
    <h2>Operations</h2>
    <p>Canteen margin 41% · 213 books on loan (9 overdue) · 3 leave requests pending · 1 fixed-term contract expiring (Aug)</p>
    </body></html>`)
  w.document.close()
  w.print()
}

export default function Dashboard({ go }) {
  const fc = FEE_COLLECTION
  const pct = Math.round((fc.collected / fc.target) * 100)
  const maxEnrol = Math.max(...ENROLMENT_BY_GRADE.map((g) => g.count))
  const [queue, setQueue] = useState(WORK_QUEUE.map((t) => ({ ...t, done: false })))
  const [toast, showToast] = useToast()
  const openCount = queue.filter((t) => !t.done).length

  const toggle = (id) => {
    setQueue((qs) => qs.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
    const t = queue.find((t) => t.id === id)
    if (!t.done) showToast(`Done — ${t.owner}: ${t.task.slice(0, 40)}…`)
  }

  return (
    <>
      <div className="banner">
        <span style={{ fontSize: 18 }}>⚠️</span>
        <div>
          <strong>{openCount} items need attention</strong> — assigned in the action queue below.
          Jump to <button style={linkStyle} onClick={() => go('finance')}>Finance</button> or{' '}
          <button style={linkStyle} onClick={() => go('canteen')}>Canteen</button>.
        </div>
        <div className="spacer" style={{ marginLeft: 'auto' }} />
        <button className="btn ghost sm" onClick={printTermReport}>🖨 Print term report</button>
      </div>

      <div className="stat-row c5">
        <StatCard icon="🎓" label="Enrolled Students" value={SCHOOL.learners} delta="+18 this term" onClick={() => go('students')} />
        <StatCard icon="🧑‍🏫" label="Staff Members" value={SCHOOL.staff} delta="+3 vs last term" onClick={() => go('hr')} />
        <StatCard icon="💰" label="Fees Collected" value="N$ 1.42M" delta={`${pct}% of term target`} deltaTone="neutral" onClick={() => go('finance')} />
        <StatCard icon="🍽️" label="Canteen Sales Today" value={fmtN(4180)} delta="+12% vs avg day" onClick={() => go('canteen')} />
        <StatCard icon="📚" label="Books on Loan" value="213" delta="9 overdue" deltaTone="down" onClick={() => go('library')} />
      </div>

      <div className="grid31">
        <Panel title="Cash flow — fees in vs money out" subtitle="Jul–Dec 2026 · the Nov–Dec gap needs reserves">
          <CashflowChart />
        </Panel>

        <Panel title="Action queue" subtitle={`${openCount} open · each item has an owner`}>
          {queue.map((t) => (
            <div key={t.id} className={`wq-item ${t.done ? 'done' : ''}`}>
              <span className="wq-sev" style={{ background: `var(--${t.sev === 'gray' ? 'ink-faint' : t.sev})` }} />
              <div style={{ flex: 1 }}>
                <div className="wq-task">{t.task}</div>
                <div className="wq-meta">{t.owner} · due {t.due}</div>
              </div>
              <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} style={{ cursor: 'pointer' }} />
            </div>
          ))}
        </Panel>
      </div>

      <div className="grid31">
        <Panel title="Enrolment by programme" subtitle={SCHOOL.term}>
          <div className="chart" style={{ height: 150 }}>
            {ENROLMENT_BY_GRADE.map((g) => (
              <div key={g.grade} className="bar-wrap">
                <span className="bval">{g.count}</span>
                <div
                  className={`bar ${g.grade === 'Vocational' || g.grade === 'Adult Ed' ? 'amber' : ''}`}
                  style={{ height: `${(g.count / maxEnrol) * 100}%` }}
                />
                <span className="blabel">{g.grade}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Fee collection" subtitle="Term 3 target">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <span className="mono" style={{ fontSize: 22, fontWeight: 600, color: 'var(--petrol-900)' }}>
              {fmtN(fc.collected)}
            </span>
            <span style={{ color: 'var(--ink-faint)', fontSize: 13 }}>/ {fmtN(fc.target)}</span>
          </div>
          <Progress pct={pct} tone="amber" />
          <div style={{ marginTop: 14 }}>
            {[
              ['Collected', fmtN(fc.collected), 'var(--green)'],
              ['Outstanding', fmtN(fc.outstanding), 'var(--red)'],
              ['Students in arrears', fc.inArrears, 'var(--orange)'],
            ].map(([l, v, c]) => (
              <div key={l} className="cf-row" style={{ padding: '5px 0' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: c, display: 'inline-block' }} />
                  {l}
                </span>
                <span className="mono" style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
            <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => go('finance')}>
              Open collections queue →
            </button>
          </div>
        </Panel>
      </div>

      <Panel title="Recent activity" subtitle="Across all modules">
        {ACTIVITY_FEED.slice(0, 4).map((f, i) => (
          <div key={i} className="feed-item" style={{ cursor: 'pointer' }} onClick={() => go(f.mod)}>
            <div className="ficon" style={{ background: f.bg }}>{f.icon}</div>
            <div>
              <div className="ftext">{f.text}</div>
              <div className="ftime">{f.time} · click to open</div>
            </div>
          </div>
        ))}
      </Panel>

      <Toast msg={toast} />
    </>
  )
}
