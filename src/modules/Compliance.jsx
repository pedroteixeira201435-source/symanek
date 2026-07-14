import React, { useState } from 'react'
import { StatCard, Panel, Badge, Toast, useToast } from '../ui.jsx'
import { NCHE_RETURNS, PROGRAMMES, INSTITUTION_TYPES, INSTITUTION_HIDE, getInstType } from '../data.js'

// Regulatory compliance — NCHE statutory returns, programme accreditation,
// and the institution-type profile (drives which modules a tenant sees).
export default function Compliance() {
  const [toast, showToast] = useToast()
  const [type, setType] = useState(getInstType())
  const [status, setStatus] = useState(Object.fromEntries(NCHE_RETURNS.map((r) => [r.ret, r.status])))

  const submit = (ret) => { setStatus((s) => ({ ...s, [ret]: 'Submitted' })); showToast(`${ret} submitted to NCHE`) }
  const tone = (s) => (s === 'Submitted' ? 'green' : s === 'In progress' ? 'amber' : 'red')

  const changeType = (t) => {
    setType(t)
    localStorage.setItem('sym.insttype', t)
    const hidden = INSTITUTION_HIDE[t] || []
    showToast(hidden.length ? `Type “${t}” — hiding: ${hidden.join(', ')}. Reloading…` : `Type “${t}” — all modules enabled. Reloading…`)
    setTimeout(() => window.location.reload(), 900)
  }

  return (
    <>
      <div className="stat-row c4">
        <StatCard icon="🏛️" label="Regulator" value="NCHE" delta="+ NQA / NTA accreditation" deltaTone="neutral" />
        <StatCard icon="📋" label="Returns due" value={String(NCHE_RETURNS.length)} delta="statutory this cycle" deltaTone="neutral" />
        <StatCard icon="✅" label="Accredited programmes" value={String(PROGRAMMES.filter((p) => /accredited|registered/i.test(p.accreditation)).length)} delta={`of ${PROGRAMMES.length}`} deltaTone="up" />
        <StatCard icon="⚠️" label="Provisional" value={String(PROGRAMMES.filter((p) => /provisional/i.test(p.accreditation)).length)} delta="need renewal" deltaTone="down" />
      </div>

      <Panel title="Institution profile" subtitle="Configures the tenant — the institution type shows or hides modules across the suite">
        <div className="field" style={{ maxWidth: 320 }}>
          <label>Institution type</label>
          <select value={type} onChange={(e) => changeType(e.target.value)}>
            {INSTITUTION_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="di-sub" style={{ marginTop: 4 }}>
          Applies live across the suite — e.g. “Distance / open learning” hides Accommodation and Canteen from every role. Multi-tenant SaaS configuration.
        </div>
      </Panel>

      <Panel title="NCHE statutory returns" flush>
        <table className="data">
          <thead><tr><th>Return</th><th>Period</th><th>Due</th><th>Status</th><th style={{ width: 130 }}></th></tr></thead>
          <tbody>
            {NCHE_RETURNS.map((r) => (
              <tr key={r.ret}>
                <td style={{ fontWeight: 600 }}>{r.ret}</td><td>{r.period}</td><td>{r.due}</td>
                <td><Badge tone={tone(status[r.ret])}>{status[r.ret]}</Badge></td>
                <td>{status[r.ret] !== 'Submitted' && <button className="btn primary sm" onClick={() => submit(r.ret)}>Submit</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Programme accreditation" flush>
        <table className="data">
          <thead><tr><th>Programme</th><th className="num">NQF</th><th>Accreditation</th></tr></thead>
          <tbody>
            {PROGRAMMES.map((p) => (
              <tr key={p.code}>
                <td><div style={{ fontWeight: 600 }}>{p.code}</div><div className="di-sub">{p.name}</div></td>
                <td className="num">{p.nqf}</td>
                <td><Badge tone={/provisional/i.test(p.accreditation) ? 'amber' : 'green'}>{p.accreditation}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Toast msg={toast} />
    </>
  )
}
