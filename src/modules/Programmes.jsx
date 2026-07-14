import React, { useState } from 'react'
import { Tabs, Panel, Badge, Progress, Modal, Donut, Toast, useToast } from '../ui.jsx'
import { PROGRAMMES, COURSES, HOLDS, DEGREE_AUDIT, fmtN } from '../data.js'

// Programmes & curriculum — the tertiary academic structure:
// NQF-levelled programmes, credit-bearing courses, semester enrolments.
const ACCRED_TONE = { 'NQA Accredited': 'green', 'NTA Registered': 'teal', Provisional: 'amber' }

export default function Programmes() {
  const [tab, setTab] = useState('Programmes')
  return (
    <>
      <Tabs tabs={['Programmes', 'Course Catalogue', 'Semester Enrolments', 'Degree Audit']} active={tab} onChange={setTab} />
      {tab === 'Programmes' && <ProgrammeList />}
      {tab === 'Course Catalogue' && <Catalogue />}
      {tab === 'Semester Enrolments' && <Enrolments />}
      {tab === 'Degree Audit' && <DegreeAudit />}
    </>
  )
}

function ProgrammeList() {
  const [progs, setProgs] = useState(PROGRAMMES)
  const [sel, setSel] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [toast, showToast] = useToast()

  const create = (e) => {
    e.preventDefault()
    const f = e.target
    const p = {
      code: f.code.value.toUpperCase(), name: f.name.value, nqf: Number(f.nqf.value),
      years: Number(f.years.value), coordinator: f.coordinator.value, enrolled: 0, accreditation: 'Provisional',
    }
    setProgs((ps) => [...ps, p])
    setShowNew(false)
    showToast(`${p.code} created — submitted to NQA for accreditation`)
  }

  return (
    <>
      <Panel
        title="Registered programmes"
        subtitle="NQF-levelled · click a programme for its curriculum"
        actions={<button className="btn primary sm" onClick={() => setShowNew(true)}>+ New programme</button>}
        flush
      >
        <table className="data">
          <thead>
            <tr>
              <th>Programme</th><th>NQF</th><th className="num">Duration</th>
              <th>Coordinator</th><th className="num">Enrolled</th><th>Accreditation</th>
            </tr>
          </thead>
          <tbody>
            {progs.map((p) => (
              <tr key={p.code} style={{ cursor: 'pointer' }} onClick={() => setSel(p)}>
                <td>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div className="mono" style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>{p.code}</div>
                </td>
                <td><Badge tone="blue">Level {p.nqf}</Badge></td>
                <td className="num">{p.years} yr</td>
                <td>{p.coordinator}</td>
                <td className="num" style={{ fontWeight: 600 }}>{p.enrolled}</td>
                <td><Badge tone={ACCRED_TONE[p.accreditation]}>{p.accreditation}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {sel && (
        <Modal title={`${sel.code} — ${sel.name}`} onClose={() => setSel(null)} width={560}>
          <div className="cf-row"><span>NQF level</span><Badge tone="blue">Level {sel.nqf}</Badge></div>
          <div className="cf-row"><span>Duration</span><span>{sel.years} years full-time</span></div>
          <div className="cf-row"><span>Coordinator</span><span style={{ fontWeight: 600 }}>{sel.coordinator}</span></div>
          <div className="cf-row"><span>Accreditation</span><Badge tone={ACCRED_TONE[sel.accreditation]}>{sel.accreditation}</Badge></div>

          <div style={{ margin: '16px 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)' }}>
            CURRICULUM · 2026
          </div>
          {COURSES.filter((c) => c.prog === sel.code).map((c) => (
            <div key={c.code} className="cf-row" style={{ padding: '5px 0', fontSize: 12.5 }}>
              <span><span className="mono">{c.code}</span> · {c.title}</span>
              <span className="mono" style={{ fontWeight: 600 }}>{c.credits} cr · {c.sem}</span>
            </div>
          ))}
          {COURSES.filter((c) => c.prog === sel.code).length === 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>Curriculum pending accreditation</div>
          )}
        </Modal>
      )}

      {showNew && (
        <Modal title="New programme" onClose={() => setShowNew(false)} width={440}>
          <form onSubmit={create}>
            <div className="field"><label>Programme name</label><input name="name" placeholder="e.g. Diploma in Hospitality" required /></div>
            <div className="grid2" style={{ gap: 12 }}>
              <div className="field"><label>Code</label><input name="code" placeholder="DHM-6" required /></div>
              <div className="field">
                <label>NQF level</label>
                <select name="nqf"><option>4</option><option>5</option><option>6</option><option>7</option></select>
              </div>
            </div>
            <div className="grid2" style={{ gap: 12 }}>
              <div className="field">
                <label>Duration (years)</label>
                <select name="years"><option>1</option><option>2</option><option>3</option><option>4</option></select>
              </div>
              <div className="field">
                <label>Coordinator</label>
                <select name="coordinator">
                  {PROGRAMMES.map((p) => <option key={p.code}>{p.coordinator}</option>)}
                </select>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 14 }}>
              New programmes start as <strong>Provisional</strong> until the NQA accreditation file is approved
            </div>
            <button className="btn primary" type="submit">Create programme</button>
          </form>
        </Modal>
      )}
      <Toast msg={toast} />
    </>
  )
}

