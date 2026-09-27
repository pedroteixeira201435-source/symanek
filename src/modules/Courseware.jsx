import React, { useCallback, useEffect, useState } from 'react'
import { Tabs, Panel, Badge, Modal, Toast, useToast, Icon } from '../ui.jsx'
import {
  listMyCourses, listStudentCourses, listCourseware, coursewareUpsert, coursewareDelete,
  listAssignments, assignmentUpsert, assignmentDelete, listSubmissions, submitAssignment, gradeSubmission,
  uploadCourseFile, courseFileUrl,
} from '../api.js'

// Courseware (LMS). Lecturer: publish materials, set assignments, grade with
// feedback. Student: download materials, submit work, read the grade/feedback.
// Files live in the private 'course-files' bucket and open via short-lived links.
export default function Courseware({ role }) {
  const isTeacher = role.id === 'teacher'
  const [courses, setCourses] = useState([])
  const [code, setCode] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(isTeacher ? listMyCourses() : listStudentCourses()).then((rows) => {
      if (!alive) return
      setCourses(rows); setCode(rows[0]?.code || null)
    }).catch(() => setCourses([])).finally(() => setLoading(false))
    return () => { alive = false }
  }, [isTeacher])

  if (loading) return <Panel title="Courseware" flush><Empty>Loading…</Empty></Panel>
  if (courses.length === 0) return (
    <Panel title="Courseware"><Empty>{isTeacher ? 'No modules are allocated to you yet.' : 'You are not enrolled on any module yet.'}</Empty></Panel>
  )
  const current = courses.find((c) => c.code === code) || courses[0]
  return (
    <>
      <Panel title="Module" flush actions={
        <select className="inline" value={current.code} onChange={(e) => setCode(e.target.value)}>
          {courses.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.title}</option>)}
        </select>
      } />
      <CourseView key={current.code} course={current} isTeacher={isTeacher} />
    </>
  )
}

async function openFile(path, showToast) {
  try { const url = await courseFileUrl(path); if (url) window.open(url, '_blank', 'noopener') }
  catch (err) { showToast('Could not open file' + (err?.message ? `: ${err.message}` : '')) }
}
const fileName = (path) => (path || '').split('/').pop().replace(/^\d+-/, '')
const fmtDate = (d) => (d ? String(d).slice(0, 10) : '-')

function CourseView({ course, isTeacher }) {
  const [tab, setTab] = useState('Materials')
  const [toast, showToast] = useToast()
  return (
    <>
      <div className="note-banner"><Icon name="book" size={16} /><div><strong>{course.code} — {course.title}</strong>{course.lecturer ? <> · Lecturer: {course.lecturer}</> : null}</div></div>
      <Tabs tabs={['Materials', 'Assignments']} active={tab} onChange={setTab} />
      {tab === 'Materials' && <Materials course={course} isTeacher={isTeacher} showToast={showToast} />}
      {tab === 'Assignments' && <Assignments course={course} isTeacher={isTeacher} showToast={showToast} />}
      <Toast msg={toast} />
    </>
  )
}

// ---------------------------------------------------------------- materials
function Materials({ course, isTeacher, showToast }) {
  const [items, setItems] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [busy, setBusy] = useState(false)
  const reload = useCallback(() => listCourseware(course.id).then(setItems).catch(() => setItems([])), [course.id])
  useEffect(() => { reload() }, [reload])

  const save = async (e) => {
    e.preventDefault(); const f = e.target
    const file = f.file.files?.[0] || null; const url = f.url.value.trim()
    if (!file && !url) { showToast('Attach a file or paste a link'); return }
    setBusy(true)
    try {
      const filePath = file ? await uploadCourseFile(`materials/${course.id}`, file) : null
      await coursewareUpsert({ courseId: course.id, title: f.title.value.trim(), url: url || null, filePath })
      setShowNew(false); await reload(); showToast('Material published')
    } catch (err) { showToast('Could not save: ' + (err?.message || err)) }
    finally { setBusy(false) }
  }
  const remove = async (item) => {
    if (!window.confirm(`Delete "${item.title}"?`)) return
    try { await coursewareDelete(item.id); await reload(); showToast('Material deleted') }
    catch (err) { showToast('Could not delete: ' + (err?.message || err)) }
  }

  return (
    <Panel title="Materials" subtitle={`${items.length} item${items.length === 1 ? '' : 's'}`}
      actions={isTeacher && <button className="btn primary sm" onClick={() => setShowNew(true)}>+ Add material</button>} flush>
      {items.length === 0 ? <Empty>No materials yet.</Empty> : (
        <table className="data"><thead><tr><th>Title</th><th>Added</th><th style={{ width: 200 }}></th></tr></thead>
          <tbody>{items.map((m) => (
            <tr key={m.id}>
              <td style={{ fontWeight: 600 }}>{m.title}{m.file_path && <div className="di-sub">{fileName(m.file_path)}</div>}</td>
              <td className="mono">{fmtDate(m.created_at)}</td>
              <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                {m.file_path && <button className="btn ghost sm" onClick={() => openFile(m.file_path, showToast)}><Icon name="download" size={14} /> File</button>}{' '}
                {m.url && <a className="btn ghost sm" href={m.url} target="_blank" rel="noopener noreferrer">Link</a>}{' '}
                {isTeacher && <button className="btn ghost sm" onClick={() => remove(m)}>Delete</button>}
              </td>
            </tr>
          ))}</tbody>
        </table>
      )}
      {showNew && <Modal title="Add material" onClose={() => setShowNew(false)}>
        <form onSubmit={save}>
          <div className="field"><label>Title</label><input name="title" required placeholder="e.g. Week 3 — Infection control notes" /></div>
          <div className="field"><label>File (PDF, Word, PowerPoint, image — max 25 MB)</label><input name="file" type="file" /></div>
          <div className="field"><label>Or a link</label><input name="url" type="url" placeholder="https://…" /></div>
          <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Uploading…' : 'Publish'}</button>
        </form>
      </Modal>}
    </Panel>
  )
}

