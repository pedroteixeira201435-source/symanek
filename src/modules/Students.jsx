import React, { useCallback, useEffect, useState } from 'react'
import { StatCard, Tabs, Panel, Badge, Modal, Avatar, Toast, useToast } from '../ui.jsx'
import { fmtN } from '../lib/format.js'
import { gradeOf, evaluateResult } from '../lib/academics.js'
import { getInstitution, listProgrammes, listStudents, listInvoices, getResultsForStudent, getHoldsForStudent, grantStudentAccess, studentUpsert } from '../api.js'

export default function Students({ focus }) {
  const [tab, setTab] = useState('Register')
  const [students, setStudents] = useState([])
  const [programmes, setProgrammes] = useState([])
  const [institution, setInstitution] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const reload = useCallback(() => Promise.all([
    listStudents().then(setStudents).catch(() => setStudents([])),
    listProgrammes().then(setProgrammes).catch(() => setProgrammes([])),
    getInstitution().then(setInstitution).catch(() => setInstitution(null)),
  ]), [])
  useEffect(() => { reload().finally(() => setLoading(false)) }, [reload])
  useEffect(() => {
    if (focus && students.length) setSelected(students.find((s) => s.name === focus || s.id === focus) || null)
  }, [focus, students])
  return (
    <>
      <Tabs tabs={['Register', 'Student 360', 'Finance', 'Results', 'Holds', 'Loans', 'Incidents']} active={tab} onChange={setTab} />
      {tab === 'Register' && <Register rows={students} programmes={programmes} loading={loading} institution={institution} onOpen={setSelected} reload={reload} />}
      {tab === 'Student 360' && <Student360 student={selected} students={students} programmes={programmes} onSelect={setSelected} reload={reload} />}
      {tab === 'Finance' && <FinanceTab students={students} />}
      {tab === 'Results' && <ResultsTab students={students} />}
      {tab === 'Holds' && <HoldsTab students={students} />}
      {tab === 'Loans' && <Panel title="Student loans" subtitle="TODO(backend): loans table/RPC" flush><Empty>No loans backend is available yet.</Empty></Panel>}
      {tab === 'Incidents' && <Panel title="Incidents" subtitle="TODO(backend): incidents table/RPC" flush><Empty>No incidents backend is available yet.</Empty></Panel>}
      {selected && tab !== 'Student 360' && <Modal title={selected.name} onClose={() => setSelected(null)}><StudentSummary student={selected} /></Modal>}
    </>
  )
}

function Register({ rows, programmes, loading, institution, onOpen, reload }) {
  const [toast, showToast] = useToast()
  const [editing, setEditing] = useState(null)
  if (loading) return <Panel title="Student register" flush><Empty>Loading...</Empty></Panel>
  return (
    <>
      <div className="stat-row c4">
        <StatCard icon="🎓" label="Students" value={String(rows.length)} delta={institution?.name || 'backend register'} />
        <StatCard icon="✅" label="Active" value={String(rows.filter((s) => /active|admitted|enrolled/i.test(s.status || '')).length)} delta="current students" />
        <StatCard icon="📨" label="Intakes" value={String(new Set(rows.map((s) => s.intake).filter(Boolean)).size)} delta="loaded" />
        <StatCard icon="📊" label="Attendance rows" value={String(rows.filter((s) => s.attendance != null).length)} delta="with summary" />
      </div>
      <Panel title="Student register" actions={<button className="btn primary sm" onClick={() => setEditing({})}>+ Add student</button>} flush>
        {rows.length === 0 ? <Empty>No students yet.</Empty> : (
          <table className="data"><thead><tr><th>Student</th><th>No.</th><th>Programme</th><th>Phone</th><th>Status</th><th className="num">Attendance</th></tr></thead>
            <tbody>{rows.map((s) => <tr key={s._uuid || s.id}><td onClick={() => onOpen(s)} style={{ cursor: 'pointer' }}><div className="emp-cell"><Avatar name={s.name} size={26} /><span className="en">{s.name}</span></div></td><td className="mono">{s.id}</td><td>{s.grade}</td><td>{s.phone}</td><td><Badge tone="green">{s.status}</Badge></td><td className="num">{s.attendance ?? '-'}%</td><td><button className="btn ghost sm" onClick={() => setEditing(s)}>Edit</button></td></tr>)}</tbody>
          </table>
        )}
      </Panel>
      {editing && <StudentForm student={editing} programmes={programmes} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await reload(); showToast('Student saved') }} showToast={showToast} />}
      <Toast msg={toast} />
    </>
  )
}

