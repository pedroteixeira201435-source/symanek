import React, { useState, useEffect, useCallback } from 'react'
import { Tabs, Panel, Badge, Modal, Toast, useToast } from '../ui.jsx'
import {
  listTimetable, timetableSet, timetableClear, listPeriods, periodSet, periodDelete,
  listDutyRoster, dutySet, dutyDelete, listRelief, reliefSet, reliefDelete, listStaffOptions,
} from '../api.js'

const DAYS = ['—', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Shared read-only timetable used by the student portal. The operational
// timetable below is a staff editor; keeping this small renderer exported lets
// the portal render its own timetable without importing staff controls.
export function TimetableGrid({ data = {} }) {
  const periods = Object.keys(data)
  if (!periods.length) return <Empty>No timetable published yet.</Empty>
  return (
    <div className="tt-grid">
      <div />
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => <div key={day} className="tt-head">{day}</div>)}
      {periods.map((period) => (
        <React.Fragment key={period}>
          <div className="tt-period">{period}</div>
          {(data[period] || []).slice(0, 5).map((slot, index) => (
            <div key={index} className={`tt-slot ${slot ? 'subj-sci' : 'empty'}`}>
              {slot && <>{slot.s}<span className="room">{slot.r}</span></>}
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  )
}

export default function Scheduling() {
  const [tab, setTab] = useState('Academic Timetable')
  return (
    <>
      <Tabs tabs={['Academic Timetable', 'Periods', 'Staff Duty Roster', 'Relief / Cover']} active={tab} onChange={setTab} />
      {tab === 'Academic Timetable' && <Timetable />}
      {tab === 'Periods' && <Periods />}
      {tab === 'Staff Duty Roster' && <DutyRoster />}
      {tab === 'Relief / Cover' && <Relief />}
    </>
  )
}

function Empty({ children }) { return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)' }}>{children}</div> }

function Timetable() {
  const [slots, setSlots] = useState([])
  const [periods, setPeriods] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [filter, setFilter] = useState('')
  const [toast, showToast] = useToast()

  const reload = useCallback(() => Promise.all([
    listTimetable().then(setSlots).catch(() => setSlots([])),
    listPeriods().then(setPeriods).catch(() => setPeriods([])),
    listStaffOptions().then(setStaff).catch(() => setStaff([])),
  ]), [])
  useEffect(() => { reload().finally(() => setLoading(false)) }, [reload])

  const classes = [...new Set(slots.map((s) => s.classGroup))].sort()
  const shown = filter ? slots.filter((s) => s.classGroup === filter) : slots

  const add = async (e) => {
    e.preventDefault(); const f = e.target
    try {
      const res = await timetableSet({
        classGroup: f.cls.value.trim(), day: Number(f.day.value), period: f.period.value,
        subject: f.subject.value.trim(), venue: f.venue.value.trim() || null,
        lecturerStaffNo: f.lecturer.value || null,
      })
      if (res.ok === false) throw new Error(res.error)
    } catch (err) { showToast('Could not save slot' + (err?.message ? `: ${err.message}` : '')); return }
    setShowNew(false); await reload(); showToast('Slot scheduled')
  }
  const clear = async (s) => { try { await timetableClear(s.id); await reload(); showToast('Slot cleared') } catch (err) { showToast('Could not clear' + (err?.message ? `: ${err.message}` : '')) } }

  if (loading) return <Panel title="Timetable" flush><Empty>Loading…</Empty></Panel>
  return (
    <>
      <Panel
        title="Academic timetable"
        subtitle="One row per scheduled class period"
        actions={
          <span style={{ display: 'flex', gap: 8 }}>
            <select className="inline" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All classes</option>{classes.map((c) => <option key={c}>{c}</option>)}
            </select>
            <button className="btn primary sm" onClick={() => setShowNew(true)} disabled={periods.length === 0}>+ New slot</button>
          </span>
        }
        flush
      >
        {periods.length === 0 ? <Empty>Define periods first (Periods tab), then add timetable slots.</Empty>
          : shown.length === 0 ? <Empty>No timetable slots yet.</Empty> : (
            <table className="data">
              <thead><tr><th>Class</th><th>Day</th><th>Period</th><th>Subject</th><th>Venue</th><th>Lecturer</th><th></th></tr></thead>
              <tbody>
                {shown.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.classGroup}</td><td>{DAYS[s.day]}</td><td className="mono">{s.period}</td>
                    <td>{s.subject}</td><td>{s.venue || '—'}</td><td>{s.lecturer || '—'}</td>
                    <td><button className="btn ghost sm" onClick={() => clear(s)}>Clear</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </Panel>

      {showNew && (
        <Modal title="New timetable slot" onClose={() => setShowNew(false)}>
          <form onSubmit={add}>
            <div className="grid2" style={{ gap: 12 }}>
              <div className="field"><label>Class group</label><input name="cls" placeholder="e.g. Aux Nursing Y1" required /></div>
              <div className="field"><label>Day</label><select name="day">{[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{DAYS[d]}</option>)}</select></div>
            </div>
            <div className="grid2" style={{ gap: 12 }}>
              <div className="field"><label>Period</label><select name="period">{periods.map((p) => <option key={p.id} value={p.id}>{p.id} — {p.label}</option>)}</select></div>
              <div className="field"><label>Venue</label><input name="venue" placeholder="e.g. Lab 1" /></div>
            </div>
            <div className="field"><label>Subject</label><input name="subject" required /></div>
            <div className="field"><label>Lecturer</label><select name="lecturer"><option value="">—</option>{staff.map((s) => <option key={s.uuid} value={s.staffNo}>{s.name}</option>)}</select></div>
            <button className="btn primary" type="submit">Add slot</button>
          </form>
        </Modal>
      )}
      <Toast msg={toast} />
    </>
  )
}

function Periods() {
  const [periods, setPeriods] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [toast, showToast] = useToast()
  const reload = useCallback(() => listPeriods().then(setPeriods).catch(() => setPeriods([])), [])
  useEffect(() => { reload().finally(() => setLoading(false)) }, [reload])

  const add = async (e) => {
    e.preventDefault(); const f = e.target
    try { await periodSet({ id: f.id.value.trim(), label: f.label.value.trim(), start: f.start.value, end: f.end.value, ord: Number(f.ord.value) }) }
    catch (err) { showToast('Could not save' + (err?.message ? `: ${err.message}` : '')); return }
    setShowNew(false); await reload(); showToast('Period saved')
  }
  const remove = async (p) => { try { await periodDelete(p.id); await reload(); showToast(`${p.id} removed`) } catch (err) { showToast('Could not delete' + (err?.message ? `: ${err.message}` : '')) } }

  if (loading) return <Panel title="Periods" flush><Empty>Loading…</Empty></Panel>
  return (
    <>
      <Panel title="Timetable periods" subtitle="The daily period grid used by the timetable"
        actions={<button className="btn primary sm" onClick={() => setShowNew(true)}>+ Add period</button>} flush>
        {periods.length === 0 ? <Empty>No periods yet — add P1, P2, … to build the day.</Empty> : (
          <table className="data">
            <thead><tr><th>ID</th><th>Label</th><th>Start</th><th>End</th><th className="num">Order</th><th></th></tr></thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.id}><td className="mono" style={{ fontWeight: 600 }}>{p.id}</td><td>{p.label}</td><td>{p.start_time || '—'}</td><td>{p.end_time || '—'}</td><td className="num">{p.ord}</td>
                  <td><button className="btn ghost sm" onClick={() => remove(p)}>Delete</button></td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      {showNew && (
        <Modal title="Add period" onClose={() => setShowNew(false)}>
          <form onSubmit={add}>
            <div className="grid2" style={{ gap: 12 }}>
              <div className="field"><label>ID</label><input name="id" placeholder="P1" required /></div>
              <div className="field"><label>Label</label><input name="label" placeholder="Period 1" required /></div>
            </div>
            <div className="grid2" style={{ gap: 12 }}>
              <div className="field"><label>Start</label><input name="start" placeholder="07:30" /></div>
              <div className="field"><label>End</label><input name="end" placeholder="08:20" /></div>
            </div>
            <div className="field"><label>Order</label><input name="ord" type="number" defaultValue="0" /></div>
            <button className="btn primary" type="submit">Save</button>
          </form>
        </Modal>
      )}
      <Toast msg={toast} />
    </>
  )
}

function DutyRoster() {
  const [roster, setRoster] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [toast, showToast] = useToast()
  const reload = useCallback(() => Promise.all([
    listDutyRoster().then(setRoster).catch(() => setRoster([])),
    listStaffOptions().then(setStaff).catch(() => setStaff([])),
  ]), [])
  useEffect(() => { reload().finally(() => setLoading(false)) }, [reload])

  const add = async (e) => {
    e.preventDefault(); const f = e.target
    try { await dutySet({ day: Number(f.day.value), area: f.area.value.trim(), staffId: f.staff.value || null }) }
    catch (err) { showToast('Could not save' + (err?.message ? `: ${err.message}` : '')); return }
    setShowNew(false); await reload(); showToast('Duty assigned')
  }
  const remove = async (d) => { try { await dutyDelete(d.id); await reload(); showToast('Duty removed') } catch (err) { showToast('Could not delete' + (err?.message ? `: ${err.message}` : '')) } }

  if (loading) return <Panel title="Duty roster" flush><Empty>Loading…</Empty></Panel>
  return (
    <>
      <Panel title="Staff duty roster" actions={<button className="btn primary sm" onClick={() => setShowNew(true)}>+ Assign duty</button>} flush>
        {roster.length === 0 ? <Empty>No duties assigned yet.</Empty> : (
          <table className="data">
            <thead><tr><th>Day</th><th>Area</th><th>Staff</th><th></th></tr></thead>
            <tbody>
              {roster.map((d) => (
                <tr key={d.id}><td>{DAYS[d.day_of_week]}</td><td style={{ fontWeight: 600 }}>{d.area}</td><td>{d.staff || <span style={{ color: 'var(--ink-faint)' }}>unassigned</span>}</td>
                  <td><button className="btn ghost sm" onClick={() => remove(d)}>Delete</button></td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      {showNew && (
        <Modal title="Assign duty" onClose={() => setShowNew(false)}>
          <form onSubmit={add}>
            <div className="grid2" style={{ gap: 12 }}>
              <div className="field"><label>Day</label><select name="day">{[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{DAYS[d]}</option>)}</select></div>
              <div className="field"><label>Area</label><input name="area" placeholder="e.g. Front desk" required /></div>
            </div>
            <div className="field"><label>Staff</label><select name="staff"><option value="">— unassigned</option>{staff.map((s) => <option key={s.uuid} value={s.uuid}>{s.name}</option>)}</select></div>
            <button className="btn primary" type="submit">Assign</button>
          </form>
        </Modal>
      )}
      <Toast msg={toast} />
    </>
  )
}

function Relief() {
  const [board, setBoard] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [toast, showToast] = useToast()
  const reload = useCallback(() => Promise.all([
    listRelief().then(setBoard).catch(() => setBoard([])),
    listStaffOptions().then(setStaff).catch(() => setStaff([])),
  ]), [])
  useEffect(() => { reload().finally(() => setLoading(false)) }, [reload])

  const add = async (e) => {
    e.preventDefault(); const f = e.target
    try { await reliefSet({ date: f.date.value || null, absentId: f.absent.value || null, coverId: f.cover.value || null, classGroup: f.cls.value.trim(), periodId: f.period.value.trim(), note: f.note.value.trim() }) }
    catch (err) { showToast('Could not save' + (err?.message ? `: ${err.message}` : '')); return }
    setShowNew(false); await reload(); showToast('Cover recorded')
  }
  const remove = async (r) => { try { await reliefDelete(r.id); await reload(); showToast('Removed') } catch (err) { showToast('Could not delete' + (err?.message ? `: ${err.message}` : '')) } }

  if (loading) return <Panel title="Relief" flush><Empty>Loading…</Empty></Panel>
  return (
    <>
      <Panel title="Relief / cover — today" subtitle="Who covers for absent staff" actions={<button className="btn primary sm" onClick={() => setShowNew(true)}>+ Record cover</button>} flush>
        {board.length === 0 ? <Empty>No cover recorded for today.</Empty> : (
          <table className="data">
            <thead><tr><th>Period</th><th>Class</th><th>Absent</th><th>Cover</th><th>Note</th><th></th></tr></thead>
            <tbody>
              {board.map((r) => (
                <tr key={r.id}><td className="mono">{r.period_id || '—'}</td><td>{r.class_group || '—'}</td><td>{r.absent || '—'}</td>
                  <td>{r.cover ? <Badge tone="green">{r.cover}</Badge> : <span style={{ color: 'var(--ink-faint)' }}>unassigned</span>}</td><td>{r.note || '—'}</td>
                  <td><button className="btn ghost sm" onClick={() => remove(r)}>Delete</button></td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      {showNew && (
        <Modal title="Record cover" onClose={() => setShowNew(false)}>
          <form onSubmit={add}>
            <div className="grid2" style={{ gap: 12 }}>
              <div className="field"><label>Date</label><input name="date" type="date" /></div>
              <div className="field"><label>Period</label><input name="period" placeholder="P1" /></div>
            </div>
            <div className="field"><label>Class</label><input name="cls" placeholder="e.g. Aux Nursing Y1" /></div>
            <div className="grid2" style={{ gap: 12 }}>
              <div className="field"><label>Absent staff</label><select name="absent"><option value="">—</option>{staff.map((s) => <option key={s.uuid} value={s.uuid}>{s.name}</option>)}</select></div>
              <div className="field"><label>Cover staff</label><select name="cover"><option value="">—</option>{staff.map((s) => <option key={s.uuid} value={s.uuid}>{s.name}</option>)}</select></div>
            </div>
            <div className="field"><label>Note</label><input name="note" /></div>
            <button className="btn primary" type="submit">Record</button>
          </form>
        </Modal>
      )}
      <Toast msg={toast} />
    </>
  )
}
