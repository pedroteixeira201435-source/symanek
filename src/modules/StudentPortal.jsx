import React, { useState, useEffect } from 'react'
import { StatCard, Tabs, Panel, Badge, Progress, Modal, Toast, useToast } from '../ui.jsx'
import { COURSES, EXAM_BOARD, gradeOf, fmtN } from '../data.js'
import * as api from '../api.js'
import { TimetableGrid } from './Scheduling.jsx'

const CREDIT_RATE = 1150 // N$ per credit — charge assessed on registration (demo)
const SEM_CREDIT_CAP = 72

// The student sees ONLY their own record — never institution-wide finance/HR.
// `role.user` is the logged-in student's name. The record is loaded through the
// api seam (mock in-memory, or Supabase when API_MODE='http') — the backend joins
// by student_id, killing the legacy name-join. The `ctx` shape is unchanged, so
// every tab component below is untouched.
export default function StudentPortal({ role }) {
  const me = role.user
  const [tab, setTab] = useState('My Studies')
  const [registered, setRegistered] = useState([]) // course codes registered this session — shared across tabs
  const [rec, setRec] = useState(null)
  const [reloadN, setReloadN] = useState(0) // bump to re-fetch the record after a write (e.g. payment)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [audit, programmes, myResults, myInvoices, mySponsors, myHolds] = await Promise.all([
        api.getDegreeAudit(me), api.listProgrammes(), api.getResultsForStudent(me),
        api.getInvoicesForStudent(me), api.getSponsorsForStudent(me), api.getHoldsForStudent(me),
      ])
      if (!alive) return
      const prog = programmes.find((p) => p.code === audit?.prog)
      setRec({ audit, prog, myResults, myInvoices, mySponsors, myHolds })
    })().catch((e) => { if (alive) setRec({ error: e?.message || 'Failed to load your record' }) })
    return () => { alive = false }
  }, [me, reloadN])

  if (!rec) return <Panel title="My portal"><div className="di-sub">Loading your record…</div></Panel>
  if (rec.error) return <Panel title="My portal"><div className="di-sub">Couldn’t load your record — {rec.error}</div></Panel>

  const { audit, prog, myResults, myInvoices, mySponsors, myHolds } = rec
  const passedCodes = myResults
    .filter((r) => Math.round(r.ca * 0.4 + r.exam * 0.6) >= 50)
    .map((r) => r.code)
  const balance = myInvoices.reduce((s, i) => s + i.balance, 0)

  const reload = () => setReloadN((n) => n + 1)
  const ctx = { me, audit, prog, myResults, passedCodes, myInvoices, balance, mySponsors, myHolds, registered, setRegistered, reload }

  return (
    <>
      <Tabs
        tabs={['My Studies', 'Registration', 'Grades & Transcript', 'My Timetable', 'My Finance', 'Holds & Documents']}
        active={tab}
        onChange={setTab}
      />
      {tab === 'My Studies' && <MyStudies {...ctx} />}
      {tab === 'Registration' && <Registration {...ctx} />}
      {tab === 'Grades & Transcript' && <Transcript {...ctx} />}
      {tab === 'My Timetable' && <MyTimetable {...ctx} />}
      {tab === 'My Finance' && <MyFinance {...ctx} />}
      {tab === 'Holds & Documents' && <HoldsDocs {...ctx} />}
    </>
  )
}

