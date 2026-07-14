import React, { useState } from 'react'
import { Panel, Badge, Toast, useToast } from '../ui.jsx'
import { PROGRAMMES, ADMISSION_STAGES } from '../data.js'

// Public applicant self-service — submit an application and track its stage.
export default function ApplyOnline({ role }) {
  const [toast, showToast] = useToast()
  const [app, setApp] = useState(null) // submitted application

  const submit = (e) => {
    e.preventDefault()
    const f = e.target
    setApp({ prog: f.prog.value, points: f.points.value, stage: 'Applied' })
    showToast('Application submitted — you will be notified as it progresses')
  }

  return (
    <>
      {!app ? (
        <Panel title="Apply online — 2027 intake" subtitle={`Welcome ${role.user} · complete your application below`}>
          <form onSubmit={submit} style={{ maxWidth: 460 }}>
            <div className="field"><label>Programme of interest</label>
              <select name="prog">{PROGRAMMES.map((p) => <option key={p.code} value={p.code}>{p.name} (NQF {p.nqf})</option>)}</select>
            </div>
            <div className="field"><label>Grade 12 points (NSSCO)</label><input name="points" type="number" min="0" defaultValue="30" required /></div>
            <div className="field"><label>Upload documents</label>
              <div className="di-sub">Grade 12 certificate · ID copy · proof of application fee (N$ 150)</div>
            </div>
            <button className="btn primary" type="submit">Submit application</button>
          </form>
        </Panel>
      ) : (
        <Panel title="My application" subtitle="Track your admission status">
          <div className="cf-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <span>Programme</span><span style={{ fontWeight: 600 }}>{PROGRAMMES.find((p) => p.code === app.prog)?.name}</span>
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
          <div className="di-sub" style={{ marginTop: 12 }}>Your application is at <strong>{app.stage}</strong>. The admissions office will review your documents next.</div>
          <button className="btn ghost sm" style={{ marginTop: 14 }} onClick={() => showToast('Application withdrawn')}>Withdraw application</button>
        </Panel>
      )}
      <Toast msg={toast} />
    </>
  )
}
