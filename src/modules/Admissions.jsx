import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { StatCard, Tabs, Panel, Badge, Modal, Avatar, Toast, useToast } from '../ui.jsx'
import { approveApplication, listApplicants, listProgrammes, markApplicationPaid, rejectApplication } from '../api.js'

const ADMISSION_STAGES = ['Applied', 'Under Review', 'Approved', 'Paid', 'Enrolled', 'Rejected']
const STAGE_TONE = { Applied: 'gray', 'Under Review': 'blue', 'Offer Sent': 'amber', Enrolled: 'green', Rejected: 'red', Approved: 'green', Paid: 'teal' }

export default function Admissions({ go }) {
  const [tab, setTab] = useState('Pipeline')
  const [apps, setApps] = useState([])
  const [programmes, setProgrammes] = useState([])
  const [loading, setLoading] = useState(true)
  const reload = useCallback(() => Promise.all([
    listApplicants().then(setApps).catch(() => setApps([])),
    listProgrammes().then(setProgrammes).catch(() => setProgrammes([])),
  ]), [])
  useEffect(() => { reload().finally(() => setLoading(false)) }, [reload])

  const progName = (code) => programmes.find((p) => p.code === code || p.slug === String(code).toLowerCase())?.name || code || '-'
  const ctx = { apps, programmes, progName, loading, go, reload }
  return (
    <>
      <Tabs tabs={['Pipeline', 'Manual Admission', '2027 Intake']} active={tab} onChange={setTab} />
      {tab === 'Pipeline' && <Pipeline {...ctx} />}
      {tab === 'Manual Admission' && <ManualAdmission {...ctx} />}
      {tab === '2027 Intake' && <Intake apps={apps} programmes={programmes} progName={progName} />}
    </>
  )
}

function ManualAdmission({ apps, progName, loading, go, reload }) {
  const [toast, showToast] = useToast()
  const [sel, setSel] = useState(null)
  const [payFor, setPayFor] = useState(null)
  const approve = async (app) => {
    try { const res = await approveApplication(app._uuid); await reload(); setSel(null); showToast(`Approved${res.reference ? ` - ${res.reference}` : ''}`) }
    catch (err) { showToast('Could not approve: ' + (err?.message || err)) }
  }
  const reject = async (app) => {
    try { await rejectApplication(app._uuid); await reload(); setSel(null); showToast(`${app.name} rejected`) }
    catch (err) { showToast('Could not reject: ' + (err?.message || err)) }
  }
  const pay = async (e) => {
    e.preventDefault(); const f = e.target
    try { const res = await markApplicationPaid({ appId: payFor._uuid, amount: Number(f.amount.value), method: f.method.value }); await reload(); setPayFor(null); setSel(null); showToast(`Payment recorded${res.reference ? ` - ${res.reference}` : ''}`) }
    catch (err) { showToast('Could not mark paid: ' + (err?.message || err)) }
  }
  if (loading) return <Panel title="All applications" flush><Empty>Loading...</Empty></Panel>
  return (
    <>
      <Panel title="All applications" subtitle={`${apps.length} applications`} flush>
        {apps.length === 0 ? <Empty>No applications yet.</Empty> : (
          <table className="data"><thead><tr><th>Applicant</th><th>ID</th><th>Programme</th><th className="num">Points</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>{apps.map((a) => <tr key={a.id}>
              <td><div className="emp-cell"><Avatar name={a.name} size={26} /><span className="en">{a.name}</span></div></td>
              <td className="mono">{a.id}</td><td>{progName(a.prog)}</td><td className="num">{a.points || '-'}</td>
              <td><Badge tone={STAGE_TONE[a.stage] || 'gray'}>{a.stage}</Badge></td>
              <td>{a.stage === 'Enrolled' ? <button className="btn ghost sm" onClick={() => go && go('students', a.name)}>View student</button> : <button className="btn primary sm" onClick={() => setSel(a)}>Process</button>}</td>
            </tr>)}</tbody>
          </table>
        )}
      </Panel>
      {sel && <Modal title={`Process - ${sel.name}`} onClose={() => setSel(null)}>
        <div className="cf-row"><span>Programme</span><span>{progName(sel.prog)}</span></div>
        <div className="cf-row"><span>Current stage</span><Badge tone={STAGE_TONE[sel.stage] || 'gray'}>{sel.stage}</Badge></div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          {(sel.stage === 'Applied' || sel.stage === 'Under Review') && <button className="btn primary" onClick={() => approve(sel)}>Approve</button>}
          {(sel.stage === 'Approved' || sel.stage === 'Paid') && <button className="btn primary" onClick={() => setPayFor(sel)}>Record EFT</button>}
          {sel.stage !== 'Rejected' && sel.stage !== 'Enrolled' && <button className="btn red-ghost" onClick={() => reject(sel)}>Reject</button>}
          {sel.stage === 'Enrolled' && <button className="btn ghost" onClick={() => go && go('students', sel.name)}>View student</button>}
        </div>
      </Modal>}
      {payFor && <Modal title={`Record EFT - ${payFor.name}`} onClose={() => setPayFor(null)}>
        <form onSubmit={pay}>
          <div className="field"><label>Amount paid</label><input name="amount" type="number" min="1" defaultValue={payFor.amountDue || ''} required /></div>
          <div className="field"><label>Method</label><select name="method"><option>EFT</option><option>Cash</option><option>Card</option></select></div>
          <button className="btn primary">Record payment</button>
        </form>
      </Modal>}
      <Toast msg={toast} />
    </>
  )
}