// ---------- My Studies: programme header + degree audit ----------
function MyStudies({ audit, prog }) {
  if (!audit) return <Panel title="My studies"><div className="di-sub">No academic record on file yet.</div></Panel>
  const total = audit.reqs.find((r) => /total credits/i.test(r.req)) || audit.reqs[audit.reqs.length - 1]
  const yearOf = prog ? Math.min(prog.years, Math.max(1, prog.years - 1)) : 1

  return (
    <>
      <div className="stat-row c4">
        <StatCard icon="🎓" label="Programme" value={audit.prog} delta={prog?.name} deltaTone="neutral" />
        <StatCard icon="📅" label="Year of study" value={`Year ${yearOf}`} delta={`Catalog ${audit.catalog} · Semester 2, 2026`} deltaTone="neutral" />
        <StatCard icon="📈" label="Cumulative GPA" value={audit.gpa.toFixed(2)} delta="of 4.00" deltaTone={audit.gpa >= 2 ? 'up' : 'down'} />
        <StatCard icon="✅" label="Credits earned" value={`${total.done}/${total.need}`} delta={`${total.inprog} in progress`} deltaTone="neutral" />
      </div>

      <Panel title="Degree audit" subtitle={`${prog?.name || audit.prog} · NQF ${prog?.nqf ?? '—'} · progress to graduation, requirement by requirement`}>
        {audit.reqs.map((r) => {
          const pct = Math.min(100, Math.round((r.done / r.need) * 100))
          const tone = r.status === 'Satisfied' ? 'green' : r.status === 'Not satisfied' ? 'red' : 'amber'
          return (
            <div key={r.req} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <div className="cf-row" style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{r.req} <Badge tone={tone}>{r.status}</Badge></span>
                <span className="mono" style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{r.done} / {r.need} cr</span>
              </div>
              <Progress pct={pct} tone={r.status === 'Not satisfied' ? 'red' : ''} />
            </div>
          )
        })}
      </Panel>
    </>
  )
}

