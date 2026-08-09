import React, { useState, useEffect } from 'react'
import { Tabs, Panel, Badge, Progress, Modal, Toast, useToast, Icon } from '../ui.jsx'
import { COURSES, COURSEWARE, COURSE_RESULTS, DEGREE_AUDIT } from '../data.js'
import * as api from '../api.js'

// One LMS module, role-aware: lecturer manages courseware & grades submissions;
// student downloads materials & submits assignments.
export default function Courseware({ role }) {
  const isTeacher = role.id === 'teacher'
  const me = role.user

  // courses this person can see courseware for
  const codes = Object.keys(COURSEWARE).filter((code) => {
    const c = COURSES.find((x) => x.code === code)
    if (!c) return false
    if (isTeacher) return c.lecturer === me
    const prog = DEGREE_AUDIT[me]?.prog
    const hasResult = (COURSE_RESULTS[code] || []).some((r) => r.learner === me)
    return c.prog === prog || hasResult
  })

  const [active, setActive] = useState(codes[0] || null)
  if (!active) return <Panel title="Courseware"><div className="di-sub">No courses with online material yet.</div></Panel>

  return (
    <>
      {codes.length > 1 && <Tabs tabs={codes} active={active} onChange={setActive} />}
      <CourseView code={active} isTeacher={isTeacher} me={me} />
    </>
  )
}