function Pipeline({ apps, progName, loading, reload }) {
  const [sel, setSel] = useState(null)
  const [toast, showToast] = useToast()
  const counts = useMemo(() => Object.fromEntries(ADMISSION_STAGES.map((s) => [s, apps.filter((a) => a.stage === s).length])), [apps])
  const approve = async (app) => {
    try { await approveApplication(app._uuid); await reload(); setSel(null); showToast(`${app.name} approved`) }
    catch (err) { showToast('Could not approve: ' + (err?.message || err)) }
  }
  if (loading) return <Panel title="Admissions pipeline" flush><Empty>Loading...</Empty></Panel>
  return (
    <>
      <div className="stat-row c4">
        <StatCard icon="📨" label="Applications" value={String(apps.length)} delta="from backend" />
        <StatCard icon="✉️" label="Offers sent" value={String(counts['Offer Sent'] || 0)} delta="awaiting response" />
        <StatCard icon="🎓" label="Enrolled" value={String(counts.Enrolled || 0)} delta="converted applications" />
        <StatCard icon="⏱️" label="In review" value={String(counts['Under Review'] || 0)} delta="manual processing" />
      </div>
      <div className="pipe-board">
        {ADMISSION_STAGES.map((stage) => {
          const col = apps.filter((a) => a.stage === stage)
          return <div key={stage} className="pipe-col">
            <div className="pipe-col-head"><Badge tone={STAGE_TONE[stage]}>{stage}</Badge><span className="mono">{col.length}</span></div>
            {col.length === 0 && <div className="pipe-empty">No applicants</div>}
            {col.map((a) => <div key={a.id} className="pipe-card" onClick={() => setSel(a)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar name={a.name} size={28} /><div><div style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</div><div className="di-sub">{a.id} · {progName(a.prog)}</div></div></div>
            </div>)}
          </div>
        })}
      </div>
      {sel && <Modal title={`${sel.id} - ${sel.name}`} onClose={() => setSel(null)}>
        <div className="cf-row"><span>Programme</span><span>{progName(sel.prog)}</span></div>
        <div className="cf-row"><span>Applied</span><span>{sel.applied || '-'}</span></div>
        <div className="cf-row"><span>Stage</span><Badge tone={STAGE_TONE[sel.stage] || 'gray'}>{sel.stage}</Badge></div>
        {(sel.stage === 'Applied' || sel.stage === 'Under Review') && <button className="btn primary" style={{ marginTop: 16 }} onClick={() => approve(sel)}>Approve</button>}
      </Modal>}
      <Toast msg={toast} />
    </>
  )
}

function Intake({ apps, programmes, progName }) {
  const byProg = programmes.map((p) => {
    const code = p.code || p.slug?.toUpperCase()
    const rows = apps.filter((a) => a.prog === code)
    return { code, name: progName(code), applications: rows.length, enrolled: rows.filter((a) => a.stage === 'Enrolled').length }
  })
  return (
    <Panel title="2027 intake" subtitle="Applications by programme" flush>
      {byProg.length === 0 ? <Empty>No programme intake data yet.</Empty> : (
        <table className="data"><thead><tr><th>Programme</th><th className="num">Applications</th><th className="num">Enrolled</th></tr></thead>
          <tbody>{byProg.map((i) => <tr key={i.code}><td><div style={{ fontWeight: 600 }}>{i.name}</div><div className="mono">{i.code}</div></td><td className="num">{i.applications}</td><td className="num">{i.enrolled}</td></tr>)}</tbody>
        </table>
      )}
    </Panel>
  )
}

function Empty({ children }) {
  return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)' }}>{children}</div>
}
