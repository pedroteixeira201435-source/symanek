import React, { useCallback, useEffect, useState } from 'react'
import { Tabs, Panel, Badge, Modal, Toast, useToast, Icon } from '../ui.jsx'
import { listCourses, listCourseware, coursewareUpsert, coursewareDelete, listSubmissions, submitAssignment, gradeSubmission } from '../api.js'

export default function Courseware({ role }) {
  const isTeacher = role.id === 'teacher'
  const me = role.user
  const [courses, setCourses] = useState([])
  const [active, setActive] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    listCourses().then((rows) => {
      if (!alive) return
      const visible = isTeacher ? rows.filter((c) => !c.lecturer || c.lecturer === me) : rows
      setCourses(visible)
      setActive(visible[0]?.id || visible[0]?.code || null)
    }).catch(() => setCourses([])).finally(() => setLoading(false))
    return () => { alive = false }
  }, [isTeacher, me])

  if (loading) return <Panel title="Courseware" flush><Empty>Loading...</Empty></Panel>
  if (courses.length === 0) return <Panel title="Courseware"><Empty>No courses with online material yet.</Empty></Panel>

  const tabs = courses.map((c) => c.code)
  const current = courses.find((c) => (c.id || c.code) === active) || courses[0]
  return (
    <>
      {tabs.length > 1 && <Tabs tabs={tabs} active={current.code} onChange={(code) => setActive(courses.find((c) => c.code === code)?.id || code)} />}
      <CourseView course={current} isTeacher={isTeacher} me={me} />
    </>
  )
}

function CourseView({ course, isTeacher, me }) {
  const [toast, showToast] = useToast()
  const [items, setItems] = useState([])
  const [subs, setSubs] = useState({})
  const [showNew, setShowNew] = useState(false)
  const [gradeFor, setGradeFor] = useState(null)
  const courseId = course.id || course.code

  const reload = useCallback(() => listCourseware(courseId).then(setItems).catch(() => setItems([])), [courseId])
  useEffect(() => { reload() }, [reload])
  useEffect(() => {
    items.forEach((a) => listSubmissions(a.id).then((rows) => setSubs((s) => ({ ...s, [a.id]: rows }))).catch(() => {}))
  }, [items])

  const save = async (e) => {
    e.preventDefault(); const f = e.target
    try { await coursewareUpsert({ courseId, title: f.title.value.trim(), url: f.url.value.trim() || null }); setShowNew(false); await reload(); showToast('Material saved') }
    catch (err) { showToast('Could not save: ' + (err?.message || err)) }
  }
  const remove = async (item) => {
    try { await coursewareDelete(item.id); await reload(); showToast('Material deleted') }
    catch (err) { showToast('Could not delete: ' + (err?.message || err)) }
  }
  const submit = async (a) => {
    try { await submitAssignment({ student: me, assignmentId: a.id }); showToast(`${a.title} submitted`) }
    catch (err) { showToast('Could not submit: ' + (err?.message || err)) }
  }

  return (
    <>
      <Panel title={`${course.code} - ${course.title}`} subtitle={`${course.prog || '-'} · ${course.credits || 0} credits · ${course.lecturer || 'unallocated'}`} actions={isTeacher && <button className="btn primary sm" onClick={() => setShowNew(true)}>+ Upload material</button>}>
        {items.length === 0 ? <Empty>No materials or assignments yet.</Empty> : items.map((m) => (
          <div key={m.id || m.title} className="cf-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <span><Badge tone="blue">{m.type || 'Material'}</Badge> {m.title}</span>
            <span style={{ display: 'flex', gap: 8 }}>
              {m.url && <a className="btn ghost sm" href={m.url} target="_blank" rel="noopener noreferrer"><Icon name="download" size={14} /> Open</a>}
              {isTeacher ? <button className="btn ghost sm" onClick={() => remove(m)}>Delete</button> : <button className="btn primary sm" onClick={() => submit(m)}>Submit</button>}
            </span>
          </div>
        ))}
      </Panel>

      <Panel title="Submissions" flush>
        {items.length === 0 ? <Empty>No assignments yet.</Empty> : (
          <table className="data"><thead><tr><th>Item</th><th className="num">Submissions</th><th>Action</th></tr></thead>
            <tbody>{items.map((a) => <tr key={a.id}><td>{a.title}</td><td className="num">{(subs[a.id] || []).length}</td><td>{isTeacher ? <button className="btn ghost sm" onClick={() => setGradeFor(a)}>Grade</button> : '-'}</td></tr>)}</tbody>
          </table>
        )}
      </Panel>

      {showNew && <Modal title="Upload material" onClose={() => setShowNew(false)}>
        <form onSubmit={save}>
          <div className="field"><label>Title</label><input name="title" required /></div>
          <div className="field"><label>URL</label><input name="url" type="url" /></div>
          <button className="btn primary" type="submit">Save</button>
        </form>
      </Modal>}
      {gradeFor && <GradeModal assignment={gradeFor} rows={subs[gradeFor.id] || []} onClose={() => setGradeFor(null)} showToast={showToast} />}
      <Toast msg={toast} />
    </>
  )
}

function GradeModal({ assignment, rows, onClose, showToast }) {
  const [localRows, setLocalRows] = useState(rows)
  const setField = (id, k, v) => setLocalRows((rs) => rs.map((r) => (r.id === id ? { ...r, [k]: v } : r)))
  const save = async (r) => {
    try { await gradeSubmission({ id: r.id, assignmentId: assignment.id, grade: r.grade == null ? null : Number(r.grade), feedback: r.feedback || '' }); showToast('Grade saved') }
    catch (err) { showToast('Could not save: ' + (err?.message || err)) }
  }
  return (
    <Modal title={`Grade - ${assignment.title}`} onClose={onClose} width={660}>
      {localRows.length === 0 ? <Empty>No submissions yet.</Empty> : localRows.map((r) => (
        <div key={r.id} style={{ borderBottom: '1px solid var(--line)', padding: '10px 0' }}>
          <div className="cf-row" style={{ marginBottom: 6 }}><strong>{r.student}</strong><span className="di-sub">submitted {r.submittedAt || '-'}</span></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="mark" type="number" min="0" value={r.grade ?? ''} onChange={(e) => setField(r.id, 'grade', e.target.value)} style={{ width: 74 }} />
            <textarea rows={2} placeholder="Feedback" value={r.feedback || ''} onChange={(e) => setField(r.id, 'feedback', e.target.value)} style={{ flex: 1 }} />
            <button className="btn primary sm" onClick={() => save(r)}>Save</button>
          </div>
        </div>
      ))}
    </Modal>
  )
}

function Empty({ children }) {
  return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)' }}>{children}</div>
}
