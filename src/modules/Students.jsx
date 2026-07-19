import React, { useEffect, useState } from 'react'
import { StatCard, Panel, Badge, Avatar, Modal, Toast, useToast } from '../ui.jsx'
import { SCHOOL, LEARNERS, INVOICES, GRADEBOOKS, LOANS, INCIDENTS, HOLDS, gradeOf, fmtN } from '../data.js'
import { STUDENT_DOCUMENTS, ATTENDANCE_MIN } from '../lib/controls.js'

// Open a print-ready official document in a new window (letterhead + body).
function printStudentDoc(student, docLabel, bodyHtml) {
  const w = window.open('', '_blank', 'width=760,height=900')
  if (!w) return
  w.document.write(`<!doctype html><html><head><title>${docLabel} — ${student.name}</title>
    <style>
      body{font-family:Georgia,'Times New Roman',serif;color:#12303f;margin:48px;line-height:1.55}
      .lh{display:flex;align-items:center;gap:14px;border-bottom:3px solid #12506b;padding-bottom:14px}
      .lh .m{width:46px;height:46px;border-radius:10px;background:#12506b;color:#fff;display:grid;place-items:center;font-weight:800;font-size:22px}
      h1{font-size:19px;margin:26px 0 4px}
      .meta{font-size:13px;color:#5a7180;margin-bottom:18px}
      table{border-collapse:collapse;width:100%;font-size:13px;margin:10px 0}
      td,th{border:1px solid #d7e0e7;padding:6px 9px;text-align:left}
      .sig{margin-top:60px;font-size:13px}
      .foot{margin-top:40px;font-size:11px;color:#7c93a2;border-top:1px solid #d7e0e7;padding-top:10px}
    </style></head><body>
    <div class="lh"><div class="m">S</div><div>
      <div style="font-weight:700;font-size:16px">Symanek Specialized College</div>
      <div style="font-size:12px;color:#5a7180">ERF 2948, Extension 6, Okahandja, Namibia</div>
    </div></div>
    <h1>${docLabel}</h1>
    <div class="meta">Student: <b>${student.name}</b> · ${student.id} · ${student.grade} · Issued ${new Date().toLocaleDateString('en-NA')}</div>
    ${bodyHtml}
    <div class="sig">_____________________________<br/>Registrar · Symanek Specialized College</div>
    <div class="foot">This is a computer-generated document from the Symanek Suite. Verify authenticity with the Registrar's office.</div>
    </body></html>`)
  w.document.close()
  w.focus()
  w.print()
}

