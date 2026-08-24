import React, { useCallback, useEffect, useState } from 'react'
import { StatCard, Tabs, Panel, Badge, Modal, Toast, useToast, Icon } from '../ui.jsx'
import { fmtN } from '../lib/format.js'
import { gradeOf, evaluateResult } from '../lib/academics.js'
import { ATTENDANCE_MIN } from '../lib/controls.js'
import {
  getDegreeAudit, listProgrammes, getResultsForStudent, getInvoicesForStudent, getSponsorsForStudent,
  getHoldsForStudent, getAttendanceForStudent, listCourses, registerCourse, listTimetable,
  listAnnouncements, listQueries, createQuery, submitInvoiceProof, listDocumentsForStudent,
} from '../api.js'
import { TimetableGrid } from './Scheduling.jsx'

const CREDIT_RATE = 1150
const SEM_CREDIT_CAP = 72

export default function StudentPortal({ role }) {
  const me = role.user
  const [tab, setTab] = useState('My Studies')
  const [registered, setRegistered] = useState([])
  const [rec, setRec] = useState(null)
  const [reloadN, setReloadN] = useState(0)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [audit, programmes, myResults, myInvoices, mySponsors, myHolds, attendance] = await Promise.all([
        getDegreeAudit(me), listProgrammes(), getResultsForStudent(me), getInvoicesForStudent(me),
        getSponsorsForStudent(me), getHoldsForStudent(me), getAttendanceForStudent(me),
      ])
      if (!alive) return
      const prog = programmes.find((p) => p.code === audit?.prog)
      setRec({ audit, prog, myResults, myInvoices, mySponsors, myHolds, attendance })
    })().catch((e) => { if (alive) setRec({ error: e?.message || 'Failed to load your record' }) })
    return () => { alive = false }
  }, [me, reloadN])

  if (!rec) return <Panel title="My portal"><Empty>Loading your record...</Empty></Panel>
  if (rec.error) return <Panel title="My portal"><Empty>Could not load your record: {rec.error}</Empty></Panel>

  const balance = rec.myInvoices.reduce((s, i) => s + Number(i.balance || 0), 0)
  const passedCodes = rec.myResults.filter((r) => evaluateResult({ ca: r.ca, exam: r.exam }).outcome === 'pass').map((r) => r.code)
  const reload = () => setReloadN((n) => n + 1)
  const ctx = { me, ...rec, balance, passedCodes, registered, setRegistered, reload }

  return (
    <>
      <Tabs tabs={['My Studies', 'Registration', 'Grades & Transcript', 'My Timetable', 'My Finance', 'Announcements', 'Ask Lecturer', 'Holds & Documents']} active={tab} onChange={setTab} />
      {tab === 'My Studies' && <MyStudies {...ctx} />}
      {tab === 'Registration' && <Registration {...ctx} />}
      {tab === 'Grades & Transcript' && <Transcript {...ctx} />}
      {tab === 'My Timetable' && <MyTimetable {...ctx} />}
      {tab === 'My Finance' && <MyFinance {...ctx} />}
      {tab === 'Announcements' && <Announcements />}
      {tab === 'Ask Lecturer' && <AskLecturer {...ctx} />}
      {tab === 'Holds & Documents' && <HoldsDocs {...ctx} />}
    </>
  )
}

