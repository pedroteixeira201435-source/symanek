import React, { useCallback, useEffect, useState } from 'react'
import { Tabs, Panel, Badge, Modal, Toast, useToast } from '../ui.jsx'
import { fmtN } from '../lib/format.js'
import {
  listProgrammes, listCourses, listStaff, listStudents, getHoldsForStudent, getDegreeAudit,
  programmeUpsert, programmeSetActive, courseUpsert, courseDelete, holdUpsert, holdClear,
} from '../api.js'

const ACCRED_TONE = { active: 'green', inactive: 'gray', provisional: 'amber' }

export default function Programmes() {
  const [tab, setTab] = useState('Programmes')
  return (
    <>
      <Tabs tabs={['Programmes', 'Course Catalogue', 'Module Allocation', 'Student Blocks', 'Degree Audit']} active={tab} onChange={setTab} />
      {tab === 'Programmes' && <ProgrammeList />}
      {tab === 'Course Catalogue' && <Catalogue />}
      {tab === 'Module Allocation' && <ModuleAllocation />}
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
  const reload = useCallback(() => Promise.all([
    listCourses().then(setCourses).catch(() => setCourses([])),
    listProgrammes().then(setProgrammes).catch(() => setProgrammes([])),
  ]), [])
  useEffect(() => { reload().finally(() => setLoading(false)) }, [reload])

  const save = async (e) => {
    e.preventDefault(); const f = e.target
    try {
      await courseUpsert({ code: f.code.value.trim().toUpperCase(), title: f.title.value.trim(), programmeId: f.programme.value || null, credits: Number(f.credits.value) || 0, semester: f.semester.value, capacity: Number(f.capacity.value) || 0 })
      setShowNew(false); await reload(); showToast('Course saved')
    } catch (err) { showToast('Could not save: ' + (err?.message || err)) }
  }
  const remove = async (c) => {
    try { await courseDelete(c.id); await reload(); showToast('Course deleted') }
    catch (err) { showToast('Could not delete: ' + (err?.message || err)) }
  }

  if (loading) return <Panel title="Course catalogue" flush><Empty>Loading...</Empty></Panel>
  return (
    <>
      <Panel title="Course catalogue" subtitle={`${courses.length} credit-bearing courses`} actions={<button className="btn primary sm" onClick={() => setShowNew(true)}>+ Add course</button>} flush>
        {courses.length === 0 ? <Empty>No courses yet.</Empty> : (
          <table className="data"><thead><tr><th>Code</th><th>Course</th><th>Programme</th><th className="num">Credits</th><th>Semester</th><th>Lecturer</th><th></th></tr></thead>
            <tbody>{courses.map((c) => <tr key={c.id || c.code}>
              <td className="mono">{c.code}</td><td style={{ fontWeight: 600 }}>{c.title}</td><td>{c.prog || '-'}</td><td className="num">{c.credits || 0}</td><td>{c.sem || c.semester || '-'}</td><td>{c.lecturer || '-'}</td>
              <td>{c.id && <button className="btn ghost sm" onClick={() => remove(c)}>Delete</button>}</td>
            </tr>)}</tbody>
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
          <div className="field"><label>Capacity</label><input name="capacity" type="number" min="0" /></div>
          <button className="btn primary" type="submit">Save</button>
        </form>
      </Modal>}
      <Toast msg={toast} />
    </>
  )
}

function ModuleAllocation() {
  const [courses, setCourses] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    Promise.all([
      listCourses().then(setCourses).catch(() => setCourses([])),
      listStaff().then(setStaff).catch(() => setStaff([])),
    ]).finally(() => setLoading(false))
  }, [])
  if (loading) return <Panel title="Module allocation" flush><Empty>Loading...</Empty></Panel>
  return (
    <Panel title="Module allocation" subtitle="Teaching assignments from backend course/staff rows" flush>
      {courses.length === 0 ? <Empty>No modules available for allocation.</Empty> : (
        <table className="data"><thead><tr><th>Module</th><th>Programme</th><th>Lecturer</th></tr></thead>
          <tbody>{courses.map((c) => <tr key={c.id || c.code}><td>{c.code} - {c.title}</td><td>{c.prog || '-'}</td><td>{c.lecturer || staff[0]?.name || '-'}</td></tr>)}</tbody>
        </table>
      )}
    </Panel>
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
