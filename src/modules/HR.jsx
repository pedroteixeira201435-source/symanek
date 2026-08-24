import React, { useCallback, useEffect, useState } from 'react'
import { StatCard, Tabs, Panel, Badge, Modal, Toast, useToast } from '../ui.jsx'
import { fmtN, staffEmail } from '../lib/format.js'
import {
  listStaff, listLeaveRequests, listPayroll, listLeaveBalances, listRecruitment, listWorkload,
  getStaffDetail, staffUpsert, staffDelete, contractSet, qualificationAdd, leaveBalanceSet,
  recruitUpsert, workloadSet, payrollRun, getBusinessSettings,
} from '../api.js'

export default function HR() {
  const [tab, setTab] = useState('Staff')
  return (
    <>
      <Tabs tabs={['Staff', 'Leave', 'Payroll', 'Contracts', 'Qualifications', 'Recruitment', 'Workload']} active={tab} onChange={setTab} />
      {tab === 'Staff' && <Staff />}
      {tab === 'Leave' && <Leave />}
      {tab === 'Payroll' && <Payroll />}
      {tab === 'Contracts' && <Contracts />}
      {tab === 'Qualifications' && <Qualifications />}
      {tab === 'Recruitment' && <Recruitment />}
      {tab === 'Workload' && <Workload />}
    </>
  )
}

function Staff() {
  const [toast, showToast] = useToast()
  const [rows, setRows] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(true)
  const reload = useCallback(() => listStaff().then(setRows).catch(() => setRows([])), [])
  useEffect(() => { reload().finally(() => setLoading(false)) }, [reload])
  const save = async (e) => {
    e.preventDefault(); const f = e.target
    try { await staffUpsert({ name: f.name.value, email: f.email.value || staffEmail(f.name.value), role: f.role.value, department: f.department.value }); setShowNew(false); await reload(); showToast('Staff saved') }
    catch (err) { showToast('Could not save: ' + (err?.message || err)) }
  }
  const remove = async (s) => {
    try { await staffDelete(s.id); await reload(); showToast('Staff removed') }
    catch (err) { showToast('Could not remove: ' + (err?.message || err)) }
  }
  if (loading) return <Panel title="Staff" flush><Empty>Loading...</Empty></Panel>
  return (
    <>
      <div className="stat-row c4">
        <StatCard icon="👥" label="Staff" value={String(rows.length)} delta="backend records" />
        <StatCard icon="🎓" label="Teaching" value={String(rows.filter((s) => /lecturer|teacher|hod/i.test(s.role || '')).length)} delta="academic roles" />
        <StatCard icon="🏢" label="Departments" value={String(new Set(rows.map((s) => s.dept || s.department).filter(Boolean)).size)} delta="loaded" />
        <StatCard icon="📧" label="Emails" value={String(rows.filter((s) => s.email).length)} delta="with contact" />
      </div>
      <Panel title="Staff register" actions={<button className="btn primary sm" onClick={() => setShowNew(true)}>+ Add staff</button>} flush>
        {rows.length === 0 ? <Empty>No staff records yet.</Empty> : <table className="data"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th></th></tr></thead><tbody>{rows.map((s) => <tr key={s.id || s.email}><td>{s.name}</td><td>{s.email || '-'}</td><td>{s.role || '-'}</td><td>{s.dept || s.department || '-'}</td><td>{s.id && <button className="btn ghost sm" onClick={() => remove(s)}>Delete</button>}</td></tr>)}</tbody></table>}
      </Panel>
      {showNew && <Modal title="Add staff" onClose={() => setShowNew(false)}><form onSubmit={save}><div className="field"><label>Name</label><input name="name" required /></div><div className="field"><label>Email</label><input name="email" type="email" /></div><div className="field"><label>Role</label><input name="role" /></div><div className="field"><label>Department</label><input name="department" /></div><button className="btn primary">Save</button></form></Modal>}
      <Toast msg={toast} />
    </>
  )
}

function Leave() {
  const [requests, setRequests] = useState([])
  const [balances, setBalances] = useState([])
  useEffect(() => { listLeaveRequests().then(setRequests).catch(() => setRequests([])); listLeaveBalances().then(setBalances).catch(() => setBalances([])) }, [])
  return <><Panel title="Leave requests" flush>{requests.length === 0 ? <Empty>No leave requests yet.</Empty> : <SimpleTable rows={requests} />}</Panel><Panel title="Leave balances" flush>{balances.length === 0 ? <Empty>No leave balances yet.</Empty> : <SimpleTable rows={balances} />}</Panel></>
}

