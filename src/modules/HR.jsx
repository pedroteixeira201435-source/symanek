import React, { useState } from 'react'
import { Tabs, Panel, Badge, Avatar, Progress, Toast, useToast, Modal } from '../ui.jsx'
import { STAFF, LEAVE_REQUESTS, PAYROLL, LEAVE_BALANCES, CONTRACTS, QUALIFICATIONS, RECRUITS, RECRUIT_STAGES, WORKLOAD, PAYE_BRACKETS, payeMonthly, sscMonthly, VET_LEVY_RATE, staffEmail, fmtN } from '../data.js'

const CONTRACT_TONE = { Permanent: 'teal', Contract: 'blue', Casual: 'amber' }
const LEAVE_TONE = { Sick: 'red', Annual: 'blue', Maternity: 'purple', Compassionate: 'orange' }

export default function HR({ role }) {
  const readOnly = role.id === 'bursar' // bursar sees payroll read-only
  const [tab, setTab] = useState(readOnly ? 'Payroll' : 'Staff Directory')
  const tabs = readOnly
    ? ['Payroll']
    : ['Staff Directory', 'Leave Requests', 'Recruitment', 'Contracts & Compliance', 'Workload', 'Payroll']

  return (
    <>
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === 'Staff Directory' && <Directory openPayroll={() => setTab('Payroll')} />}
      {tab === 'Leave Requests' && <Leave />}
      {tab === 'Recruitment' && <Recruitment />}
      {tab === 'Contracts & Compliance' && <Contracts />}
      {tab === 'Workload' && <Workload />}
      {tab === 'Payroll' && <Payroll readOnly={readOnly} />}
    </>
  )
}

// hiring pipeline — same board pattern as Admissions; Onboarding hands
// over to "+ Add staff" in the directory
const REC_TONE = { Applied: 'gray', Interview: 'blue', Offer: 'amber', Onboarding: 'green' }
const REC_NEXT = { Applied: 'Interview', Interview: 'Offer', Offer: 'Onboarding' }
const REC_LABEL = { Applied: 'Shortlist for interview', Interview: 'Make offer', Offer: 'Start onboarding' }

