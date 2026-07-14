import React, { useState } from 'react'
import { StatCard, Tabs, Panel, Badge, Progress, Modal, Avatar, Toast, useToast } from '../ui.jsx'
import { APPLICANTS, ADMISSION_STAGES, INTAKES, PROGRAMMES } from '../data.js'

// Admissions — the tertiary front door: applications move Applied →
// Under Review → Offer Sent → Enrolled; enrolment hands over to Students.
const STAGE_TONE = { Applied: 'gray', 'Under Review': 'blue', 'Offer Sent': 'amber', Enrolled: 'green' }
const NEXT = { Applied: 'Under Review', 'Under Review': 'Offer Sent', 'Offer Sent': 'Enrolled' }
const NEXT_LABEL = { Applied: 'Start review', 'Under Review': 'Send offer', 'Offer Sent': 'Enrol' }

const progName = (code) => PROGRAMMES.find((p) => p.code === code)?.name || code

export default function Admissions({ go }) {
  const [tab, setTab] = useState('Pipeline')
  const [apps, setApps] = useState(APPLICANTS)
  return (
    <>
      <Tabs tabs={['Pipeline', '2027 Intake']} active={tab} onChange={setTab} />
      {tab === 'Pipeline' && <Pipeline apps={apps} setApps={setApps} go={go} />}
      {tab === '2027 Intake' && <Intake />}
    </>
  )
}

