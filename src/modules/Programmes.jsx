import React, { useCallback, useEffect, useState } from 'react'
import { Tabs, Panel, Badge, Modal, Toast, useToast, Icon } from '../ui.jsx'
import { fmtN } from '../lib/format.js'
import {
  listProgrammes, listCourses, listStudents, getHoldsForStudent, getDegreeAudit,
  programmeUpsert, programmeSetActive, courseUpsert, courseDelete, courseSetCapacity, holdUpsert, holdClear,
  listStaffAccounts, staffUpsert, grantStaffAccess, revokeStaffAccess, setCourseLecturer,
  listEnrolmentCohorts, enrolCohort,
} from '../api.js'
import { PortalCredentials } from './Students.jsx'

const ACCRED_TONE = { active: 'green', inactive: 'gray', provisional: 'amber' }

export default function Programmes() {
  const [tab, setTab] = useState('Programmes')
  return (
    <>
      <Tabs tabs={['Programmes', 'Course Catalogue', 'Lecturers', 'Cohort Enrolment', 'Student Blocks', 'Degree Audit']} active={tab} onChange={setTab} />
      {tab === 'Programmes' && <ProgrammeList />}
      {tab === 'Course Catalogue' && <Catalogue />}
      {tab === 'Lecturers' && <ModuleAllocation />}
      {tab === 'Cohort Enrolment' && <CohortEnrolment />}
      {tab === 'Student Blocks' && <StudentBlocks />}
      {tab === 'Degree Audit' && <DegreeAudit />}
    </>
  )
}

