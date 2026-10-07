import React, { useCallback, useEffect, useState } from 'react'
import { Panel, Badge, Modal, Toast, useToast, Icon } from '../ui.jsx'
import * as api from '../api.js'

// Tests, quizzes & other assessments per module. The lecturer defines each
// assessment (out of N marks, with a weight) and records one mark per student.
// The gradebook also shows graded assignments and a computed CA %, which can be
// copied into the marksheet's CA column (Marks tab). Backed by assessment_* RPCs.
const KINDS = { test: 'Test', quiz: 'Quiz', practical: 'Practical', presentation: 'Presentation', other: 'Other' }

function Empty({ children }) { return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)' }}>{children}</div> }

export function AssessmentsTab({ course }) {
  const [toast, showToast] = useToast()
  const [book, setBook] = useState({ assessments: [], students: [] })
  const [edit, setEdit] = useState(null)      // assessment being created/edited
  const [marksFor, setMarksFor] = useState(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(() => api.getCourseGradebook(course.id).then(setBook).catch(() => setBook({ assessments: [], students: [] })).finally(() => setLoading(false)), [course.id])
  useEffect(() => { setLoading(true); load() }, [load])

  const remove = async (a) => {
    if (!window.confirm(`Delete "${a.title}" and all its marks?`)) return
    try { await api.assessmentDelete(a.id); showToast('Assessment deleted'); load() } catch (e) { showToast('Could not delete: ' + (e?.message || e)) }
  }
  const cols = book.assessments

  return (
    <>
      <div className="note-banner">
        <Icon name="info" size={16} />
        <div>Create each <strong>test, quiz or practical</strong> here, then enter the students' marks. Graded assignments appear automatically. The <strong>CA %</strong> is the weighted average of everything marked so far — copy it into the Marks tab with “Fill CA from assessments”.</div>
      </div>
      <Panel title={`Assessments — ${course.code}`} subtitle={cols.length ? `${cols.length} in the gradebook` : undefined}
        actions={<button className="btn primary sm" onClick={() => setEdit({})}>+ New test / quiz</button>} flush>
        {loading ? <Empty>Loading…</Empty> : cols.length === 0 ? <Empty>No assessments yet. Click “New test / quiz” to create the first one.</Empty> : (
          <table className="data">
            <thead><tr><th>Assessment</th><th>Type</th><th>Date</th><th className="num">Out of</th><th className="num">Weight</th><th className="num">Marked</th><th style={{ width: 210 }}>Action</th></tr></thead>
            <tbody>{cols.map((a) => {
              const marked = book.students.filter((s) => s.marks && s.marks[a.id] != null).length
              return (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.title}</td>
                  <td>{a.source === 'assignment' ? <Badge tone="blue">Assignment</Badge> : <Badge tone="gray">{KINDS[a.kind] || a.kind}</Badge>}</td>
                  <td className="mono">{a.date || '—'}</td>
                  <td className="num">{a.max}</td>
                  <td className="num">{a.weight}</td>
                  <td className="num">{marked}/{book.students.length}</td>
                  <td>{a.source === 'assessment'
                    ? <span style={{ display: 'flex', gap: 6 }}>
                        <button className="btn primary sm" onClick={() => setMarksFor(a)}>Enter marks</button>
                        <button className="btn ghost sm" onClick={() => setEdit(a)}>Edit</button>
                        <button className="btn ghost sm" onClick={() => remove(a)}>Delete</button>
                      </span>
                    : <span className="di-sub">Graded in Courseware</span>}</td>
                </tr>
              )
            })}</tbody>
          </table>
        )}
      </Panel>

      {cols.length > 0 && book.students.length > 0 && (
        <Panel title="Gradebook" subtitle="Percentages per student; not-yet-marked counts as 0 once an assessment has marks" flush>
          <div style={{ overflowX: 'auto' }}>
            <table className="data">
              <thead><tr><th>Student</th>{cols.map((a) => <th key={a.id} className="num" title={a.title}>{a.title.length > 14 ? a.title.slice(0, 13) + '…' : a.title}<div className="di-sub">/{a.max}</div></th>)}<th className="num">CA %</th></tr></thead>
              <tbody>{book.students.map((s) => (
                <tr key={s.student_id}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  {cols.map((a) => <td key={a.id} className="num">{s.marks?.[a.id] ?? '—'}</td>)}
                  <td className="num" style={{ fontWeight: 700 }}>{s.ca == null ? '—' : `${s.ca}%`}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Panel>
      )}

      {edit && <AssessmentModal course={course} item={edit} onClose={() => setEdit(null)} onDone={(msg) => { setEdit(null); showToast(msg); load() }} showToast={showToast} />}
      {marksFor && <MarksModal assessment={marksFor} students={book.students} onClose={() => setMarksFor(null)} onDone={(msg) => { setMarksFor(null); showToast(msg); load() }} showToast={showToast} />}
      <Toast msg={toast} />
    </>
  )
}

function AssessmentModal({ course, item, onClose, onDone, showToast }) {
  const [f, setF] = useState({ title: item.title || '', kind: item.kind || 'test', max: item.max ?? 100, weight: item.weight ?? 1, date: item.date || new Date().toISOString().slice(0, 10) })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const save = async (e) => {
    e.preventDefault()
    if (!f.title.trim()) { showToast('Give the assessment a title'); return }
    setBusy(true)
    try { await api.assessmentUpsert({ id: item.id || null, courseId: course.id, title: f.title, kind: f.kind, max: f.max, weight: f.weight, date: f.date }); onDone(item.id ? 'Assessment updated' : 'Assessment created — now enter the marks') }
    catch (err) { showToast('Could not save: ' + (err?.message || err)); setBusy(false) }
  }
  return (
    <Modal title={item.id ? 'Edit assessment' : 'New test / quiz'} onClose={onClose} width={480}>
      <form onSubmit={save}>
        <div className="field"><label>Title</label><input value={f.title} onChange={set('title')} placeholder="e.g. Test 1 — Safety signs" maxLength={120} autoFocus /></div>
        <div className="grid2">
          <div className="field"><label>Type</label><select value={f.kind} onChange={set('kind')}>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="field"><label>Date</label><input type="date" value={f.date} onChange={set('date')} /></div>
          <div className="field"><label>Out of (max marks)</label><input type="number" min="1" step="any" value={f.max} onChange={set('max')} /></div>
          <div className="field"><label>Weight in CA</label><input type="number" min="0.1" step="any" value={f.weight} onChange={set('weight')} /></div>
        </div>
        <div className="di-sub" style={{ marginBottom: 10 }}>Weight 1 on every assessment = they count equally. Give a test weight 2 to make it count double.</div>
        <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </form>
    </Modal>
  )
}

function MarksModal({ assessment, students, onClose, onDone, showToast }) {
  const [vals, setVals] = useState(() => Object.fromEntries(students.map((s) => [s.student_id, s.marks?.[assessment.id] ?? ''])))
  const [busy, setBusy] = useState(false)
  const save = async () => {
    for (const s of students) {
      const v = vals[s.student_id]
      if (v !== '' && (Number(v) < 0 || Number(v) > assessment.max)) { showToast(`${s.name}: mark must be between 0 and ${assessment.max}`); return }
    }
    setBusy(true)
    try { await api.assessmentSaveMarks(assessment.id, students.map((s) => ({ studentId: s.student_id, mark: vals[s.student_id] }))); onDone(`${assessment.title}: marks saved`) }
    catch (err) { showToast('Could not save: ' + (err?.message || err)); setBusy(false) }
  }
  const done = students.filter((s) => vals[s.student_id] !== '').length
  return (
    <Modal title={`Marks — ${assessment.title}`} onClose={onClose} width={560}>
      <div className="di-sub" style={{ marginBottom: 8 }}>Out of {assessment.max} · {done}/{students.length} entered · leave blank if the student did not write it.</div>
      <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
        <table className="data">
          <thead><tr><th>Student</th><th className="num" style={{ width: 110 }}>Mark /{assessment.max}</th></tr></thead>
          <tbody>{students.map((s) => (
            <tr key={s.student_id}>
              <td style={{ fontWeight: 600 }}>{s.name}</td>
              <td className="num"><input className="mark" type="number" min="0" max={assessment.max} step="any" value={vals[s.student_id]} onChange={(e) => setVals((v) => ({ ...v, [s.student_id]: e.target.value }))} /></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div style={{ marginTop: 12 }}><button className="btn primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save marks'}</button></div>
    </Modal>
  )
}

// Student: own test/quiz marks.
export function MyAssessments() {
  const [items, setItems] = useState(null)
  useEffect(() => { api.listMyAssessments().then(setItems).catch(() => setItems([])) }, [])
  return (
    <Panel title="My test & quiz marks" subtitle="Recorded by your lecturers during the semester" flush>
      {items === null ? <Empty>Loading…</Empty> : items.length === 0 ? <Empty>No test or quiz marks have been recorded for you yet.</Empty> : (
        <table className="data">
          <thead><tr><th>Module</th><th>Assessment</th><th>Date</th><th className="num">Mark</th><th className="num">%</th></tr></thead>
          <tbody>{items.map((a, i) => {
            const pct = Math.round((Number(a.mark) / Number(a.max_marks)) * 100)
            return (
              <tr key={i}>
                <td><span className="mono">{a.code}</span> <span className="di-sub">{a.course_title}</span></td>
                <td style={{ fontWeight: 600 }}>{a.title} <Badge tone="gray">{KINDS[a.kind] || a.kind}</Badge></td>
                <td className="mono">{a.assessed_on || '—'}</td>
                <td className="num">{a.mark}/{a.max_marks}</td>
                <td className="num" style={{ fontWeight: 700, color: pct < 50 ? 'var(--red)' : 'var(--ink)' }}>{pct}%</td>
              </tr>
            )
          })}</tbody>
        </table>
      )}
    </Panel>
  )
}
