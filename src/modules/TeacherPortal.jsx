import React, { useState, useEffect } from 'react'
import { Tabs, Panel, Toast, useToast, Badge, Icon, Modal } from '../ui.jsx'
import { fmtN } from '../lib/format.js'
import { gradeOf } from '../lib/academics.js'
import { evaluateResult, POLICY_SUMMARY } from '../lib/academics.js'
import * as api from '../api.js'

// Lecturer workspace — marks capture (CA + exam → final → exam board), the class
// board (announcements) and student queries. All backed by real RPCs; empty by
// default until courses and marks exist.
export default function TeacherPortal() {
  const [tab, setTab] = useState('My Courses')
  return (
    <>
      <Tabs tabs={['My Courses', 'Class Board', 'Student Queries']} active={tab} onChange={setTab} />
      {tab === 'My Courses' && <MyCourses />}
      {tab === 'Class Board' && <ClassBoard />}
      {tab === 'Student Queries' && <StudentQueries />}
    </>
  )
}

function Empty({ children }) { return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)' }}>{children}</div> }

function MyCourses() {
  const [courses, setCourses] = useState([])
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api.listCourses().then((cs) => { setCourses(cs); if (cs.length) setCode(cs[0].code) }).catch(() => setCourses([])).finally(() => setLoading(false))
  }, [])
  const course = courses.find((c) => c.code === code)
  if (loading) return <Panel title="My courses" flush><Empty>Loading…</Empty></Panel>
  return (
    <>
      <div className="note-banner">
        <Icon name="info" size={16} />
        <div>{POLICY_SUMMARY} Save marks (students see them as provisional); submit to the exam board to publish final grades.</div>
      </div>
      {courses.length === 0 ? (
        <Panel title="My courses" flush><Empty>No courses yet.</Empty></Panel>
      ) : (
        <Panel title="Select a course" flush actions={
          <select className="inline" value={code} onChange={(e) => setCode(e.target.value)}>
            {courses.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.title}</option>)}
          </select>
        }>
          {course && <CourseMarks course={course} />}
        </Panel>
      )}
    </>
  )
}