// ---------------------------------------------------------------- assignments
function Assignments({ course, isTeacher, showToast }) {
  const [items, setItems] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [gradeFor, setGradeFor] = useState(null)
  const [submitFor, setSubmitFor] = useState(null)
  const [busy, setBusy] = useState(false)
  const reload = useCallback(() => listAssignments(course.id).then(setItems).catch(() => setItems([])), [course.id])
  useEffect(() => { reload() }, [reload])

  const create = async (e) => {
    e.preventDefault(); const f = e.target
    setBusy(true)
    try {
      await assignmentUpsert({
        courseId: course.id, title: f.title.value.trim(), description: f.description.value.trim(),
        due: f.due.value || null, maxMarks: f.max.value, file: f.file.files?.[0] || null,
      })
      setShowNew(false); await reload(); showToast('Assignment published')
    } catch (err) { showToast('Could not save: ' + (err?.message || err)) }
    finally { setBusy(false) }
  }
  const remove = async (a) => {
    if (!window.confirm(`Delete "${a.title}" and all its submissions?`)) return
    try { await assignmentDelete(a.id); await reload(); showToast('Assignment deleted') }
    catch (err) { showToast('Could not delete: ' + (err?.message || err)) }
  }
  const today = new Date().toISOString().slice(0, 10)
  const statusOf = (a) => {
    if (!a.mine) return a.due && a.due < today ? <Badge tone="red">Overdue</Badge> : <Badge tone="amber">Not submitted</Badge>
    if (a.mine.gradedAt) return <Badge tone="green">Graded {a.mine.grade}/{a.maxMarks}</Badge>
    return <Badge tone="blue">Submitted</Badge>
  }

  return (
    <Panel title="Assignments" subtitle={`${items.length} set`}
      actions={isTeacher && <button className="btn primary sm" onClick={() => setShowNew(true)}>+ New assignment</button>} flush>
      {items.length === 0 ? <Empty>No assignments yet.</Empty> : items.map((a) => (
        <div key={a.id} style={{ padding: '12px 4px', borderBottom: '1px solid var(--line)' }}>
          <div className="cf-row" style={{ alignItems: 'flex-start' }}>
            <div>
              <strong>{a.title}</strong> <span className="di-sub">· due {fmtDate(a.due)} · {a.maxMarks} marks</span>
              {a.description && <div className="di-sub" style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{a.description}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {a.filePath && <button className="btn ghost sm" onClick={() => openFile(a.filePath, showToast)}><Icon name="download" size={14} /> Brief</button>}
              {isTeacher ? (
                <>
                  <button className="btn primary sm" onClick={() => setGradeFor(a)}>Submissions ({a.submissions ?? 0}{a.submissions ? `, ${a.graded} graded` : ''})</button>
                  <button className="btn ghost sm" onClick={() => remove(a)}>Delete</button>
                </>
              ) : (
                <>
                  {statusOf(a)}
                  {!a.mine?.gradedAt && <button className="btn primary sm" onClick={() => setSubmitFor(a)}>{a.mine ? 'Resubmit' : 'Submit'}</button>}
                </>
              )}
            </div>
          </div>
          {!isTeacher && a.mine && (
            <div className="note-banner" style={{ marginTop: 8 }}>
              <Icon name={a.mine.gradedAt ? 'check' : 'clock'} size={16} />
              <div>
                Submitted {fmtDate(a.mine.submittedAt)}
                {a.mine.filePath && <> · <a href="#" onClick={(e) => { e.preventDefault(); openFile(a.mine.filePath, showToast) }}>{fileName(a.mine.filePath)}</a></>}
                {a.mine.gradedAt && <div style={{ marginTop: 4 }}><strong>Mark: {a.mine.grade}/{a.maxMarks}</strong>{a.mine.feedback && <div style={{ whiteSpace: 'pre-wrap' }}>Feedback: {a.mine.feedback}</div>}</div>}
              </div>
            </div>
          )}
        </div>
      ))}

      {showNew && <Modal title="New assignment" onClose={() => setShowNew(false)}>
        <form onSubmit={create}>
          <div className="field"><label>Title</label><input name="title" required /></div>
          <div className="field"><label>Instructions</label><textarea name="description" rows={4} /></div>
          <div className="grid2" style={{ gap: 12 }}>
            <div className="field"><label>Due date</label><input name="due" type="date" /></div>
            <div className="field"><label>Total marks</label><input name="max" type="number" min="1" defaultValue="100" /></div>
          </div>
          <div className="field"><label>Brief / worksheet (optional, max 25 MB)</label><input name="file" type="file" /></div>
          <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Publishing…' : 'Publish'}</button>
        </form>
      </Modal>}
      {submitFor && <SubmitModal assignment={submitFor} onClose={() => setSubmitFor(null)} onDone={async () => { setSubmitFor(null); await reload() }} showToast={showToast} />}
      {gradeFor && <GradeModal assignment={gradeFor} onClose={async () => { setGradeFor(null); await reload() }} showToast={showToast} />}
    </Panel>
  )
}

function SubmitModal({ assignment, onClose, onDone, showToast }) {
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); const f = e.target
    const file = f.file.files?.[0] || null; const note = f.note.value.trim()
    if (!file && !note) { showToast('Attach your work or write your answer'); return }
    setBusy(true)
    try { await submitAssignment({ assignmentId: assignment.id, file, note }); showToast('Submitted'); await onDone() }
    catch (err) { showToast('Could not submit: ' + (err?.message || err)) }
    finally { setBusy(false) }
  }
  return (
    <Modal title={`Submit — ${assignment.title}`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field"><label>Your work (max 25 MB)</label><input name="file" type="file" /></div>
        <div className="field"><label>Comment or answer (optional)</label><textarea name="note" rows={4} defaultValue={assignment.mine?.note || ''} /></div>
        {assignment.mine && <div className="note-banner" style={{ marginBottom: 12 }}>This replaces your earlier submission.</div>}
        <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Uploading…' : 'Submit'}</button>
      </form>
    </Modal>
  )
}

