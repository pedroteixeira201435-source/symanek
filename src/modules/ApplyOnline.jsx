import React, { useCallback, useEffect, useState } from 'react'
import { Panel, Badge, Toast, useToast } from '../ui.jsx'
import { isHttpMode, listProgrammes } from '../api.js'

const ADMISSION_STAGES = ['Applied', 'Under Review', 'Offer Sent', 'Enrolled']

export default function ApplyOnline({ role }) {
  const [toast, showToast] = useToast()
  const [programmes, setProgrammes] = useState([])
  const [loading, setLoading] = useState(true)
  const [app, setApp] = useState(null)

  const reload = useCallback(() => listProgrammes().then(setProgrammes).catch(() => setProgrammes([])), [])
  useEffect(() => { reload().finally(() => setLoading(false)) }, [reload])

  const submit = (e) => {
    e.preventDefault()
    const f = e.target
    setApp({ prog: f.prog.value, points: f.points.value, stage: 'Applied' })
    showToast('Application captured locally. Use the public site for production submission.')
  }

  if (isHttpMode()) {
    const site = 'https://symanekacademy.com'
    return (
      <>
        <Panel title="Apply to Symanek" subtitle="Applications are handled on the public website">
          <div className="di-sub" style={{ maxWidth: 560, lineHeight: 1.6 }}>
            Use the public college website to submit the authoritative application, receive the reference,
            upload EFT proof and track the process.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <a className="btn primary" href={`${site}/apply`} target="_blank" rel="noopener noreferrer">Start an application</a>
            <a className="btn ghost" href={`${site}/portal`} target="_blank" rel="noopener noreferrer">Track my application</a>
          </div>
        </Panel>
        <Toast msg={toast} />
      </>
    )
  }

  if (loading) return <Panel title="Apply online" flush><Empty>Loading...</Empty></Panel>

  return (
    <>
      {!app ? (
        <Panel title="Apply online" subtitle={`Welcome ${role.user} · development preview only`}>
          {programmes.length === 0 ? <Empty>No programmes are available yet.</Empty> : (
            <form onSubmit={submit} style={{ maxWidth: 460 }}>
              <div className="field"><label>Programme of interest</label>
                <select name="prog">{programmes.map((p) => <option key={p.code} value={p.code}>{p.name} (NQF {p.nqf})</option>)}</select>
              </div>
              <div className="field"><label>Grade 12 points (NSSCO)</label><input name="points" type="number" min="0" defaultValue="30" required /></div>
              <button className="btn primary" type="submit">Submit application</button>
            </form>
          )}
        </Panel>
      ) : (
        <Panel title="My application" subtitle="Track your admission status">
          <div className="cf-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <span>Programme</span><span style={{ fontWeight: 600 }}>{programmes.find((p) => p.code === app.prog)?.name || app.prog}</span>
          </div>
          <div className="cf-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <span>Grade 12 points</span><span className="mono">{app.points}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            {ADMISSION_STAGES.map((s, i) => (
              <div key={s} style={{ flex: 1, textAlign: 'center' }}>
                <Badge tone={i === 0 ? 'green' : 'blue'}>{s}</Badge>
              </div>
            ))}
          </div>
        </Panel>
      )}
      <Toast msg={toast} />
    </>
  )
}

function Empty({ children }) {
  return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)' }}>{children}</div>
}