function Student360({ student, students, programmes, onSelect, reload }) {
  const [toast, showToast] = useToast()
  const [editing, setEditing] = useState(false)
  const [granting, setGranting] = useState(false)
  const [granted, setGranted] = useState(null) // { name, email, password }
  const grant = async () => {
    setGranting(true)
    try {
      const res = await grantStudentAccess(student._uuid)
      if (res?.email && res?.password) setGranted({ name: student.name, email: res.email, password: res.password })
      else showToast(`Access granted: ${res?.email || 'account created'}`)
    }
    catch (err) { showToast('Could not grant access: ' + (err?.message || err)) }
    finally { setGranting(false) }
  }
  return (
    <>
      <Panel title="Student 360" subtitle="Select a student to inspect their file">
        <div className="field" style={{ maxWidth: 380 }}><label>Student</label><select value={student?._uuid || ''} onChange={(e) => onSelect(students.find((s) => (s._uuid || s.id) === e.target.value) || null)}><option value="">Select student</option>{students.map((s) => <option key={s._uuid || s.id} value={s._uuid || s.id}>{s.name}</option>)}</select></div>
        {!student ? <Empty>No student selected.</Empty> : <><StudentSummary student={student} /><div style={{ display: 'flex', gap: 8, marginTop: 12 }}><button className="btn ghost sm" onClick={() => setEditing(true)}>Edit student</button><button className="btn primary sm" disabled={granting} onClick={grant}>{granting ? 'Granting…' : 'Grant portal access'}</button></div></>}
      </Panel>
      {editing && <StudentForm student={student} programmes={programmes} onClose={() => setEditing(false)} onSaved={async () => { setEditing(false); await reload(); showToast('Student saved') }} showToast={showToast} />}
      {granted && <PortalCredentials data={granted} onClose={() => setGranted(null)} showToast={showToast} />}
      <Toast msg={toast} />
    </>
  )
}

// Shown once after "Grant portal access". No email provider is wired up, so the
// admin copies these details and sends them to the student manually.
function PortalCredentials({ data, onClose, showToast }) {
  const portalUrl = (typeof window !== 'undefined' && window.location.origin) || 'https://symanek-suite.vercel.app'
  const message =
`Symanek Specialized College — Student Portal access

Hello ${data.name},

Your student portal login has been created. Please sign in and set your own
password on first login. Keep these details private.

Portal:    ${portalUrl}
Username:  ${data.email}
Password:  ${data.password} (temporary)`
  const copy = async (text, what) => {
    try { await navigator.clipboard.writeText(text); showToast(`${what} copied`) }
    catch { showToast('Could not copy — select the text and copy manually') }
  }
  return (
    <Modal title="Portal access — copy & send" onClose={onClose}>
      <div className="note-banner" style={{ background: 'var(--amber-soft, #fff7e6)', borderColor: '#eee0c0', marginBottom: 12 }}>
        Shown once. No email is sent automatically — copy these and send them to the student.
      </div>
      <div className="cf-row"><span>Portal</span><span className="mono">{portalUrl}</span></div>
      <div className="cf-row"><span>Username (email)</span><span className="mono">{data.email}</span></div>
      <div className="cf-row"><span>Temporary password</span><span className="mono">{data.password}</span></div>
      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        <button className="btn primary" onClick={() => copy(message, 'Message')}>Copy message</button>
        <button className="btn ghost" onClick={() => copy(data.email, 'Email')}>Copy email</button>
        <button className="btn ghost" onClick={() => copy(data.password, 'Password')}>Copy password</button>
      </div>
      <textarea readOnly value={message} rows={10} onFocus={(e) => e.target.select()}
        style={{ width: '100%', marginTop: 12, fontFamily: 'monospace', fontSize: 12, padding: 10, border: '1px solid var(--line)', borderRadius: 8, resize: 'vertical' }} />
    </Modal>
  )
}