function Catalogue() {
  const [q, setQ] = useState('')
  const [courses, setCourses] = useState(COURSES)
  const [showNew, setShowNew] = useState(false)
  const [toast, showToast] = useToast()

  const addCourse = (e) => {
    e.preventDefault()
    const f = e.target
    const c = {
      code: f.code.value.toUpperCase(), title: f.title.value, prog: f.prog.value,
      credits: Number(f.credits.value) || 8, sem: f.sem.value, lecturer: f.lecturer.value,
      enrolled: 0, cap: 40, prereq: f.prereq.value || '—',
    }
    setCourses((cs) => [...cs, c])
    setShowNew(false)
    showToast(`${c.code} added to the ${c.prog} curriculum — registration opens next semester`)
  }

  const rows = courses.filter(
    (c) =>
      c.title.toLowerCase().includes(q.toLowerCase()) ||
      c.code.toLowerCase().includes(q.toLowerCase()) ||
      c.prog.toLowerCase().includes(q.toLowerCase())
  )
  return (
    <>
      <Panel
        title="Course catalogue — 2026"
        subtitle={`${courses.length} credit-bearing courses · prerequisites enforced at registration`}
        actions={
          <>
            <input
              className="inline"
              style={{ width: 200 }}
              placeholder="Search code, title or programme…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="btn ghost sm" onClick={() => showToast('Catalogue exported to PDF prospectus')}>⬇ Export</button>
            <button className="btn primary sm" onClick={() => setShowNew(true)}>+ Add course</button>
          </>
        }
        flush
      >
        <table className="data">
          <thead>
            <tr>
              <th>Code</th><th>Course</th><th>Programme</th><th className="num">Credits</th>
              <th>Semester</th><th>Lecturer</th><th>Prerequisite</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.code}>
                <td className="mono" style={{ fontSize: 12.5, fontWeight: 600 }}>{c.code}</td>
                <td style={{ fontWeight: 600 }}>{c.title}</td>
                <td><Badge tone="blue">{c.prog}</Badge></td>
                <td className="num">{c.credits}</td>
                <td>{c.sem}</td>
                <td>{c.lecturer}</td>
                <td className="mono" style={{ fontSize: 12.5, color: c.prereq === '—' ? 'var(--ink-faint)' : 'var(--ink)' }}>{c.prereq}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {showNew && (
        <Modal title="Add course" onClose={() => setShowNew(false)} width={460}>
          <form onSubmit={addCourse}>
            <div className="grid2" style={{ gap: 12 }}>
              <div className="field"><label>Code</label><input name="code" placeholder="BBA210" required /></div>
              <div className="field"><label>Credits</label><input name="credits" type="number" min="4" max="24" defaultValue="12" /></div>
            </div>
            <div className="field"><label>Course title</label><input name="title" placeholder="e.g. Entrepreneurship I" required /></div>
            <div className="grid2" style={{ gap: 12 }}>
              <div className="field">
                <label>Programme</label>
                <select name="prog">{PROGRAMMES.map((p) => <option key={p.code}>{p.code}</option>)}</select>
              </div>
              <div className="field">
                <label>Semester</label>
                <select name="sem"><option>S1</option><option>S2</option></select>
              </div>
            </div>
            <div className="grid2" style={{ gap: 12 }}>
              <div className="field">
                <label>Lecturer</label>
                <select name="lecturer">{[...new Set(COURSES.map((c) => c.lecturer))].map((l) => <option key={l}>{l}</option>)}</select>
              </div>
              <div className="field"><label>Prerequisite (optional)</label><input name="prereq" placeholder="e.g. BBA111" /></div>
            </div>
            <button className="btn primary" type="submit">Add to curriculum</button>
          </form>
        </Modal>
      )}
      <Toast msg={toast} />
    </>
  )
}

