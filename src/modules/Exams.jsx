import React from 'react'
import { StatCard, Panel, Badge, Toast, useToast } from '../ui.jsx'
import { EXAM_SCHEDULE } from '../data.js'
import { SUBJECT_TYPES, EXAM_CONFIG, PASS, WEIGHTS, POLICY_SUMMARY } from '../lib/academics.js'

// Examinations logistics — sittings, venues, seat allocation, invigilation.
export default function Exams() {
  const [toast, showToast] = useToast()
  const totalSeats = EXAM_SCHEDULE.reduce((s, e) => s + e.seats, 0)
  const totalSat = EXAM_SCHEDULE.reduce((s, e) => s + e.sat, 0)

  return (
    <>
      <div className="stat-row c4">
        <StatCard icon="📅" label="Sittings" value={String(EXAM_SCHEDULE.length)} delta="Nov 2026 exam period" deltaTone="neutral" />
        <StatCard icon="🪑" label="Seats booked" value={`${totalSat}/${totalSeats}`} delta="across all venues" deltaTone="neutral" />
        <StatCard icon="👤" label="Invigilators" value={String(new Set(EXAM_SCHEDULE.map((e) => e.invigilator)).size)} delta="assigned" deltaTone="up" />
        <StatCard icon="🏫" label="Venues" value={String(new Set(EXAM_SCHEDULE.map((e) => e.venue)).size)} delta="halls / labs / workshop" deltaTone="neutral" />
      </div>

      <Panel title="Assessment & examination policy" subtitle="Institutional marking rules applied across every module">
        <div className="note-banner" style={{ marginTop: 0 }}>
          <span>📐</span>
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
              ['Second opportunity', `${PASS.secondOppLow}–${PASS.secondOppHigh}% final mark`],
            ].map(([k, v]) => (
              <div key={k} className="cf-row" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <span>{k}</span><span className="mono" style={{ fontSize: 12.5, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </Panel>
      <Panel
        title="Exam timetable & venues"
        subtitle="Seat allocation and invigilation roster for the November 2026 sitting"
        actions={<button className="btn primary sm" onClick={() => showToast('Exam timetable published to students & lecturers')}>Publish timetable</button>}
        flush
      >
        <table className="data">
          <thead>
            <tr><th>Course</th><th>Date</th><th>Time</th><th>Venue</th><th className="num">Seats</th><th>Invigilator</th><th style={{ width: 130 }}></th></tr>
          </thead>
          <tbody>
            {EXAM_SCHEDULE.map((e) => (
              <tr key={e.code}>
                <td><div style={{ fontWeight: 600 }}>{e.code}</div><div className="di-sub">{e.title}</div></td>
                <td>{e.date}</td>
                <td className="mono">{e.time}</td>
                <td>{e.venue}</td>
                <td className="num" style={{ color: e.sat >= e.seats ? 'var(--red)' : 'var(--ink)' }}>{e.sat}/{e.seats}</td>
                <td>{e.invigilator}</td>
                <td><button className="btn ghost sm" onClick={() => showToast(`Seating plan generated for ${e.code}`)}>Seating</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Toast msg={toast} />
    </>
  )
}
