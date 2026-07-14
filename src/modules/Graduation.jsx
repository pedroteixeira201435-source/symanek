import React, { useState, useEffect } from 'react'
import { StatCard, Panel, Badge, Toast, useToast } from '../ui.jsx'
import * as api from '../api.js'

// Graduation & clearance — clearance is DERIVED from live data (finance = no
// outstanding invoice balance, library = no active library hold, academic =
// GPA ≥ 2.0). In http mode this comes from the server (graduation_board), so it
// stays consistent with Finance, the exam board and the transcript; issuing a
// certificate is gated server-side (issue_certificate) on that same clearance.
export default function Graduation() {
  const [toast, showToast] = useToast()
  const [rows, setRows] = useState([])
  const [issued, setIssued] = useState({})
  const [busy, setBusy] = useState(null)

  const load = () => api.listGraduands().then(setRows).catch(() => {})
  useEffect(() => { load() }, [])

  const isCleared = (g) => (g.cleared != null ? g.cleared : (g.finance && g.library && g.academic))
  const isIssued = (g) => issued[g.student] || g.hasCertificate
  const ready = rows.filter(isCleared).length

  const issue = async (g) => {
    setBusy(g.student)
    try {
      const res = await api.issueCertificate({ studentId: g.studentId })
      if (res && res.ok === false) { showToast(res.message || 'Student is not cleared to graduate'); return }
      setIssued((s) => ({ ...s, [g.student]: true }))
      showToast((res && res.message) || `Certificate issued — ${g.student}`)
      await load()
    } catch (e) {
      showToast(e?.message || 'Issue failed')
    } finally {
      setBusy(null)
    }
  }

  const Chk = ({ ok, label }) => <Badge tone={ok ? 'green' : 'red'}>{ok ? '✓' : '✗'} {label}</Badge>

  return (
    <>
      <div className="stat-row c4">
        <StatCard icon="🎓" label="Graduands" value={String(rows.length)} delta="Class of 2026" deltaTone="neutral" />
        <StatCard icon="✅" label="Cleared" value={String(ready)} delta="all checks passed" deltaTone="up" />
        <StatCard icon="⛔" label="Blocked" value={String(rows.length - ready)} delta="outstanding clearance" deltaTone="down" />
        <StatCard icon="📜" label="Certificates issued" value={String(rows.filter(isIssued).length)} delta="to date" deltaTone="neutral" />
      </div>
      <Panel title="Clearance & certificate issue" subtitle="Finance, library and academic clearance required before graduation — derived from live data" flush>
        <table className="data">
          <thead>
            <tr><th>Student</th><th>Programme</th><th className="num">GPA</th><th>Clearance</th><th style={{ width: 160 }}>Action</th></tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.student}>
                <td style={{ fontWeight: 600 }}>{g.student}</td>
                <td>{g.prog}</td>
                <td className="num mono">{Number(g.gpa).toFixed(1)}</td>
                <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Chk ok={g.finance} label="Finance" /><Chk ok={g.library} label="Library" /><Chk ok={g.academic} label="Academic" />
                </td>
                <td>
                  {isIssued(g) ? (
                    <Badge tone="green">📜 Issued</Badge>
                  ) : isCleared(g) ? (
                    <button className="btn primary sm" disabled={busy === g.student} onClick={() => issue(g)}>{busy === g.student ? '…' : 'Issue certificate'}</button>
                  ) : (
                    <button className="btn ghost sm" onClick={() => showToast(`${g.student} notified of outstanding clearance`)}>Notify</button>
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