function ProgrammeList() {
  const [toast, showToast] = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const reload = useCallback(() => listProgrammes().then(setRows).catch(() => setRows([])), [])
  useEffect(() => { reload().finally(() => setLoading(false)) }, [reload])

  const save = async (e) => {
    e.preventDefault(); const f = e.target
    try {
      await programmeUpsert({ slug: f.code.value.trim().toLowerCase(), name: f.name.value.trim(), level: f.level.value, duration: f.duration.value, fee: Number(f.fee.value) || null })
      setShowNew(false); await reload(); showToast('Programme saved')
    } catch (err) { showToast('Could not save: ' + (err?.message || err)) }
  }
  const toggle = async (p) => {
    try { await programmeSetActive(p.id, !p.active); await reload(); showToast('Programme updated') }
    catch (err) { showToast('Could not update: ' + (err?.message || err)) }
  }

  if (loading) return <Panel title="Registered programmes" flush><Empty>Loading...</Empty></Panel>
  return (
    <>
      <Panel title="Registered programmes" subtitle="NQF-levelled programmes" actions={<button className="btn primary sm" onClick={() => setShowNew(true)}>+ New programme</button>} flush>
        {rows.length === 0 ? <Empty>No programmes yet.</Empty> : (
          <table className="data">
            <thead><tr><th>Programme</th><th>Level</th><th>Duration</th><th className="num">Fee</th><th>Status</th><th></th></tr></thead>
            <tbody>{rows.map((p) => (
              <tr key={p.id || p.code}>
                <td><div style={{ fontWeight: 600 }}>{p.name}</div><div className="mono" style={{ fontSize: 11.5 }}>{p.code || p.slug}</div></td>
                <td><Badge tone="blue">{p.nqf || p.level || '-'}</Badge></td>
                <td>{p.duration || '-'}</td>
                <td className="num">{p.fee ? fmtN(p.fee) : '-'}</td>
                <td><Badge tone={ACCRED_TONE[p.active ? 'active' : 'inactive']}>{p.active ? 'Active' : 'Inactive'}</Badge></td>
                <td>{p.id && <button className="btn ghost sm" onClick={() => toggle(p)}>{p.active ? 'Disable' : 'Enable'}</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Panel>
      {showNew && <Modal title="New programme" onClose={() => setShowNew(false)}>
        <form onSubmit={save}>
          <div className="field"><label>Programme name</label><input name="name" required /></div>
          <div className="grid2" style={{ gap: 12 }}>
            <div className="field"><label>Code / slug</label><input name="code" required /></div>
            <div className="field"><label>NQF level</label><input name="level" /></div>
          </div>
          <div className="grid2" style={{ gap: 12 }}>
            <div className="field"><label>Duration</label><input name="duration" placeholder="e.g. 1 year" /></div>
            <div className="field"><label>Fee</label><input name="fee" type="number" min="0" /></div>
          </div>
          <button className="btn primary" type="submit">Save</button>
        </form>
      </Modal>}
      <Toast msg={toast} />
    </>
  )
}

function Catalogue() {
  const [toast, showToast] = useToast()
  const [courses, setCourses] = useState([])
  const [programmes, setProgrammes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [filterProg, setFilterProg] = useState('')
  const [query, setQuery] = useState('')
  const [edits, setEdits] = useState({})
  const [saving, setSaving] = useState(false)
  const [staff, setStaff] = useState([])
  const reload = useCallback(() => Promise.all([
    listCourses().then(setCourses).catch(() => setCourses([])),
    listProgrammes().then(setProgrammes).catch(() => setProgrammes([])),
    listStaffAccounts().then(setStaff).catch(() => setStaff([])),
  ]), [])
  useEffect(() => { reload().finally(() => setLoading(false)) }, [reload])

  const save = async (e) => {
    e.preventDefault(); const f = e.target
    try {
      await courseUpsert({ code: f.code.value.trim().toUpperCase(), title: f.title.value.trim(), programmeId: f.programme.value || null, credits: Number(f.credits.value) || 0, semester: f.semester.value, capacity: Number(f.capacity.value) || 0, lecturerId: f.lecturer.value || null })
      setShowNew(false); await reload(); showToast('Course saved')
    } catch (err) { showToast('Could not save: ' + (err?.message || err)) }
  }
  const remove = async (c) => {
    try { await courseDelete(c.id); await reload(); showToast('Course deleted') }
    catch (err) { showToast('Could not delete: ' + (err?.message || err)) }
  }

  // capacity editing — set values inline, save the changed rows in one pass
  const capOf = (c) => Number(c.cap ?? 0)
  const editedCap = (c) => (edits[c.id] ?? String(capOf(c)))
  const isChanged = (c) => Boolean(c.id) && edits[c.id] !== undefined && Number(edits[c.id] || 0) !== capOf(c)
  const changed = courses.filter(isChanged)
  const setCap = (id, val) => setEdits((e) => ({ ...e, [id]: val }))
  const saveCaps = async () => {
    setSaving(true); let ok = 0, fail = 0
    for (const c of changed) {
      try { await courseSetCapacity(c.id, Number(edits[c.id] || 0)); ok++ } catch { fail++ }
    }
    setSaving(false); setEdits({}); await reload()
    showToast(fail ? `Saved ${ok}, ${fail} failed` : `Capacities saved (${ok})`)
  }

  const progOptions = [...new Set(courses.map((c) => c.prog).filter(Boolean))].sort()
  const shown = courses.filter((c) => {
    if (filterProg && (c.prog || '') !== filterProg) return false
    if (query && !`${c.code} ${c.title}`.toLowerCase().includes(query.toLowerCase())) return false
    return true
  })

  if (loading) return <Panel title="Course catalogue" flush><Empty>Loading...</Empty></Panel>
  return (
    <>
      <Panel
        title="Course catalogue"
        subtitle={`${shown.length} of ${courses.length} courses`}
        actions={<>
          {changed.length > 0 && <button className="btn primary sm" onClick={saveCaps} disabled={saving} style={{ marginRight: 8 }}>{saving ? 'Saving…' : `Save capacities (${changed.length})`}</button>}
          <button className="btn ghost sm" onClick={() => setShowNew(true)}>+ Add course</button>
        </>}
        flush
      >
        <div style={{ display: 'flex', gap: 8, padding: '8px 0', flexWrap: 'wrap' }}>
          <select value={filterProg} onChange={(e) => setFilterProg(e.target.value)}>
            <option value="">All programmes</option>
            {progOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <input placeholder="Search code or title…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        </div>
        {shown.length === 0 ? <Empty>No courses match.</Empty> : (
          <table className="data"><thead><tr><th>Code</th><th>Course</th><th>Programme</th><th className="num">Credits</th><th>Sem</th><th>Lecturer</th><th className="num">Enrolled</th><th style={{ width: 110 }}>Capacity</th><th></th></tr></thead>
            <tbody>{shown.map((c) => {
              const cap = Number(editedCap(c) || 0); const enr = Number(c.enrolled ?? 0)
              return (
                <tr key={c.id || c.code} style={isChanged(c) ? { background: 'rgba(37,99,235,0.06)' } : undefined}>
                  <td className="mono">{c.code}</td><td style={{ fontWeight: 600 }}>{c.title}</td><td>{c.prog || '-'}</td><td className="num">{c.credits || 0}</td><td>{c.sem || c.semester || '-'}</td><td>{c.lecturer || '-'}</td>
                  <td className="num">{enr}{cap > 0 && enr >= cap && <> <Badge tone="red">Full</Badge></>}</td>
                  <td>{c.id
                    ? <input type="number" min="0" value={editedCap(c)} onChange={(e) => setCap(c.id, e.target.value)} style={{ width: 84 }} />
                    : <span className="mono">{cap}</span>}</td>
                  <td>{c.id && <button className="btn ghost sm" onClick={() => remove(c)}>Delete</button>}</td>
                </tr>
              )
            })}</tbody>
          </table>
        )}
      </Panel>
      {showNew && <Modal title="Add course" onClose={() => setShowNew(false)}>
        <form onSubmit={save}>
          <div className="grid2" style={{ gap: 12 }}><div className="field"><label>Code</label><input name="code" required /></div><div className="field"><label>Credits</label><input name="credits" type="number" min="0" /></div></div>
          <div className="field"><label>Course title</label><input name="title" required /></div>
          <div className="grid2" style={{ gap: 12 }}>
            <div className="field"><label>Programme</label><select name="programme"><option value="">Unassigned</option>{programmes.map((p) => <option key={p.id || p.code} value={p.id || ''}>{p.code || p.slug} - {p.name}</option>)}</select></div>
            <div className="field"><label>Semester</label><input name="semester" placeholder="S1" /></div>
          </div>
          <div className="grid2" style={{ gap: 12 }}>
            <div className="field"><label>Capacity</label><input name="capacity" type="number" min="0" /></div>
            <div className="field"><label>Lecturer</label><select name="lecturer"><option value="">— No lecturer —</option>{staff.map((s) => <option key={s.uuid} value={s.uuid}>{s.name}</option>)}</select></div>
          </div>
          <button className="btn primary" type="submit">Save</button>
        </form>
      </Modal>}
      <Toast msg={toast} />
    </>
  )
}

const STAFF_WORKSPACES = [
  ['teacher', 'Lecturer'], ['registrar', 'Registrar'], ['bursar', 'Bursar'], ['hr', 'HR'],
  ['librarian', 'Librarian'], ['seller', 'Canteen / POS'], ['admin', 'Administrator'],
]

// Lecturers: add a lecturer, give them a Suite login, and allocate modules.
// Staff writes need HR/admin, logins need admin, allocation needs registrar/admin
// (all enforced server-side; errors surface in the toast).
function ModuleAllocation() {
  const [toast, showToast] = useToast()
  const [courses, setCourses] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)   // {} = new, staff row = edit
  const [granting, setGranting] = useState(null) // staff row picking a workspace
  const [busy, setBusy] = useState(false)
  const [creds, setCreds] = useState(null)
  const [filterProg, setFilterProg] = useState('')
  const [filterLect, setFilterLect] = useState('')
  const [query, setQuery] = useState('')
  const [alloc, setAlloc] = useState({})         // courseId -> staff uuid ('' = none)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(() => Promise.all([
    listCourses().then(setCourses).catch(() => setCourses([])),
    listStaffAccounts().then(setStaff).catch(() => setStaff([])),
  ]), [])
  useEffect(() => { reload().finally(() => setLoading(false)) }, [reload])

  const saveStaff = async (e) => {
    e.preventDefault(); const f = e.target
    try {
      await staffUpsert({
        id: editing.uuid ?? null, staffNo: f.staff_no.value.trim() || null, name: f.name.value.trim(),
        email: f.email.value.trim().toLowerCase() || null, role: f.role.value.trim() || null, department: f.department.value.trim() || null,
      })
      setEditing(null); await reload(); showToast('Staff saved')
    } catch (err) { showToast('Could not save: ' + (err?.message || err)) }
  }
  const grant = async (e) => {
    e.preventDefault(); const s = granting; const role = e.target.suite_role.value
    setBusy(true)
    try {
      const res = await grantStaffAccess(s.uuid, role)
      setGranting(null); await reload()
      if (res?.password) setCreds({ name: s.name, email: res.email, password: res.password })
      else showToast(`Access granted: ${res?.email || s.email}`)
    } catch (err) { showToast('Could not grant access: ' + (err?.message || err)) }
    finally { setBusy(false) }
  }
  const revoke = async (s) => {
    if (!window.confirm(`Remove ${s.name}'s Suite login? Their staff record and module allocation stay.`)) return
    try { await revokeStaffAccess(s.uuid); await reload(); showToast('Login removed') }
    catch (err) { showToast('Could not remove login: ' + (err?.message || err)) }
  }

  const lectOf = (c) => (alloc[c.id] !== undefined ? alloc[c.id] : (c.lecturerId || ''))
  const changed = courses.filter((c) => c.id && alloc[c.id] !== undefined && alloc[c.id] !== (c.lecturerId || ''))
  const saveAlloc = async () => {
    setSaving(true); let ok = 0, fail = 0, lastErr = ''
    for (const c of changed) {
      try { await setCourseLecturer(c.id, alloc[c.id]); ok++ } catch (err) { fail++; lastErr = err?.message || String(err) }
    }
    setSaving(false); setAlloc({}); await reload()
    showToast(fail ? `Saved ${ok}, ${fail} failed: ${lastErr}` : `Allocation saved (${ok})`)
  }
  const countFor = (uuid) => courses.filter((c) => c.lecturerId === uuid).length

  const progOptions = [...new Set(courses.map((c) => c.prog).filter(Boolean))].sort()
  const shown = courses.filter((c) => {
    if (filterProg && (c.prog || '') !== filterProg) return false
    if (filterLect === '__none' && c.lecturerId) return false
    if (filterLect && filterLect !== '__none' && c.lecturerId !== filterLect) return false
    if (query && !`${c.code} ${c.title}`.toLowerCase().includes(query.toLowerCase())) return false
    return true
  })

  if (loading) return <Panel title="Lecturers" flush><Empty>Loading...</Empty></Panel>
  return (
    <>
      <Panel title="Lecturers & staff" subtitle={`${staff.length} staff · ${staff.filter((s) => s.hasLogin).length} with a Suite login`}
        actions={<button className="btn primary sm" onClick={() => setEditing({})}>+ Add lecturer</button>} flush>
        {staff.length === 0 ? <Empty>No staff yet.</Empty> : (
          <table className="data"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th className="num">Modules</th><th>Suite login</th><th></th></tr></thead>
            <tbody>{staff.map((s) => (
              <tr key={s.uuid}>
                <td style={{ fontWeight: 600 }}>{s.name}</td>
                <td className="mono">{s.email || <Badge tone="amber">no email</Badge>}</td>
                <td>{s.role || '-'}</td>
                <td className="num">{countFor(s.uuid)}</td>
                <td>{s.hasLogin ? <Badge tone="green">Active</Badge> : <Badge tone="gray">None</Badge>}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn ghost sm" onClick={() => setEditing(s)}>Edit</button>{' '}
                  {s.hasLogin
                    ? <button className="btn ghost sm" onClick={() => revoke(s)}>Remove login</button>
                    : <button className="btn primary sm" disabled={!s.email} title={s.email ? '' : 'Add an email first'} onClick={() => setGranting(s)}>Grant Suite access</button>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Panel>

      <Panel title="Module allocation" subtitle={`${courses.filter((c) => !c.lecturerId).length} of ${courses.length} modules without a lecturer`}
        actions={changed.length > 0 && <button className="btn primary sm" onClick={saveAlloc} disabled={saving}>{saving ? 'Saving…' : `Save allocation (${changed.length})`}</button>} flush>
        <div style={{ display: 'flex', gap: 8, padding: '8px 0', flexWrap: 'wrap' }}>
          <select value={filterProg} onChange={(e) => setFilterProg(e.target.value)}>
            <option value="">All programmes</option>
            {progOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filterLect} onChange={(e) => setFilterLect(e.target.value)}>
            <option value="">All lecturers</option>
            <option value="__none">No lecturer</option>
            {staff.map((s) => <option key={s.uuid} value={s.uuid}>{s.name}</option>)}
          </select>
          <input placeholder="Search code or title…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        </div>
        {shown.length === 0 ? <Empty>No modules match.</Empty> : (
          <table className="data"><thead><tr><th>Module</th><th>Programme</th><th>Sem</th><th style={{ width: 260 }}>Lecturer</th></tr></thead>
            <tbody>{shown.map((c) => {
              const dirty = c.id && alloc[c.id] !== undefined && alloc[c.id] !== (c.lecturerId || '')
              return (
                <tr key={c.id || c.code} style={dirty ? { background: 'rgba(37,99,235,0.06)' } : undefined}>
                  <td><span className="mono">{c.code}</span> — {c.title}</td><td>{c.prog || '-'}</td><td>{c.sem || '-'}</td>
                  <td>{c.id ? (
                    <select value={lectOf(c)} onChange={(e) => setAlloc((a) => ({ ...a, [c.id]: e.target.value }))} style={{ width: '100%' }}>
                      <option value="">— No lecturer —</option>
                      {staff.map((s) => <option key={s.uuid} value={s.uuid}>{s.name}</option>)}
                    </select>
                  ) : (c.lecturer || '-')}</td>
                </tr>
              )
            })}</tbody>
          </table>
        )}
      </Panel>

      {editing && <Modal title={editing.uuid ? 'Edit staff' : 'Add lecturer'} onClose={() => setEditing(null)}>
        <form onSubmit={saveStaff}>
          <div className="field"><label>Full name</label><input name="name" defaultValue={editing.name || ''} required /></div>
          <div className="grid2" style={{ gap: 12 }}>
            <div className="field"><label>Email (used to sign in)</label><input name="email" type="email" defaultValue={editing.email || ''} /></div>
            <div className="field"><label>Staff no.</label><input name="staff_no" defaultValue={editing.staffNo || ''} /></div>
          </div>
          <div className="grid2" style={{ gap: 12 }}>
            <div className="field"><label>Job title</label><input name="role" defaultValue={editing.role ?? (editing.uuid ? '' : 'Lecturer')} /></div>
            <div className="field"><label>Department</label><input name="department" defaultValue={editing.dept || ''} /></div>
          </div>
          {editing.hasLogin && <div className="note-banner" style={{ marginBottom: 12 }}>This person already has a login. Changing the email here does not change their sign-in email.</div>}
          <button className="btn primary" type="submit">Save</button>
        </form>
      </Modal>}

      {granting && <Modal title={`Grant Suite access — ${granting.name}`} onClose={() => setGranting(null)}>
        <form onSubmit={grant}>
          <div className="cf-row"><span>Sign-in email</span><span className="mono">{granting.email}</span></div>
          <div className="field" style={{ marginTop: 12 }}><label>Workspace</label>
            <select name="suite_role" defaultValue="teacher">{STAFF_WORKSPACES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </div>
          <p style={{ color: 'var(--ink-faint)', fontSize: 13 }}>A temporary password is created and shown once. They must change it on first sign-in. A lecturer only sees the modules allocated to them below.</p>
          <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Granting…' : 'Grant access'}</button>
        </form>
      </Modal>}

      {creds && <PortalCredentials data={creds} audience="staff" onClose={() => setCreds(null)} showToast={showToast} />}
      <Toast msg={toast} />
    </>
  )
}

// Cohort enrolment: put every enrolled student of an intake on their
// programme's modules (Bachelor "Y1/Y2…" modules follow the student's year).
// Preview first; running it twice never duplicates. No fees are charged here.
function CohortEnrolment() {
  const [toast, showToast] = useToast()
  const [cohorts, setCohorts] = useState([])
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState(null) // { cohort, res }
  const [busy, setBusy] = useState(false)
  const reload = useCallback(() => listEnrolmentCohorts().then(setCohorts).catch((e) => { setCohorts([]); showToast('Could not load cohorts: ' + (e?.message || e)) }), [])
  useEffect(() => { reload().finally(() => setLoading(false)) }, [reload])

  const args = (c) => ({ programmeId: c.programme_id, academicYear: c.academic_year, intake: c.intake })
  const doPreview = async (c) => {
    try { setPreview({ cohort: c, res: await enrolCohort({ ...args(c), dryRun: true }) }) }
    catch (e) { showToast('Could not preview: ' + (e?.message || e)) }
  }
  const run = async () => {
    setBusy(true)
    try {
      const res = await enrolCohort({ ...args(preview.cohort), dryRun: false })
      showToast(`Enrolled: ${res?.created ?? 0} new module registrations`); setPreview(null); await reload()
    } catch (e) { showToast('Could not enrol: ' + (e?.message || e)) }
    finally { setBusy(false) }
  }
  const label = (c) => `${c.programme} — ${c.intake ? c.intake[0].toUpperCase() + c.intake.slice(1) : 'no intake'} ${c.academic_year ?? ''}`

  if (loading) return <Panel title="Cohort enrolment" flush><Empty>Loading...</Empty></Panel>
  return (
    <>
      <div className="note-banner"><Icon name="info" size={16} /><div>Enrols every <strong>enrolled</strong> student of a cohort on the modules of their programme, so lecturers see them in their registers and students see their modules. Bachelor modules follow the student's year of study. Safe to run again — nothing is duplicated and no fees are charged.</div></div>
      <Panel title="Cohorts" subtitle={`${cohorts.length} cohorts with enrolled students`} flush>
        {cohorts.length === 0 ? <Empty>No cohorts found.</Empty> : (
          <table className="data"><thead><tr><th>Cohort</th><th className="num">Students</th><th className="num">Modules</th><th className="num">Registrations</th><th></th></tr></thead>
            <tbody>{cohorts.map((c) => (
              <tr key={`${c.programme_id}-${c.academic_year}-${c.intake}`}>
                <td style={{ fontWeight: 600 }}>{label(c)}</td>
                <td className="num">{c.students}</td><td className="num">{c.modules}</td>
                <td className="num">{Number(c.enrolments) > 0 ? <Badge tone="green">{c.enrolments}</Badge> : <Badge tone="gray">0</Badge>}</td>
                <td style={{ textAlign: 'right' }}><button className="btn ghost sm" onClick={() => doPreview(c)} disabled={!c.intake || !c.academic_year} title={!c.intake || !c.academic_year ? 'Set the intake and academic year on these students first' : ''}>Enrol…</button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Panel>
      {preview && <Modal title={`Enrol — ${label(preview.cohort)}`} onClose={() => setPreview(null)}>
        <div className="cf-row"><span>Students</span><strong>{preview.res?.students ?? 0}</strong></div>
        <div className="cf-row"><span>Modules</span><strong>{preview.res?.courses ?? 0}</strong></div>
        <div className="cf-row"><span>Already registered</span><strong>{preview.res?.already ?? 0}</strong></div>
        <div className="cf-row"><span>New registrations</span><strong>{(preview.res?.pairs ?? 0) - (preview.res?.already ?? 0)}</strong></div>
        <div style={{ marginTop: 16 }}>
          <button className="btn primary" onClick={run} disabled={busy || (preview.res?.pairs ?? 0) - (preview.res?.already ?? 0) <= 0}>{busy ? 'Enrolling…' : 'Confirm enrolment'}</button>
        </div>
      </Modal>}
      <Toast msg={toast} />
    </>
  )
}

function StudentBlocks() {
  const [toast, showToast] = useToast()
  const [students, setStudents] = useState([])
  const [selected, setSelected] = useState('')
  const [blocks, setBlocks] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(true)
  useEffect(() => { listStudents().then(setStudents).catch(() => setStudents([])).finally(() => setLoading(false)) }, [])
  const reloadBlocks = useCallback(() => {
    if (!selected) { setBlocks([]); return }
    getHoldsForStudent(selected).then(setBlocks).catch(() => setBlocks([]))
  }, [selected])
  useEffect(() => { reloadBlocks() }, [reloadBlocks])
  const add = async (e) => {
    e.preventDefault(); const f = e.target
    const blocksPicked = Array.from(f.elements.blocks).filter((x) => x.checked).map((x) => x.value)
    try {
      await holdUpsert({ studentId: selected, type: f.type.value, reason: f.reason.value.trim(), blocks: blocksPicked })
      setShowNew(false); await reloadBlocks(); showToast('Hold placed')
    } catch (err) { showToast('Could not place hold: ' + (err?.message || err)) }
  }
  const release = async (h) => {
    try { await holdClear(h.id); await reloadBlocks(); showToast('Hold released') }
    catch (err) { showToast('Could not release hold: ' + (err?.message || err)) }
  }
  if (loading) return <Panel title="Student blocks / holds" flush><Empty>Loading...</Empty></Panel>
  return (
    <>
    <Panel title="Student blocks / holds" subtitle="Create and release active backend holds" actions={<button className="btn primary sm" disabled={!selected} onClick={() => setShowNew(true)}>+ Place hold</button>} flush>
      <div className="field" style={{ maxWidth: 360 }}><label>Student</label><select value={selected} onChange={(e) => setSelected(e.target.value)}><option value="">Select student</option>{students.map((s) => <option key={s._uuid || s.id} value={s._uuid || s.id}>{s.name}</option>)}</select></div>
      {!selected ? <Empty>Select a student to view active holds.</Empty> : blocks.length === 0 ? <Empty>No active holds for this student.</Empty> : (
        <table className="data"><thead><tr><th>Type</th><th>Reason</th><th>Since</th><th>Impact</th><th></th></tr></thead>
          <tbody>{blocks.map((b, i) => <tr key={b.id || i}><td><Badge tone="red">{b.type}</Badge></td><td>{b.reason}</td><td>{b.since}</td><td>{(b.impact || []).join(', ')}</td><td>{b.id && <button className="btn green sm" onClick={() => release(b)}>Release</button>}</td></tr>)}</tbody>
        </table>
      )}
    </Panel>
    {showNew && <Modal title="Place hold" onClose={() => setShowNew(false)}>
      <form onSubmit={add}>
        <div className="field"><label>Type</label><select name="type"><option value="financial">Financial</option><option value="advising">Advising</option><option value="conduct">Conduct</option><option value="library">Library</option></select></div>
        <div className="field"><label>Reason</label><input name="reason" required /></div>
        <div style={{ marginBottom: 12 }}>
          {['registration', 'results', 'certificate', 'graduation'].map((b) => <label key={b} style={{ display: 'block', marginBottom: 6 }}><input type="checkbox" name="blocks" value={b} /> Blocks {b}</label>)}
        </div>
        <button className="btn primary">Place hold</button>
      </form>
    </Modal>}
    <Toast msg={toast} />
    </>
  )
}

function DegreeAudit() {
  const [students, setStudents] = useState([])
  const [selected, setSelected] = useState('')
  const [audit, setAudit] = useState(null)
  useEffect(() => { listStudents().then(setStudents).catch(() => setStudents([])) }, [])
  useEffect(() => {
    if (!selected) { setAudit(null); return }
    getDegreeAudit(selected).then(setAudit).catch(() => setAudit(null))
  }, [selected])
  return (
    <Panel title="Degree audit" subtitle="Read-only audit from backend" flush>
      <div className="field" style={{ maxWidth: 360 }}><label>Student</label><select value={selected} onChange={(e) => setSelected(e.target.value)}><option value="">Select student</option>{students.map((s) => <option key={s._uuid || s.id} value={s.name}>{s.name}</option>)}</select></div>
      {!selected ? <Empty>Select a student to view the audit.</Empty> : !audit ? <Empty>No degree audit is available yet.</Empty> : (
        <table className="data"><thead><tr><th>Requirement</th><th className="num">Done</th><th className="num">Need</th><th>Status</th></tr></thead>
          <tbody>{(audit.reqs || []).map((r) => <tr key={r.req}><td>{r.req}</td><td className="num">{r.done}</td><td className="num">{r.need}</td><td><Badge tone={r.status === 'Satisfied' ? 'green' : 'amber'}>{r.status}</Badge></td></tr>)}</tbody>
        </table>
      )}
    </Panel>
  )
}

function Empty({ children }) {
  return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)' }}>{children}</div>
}