function Recruitment() {
  const [recs, setRecs] = useState(RECRUITS)
  const [sel, setSel] = useState(null)
  const [toast, showToast] = useToast()

  const advance = (r) => {
    const next = REC_NEXT[r.stage]
    if (!next) return
    setRecs((rs) => rs.map((x) => (x.id === r.id ? { ...x, stage: next } : x)))
    setSel(null)
    showToast(
      next === 'Onboarding'
        ? `${r.name} accepted — onboarding checklist opened, contract drafted`
        : next === 'Offer'
        ? `Offer letter sent to ${r.name} (${r.post})`
        : `${r.name} shortlisted — interview panel invited`
    )
  }

  return (
    <>
      <div className="note-banner">
        <span>ℹ️</span>
        <div>
          <strong>3 open posts</strong> — Lecturer (Accounting), Lecturer (Languages), IT Technician.
          Onboarding completes into the Staff Directory with an employee ID and payroll record.
        </div>
      </div>
      <div className="pipe-board">
        {RECRUIT_STAGES.map((stage) => {
          const col = recs.filter((r) => r.stage === stage)
          return (
            <div key={stage} className="pipe-col">
              <div className="pipe-col-head">
                <Badge tone={REC_TONE[stage]}>{stage}</Badge>
                <span className="mono" style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{col.length}</span>
              </div>
              {col.length === 0 && <div className="pipe-empty">No candidates</div>}
              {col.map((r) => (
                <div key={r.id} className="pipe-card" onClick={() => setSel(r)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={r.name} size={28} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>{r.post}</div>
                    </div>
                  </div>
                  <div className="pipe-meta">
                    <span>applied {r.applied.slice(0, 6)}</span>
                    {r.score && <Badge tone="teal">★ {r.score}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {sel && (
        <Modal title={`${sel.id} — ${sel.name}`} onClose={() => setSel(null)} width={420}>
          <div className="cf-row"><span>Post</span><span style={{ fontWeight: 600 }}>{sel.post}</span></div>
          <div className="cf-row"><span>Applied</span><span>{sel.applied}</span></div>
          <div className="cf-row"><span>Stage</span><Badge tone={REC_TONE[sel.stage]}>{sel.stage}</Badge></div>
          {sel.score && <div className="cf-row"><span>Interview score</span><span className="mono" style={{ fontWeight: 700 }}>{sel.score}</span></div>}
          {REC_NEXT[sel.stage] ? (
            <button className="btn primary" style={{ marginTop: 16 }} onClick={() => advance(sel)}>
              {REC_LABEL[sel.stage]} →
            </button>
          ) : (
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 14 }}>
              Onboarding in progress — contract, bank details & induction checklist with the candidate
            </div>
          )}
        </Modal>
      )}
      <Toast msg={toast} />
    </>
  )
}

const QUAL_TONE = { Valid: 'green', Pending: 'amber', Expiring: 'orange' }

function Contracts() {
  const [contracts, setContracts] = useState(CONTRACTS)
  const [toast, showToast] = useToast()

  const renew = (staff) => {
    setContracts((cs) => cs.map((c) => (c.staff === staff ? { ...c, end: '31 Aug 2027', daysLeft: 423 } : c)))
    showToast(`${staff} — renewal drafted to 31 Aug 2027, sent for signature`)
  }

  return (
    <>
      <Panel title="Contracts — expiry watch" subtitle="Fixed-term contracts flag at 60 days · Labour Act notice periods" flush>
        <table className="data">
          <thead>
            <tr><th>Employee</th><th>Contract</th><th>Start</th><th>End</th><th className="num">Days left</th><th>Action</th></tr>
          </thead>
          <tbody>
            {contracts.map((c) => (
              <tr key={c.staff}>
                <td style={{ fontWeight: 600 }}>{c.staff}</td>
                <td>{c.type}</td>
                <td>{c.start}</td>
                <td>{c.end}</td>
                <td className="num" style={{ color: c.daysLeft !== null && c.daysLeft < 60 ? 'var(--red)' : 'var(--ink)', fontWeight: c.daysLeft !== null && c.daysLeft < 60 ? 700 : 400 }}>
                  {c.daysLeft === null ? '—' : c.daysLeft}
                </td>
                <td>
                  {c.daysLeft !== null && c.daysLeft < 60 ? (
                    <button className="btn primary sm" onClick={() => renew(c.staff)}>Renew contract</button>
                  ) : (
                    <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Qualifications & registrations" subtitle="NQA / NTA compliance — accreditation audits check this list" flush>
        <table className="data">
          <thead>
            <tr><th>Employee</th><th>Qualification</th><th>Verifying body</th><th>Expires</th><th>Status</th></tr>
          </thead>
          <tbody>
            {QUALIFICATIONS.map((q, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{q.staff}</td>
                <td>{q.qual}</td>
                <td>{q.body}</td>
                <td>{q.expires}</td>
                <td><Badge tone={QUAL_TONE[q.status]}>{q.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Toast msg={toast} />
    </>
  )
}

function Workload() {
  return (
    <Panel
      title="Teaching workload — Term 3 / Semester 2"
      subtitle="School periods + tertiary course credits per staff member · cap per contract"
      flush
    >
      <table className="data">
        <thead>
          <tr>
            <th>Staff</th><th className="num">Classes</th><th className="num">Courses</th>
            <th className="num">Credits</th><th className="num">Hours / wk</th><th style={{ width: '26%' }}>Load</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {WORKLOAD.map((w) => {
            const pct = Math.round((w.hours / w.cap) * 100)
            return (
              <tr key={w.staff}>
                <td style={{ fontWeight: 600 }}>{w.staff}</td>
                <td className="num">{w.classes}</td>
                <td className="num">{w.courses}</td>
                <td className="num">{w.credits}</td>
                <td className="num">{w.hours} / {w.cap}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Progress pct={pct} tone={pct > 100 ? 'amber' : ''} />
                    <span className="mono" style={{ fontSize: 12 }}>{pct}%</span>
                  </div>
                </td>
                <td>
                  {pct > 100 ? <Badge tone="red">Overloaded</Badge> : pct >= 85 ? <Badge tone="orange">At capacity</Badge> : <Badge tone="green">OK</Badge>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Panel>
  )
}

function Directory({ openPayroll }) {
  const [staff, setStaff] = useState(STAFF)
  const [showAdd, setShowAdd] = useState(false)
  const [profile, setProfile] = useState(null)
  const [toast, showToast] = useToast()

  const addStaff = (e) => {
    e.preventDefault()
    const f = e.target
    const s = {
      id: `SYM-${String(staff.length + 1).padStart(3, '0')}`,
      name: f.name.value || 'New employee',
      role: f.role.value || 'Lecturer',
      dept: f.dept.value,
      contract: f.contract.value,
      status: 'Active',
    }
    setStaff((list) => [...list, s])
    setShowAdd(false)
    showToast(`${s.name} onboarded — ${s.id}`)
  }

  return (
    <>
    <Panel
      title="Staff directory"
      subtitle={`${56 + staff.length} staff members · click a row for the profile`}
      actions={<button className="btn primary sm" onClick={() => setShowAdd(true)}>+ Add staff</button>}
      flush
    >
      <table className="data">
        <thead>
          <tr><th>Employee</th><th>ID</th><th>Role</th><th>Department</th><th>Contract</th><th>Status</th></tr>
        </thead>
        <tbody>
          {staff.map((s) => (
            <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => setProfile(s)}>
              <td>
                <div className="emp-cell">
                  <Avatar name={s.name} />
                  <span className="en">{s.name}</span>
                </div>
              </td>
              <td className="mono" style={{ fontSize: 12.5 }}>{s.id}</td>
              <td>{s.role}</td>
              <td>{s.dept}</td>
              <td><Badge tone={CONTRACT_TONE[s.contract]}>{s.contract}</Badge></td>
              <td><Badge tone={s.status === 'Active' ? 'green' : 'orange'}>{s.status}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>

    {profile && (
      <Modal title="Staff profile" onClose={() => setProfile(null)} width={440}>
        <div className="emp-cell" style={{ marginBottom: 16 }}>
          <Avatar name={profile.name} size={48} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{profile.name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{profile.role}</div>
          </div>
        </div>
        {[
          ['Employee ID', profile.id],
          ['Department', profile.dept],
          ['Joined', profile.joined || 'Jul 2026'],
          ['Phone', profile.phone || '+264 81 000 0000'],
          ['Email', staffEmail(profile.name)],
        ].map(([l, v]) => (
          <div key={l} className="cf-row" style={{ padding: '7px 0', borderBottom: '1px solid #e9eef3' }}>
            <span style={{ color: 'var(--ink-soft)' }}>{l}</span>
            <span style={{ fontWeight: 600 }}>{v}</span>
          </div>
        ))}
        <div className="cf-row" style={{ padding: '10px 0' }}>
          <Badge tone={CONTRACT_TONE[profile.contract]}>{profile.contract}</Badge>
          <Badge tone={profile.status === 'Active' ? 'green' : 'orange'}>{profile.status}</Badge>
        </div>
        <div style={{ margin: '8px 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)' }}>LEAVE BALANCES</div>
        {LEAVE_BALANCES.map((b) => (
          <div key={b.type} className="cf-row" style={{ padding: '4px 0' }}>
            <span>{b.type}</span>
            <span className="mono">{b.total - b.used} / {b.total} days</span>
          </div>
        ))}
        <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={() => { setProfile(null); openPayroll() }}>
          View payslip →
        </button>
      </Modal>
    )}

    {showAdd && (
      <Modal title="Add staff member" onClose={() => setShowAdd(false)}>
        <form onSubmit={addStaff}>
          <div className="field"><label>Full name</label><input name="name" placeholder="e.g. Maria Nakanyala" required /></div>
          <div className="field"><label>Role</label><input name="role" placeholder="e.g. Lecturer — English" required /></div>
          <div className="grid2" style={{ gap: 12 }}>
            <div className="field">
              <label>Department</label>
              <select name="dept">
                <option>Sciences</option><option>Mathematics</option><option>Humanities</option>
                <option>Languages</option><option>Support</option><option>Administration</option>
              </select>
            </div>
            <div className="field">
              <label>Contract type</label>
              <select name="contract"><option>Permanent</option><option>Contract</option><option>Casual</option></select>
            </div>
          </div>
          <button className="btn primary" type="submit">Onboard staff</button>
        </form>
      </Modal>
    )}
    <Toast msg={toast} />
    </>
  )
}

function Leave() {
  const [requests, setRequests] = useState(LEAVE_REQUESTS)
  const [toast, showToast] = useToast()
  const pending = requests.filter((r) => r.status === 'Pending').length

  const decide = (id, status) => {
    setRequests((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)))
    const r = requests.find((r) => r.id === id)
    showToast(`${r.name} — ${r.type} leave ${status.toLowerCase()}`)
  }

  return (
    <>
      <Panel
        title="Leave requests"
        subtitle={`${pending} pending approval`}
        flush
      >
        <table className="data">
          <thead>
            <tr><th>Employee</th><th>Type</th><th className="num">Days</th><th>Period</th><th>Status</th><th>Action</th></tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.name}</td>
                <td><Badge tone={LEAVE_TONE[r.type]}>{r.type}</Badge></td>
                <td className="num">{r.days}</td>
                <td>{r.period}</td>
                <td>
                  <Badge tone={r.status === 'Approved' ? 'green' : r.status === 'Declined' ? 'red' : 'amber'}>
                    {r.status}
                  </Badge>
                </td>
                <td>
                  {r.status === 'Pending' ? (
                    <span style={{ display: 'flex', gap: 6 }}>
                      <button className="btn green sm" onClick={() => decide(r.id, 'Approved')}>Approve</button>
                      <button className="btn red-ghost sm" onClick={() => decide(r.id, 'Declined')}>Decline</button>
                    </span>
                  ) : (
                    <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Toast msg={toast} />
    </>
  )
}

function Payroll({ readOnly }) {
  const [toast, showToast] = useToast()
  const [sel, setSel] = useState(null) // employee payslip modal
  const [confirmRun, setConfirmRun] = useState(false)
  const [runDone, setRunDone] = useState(false)
  // NamRA engine — mirrors Genesis_HR_v4 workbook: PAYE from the bracket
  // table, SSC 0.9% capped N$81, employer adds SSC 0.9% + VET levy 1%
  const rows = PAYROLL.map((p) => {
    const paye = payeMonthly(p.gross)
    const ssc = sscMonthly(p.gross)
    const vet = Math.round(p.gross * VET_LEVY_RATE)
    return { ...p, paye, ssc, net: p.gross - paye - ssc, employer: ssc + vet }
  })
  const totalNet = rows.reduce((s, p) => s + p.net, 0)
  const totalGross = rows.reduce((s, p) => s + p.gross, 0)
  const totalEmployer = rows.reduce((s, p) => s + p.employer, 0)

  const runPayroll = () => {
    setConfirmRun(false)
    setRunDone(true)
    showToast('July 2026 payroll run completed — 64 employees paid, EMP return drafted for NamRA')
  }

  return (
    <>
      <div className="note-banner">
        <span>ℹ️</span>
        <div>
          Computed live from the <strong>NamRA 2024/25 PAYE tables</strong> (first N$ 100,000/yr tax-free) —
          mirrors <code>Genesis_HR_v4_Hybrid_Payroll.xlsx</code>. SSC: 0.9% employee + 0.9% employer, ceiling
          N$ 81/month · VET levy 1% (payroll &gt; N$ 1m/yr).
          {readOnly && <em> · Read-only view for Finance/Bursar.</em>}
        </div>
      </div>
      <Panel
        title="Payroll run — July 2026"
        subtitle="Sample of 6 employees (of 64) · click a row for the payslip"
        actions={
          <>
            <a className="btn ghost sm" href="/assets/Genesis_HR_v4_Hybrid_Payroll.xlsx" download>⬇ Workbook (.xlsx)</a>
            {!readOnly &&
              (runDone ? (
                <Badge tone="green">✓ July run completed</Badge>
              ) : (
                <button className="btn amber sm" onClick={() => setConfirmRun(true)}>▶ Run payroll</button>
              ))}
          </>
        }
        flush
      >
        <table className="data">
          <thead>
            <tr>
              <th>Employee</th><th className="num">Gross</th><th className="num">PAYE</th><th className="num">SSC</th>
              <th className="num">Net pay</th><th className="num">Employer cost (SSC + VET)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.name} style={{ cursor: 'pointer' }} onClick={() => setSel(p)}>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td className="num">{fmtN(p.gross)}</td>
                <td className="num">{fmtN(p.paye)}</td>
                <td className="num">{fmtN(p.ssc)}</td>
                <td className="num" style={{ fontWeight: 700, color: 'var(--petrol-800)' }}>{fmtN(p.net)}</td>
                <td className="num" style={{ color: 'var(--ink-soft)' }}>{fmtN(p.employer)}</td>
              </tr>
            ))}
            <tr>
              <td style={{ fontWeight: 700 }}>Totals</td>
              <td className="num" style={{ fontWeight: 700 }}>{fmtN(totalGross)}</td>
              <td colSpan={2} />
              <td className="num" style={{ fontWeight: 700, color: 'var(--petrol-900)', fontSize: 14 }}>
                {fmtN(totalNet)}
              </td>
              <td className="num" style={{ fontWeight: 700 }}>{fmtN(totalEmployer)}</td>
            </tr>
          </tbody>
        </table>
      </Panel>

      <Panel title="PAYE brackets — 2024/25 (Income Tax Act)" subtitle="Annual taxable income · applied by the engine above" flush>
        <table className="data">
          <thead>
            <tr><th>From (N$/yr)</th><th>To (N$/yr)</th><th className="num">Rate</th><th className="num">Fixed amount</th></tr>
          </thead>
          <tbody>
            {PAYE_BRACKETS.map((b) => (
              <tr key={b.from}>
                <td className="mono" style={{ fontSize: 12.5 }}>{b.from.toLocaleString()}</td>
                <td className="mono" style={{ fontSize: 12.5 }}>{b.to === Infinity ? '∞' : b.to.toLocaleString()}</td>
                <td className="num">{Math.round(b.rate * 100)}%</td>
                <td className="num">{fmtN(b.fixed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {confirmRun && (
        <Modal title="Run payroll — July 2026" onClose={() => setConfirmRun(false)} width={420}>
          <div className="cf-row"><span>Employees</span><span className="mono">64</span></div>
          <div className="cf-row"><span>Total gross (sample of 6)</span><span className="mono">{fmtN(totalGross)}</span></div>
          <div className="cf-row"><span>PAYE + SSC withheld</span><span className="mono">{fmtN(totalGross - totalNet)}</span></div>
          <div className="cf-row total"><span>Net payable</span><span className="amt">{fmtN(totalNet)}</span></div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '12px 0 16px' }}>
            Payments are batched to the bank file and payslips emailed to each employee. This cannot be undone for the month.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn amber" onClick={runPayroll}>Confirm & run</button>
            <button className="btn ghost" onClick={() => setConfirmRun(false)}>Cancel</button>
          </div>
        </Modal>
      )}

      {sel && (
        <Modal title={`Payslip — ${sel.name} · July 2026`} onClose={() => setSel(null)} width={420}>
          {[
            ['Gross salary', sel.gross],
            ['PAYE', -sel.paye],
            ['Social Security (SSC)', -sel.ssc],
          ].map(([l, v]) => (
            <div key={l} className="cf-row" style={{ padding: '9px 0', borderBottom: '1px solid #e9eef3' }}>
              <span>{l}</span>
              <span className="mono" style={{ color: v < 0 ? 'var(--red)' : 'var(--ink)' }}>
                {v < 0 ? '− ' + fmtN(-v) : fmtN(v)}
              </span>
            </div>
          ))}
          <div className="cf-row total"><span>Net pay</span><span className="amt">{fmtN(sel.net)}</span></div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '10px 0 14px' }}>
            PAYE per NamRA 2024/25 tables · SSC 0.9% (cap N$ 81) · paid to bank account on file
          </div>
          <button className="btn ghost sm" onClick={() => { setSel(null); showToast(`Payslip PDF for ${sel.name} downloaded`) }}>
            ⬇ Download PDF
          </button>
        </Modal>
      )}

      <Toast msg={toast} />
    </>
  )
}
