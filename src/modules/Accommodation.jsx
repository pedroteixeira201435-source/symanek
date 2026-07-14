import React, { useState } from 'react'
import { StatCard, Panel, Badge, Progress, Toast, useToast } from '../ui.jsx'
import { RESIDENCES, ALLOCATIONS, RES_WAITLIST, fmtN } from '../data.js'

// Student residences — occupancy, room allocation, residence fees, waitlist.
export default function Accommodation() {
  const [toast, showToast] = useToast()
  const [waitlist, setWaitlist] = useState(RES_WAITLIST)

  const totalRooms = RESIDENCES.reduce((s, r) => s + r.rooms, 0)
  const occupied = RESIDENCES.reduce((s, r) => s + r.occupied, 0)

  const allocate = (w) => {
    setWaitlist((ws) => ws.filter((x) => x.student !== w.student))
    showToast(`${w.student} allocated a room in ${w.pref}`)
  }

  return (
    <>
      <div className="stat-row c4">
        <StatCard icon="🏠" label="Residences" value={String(RESIDENCES.length)} delta="on campus" deltaTone="neutral" />
        <StatCard icon="🛏️" label="Occupancy" value={`${occupied}/${totalRooms}`} delta={`${Math.round((occupied / totalRooms) * 100)}% full`} deltaTone="neutral" />
        <StatCard icon="📝" label="Waitlist" value={String(waitlist.length)} delta="awaiting a room" deltaTone="down" />
        <StatCard icon="💰" label="Residence fees" value={fmtN(ALLOCATIONS.reduce((s, a) => s + a.fee, 0))} delta="billed this term" deltaTone="up" />
      </div>

      <Panel title="Blocks & occupancy">
        {RESIDENCES.map((r) => (
          <div key={r.block} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
            <div className="cf-row" style={{ marginBottom: 8 }}>
              <span style={{ fontWeight: 600 }}>{r.block} <span className="di-sub">· {fmtN(r.fee)}/term</span></span>
              <span className="mono" style={{ fontSize: 12.5 }}>{r.occupied}/{r.rooms}{r.occupied >= r.rooms && <Badge tone="red"> Full</Badge>}</span>
            </div>
            <Progress pct={(r.occupied / r.rooms) * 100} tone={r.occupied >= r.rooms ? 'red' : ''} />
          </div>
        ))}
      </Panel>

      <div className="grid2">
        <Panel title="Current allocations" flush>
          <table className="data">
            <thead><tr><th>Student</th><th>Room</th><th className="num">Fee</th></tr></thead>
            <tbody>
              {ALLOCATIONS.map((a) => (
                <tr key={a.student}><td style={{ fontWeight: 600 }}>{a.student}</td><td>{a.block} · {a.room}</td><td className="num">{fmtN(a.fee)}</td></tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Waitlist" subtitle="Allocate as rooms free up" flush>
          <table className="data">
            <thead><tr><th>Student</th><th>Preference</th><th style={{ width: 110 }}></th></tr></thead>
            <tbody>
              {waitlist.length === 0 ? (
                <tr><td colSpan={3} className="di-sub" style={{ padding: 12 }}>Waitlist cleared</td></tr>
              ) : waitlist.map((w) => (
                <tr key={w.student}>
                  <td style={{ fontWeight: 600 }}>{w.student}</td><td>{w.pref} <span className="di-sub">· {w.since}</span></td>
                  <td><button className="btn primary sm" onClick={() => allocate(w)}>Allocate</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
      <Toast msg={toast} />
    </>
  )
}
