import React, { useState, useEffect } from 'react'
import { Tabs, Panel, Badge, Toast, useToast } from '../ui.jsx'
import { MODERATION, AT_RISK, PROGRAMMES } from '../data.js'
import { INTAKES } from '../lib/controls.js'
import * as api from '../api.js'

// The HOD layer: marks must be moderated before report cards,
// and learners failing 3+ subjects get an intervention plan.
// Exam Board is the tertiary equivalent: results published → transcripts.
export default function Academics({ go }) {
  const [tab, setTab] = useState('Mark Moderation')
  return (
    <>
      <Tabs tabs={['Mark Moderation', 'Students at Risk', 'Exam Board', 'Marks Suppression']} active={tab} onChange={setTab} />
      {tab === 'Mark Moderation' && <Moderation />}
      {tab === 'Students at Risk' && <AtRisk go={go} />}
      {tab === 'Exam Board' && <ExamBoard />}
      {tab === 'Marks Suppression' && <MarksSuppression />}
    </>
  )
}

// Marks suppression — withhold selected marks (CA / Exam / Final) for a given
// academic year and intake, e.g. from students with outstanding fees. The
// suppression flows through to the student portal (marks show as withheld).
function MarksSuppression() {
  const [toast, showToast] = useToast()
  const [year, setYear] = useState('2026')
  const [intake, setIntake] = useState('july')
  const [prog, setProg] = useState('ALL')
  const [marks, setMarks] = useState({ CA: false, Exam: false, Final: true })
  const [rules, setRules] = useState([
    { id: 1, year: '2026', intake: 'july', prog: 'ALL', marks: ['Final'], reason: 'Outstanding fees', active: true },
  ])

  const toggleMark = (k) => setMarks((m) => ({ ...m, [k]: !m[k] }))

  const apply = () => {
    const picked = Object.entries(marks).filter(([, v]) => v).map(([k]) => k)
    if (picked.length === 0) return showToast('Select at least one mark type to suppress')
    const rule = { id: Date.now(), year, intake, prog, marks: picked, reason: 'Manual suppression', active: true }
    setRules((rs) => [rule, ...rs])
    showToast(`${picked.join(', ')} suppressed for ${prog} · ${INTAKES.find((i) => i.key === intake)?.label} ${year} — audit log updated`)
  }

  const toggleRule = (id) => {
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, active: !r.active } : r)))
  }

  return (
    <>
      <div className="note-banner">
        <span>ℹ️</span>
        <div>
          Suppress selected marks (CA, Exam or Final) per academic year and intake — suppressed marks
          are withheld from the student portal until the suppression is lifted. Every change is audited.
        </div>
      </div>

      <Panel title="New suppression rule" subtitle="Choose the scope and which marks to withhold">
        <div className="grid2" style={{ gap: 12 }}>
          <div className="field">
            <label>Academic year</label>
            <select value={year} onChange={(e) => setYear(e.target.value)}><option>2026</option><option>2027</option></select>
          </div>
          <div className="field">
            <label>Intake</label>
            <select value={intake} onChange={(e) => setIntake(e.target.value)}>
              {INTAKES.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Programme</label>
          <select value={prog} onChange={(e) => setProg(e.target.value)}>
            <option value="ALL">All programmes</option>
            {PROGRAMMES.map((p) => <option key={p.code} value={p.code}>{p.code} — {p.name}</option>)}
          </select>
        </div>
        <div style={{ margin: '4px 0 10px', fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)' }}>MARKS TO SUPPRESS</div>
        <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
          {['CA', 'Exam', 'Final'].map((k) => (
            <label key={k} style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={marks[k]} onChange={() => toggleMark(k)} /> {k}
            </label>
          ))}
        </div>
        <button className="btn primary" onClick={apply}>Apply suppression</button>
      </Panel>

      <Panel title="Active suppression rules" subtitle="Toggle a rule off to release the marks to students" flush>
        <table className="data">
          <thead>
            <tr><th>Year</th><th>Intake</th><th>Programme</th><th>Marks</th><th>Reason</th><th>Status</th><th>Action</th></tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td>{r.year}</td>
                <td>{INTAKES.find((i) => i.key === r.intake)?.label || r.intake}</td>
                <td>{r.prog === 'ALL' ? 'All' : r.prog}</td>
                <td>{r.marks.map((m) => <Badge key={m} tone="blue">{m}</Badge>)}</td>
                <td style={{ fontSize: 12.5 }}>{r.reason}</td>
                <td><Badge tone={r.active ? 'red' : 'gray'}>{r.active ? 'Suppressed' : 'Released'}</Badge></td>
                <td>
                  <button className={`btn sm ${r.active ? 'green' : 'ghost'}`} onClick={() => toggleRule(r.id)}>
                    {r.active ? 'Release' : 'Re-apply'}
                  </button>
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

function Moderation() {
  const [sheets, setSheets] = useState(MODERATION)
  const [toast, showToast] = useToast()
  const pending = sheets.filter((s) => s.status === 'Awaiting moderation').length

  const decide = (i, status) => {
    setSheets((ss) => ss.map((s, j) => (j === i ? { ...s, status } : s)))
    const s = sheets[i]
    showToast(
      status === 'Approved'
        ? `${s.cls} ${s.subject} approved — locked for report cards`
        : `${s.cls} ${s.subject} returned to ${s.teacher} for review`
    )
  }

  return (
    <>
      <div className="note-banner">
        <span>ℹ️</span>
        <div>
          Marks are <strong>locked after approval</strong> and any later change is written to the audit
          log — moderation is the control point before report cards are generated.
        </div>
      </div>
      <Panel title="Mark sheets — Semester 2" subtitle={`${pending} awaiting moderation`} flush>
        <table className="data">
          <thead>
            <tr>
              <th>Class</th><th>Subject</th><th>Lecturer</th>
              <th className="num">Class avg</th><th>Submitted</th><th>Status</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sheets.map((s, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{s.cls}</td>
                <td>{s.subject}</td>
                <td>{s.teacher}</td>
                <td className="num" style={{ color: s.avg < 55 ? 'var(--red)' : 'var(--ink)' }}>{s.avg}%</td>
                <td>{s.submitted}</td>
                <td>
                  <Badge tone={s.status === 'Approved' ? 'green' : s.status === 'Returned' ? 'red' : 'amber'}>
                    {s.status}
                  </Badge>
                </td>
                <td>
                  {s.status === 'Awaiting moderation' ? (
                    <span style={{ display: 'flex', gap: 6 }}>
                      <button className="btn green sm" onClick={() => decide(i, 'Approved')}>Approve</button>
                      <button className="btn red-ghost sm" onClick={() => decide(i, 'Returned')}>Return</button>
                    </span>
                  ) : (
                    <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>🔒 locked</span>
                  )}
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

function ExamBoard() {
  const [results, setResults] = useState([])
  const [toast, showToast] = useToast()
  const [busy, setBusy] = useState(null)
  const load = () => api.listExamBoard().then(setResults).catch(() => {})
  useEffect(() => { load() }, [])
  const pending = results.filter((r) => r.status === 'Awaiting approval').length

  // Publication is server-authoritative (RPC publish_exam_results): computes the
  // final mark, locks the results and writes pass/fail — then re-loads the board.
  const publish = async (r) => {
    setBusy(r.code)
    try {
      const res = await api.publishExamResults({ courseId: r.id, courseCode: r.code })
      showToast((res && res.message) || `${r.code} results published — GPA written to student transcripts`)
      if (res && res.course) await load() // http: re-fetch real board state
      else setResults((rs) => rs.map((x) => (x.code === r.code ? { ...x, status: 'Published' } : x))) // mock
    } catch (e) {
      showToast(e?.message || 'Publish failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="note-banner">
        <span>ℹ️</span>
        <div>
          The exam board approves results per course — on <strong>publish</strong>, marks lock and
          flow to the transcript & GPA on each Student 360° file.
        </div>
      </div>
      <Panel title="Semester 1 results — board approval" subtitle={`${pending} course${pending === 1 ? '' : 's'} awaiting approval`} flush>
        <table className="data">
          <thead>
            <tr>
              <th>Course</th><th>Lecturer</th><th className="num">Sat</th>
              <th className="num">Pass rate</th><th className="num">Avg mark</th><th>Status</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.code}>
                <td>
                  <div style={{ fontWeight: 600 }}>{r.title}</div>
                  <div className="mono" style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>{r.code}</div>
                </td>
                <td>{r.lecturer}</td>
                <td className="num">{r.sat}</td>
                <td className="num" style={{ color: r.passRate < 70 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>{r.passRate}%</td>
                <td className="num" style={{ color: r.avg < 55 ? 'var(--red)' : 'var(--ink)' }}>{r.avg}%</td>
                <td>
                  <Badge tone={r.status === 'Published' ? 'green' : 'amber'}>{r.status}</Badge>
                </td>
                <td>
                  {r.status === 'Awaiting approval' ? (
                    <button className="btn green sm" disabled={busy === r.code} onClick={() => publish(r)}>{busy === r.code ? 'Publishing…' : 'Approve & publish'}</button>
                  ) : (
                    <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>🔒 on transcripts</span>
                  )}
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

function AtRisk({ go }) {
  const [flagged, setFlagged] = useState({})
  const [toast, showToast] = useToast()

  const intervene = (name) => {
    setFlagged((f) => ({ ...f, [name]: true }))
    showToast(`Intervention plan opened for ${name} — guardian meeting scheduled`)
  }

  return (
    <Panel
      title="Students failing 3+ courses"
      subtitle="Auto-flagged from Semester 2 marks · intervention before exams"
      flush
    >
      <table className="data">
        <thead>
          <tr><th>Student</th><th>Programme</th><th>Failing courses</th><th className="num">Attendance</th><th>Action</th></tr>
        </thead>
        <tbody>
          {AT_RISK.map((r) => (
            <tr key={r.learner}>
              <td
                style={{ fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'var(--line)' }}
                title="Open Student 360°"
                onClick={() => go && go('students', r.learner)}
              >
                {r.learner}
              </td>
              <td>{r.grade}</td>
              <td>
                <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {r.failing.map((f) => <Badge key={f} tone="red">{f}</Badge>)}
                </span>
              </td>
              <td className="num" style={{ color: r.attendance < 85 ? 'var(--red)' : 'var(--ink)' }}>{r.attendance}%</td>
              <td>
                {flagged[r.learner] ? (
                  <Badge tone="green">Plan open</Badge>
                ) : (
                  <button className="btn primary sm" onClick={() => intervene(r.learner)}>Start intervention</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}