function GradeModal({ assignment, onClose, showToast }) {
  const [rows, setRows] = useState(null)
  useEffect(() => { listSubmissions(assignment.id).then(setRows).catch(() => setRows([])) }, [assignment.id])
  const setField = (id, k, v) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [k]: v } : r)))
  const save = async (r) => {
    try {
      await gradeSubmission({ id: r.id, assignmentId: assignment.id, grade: r.grade === '' || r.grade == null ? null : Number(r.grade), feedback: r.feedback || '' })
      setField(r.id, 'gradedAt', new Date().toISOString()); showToast(`Saved — ${r.student}`)
    } catch (err) { showToast('Could not save: ' + (err?.message || err)) }
  }
  return (
    <Modal title={`Submissions — ${assignment.title}`} onClose={onClose} width={720}>
      {rows === null ? <Empty>Loading…</Empty> : rows.length === 0 ? <Empty>No submissions yet.</Empty> : rows.map((r) => (
        <div key={r.id} style={{ borderBottom: '1px solid var(--line)', padding: '10px 0' }}>
          <div className="cf-row" style={{ marginBottom: 6 }}>
            <strong>{r.student} <span className="di-sub mono">{r.studentNo || ''}</span></strong>
            <span className="di-sub">submitted {fmtDate(r.submittedAt)} {r.gradedAt && <Badge tone="green">Graded</Badge>}</span>
          </div>
          {(r.filePath || r.note) && <div className="di-sub" style={{ marginBottom: 6 }}>
            {r.filePath && <button className="btn ghost sm" onClick={() => openFile(r.filePath, showToast)}><Icon name="download" size={14} /> {fileName(r.filePath)}</button>}
            {r.note && <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{r.note}</div>}
          </div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="mark" type="number" min="0" max={assignment.maxMarks} value={r.grade ?? ''} onChange={(e) => setField(r.id, 'grade', e.target.value)} style={{ width: 74 }} title={`out of ${assignment.maxMarks}`} />
            <textarea rows={2} placeholder="Feedback to the student" value={r.feedback || ''} onChange={(e) => setField(r.id, 'feedback', e.target.value)} style={{ flex: 1 }} />
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
