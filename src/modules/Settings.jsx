import React, { useState } from 'react'
import { Panel, Badge, Avatar, Toast, useToast } from '../ui.jsx'
import { SCHOOL, ROLES, AUDIT_LOG, BP_DEFS, staffEmail } from '../data.js'
import { CONTROL_WINDOWS, INTAKES } from '../lib/controls.js'

const TERMS = [
  { term: 'Term 1', dates: '14 Jan – 25 Apr 2026', status: 'Closed' },
  { term: 'Term 2', dates: '12 May – 22 Aug 2026', status: 'Closed' },
  { term: 'Term 3', dates: '02 Sep – 05 Dec 2026', status: 'Active' },
  { term: 'Semester 1 (tertiary)', dates: '02 Feb – 19 Jun 2026', status: 'Closed' },
  { term: 'Semester 2 (tertiary)', dates: '20 Jul – 27 Nov 2026', status: 'Active' },
]

const MODULE_LIST = ['Admissions', 'Programmes', 'Scheduling', 'Finance', 'Accounting', 'HR & Payroll', 'Lecturer Portal', 'Canteen', 'Library']

// which modules each role touches — visualizes the access-control story
const MATRIX = {
  'School Admin': [1, 1, 1, 1, 1, 1, 0, 1, 1],
  'Finance / Bursar': [0, 0, 0, 1, 1, 2, 0, 2, 0],
  'HR Officer': [0, 0, 0, 0, 0, 1, 0, 0, 0],
  Lecturer: [0, 2, 2, 0, 0, 0, 1, 0, 2],
  'Canteen Seller': [0, 0, 0, 0, 0, 0, 0, 3, 0],
  Librarian: [0, 0, 0, 0, 0, 0, 0, 0, 1],
}
const ACCESS = { 0: null, 1: ['Full', 'green'], 2: ['Read', 'blue'], 3: ['POS only', 'amber'] }