// Student 360 — every module converges on one learner file:
// account (Finance), marks (Gradebooks), library loans, incidents, attendance.
// `focus` (a learner name from global search) opens that 360 directly.
export default function Students({ focus, clearFocus, go }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(null)
  const [learners, setLearners] = useState(LEARNERS)
  const [showAdd, setShowAdd] = useState(false)
  const [toast, showToast] = useToast()

  useEffect(() => {
    if (!focus) return
    const hit = LEARNERS.find((l) => l.name === focus)
    if (hit) setSel(hit)
    clearFocus()
  }, [focus, clearFocus])

  const addLearner = (e) => {
    e.preventDefault()
    const f = e.target
    const l = {
      id: `STU-${1300 + learners.length}`, name: f.name.value, grade: f.grade.value,
      guardian: f.guardian.value || '(pending)', phone: f.phone.value || '+264 81 000 0000',
      status: 'Enrolled', attendance: 100,
    }
    setLearners((ls) => [l, ...ls])
    setShowAdd(false)
    showToast(`${l.name} enrolled — ${l.id} · Term 3 invoice will be generated`)
  }

  const rows = learners.filter(
    (s) =>
      s.name.toLowerCase().includes(q.toLowerCase()) ||
      s.grade.toLowerCase().includes(q.toLowerCase()) ||
      s.id.toLowerCase().includes(q.toLowerCase())
  )

  const balance = (name) => INVOICES.filter((i) => i.learner === name).reduce((s, i) => s + i.balance, 0)

  return (
    <>
      <div className="stat-row c4">
        <StatCard icon="🎓" label="Enrolled" value={SCHOOL.learners} delta="+18 this semester" />
        <StatCard icon="🏛️" label="Programmes" value="5" delta="DBA-6 → Bridging" deltaTone="neutral" />
        <StatCard icon="⏰" label="Avg attendance" value="94%" delta="Target 95%" deltaTone="neutral" />
        <StatCard icon="⚠️" label="In arrears" value="94" delta="N$ 210,000 outstanding" deltaTone="down" />
      </div>

      <Panel
        title="Student register"
        subtitle={`Sample of ${LEARNERS.length} (of ${SCHOOL.learners}) · click a student for the full 360° file`}
        actions={
          <>
            <input
              className="inline"
              style={{ width: 220 }}
              placeholder="Search name, grade or ID…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="btn primary sm" onClick={() => setShowAdd(true)}>+ Add learner</button>
          </>
        }
        flush
      >
        <table className="data">
          <thead>
            <tr>
              <th>Student</th><th>ID</th><th>Programme</th><th>Next of kin</th>
              <th className="num">Attendance</th><th className="num">Balance</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const bal = balance(s.name)
              return (
                <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => setSel(s)}>
                  <td>
                    <div className="emp-cell">
                      <Avatar name={s.name} />
                      <span className="en">{s.name}</span>
                    </div>
                  </td>
                  <td className="mono" style={{ fontSize: 12.5 }}>{s.id}</td>
                  <td>{s.grade}</td>
                  <td>{s.guardian}</td>
                  <td className="num" style={{ color: s.attendance < 85 ? 'var(--red)' : 'var(--ink)' }}>{s.attendance}%</td>
                  <td className="num" style={{ color: bal > 0 ? 'var(--red)' : 'var(--ink-faint)' }}>{fmtN(bal)}</td>
                  <td><Badge tone={s.status === 'Sponsored' ? 'purple' : 'green'}>{s.status}</Badge></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Panel>

      {showAdd && (
        <Modal title="Add learner" onClose={() => setShowAdd(false)} width={440}>
          <form onSubmit={addLearner}>
            <div className="field"><label>Full name</label><input name="name" placeholder="e.g. Ndeshi Amwaama" required /></div>
            <div className="grid2" style={{ gap: 12 }}>
              <div className="field">
                <label>Programme / year</label>
                <select name="grade">
                  <option>DBA-6 Y1</option><option>DAF-6 Y1</option><option>CIT-5 Y1</option>
                  <option>CVT-4 Y1</option><option>BED-7 Y1</option>
                </select>
              </div>
              <div className="field"><label>Next of kin phone</label><input name="phone" placeholder="+264 81 …" /></div>
            </div>
            <div className="field"><label>Next of kin name</label><input name="guardian" placeholder="e.g. Meme N. Amwaama" /></div>
            <button className="btn primary" type="submit">Enrol student</button>
          </form>
        </Modal>
      )}

      {sel && <Student360 s={sel} onClose={() => setSel(null)} go={go} showToast={showToast} />}
      <Toast msg={toast} />
    </>
  )
}

