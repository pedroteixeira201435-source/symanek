import React, { useState } from 'react'
import { Tabs, Panel, Progress, Toast, useToast, Badge } from '../ui.jsx'
import { TEACHER_CLASSES, TEACHER_TIMETABLE, GRADEBOOKS, LEAVE_BALANCES, PAYSLIP, COURSES, COURSE_RESULTS, gradeOf, fmtN } from '../data.js'
import { evaluateResult, POLICY_SUMMARY } from '../lib/academics.js'
import { TimetableGrid } from './Scheduling.jsx'

// Teacher sees ONLY own record and own classes — no school-wide finance/HR.
export default function TeacherPortal() {
  const [tab, setTab] = useState('My Timetable')
  return (
    <>
      <Tabs tabs={['My Timetable', 'Gradebook', 'My Courses', 'Attendance', 'My Leave & Payslip']} active={tab} onChange={setTab} />
      {tab === 'My Timetable' && <MyTimetable />}
      {tab === 'Gradebook' && <Gradebook />}
      {tab === 'My Courses' && <MyCourses />}
      {tab === 'Attendance' && <Attendance />}
      {tab === 'My Leave & Payslip' && <LeavePayslip />}
    </>
  )
}

// tertiary side of the same lecturer: CA + exam → final mark → exam board
function MyCourses() {
  const mine = COURSES.filter((c) => c.lecturer === 'Tobias Shikongo')
  const [submitted, setSubmitted] = useState({})
  const [toast, showToast] = useToast()

  const submit = (code) => {
    setSubmitted((s) => ({ ...s, [code]: true }))
    showToast(`${code} marks submitted to the exam board — locked until published`)
  }

  return (
    <>
      <div className="note-banner">
        <span>ℹ️</span>
        <div>
          {POLICY_SUMMARY} Submitting sends the sheet to the exam board (Academics) — marks lock
          until the board publishes.
        </div>
      </div>
      {mine.map((c) => {
        const rows = COURSE_RESULTS[c.code] || []
        const locked = submitted[c.code]
        return (
          <Panel
            key={c.code}
            title={`${c.code} — ${c.title}`}
            subtitle={`${c.prog} · ${c.credits} credits · ${rows.length} registered (sample)`}
            actions={
              locked ? (
                <Badge tone="green">✓ At exam board</Badge>
              ) : (
                <button className="btn primary sm" onClick={() => submit(c.code)}>Submit to exam board</button>
              )
            }
            flush
          >
            <table className="data">
              <thead>
                <tr>
                  <th>Student</th><th className="num">CA (60%)</th><th className="num">Exam (40%)</th>
                  <th className="num">Final</th><th>Grade</th><th>Result</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const res = evaluateResult({ ca: r.ca, exam: r.exam })
                  const g = gradeOf(res.final)
                  return (
                    <tr key={r.learner}>
                      <td style={{ fontWeight: 600 }}>{r.learner}</td>
                      <td className="num">{r.ca}</td>
                      <td className="num">{r.exam}</td>
                      <td className="num" style={{ fontWeight: 700, color: res.final < 50 ? 'var(--red)' : 'var(--ink)' }}>{res.final}%</td>
                      <td className="mono" style={{ fontWeight: 600 }}>{g.letter}</td>
                      <td><Badge tone={res.tone} title={res.reasons.join(' · ')}>{res.label}</Badge></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Panel>
        )
      })}
      <Toast msg={toast} />
    </>
  )
}

// daily register — this is what feeds the attendance % on Student 360°
function Attendance() {
  const [cls, setCls] = useState('DBA-6 Y1')
  const [present, setPresent] = useState(() =>
    Object.fromEntries(Object.entries(GRADEBOOKS).map(([c, rows]) => [c, rows.map(() => true)]))
  )
  const [saved, setSaved] = useState({})
  const [toast, showToast] = useToast()

  const rows = GRADEBOOKS[cls]
  const marks = present[cls]
  const absent = marks.filter((p) => !p).length

  const toggle = (i) =>
    setPresent((ps) => ({ ...ps, [cls]: ps[cls].map((p, j) => (j === i ? !p : p)) }))

  const save = () => {
    setSaved((s) => ({ ...s, [cls]: true }))
    showToast(
      absent === 0
        ? `Register saved — ${cls} all present`
        : `Register saved — ${cls}: ${absent} absent, student notified by SMS`
    )
  }

  return (
    <>
      <Panel
        title={`Class register — ${cls}`}
        subtitle={`Fri, 3 Jul 2026 · P2 · absences update the learner's attendance % and flag the 3-strikes rule`}
        actions={
          <>
            <select className="inline" value={cls} onChange={(e) => setCls(e.target.value)}>
              {Object.keys(GRADEBOOKS).map((c) => <option key={c}>{c}</option>)}
            </select>
            {saved[cls] ? (
              <Badge tone="green">✓ Saved</Badge>
            ) : (
              <button className="btn primary sm" onClick={save}>Save register ({rows.length - absent}/{rows.length})</button>
            )}
          </>
        }
        flush
      >
        <table className="data">
          <thead>
            <tr><th>Student</th><th>Status</th><th style={{ width: 120 }}>Present</th></tr>
          </thead>
          <tbody>
            {rows.map((g, i) => (
              <tr key={g.learner}>
                <td style={{ fontWeight: 600 }}>{g.learner}</td>
                <td><Badge tone={marks[i] ? 'green' : 'red'}>{marks[i] ? 'Present' : 'Absent'}</Badge></td>
                <td>
                  <input type="checkbox" checked={marks[i]} onChange={() => toggle(i)} style={{ cursor: 'pointer' }} />
                </td>
              </tr>
            ))}
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
          actions={<button className="btn ghost sm" onClick={() => showToast('Payslip PDF downloaded')}>⬇ Download PDF</button>}
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