function StudentForm({ student, programmes, onClose, onSaved, showToast }) {
  const save = async (e) => {
    e.preventDefault(); const f = e.target
    try {
      await studentUpsert({
        id: student._uuid,
        studentNo: f.student_no.value.trim(),
        reference: f.reference.value.trim() || f.student_no.value.trim(),
        name: f.name.value.trim(),
        email: f.email.value.trim(),
        phone: f.phone.value.trim(),
        nextOfKin: f.next_of_kin.value.trim(),
        programmeId: f.programme.value || null,
        status: f.status.value,
        year: f.year.value,
        intake: f.intake.value || null,
        idNumber: f.id_number.value.trim(),
        campus: f.campus.value.trim(),
      })
      await onSaved()
    } catch (err) { showToast('Could not save student: ' + (err?.message || err)) }
  }
  return (
    <Modal title={student._uuid ? 'Edit student' : 'Add student'} onClose={onClose}>
      <form onSubmit={save}>
        <div className="field"><label>Full name</label><input name="name" defaultValue={student.name || ''} required /></div>
        <div className="grid2" style={{ gap: 12 }}>
          <div className="field"><label>Student no.</label><input name="student_no" defaultValue={student.id || ''} required /></div>
          <div className="field"><label>Reference</label><input name="reference" defaultValue={student.reference || student.id || ''} /></div>
        </div>
        <div className="grid2" style={{ gap: 12 }}>
          <div className="field"><label>Email</label><input name="email" type="email" defaultValue={student.email || ''} required /></div>
          <div className="field"><label>Phone</label><input name="phone" defaultValue={student.phone === '-' ? '' : student.phone || ''} /></div>
        </div>
        <div className="field"><label>Programme</label><select name="programme" defaultValue={student.programmeId || ''}><option value="">Unassigned</option>{programmes.map((p) => <option key={p.id || p.code} value={p.id || ''}>{p.code || p.slug} - {p.name}</option>)}</select></div>
        <div className="grid2" style={{ gap: 12 }}>
          <div className="field"><label>Status</label><select name="status" defaultValue={String(student.status || 'admitted').toLowerCase()}><option value="admitted">Admitted</option><option value="enrolled">Enrolled</option><option value="inactive">Inactive</option></select></div>
          <div className="field"><label>Year</label><input name="year" type="number" min="1" defaultValue={student.year || ''} /></div>
        </div>
        <div className="grid2" style={{ gap: 12 }}>
          <div className="field"><label>Intake</label><select name="intake" defaultValue={student.intake || ''}><option value="">None</option><option value="january">January</option><option value="july">July</option></select></div>
          <div className="field"><label>Campus</label><input name="campus" defaultValue={student.campus || 'Main campus'} /></div>
        </div>
        <div className="grid2" style={{ gap: 12 }}>
          <div className="field"><label>ID number</label><input name="id_number" defaultValue={student.idNumber || ''} /></div>
          <div className="field"><label>Next of kin</label><input name="next_of_kin" defaultValue={student.guardian === '-' ? '' : student.guardian || ''} /></div>
        </div>
        <button className="btn primary" type="submit">Save student</button>
      </form>
    </Modal>
  )
}

function StudentSummary({ student }) {
  return <div><div className="cf-row"><span>Name</span><strong>{student.name}</strong></div><div className="cf-row"><span>Student no.</span><span className="mono">{student.id}</span></div><div className="cf-row"><span>Programme</span><span>{student.grade}</span></div><div className="cf-row"><span>Email</span><span>{student.email || '-'}</span></div><div className="cf-row"><span>Status</span><Badge tone="green">{student.status}</Badge></div></div>
}

function FinanceTab({ students }) {
  const [invoices, setInvoices] = useState([])
  useEffect(() => { listInvoices().then(setInvoices).catch(() => setInvoices([])) }, [])
  return <Panel title="Student invoices" flush>{invoices.length === 0 ? <Empty>No invoices yet.</Empty> : <SimpleTable rows={invoices} />}</Panel>
}

function ResultsTab({ students }) {
  const [selected, setSelected] = useState('')
  const [rows, setRows] = useState([])
  useEffect(() => { if (selected) getResultsForStudent(selected).then(setRows).catch(() => setRows([])); else setRows([]) }, [selected])
  return (
    <Panel title="Student results" flush>
      <div className="field" style={{ maxWidth: 360 }}><label>Student</label><select value={selected} onChange={(e) => setSelected(e.target.value)}><option value="">Select student</option>{students.map((s) => <option key={s._uuid || s.id} value={s.name}>{s.name}</option>)}</select></div>
      {!selected ? <Empty>Select a student.</Empty> : rows.length === 0 ? <Empty>No results yet.</Empty> : <table className="data"><thead><tr><th>Course</th><th className="num">CA</th><th className="num">Exam</th><th className="num">Final</th><th>Grade</th></tr></thead><tbody>{rows.map((r) => { const res = evaluateResult(r); const g = gradeOf(res.final); return <tr key={r.code}><td>{r.code}</td><td className="num">{r.ca}</td><td className="num">{r.exam}</td><td className="num">{res.final}%</td><td>{g.letter}</td></tr> })}</tbody></table>}
    </Panel>
  )
}

function HoldsTab({ students }) {
  const [selected, setSelected] = useState('')
  const [rows, setRows] = useState([])
  useEffect(() => { if (selected) getHoldsForStudent(selected).then(setRows).catch(() => setRows([])); else setRows([]) }, [selected])
  return <Panel title="Active holds" flush><div className="field" style={{ maxWidth: 360 }}><label>Student</label><select value={selected} onChange={(e) => setSelected(e.target.value)}><option value="">Select student</option>{students.map((s) => <option key={s._uuid || s.id} value={s.name}>{s.name}</option>)}</select></div>{!selected ? <Empty>Select a student.</Empty> : rows.length === 0 ? <Empty>No active holds.</Empty> : <SimpleTable rows={rows} />}</Panel>
}

function SimpleTable({ rows }) {
  const keys = rows[0] ? Object.keys(rows[0]).slice(0, 8) : []
  return <table className="data"><thead><tr>{keys.map((k) => <th key={k}>{k}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={r.id || i}>{keys.map((k) => <td key={k}>{typeof r[k] === 'number' ? fmtN(r[k]) : Array.isArray(r[k]) ? r[k].join(', ') : String(r[k] ?? '-')}</td>)}</tr>)}</tbody></table>
}

function Empty({ children }) {
  return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)' }}>{children}</div>
}
