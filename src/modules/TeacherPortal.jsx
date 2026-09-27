import React, { useState, useEffect, useCallback } from 'react'
import { Tabs, Panel, Toast, useToast, Badge, Icon, Modal } from '../ui.jsx'
import { fmtN } from '../lib/format.js'
import { gradeOf } from '../lib/academics.js'
import { evaluateResult, POLICY_SUMMARY } from '../lib/academics.js'
import { ATTENDANCE_MIN } from '../lib/controls.js'
import * as api from '../api.js'

// Lecturer workspace — marks capture (CA + exam → final → exam board), the class
// board (announcements) and student queries. All backed by real RPCs; empty by
// default until courses and marks exist.
export default function TeacherPortal() {
  const [tab, setTab] = useState('Marks')
  const [courses, setCourses] = useState([])
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api.listMyCourses().then((cs) => { setCourses(cs); if (cs.length) setCode(cs[0].code) }).catch(() => setCourses([])).finally(() => setLoading(false))
  }, [])
  const course = courses.find((c) => c.code === code)
  if (loading) return <Panel title="My courses" flush><Empty>Loading…</Empty></Panel>
  return (
    <>
      <Panel title="My modules" subtitle={courses.length ? `${courses.length} allocated to you` : undefined} actions={courses.length > 0 && (
        <select className="inline" value={code} onChange={(e) => setCode(e.target.value)}>
          {courses.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.title} ({c.enrolled})</option>)}
        </select>
      )} flush>
        {courses.length === 0 && <Empty>No modules are allocated to you yet. Ask the registrar to allocate your modules.</Empty>}
      </Panel>
      <Tabs tabs={['Marks', 'Attendance', 'Class Board', 'Student Queries']} active={tab} onChange={setTab} />
      {tab === 'Marks' && (course ? <MarksTab course={course} /> : <NoCourse />)}
      {tab === 'Attendance' && (course ? <AttendanceTab course={course} /> : <NoCourse />)}
      {tab === 'Class Board' && (course ? <ClassBoard course={course} /> : <NoCourse />)}
      {tab === 'Student Queries' && <StudentQueries />}
    </>
  )
}

function Empty({ children }) { return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)' }}>{children}</div> }
function NoCourse() { return <Panel title="No module selected"><Empty>Select one of your modules above.</Empty></Panel> }

function MarksTab({ course }) {
  return (
    <>
      <div className="note-banner">
        <Icon name="info" size={16} />
        <div>{POLICY_SUMMARY} Save marks (students see them as provisional); submit to the exam board to publish final grades.</div>
      </div>
      <CourseMarks key={course.code} course={course} />
    </>
  )
}