function Student360({ s, onClose, go, showToast }) {
  const [sub, setSub] = useState(null) // 'docs' | 'edit' | 'apps'
  const invoices = INVOICES.filter((i) => i.learner === s.name)
  const marks = Object.entries(GRADEBOOKS).flatMap(([cls, rows]) =>
    rows.filter((r) => r.learner === s.name).map((r) => ({ cls, ...r }))
  )
  const loans = LOANS.filter((l) => l.borrower === s.name)
  const incidents = INCIDENTS.filter((i) => i.learner === s.name)
  const bal = invoices.reduce((sum, i) => sum + i.balance, 0)
  const hold = HOLDS.find((h) => h.student === s.name)

  return (
    <Modal title="Student 360°" onClose={onClose} width={640}>
      <div className="s360-head">
        <Avatar name={s.name} size={52} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{s.name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
            {s.id} · {s.grade} · Next of kin: {s.guardian} · {s.phone}
          </div>
        </div>
        <Badge tone={s.status === 'Sponsored' ? 'purple' : 'green'}>{s.status}</Badge>
      </div>

      {hold && (
        <div className="note-banner" style={{ background: 'var(--red-soft)', borderColor: '#eccfc9', color: 'var(--red)' }}>
          <span>🚫</span>
          <div style={{ color: 'var(--ink)' }}>
            <strong style={{ color: 'var(--red)' }}>{hold.type} hold since {hold.since}</strong> — {hold.reason}.{' '}
            {hold.impact.map((i) => <Badge key={i} tone="red">{i}</Badge>)}{' '}
            <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Auto-releases when the condition clears.</span>
          </div>
        </div>
      )}

      <div className="s360-grid">
        <div className="s360-sec">
          <div className="st">Account · Finance</div>
          {invoices.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>No invoices this term</div>
          ) : (
            invoices.map((i) => (
              <div key={i.id} className="cf-row" style={{ padding: '4px 0', fontSize: 12.5 }}>
                <span>{i.id} · due {i.due}</span>
                <span className="mono" style={{ color: i.balance > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
                  {i.balance > 0 ? fmtN(i.balance) + ' due' : 'Paid'}
                </span>
              </div>
            ))
          )}
          <div className="cf-row" style={{ paddingTop: 8, fontWeight: 700 }}>
            <span>Balance</span><span className="mono">{fmtN(bal)}</span>
          </div>
        </div>

        <div className="s360-sec">
          <div className="st">Academics · Term marks</div>
          {marks.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>Marks held by class lecturers</div>
          ) : (
            marks.map((m) => (
              <div key={m.cls} className="cf-row" style={{ padding: '4px 0', fontSize: 12.5 }}>
                <span>{m.cls} · Phys. Science</span>
                <span className="mono" style={{ fontWeight: 600, color: m.t3 < 50 ? 'var(--red)' : 'var(--ink)' }}>
                  {m.t1} → {m.t2} → {m.t3}
                </span>
              </div>
            ))
          )}
          <div className="cf-row" style={{ paddingTop: 8 }}>
            <span>Attendance</span>
            <span className="mono" style={{ fontWeight: 700, color: s.attendance < 85 ? 'var(--red)' : 'var(--green)' }}>
              {s.attendance}%
            </span>
          </div>
        </div>

        <div className="s360-sec">
          <div className="st">Library</div>
          {loans.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>No books out</div>
          ) : (
            loans.map((l) => (
              <div key={l.id} className="cf-row" style={{ padding: '4px 0', fontSize: 12.5 }}>
                <span>{l.book}</span>
                <Badge tone={l.status === 'Overdue' ? 'red' : 'blue'}>{l.status}</Badge>
              </div>
            ))
          )}
        </div>

        <div className="s360-sec">
          <div className="st">Transcript · GPA</div>
          {marks.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>Published by the exam board</div>
          ) : (
            <>
              {marks.map((m) => {
                const g = gradeOf(m.t3)
                return (
                  <div key={m.cls} className="cf-row" style={{ padding: '4px 0', fontSize: 12.5 }}>
                    <span>{m.cls} · Phys. Science</span>
                    <span className="mono" style={{ fontWeight: 600, color: g.letter === 'F' ? 'var(--red)' : 'var(--ink)' }}>
                      {g.letter} · {g.gpa.toFixed(1)}
                    </span>
                  </div>
                )
              })}
              <div className="cf-row" style={{ paddingTop: 8, fontWeight: 700 }}>
                <span>Cumulative GPA</span>
                <span className="mono">
                  {(marks.reduce((s, m) => s + gradeOf(m.t3).gpa, 0) / marks.length).toFixed(2)} / 4.00
                </span>
              </div>
            </>
          )}
        </div>

        <div className="s360-sec">
          <div className="st">Incidents & contact log</div>
          {incidents.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>Clean record</div>
          ) : (
            incidents.map((i, idx) => (
              <div key={idx} style={{ fontSize: 12.5, padding: '4px 0' }}>
                <strong>{i.date}</strong> — {i.type} → {i.action} <span style={{ color: 'var(--ink-faint)' }}>({i.by})</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ margin: '8px 0 4px', fontSize: 11.5, fontWeight: 700, letterSpacing: '.04em', color: 'var(--ink-soft)', paddingTop: 14, borderTop: '1px solid var(--line)' }}>
        ADMIN ACTIONS
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button className="btn ghost sm" onClick={() => setSub('edit')}>Update profile</button>
        <button className="btn ghost sm" onClick={() => setSub('docs')}>Documents</button>
        <button className="btn ghost sm" onClick={() => setSub('apps')}>Applications</button>
        <button className="btn ghost sm" onClick={() => showToast(`Password reset link emailed to ${s.name}`)}>Reset password</button>
        <button className="btn ghost sm" onClick={() => showToast(`Impersonating ${s.name} — opening their student portal (audit logged)`)}>Log in as</button>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn primary sm" onClick={() => { onClose(); go && go('finance') }}>Record payment</button>
        <button className="btn ghost sm" onClick={() => showToast(`Statement for ${s.name} sent to ${s.guardian}`)}>Send statement</button>
        <button className="btn ghost sm" onClick={() => showToast(`Incident logged on ${s.name}'s file — HOD notified`)}>Log incident</button>
      </div>

      {sub === 'docs' && <DocumentsModal s={s} hold={hold} onClose={() => setSub(null)} showToast={showToast} />}
      {sub === 'edit' && <EditProfileModal s={s} onClose={() => setSub(null)} showToast={showToast} />}
      {sub === 'apps' && (
        <Modal title={`Applications — ${s.name}`} onClose={() => setSub(null)} width={460}>
          <div className="cf-row"><span>Programme applied</span><span style={{ fontWeight: 600 }}>{s.grade}</span></div>
          <div className="cf-row"><span>Application status</span><Badge tone="green">Enrolled</Badge></div>
          <div className="cf-row"><span>Application fee (N$200)</span><Badge tone="green">Paid</Badge></div>
          <div className="cf-row"><span>Registration fee</span><Badge tone="green">Paid</Badge></div>
          <div className="di-sub" style={{ marginTop: 12 }}>Full application history and uploaded documents open in the Admissions module.</div>
        </Modal>
      )}
    </Modal>
  )
}

