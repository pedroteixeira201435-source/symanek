// Printable student documents: proof of registration, academic record and
// examination permit. The data (and the rules: holds, 80% attendance, CA marks,
// balance) come from the student_document / exam_permits RPCs (20261113120000,
// 20261117120000); this file only lays them out on an A4 letterhead and opens
// the browser's print dialog, where the user can also "Save as PDF".
//
// The college stamps and signs each printout by hand at school, so there is NO
// stamp image here — only an empty box for it. Letterhead: address on the left,
// logo (public/logo.png) on the right.
import { getStudentDocument, getExamPermits, getCourseSheet } from '../api.js'
import { fmtN } from './format.js'

export const DOC_TITLES = {
  proof_of_registration: 'Proof of Registration',
  academic_record: 'Academic Record',
  exam_permit: 'Examination Permit',
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const day = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Windhoek' }) : '')
const examDay = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Windhoek' }) : 'TBA')
const examTime = (d) => (d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Windhoek' }) : 'TBA')
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '')
const semLabel = (n) => (n == null ? 'Year-long' : `Semester ${n}`)

const CSS = `
  @page { size: A4; margin: 12mm 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font: 11pt/1.45 "Segoe UI", Arial, sans-serif; color: #1d2a33; margin: 0; }
  @media screen { body { max-width: 210mm; margin: 0 auto; padding: 16mm; } }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .head { display: flex; justify-content: space-between; align-items: center; gap: 16px; border-bottom: 3px solid #2f4f63; padding-bottom: 8px; }
  .head h1 { font-size: 15pt; margin: 0 0 2px; color: #2f4f63; letter-spacing: .3px; }
  .head .sub { font-size: 8.5pt; color: #51636f; line-height: 1.4; }
  .head .logo { height: 30mm; width: auto; flex: none; }
  h2 { text-align: center; font-size: 13pt; letter-spacing: 2px; margin: 10px 0 2px; }
  .ref { text-align: center; font-size: 8.5pt; color: #51636f; margin-bottom: 8px; }
  .facts { width: 100%; border-collapse: collapse; margin: 4px 0 10px; }
  .facts td { padding: 2px 6px; vertical-align: top; }
  .facts td:nth-child(odd) { color: #51636f; width: 18%; white-space: nowrap; }
  .facts td:nth-child(even) { font-weight: 600; width: 32%; }
  table.data { width: 100%; border-collapse: collapse; margin: 6px 0 10px; font-size: 10pt; }
  table.data th { background: #e8eef2; text-align: left; padding: 6px; border: 1px solid #c9d4db; }
  table.data td { padding: 5px 6px; border: 1px solid #c9d4db; }
  table.data td.num, table.data th.num { text-align: right; }
  h3 { font-size: 11pt; margin: 14px 0 2px; color: #2f4f63; }
  .ok { color: #1c6b3a; font-weight: 700; }
  .no { color: #a12a2a; font-weight: 700; }
  .note { font-size: 9.5pt; color: #51636f; margin: 8px 0; }
  .alert { border: 2px solid #a12a2a; color: #a12a2a; padding: 6px 10px; font-weight: 600; margin: 6px 0; }
  .sign { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin-top: 10px; page-break-inside: avoid; }
  .sign .sig { flex: 1; max-width: 95mm; }
  .sign .sig .space { height: 10mm; }
  .sign .sig .line { border-top: 1px solid #1d2a33; padding-top: 3px; font-size: 9.5pt; }
  .sign .stampbox { width: 70mm; height: 18mm; }
  .period { text-align: center; font-weight: 700; margin: 2px 0 0; }
  .subtitle { text-align: center; font-weight: 700; font-size: 10pt; letter-spacing: 1px; margin: 4px 0 3px; }
  table.permit { font-size: 8pt; }
  table.permit th, table.permit td { padding: 2px 4px; line-height: 1.3; }
  table.permit .nw { white-space: nowrap; }
  table.permit small { color: #7a8a95; }
  .bal { color: #a12a2a; font-weight: 700; }
  .disclaimer { border: 1px solid #c9d4db; padding: 5px 10px; margin: 6px 0 0; font-size: 8pt; page-break-inside: avoid; }
  .disclaimer ul { margin: 2px 0 0; padding-left: 16px; line-height: 1.3; }
  .foot { margin-top: 10px; font-size: 8pt; color: #7a8a95; text-align: center; border-top: 1px solid #c9d4db; padding-top: 6px; }
`

function letterhead(c = {}, origin = '') {
  const logo = /^https?:/.test(c.logo_path || '') ? c.logo_path : `${origin}/logo.png`
  const lines = [
    [c.address, c.po_box].filter(Boolean).join(' · '),
    [c.phone && 'Tel ' + c.phone, c.cell && 'Cell ' + c.cell].filter(Boolean).join(' · '),
    [c.email, c.website].filter(Boolean).join(' · '),
    c.reg_no && 'Reg. ' + c.reg_no,
  ].filter(Boolean)
  return `<div class="head">
    <div><h1>${esc(c.name || 'Symanek Specialized College')}</h1>${lines.map((l) => `<div class="sub">${esc(l)}</div>`).join('')}</div>
    <img class="logo" src="${esc(logo)}" alt="Symanek Specialized College" onerror="this.style.display='none'">
  </div>`
}

function studentFacts(s = {}) {
  return `<table class="facts">
    <tr><td>Student</td><td>${esc(s.full_name)}</td><td>Student no.</td><td>${esc(s.student_no || '—')}</td></tr>
    <tr><td>Programme</td><td>${esc(s.programme || '—')}${s.nqf ? ` (${/nqf/i.test(s.nqf) ? esc(s.nqf) : 'NQF ' + esc(s.nqf)})` : ''}</td><td>ID / passport</td><td>${esc(s.id_number || '—')}</td></tr>
    <tr><td>Year of study</td><td>${s.year >= 1 && s.year <= 10 ? esc(s.year) : '—'}</td><td>Intake</td><td>${esc(cap(s.intake) || '—')}${s.academic_year ? ' ' + esc(s.academic_year) : ''}</td></tr>
  </table>`
}

// No stamp image: the college stamps and signs the printout by hand at school.
function signature(d) {
  const sig = d.signatory || { name: 'Office of the Registrar', title: '' }
  return `<div class="sign">
    <div class="sig"><div class="space"></div><div class="line">Signature<br><strong>${esc(sig.name)}</strong>${sig.title ? '<br>' + esc(sig.title) : ''}</div></div>
    <div class="stampbox"></div>
  </div>`
}

function footer(d) {
  return `<div class="foot">Generated by the Symanek Suite · Ref ${esc(ref(d))} · Queries: ${esc(d.college?.email || '')}</div>`
}

const ref = (d) => {
  const code = { proof_of_registration: 'POR', academic_record: 'AR', exam_permit: 'EP' }[d.type] || 'DOC'
  return `${code}-${d.student?.student_no || ''}-${String(d.issued_at || '').slice(0, 10).replace(/-/g, '')}`
}

function proofBody(d) {
  const s = d.student || {}; const p = d.period || {}
  const mods = d.modules || []
  const credits = mods.reduce((t, m) => t + (Number(m.credits) || 0), 0)
  return `${studentFacts(s)}
    <p>This is to confirm that <strong>${esc(s.full_name)}</strong> (student no. ${esc(s.student_no || '—')}) is a registered student of
    ${esc(d.college?.name || 'Symanek Specialized College')} for the <strong>${esc(p.academic_year || s.academic_year || '')}</strong> academic year
    (${esc(semLabel(p.semester_no))}${p.intake ? ', ' + esc(cap(p.intake)) + ' intake' : ''}), in the programme
    <strong>${esc(s.programme || '—')}</strong>.</p>
    ${mods.length ? `<table class="data"><thead><tr><th>Code</th><th>Module</th><th>Period</th><th class="num">Credits</th></tr></thead><tbody>
      ${mods.map((m) => `<tr><td>${esc(m.code)}</td><td>${esc(m.title)}</td><td>${esc(m.semester || semLabel(m.semester_no))}</td><td class="num">${esc(m.credits ?? '')}</td></tr>`).join('')}
      <tr><td colspan="3"><strong>Total credits</strong></td><td class="num"><strong>${credits}</strong></td></tr></tbody></table>`
      : '<p class="alert">No modules are registered for the current period.</p>'}
    <p class="note">Student status: ${esc(cap(s.status) || '—')}. This letter is issued at the student's request for whatever purpose it may serve.</p>`
}

function recordBody(d) {
  const rs = d.results || []
  const groups = []
  for (const r of rs) {
    const k = `${r.academic_year ?? ''}|${r.semester_no ?? ''}`
    let g = groups.find((x) => x.k === k)
    if (!g) groups.push((g = { k, year: r.academic_year, sem: r.semester_no, rows: [] }))
    g.rows.push(r)
  }
  return `${studentFacts(d.student)}
    ${groups.length ? groups.map((g) => `<h3>${esc(g.year || '')} · ${esc(semLabel(g.sem))}</h3>
      <table class="data"><thead><tr><th>Code</th><th>Module</th><th class="num">Credits</th><th class="num">Final %</th><th>Grade</th><th>Outcome</th></tr></thead><tbody>
      ${g.rows.map((r) => `<tr><td>${esc(r.code)}</td><td>${esc(r.title)}</td><td class="num">${esc(r.credits ?? '')}</td><td class="num">${r.final == null ? '' : esc(Number(r.final).toFixed(1))}</td><td>${esc(r.grade || '')}</td><td>${esc(cap(r.outcome) || (Number(r.final) >= 50 ? 'Pass' : 'Fail'))}</td></tr>`).join('')}
      </tbody></table>`).join('')
      : '<p class="alert">No results have been published for this student yet.</p>'}
    <table class="facts"><tr><td>Cumulative GPA</td><td>${esc(Number(d.gpa ?? 0).toFixed(2))}</td><td>Credits earned</td><td>${esc(d.credits_earned ?? 0)}</td></tr></table>
    <p class="note">Only results published by the Examinations Board are shown. Final mark = 60% continuous assessment + 40% examination.</p>`
}

const DISCLAIMER = [
  'This permit must be presented at the exam venue.',
  'Students must arrive 30 minutes before the scheduled exam time.',
  'Valid student ID must be presented along with this permit.',
  'This permit is valid only for the specified modules and dates.',
  'Any outstanding balance must be settled before the examination period.',
  'The institution reserves the right to deny exam entry if requirements are not met.',
]
const mark = (v) => (v == null ? '—' : Number(v).toFixed(2))

// Layout follows the college's own permit template (EduCIMS): student block,
// study period, registered modules & exam details, balance notice, disclaimer.
function permitBody(d) {
  const s = d.student || {}; const p = d.period || {}
  const ss = d.sittings || []
  const bal = d.balance == null ? null : Number(d.balance)
  const qual = s.programme ? `${s.programme}${s.nqf ? ` (${/nqf/i.test(s.nqf) ? s.nqf : 'NQF ' + s.nqf})` : ''}` : '—'
  return `<table class="facts">
      <tr><td>Student name</td><td>${esc(s.full_name)}</td><td>Student number</td><td>${esc(s.student_no || '—')}</td></tr>
      <tr><td>ID number</td><td>${esc(s.id_number || '—')}</td><td>Student year</td><td>${s.year >= 1 && s.year <= 10 ? 'Year ' + esc(s.year) : '—'}</td></tr>
      <tr><td>Qualification</td><td colspan="3">${esc(qual)}</td></tr>
      <tr><td>Intake</td><td>${esc(cap(s.intake) || '—')}${s.academic_year ? ' ' + esc(s.academic_year) : ''}</td><td>Campus</td><td>${esc(s.campus || '—')}</td></tr>
      <tr><td>Date of issue</td><td>${esc(day(d.issued_at))}</td><td>Outstanding balance</td><td class="${bal > 0 ? 'bal' : ''}">${bal == null ? '—' : esc(fmtN(bal))}</td></tr>
    </table>
    <div class="period">Study period(s): ${esc(semLabel(p.semester_no))}${p.academic_year ? ' · ' + esc(p.academic_year) : ''}</div>
    <div class="subtitle">REGISTERED MODULES &amp; EXAM DETAILS</div>
    ${d.hold ? '<p class="alert">A hold on this account blocks examination admission. Please contact the college before the examinations.</p>' : ''}
    ${ss.length ? `<table class="data permit"><thead><tr><th>Module</th><th class="num nw">CA mark</th><th class="num nw">Attendance</th><th>Qualified</th><th class="nw">Exam type</th><th class="nw">Exam date</th><th>Time</th><th>Venue</th></tr></thead><tbody>
      ${ss.map((x) => `<tr><td><strong>${esc(x.title)}</strong><br><small>${esc(x.code)}</small></td>
        <td class="num nw">${mark(x.ca)}</td>
        <td class="num nw">${x.attendance == null ? '—' : esc(Number(x.attendance).toFixed(0)) + '%'}</td>
        <td>${x.admitted ? '<span class="ok">Qualified</span>' : `<span class="no nw">Not qualified</span><br><small>${esc(x.reason || '')}</small>`}</td>
        <td>Final</td><td class="nw">${esc(examDay(x.at))}</td><td class="nw">${esc(examTime(x.at))}</td><td>${esc(x.venue || 'TBA')}</td></tr>`).join('')}
      </tbody></table>`
      : '<p class="alert">No examinations are scheduled for this student\'s current modules.</p>'}
    ${bal > 0 ? `<p class="alert"><strong>OUTSTANDING BALANCE NOTICE:</strong> This student has an outstanding balance of ${esc(fmtN(bal))}. Please settle it with the Finance Office before the examination period.</p>` : ''}
    <div class="disclaimer"><strong>IMPORTANT DISCLAIMER:</strong><ul>${DISCLAIMER.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>`
}

const BODY = { proof_of_registration: proofBody, academic_record: recordBody, exam_permit: permitBody }

function page(d, origin) {
  return `<section class="page">${letterhead(d.college, origin)}
    <h2>${esc(DOC_TITLES[d.type].toUpperCase())}</h2><div class="ref">Ref ${esc(ref(d))}${d.type === 'exam_permit' ? '' : ' · Issued ' + esc(day(d.issued_at))}</div>
    ${BODY[d.type](d)}${signature(d)}${footer(d)}</section>`
}

// The full printable page for one document's data, without printing it.
export const documentHtml = (d, origin = window.location.origin) => html(DOC_TITLES[d.type] || 'Document', [page(d, origin)], false)

function html(title, pages, autoPrint = true) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head>
    <body>${pages.join('')}${autoPrint ? '<script>window.onload=function(){setTimeout(function(){window.focus();window.print()},300)}</script>' : ''}</body></html>`
}

// Opens the window synchronously (inside the click, so it is not blocked as a
// popup), then fills it once the data has arrived.
function printWindow(title) {
  const w = window.open('', '_blank')
  if (w) w.document.write(`<!doctype html><title>${esc(title)}</title><p style="font:14px Arial;padding:24px">Preparing ${esc(title)}…</p>`)
  return w
}
function fill(w, title, pages) {
  if (!w) throw new Error('Allow pop-ups for this site to print documents')
  w.document.open(); w.document.write(html(title, pages)); w.document.close()
}

export async function printStudentDocument(type, studentId = null) {
  const title = DOC_TITLES[type] || 'Document'
  const w = printWindow(title)
  try {
    const d = await getStudentDocument(type, studentId)
    if (!d) throw new Error('Documents are only available with the live backend')
    fill(w, `${title} — ${d.student?.full_name || ''}`, [page(d, window.location.origin)])
  } catch (e) { if (w) w.close(); throw e }
}

// Every examination permit (registrar), one per page; `only` filters by student id.
export async function printExamPermits(only = null) {
  const w = printWindow('Examination permits')
  try {
    const d = await getExamPermits()
    const list = (d?.permits || []).filter((p) => !only || only.includes(p.student?.id))
    if (!list.length) throw new Error('No examination permits to print')
    const pages = list.map((p) => page({ ...p, type: 'exam_permit', college: d.college, signatory: d.signatory, issued_at: d.issued_at }, window.location.origin))
    fill(w, 'Examination permits', pages)
  } catch (e) { if (w) w.close(); throw e }
}

// ---------------------------------------------------------------------------
// Lecturer sheets (20261120120000): the CA sheet (every assessment per student
// with the CA %) and the attendance register (every recorded session per
// student), one module each, landscape A4, for filing. Wide tables are split
// over several pages (the student columns repeat) so nothing gets tiny.
// ---------------------------------------------------------------------------
const SHEET_CSS = `
  @page { size: A4 landscape; margin: 7mm 12mm 7mm; }
  .head .logo { height: 30mm; }
  .head { padding-bottom: 5px; }
  h2 { margin: 4px 0 1px; font-size: 12pt; }
  table.sheet { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 8.5pt; table-layout: auto; }
  table.sheet th, table.sheet td { border: 1px solid #9fb0bb; padding: 1.5px 4px; line-height: 1.15; }
  table.sheet th { background: #e8eef2; font-weight: 700; text-align: center; }
  table.sheet td.c { text-align: center; }
  table.sheet td.n, table.sheet th.n { text-align: left; white-space: nowrap; }
  table.sheet th small { display: block; font-weight: 400; color: #51636f; }
  table.sheet tr { page-break-inside: avoid; }
  .ab { color: #a12a2a; font-weight: 700; }
  .lowp { color: #a12a2a; font-weight: 700; }
  .meta { width: 100%; border-collapse: collapse; margin: 2px 0 4px; font-size: 9pt; }
  .meta td { padding: 1px 6px; vertical-align: top; }
  .meta td:nth-child(odd) { color: #51636f; width: 12%; white-space: nowrap; }
  .meta td:nth-child(even) { font-weight: 600; width: 38%; }
  .note { margin: 3px 0; font-size: 8.5pt; }
  .sign { margin-top: 2px; }
  .sign .sig .space { height: 6mm; }
  .foot { margin-top: 4px; padding-top: 3px; }
`

const shortDate = (d) => { const [y, m, dd] = String(d).slice(0, 10).split('-'); return `${dd}/${m}` + (y ? `<small>${y}</small>` : '') }
const pct = (v) => (v == null ? '—' : `${Number(v).toFixed(0)}%`)
const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out.length ? out : [[]] }

function sheetHead(d, title, origin) {
  const c = d.course || {}
  return `${letterhead(d.college, origin)}
    <h2>${esc(title.toUpperCase())}</h2>
    <table class="meta">
      <tr><td>Module</td><td>${esc(c.code)} — ${esc(c.title)}</td><td>Lecturer</td><td>${esc(c.lecturer || '—')}</td></tr>
      <tr><td>Programme</td><td>${esc(c.programme || '—')}</td><td>Period</td><td>${esc(c.semester || '')}${c.academic_year ? ' · ' + esc(c.academic_year) : ''}</td></tr>
    </table>`
}

function sheetSign(d) {
  return `<div class="sign">
    <div class="sig" style="max-width:90mm"><div class="space"></div><div class="line">Lecturer signature<br><strong>${esc(d.course?.lecturer || '')}</strong></div></div>
  </div>
  <div class="foot">Generated by the Symanek Suite · ${esc(day(d.issued_at))} · ${esc(d.course?.code || '')}</div>`
}

function caSheetPages(d, origin) {
  const as = d.assessments || []; const ss = d.ca_students || []
  const groups = chunk(as, 9)
  return groups.map((g, gi) => `<section class="page">${sheetHead(d, 'Continuous Assessment Sheet', origin)}
    ${groups.length > 1 ? `<div class="note">Assessments ${gi * 9 + 1}–${gi * 9 + g.length} of ${as.length} — the CA % on every page covers all assessments.</div>` : ''}
    ${ss.length ? `<table class="sheet"><thead><tr><th>#</th><th class="n">Student</th><th class="n">Student no.</th>
      ${g.map((a) => `<th>${esc(a.title)}<small>${esc(cap(a.kind || ''))} · /${esc(a.max)}${a.date ? ' · ' + esc(String(a.date).slice(0, 10)) : ''}</small></th>`).join('')}
      <th>CA %</th></tr></thead><tbody>
      ${ss.map((s, i) => `<tr><td class="c">${i + 1}</td><td class="n"><strong>${esc(s.name)}</strong></td><td class="n">${esc(s.student_no || '')}</td>
        ${g.map((a) => `<td class="c">${s.marks?.[a.id] == null ? '—' : esc(s.marks[a.id])}</td>`).join('')}
        <td class="c"><strong>${s.ca == null ? '—' : esc(Number(s.ca).toFixed(1)) + '%'}</strong></td></tr>`).join('')}
      </tbody></table>`
      : '<p class="alert">No students are enrolled on this module.</p>'}
    ${!as.length ? '<p class="alert">No assessments have been recorded for this module yet.</p>' : ''}
    <p class="note">CA % = weighted average of the recorded assessments and graded assignments (a missing mark counts as 0). Exam permit requires CA ≥ 50%.</p>
    ${gi === groups.length - 1 ? sheetSign(d) : ''}</section>`)
}

function registerPages(d, origin) {
  const ses = d.sessions || []; const st = d.attendance || []
  const groups = chunk(ses, 22)
  return groups.map((g, gi) => `<section class="page">${sheetHead(d, 'Attendance Register', origin)}
    ${groups.length > 1 ? `<div class="note">Sessions ${gi * 22 + 1}–${gi * 22 + g.length} of ${ses.length} — the attendance % on every page covers all sessions.</div>` : ''}
    ${st.length ? `<table class="sheet"><thead><tr><th>#</th><th class="n">Student</th><th class="n">Student no.</th>
      ${g.map((x) => `<th>${shortDate(x.date)}</th>`).join('')}<th>Att. %</th></tr></thead><tbody>
      ${st.map((s, i) => `<tr><td class="c">${i + 1}</td><td class="n"><strong>${esc(s.name)}</strong></td><td class="n">${esc(s.student_no || '')}</td>
        ${g.map((x) => { const v = s.present?.[String(x.date).slice(0, 10)]; return `<td class="c">${v === true ? 'P' : v === false ? '<span class="ab">A</span>' : ''}</td>` }).join('')}
        <td class="c ${ses.length && Number(s.percent) < 80 ? 'lowp' : ''}"><strong>${ses.length ? pct(s.percent) : '—'}</strong></td></tr>`).join('')}
      </tbody></table>`
      : '<p class="alert">No students are enrolled on this module.</p>'}
    ${!ses.length ? '<p class="alert">No attendance session has been recorded for this module yet.</p>' : ''}
    <p class="note">P = present · A = absent · blank = no entry that day. Attendance % is weighted by contact hours; 80% is required for exam admission.</p>
    ${gi === groups.length - 1 ? sheetSign(d) : ''}</section>`)
}

export const courseSheetHtml = (d, kind, origin = window.location.origin) =>
  html(kind === 'attendance' ? 'Attendance register' : 'CA sheet', (kind === 'attendance' ? registerPages : caSheetPages)(d, origin), false).replace('</style>', SHEET_CSS + '</style>')

// kind: 'ca' | 'attendance'. Prints one module's sheet (Save as PDF in the dialog).
export async function printCourseSheet(courseId, kind) {
  const title = kind === 'attendance' ? 'Attendance register' : 'CA sheet'
  const w = printWindow(title)
  try {
    const d = await getCourseSheet(courseId)
    if (!d) throw new Error('Sheets are only available with the live backend')
    if (!w) throw new Error('Allow pop-ups for this site to print documents')
    w.document.open(); w.document.write(courseSheetHtml(d, kind).replace('</body>', '<script>window.onload=function(){setTimeout(function(){window.focus();window.print()},300)}</script></body>')); w.document.close()
  } catch (e) { if (w) w.close(); throw e }
}
