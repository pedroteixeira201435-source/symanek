import React, { useState, useEffect, useCallback } from 'react'
import { StatCard, Panel, Badge, Progress, Toast, useToast, Modal } from '../ui.jsx'
import { fmtN } from '../lib/format.js'
import {
  listResidencesFull, listAllocations, listStudents,
  residenceUpsert, residenceDelete, allocateRoomRpc, allocationSetStatus,
} from '../api.js'

// Student residences — occupancy, room allocation, residence fees, waitlist.
// Empty by default; the registrar adds residences and allocates rooms.
export default function Accommodation() {
  const [toast, showToast] = useToast()
  const [residences, setResidences] = useState([])
  const [allocations, setAllocations] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showRes, setShowRes] = useState(false)
  const [showAlloc, setShowAlloc] = useState(false)

  const reload = useCallback(() => Promise.all([
    listResidencesFull().then(setResidences).catch(() => setResidences([])),
    listAllocations().then(setAllocations).catch(() => setAllocations([])),
    listStudents().then(setStudents).catch(() => setStudents([])),
  ]), [])
  useEffect(() => { reload().finally(() => setLoading(false)) }, [reload])

  const totalRooms = residences.reduce((s, r) => s + (r.capacity || 0), 0)
  const occupied = residences.reduce((s, r) => s + (r.allocated || 0), 0)
  const waitlisted = residences.reduce((s, r) => s + (r.waitlisted || 0), 0)
  const feesBilled = allocations.filter((a) => a.status === 'allocated').reduce((s, a) => s + Number(a.fee || 0), 0)

  const addResidence = async (e) => {
    e.preventDefault(); const f = e.target
    try { await residenceUpsert({ name: f.name.value.trim(), capacity: Number(f.capacity.value) }) }
    catch (err) { showToast('Could not save' + (err?.message ? `: ${err.message}` : '')); return }
    setShowRes(false); await reload(); showToast('Residence saved')
  }
  const removeResidence = async (r) => {
    try { await residenceDelete(r.id) } catch (err) { showToast('Could not delete' + (err?.message ? `: ${err.message}` : '')); return }
    await reload(); showToast(`${r.name} removed`)
  }
  const allocate = async (e) => {
    e.preventDefault(); const f = e.target
    try {
      const res = await allocateRoomRpc({ studentId: f.student.value, residenceId: f.residence.value, room: f.room.value.trim(), fee: Number(f.fee.value) })
      setShowAlloc(false); await reload()
      showToast(res.result?.status === 'waitlisted' ? 'Residence full — student waitlisted' : 'Room allocated')
    } catch (err) { showToast('Could not allocate' + (err?.message ? `: ${err.message}` : '')) }
  }
  const setStatus = async (a, status) => {
    try { await allocationSetStatus(a.id, status); await reload(); showToast(status === 'vacated' ? 'Room vacated' : 'Allocation updated') }
    catch (err) { showToast('Could not update' + (err?.message ? `: ${err.message}` : '')) }
  }

  if (loading) return <Panel title="Accommodation" flush><Empty>Loading…</Empty></Panel>

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 4 }}>
        <button className="btn ghost sm" onClick={() => setShowRes(true)}>+ Add residence</button>
        <button className="btn primary sm" onClick={() => setShowAlloc(true)} disabled={residences.length === 0 || students.length === 0}>+ Allocate room</button>
      </div>

      <div className="stat-row c4">
        <StatCard icon="🏠" label="Residences" value={String(residences.length)} delta="on campus" deltaTone="neutral" />
        <StatCard icon="🛏️" label="Occupancy" value={`${occupied}/${totalRooms}`} delta={totalRooms ? `${Math.round((occupied / totalRooms) * 100)}% full` : '—'} deltaTone="neutral" />
        <StatCard icon="📝" label="Waitlist" value={String(waitlisted)} delta="awaiting a room" deltaTone="down" />
        <StatCard icon="💰" label="Residence fees" value={fmtN(feesBilled)} delta="billed (allocated)" deltaTone="up" />
      </div>

      <Panel title="Blocks & occupancy">
        {residences.length === 0 ? <Empty>No residences yet — add one to start.</Empty> : residences.map((r) => (
          <div key={r.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
            <div className="cf-row" style={{ marginBottom: 8 }}>
              <span style={{ fontWeight: 600 }}>{r.name}</span>
              <span className="mono" style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                {r.allocated}/{r.capacity}{r.allocated >= r.capacity && r.capacity > 0 && <Badge tone="red">Full</Badge>}
                <button className="btn ghost sm" onClick={() => removeResidence(r)}>Delete</button>
              </span>
            </div>
            <Progress pct={r.capacity ? (r.allocated / r.capacity) * 100 : 0} tone={r.allocated >= r.capacity && r.capacity > 0 ? 'red' : ''} />
          </div>
        ))}
      </Panel>

      <Panel title="Allocations" flush>
        {allocations.length === 0 ? <Empty>No allocations yet.</Empty> : (
          <table className="data">
            <thead><tr><th>Student</th><th>Residence</th><th>Room</th><th className="num">Fee</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {allocations.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.student}</td>
                  <td>{a.residence}</td>
                  <td>{a.room || '—'}</td>
                  <td className="num">{fmtN(a.fee)}</td>
                  <td><Badge tone={a.status === 'allocated' ? 'green' : a.status === 'waitlisted' ? 'amber' : 'gray'}>{a.status}</Badge></td>
                  <td>
                    {a.status === 'waitlisted' && <button className="btn primary sm" onClick={() => setStatus(a, 'allocated')}>Allocate</button>}
                    {a.status === 'allocated' && <button className="btn ghost sm" onClick={() => setStatus(a, 'vacated')}>Vacate</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {showRes && (
        <Modal title="Add residence" onClose={() => setShowRes(false)}>
          <form onSubmit={addResidence}>
            <div className="field"><label>Name</label><input name="name" required /></div>
            <div className="field"><label>Capacity (rooms/beds)</label><input name="capacity" type="number" min="0" defaultValue="0" required /></div>
            <button className="btn primary" type="submit">Save</button>
          </form>
        </Modal>
      )}
      {showAlloc && (
        <Modal title="Allocate room" onClose={() => setShowAlloc(false)}>
          <form onSubmit={allocate}>
            <div className="field"><label>Student</label>
              <select name="student" required>{students.map((s) => <option key={s._uuid} value={s._uuid}>{s.name}</option>)}</select>
            </div>
            <div className="field"><label>Residence</label>
              <select name="residence" required>{residences.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.allocated}/{r.capacity})</option>)}</select>
            </div>
            <div className="grid2" style={{ gap: 12 }}>
              <div className="field"><label>Room</label><input name="room" placeholder="e.g. B-12" /></div>
              <div className="field"><label>Fee / term</label><input name="fee" type="number" min="0" defaultValue="0" /></div>
            </div>
            <button className="btn primary" type="submit">Allocate</button>
          </form>
        </Modal>
      )}
      <Toast msg={toast} />
    </>
  )
}

function Empty({ children }) {
  return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)' }}>{children}</div>
}
