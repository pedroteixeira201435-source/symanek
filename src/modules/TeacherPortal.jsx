import React, { useState, useEffect } from 'react'
import { Tabs, Panel, Progress, Toast, useToast, Badge, Icon, StatCard, Modal } from '../ui.jsx'
import { TEACHER_CLASSES, TEACHER_TIMETABLE, GRADEBOOKS, LEARNERS, LEAVE_BALANCES, PAYSLIP, COURSES, COURSE_RESULTS, gradeOf, fmtN } from '../data.js'
import { evaluateResult, POLICY_SUMMARY } from '../lib/academics.js'
import { TimetableGrid } from './Scheduling.jsx'
import * as api from '../api.js'

const LECTURER = 'Tobias Shikongo'

// Teacher sees ONLY own record and own classes — no school-wide finance/HR.
export default function TeacherPortal() {
  const [tab, setTab] = useState('My Timetable')
  return (
    <>
      <Tabs tabs={['My Timetable', 'My Students', 'Gradebook', 'My Courses', 'Attendance', 'Class Board', 'Student Queries', 'My Leave & Payslip']} active={tab} onChange={setTab} />
      {tab === 'My Timetable' && <MyTimetable />}
      {tab === 'My Students' && <MyStudents />}
      {tab === 'Gradebook' && <Gradebook />}
      {tab === 'My Courses' && <MyCourses />}
      {tab === 'Attendance' && <Attendance />}
      {tab === 'Class Board' && <ClassBoard />}
      {tab === 'Student Queries' && <StudentQueries />}
      {tab === 'My Leave & Payslip' && <LeavePayslip />}
    </>
  )
}

// tertiary side of the same lecturer: CA + exam → final mark → exam board
function MyCourses() {
  const mine = COURSES.filter((c) => c.lecturer === LECTURER)
  return (
    <>
      <div className="note-banner">
        <Icon name="info" size={16} />
        <div>
          {POLICY_SUMMARY} Edit CA and exam marks and save — they appear on the student's transcript as
          <strong> provisional</strong>. Submitting to the exam board publishes the final grades.
        </div>
      </div>
      {mine.map((c) => <CourseMarks key={c.code} course={c} />)}
    </>
  )
}