function MyStudies({ audit, prog, attendance }) {
  if (!audit) return <Panel title="My studies"><Empty>No academic record on file yet.</Empty></Panel>
  const att = attendance || { percent: 0, hoursAttended: 0, hoursTotal: 0 }
  const attOk = att.percent >= ATTENDANCE_MIN
  return (
    <>
      <div className="stat-row c4">
        <StatCard icon="🎓" label="Programme" value={audit.prog || '-'} delta={prog?.name || ''} deltaTone="neutral" />
        <StatCard icon="📈" label="Cumulative GPA" value={Number(audit.gpa || 0).toFixed(2)} delta="of 4.00" deltaTone={audit.gpa >= 2 ? 'up' : 'down'} />
        <StatCard icon="⏰" label="Attendance" value={`${att.percent || 0}%`} delta={`${att.hoursAttended || 0}/${att.hoursTotal || 0} hrs`} deltaTone={attOk ? 'up' : 'down'} />
        <StatCard icon="📚" label="Requirements" value={String((audit.reqs || []).length)} delta="degree audit" deltaTone="neutral" />
      </div>
      <Panel title="Degree audit" subtitle={`${prog?.name || audit.prog} · progress to graduation`}>
        {(audit.reqs || []).length === 0 ? <Empty>No requirements loaded yet.</Empty> : (audit.reqs || []).map((r) => (
          <div key={r.req} className="cf-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <span>{r.req}</span><span><Badge tone={r.status === 'Satisfied' ? 'green' : 'amber'}>{r.status}</Badge> {r.done}/{r.need} cr</span>
          </div>
        ))}
      </Panel>
    </>
  )
}

function Registration({ audit, passedCodes, myHolds, registered, setRegistered, reload }) {
  const [toast, showToast] = useToast()
  const [catalogue, setCatalogue] = useState([])
  const [busy, setBusy] = useState(null)
  const blockingHold = myHolds.find((h) => (h.impact || []).some((i) => /registration/i.test(i)))
  useEffect(() => { listCourses(audit?.prog).then(setCatalogue).catch(() => setCatalogue([])) }, [audit?.prog])
  const registeredCredits = registered.reduce((s, code) => s + (catalogue.find((x) => x.code === code)?.credits || 0), 0)
  const register = async (c) => {
    if (blockingHold) return showToast(`Blocked: ${blockingHold.reason}`)
    if (registeredCredits + Number(c.credits || 0) > SEM_CREDIT_CAP) return showToast(`Over the ${SEM_CREDIT_CAP}-credit semester limit`)
    setBusy(c.code)
    try {
      const res = await registerCourse({ courseId: c.id, courseCode: c.code })
      if (res && res.ok === false) return showToast(res.message || 'Registration declined')
      setRegistered((r) => [...r, c.code])
      reload && reload()
      showToast((res && res.message) || `Registered in ${c.code}`)
    }
    catch (err) { showToast('Registration failed: ' + (err?.message || err)) }
    finally { setBusy(null) }
  }
  return (
    <>
      <Panel title="Course registration" subtitle={`${registered.length} registered · ${registeredCredits}/${SEM_CREDIT_CAP} credits`} flush>
        {catalogue.length === 0 ? <Empty>No courses are available for registration.</Empty> : (
          <table className="data"><thead><tr><th>Course</th><th>Programme</th><th className="num">Credits</th><th>Action</th></tr></thead>
            <tbody>{catalogue.map((c) => {
              const blocked = passedCodes.includes(c.code) || registered.includes(c.code)
              return <tr key={c.id || c.code}><td><strong>{c.code}</strong><div className="di-sub">{c.title}</div></td><td>{c.prog || '-'}</td><td className="num">{c.credits || 0}</td><td>{blocked ? <Badge tone="green">{registered.includes(c.code) ? 'Registered' : 'Passed'}</Badge> : <button className="btn primary sm" disabled={busy === c.code} onClick={() => register(c)}>{busy === c.code ? '...' : 'Register'}</button>}</td></tr>
            })}</tbody>
          </table>
        )}
      </Panel>
      <Toast msg={toast} />
    </>
  )
}