function Payroll() {
  const [toast, showToast] = useToast()
  const [rows, setRows] = useState([])
  const [staff, setStaff] = useState([])
  const [settings, setSettings] = useState(null)
  const [showRun, setShowRun] = useState(false)
  const reload = useCallback(() => Promise.all([
    listPayroll().then(setRows).catch(() => setRows([])),
    listStaff().then(setStaff).catch(() => setStaff([])),
    getBusinessSettings().then(setSettings).catch(() => setSettings(null)),
  ]), [])
  useEffect(() => { reload() }, [reload])
  const run = async (e) => {
    e.preventDefault(); const f = e.target
    try { await payrollRun({ staffId: f.staff.value, month: f.month.value, gross: Number(f.gross.value) }); setShowRun(false); await reload(); showToast('Payroll run recorded') }
    catch (err) { showToast('Could not run payroll: ' + (err?.message || err)) }
  }
  return (
    <>
      <Panel title="Payroll" subtitle="PAYE/SSC/VET rates come from business_settings/RPC, not frontend mock formulas" actions={<button className="btn primary sm" onClick={() => setShowRun(true)}>+ Run payroll</button>} flush>
        {rows.length === 0 ? <Empty>No payroll rows yet.</Empty> : <SimpleTable rows={rows} />}
      </Panel>
      <Panel title="Payroll settings" flush>{settings ? <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify({ paye_brackets: settings.paye_brackets, ssc: settings.ssc, vet_levy: settings.vet_levy }, null, 2)}</pre> : <Empty>No payroll business settings loaded.</Empty>}</Panel>
      {showRun && <Modal title="Run payroll" onClose={() => setShowRun(false)}><form onSubmit={run}><div className="field"><label>Staff</label><select name="staff">{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div><div className="field"><label>Month</label><input name="month" type="month" required /></div><div className="field"><label>Gross</label><input name="gross" type="number" required /></div><button className="btn primary">Run</button></form></Modal>}
      <Toast msg={toast} />
    </>
  )
}

function Contracts() {
  const [toast, showToast] = useToast()
  const [staff, setStaff] = useState([])
  const [detail, setDetail] = useState(null)
  const [selected, setSelected] = useState('')
  useEffect(() => { listStaff().then(setStaff).catch(() => setStaff([])) }, [])
  useEffect(() => { if (selected) getStaffDetail(selected).then(setDetail).catch(() => setDetail(null)); else setDetail(null) }, [selected])
  const save = async (e) => {
    e.preventDefault(); const f = e.target
    try { await contractSet({ staffId: selected, type: f.type.value, start: f.start.value || null, end: f.end.value || null, fte: Number(f.fte.value) || 1 }); showToast('Contract saved') }
    catch (err) { showToast('Could not save: ' + (err?.message || err)) }
  }
  return <><Panel title="Contracts"><StaffSelect staff={staff} selected={selected} setSelected={setSelected} />{!selected ? <Empty>Select staff.</Empty> : <form onSubmit={save}><div className="field"><label>Type</label><input name="type" required /></div><div className="grid2" style={{ gap: 12 }}><div className="field"><label>Start</label><input name="start" type="date" /></div><div className="field"><label>End</label><input name="end" type="date" /></div></div><div className="field"><label>FTE</label><input name="fte" type="number" step="0.1" defaultValue="1" /></div><button className="btn primary">Save contract</button></form>}</Panel><Panel title="Current detail" flush>{detail?.contracts?.length ? <SimpleTable rows={detail.contracts} /> : <Empty>No contract detail yet.</Empty>}</Panel><Toast msg={toast} /></>
}

