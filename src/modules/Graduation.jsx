import React, { useState } from 'react'
import { StatCard, Panel, Badge, Toast, useToast } from '../ui.jsx'
import { GRADUANDS, INVOICES, LOANS, FINES } from '../data.js'

// Graduation & clearance — clearance is DERIVED from live data (finance = no
// outstanding invoice balance, library = no overdue loans/fines, academic =
// GPA ≥ 2.0), so it stays consistent with Finance, Library and the transcript.
export default function Graduation() {
  const [toast, showToast] = useToast()
  const [issued, setIssued] = useState({})

  const clearance = (g) => ({
    finance: INVOICES.filter((i) => i.learner === g.student).every((i) => i.balance === 0),
    library: !LOANS.some((l) => l.borrower === g.student && l.status === 'Overdue') && !FINES.some((f) => f.borrower === g.student),
    academic: g.gpa >= 2,
  })
  const cleared = (g) => { const c = clearance(g); return c.finance && c.library && c.academic }
  const ready = GRADUANDS.filter(cleared).length

  const Chk = ({ ok, label }) => <Badge tone={ok ? 'green' : 'red'}>{ok ? '✓' : '✗'} {label}</Badge>

  return (
    <>
      <div className="stat-row c4">
        <StatCard icon="🎓" label="Graduands" value={String(GRADUANDS.length)} delta="Class of 2026" deltaTone="neutral" />
        <StatCard icon="✅" label="Cleared" value={String(ready)} delta="all checks passed" deltaTone="up" />
        <StatCard icon="⛔" label="Blocked" value={String(GRADUANDS.length - ready)} delta="outstanding clearance" deltaTone="down" />
        <StatCard icon="📜" label="Certificates issued" value={String(Object.keys(issued).length)} delta="this session" deltaTone="neutral" />
      </div>
      <Panel title="Clearance & certificate issue" subtitle="Finance, library and academic clearance required before graduation" flush>
        <table className="data">
          <thead>
            <tr><th>Student</th><th>Programme</th><th className="num">GPA</th><th>Clearance</th><th style={{ width: 160 }}>Action</th></tr>
          </thead>
          <tbody>
            {GRADUANDS.map((g) => {
              const c = clearance(g)
              return (
              <tr key={g.student}>
                <td style={{ fontWeight: 600 }}>{g.student}</td>
                <td>{g.prog}</td>
                <td className="num mono">{g.gpa.toFixed(1)}</td>
                <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Chk ok={c.finance} label="Finance" /><Chk ok={c.library} label="Library" /><Chk ok={c.academic} label="Academic" />
                </td>
                <td>
                  {issued[g.student] ? (
                    <Badge tone="green">📜 Issued</Badge>
                  ) : cleared(g) ? (
                    <button className="btn primary sm" onClick={() => { setIssued((s) => ({ ...s, [g.student]: true })); showToast(`Certificate issued — ${g.student}`) }}>Issue certificate</button>
                  ) : (
                    <button className="btn ghost sm" onClick={() => showToast(`${g.student} notified of outstanding clearance`)}>Notify</button>
                  )}
                </td>
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
