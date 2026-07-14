import React, { useEffect, useState } from 'react'
import { StatCard, Panel, Badge, Avatar, Modal, Toast, useToast } from '../ui.jsx'
import { SCHOOL, LEARNERS, INVOICES, GRADEBOOKS, LOANS, INCIDENTS, HOLDS, gradeOf, fmtN } from '../data.js'

// Student 360 — every module converges on one learner file:
// account (Finance), marks (Gradebooks), library loans, incidents, attendance.
// `focus` (a learner name from global search) opens that 360 directly.
export default function Students({ focus, clearFocus, go }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(null)
  const [learners, setLearners] = useState(LEARNERS)
  const [showAdd, setShowAdd] = useState(false)
  const [toast, showToast] = useToast()

  useEffect(() => {
    if (!focus) return
    const hit = LEARNERS.find((l) => l.name === focus)
    if (hit) setSel(hit)
    clearFocus()
  }, [focus, clearFocus])

  const addLearner = (e) => {
    e.preventDefault()
    const f = e.target
    const l = {
      id: `STU-${1300 + learners.length}`, name: f.name.value, grade: f.grade.value,
      guardian: f.guardian.value || '(pending)', phone: f.phone.value || '+264 81 000 0000',
      status: 'Enrolled', attendance: 100,
    }
    setLearners((ls) => [l, ...ls])
    setShowAdd(false)
    showToast(`${l.name} enrolled — ${l.id} · Term 3 invoice will be generated`)
  }

  const rows = learners.filter(
    (s) =>
      s.name.toLowerCase().includes(q.toLowerCase()) ||
      s.grade.toLowerCase().includes(q.toLowerCase()) ||
      s.id.toLowerCase().includes(q.toLowerCase())
  )

  const balance = (name) => INVOICES.filter((i) => i.learner === name).reduce((s, i) => s + i.balance, 0)

  return (
    <>
      <div className="stat-row c4">
        <StatCard icon="🎓" label="Enrolled" value={SCHOOL.learners} delta="+18 this semester" />
        <StatCard icon="🏛️" label="Programmes" value="5" delta="DBA-6 → Bridging" deltaTone="neutral" />
        <StatCard icon="⏰" label="Avg attendance" value="94%" delta="Target 95%" deltaTone="neutral" />
        <StatCard icon="⚠️" label="In arrears" value="94" delta="N$ 210,000 outstanding" deltaTone="down" />
      </div>

      <Panel
        title="Student register"
        subtitle={`Sample of ${LEARNERS.length} (of ${SCHOOL.learners}) · click a student for the full 360° file`}
        actions={
          <>
            <input
              className="inline"
              style={{ width: 220 }}
              placeholder="Search name, grade or ID…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="btn primary sm" onClick={() => setShowAdd(true)}>+ Add learner</button>
          </>
        }
        flush
      >
        <table className="data">
          <thead>
            <tr>
              <th>Student</th><th>ID</th><th>Programme</th><th>Next of kin</th>
              <th className="num">Attendance</th><th className="num">Balance</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const bal = balance(s.name)
              return (
                <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => setSel(s)}>
                  <td>
                    <div className="emp-cell">
                      <Avatar name={s.name} />
                      <span className="en">{s.name}</span>
                    </div>
                  </td>
                  <td className="mono" style={{ fontSize: 12.5 }}>{s.id}</td>
                  <td>{s.grade}</td>
                  <td>{s.guardian}</td>
                  <td className="num" style={{ color: s.attendance < 85 ? 'var(--red)' : 'var(--ink)' }}>{s.attendance}%</td>
                  <td className="num" style={{ color: bal > 0 ? 'var(--red)' : 'var(--ink-faint)' }}>{fmtN(bal)}</td>
                  <td><Badge tone={s.status === 'Sponsored' ? 'purple' : 'green'}>{s.status}</Badge></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Panel>

      {showAdd && (
        <Modal title="Add learner" onClose={() => setShowAdd(false)} width={440}>
          <form onSubmit={addLearner}>
            <div className="field"><label>Full name</label><input name="name" placeholder="e.g. Ndeshi Amwaama" required /></div>
            <div className="grid2" style={{ gap: 12 }}>
              <div className="field">
                <label>Programme / year</label>
                <select name="grade">
                  <option>DBA-6 Y1</option><option>DAF-6 Y1</option><option>CIT-5 Y1</option>
                  <option>CVT-4 Y1</option><option>BED-7 Y1</option>
                </select>
              </div>
              <div className="field"><label>Next of kin phone</label><input name="phone" placeholder="+264 81 …" /></div>
            </div>
            <div className="field"><label>Next of kin name</label><input name="guardian" placeholder="e.g. Meme N. Amwaama" /></div>
            <button className="btn primary" type="submit">Enrol student</button>
          </form>
        </Modal>
      )}

      {sel && <Student360 s={sel} onClose={() => setSel(null)} go={go} showToast={showToast} />}
      <Toast msg={toast} />
    </>
  )
}

