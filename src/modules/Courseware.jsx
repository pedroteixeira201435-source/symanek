import React, { useState } from 'react'
import { Tabs, Panel, Badge, Progress, Toast, useToast } from '../ui.jsx'
import { COURSES, COURSEWARE, COURSE_RESULTS, DEGREE_AUDIT } from '../data.js'

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
      <CourseView code={active} isTeacher={isTeacher} />
    </>
  )
}

function CourseView({ code, isTeacher }) {
  const c = COURSES.find((x) => x.code === code)
  const cw = COURSEWARE[code]
  const [toast, showToast] = useToast()
  const [done, setDone] = useState({}) // student submissions

  return (
    <>
      <Panel title={`${code} — ${c?.title}`} subtitle={`${c?.prog} · ${c?.credits} credits · ${c?.lecturer}`}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', margin: '2px 0 8px' }}>MATERIALS</div>
        {cw.materials.map((m) => (
          <div key={m.title} className="cf-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <span><Badge tone="blue">{m.week}</Badge> {m.title} <span className="di-sub">· {m.type}</span></span>
            <button className="btn ghost sm" onClick={() => showToast(isTeacher ? `${m.title} — visible to enrolled students` : `${m.title} downloaded`)}>
              {isTeacher ? 'Manage' : '⬇ Download'}
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
              <th>{isTeacher ? 'Submissions' : 'Status'}</th><th style={{ width: 150 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {cw.assignments.map((a) => (
              <tr key={a.id}>
                <td style={{ fontWeight: 600 }}>{a.title}</td>
                <td>{a.due}</td>
                <td className="num">{a.points}</td>
                <td>
                  {isTeacher
                    ? <span className="mono">{a.submitted}/{a.total}</span>
                    : <Badge tone={done[a.id] ? 'green' : 'amber'}>{done[a.id] ? 'Submitted' : 'Not submitted'}</Badge>}
                </td>
                <td>
                  {isTeacher ? (
                    <button className="btn ghost sm" onClick={() => showToast(`Grading ${a.submitted} submissions for ${a.title}`)}>Grade</button>
                  ) : done[a.id] ? (
                    <Badge tone="green">✓ Done</Badge>
                  ) : (
                    <button className="btn primary sm" onClick={() => { setDone((d) => ({ ...d, [a.id]: true })); showToast(`${a.title} submitted`) }}>Submit</button>
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