function Pipeline({ apps, setApps, go }) {
  const [sel, setSel] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [toast, showToast] = useToast()

  const createApp = (e) => {
    e.preventDefault()
    const f = e.target
    const a = {
      id: `APP-${2710 + apps.length}`, name: f.name.value, prog: f.prog.value,
      points: Number(f.points.value) || 0, stage: 'Applied', applied: '04 Jul 2026',
      docs: { 'Grade 12 certificate': false, 'ID copy': false, 'Proof of payment (N$ 150)': false },
    }
    setApps((as) => [a, ...as])
    setShowNew(false)
    showToast(`${a.name} — application ${a.id} captured, checklist opened`)
  }

  const advance = (app) => {
    const next = NEXT[app.stage]
    if (!next) return
    setApps((as) => as.map((a) => (a.id === app.id ? { ...a, stage: next } : a)))
    setSel(null)
    showToast(
      next === 'Enrolled'
        ? `${app.name} enrolled in ${app.prog} — student file created in the register`
        : next === 'Offer Sent'
        ? `Offer letter sent to ${app.name} (${app.prog})`
        : `${app.name} moved to review — committee notified`
    )
  }

  const docsMissing = (app) => Object.values(app.docs).filter((v) => !v).length

  return (
    <>
      <div className="stat-row c4">
        <StatCard icon="📨" label="Applications" value="200" delta="+34 this week" />
        <StatCard icon="✉️" label="Offers sent" value="99" delta="acceptance 62%" deltaTone="neutral" />
        <StatCard icon="🎓" label="Enrolled (2027)" value="47" delta="of 228 seats" deltaTone="neutral" />
        <StatCard icon="⏱️" label="Avg time to offer" value="6 days" delta="target 5 days" deltaTone="down" />
      </div>

      <div className="note-banner">
        <span>ℹ️</span>
        <div style={{ flex: 1 }}>
          Sample of {apps.length} live applications — an <strong>enrolled applicant</strong> automatically
          gets a student number, a Term/Semester invoice and a Student 360° file.
        </div>
        <button className="btn primary sm" style={{ flexShrink: 0 }} onClick={() => setShowNew(true)}>+ New application</button>
      </div>

      <div className="pipe-board">
        {ADMISSION_STAGES.map((stage) => {
          const col = apps.filter((a) => a.stage === stage)
          return (
            <div key={stage} className="pipe-col">
              <div className="pipe-col-head">
                <Badge tone={STAGE_TONE[stage]}>{stage}</Badge>
                <span className="mono" style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{col.length}</span>
              </div>
              {col.length === 0 && <div className="pipe-empty">No applicants</div>}
              {col.map((a) => (
                <div key={a.id} className="pipe-card" onClick={() => setSel(a)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={a.name} size={28} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>{a.id} · {a.prog}</div>
                    </div>
                  </div>
                  <div className="pipe-meta">
                    <span>{a.points} pts</span>
                    {docsMissing(a) > 0 ? (
                      <Badge tone="red">{docsMissing(a)} doc missing</Badge>
                    ) : (
                      <Badge tone="green">Docs ✓</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {sel && (
        <Modal title={`${sel.id} — ${sel.name}`} onClose={() => setSel(null)} width={440}>
          <div className="cf-row"><span>Programme</span><span style={{ fontWeight: 600 }}>{progName(sel.prog)}</span></div>
          <div className="cf-row"><span>NSSCO points</span><span className="mono" style={{ fontWeight: 600 }}>{sel.points}</span></div>
          <div className="cf-row"><span>Applied</span><span>{sel.applied}</span></div>
          <div className="cf-row"><span>Stage</span><Badge tone={STAGE_TONE[sel.stage]}>{sel.stage}</Badge></div>

          <div style={{ margin: '16px 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)' }}>
            DOCUMENT CHECKLIST
          </div>
          {Object.entries(sel.docs).map(([doc, ok]) => (
            <div key={doc} className="cf-row" style={{ padding: '5px 0', fontSize: 12.5 }}>
              <span>{doc}</span>
              <Badge tone={ok ? 'green' : 'red'}>{ok ? 'Received' : 'Missing'}</Badge>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            {NEXT[sel.stage] && (
              <button className="btn primary" onClick={() => advance(sel)}>
                {NEXT_LABEL[sel.stage]} →
              </button>
            )}
            {sel.stage === 'Enrolled' && (
              <button className="btn ghost" onClick={() => go && go('students')}>View student register →</button>
            )}
          </div>
        </Modal>
      )}

      {showNew && (
        <Modal title="New application — walk-in / online" onClose={() => setShowNew(false)} width={440}>
          <form onSubmit={createApp}>
            <div className="field"><label>Applicant full name</label><input name="name" placeholder="e.g. Taleni Iyambo" required /></div>
            <div className="grid2" style={{ gap: 12 }}>
              <div className="field">
                <label>Programme</label>
                <select name="prog">{PROGRAMMES.map((p) => <option key={p.code} value={p.code}>{p.code} — {p.name}</option>)}</select>
              </div>
              <div className="field"><label>NSSCO points</label><input name="points" type="number" min="0" max="45" defaultValue="28" /></div>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 14 }}>
              Application fee N$ 150 · document checklist opens automatically on the card
            </div>
            <button className="btn primary" type="submit">Capture application</button>
          </form>
        </Modal>
      )}
      <Toast msg={toast} />
    </>
  )
}

function Intake() {
  const [toast, showToast] = useToast()
  return (
    <>
      <Panel
        title="2027 intake — seats vs applications"
        subtitle="Applications close 30 Sep 2026 · offers per programme committee"
        actions={<button className="btn ghost sm" onClick={() => showToast('Intake report exported for NCHE return')}>⬇ Export</button>}
        flush
      >
        <table className="data">
          <thead>
            <tr>
              <th>Programme</th><th className="num">Seats</th><th className="num">Applications</th>
              <th className="num">Offers</th><th className="num">Enrolled</th><th style={{ width: '26%' }}>Seats filled</th>
            </tr>
          </thead>
          <tbody>
            {INTAKES.map((i) => {
              const pct = Math.round((i.enrolled / i.capacity) * 100)
              return (
                <tr key={i.prog}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{progName(i.prog)}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>{i.prog}</div>
                  </td>
                  <td className="num">{i.capacity}</td>
                  <td className="num" style={{ color: i.applications > i.capacity ? 'var(--green)' : 'var(--ink)' }}>{i.applications}</td>
                  <td className="num">{i.offers}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{i.enrolled}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Progress pct={pct} tone={pct < 25 ? 'amber' : ''} />
                      <span className="mono" style={{ fontSize: 12 }}>{pct}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Panel>
      <Toast msg={toast} />
    </>
  )
}