// ---------- Registration: the self-service rules engine ----------
function Registration({ audit, passedCodes, myHolds, registered, setRegistered }) {
  const blockingHold = myHolds.find((h) => h.impact.some((i) => /registration/i.test(i)))
  const [toast, showToast] = useToast()
  const [busy, setBusy] = useState(null)

  // the student's own programme catalogue (mock or Supabase per api mode)
  const [catalogue, setCatalogue] = useState([])
  useEffect(() => {
    let alive = true
    api.listCourses(audit?.prog).then((rows) => { if (alive) setCatalogue(rows) }).catch(() => {})
    return () => { alive = false }
  }, [audit?.prog])

  const registeredCredits = registered.reduce((s, code) => {
    const c = catalogue.find((x) => x.code === code)
    return s + (c ? c.credits : 0)
  }, 0)

  // The rules engine is server-authoritative in http mode (RPC register_course).
  // Client-side pre-checks stay for instant feedback / mock mode.
  const register = async (c) => {
    if (blockingHold) return showToast(`Blocked — ${blockingHold.type.toLowerCase()} hold must be cleared first`)
    if (registeredCredits + c.credits > SEM_CREDIT_CAP)
      return showToast(`Over the ${SEM_CREDIT_CAP}-credit semester limit — drop a course first`)
    setBusy(c.code)
    try {
      const res = await api.registerCourse({ courseId: c.id, courseCode: c.code })
      if (res && res.ok === false) return showToast(res.message || 'Registration was declined')
      setRegistered((r) => [...r, c.code])
      showToast((res && res.message) || `Registered in ${c.code} — ${fmtN(c.credits * CREDIT_RATE)} assessed to your account`)
    } catch (e) {
      showToast(e?.message || 'Registration failed')
    } finally {
      setBusy(null)
    }
  }

  // evaluate the rules engine for a course, in the documented order:
  // holds → already passed → capacity → prerequisite → eligible
  const evaluate = (c) => {
    if (registered.includes(c.code)) return { state: 'registered', label: '✓ Registered', tone: 'green' }
    if (passedCodes.includes(c.code)) return { state: 'passed', label: 'Already passed', tone: 'blue' }
    if (c.enrolled >= c.cap) return { state: 'full', label: 'Full — join waitlist', tone: 'amber' }
    if (c.prereq !== '—' && !passedCodes.includes(c.prereq)) return { state: 'prereq', label: `Prerequisite ${c.prereq} not met`, tone: 'red' }
    return { state: 'ok', label: 'Eligible', tone: 'green' }
  }

  return (
    <>
      <div className={`note-banner`} style={blockingHold ? { background: 'var(--red-soft)', borderColor: '#eccfc9' } : undefined}>
        <span>{blockingHold ? '🚫' : 'ℹ️'}</span>
        <div>
          {blockingHold ? (
            <><strong style={{ color: 'var(--red)' }}>{blockingHold.type} hold</strong> — {blockingHold.reason}. Registration is blocked until it clears.</>
          ) : (
            <>Semester 2, 2026 registration is <strong>open</strong> — no holds on your record. Each course you add
            validates <strong>holds → prerequisites → capacity → credit limit</strong> and assesses the charge live
            (N$ {CREDIT_RATE.toLocaleString()}/credit).</>
          )}
        </div>
      </div>

      <Panel
        title="Course registration"
        subtitle={`${registered.length} registered · ${registeredCredits}/${SEM_CREDIT_CAP} credits this semester`}
        flush
      >
        <table className="data">
          <thead>
            <tr>
              <th>Course</th><th>Programme</th><th className="num">Credits</th><th className="num">Seats</th>
              <th>Prerequisite</th><th style={{ width: 190 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {catalogue.map((c) => {
              const ev = evaluate(c)
              return (
                <tr key={c.code}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.code}</div>
                    <div className="di-sub">{c.title}</div>
                  </td>
                  <td>{c.prog}</td>
                  <td className="num">{c.credits}</td>
                  <td className="num" style={{ color: c.enrolled >= c.cap ? 'var(--red)' : 'var(--ink)' }}>{c.enrolled}/{c.cap}</td>
                  <td className="mono" style={{ fontSize: 12.5 }}>{c.prereq}</td>
                  <td>
                    {ev.state === 'ok' ? (
                      <button className="btn primary sm" disabled={busy === c.code} onClick={() => register(c)}>{busy === c.code ? '…' : 'Register'}</button>
                    ) : ev.state === 'full' ? (
                      <button className="btn ghost sm" onClick={() => showToast(`Added to the ${c.code} waitlist — you'll be notified if a seat frees up`)}>Join waitlist</button>
                    ) : (
                      <Badge tone={ev.tone}>{ev.label}</Badge>
                    )}
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

// ---------- Grades & Transcript ----------
function Transcript({ audit, myResults }) {
  const publishedOf = (code) => EXAM_BOARD.find((e) => e.code === code)?.status === 'Published'

  return (
    <>
      <Panel title="Results" subtitle="Continuous assessment (40%) + exam (60%) → final mark. Provisional until the exam board publishes.">
        {myResults.length === 0 ? (
          <div className="di-sub">No results released yet — held by your lecturers until the exam board sits.</div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Course</th><th className="num">CA (40%)</th><th className="num">Exam (60%)</th>
                <th className="num">Final</th><th>Grade</th><th className="num">GPA</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {myResults.map((r) => {
                const final = Math.round(r.ca * 0.4 + r.exam * 0.6)
                const g = gradeOf(final)
                const pub = publishedOf(r.code)
                const title = COURSES.find((c) => c.code === r.code)?.title
                return (
                  <tr key={r.code}>
                    <td><div style={{ fontWeight: 600 }}>{r.code}</div><div className="di-sub">{title}</div></td>
                    <td className="num">{r.ca}</td>
                    <td className="num">{r.exam}</td>
                    <td className="num" style={{ fontWeight: 700, color: final < 50 ? 'var(--red)' : 'var(--ink)' }}>{final}%</td>
                    <td className="mono" style={{ fontWeight: 600 }}>{g.letter}</td>
                    <td className="num mono">{g.gpa.toFixed(1)}</td>
                    <td><Badge tone={pub ? 'green' : 'amber'}>{pub ? 'Published' : 'Provisional'}</Badge></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Panel>

      {audit && (
        <Panel title="Academic transcript" subtitle={`${audit.prog} · catalog ${audit.catalog} · official cumulative standing`}>
          <div className="cf-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <span>Cumulative GPA</span><span className="mono" style={{ fontWeight: 700 }}>{audit.gpa.toFixed(2)} / 4.00</span>
          </div>
          <div className="cf-row" style={{ padding: '8px 0' }}>
            <span>Academic standing</span>
            <Badge tone={audit.gpa >= 2 ? 'green' : 'red'}>{audit.gpa >= 2 ? 'Good standing' : 'Academic probation'}</Badge>
          </div>
        </Panel>
      )}
    </>
  )
}

// ---------- My Timetable (university-framed stand-in grid) ----------
const MY_TT = {
  P1: [{ s: 'VTW210', r: 'Workshop A' }, null, { s: 'VTW210', r: 'Workshop A' }, null, { s: 'TRT120', r: 'Lecture Hall 2' }],
  P2: [{ s: 'TRT120', r: 'Lecture Hall 2' }, { s: 'VTW210', r: 'Workshop A' }, null, { s: 'ENT100', r: 'Rm 9' }, null],
  P3: [null, { s: 'ENT100', r: 'Rm 9' }, { s: 'TRT120', r: 'Lecture Hall 2' }, { s: 'VTW210', r: 'Workshop A' }, { s: 'IND199', r: 'Industry site' }],
  P4: [{ s: 'ENT100', r: 'Rm 9' }, null, { s: 'VTW210', r: 'Workshop A' }, { s: 'TRT120', r: 'Lecture Hall 2' }, { s: 'IND199', r: 'Industry site' }],
  P5: [{ s: 'VTW210', r: 'Workshop A' }, { s: 'TRT120', r: 'Lecture Hall 2' }, null, null, { s: 'IND199', r: 'Industry site' }],
  P6: [null, { s: 'IND199', r: 'Industry site' }, { s: 'ENT100', r: 'Rm 9' }, null, null],
}

function MyTimetable({ audit, prog }) {
  return (
    <Panel title="My weekly timetable" subtitle={`${audit?.prog || ''} ${prog?.name ? '· ' + prog.name : ''} · Semester 2, 2026`}>
      <TimetableGrid data={MY_TT} />
    </Panel>
  )
}

// ---------- My Finance ----------
function MyFinance({ myInvoices, balance, mySponsors, registered = [], reload }) {
  const [toast, showToast] = useToast()
  const [payFor, setPayFor] = useState(null)  // the invoice being paid
  const [paying, setPaying] = useState(false)

  // charges assessed by this session's course registration flow into the balance
  const regCharges = registered.map((code) => COURSES.find((c) => c.code === code)).filter(Boolean)
  const pending = regCharges.reduce((s, c) => s + c.credits * CREDIT_RATE, 0)
  const totalDue = balance + pending

  // Payment is server-authoritative in http mode (RPC pay_invoice): it records the
  // payment, reduces the balance and auto-releases financial holds when cleared.
  const pay = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const amount = Number(fd.get('amt'))
    const method = String(fd.get('method'))
    setPaying(true)
    try {
      const res = await api.payInvoice({ invoiceId: payFor?.id, amount, method })
      if (res && res.ok === false) { showToast(res.message || 'Payment was declined'); return }
      showToast((res && res.message) || 'Payment initiated — a receipt will be emailed once it clears (demo)')
      setPayFor(null)
      reload && reload()
    } catch (err) {
      showToast(err?.message || 'Payment failed')
    } finally {
      setPaying(false)
    }
  }

  return (
    <>
      <div className="stat-row c4">
        <StatCard icon="💳" label="Account balance" value={fmtN(totalDue)} delta={pending > 0 ? `incl. ${fmtN(pending)} new registration` : totalDue > 0 ? 'Due this semester' : 'Settled'} deltaTone={totalDue > 0 ? 'down' : 'up'} />
        <StatCard icon="🧾" label="Invoices" value={String(myInvoices.length)} delta="This academic year" deltaTone="neutral" />
        <StatCard icon="🎓" label="Sponsorships" value={String(mySponsors.length)} delta={mySponsors.map((s) => s.sponsor).join(', ') || '—'} deltaTone="neutral" />
      </div>

      {regCharges.length > 0 && (
        <Panel title="Registration charges — Semester 2, 2026" subtitle="Assessed when you registered courses in the Registration tab" flush>
          <table className="data">
            <thead><tr><th>Course</th><th className="num">Credits</th><th className="num">Charge</th></tr></thead>
            <tbody>
              {regCharges.map((c) => (
                <tr key={c.code}><td><span style={{ fontWeight: 600 }}>{c.code}</span> <span className="di-sub">{c.title}</span></td><td className="num">{c.credits}</td><td className="num">{fmtN(c.credits * CREDIT_RATE)}</td></tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <Panel
        title="My invoices"
        subtitle="Tuition is VAT-exempt (VAT Act 10 of 2000)"
        actions={myInvoices.some((i) => i.balance > 0) && <button className="btn primary sm" onClick={() => setPayFor(myInvoices.find((i) => i.balance > 0))}>Pay now</button>}
        flush
      >
        <table className="data">
          <thead>
            <tr><th>Invoice</th><th>Due</th><th className="num">Amount</th><th className="num">Balance</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {myInvoices.map((i) => (
              <tr key={i.id}>
                <td className="mono" style={{ fontSize: 12.5 }}>{i.id}</td>
                <td>{i.due}</td>
                <td className="num">{fmtN(i.amount)}</td>
                <td className="num" style={{ color: i.balance > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
                  {i.balance > 0 ? fmtN(i.balance) : 'Paid'}
                </td>
                <td><Badge tone={i.status === 'Paid' ? 'green' : i.status === 'Overdue' ? 'red' : 'amber'}>{i.status}</Badge></td>
                <td>{i.balance > 0 && <button className="btn ghost sm" onClick={() => setPayFor(i)}>Pay</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {mySponsors.length > 0 && (
        <Panel title="Funding & sponsorships" subtitle="Applied to your account — claims tracked to the funder" flush>
          <table className="data">
            <thead>
              <tr><th>Sponsor</th><th>Type</th><th className="num">Coverage</th><th className="num">Billed</th><th>Status</th></tr>
            </thead>
            <tbody>
              {mySponsors.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.sponsor}</td>
                  <td>{s.type}</td>
                  <td className="num">{s.coverage}%</td>
                  <td className="num">{fmtN(s.billed)}</td>
                  <td><Badge tone={s.status === 'Paid' ? 'green' : 'amber'}>{s.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {payFor != null && (
        <Modal title="Pay tuition" onClose={() => setPayFor(null)} width={420}>
          <form onSubmit={pay}>
            <div className="field"><label>Amount (N$)</label><input name="amt" type="number" defaultValue={payFor.balance} min="1" max={payFor.balance} required /></div>
            <div className="field">
              <label>Method</label>
              <select name="method"><option>Card</option><option>Bank transfer / EFT</option><option>e-Wallet</option></select>
            </div>
            <button className="btn primary" type="submit" disabled={paying}>{paying ? 'Processing…' : `Pay ${fmtN(payFor.balance)}`}</button>
          </form>
        </Modal>
      )}
      <Toast msg={toast} />
    </>
  )
}

// ---------- Holds & Documents ----------
function HoldsDocs({ myHolds }) {
  const [toast, showToast] = useToast()
  const docs = ['Official transcript', 'Proof of registration', 'Statement of account', 'Confirmation letter']

  return (
    <>
      {myHolds.length === 0 ? (
        <div className="note-banner" style={{ background: 'var(--green-soft)', borderColor: '#cfe6d4' }}>
          <span>✅</span>
          <div>No active holds on your record — you are <strong>cleared to register</strong> and to request documents.</div>
        </div>
      ) : (
        myHolds.map((h, i) => (
          <div key={i} className="note-banner" style={{ background: 'var(--red-soft)', borderColor: '#eccfc9' }}>
            <span>🚫</span>
            <div>
              <strong style={{ color: 'var(--red)' }}>{h.type} hold since {h.since}</strong> — {h.reason}.{' '}
              {h.impact.map((im) => <Badge key={im} tone="red">{im}</Badge>)}{' '}
              <span className="di-sub">Auto-releases when the condition clears.</span>
            </div>
          </div>
        ))
      )}

      <Panel title="Request documents" subtitle="Official documents are released only when your record is free of holds">
        <div className="grid2">
          {docs.map((d) => (
            <button
              key={d}
              className="btn ghost"
              style={{ justifyContent: 'flex-start', opacity: myHolds.length ? 0.5 : 1 }}
              disabled={myHolds.length > 0}
              onClick={() => showToast(`${d} requested — ready to download within 24h (demo)`)}
            >
              ⬇ {d}
            </button>
          ))}
        </div>
      </Panel>
      <Toast msg={toast} />
    </>
  )
}
