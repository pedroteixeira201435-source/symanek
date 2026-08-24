import React, { useCallback, useEffect, useState } from 'react'
import { Tabs, Panel, Badge, Toast, useToast } from '../ui.jsx'
import { ROLES, SCHOOL } from '../lib/institution.js'
import { getInstitution, setInstitution, listRolePermissions, getBusinessSettings, setBusinessSetting } from '../api.js'

export default function Settings() {
  const [tab, setTab] = useState('Institution')
  return (
    <>
      <Tabs tabs={['Institution', 'Roles', 'Business rules', 'Audit log']} active={tab} onChange={setTab} />
      {tab === 'Institution' && <Institution />}
      {tab === 'Roles' && <Roles />}
      {tab === 'Business rules' && <BusinessRules />}
      {tab === 'Audit log' && <AuditLog />}
    </>
  )
}

function Institution() {
  const [toast, showToast] = useToast()
  const [inst, setInst] = useState(null)
  const [loading, setLoading] = useState(true)
  const reload = useCallback(() => getInstitution().then((r) => setInst(r || SCHOOL)).catch(() => setInst(SCHOOL)), [])
  useEffect(() => { reload().finally(() => setLoading(false)) }, [reload])
  const save = async (e) => {
    e.preventDefault(); const f = e.target
    try { await setInstitution({ name: f.name.value.trim(), type: f.type.value.trim() || 'college' }); await reload(); showToast('Institution saved') }
    catch (err) { showToast('Could not save: ' + (err?.message || err)) }
  }
  if (loading) return <Panel title="Institution profile" flush><Empty>Loading...</Empty></Panel>
  return (
    <Panel title="Institution profile" subtitle="Backend institution settings">
      <form onSubmit={save} style={{ maxWidth: 520 }}>
        <div className="field"><label>Name</label><input name="name" defaultValue={inst?.name || SCHOOL.name} required /></div>
        <div className="field"><label>Institution type</label><input name="type" defaultValue={inst?.type || 'college'} /></div>
        <button className="btn primary" type="submit">Save</button>
      </form>
      <Toast msg={toast} />
    </Panel>
  )
}

function Roles() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { listRolePermissions().then(setRows).catch(() => setRows([])).finally(() => setLoading(false)) }, [])
  if (loading) return <Panel title="Role permissions" flush><Empty>Loading...</Empty></Panel>
  return (
    <Panel title="Role permissions" subtitle="Server-side permission matrix" flush>
      {rows.length === 0 ? (
        <table className="data"><thead><tr><th>Role</th><th>Description</th><th>Status</th></tr></thead>
          <tbody>{ROLES.map((r) => <tr key={r.id}><td>{r.name}</td><td>{r.desc}</td><td><Badge tone="gray">No backend matrix yet</Badge></td></tr>)}</tbody>
        </table>
      ) : (
        <table className="data"><thead><tr><th>Role</th><th>Module</th><th>View</th><th>Edit</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}><td>{r.role}</td><td>{r.module}</td><td><Badge tone={r.can_view ? 'green' : 'gray'}>{r.can_view ? 'Yes' : 'No'}</Badge></td><td><Badge tone={r.can_edit ? 'green' : 'gray'}>{r.can_edit ? 'Yes' : 'No'}</Badge></td></tr>)}</tbody>
        </table>
      )}
    </Panel>
  )
}

function BusinessRules() {
  const [toast, showToast] = useToast()
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const reload = useCallback(() => getBusinessSettings().then(setSettings).catch(() => setSettings(null)), [])
  useEffect(() => { reload().finally(() => setLoading(false)) }, [reload])
  const saveBands = async (e) => {
    e.preventDefault()
    try {
      const value = JSON.parse(e.currentTarget.grade_bands.value)
      await setBusinessSetting('grade_bands', value)
      await reload(); showToast('Grade bands saved')
    } catch (err) { showToast('Could not save grade bands: ' + (err?.message || err)) }
  }
  if (loading) return <Panel title="Business rules" flush><Empty>Loading...</Empty></Panel>
  return (
    <>
      <Panel title="Business rules" subtitle="Editable backend settings">
        <form onSubmit={saveBands}>
          <div className="field"><label>Grade bands JSON</label><textarea name="grade_bands" rows={8} defaultValue={JSON.stringify(settings?.grade_bands || [], null, 2)} /></div>
          <button className="btn primary" type="submit">Save grade bands</button>
        </form>
      </Panel>
      <Toast msg={toast} />
    </>
  )
}

function AuditLog() {
  return <Panel title="Audit log" subtitle="TODO(backend): audit log RPC" flush><Empty>No audit log backend is available yet.</Empty></Panel>
}

function Empty({ children }) {
  return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)' }}>{children}</div>
}