function Transcript({ audit, myResults }) {
  return (
    <>
      <Panel title="Results" subtitle="Continuous assessment + exam -> final mark">
        {myResults.length === 0 ? <Empty>No results released yet.</Empty> : (
          <table className="data"><thead><tr><th>Course</th><th className="num">CA</th><th className="num">Exam</th><th className="num">Final</th><th>Grade</th><th>Status</th></tr></thead>
            <tbody>{myResults.map((r) => {
              const res = evaluateResult({ ca: r.ca, exam: r.exam })
              const g = gradeOf(res.final)
              return <tr key={r.code}><td>{r.code}</td><td className="num">{r.ca}</td><td className="num">{r.exam}</td><td className="num">{res.final}%</td><td>{g.letter}</td><td><Badge tone={r.published ? 'green' : 'amber'}>{r.published ? 'Published' : 'Provisional'}</Badge></td></tr>
            })}</tbody>
          </table>
        )}
      </Panel>
      {audit && <Panel title="Academic transcript"><div className="cf-row"><span>Cumulative GPA</span><span className="mono">{Number(audit.gpa || 0).toFixed(2)} / 4.00</span></div></Panel>}
    </>
  )
}

function MyTimetable() {
  const [rows, setRows] = useState([])
  useEffect(() => { listTimetable().then(setRows).catch(() => setRows([])) }, [])
  const grid = rows.reduce((out, r) => {
    const period = r.period || 'P1'
    if (!out[period]) out[period] = [null, null, null, null, null]
    out[period][Math.max(0, Math.min(4, Number(r.day || 1) - 1))] = { s: r.subject, r: r.venue }
    return out
  }, {})
  return <Panel title="My weekly timetable"><TimetableGrid data={grid} /></Panel>
}

function MyFinance({ myInvoices, balance, mySponsors, registered, reload }) {
  const [toast, showToast] = useToast()
  const [payFor, setPayFor] = useState(null)
  const [paying, setPaying] = useState(false)
  const pending = registered.length * CREDIT_RATE
  const submitProof = async (e) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget)
    setPaying(true)
    try { await submitInvoiceProof({ invoiceId: payFor?.id, amount: Number(fd.get('amt')), file: fd.get('proof') }); setPayFor(null); reload(); showToast('Proof submitted') }
    catch (err) { showToast('Upload failed: ' + (err?.message || err)) }
    finally { setPaying(false) }
  }
  return (
    <>
      <div className="stat-row c4">
        <StatCard icon="💳" label="Account balance" value={fmtN(balance + pending)} delta={pending ? `incl. ${fmtN(pending)} new registration` : 'current'} deltaTone={balance > 0 ? 'down' : 'up'} />
        <StatCard icon="🧾" label="Invoices" value={String(myInvoices.length)} delta="this year" />
        <StatCard icon="🎓" label="Sponsorships" value={String(mySponsors.length)} delta="funding records" />
      </div>
      <Panel title="My invoices" flush>
        {myInvoices.length === 0 ? <Empty>No invoices yet.</Empty> : <table className="data"><thead><tr><th>Invoice</th><th>Due</th><th className="num">Amount</th><th className="num">Balance</th><th>Status</th><th></th></tr></thead>
          <tbody>{myInvoices.map((i) => <tr key={i.id}><td>{i.id}</td><td>{i.due || '-'}</td><td className="num">{fmtN(i.amount)}</td><td className="num">{fmtN(i.balance)}</td><td><Badge tone={i.status === 'Paid' ? 'green' : 'amber'}>{i.status}</Badge></td><td>{i.balance > 0 && <button className="btn ghost sm" onClick={() => setPayFor(i)}>Upload proof</button>}</td></tr>)}</tbody>
        </table>}
      </Panel>
      {mySponsors.length > 0 && <Panel title="Funding & sponsorships" flush><table className="data"><thead><tr><th>Sponsor</th><th>Type</th><th className="num">Coverage</th><th>Status</th></tr></thead><tbody>{mySponsors.map((s) => <tr key={s.id}><td>{s.sponsor}</td><td>{s.type}</td><td className="num">{s.coverage}%</td><td>{s.status}</td></tr>)}</tbody></table></Panel>}
      {payFor && <Modal title="Upload proof of payment" onClose={() => setPayFor(null)}>
        <form onSubmit={submitProof}><div className="field"><label>Amount paid (N$)</label><input name="amt" type="number" defaultValue={payFor.balance} min="1" required /></div><div className="field"><label>Proof</label><input name="proof" type="file" accept="image/*,application/pdf" required /></div><button className="btn primary" disabled={paying}>{paying ? 'Uploading...' : 'Submit proof'}</button></form>
      </Modal>}
      <Toast msg={toast} />
    </>
  )
}