function EditProfileModal({ s, onClose, showToast }) {
  const save = (e) => { e.preventDefault(); onClose(); showToast(`${s.name}'s profile updated`) }
  return (
    <Modal title={`Update profile — ${s.name}`} onClose={onClose} width={440}>
      <form onSubmit={save}>
        <div className="field"><label>Full name</label><input name="name" defaultValue={s.name} required /></div>
        <div className="grid2" style={{ gap: 12 }}>
          <div className="field"><label>Programme / year</label><input name="grade" defaultValue={s.grade} /></div>
          <div className="field"><label>Next of kin phone</label><input name="phone" defaultValue={s.phone} /></div>
        </div>
        <div className="field"><label>Next of kin</label><input name="guardian" defaultValue={s.guardian} /></div>
        <button className="btn primary" type="submit">Save changes</button>
      </form>
    </Modal>
  )
}

function DocumentsModal({ s, hold, onClose, showToast }) {
  const attOk = (s.attendance ?? 0) >= ATTENDANCE_MIN

  const bodyFor = (key) => {
    switch (key) {
      case 'proof_of_registration':
        return `<p>This confirms that <b>${s.name}</b> is a registered student at Symanek Specialized College for the ${s.grade} programme in the 2026 academic year.</p>`
      case 'exam_permit':
        return `<p>This examination permit admits <b>${s.name}</b> (${s.id}) to the November 2026 final examinations.</p><table><tr><th>Attendance</th><td>${s.attendance ?? 0}% (minimum ${ATTENDANCE_MIN}%)</td></tr><tr><th>Programme</th><td>${s.grade}</td></tr></table>`
      case 'academic_record':
        return `<p>Academic record for <b>${s.name}</b>. Final marks are computed as 60% continuous assessment + 40% examination.</p>`
      case 'statement_of_results':
        return `<p>Statement of results for <b>${s.name}</b>, issued by the examinations office. Pass mark 50%; second opportunity 45–49%.</p>`
      case 'admission_letter':
        return `<p>Dear ${s.name},</p><p>We are pleased to offer you admission to the <b>${s.grade}</b> programme at Symanek Specialized College. Application fee N$200 and registration fee N$500 apply.</p>`
      case 'rejection_letter':
        return `<p>Dear ${s.name},</p><p>Thank you for your application to Symanek Specialized College. Regrettably, your application for the ${s.grade} programme was not successful for this intake.</p>`
      default:
        return `<p>Official document for ${s.name}.</p>`
    }
  }

  const generate = (d) => {
    if (d.needsClearance && hold) return showToast(`Blocked — ${hold.type} hold must be cleared before issuing ${d.label}`)
    if (d.needsAttendance && !attOk) return showToast(`${d.label} denied — attendance ${s.attendance ?? 0}% is below the ${ATTENDANCE_MIN}% minimum`)
    printStudentDoc(s, d.label, bodyFor(d.key))
    showToast(`${d.label} generated for ${s.name}`)
  }

  return (
    <Modal title={`Documents — ${s.name}`} onClose={onClose} width={460}>
      <p className="di-sub" style={{ marginBottom: 10 }}>
        Generate official documents. The examination permit requires ≥{ATTENDANCE_MIN}% attendance; clearance
        documents require no active holds.
      </p>
      <div style={{ display: 'grid', gap: 8 }}>
        {STUDENT_DOCUMENTS.map((d) => {
          const blocked = (d.needsClearance && hold) || (d.needsAttendance && !attOk)
          return (
            <button key={d.key} className="btn ghost" style={{ justifyContent: 'space-between', opacity: blocked ? 0.55 : 1 }} onClick={() => generate(d)}>
              <span>⬇ {d.label}</span>
              {blocked ? <Badge tone="red">Blocked</Badge> : <Badge tone="green">Ready</Badge>}
            </button>
          )
        })}
      </div>
    </Modal>
  )
}