function CourseView({ code, isTeacher, me }) {
  const c = COURSES.find((x) => x.code === code)
  const cw = COURSEWARE[code]
  const [toast, showToast] = useToast()
  const [subs, setSubs] = useState({})        // assignmentId -> submissions[]
  const [gradeFor, setGradeFor] = useState(null)   // lecturer: assignment being graded
  const [feedbackFor, setFeedbackFor] = useState(null) // student: submission whose feedback is shown

  const loadSubs = () => {
    cw.assignments.forEach((a) =>
      api.listSubmissions(a.id).then((rows) => setSubs((s) => ({ ...s, [a.id]: rows }))).catch(() => {}))
  }
  useEffect(loadSubs, [code])

  const mine = (a) => (subs[a.id] || []).find((s) => s.student === me) || null
  const gradedCount = (a) => (subs[a.id] || []).filter((s) => s.grade != null).length

  const submit = async (a) => {
    await api.submitAssignment({ student: me, assignmentId: a.id })
    showToast(`${a.title} submitted — your lecturer will grade it`)
    loadSubs()
  }

  return (
    <>
      <Panel title={`${code} — ${c?.title}`} subtitle={`${c?.prog} · ${c?.credits} credits · ${c?.lecturer}`}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', margin: '2px 0 8px' }}>MATERIALS</div>
        {cw.materials.map((m) => (
          <div key={m.title} className="cf-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <span><Badge tone="blue">{m.week}</Badge> {m.title} <span className="di-sub">· {m.type}</span></span>
            <button className="btn ghost sm" onClick={() => showToast(isTeacher ? `${m.title} — visible to enrolled students` : `${m.title} downloaded`)}>
              {isTeacher ? 'Manage' : <><Icon name="download" size={14} /> Download</>}
            </button>
          </div>
        ))}
        {isTeacher && (
          <button className="btn primary sm" style={{ marginTop: 12 }} onClick={() => showToast('Upload dialog — new material published to the class')}>+ Upload material</button>
        )}
      </Panel>

      <Panel title="Assignments" flush>
        <table className="data">
          <thead>
            <tr>
              <th>Assignment</th><th>Due</th><th className="num">Points</th>
              <th>{isTeacher ? 'Graded' : 'Status'}</th><th style={{ width: 190 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {cw.assignments.map((a) => {
              const sub = isTeacher ? null : mine(a)
              const total = (subs[a.id] || []).length
              return (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.title}</td>
                  <td>{a.due}</td>
                  <td className="num">{a.points}</td>
                  <td>
                    {isTeacher ? (
                      <span className="mono">{gradedCount(a)}/{total || a.submitted} graded</span>
                    ) : !sub ? (
                      <Badge tone="amber">Not submitted</Badge>
                    ) : sub.grade == null ? (
                      <Badge tone="blue">Awaiting grade</Badge>
                    ) : (
                      <Badge tone="green"><Icon name="tick" size={12} /> {sub.grade}/{a.points}</Badge>
                    )}
                  </td>
                  <td>
                    {isTeacher ? (
                      <button className="btn ghost sm" onClick={() => setGradeFor(a)}>Grade &amp; feedback</button>
                    ) : !sub ? (
                      <button className="btn primary sm" onClick={() => submit(a)}>Submit</button>
                    ) : sub.grade == null ? (
                      <Badge tone="green"><Icon name="tick" size={12} /> Submitted</Badge>
                    ) : (
                      <button className="btn ghost sm" onClick={() => setFeedbackFor({ ...sub, assignment: a })}><Icon name="edit" size={13} /> View feedback</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Panel>

      {gradeFor && (
        <GradeModal assignment={gradeFor} onClose={() => setGradeFor(null)} showToast={showToast} onSaved={loadSubs} />
      )}
      {feedbackFor && (
        <Modal title={`${feedbackFor.assignment.title} — feedback`} onClose={() => setFeedbackFor(null)} width={520}>
          <div className="cf-row" style={{ padding: '4px 0 12px' }}>
            <span>Your mark</span>
            <span className="amt">{feedbackFor.grade}/{feedbackFor.assignment.points}</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', margin: '2px 0 6px' }}>LECTURER FEEDBACK</div>
          <div className="note-banner">
            <Icon name="edit" size={16} />
            <div>{feedbackFor.feedback || 'No written feedback for this submission.'}{feedbackFor.gradedBy ? <div className="di-sub" style={{ marginTop: 6, fontStyle: 'italic' }}>— {feedbackFor.gradedBy}</div> : null}</div>
          </div>
        </Modal>
      )}
      <Toast msg={toast} />
    </>
  )
}

// Lecturer grading sheet — a mark + written feedback per submission, persisted
// through api.gradeSubmission so the student sees it in their Courseware.
function GradeModal({ assignment, onClose, showToast, onSaved }) {
  const [rows, setRows] = useState([])
  useEffect(() => { api.listSubmissions(assignment.id).then(setRows).catch(() => {}) }, [assignment.id])
  const setField = (id, k, v) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [k]: v } : r)))
  const save = async (r) => {
    const g = r.grade === '' || r.grade == null ? null : Number(r.grade)
    if (g != null && (g < 0 || g > assignment.points || Number.isNaN(g))) { showToast(`Mark must be 0–${assignment.points}`); return }
    await api.gradeSubmission({ id: r.id, assignmentId: assignment.id, grade: g, feedback: r.feedback || '', gradedBy: 'Tobias Shikongo' })
    showToast(`Saved — ${r.student}`)
    onSaved && onSaved()
  }
  return (
    <Modal title={`Grade — ${assignment.title} (/${assignment.points})`} onClose={onClose} width={660}>
      {rows.length === 0 && <div className="di-sub">No submissions yet.</div>}
      {rows.map((r) => (
        <div key={r.id} style={{ borderBottom: '1px solid var(--line)', padding: '10px 0' }}>
          <div className="cf-row" style={{ marginBottom: 6 }}>
            <strong>{r.student}</strong>
            <span className="di-sub">submitted {r.submittedAt}{r.gradedBy ? ' · graded' : ''}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <input className="mark" type="number" min="0" max={assignment.points} placeholder={`/${assignment.points}`}
              value={r.grade ?? ''} onChange={(e) => setField(r.id, 'grade', e.target.value)} style={{ width: 74 }} />
            <textarea rows={2} placeholder="Feedback to the student…" value={r.feedback || ''}
              onChange={(e) => setField(r.id, 'feedback', e.target.value)} style={{ flex: 1 }} />
            <button className="btn primary sm" onClick={() => save(r)}>Save</button>
          </div>
        </div>
      ))}
    </Modal>
  )
}