// the registration Business Process: eligibility → holds → prereqs →
// capacity → charge assessment → enrol (rules visible, Workday-style)
const REG_STUDENTS = ['Ruusa Nghidinwa', 'Gabriel !Naruseb', 'Justina Haikali', 'Tuhafeni Gaoseb', 'Rauna Nakale']
const PASSED_PREREQ = ['Ruusa Nghidinwa', 'Gabriel !Naruseb'] // mock transcript check

function Enrolments() {
  const [toast, showToast] = useToast()
  const [showReg, setShowReg] = useState(false)
  const [student, setStudent] = useState(REG_STUDENTS[0])
  const [courseCode, setCourseCode] = useState(COURSES[0].code)

  const course = COURSES.find((c) => c.code === courseCode)
  const hold = HOLDS.find((h) => h.student === student)
  const prereqOk = course.prereq === '—' || PASSED_PREREQ.includes(student)
  const seatOk = course.enrolled < course.cap
  const checks = [
    ['Student status active', true, 'no suspension on record'],
    ['No registration holds', !hold, hold ? `${hold.type} hold — ${hold.reason}` : 'clear'],
    [`Prerequisite (${course.prereq})`, prereqOk, prereqOk ? 'satisfied on transcript' : `${course.prereq} not completed with the minimum mark`],
    ['Seat available', seatOk, seatOk ? `${course.cap - course.enrolled} of ${course.cap} left` : 'class full — waitlist open'],
    ['Credit limit (max 32/semester)', true, `would be at ${18 + course.credits} / 32`],
    ['No timetable clash', true, 'no overlap with current registrations'],
  ]
  const eligible = checks.every(([, ok]) => ok)
  const charge = course.credits * 950 + 400

  const confirm = () => {
    setShowReg(false)
    showToast(`${student} enrolled in ${course.code} — ${fmtN(charge)} posted to student account, seat reserved`)
  }

  return (
    <>
      <div className="note-banner">
        <span>ℹ️</span>
        <div style={{ flex: 1 }}>
          <strong>Add/drop closes 17 Jul 2026</strong> — after that, class lists lock and any change
          needs registrar approval (written to the audit log).
        </div>
        <button className="btn primary sm" style={{ flexShrink: 0 }} onClick={() => setShowReg(true)}>Register student</button>
      </div>
      <Panel
        title="Semester 2 enrolments — class capacity"
        subtitle="Registration per course · waitlist opens when a class is full"
        actions={<button className="btn ghost sm" onClick={() => showToast('Add/drop period closed — class lists locked')}>🔒 Close add/drop</button>}
        flush
      >
        <table className="data">
          <thead>
            <tr>
              <th>Course</th><th>Lecturer</th><th className="num">Enrolled</th>
              <th className="num">Capacity</th><th style={{ width: '28%' }}>Fill</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {COURSES.map((c) => {
              const pct = Math.round((c.enrolled / c.cap) * 100)
              return (
                <tr key={c.code}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.title}</div>
                    <div className="mono" style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>{c.code}</div>
                  </td>
                  <td>{c.lecturer}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{c.enrolled}</td>
                  <td className="num">{c.cap}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Progress pct={pct} tone={pct >= 100 ? 'amber' : ''} />
                      <span className="mono" style={{ fontSize: 12 }}>{pct}%</span>
                    </div>
                  </td>
                  <td>
                    {pct >= 100 ? <Badge tone="red">Full · waitlist</Badge> : pct >= 90 ? <Badge tone="orange">Nearly full</Badge> : <Badge tone="green">Open</Badge>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Panel>

      {showReg && (
        <Modal title="Course registration — business process" onClose={() => setShowReg(false)} width={520}>
          <div className="grid2" style={{ gap: 12 }}>
            <div className="field">
              <label>Student</label>
              <select value={student} onChange={(e) => setStudent(e.target.value)}>
                {REG_STUDENTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Course section</label>
              <select value={courseCode} onChange={(e) => setCourseCode(e.target.value)}>
                {COURSES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.title}</option>)}
              </select>
            </div>
          </div>

          <div style={{ margin: '4px 0 6px', fontSize: 12, fontWeight: 700, color: 'var(--petrol-800)' }}>
            ELIGIBILITY RULES — EVALUATED LIVE
          </div>
          {checks.map(([label, ok, note]) => (
            <div key={label} className="cf-row" style={{ padding: '5px 0', fontSize: 12.5 }}>
              <span>
                <span style={{ color: ok ? 'var(--green)' : 'var(--red)', fontWeight: 700, marginRight: 8 }}>{ok ? '✓' : '✕'}</span>
                {label}
              </span>
              <span style={{ color: ok ? 'var(--ink-faint)' : 'var(--red)', fontSize: 11.5, textAlign: 'right', maxWidth: 240 }}>{note}</span>
            </div>
          ))}

          {eligible ? (
            <>
              <div style={{ margin: '14px 0 6px', fontSize: 12, fontWeight: 700, color: 'var(--petrol-800)' }}>
                CHARGE ASSESSMENT — AUTO
              </div>
              <div className="cf-row" style={{ fontSize: 12.5 }}><span>{course.credits} credits × N$ 950</span><span className="mono">{fmtN(course.credits * 950)}</span></div>
              <div className="cf-row" style={{ fontSize: 12.5 }}><span>Registration levy</span><span className="mono">{fmtN(400)}</span></div>
              <div className="cf-row total"><span>Posts to student account</span><span className="amt">{fmtN(charge)}</span></div>
              <button className="btn primary" style={{ marginTop: 14 }} onClick={confirm}>
                Confirm enrolment — notify student & lecturer
              </button>
            </>
          ) : !seatOk && !hold && prereqOk ? (
            <button className="btn amber" style={{ marginTop: 14 }} onClick={() => { setShowReg(false); showToast(`${student} added to the ${course.code} waitlist — position 3, auto-enrols on a drop`) }}>
              Class full — join waitlist
            </button>
          ) : (
            <div className="note-banner" style={{ marginTop: 14, marginBottom: 0 }}>
              <span>🚫</span>
              <div>
                <strong>Registration blocked by the rules engine.</strong>{' '}
                {hold ? 'The hold must be resolved (payment or advising) — it then auto-releases and registration re-opens.' : 'The prerequisite must appear as completed on the transcript.'}
              </div>
            </div>
          )}
        </Modal>
      )}
      <Toast msg={toast} />
    </>
  )
}

// Academic Progress Report — requirements vs the student's catalog year
const REQ_TONE = { Satisfied: 'green', 'In progress': 'amber', 'Not satisfied': 'red' }

function DegreeAudit() {
  const names = Object.keys(DEGREE_AUDIT)
  const [who, setWho] = useState(names[0])
  const a = DEGREE_AUDIT[who]
  const total = a.reqs[a.reqs.length - 1]
  const pct = Math.round((total.done / total.need) * 100)

  return (
    <div className="grid2">
      <Panel
        title="Academic progress"
        subtitle={`${a.prog} · catalog year ${a.catalog} — requirements evaluated against this cohort's rules`}
        actions={
          <select className="inline" value={who} onChange={(e) => setWho(e.target.value)}>
            {names.map((n) => <option key={n}>{n}</option>)}
          </select>
        }
      >
        <Donut
          center={`${pct}%`}
          segs={[
            ['Completed', Math.max(total.done, 0.01), 'var(--green)'],
            ['In progress', Math.max(total.inprog, 0.01), 'var(--amber)'],
            ['Remaining', Math.max(total.need - total.done - total.inprog, 0.01), '#dfe7ee'],
          ]}
        />
        <div className="cf-row" style={{ paddingTop: 14, fontWeight: 700 }}>
          <span>Programme GPA</span>
          <span className="mono">{a.gpa.toFixed(2)} / 4.00</span>
        </div>
      </Panel>

      <Panel title="Requirements" subtitle="Credits: completed · in progress · still needed" flush>
        <table className="data">
          <thead>
            <tr><th>Requirement</th><th className="num">Need</th><th className="num">Done</th><th className="num">In prog.</th><th className="num">Left</th><th>Status</th></tr>
          </thead>
          <tbody>
            {a.reqs.map((r) => (
              <tr key={r.req}>
                <td style={{ fontWeight: 600, fontSize: 12.5 }}>{r.req}</td>
                <td className="num">{r.need}</td>
                <td className="num" style={{ color: 'var(--green)' }}>{r.done}</td>
                <td className="num" style={{ color: 'var(--orange)' }}>{r.inprog}</td>
                <td className="num" style={{ fontWeight: 600 }}>{Math.max(r.need - r.done - r.inprog, 0)}</td>
                <td><Badge tone={REQ_TONE[r.status]}>{r.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}
