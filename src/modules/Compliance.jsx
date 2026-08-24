import React, { useState, useEffect, useCallback } from 'react'
import { StatCard, Panel, Badge, Toast, useToast, Modal } from '../ui.jsx'
import { listNcheReturnsFull, ncheReturnSet, listProgrammes, getInstitution, setInstitution } from '../api.js'

const INST_TYPES = ['Vocational college', 'Full university', 'Distance']
const RET_TONE = { accepted: 'green', submitted: 'amber', draft: 'red' }

// Regulatory compliance — NCHE statutory returns, programme register, and the
// institution profile. Empty by default; the registrar files returns.
export default function Compliance() {
  const [toast, showToast] = useToast()
  const [returns, setReturns] = useState([])
  const [programmes, setProgrammes] = useState([])
  const [inst, setInst] = useState(null)
  const [showRet, setShowRet] = useState(false)
  const [editRet, setEditRet] = useState(null)

  const reload = useCallback(() => Promise.all([
    listNcheReturnsFull().then(setReturns).catch(() => setReturns([])),
    listProgrammes().then(setProgrammes).catch(() => setProgrammes([])),
    getInstitution().then(setInst).catch(() => {}),
  ]), [])
  useEffect(() => { reload() }, [reload])

  const saveReturn = async (e) => {
    e.preventDefault(); const f = e.target
    try {
      await ncheReturnSet({
        id: editRet?.id ?? null, title: f.title.value.trim(), period: f.period.value.trim(),
        status: f.status.value, due: f.due.value || null,
      })
    } catch (err) { showToast('Could not save' + (err?.message ? `: ${err.message}` : '')); return }
    setShowRet(false); setEditRet(null); await reload(); showToast('Return saved')
  }
  const submit = async (r) => {
    try { await ncheReturnSet({ id: r.id, title: r.title, period: r.period, status: 'submitted', due: r.due }); await reload(); showToast(`${r.title} submitted to NCHE`) }
    catch (err) { showToast('Could not submit' + (err?.message ? `: ${err.message}` : '')) }
  }
  const saveInst = async (e) => {
    e.preventDefault(); const f = e.target
    try { await setInstitution({ name: f.name.value.trim(), type: f.type.value, modules: inst?.modules_enabled ?? null }) }
    catch (err) { showToast('Could not save institution' + (err?.message ? `: ${err.message}` : '')); return }
    await reload(); showToast('Institution profile updated')
  }

  return (
    <>
      <div className="stat-row c4">
        <StatCard icon="🏛️" label="Regulator" value="NCHE" delta="+ NQA / NTA" deltaTone="neutral" />
        <StatCard icon="📋" label="Returns" value={String(returns.length)} delta="on file" deltaTone="neutral" />
        <StatCard icon="✅" label="Accepted" value={String(returns.filter((r) => r.status === 'accepted').length)} deltaTone="up" />
        <StatCard icon="📚" label="Programmes" value={String(programmes.length)} delta="in register" deltaTone="neutral" />
      </div>

      <Panel title="Institution profile" subtitle="Tenant identity used across the suite and on official documents">
        {inst ? (
          <form onSubmit={saveInst} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="field" style={{ minWidth: 280 }}><label>Institution name</label><input name="name" defaultValue={inst.name} /></div>
            <div className="field" style={{ minWidth: 200 }}>
              <label>Institution type</label>
              <select name="type" defaultValue={inst.type}>{INST_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            </div>
            <button className="btn primary" type="submit">Save</button>
          </form>
        ) : <Empty>Institution profile unavailable.</Empty>}
      </Panel>

      <Panel
        title="NCHE statutory returns"
        actions={<button className="btn primary sm" onClick={() => { setEditRet(null); setShowRet(true) }}>+ Add return</button>}
        flush
      >
        {returns.length === 0 ? <Empty>No returns yet — add one.</Empty> : (
          <table className="data">
            <thead><tr><th>Return</th><th>Period</th><th>Due</th><th>Status</th><th style={{ width: 170 }}></th></tr></thead>
            <tbody>
              {returns.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.title}</td><td>{r.period || '—'}</td><td>{r.due || '—'}</td>
                  <td><Badge tone={RET_TONE[r.status]}>{r.status}</Badge></td>
                  <td>
                    <span style={{ display: 'flex', gap: 6 }}>
                      <button className="btn ghost sm" onClick={() => { setEditRet(r); setShowRet(true) }}>Edit</button>
                      {r.status !== 'submitted' && r.status !== 'accepted' && <button className="btn primary sm" onClick={() => submit(r)}>Submit</button>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title="Programme register" flush>
        {programmes.length === 0 ? <Empty>No programmes yet.</Empty> : (
          <table className="data">
            <thead><tr><th>Programme</th><th>Category</th><th>Level</th><th>Status</th></tr></thead>
            <tbody>
              {programmes.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td>{p.category}</td>
                  <td>{p.level || '—'}</td>
                  <td><Badge tone={p.active ? 'green' : 'gray'}>{p.active ? 'Active' : 'Inactive'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {showRet && (
        <Modal title={editRet ? 'Edit return' : 'Add NCHE return'} onClose={() => { setShowRet(false); setEditRet(null) }}>
          <form onSubmit={saveReturn}>
            <div className="field"><label>Return title</label><input name="title" defaultValue={editRet?.title || ''} required /></div>
            <div className="grid2" style={{ gap: 12 }}>
              <div className="field"><label>Period</label><input name="period" defaultValue={editRet?.period || ''} placeholder="e.g. 2026 H1" /></div>
              <div className="field"><label>Due date</label><input name="due" type="date" defaultValue={editRet?.due || ''} /></div>
            </div>
            <div className="field"><label>Status</label>
              <select name="status" defaultValue={editRet?.status || 'draft'}><option value="draft">draft</option><option value="submitted">submitted</option><option value="accepted">accepted</option></select>
            </div>
            <button className="btn primary" type="submit">Save</button>
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