function Student360({ s, onClose, go, showToast }) {
  const invoices = INVOICES.filter((i) => i.learner === s.name)
  const marks = Object.entries(GRADEBOOKS).flatMap(([cls, rows]) =>
    rows.filter((r) => r.learner === s.name).map((r) => ({ cls, ...r }))
  )
  const loans = LOANS.filter((l) => l.borrower === s.name)
  const incidents = INCIDENTS.filter((i) => i.learner === s.name)
  const bal = invoices.reduce((sum, i) => sum + i.balance, 0)
  const hold = HOLDS.find((h) => h.student === s.name)

  return (
    <Modal title="Student 360°" onClose={onClose} width={640}>
      <div className="s360-head">
        <Avatar name={s.name} size={52} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{s.name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
            {s.id} · {s.grade} · Next of kin: {s.guardian} · {s.phone}
          </div>
        </div>
        <Badge tone={s.status === 'Sponsored' ? 'purple' : 'green'}>{s.status}</Badge>
      </div>

      {hold && (
        <div className="note-banner" style={{ background: 'var(--red-soft)', borderColor: '#eccfc9', color: 'var(--red)' }}>
          <span>🚫</span>
          <div style={{ color: 'var(--ink)' }}>
            <strong style={{ color: 'var(--red)' }}>{hold.type} hold since {hold.since}</strong> — {hold.reason}.{' '}
            {hold.impact.map((i) => <Badge key={i} tone="red">{i}</Badge>)}{' '}
            <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Auto-releases when the condition clears.</span>
          </div>
        </div>
      )}

      <div className="s360-grid">
        <div className="s360-sec">
          <div className="st">Account · Finance</div>
          {invoices.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>No invoices this term</div>
          ) : (
            invoices.map((i) => (
              <div key={i.id} className="cf-row" style={{ padding: '4px 0', fontSize: 12.5 }}>
                <span>{i.id} · due {i.due}</span>
                <span className="mono" style={{ color: i.balance > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
                  {i.balance > 0 ? fmtN(i.balance) + ' due' : 'Paid'}
                </span>
              </div>
            ))
          )}
          <div className="cf-row" style={{ paddingTop: 8, fontWeight: 700 }}>
            <span>Balance</span><span className="mono">{fmtN(bal)}</span>
          </div>
        </div>

        <div className="s360-sec">
          <div className="st">Academics · Term marks</div>
          {marks.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>Marks held by class lecturers</div>
          ) : (
            marks.map((m) => (
              <div key={m.cls} className="cf-row" style={{ padding: '4px 0', fontSize: 12.5 }}>
                <span>{m.cls} · Phys. Science</span>
                <span className="mono" style={{ fontWeight: 600, color: m.t3 < 50 ? 'var(--red)' : 'var(--ink)' }}>
                  {m.t1} → {m.t2} → {m.t3}
                </span>
              </div>
            ))
          )}
          <div className="cf-row" style={{ paddingTop: 8 }}>
            <span>Attendance</span>
            <span className="mono" style={{ fontWeight: 700, color: s.attendance < 85 ? 'var(--red)' : 'var(--green)' }}>
              {s.attendance}%
            </span>
          </div>
        </div>

        <div className="s360-sec">
          <div className="st">Library</div>
          {loans.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>No books out</div>
          ) : (
            loans.map((l) => (
              <div key={l.id} className="cf-row" style={{ padding: '4px 0', fontSize: 12.5 }}>
                <span>{l.book}</span>
                <Badge tone={l.status === 'Overdue' ? 'red' : 'blue'}>{l.status}</Badge>
              </div>
            ))
          )}
        </div>

        <div className="s360-sec">
          <div className="st">Transcript · GPA</div>
          {marks.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>Published by the exam board</div>
          ) : (
            <>
              {marks.map((m) => {
                const g = gradeOf(m.t3)
                return (
                  <div key={m.cls} className="cf-row" style={{ padding: '4px 0', fontSize: 12.5 }}>
                    <span>{m.cls} · Phys. Science</span>
                    <span className="mono" style={{ fontWeight: 600, color: g.letter === 'F' ? 'var(--red)' : 'var(--ink)' }}>
                      {g.letter} · {g.gpa.toFixed(1)}
                    </span>
                  </div>
                )
              })}
              <div className="cf-row" style={{ paddingTop: 8, fontWeight: 700 }}>
                <span>Cumulative GPA</span>
                <span className="mono">
                  {(marks.reduce((s, m) => s + gradeOf(m.t3).gpa, 0) / marks.length).toFixed(2)} / 4.00
                </span>
              </div>
            </>
          )}
        </div>

        <div className="s360-sec">
          <div className="st">Incidents & contact log</div>
          {incidents.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>Clean record</div>
          ) : (
            incidents.map((i, idx) => (
              <div key={idx} style={{ fontSize: 12.5, padding: '4px 0' }}>
                <strong>{i.date}</strong> — {i.type} → {i.action} <span style={{ color: 'var(--ink-faint)' }}>({i.by})</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
        <button className="btn primary sm" onClick={() => { onClose(); go && go('finance') }}>Record payment</button>
        <button className="btn ghost sm" onClick={() => showToast(`Statement for ${s.name} sent to ${s.guardian}`)}>Send statement</button>
        <button className="btn ghost sm" onClick={() => showToast(`Incident logged on ${s.name}'s file — HOD notified`)}>Log incident</button>
      </div>
    </Modal>
  )
}
