import React, { useState } from 'react'
import { Tabs, Panel, Badge, Modal, Toast, useToast } from '../ui.jsx'
import { PERIODS, TIMETABLES, DUTY_ROSTER, RELIEF_TODAY, SUBJECT_STYLES } from '../data.js'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

export default function Scheduling() {
  const [tab, setTab] = useState('Relief — Today')

  return (
    <>
      <Tabs tabs={['Relief — Today', 'Academic Timetable', 'Staff Duty Roster']} active={tab} onChange={setTab} />
      {tab === 'Relief — Today' && <ReliefBoard />}
      {tab === 'Academic Timetable' && <Timetable />}
      {tab === 'Staff Duty Roster' && <DutyRoster />}
    </>
  )
}

// the 06:30 problem: a teacher is out — who covers each period?
function ReliefBoard() {
  const [board, setBoard] = useState(RELIEF_TODAY)
  const [toast, showToast] = useToast()
  const uncovered = board.flatMap((t) => t.periods).filter((p) => !p.cover).length

  const assign = (ti, pi, name) => {
    setBoard((b) =>
      b.map((t, i) =>
        i === ti ? { ...t, periods: t.periods.map((p, j) => (j === pi ? { ...p, cover: name } : p)) } : t
      )
    )
    const p = board[ti].periods[pi]
    showToast(`${name} covers ${p.cls} ${p.subject} (${p.p}) — notified`)
  }

  return (
    <>
      {uncovered > 0 ? (
        <div className="banner">
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div><strong>{uncovered} period{uncovered > 1 ? 's' : ''} still uncovered today</strong> — assign relief before P1 starts at 07:30.</div>
        </div>
      ) : (
        <div className="note-banner">
          <span>✅</span>
          <div><strong>All periods covered.</strong> Relief staff have been notified of their assignments.</div>
        </div>
      )}

      {board.map((t, ti) => (
        <Panel
          key={t.teacher}
          title={`${t.teacher} — absent`}
          subtitle={`Reason: ${t.reason} · ${t.periods.length} period${t.periods.length > 1 ? 's' : ''} to cover`}
          flush
        >
          <table className="data">
            <thead>
              <tr><th>Period</th><th>Class</th><th>Subject</th><th>Room</th><th>Cover</th></tr>
            </thead>
            <tbody>
              {t.periods.map((p, pi) => (
                <tr key={p.p}>
                  <td className="mono" style={{ fontWeight: 600 }}>{p.p}</td>
                  <td>{p.cls}</td>
                  <td>{p.subject}</td>
                  <td>{p.room}</td>
                  <td>
                    {p.cover ? (
                      <Badge tone="green">✓ {p.cover}</Badge>
                    ) : (
                      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {p.options.map((o) => (
                          <button key={o} className="btn ghost sm" onClick={() => assign(ti, pi, o)}>
                            {o} <span style={{ color: 'var(--ink-faint)' }}>(free)</span>
                          </button>
                        ))}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ))}
      <Toast msg={toast} />
    </>
  )
}

export function TimetableGrid({ data }) {
  return (
    <div className="tt-grid">
      <div />
      {DAYS.map((d) => (
        <div key={d} className="tt-head">{d}</div>
      ))}
      {PERIODS.map((p) =>
        p.id === 'BRK' ? (
          <React.Fragment key={p.id}>
            <div className="tt-period">
              Break<span className="ptime">{p.time}</span>
            </div>
            {DAYS.map((d) => (
              <div key={d} className="tt-slot break">BREAK</div>
            ))}
          </React.Fragment>
        ) : (
          <React.Fragment key={p.id}>
            <div className="tt-period">
              {p.id}<span className="ptime">{p.time}</span>
            </div>
            {data[p.id].map((slot, i) =>
              slot ? (
                <div key={i} className={`tt-slot ${SUBJECT_STYLES[slot.s] || 'subj-sci'}`}>
                  {slot.s}
                  <span className="room">{slot.r}</span>
                </div>
              ) : (
                <div key={i} className="tt-slot empty" />
              )
            )}
          </React.Fragment>
        )
      )}
    </div>
  )
}

const ROOMS = ['Rm 4', 'Rm 7', 'Rm 9', 'Rm 12', 'Lab 1', 'Lab 2', 'Wksp 1']

function Timetable() {
  const [cls, setCls] = useState('DBA-6 Y1')
  const [tts, setTts] = useState(TIMETABLES)
  const [showNew, setShowNew] = useState(false)
  const [slotSel, setSlotSel] = useState({ day: 0, period: 'P1' })
  const [toast, showToast] = useToast()

  const occupied = tts[cls][slotSel.period]?.[slotSel.day]

  const addSlot = (e) => {
    e.preventDefault()
    const f = e.target
    const slot = { s: f.subject.value, r: f.room.value }
    setTts((t) => ({
      ...t,
      [cls]: {
        ...t[cls],
        [slotSel.period]: t[cls][slotSel.period].map((s, i) => (i === slotSel.day ? slot : s)),
      },
    }))
    setShowNew(false)
    showToast(`${slot.s} scheduled — ${cls}, ${DAYS[slotSel.day]} ${slotSel.period}`)
  }

  return (
    <>
    <Panel
      title="Weekly timetable"
      subtitle={`${cls} · Semester 2, 2026`}
      actions={
        <>
          <select className="inline"><option>Semester 2, 2026</option><option>Semester 1, 2026</option></select>
          <select className="inline" value={cls} onChange={(e) => setCls(e.target.value)}>
            {Object.keys(tts).map((c) => <option key={c}>{c}</option>)}
          </select>
          <button className="btn primary sm" onClick={() => setShowNew(true)}>+ New slot</button>
        </>
      }
    >
      <TimetableGrid data={tts[cls]} />
      <div className="legend">
        {Object.entries(SUBJECT_STYLES).map(([s, c]) => (
          <div key={s} className="li">
            <span className={`sw ${c}`} style={{ display: 'inline-block' }} /> {s}
          </div>
        ))}
        <div className="li"><span className="sw" style={{ border: '1px dashed var(--line)', background: '#f6f9fb' }} /> Free period</div>
      </div>
    </Panel>

    {showNew && (
      <Modal title={`New slot — ${cls}`} onClose={() => setShowNew(false)}>
        <form onSubmit={addSlot}>
          <div className="grid2" style={{ gap: 12 }}>
            <div className="field">
              <label>Day</label>
              <select value={slotSel.day} onChange={(e) => setSlotSel((s) => ({ ...s, day: Number(e.target.value) }))}>
                {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Period</label>
              <select value={slotSel.period} onChange={(e) => setSlotSel((s) => ({ ...s, period: e.target.value }))}>
                {PERIODS.filter((p) => p.id !== 'BRK').map((p) => <option key={p.id}>{p.id}</option>)}
              </select>
            </div>
          </div>
          <div className="grid2" style={{ gap: 12 }}>
            <div className="field">
              <label>Subject</label>
              <select name="subject">{Object.keys(SUBJECT_STYLES).map((s) => <option key={s}>{s}</option>)}</select>
            </div>
            <div className="field">
              <label>Room</label>
              <select name="room">{ROOMS.map((r) => <option key={r}>{r}</option>)}</select>
            </div>
          </div>
          {occupied && (
            <div className="note-banner" style={{ background: 'var(--orange-soft)', borderColor: '#eeddbc', color: 'var(--orange)' }}>
              <span>⚠</span>
              <div>Conflict: {occupied.s} ({occupied.r}) already occupies this slot — it will be replaced.</div>
            </div>
          )}
          <button className="btn primary" type="submit">{occupied ? 'Replace slot' : 'Add slot'}</button>
        </form>
      </Modal>
    )}
    <Toast msg={toast} />
    </>
  )
}

const DUTY_TONE = { 'Exam invigilation': 'purple', 'Lab supervision': 'teal', 'Workshop supervision': 'amber', 'Student advising': 'blue', 'Front desk': 'green', 'Open day desk': 'orange', 'Library support': 'blue' }
const DUTY_TYPES = ['Exam invigilation', 'Lab supervision', 'Workshop supervision', 'Student advising', 'Front desk', 'Library support', '—']

function DutyRoster() {
  const [roster, setRoster] = useState(DUTY_ROSTER)
  const [showAssign, setShowAssign] = useState(false)
  const [toast, showToast] = useToast()

  const assign = (e) => {
    e.preventDefault()
    const f = e.target
    const staff = f.staff.value
    const day = Number(f.day.value)
    const duty = f.duty.value
    setRoster((rs) => rs.map((r) => (r.staff === staff ? { ...r, duties: r.duties.map((d, i) => (i === day ? duty : d)) } : r)))
    setShowAssign(false)
    showToast(duty === '—' ? `Duty cleared — ${staff}, ${DAYS[day]}` : `${duty} assigned to ${staff} on ${DAYS[day]}`)
  }

  return (
    <>
    <Panel
      title="Staff duty roster"
      subtitle="Gate, break yard, assembly & transport supervision — this week"
      actions={<button className="btn primary sm" onClick={() => setShowAssign(true)}>+ Assign duty</button>}
      flush
    >
      <table className="data">
        <thead>
          <tr>
            <th>Staff member</th>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d) => <th key={d}>{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {roster.map((r) => (
            <tr key={r.staff}>
              <td style={{ fontWeight: 600 }}>{r.staff}</td>
              {r.duties.map((d, i) => (
                <td key={i}>
                  {d === '—' ? <span style={{ color: 'var(--ink-faint)' }}>—</span> : <Badge tone={DUTY_TONE[d] || 'gray'}>{d}</Badge>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>

    {showAssign && (
      <Modal title="Assign duty" onClose={() => setShowAssign(false)}>
        <form onSubmit={assign}>
          <div className="field">
            <label>Staff member</label>
            <select name="staff">{roster.map((r) => <option key={r.staff}>{r.staff}</option>)}</select>
          </div>
          <div className="grid2" style={{ gap: 12 }}>
            <div className="field">
              <label>Day</label>
              <select name="day">{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select>
            </div>
            <div className="field">
              <label>Duty</label>
              <select name="duty">{DUTY_TYPES.map((d) => <option key={d} value={d}>{d === '—' ? '— (clear)' : d}</option>)}</select>
            </div>
          </div>
          <button className="btn primary" type="submit">Assign</button>
        </form>
      </Modal>
    )}
    <Toast msg={toast} />
    </>
  )
}