function CourseMarks({ course }) {
  const [rows, setRows] = useState([])
  const [dirty, setDirty] = useState(false)
  const [published, setPublished] = useState(false)
  const [toast, showToast] = useToast()

  const load = () =>
    api.getCourseResults(course.code).then((rs) => {
      setRows(rs.map((r) => ({ ...r })))
      setPublished(rs.length > 0 && rs.every((r) => r.published))
    }).catch(() => {})
  useEffect(() => { load() }, [course.code])

  const setMark = (learner, k, v) => {
    setRows((rs) => rs.map((r) => (r.learner === learner ? { ...r, [k]: v === '' ? '' : Number(v) } : r)))
    setDirty(true)
  }
  const payload = () => rows.map((r) => ({ learner: r.learner, student_id: r.student_id, ca: Number(r.ca) || 0, exam: Number(r.exam) || 0 }))
  const save = async () => {
    await api.saveCourseMarks(course.code, payload())
    setDirty(false)
    showToast(`${course.code} marks saved — students see them as provisional`)
  }
  const publish = async () => {
    if (dirty) await api.saveCourseMarks(course.code, payload())
    await api.publishCourseResults(course.code)
    setPublished(true); setDirty(false)
    showToast(`${course.code} published — students now see final grades`)
  }

  const evald = rows.map((r) => evaluateResult({ ca: Number(r.ca) || 0, exam: Number(r.exam) || 0 }))
  const avg = rows.length ? Math.round(evald.reduce((s, e) => s + e.final, 0) / rows.length) : 0
  const passRate = rows.length ? Math.round((evald.filter((e) => e.final >= 50).length / rows.length) * 100) : 0

  return (
    <Panel
      title={`${course.code} — ${course.title}`}
      subtitle={`${course.prog} · ${course.credits} credits · ${rows.length} registered${rows.length ? ` · avg ${avg}% · pass ${passRate}%` : ''}`}
      actions={
        published ? (
          <Badge tone="green"><Icon name="tick" size={12} /> Published</Badge>
        ) : rows.length ? (
          <span style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost sm" onClick={save} disabled={!dirty}>Save marks</button>
            <button className="btn primary sm" onClick={publish}>Submit to exam board</button>
          </span>
        ) : null
      }
      flush
    >
      {rows.length === 0 ? (
        <div className="di-sub" style={{ padding: 12 }}>No registered students in this sample.</div>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>Student</th><th className="num">CA (60%)</th><th className="num">Exam (40%)</th>
              <th className="num">Final</th><th>Grade</th><th>Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const res = evald[i]
              const g = gradeOf(res.final)
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

// Per-course register — writes each student's running attendance %, which the
// student sees in their portal and which gates the 80% examination permit.
function Attendance() {
  const courses = COURSES.filter((c) => c.lecturer === LECTURER && (COURSE_RESULTS[c.code] || []).length)
  const [code, setCode] = useState(courses[0]?.code || '')
  const roster = (COURSE_RESULTS[code] || []).map((r) => r.learner)
  const [present, setPresent] = useState({})
  const [pct, setPct] = useState({})
  const [saved, setSaved] = useState(false)
  const [toast, showToast] = useToast()

  useEffect(() => {
    setPresent(Object.fromEntries(roster.map((n) => [n, true])))
    setSaved(false)
    api.getCourseAttendance(roster, code).then(setPct).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const toggle = (n) => { setPresent((p) => ({ ...p, [n]: !p[n] })); setSaved(false) }
  const absent = roster.filter((n) => !present[n]).length

  const save = async () => {
    await api.recordSession({ present, code })
    const updated = await api.getCourseAttendance(roster, code)
    setPct(updated); setSaved(true)
    showToast(absent === 0 ? `Register saved — ${code}: all present` : `Register saved — ${code}: ${absent} absent · attendance %s updated`)
  }

  return (
    <>
      <div className="note-banner">
        <Icon name="info" size={16} />
        <div>Marking today's session updates each student's <strong>attendance %</strong> — which drives the 80% examination-permit rule they see in their portal.</div>
      </div>
      <Panel
        title={`Class register — ${code}`}
        subtitle="Today's session · absences lower the student's running attendance %"
        actions={
          <>
            <select className="inline" value={code} onChange={(e) => setCode(e.target.value)}>
              {courses.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
            {saved ? (
              <Badge tone="green"><Icon name="tick" size={12} /> Saved</Badge>
            ) : (
              <button className="btn primary sm" onClick={save}>Save register ({roster.length - absent}/{roster.length})</button>
            )}
          </>
        }
        flush
      >
        <table className="data">
          <thead>
            <tr><th>Student</th><th className="num">Attendance</th><th>Status</th><th style={{ width: 120 }}>Present</th></tr>
          </thead>
          <tbody>
            {roster.map((n) => {
              const p = pct[n]
              return (
                <tr key={n}>
                  <td style={{ fontWeight: 600 }}>{n}</td>
                  <td className="num" style={{ fontWeight: 600, color: p != null && p < 80 ? 'var(--red)' : 'var(--ink)' }}>{p != null ? `${p}%` : '—'}</td>
                  <td><Badge tone={present[n] ? 'green' : 'red'}>{present[n] ? 'Present' : 'Absent'}</Badge></td>
                  <td><input type="checkbox" checked={!!present[n]} onChange={() => toggle(n)} style={{ cursor: 'pointer' }} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Panel>
      <Toast msg={toast} />
    </>
  )
}

function MyTimetable() {
  return (
    <>
      <div className="class-cards">
        {TEACHER_CLASSES.map((c) => (
          <div key={c.cls} className="stat-card">
            <div className="label">{c.cls} · {c.subject}</div>
            <div className="value">{c.learners} <span style={{ fontSize: 13, fontWeight: 400 }}>learners</span></div>
            <div className="delta neutral">Class average: {c.avg}%</div>
          </div>
        ))}
      </div>
      <Panel title="My weekly timetable" subtitle="Tobias Shikongo · Physical Sciences · Semester 2, 2026">
        <TimetableGrid data={TEACHER_TIMETABLE} />
      </Panel>
    </>
  )
}

// The lecturer's own roster across their classes, with academic + attendance
// risk flags derived from the gradebook (latest CA) and the class register — so
// the lecturer can spot who needs intervention without the school-wide "at risk"
// view (which is admin/registrar only).
function MyStudents() {
  const attByName = Object.fromEntries(LEARNERS.map((l) => [l.name, l.attendance]))
  const roster = Object.entries(GRADEBOOKS).flatMap(([cls, rows]) =>
    rows.map((g) => {
      const att = attByName[g.learner] ?? null
      const trend = g.t3 - g.t2
      const flags = []
      if (g.t3 < 50) flags.push({ label: 'Failing', tone: 'red' })
      else if (g.t3 < 55) flags.push({ label: 'Borderline', tone: 'amber' })
      if (trend <= -3) flags.push({ label: 'Declining', tone: 'amber' })
      if (att != null && att < 80) flags.push({ label: 'Attendance <80%', tone: 'red' })
      return { key: `${cls}·${g.learner}`, cls, att, trend, ...g, flags, atRisk: flags.length > 0 }
    })
  )
  const [onlyRisk, setOnlyRisk] = useState(true)
  const [sel, setSel] = useState(null)
  const shown = onlyRisk ? roster.filter((r) => r.atRisk) : roster
  const riskCount = roster.filter((r) => r.atRisk).length
  const knownAtt = roster.filter((r) => r.att != null)
  const avgAtt = knownAtt.length ? Math.round(knownAtt.reduce((s, r) => s + r.att, 0) / knownAtt.length) : null

  const trendEl = (d) =>
    d <= -3 ? <span style={{ color: 'var(--red)', fontWeight: 600 }}>▼ {d}</span>
    : d >= 3 ? <span style={{ color: 'var(--green)', fontWeight: 600 }}>▲ +{d}</span>
    : <span style={{ color: 'var(--ink-faint)' }}>▬ {d >= 0 ? '+' : ''}{d}</span>

  return (
    <>
      <div className="class-cards">
        <StatCard icon="👤" label="Students (my classes)" value={String(roster.length)} delta="across 3 classes" deltaTone="neutral" />
        <StatCard icon="⚠️" label="Need attention" value={String(riskCount)} delta="failing / declining / low attendance" deltaTone={riskCount ? 'down' : 'up'} />
        <StatCard icon="⏰" label="Avg attendance (known)" value={avgAtt != null ? `${avgAtt}%` : '—'} delta="from the register" deltaTone={avgAtt != null && avgAtt >= 80 ? 'up' : 'down'} />
      </div>

      <Panel
        title="My students"
        subtitle="Risk derived from your gradebook (latest CA) and the register — pass mark 50%, attendance floor 80%"
        actions={
          <button className="btn ghost sm" onClick={() => { setOnlyRisk((v) => !v); setSel(null) }}>
            {onlyRisk ? `Show all (${roster.length})` : `Only at risk (${riskCount})`}
          </button>
        }
        flush
      >
        <table className="data">
          <thead>
            <tr><th>Student</th><th>Class</th><th className="num">Latest CA</th><th>Trend</th><th className="num">Attendance</th><th>Flags</th></tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.key} onClick={() => setSel(r)} style={{ cursor: 'pointer', background: sel?.key === r.key ? 'var(--petrol-50, #eef4f6)' : undefined }}>
                <td style={{ fontWeight: 600 }}>{r.learner}</td>
                <td>{r.cls}</td>
                <td className="num" style={{ fontWeight: 700, color: r.t3 < 50 ? 'var(--red)' : 'var(--ink)' }}>{r.t3}%</td>
                <td>{trendEl(r.trend)}</td>
                <td className="num">{r.att != null ? `${r.att}%` : '—'}</td>
                <td>{r.flags.length ? r.flags.map((f) => <Badge key={f.label} tone={f.tone}>{f.label}</Badge>) : <Badge tone="green">On track</Badge>}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={6} className="di-sub" style={{ padding: 16 }}>No students flagged — everyone is on track.</td></tr>
            )}
          </tbody>
        </table>
      </Panel>

      {sel && (
        <Panel title={`${sel.learner} · ${sel.cls}`} subtitle="Continuous-assessment history and standing" flush>
          <div style={{ padding: 14 }}>
            <div className="grid2" style={{ gap: 14 }}>
              <div>
                <div className="cf-row" style={{ padding: '6px 0' }}><span>CA 1</span><span className="mono">{sel.t1}%</span></div>
                <div className="cf-row" style={{ padding: '6px 0' }}><span>CA 2</span><span className="mono">{sel.t2}%</span></div>
                <div className="cf-row" style={{ padding: '6px 0' }}><span>CA 3 (latest)</span><span className="mono" style={{ fontWeight: 700 }}>{sel.t3}%</span></div>
                <div className="cf-row" style={{ padding: '6px 0' }}><span>Trend (CA2→CA3)</span><span>{trendEl(sel.trend)}</span></div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 6 }}>ATTENDANCE</div>
                {sel.att != null ? (
                  <div className="hbar-row"><span className="hlabel">Term</span><Progress pct={sel.att} tone={sel.att >= 80 ? 'green' : 'red'} /><span className="hval">{sel.att}%</span></div>
                ) : (
                  <div className="di-sub">Not in the linked register sample.</div>
                )}
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', margin: '14px 0 6px' }}>STANDING</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {sel.flags.length ? sel.flags.map((f) => <Badge key={f.label} tone={f.tone}>{f.label}</Badge>) : <Badge tone="green">On track</Badge>}
                </div>
              </div>
            </div>
            <div className="note-banner" style={{ marginTop: 14 }}>
              <Icon name="info" size={16} />
              <div>{sel.atRisk
                ? 'Consider a check-in or a note on the Class Board. A latest CA below 50% risks a second opportunity or fail at the exam board; attendance under 80% blocks the exam permit.'
                : 'This student is meeting the pass mark and the attendance floor.'}</div>
            </div>
          </div>
        </Panel>
      )}
    </>
  )
}

// Lecturer inbox for questions students raise — the reverse channel of the
// Class Board. Reply lands back in the student's "Ask lecturer" thread.
function StudentQueries() {
  const [rows, setRows] = useState([])
  const [replyFor, setReplyFor] = useState(null)
  const [toast, showToast] = useToast()
  const load = () => api.listQueries({ lecturer: LECTURER }).then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => {})
  useEffect(() => { load() }, [])

  const send = async (q, text) => {
    if (!text.trim()) { showToast('Write a reply first'); return }
    await api.replyQuery({ id: q.id, reply: text })
    showToast(`Replied to ${q.student}`)
    setReplyFor(null); load()
  }
  const open = rows.filter((q) => q.status === 'open').length

  return (
    <>
      <div className="note-banner">
        <Icon name="info" size={16} />
        <div>Questions your students raise about their courses land here. {open ? <strong>{open} awaiting a reply.</strong> : 'All caught up.'}</div>
      </div>
      <Panel title="Student queries" flush>
        <table className="data">
          <thead>
            <tr><th>Student</th><th>Course</th><th>Subject</th><th>Status</th><th style={{ width: 130 }}>Action</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="di-sub" style={{ padding: 16 }}>No queries yet.</td></tr>}
            {rows.map((q) => (
              <tr key={q.id}>
                <td style={{ fontWeight: 600 }}>{q.student}</td>
                <td>{q.course}</td>
                <td>{q.subject}<div className="di-sub">{q.body}</div></td>
                <td><Badge tone={q.status === 'open' ? 'amber' : 'green'}>{q.status === 'open' ? 'Open' : 'Answered'}</Badge></td>
                <td>
                  {q.status === 'open'
                    ? <button className="btn primary sm" onClick={() => setReplyFor(q)}>Reply</button>
                    : <button className="btn ghost sm" onClick={() => setReplyFor(q)}>View</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
      <div className="note-banner">
        <Icon name="edit" size={16} />
        <div><strong>{query.subject}</strong> <span className="di-sub">· {query.course} · {query.createdAt}</span><div className="di-sub" style={{ marginTop: 4 }}>{query.body}</div></div>
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>Your reply</label>
        <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Answer the student…" />
      </div>
      <button className="btn primary" onClick={() => onSend(query, text)}>Send reply</button>
    </Modal>
  )
}

// Lets a lecturer broadcast a notice that lands in the student portal's
// Announcements — both sides go through api.listAnnouncements / createAnnouncement.
function ClassBoard() {
  const [toast, showToast] = useToast()
  const [board, setBoard] = useState([])
  const [busy, setBusy] = useState(false)

  const refresh = () =>
    api.listAnnouncements('students').then((rows) => setBoard(Array.isArray(rows) ? rows : [])).catch(() => {})
  useEffect(() => { refresh() }, [])

  const submit = async (e) => {
    e.preventDefault()
    const f = e.target
    const title = f.title.value.trim()
    const body = f.body.value.trim()
    if (!title || !body) { showToast('Add a title and a message first'); return }
    setBusy(true)
    try {
      await api.createAnnouncement({ title, body, audience: f.audience.value, author: LECTURER })
      showToast('Announcement posted — students see it in their portal')
      f.reset()
      await refresh()
    } catch {
      showToast('Could not post the announcement')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="note-banner">
        <Icon name="send" size={16} />
        <div>Notices you post here appear in every student's <strong>Announcements</strong>. Use it for reminders, deadlines and results updates for your classes.</div>
      </div>
      <div className="grid2">
        <Panel title="Post a notice" subtitle="Delivered to the student portal announcements">
          <form onSubmit={submit}>
            <div className="field">
              <label>Title</label>
              <input name="title" placeholder="e.g. CA3 marks released" maxLength={90} />
            </div>
            <div className="field">
              <label>Message</label>
              <textarea name="body" rows={4} placeholder="Write the notice students will see…" />
            </div>
            <div className="field">
              <label>Audience</label>
              <select name="audience">
                <option value="students">All students</option>
                <option value="all">Whole college</option>
              </select>
            </div>
            <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Posting…' : 'Post announcement'}</button>
          </form>
        </Panel>

        <Panel title="Live student board" subtitle="What students currently see" flush>
          <div style={{ padding: 4 }}>
            {board.length === 0 && <div className="di-sub" style={{ padding: 12 }}>No announcements yet.</div>}
            {board.map((a) => (
              <div key={a.id} className="note-banner" style={{ marginBottom: 10 }}>
                <Icon name={a.pinned ? 'pin' : 'send'} size={16} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong>{a.title}</strong>
                    <span className="di-sub">{a.created_at || a.date || ''}</span>
                  </div>
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

function Gradebook() {
  const [cls, setCls] = useState('DBA-6 Y1')
  // marks per class so switching preserves edits
  const [marks, setMarks] = useState(() =>
    Object.fromEntries(Object.entries(GRADEBOOKS).map(([c, rows]) => [c, rows.map((g) => g.t3)]))
  )
  const [toast, showToast] = useToast()

  const rows = GRADEBOOKS[cls]
  const clsMarks = marks[cls]
  const avg = Math.round(clsMarks.reduce((s, v) => s + (v || 0), 0) / clsMarks.length)

  const setMark = (i, v) =>
    setMarks((m) => ({ ...m, [cls]: m[cls].map((x, j) => (j === i ? Number(v) : x)) }))

  const trend = (g, t3) => {
    const d = t3 - g.t2
    if (d > 1) return <span style={{ color: 'var(--green)', fontWeight: 600 }}>▲ +{d}</span>
    if (d < -1) return <span style={{ color: 'var(--red)', fontWeight: 600 }}>▼ {d}</span>
    return <span style={{ color: 'var(--ink-faint)' }}>▬ {d >= 0 ? '+' : ''}{d}</span>
  }

  return (
    <>
      <Panel
        title={`Gradebook — ${cls} · Physical Science`}
        subtitle={`Continuous-assessment marks are editable · live class average: ${avg}%`}
        actions={
          <>
            <select className="inline" value={cls} onChange={(e) => setCls(e.target.value)}>
              {Object.keys(GRADEBOOKS).map((c) => <option key={c}>{c}</option>)}
            </select>
            <button className="btn primary sm" onClick={() => showToast(`Marks saved for ${cls}`)}>Save marks</button>
          </>
        }
        flush
      >
        <table className="data">
          <thead>
            <tr><th>Student</th><th className="num">CA 1</th><th className="num">CA 2</th><th className="num">CA 3 (edit)</th><th>Trend</th></tr>
          </thead>
          <tbody>
            {rows.map((g, i) => (
              <tr key={g.learner}>
                <td style={{ fontWeight: 600 }}>{g.learner}</td>
                <td className="num">{g.t1}</td>
                <td className="num">{g.t2}</td>
                <td className="num">
                  <input
                    className="mark"
                    type="number"
                    min="0"
                    max="100"
                    value={clsMarks[i]}
                    onChange={(e) => setMark(i, e.target.value)}
                  />
                </td>
                <td>{trend(g, clsMarks[i])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Toast msg={toast} />
    </>
  )
}

const LEAVE_TONE = { Annual: 'blue', Sick: 'red', Compassionate: 'orange' }

function LeavePayslip() {
  const [toast, showToast] = useToast()
  const [requests, setRequests] = useState([
    { type: 'Annual', period: '02–06 Mar 2026', days: 5, status: 'Approved' },
  ])

  const submit = (e) => {
    e.preventDefault()
    const f = e.target
    const from = new Date(f.from.value)
    const to = new Date(f.to.value)
    const days = Math.max(1, Math.round((to - from) / 86400000) + 1)
    const fmt = (d) => d.toLocaleDateString('en-NA', { day: '2-digit', month: 'short' })
    setRequests((rs) => [{ type: f.type.value, period: `${fmt(from)} – ${fmt(to)} 2026`, days, status: 'Pending' }, ...rs])
    showToast('Leave request submitted to HR')
  }

  return (
    <>
      <div className="grid2">
        <Panel title="Request leave" subtitle="Balances update after HR approval">
          <form onSubmit={submit}>
            <div className="field">
              <label>Leave type</label>
              <select name="type"><option>Annual</option><option>Sick</option><option>Compassionate</option></select>
            </div>
            <div className="grid2" style={{ gap: 12 }}>
              <div className="field"><label>From</label><input name="from" type="date" defaultValue="2026-07-20" /></div>
              <div className="field"><label>To</label><input name="to" type="date" defaultValue="2026-07-22" /></div>
            </div>
            <button className="btn primary" type="submit">Submit request</button>
          </form>

          <div style={{ margin: '20px 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)' }}>MY REQUESTS</div>
          {requests.map((r, i) => (
            <div key={i} className="cf-row" style={{ borderBottom: '1px solid #e9eef3', padding: '8px 0' }}>
              <span><Badge tone={LEAVE_TONE[r.type]}>{r.type}</Badge> {r.period} · {r.days}d</span>
              <Badge tone={r.status === 'Approved' ? 'green' : 'amber'}>{r.status}</Badge>
            </div>
          ))}

          <div style={{ marginTop: 22 }}>
            {LEAVE_BALANCES.map((b) => (
              <div key={b.type} className="hbar-row">
                <span className="hlabel">{b.type}</span>
                <Progress pct={(b.used / b.total) * 100} tone="amber" />
                <span className="hval">{b.total - b.used} / {b.total}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title={`Latest payslip — ${PAYSLIP.month}`}
          subtitle="PAYE + SSC per Labour Act 2007"
          actions={<button className="btn ghost sm" onClick={() => showToast('Payslip PDF downloaded')}><Icon name="download" size={14} /> Download PDF</button>}
        >
          {[
            ['Gross salary', PAYSLIP.gross],
            ['PAYE', -PAYSLIP.paye],
            ['Social Security (SSC)', -PAYSLIP.ssc],
          ].map(([l, v]) => (
            <div key={l} className="cf-row" style={{ padding: '9px 0', borderBottom: '1px solid #f0ebe0' }}>
              <span>{l}</span>
              <span className="mono" style={{ color: v < 0 ? 'var(--red)' : 'var(--ink)' }}>
                {v < 0 ? '− ' + fmtN(-v) : fmtN(v)}
              </span>
            </div>
          ))}
          <div className="cf-row total">
            <span>Net pay</span>
            <span className="amt">{fmtN(PAYSLIP.net)}</span>
          </div>
        </Panel>
      </div>
      <Toast msg={toast} />
    </>
  )
}
