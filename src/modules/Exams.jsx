import React, { useCallback, useEffect, useState } from 'react'
import { StatCard, Panel, Badge, Modal, Toast, useToast, Icon } from '../ui.jsx'
import { listExamSchedule, listCourses, listStaffAccounts, examSittingUpsert, examSittingDelete } from '../api.js'
import { SUBJECT_TYPES, EXAM_CONFIG, PASS, WEIGHTS, POLICY_SUMMARY } from '../lib/academics.js'

export default function Exams() {
  const [toast, showToast] = useToast()
  const [schedule, setSchedule] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // null = closed, {} = new, sitting = edit
  const [courses, setCourses] = useState([])
  const [staff, setStaff] = useState([])

  const reload = useCallback(() => listExamSchedule().then(setSchedule).catch(() => setSchedule([])), [])
  useEffect(() => { reload().finally(() => setLoading(false)) }, [reload])
  useEffect(() => {
    listCourses().then((cs) => setCourses([...cs].sort((a, b) => a.code.localeCompare(b.code)))).catch(() => setCourses([]))
    listStaffAccounts().then(setStaff).catch(() => setStaff([]))
  }, [])

  // datetime-local values are Windhoek wall time (UTC+2, no DST)
  const toLocalInput = (iso) => iso ? new Date(new Date(iso).getTime() + 2 * 3600e3).toISOString().slice(0, 16) : ''
  const save = async (ev) => {
    ev.preventDefault(); const f = ev.target
    try {
      await examSittingUpsert({ id: editing.id ?? null, courseId: f.course.value, at: f.at.value ? `${f.at.value}:00+02:00` : null, venue: f.venue.value, seats: Number(f.seats.value) || 0, invigilatorId: f.invigilator.value || null })
      setEditing(null); await reload(); showToast('Sitting saved')
    } catch (err) { showToast('Could not save: ' + (err?.message || err)) }
  }
  const remove = async (e) => {
    if (!window.confirm(`Delete the ${e.code} sitting?`)) return
    try { await examSittingDelete(e.id); await reload(); showToast('Sitting deleted') }
    catch (err) { showToast('Could not delete: ' + (err?.message || err)) }
  }

  const totalSeats = schedule.reduce((s, e) => s + (e.seats || 0), 0)
  const totalSat = schedule.reduce((s, e) => s + (e.sat || 0), 0)

  if (loading) return <Panel title="Examinations" flush><Empty>Loading...</Empty></Panel>

  return (
    <>
      <div className="stat-row c4">
        <StatCard icon="📅" label="Sittings" value={String(schedule.length)} delta="exam period" deltaTone="neutral" />
        <StatCard icon="🪑" label="Seats booked" value={`${totalSat}/${totalSeats}`} delta="across all venues" deltaTone="neutral" />
        <StatCard icon="👤" label="Invigilators" value={String(new Set(schedule.map((e) => e.invigilator).filter(Boolean)).size)} delta="assigned" deltaTone="up" />
        <StatCard icon="🏫" label="Venues" value={String(new Set(schedule.map((e) => e.venue).filter(Boolean)).size)} delta="halls / labs" deltaTone="neutral" />
      </div>

      <Panel title="Assessment & examination policy" subtitle="Institutional marking rules applied across every module">
        <div className="note-banner" style={{ marginTop: 0 }}>
          <Icon name="edit" size={16} />
          <div>{POLICY_SUMMARY}</div>
        </div>
        <div className="grid2" style={{ gap: 14, marginTop: 8 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 8 }}>SUBJECT TYPES · FORMATIVE ASSESSMENTS</div>
            {Object.values(SUBJECT_TYPES).map((t) => (
              <div key={t.key} className="cf-row" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontWeight: 600 }}>{t.label}</span>
                <span className="mono" style={{ fontSize: 12.5 }}>{t.formativeCount} assessments · {t.tests} tests + {t.assignments} assignment{t.assignments > 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 8 }}>MARKS & THRESHOLDS</div>
            {[
              ['Weighting', `${Math.round(WEIGHTS.ca * 100)}% CA + ${Math.round(WEIGHTS.exam * 100)}% exam`],
              ['Examination', `Out of ${EXAM_CONFIG.outOf} marks · ${EXAM_CONFIG.durationHours} hours`],
              ['Formative pass', `${PASS.formativeMin}% minimum per assessment`],
              ['Module pass', `${PASS.moduleFinalMin}% final mark`],
              ['Exam paper pass', `${PASS.examPaperMin}% minimum`],
              ['Second opportunity', `${PASS.secondOppLow}-${PASS.secondOppHigh}% final mark`],
            ].map(([k, v]) => (
              <div key={k} className="cf-row" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <span>{k}</span><span className="mono" style={{ fontSize: 12.5, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <Panel title="Exam timetable & venues" subtitle="Seat allocation and invigilation roster" actions={<button className="btn primary sm" onClick={() => setEditing({})}>+ Add sitting</button>} flush>
        {schedule.length === 0 ? <Empty>No examination sittings yet.</Empty> : (
          <table className="data">
            <thead><tr><th>Course</th><th>Date</th><th>Time</th><th>Venue</th><th className="num">Seats</th><th>Invigilator</th><th></th></tr></thead>
            <tbody>
              {schedule.map((e) => (
                <tr key={e.id || e.code}>
                  <td><div style={{ fontWeight: 600 }}>{e.code}</div><div className="di-sub">{e.title}</div></td>
                  <td>{e.date || '-'}</td>
                  <td className="mono">{e.time || '-'}</td>
                  <td>{e.venue || '-'}</td>
                  <td className="num">{e.sat || 0}/{e.seats || 0}</td>
                  <td>{e.invigilator || '-'}</td>
                  <td><button className="btn ghost sm" onClick={() => setEditing(e)}>Edit</button> <button className="btn ghost sm" onClick={() => remove(e)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      {editing && <Modal title={editing.id ? 'Edit sitting' : 'Add sitting'} onClose={() => setEditing(null)}>
        <form onSubmit={save}>
          <div className="field"><label>Course</label>
            <select name="course" required defaultValue={editing.courseId || ''}><option value="">Select a course…</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}</select></div>
          <div className="grid2" style={{ gap: 12 }}>
            <div className="field"><label>Date & time</label><input name="at" type="datetime-local" required defaultValue={toLocalInput(editing.at)} /></div>
            <div className="field"><label>Seats</label><input name="seats" type="number" min="0" defaultValue={editing.seats} /></div>
          </div>
          <div className="grid2" style={{ gap: 12 }}>
            <div className="field"><label>Venue</label><input name="venue" placeholder="Hall A" defaultValue={editing.venue} /></div>
            <div className="field"><label>Invigilator</label>
              <select name="invigilator" defaultValue={editing.invigilatorId || ''}><option value="">— None —</option>{staff.map((s) => <option key={s.uuid} value={s.uuid}>{s.name}</option>)}</select></div>
          </div>
          <button className="btn primary" type="submit">Save</button>
        </form>
      </Modal>}
      <Toast msg={toast} />
    </>
  )
}

function Empty({ children }) {
  return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)' }}>{children}</div>
}