// Attendance register: one session per date; re-saving a date replaces it.
function AttendanceTab({ course }) {
  const [toast, showToast] = useToast()
  const [rows, setRows] = useState([])
  const [sessions, setSessions] = useState([])
  const [present, setPresent] = useState({})
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [hours, setHours] = useState(1)
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => Promise.all([
    api.getCourseRegister(course.code).then((rs) => { setRows(rs); setPresent(Object.fromEntries(rs.map((r) => [r.studentId, true]))) }).catch(() => setRows([])),
    api.listAttendanceSessions(course.code).then(setSessions).catch(() => setSessions([])),
  ]), [course.code])
  useEffect(() => { load() }, [load])
  const save = async () => {
    setBusy(true)
    try {
      const res = await api.saveAttendance({ code: course.code, date, hours: Number(hours) || 1, present: rows.map((r) => ({ studentId: r.studentId, present: present[r.studentId] })) })
      showToast(`Register saved for ${res?.date || date} (${res?.recorded ?? rows.length} students)`); await load()
    } catch (e) { showToast('Could not save' + (e?.message ? `: ${e.message}` : '')) }
    finally { setBusy(false) }
  }
  const nPresent = rows.filter((r) => present[r.studentId]).length
  const today = new Date().toISOString().slice(0, 10)
  return (
    <>
      <div className="grid2">
        <Panel title={`Register — ${course.code}`} subtitle={rows.length ? `${nPresent} of ${rows.length} present` : undefined} actions={rows.length > 0 && (
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
            <input type="number" min="0.5" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} style={{ width: 64 }} title="Contact hours" />
            <button className="btn primary sm" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save register'}</button>
          </span>
        )} flush>
          {rows.length === 0 ? <Empty>No students are enrolled on this module yet.</Empty> : (
            <table className="data">
              <thead><tr><th>Student</th><th className="num">Attendance</th><th style={{ width: 110 }}>Present</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.studentId}>
                  <td style={{ fontWeight: 600 }}>{r.student}</td>
                  <td className="num">{r.percent}% {sessions.length > 0 && r.percent < ATTENDANCE_MIN && <Badge tone="red" title={`Below ${ATTENDANCE_MIN}% — not admitted to the exam`}>At risk</Badge>}</td>
                  <td><label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={!!present[r.studentId]} onChange={(e) => setPresent((p) => ({ ...p, [r.studentId]: e.target.checked }))} />{present[r.studentId] ? 'Present' : 'Absent'}</label></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </Panel>
        <Panel title="Sessions recorded" subtitle={`${ATTENDANCE_MIN}% attendance is required for exam admission`} flush>
          {sessions.length === 0 ? <Empty>No sessions yet.</Empty> : (
            <table className="data"><thead><tr><th>Date</th><th className="num">Present</th></tr></thead>
              <tbody>{sessions.map((s) => <tr key={s.session_date} style={{ cursor: 'pointer' }} onClick={() => setDate(s.session_date)}><td className="mono">{s.session_date}</td><td className="num">{s.present}/{s.total}</td></tr>)}</tbody>
            </table>
          )}
        </Panel>
      </div>
      <Toast msg={toast} />
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

function ClassBoard({ course }) {
  const [toast, showToast] = useToast()
  const [board, setBoard] = useState([])
  const [busy, setBusy] = useState(false)
  const refresh = useCallback(() => api.listAnnouncements('students')
    .then((rows) => setBoard((Array.isArray(rows) ? rows : []).filter((a) => a.course_id === course.id)))
    .catch(() => setBoard([])), [course.id])
  useEffect(() => { refresh() }, [refresh])
  const submit = async (e) => {
    e.preventDefault(); const f = e.target
    const title = f.title.value.trim(); const body = f.body.value.trim()
    if (!title || !body) { showToast('Add a title and a message first'); return }
    setBusy(true)
    try { await api.createAnnouncement({ title, body, audience: 'students', courseId: course.id }); showToast('Notice posted'); f.reset(); await refresh() }
    catch (err) { showToast('Could not post' + (err?.message ? `: ${err.message}` : '')) } finally { setBusy(false) }
  }
  return (
    <>
      <div className="note-banner"><Icon name="send" size={16} /><div>Notices you post here reach only the students enrolled on <strong>{course.code}</strong>, in their <strong>Announcements</strong>.</div></div>
      <div className="grid2">
        <Panel title="Post a notice" subtitle={`${course.code} — ${course.title}`}>
          <form onSubmit={submit}>
            <div className="field"><label>Title</label><input name="title" placeholder="e.g. CA3 marks released" maxLength={90} /></div>
            <div className="field"><label>Message</label><textarea name="body" rows={4} placeholder="Write the notice…" /></div>
            <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Posting…' : 'Post notice'}</button>
          </form>
        </Panel>
        <Panel title="Notices on this module" flush>
          <div style={{ padding: 4 }}>
            {board.length === 0 && <Empty>No notices yet.</Empty>}
            {board.map((a) => (
              <div key={a.id} className="note-banner" style={{ marginBottom: 10 }}>
                <Icon name={a.pinned ? 'pin' : 'send'} size={16} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong>{a.title}</strong><span className="di-sub">{String(a.created_at || '').slice(0, 10)}</span></div>
                  <div className="di-sub" style={{ marginTop: 2 }}>{a.body}</div>
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