function Announcements() {
  const [items, setItems] = useState([])
  useEffect(() => { listAnnouncements('students').then(setItems).catch(() => setItems([])) }, [])
  return <Panel title="Announcements" flush>{items.length === 0 ? <Empty>No announcements yet.</Empty> : items.map((a) => <div key={a.id} className="note-banner"><Icon name="send" size={16} /><div><strong>{a.title}</strong><div className="di-sub">{a.body}</div></div></div>)}</Panel>
}

function AskLecturer({ me, myResults }) {
  const [rows, setRows] = useState([])
  const [toast, showToast] = useToast()
  useEffect(() => { listQueries({ student: me }).then(setRows).catch(() => setRows([])) }, [me])
  const submit = async (e) => {
    e.preventDefault(); const f = e.target
    try { await createQuery({ course: f.course.value, student: me, subject: f.subject.value, body: f.body.value }); f.reset(); setRows(await listQueries({ student: me })); showToast('Question sent') }
    catch (err) { showToast('Could not send: ' + (err?.message || err)) }
  }
  return (
    <>
      <div className="grid2"><Panel title="Ask your lecturer"><form onSubmit={submit}><div className="field"><label>Course</label><select name="course">{myResults.map((r) => <option key={r.code}>{r.code}</option>)}</select></div><div className="field"><label>Subject</label><input name="subject" required /></div><div className="field"><label>Your question</label><textarea name="body" rows={4} required /></div><button className="btn primary">Send</button></form></Panel>
        <Panel title="My questions" flush>{rows.length === 0 ? <Empty>No questions yet.</Empty> : rows.map((q) => <div key={q.id} className="note-banner"><Icon name={q.status === 'answered' ? 'check' : 'send'} size={16} /><div><strong>{q.subject}</strong><div className="di-sub">{q.body}</div>{q.reply && <div>{q.reply}</div>}</div></div>)}</Panel></div>
      <Toast msg={toast} />
    </>
  )
}

function HoldsDocs({ myHolds, attendance }) {
  const [docs, setDocs] = useState([])
  useEffect(() => { listDocumentsForStudent().then(setDocs).catch(() => setDocs([])) }, [])
  const att = attendance?.percent ?? 0
  return (
    <>
      {myHolds.length === 0 ? <div className="note-banner" style={{ background: 'var(--green-soft)', borderColor: '#cfe6d4' }}><Icon name="check" size={16} /><div>No active holds on your record.</div></div> : myHolds.map((h, i) => <div key={i} className="note-banner" style={{ background: 'var(--red-soft)', borderColor: '#eccfc9' }}><Icon name="ban" size={16} /><div><strong>{h.type} hold</strong> - {h.reason}</div></div>)}
      <Panel title="Documents" subtitle={`Attendance ${att}% · minimum ${ATTENDANCE_MIN}% for exam permits`} flush>
        {docs.length === 0 ? <Empty>No official documents have been issued yet.</Empty> : <table className="data"><thead><tr><th>Type</th><th>Issued</th><th>Path</th></tr></thead><tbody>{docs.map((d) => <tr key={d.id}><td>{d.type}</td><td>{d.issued_at || '-'}</td><td>{d.path || '-'}</td></tr>)}</tbody></table>}
      </Panel>
    </>
  )
}

function Empty({ children }) {
  return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)' }}>{children}</div>
}