function CourseMarks({ course }) {
  const [rows, setRows] = useState([])
  const [dirty, setDirty] = useState(false)
  const [published, setPublished] = useState(false)
  const [toast, showToast] = useToast()

  const load = () => api.getCourseResults(course.code).then((rs) => {
    setRows((rs || []).map((r) => ({ ...r })))
    setPublished(rs && rs.length > 0 && rs.every((r) => r.published))
  }).catch(() => setRows([]))
  useEffect(() => { load() }, [course.code])

  const setMark = (learner, k, v) => { setRows((rs) => rs.map((r) => (r.learner === learner ? { ...r, [k]: v === '' ? '' : Number(v) } : r))); setDirty(true) }
  const payload = () => rows.map((r) => ({ learner: r.learner, student_id: r.student_id, ca: Number(r.ca) || 0, exam: Number(r.exam) || 0 }))
  const save = async () => { try { await api.saveCourseMarks(course.code, payload()); setDirty(false); showToast(`${course.code} marks saved (provisional)`) } catch (e) { showToast('Could not save' + (e?.message ? `: ${e.message}` : '')) } }
  const publish = async () => {
    try { if (dirty) await api.saveCourseMarks(course.code, payload()); await api.publishCourseResults(course.code); setPublished(true); setDirty(false); showToast(`${course.code} published`) }
    catch (e) { showToast('Could not publish' + (e?.message ? `: ${e.message}` : '')) }
  }

  const evald = rows.map((r) => evaluateResult({ ca: Number(r.ca) || 0, exam: Number(r.exam) || 0 }))
  const avg = rows.length ? Math.round(evald.reduce((s, e) => s + e.final, 0) / rows.length) : 0
  const passRate = rows.length ? Math.round((evald.filter((e) => e.final >= 50).length / rows.length) * 100) : 0

  return (
    <Panel
      title={`${course.code} — ${course.title}`}
      subtitle={`${rows.length} registered${rows.length ? ` · avg ${avg}% · pass ${passRate}%` : ''}`}
      actions={published ? <Badge tone="green"><Icon name="tick" size={12} /> Published</Badge> : rows.length ? (
        <span style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost sm" onClick={save} disabled={!dirty}>Save marks</button>
          <button className="btn primary sm" onClick={publish}>Submit to exam board</button>
        </span>
      ) : null}
      flush
    >
      {rows.length === 0 ? <Empty>No registered students on this course yet.</Empty> : (
        <table className="data">
          <thead><tr><th>Student</th><th className="num">CA (60%)</th><th className="num">Exam (40%)</th><th className="num">Final</th><th>Grade</th><th>Result</th></tr></thead>
          <tbody>
            {rows.map((r, i) => {
              const res = evald[i]; const g = gradeOf(res.final)
              return (
                <tr key={r.learner}>
                  <td style={{ fontWeight: 600 }}>{r.learner}</td>
                  <td className="num">{published ? r.ca : <input className="mark" type="number" min="0" max="100" value={r.ca} onChange={(e) => setMark(r.learner, 'ca', e.target.value)} />}</td>
                  <td className="num">{published ? r.exam : <input className="mark" type="number" min="0" max="100" value={r.exam} onChange={(e) => setMark(r.learner, 'exam', e.target.value)} />}</td>
                  <td className="num" style={{ fontWeight: 700, color: res.final < 50 ? 'var(--red)' : 'var(--ink)' }}>{res.final}%</td>
                  <td className="mono" style={{ fontWeight: 600 }}>{g.letter}</td>
                  <td><Badge tone={res.tone} title={res.reasons.join(' · ')}>{res.label}</Badge></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <Toast msg={toast} />
    </Panel>
  )
}

function StudentQueries() {
  const [rows, setRows] = useState([])
  const [replyFor, setReplyFor] = useState(null)
  const [toast, showToast] = useToast()
  const load = () => api.listQueries({}).then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([]))
  useEffect(() => { load() }, [])
  const send = async (q, text) => {
    if (!text.trim()) { showToast('Write a reply first'); return }
    try { await api.replyQuery({ id: q.id, reply: text }); showToast(`Replied to ${q.student}`); setReplyFor(null); load() }
    catch (e) { showToast('Could not send' + (e?.message ? `: ${e.message}` : '')) }
  }
  const open = rows.filter((q) => q.status === 'open').length
  return (
    <>
      <div className="note-banner"><Icon name="info" size={16} /><div>Questions your students raise land here. {open ? <strong>{open} awaiting a reply.</strong> : 'All caught up.'}</div></div>
      <Panel title="Student queries" flush>
        {rows.length === 0 ? <Empty>No queries yet.</Empty> : (
          <table className="data">
            <thead><tr><th>Student</th><th>Course</th><th>Subject</th><th>Status</th><th style={{ width: 130 }}>Action</th></tr></thead>
            <tbody>
              {rows.map((q) => (
                <tr key={q.id}>
                  <td style={{ fontWeight: 600 }}>{q.student}</td><td>{q.course}</td>
                  <td>{q.subject}<div className="di-sub">{q.body}</div></td>
                  <td><Badge tone={q.status === 'open' ? 'amber' : 'green'}>{q.status === 'open' ? 'Open' : 'Answered'}</Badge></td>
                  <td><button className={`btn ${q.status === 'open' ? 'primary' : 'ghost'} sm`} onClick={() => setReplyFor(q)}>{q.status === 'open' ? 'Reply' : 'View'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      {replyFor && <ReplyModal query={replyFor} onClose={() => setReplyFor(null)} onSend={send} />}
      <Toast msg={toast} />
    </>
  )
}

function ReplyModal({ query, onClose, onSend }) {
  const [text, setText] = useState(query.reply || '')
  return (
    <Modal title={`Reply — ${query.student}`} onClose={onClose} width={560}>
      <div className="note-banner"><Icon name="edit" size={16} /><div><strong>{query.subject}</strong> <span className="di-sub">· {query.course}</span><div className="di-sub" style={{ marginTop: 4 }}>{query.body}</div></div></div>
      <div className="field" style={{ marginTop: 12 }}><label>Your reply</label><textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Answer the student…" /></div>
      <button className="btn primary" onClick={() => onSend(query, text)}>Send reply</button>
    </Modal>
  )
}

function ClassBoard() {
  const [toast, showToast] = useToast()
  const [board, setBoard] = useState([])
  const [busy, setBusy] = useState(false)
  const refresh = () => api.listAnnouncements('students').then((rows) => setBoard(Array.isArray(rows) ? rows : [])).catch(() => setBoard([]))
  useEffect(() => { refresh() }, [])
  const submit = async (e) => {
    e.preventDefault(); const f = e.target
    const title = f.title.value.trim(); const body = f.body.value.trim()
    if (!title || !body) { showToast('Add a title and a message first'); return }
    setBusy(true)
    try { await api.createAnnouncement({ title, body, audience: f.audience.value }); showToast('Announcement posted'); f.reset(); await refresh() }
    catch { showToast('Could not post the announcement') } finally { setBusy(false) }
  }
  return (
    <>
      <div className="note-banner"><Icon name="send" size={16} /><div>Notices you post appear in every student's <strong>Announcements</strong>.</div></div>
      <div className="grid2">
        <Panel title="Post a notice" subtitle="Delivered to the student portal">
          <form onSubmit={submit}>
            <div className="field"><label>Title</label><input name="title" placeholder="e.g. CA3 marks released" maxLength={90} /></div>
            <div className="field"><label>Message</label><textarea name="body" rows={4} placeholder="Write the notice…" /></div>
            <div className="field"><label>Audience</label><select name="audience"><option value="students">All students</option><option value="all">Whole college</option></select></div>
            <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Posting…' : 'Post announcement'}</button>
          </form>
        </Panel>
        <Panel title="Live student board" subtitle="What students currently see" flush>
          <div style={{ padding: 4 }}>
            {board.length === 0 && <Empty>No announcements yet.</Empty>}
            {board.map((a) => (
              <div key={a.id} className="note-banner" style={{ marginBottom: 10 }}>
                <Icon name={a.pinned ? 'pin' : 'send'} size={16} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong>{a.title}</strong><span className="di-sub">{a.created_at || ''}</span></div>
                  <div className="di-sub" style={{ marginTop: 2 }}>{a.body}</div>
                  {a.author && <div className="di-sub" style={{ marginTop: 4, fontStyle: 'italic' }}>— {a.author}</div>}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Toast msg={toast} />
    </>
  )
}

// eslint-disable-next-line no-unused-vars
const _keepFmt = fmtN