function Qualifications() {
  const [toast, showToast] = useToast()
  const [staff, setStaff] = useState([])
  const [selected, setSelected] = useState('')
  useEffect(() => { listStaff().then(setStaff).catch(() => setStaff([])) }, [])
  const save = async (e) => {
    e.preventDefault(); const f = e.target
    try { await qualificationAdd({ staffId: selected, title: f.title.value, institution: f.institution.value, year: Number(f.year.value) || null }); showToast('Qualification added') }
    catch (err) { showToast('Could not add: ' + (err?.message || err)) }
  }
  return <><Panel title="Qualifications"><StaffSelect staff={staff} selected={selected} setSelected={setSelected} />{!selected ? <Empty>Select staff.</Empty> : <form onSubmit={save}><div className="field"><label>Qualification</label><input name="title" required /></div><div className="field"><label>Institution</label><input name="institution" /></div><div className="field"><label>Year</label><input name="year" type="number" /></div><button className="btn primary">Add qualification</button></form>}</Panel><Toast msg={toast} /></>
}

function Recruitment() {
  const [toast, showToast] = useToast()
  const [rows, setRows] = useState([])
  const [showNew, setShowNew] = useState(false)
  const reload = useCallback(() => listRecruitment().then(setRows).catch(() => setRows([])), [])
  useEffect(() => { reload() }, [reload])
  const save = async (e) => {
    e.preventDefault(); const f = e.target
    try { await recruitUpsert({ position: f.position.value, candidate: f.candidate.value, stage: f.stage.value, notes: f.notes.value }); setShowNew(false); await reload(); showToast('Recruitment row saved') }
    catch (err) { showToast('Could not save: ' + (err?.message || err)) }
  }
  return <><Panel title="Recruitment" actions={<button className="btn primary sm" onClick={() => setShowNew(true)}>+ Add candidate</button>} flush>{rows.length === 0 ? <Empty>No recruitment rows yet.</Empty> : <SimpleTable rows={rows} />}</Panel>{showNew && <Modal title="Add candidate" onClose={() => setShowNew(false)}><form onSubmit={save}><div className="field"><label>Position</label><input name="position" required /></div><div className="field"><label>Candidate</label><input name="candidate" /></div><div className="field"><label>Stage</label><input name="stage" defaultValue="applied" /></div><div className="field"><label>Notes</label><textarea name="notes" rows={3} /></div><button className="btn primary">Save</button></form></Modal>}<Toast msg={toast} /></>
}

function Workload() {
  const [toast, showToast] = useToast()
  const [rows, setRows] = useState([])
  const [staff, setStaff] = useState([])
  const [showNew, setShowNew] = useState(false)
  const reload = useCallback(() => Promise.all([listWorkload().then(setRows).catch(() => setRows([])), listStaff().then(setStaff).catch(() => setStaff([]))]), [])
  useEffect(() => { reload() }, [reload])
  const save = async (e) => {
    e.preventDefault(); const f = e.target
    try { await workloadSet({ staffId: f.staff.value, courses: Number(f.courses.value) || 0, periods: Number(f.periods.value) || 0, students: Number(f.students.value) || 0 }); setShowNew(false); await reload(); showToast('Workload saved') }
    catch (err) { showToast('Could not save: ' + (err?.message || err)) }
  }
  return <><Panel title="Workload" actions={<button className="btn primary sm" onClick={() => setShowNew(true)}>+ Set workload</button>} flush>{rows.length === 0 ? <Empty>No workload rows yet.</Empty> : <SimpleTable rows={rows} />}</Panel>{showNew && <Modal title="Set workload" onClose={() => setShowNew(false)}><form onSubmit={save}><div className="field"><label>Staff</label><select name="staff">{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div><div className="field"><label>Courses</label><input name="courses" type="number" defaultValue="0" /></div><div className="field"><label>Periods</label><input name="periods" type="number" defaultValue="0" /></div><div className="field"><label>Students</label><input name="students" type="number" defaultValue="0" /></div><button className="btn primary">Save</button></form></Modal>}<Toast msg={toast} /></>
}

function StaffSelect({ staff, selected, setSelected }) {
  return <div className="field" style={{ maxWidth: 360 }}><label>Staff</label><select value={selected} onChange={(e) => setSelected(e.target.value)}><option value="">Select staff</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
}

function SimpleTable({ rows }) {
  const keys = rows[0] ? Object.keys(rows[0]).slice(0, 8) : []
  return <table className="data"><thead><tr>{keys.map((k) => <th key={k}>{k}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={r.id || i}>{keys.map((k) => <td key={k}>{typeof r[k] === 'number' ? fmtN(r[k]) : String(r[k] ?? '-')}</td>)}</tr>)}</tbody></table>
}

function Empty({ children }) {
  return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)' }}>{children}</div>
}