export default function Settings() {
  const [toast, showToast] = useToast()
  const [enabled, setEnabled] = useState(Object.fromEntries(MODULE_LIST.map((m) => [m, true])))
  const [matrix, setMatrix] = useState(MATRIX)
  const [users, setUsers] = useState(ROLES.map((r) => ({ role: r.name, user: r.user, active: true })))
  const [windows, setWindows] = useState(CONTROL_WINDOWS)
  const [intake, setIntake] = useState('july')

  const toggleWindow = (key) => {
    setWindows((ws) => ws.map((w) => (w.key === key ? { ...w, open: !w.open } : w)))
    const w = windows.find((x) => x.key === key)
    showToast(`${w.label} ${w.open ? 'closed' : 'opened'} — audit log updated`)
  }
  const setWindowDate = (key, field, value) => {
    setWindows((ws) => ws.map((w) => (w.key === key ? { ...w, [field]: value } : w)))
  }

  // click cycles — → Full → Read → — (POS-only is locked by design)
  const cycle = (roleName, i) => {
    setMatrix((m) => {
      const v = m[roleName][i]
      if (v === 3) return m
      const next = v === 0 ? 1 : v === 1 ? 2 : 0
      showToast(`${roleName} · ${MODULE_LIST[i]} → ${next === 0 ? 'no access' : next === 1 ? 'Full' : 'Read-only'}`)
      return { ...m, [roleName]: m[roleName].map((x, j) => (j === i ? next : x)) }
    })
  }

  return (
    <>
      <div className="grid2">
        <Panel title="Institution profile" subtitle="Shown on invoices, payslips & reports">
          <form onSubmit={(e) => { e.preventDefault(); showToast('Institution profile saved') }}>
            <div className="field"><label>School name</label><input defaultValue={SCHOOL.name} /></div>
            <div className="grid2" style={{ gap: 12 }}>
              <div className="field"><label>Region</label><input defaultValue="Khomas, Namibia" /></div>
              <div className="field"><label>Phone</label><input defaultValue="+264 61 234 567" /></div>
            </div>
            <div className="field"><label>Email</label><input defaultValue="admin@symanek.edu.na" /></div>
            <div className="grid2" style={{ gap: 12 }}>
              <div className="field"><label>Currency</label><select><option>N$ — Namibian Dollar</option></select></div>
              <div className="field"><label>Tax authority</label><select><option>NamRA</option></select></div>
            </div>
            <button className="btn primary" type="submit">Save profile</button>
          </form>
        </Panel>

        <div>
          <Panel title="Academic calendar — 2026" subtitle="School terms + tertiary semesters" flush>
            <table className="data">
              <thead><tr><th>Term</th><th>Dates</th><th>Status</th></tr></thead>
              <tbody>
                {TERMS.map((t) => (
                  <tr key={t.term}>
                    <td style={{ fontWeight: 600 }}>{t.term}</td>
                    <td>{t.dates}</td>
                    <td><Badge tone={t.status === 'Active' ? 'green' : 'gray'}>{t.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title="Modules" subtitle="Module-based billing arrives in Phase 2">
            {MODULE_LIST.map((m) => (
              <label key={m} className="cf-row" style={{ padding: '7px 0', cursor: 'pointer' }}>
                <span>{m}</span>
                <input
                  type="checkbox"
                  checked={enabled[m]}
                  onChange={() => {
                    setEnabled((en) => ({ ...en, [m]: !en[m] }))
                    showToast(`${m} ${enabled[m] ? 'disabled' : 'enabled'} (demo)`)
                  }}
                />
              </label>
            ))}
          </Panel>
        </div>
      </div>

      <Panel
        title="Academic control windows"
        subtitle="Open or close functions per intake — marks insertion, marks release, applications, registration, second-opportunity, clearance"
        actions={
          <select className="inline" value={intake} onChange={(e) => { setIntake(e.target.value); showToast(`Active intake set to ${INTAKES.find((i) => i.key === e.target.value)?.label}`) }}>
            {INTAKES.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
          </select>
        }
        flush
      >
        <table className="data">
          <thead>
            <tr><th>Function</th><th>Opens</th><th>Closes</th><th>Status</th><th style={{ width: 130 }}>Action</th></tr>
          </thead>
          <tbody>
            {windows.map((w) => (
              <tr key={w.key}>
                <td style={{ fontWeight: 600 }}>{w.label}</td>
                <td><input type="date" className="inline" style={{ width: 150 }} value={w.from} onChange={(e) => setWindowDate(w.key, 'from', e.target.value)} /></td>
                <td><input type="date" className="inline" style={{ width: 150 }} value={w.to} onChange={(e) => setWindowDate(w.key, 'to', e.target.value)} /></td>
                <td><Badge tone={w.open ? 'green' : 'gray'}>{w.open ? 'Open' : 'Closed'}</Badge></td>
                <td>
                  <button className={`btn sm ${w.open ? 'red-ghost' : 'green'}`} onClick={() => toggleWindow(w.key)}>
                    {w.open ? 'Close' : 'Open'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Role permissions" subtitle="Who sees what — enforced at login · click a cell to cycle Full / Read / no access" flush>
        <table className="data">
          <thead>
            <tr>
              <th>Role</th>
              {MODULE_LIST.map((m) => <th key={m}>{m}</th>)}
            </tr>
          </thead>
          <tbody>
            {ROLES.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.name}</td>
                {(matrix[r.name] || []).map((v, i) => (
                  <td key={i} style={{ cursor: v === 3 ? 'default' : 'pointer' }} onClick={() => cycle(r.name, i)}>
                    {ACCESS[v] ? <Badge tone={ACCESS[v][1]}>{ACCESS[v][0]}</Badge> : <span style={{ color: 'var(--ink-faint)' }}>—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="User accounts" subtitle="One demo account per role · password resets are emailed" flush>
        <table className="data">
          <thead>
            <tr><th>User</th><th>Role</th><th>Email</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.user}>
                <td>
                  <div className="emp-cell"><Avatar name={u.user} /><span className="en">{u.user}</span></div>
                </td>
                <td>{u.role}</td>
                <td className="mono" style={{ fontSize: 12 }}>{staffEmail(u.user)}</td>
                <td><Badge tone={u.active ? 'green' : 'red'}>{u.active ? 'Active' : 'Deactivated'}</Badge></td>
                <td>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <button className="btn ghost sm" onClick={() => showToast(`Password reset link emailed to ${staffEmail(u.user)}`)}>Reset password</button>
                    <button
                      className={`btn sm ${u.active ? 'red-ghost' : 'green'}`}
                      onClick={() => {
                        setUsers((us) => us.map((x, j) => (j === i ? { ...x, active: !x.active } : x)))
                        showToast(`${u.user} ${u.active ? 'deactivated — sessions revoked' : 'reactivated'}`)
                      }}
                    >
                      {u.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel
        title="Business processes — workflow engine"
        subtitle="Configurable steps, approvals & notifications per process — rules change without code"
        flush
      >
        <table className="data">
          <thead>
            <tr><th>Business process</th><th>Trigger</th><th>Steps</th><th>Approvals</th><th>Notifies</th><th>Status</th></tr>
          </thead>
          <tbody>
            {BP_DEFS.map((b) => (
              <tr key={b.bp} style={{ cursor: 'pointer' }} onClick={() => showToast(`${b.bp} — definition opened in the process designer (demo)`)}>
                <td style={{ fontWeight: 600 }}>{b.bp}</td>
                <td style={{ fontSize: 12.5 }}>{b.trigger}</td>
                <td className="mono" style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>{b.steps}</td>
                <td>{b.approvals}</td>
                <td style={{ fontSize: 12.5 }}>{b.notify}</td>
                <td><Badge tone="green">Active</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel
        title="Audit log"
        subtitle="Every sensitive change is written here — marks, money, payroll, till variances"
        actions={<button className="btn ghost sm" onClick={() => showToast('Audit log exported to CSV')}>⬇ Export</button>}
        flush
      >
        <table className="data">
          <thead>
            <tr><th>When</th><th>User</th><th>Role</th><th>Action</th><th>Module</th></tr>
          </thead>
          <tbody>
            {AUDIT_LOG.map((a, i) => (
              <tr key={i}>
                <td className="mono" style={{ fontSize: 12 }}>{a.when}</td>
                <td style={{ fontWeight: 600 }}>{a.who}</td>
                <td style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{a.role}</td>
                <td>{a.action}</td>
                <td><Badge tone="blue">{a.mod}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Toast msg={toast} />
    </>
  )
}
