// ---------------------------------------------------------------------------
// Data-access layer — the "seam" between the UI and the future backend.
//
// Every screen should read/write through THESE functions, never by importing
// data.js directly. Today (API_MODE='mock') they resolve the in-memory mock
// after a tiny delay, so the whole UI already speaks async/Promise. In Phase 2,
// flip API_MODE to 'http' and replace each body with a fetch() — no component
// has to change. See BACKEND.md for the schema and the endpoint contracts.
//
// NOTE: mock reads still join students by NAME (data.js legacy). The backend
// must join by student_id (FK). Signatures below already take ids where the
// backend will need them; the mock falls back to name where the seed lacks ids.
// ---------------------------------------------------------------------------
import { API_MODE, API_BASE, TENANT } from './config.js'
import * as db from './data.js'
import { supabase } from './supabaseClient.js'

const clone = (d) => (typeof structuredClone === 'function' ? structuredClone(d) : JSON.parse(JSON.stringify(d)))
const delay = (ms = 100) => new Promise((r) => setTimeout(r, ms))

// mock resolver — swap this branch's callers for real fetch() in Phase 2
async function mock(data) { await delay(); return clone(data) }

// Phase-2 backend path (Supabase). Active when API_MODE='http' and the client is
// configured. Env is read here too so Node tests can flip it without Vite.
const httpMode = () =>
  API_MODE === 'http' || (typeof process !== 'undefined' && process.env && process.env.VITE_API_MODE === 'http')
const useHttp = () => httpMode() && supabase !== null

// name → student uuid (the FK the backend joins by; kills the name-join debt)
async function studentIdByName(name) {
  const { data } = await supabase.from('students').select('id').eq('full_name', name).maybeSingle()
  return data?.id ?? null
}

// Phase-2 helper (unused while API_MODE==='mock'); kept so the http path is obvious.
async function http(path, opts) {
  const res = await fetch(`${API_BASE}/${TENANT}/${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}
// eslint-disable-next-line no-unused-vars
const _phase2 = http // referenced so bundlers keep it; delete when wiring real endpoints

// ============================ READS ============================
// Map a students row (+programme join) back to the LEARNER shape the modules use.
function toLearner(s) {
  const code = s.programmes?.slug ? s.programmes.slug.toUpperCase() : ''
  const grade = [code, s.year ? `Y${s.year}` : ''].filter(Boolean).join(' ')
  return {
    id: s.student_no || s.reference || s.id,
    _uuid: s.id,
    name: s.full_name,
    grade: grade || (s.programmes?.name ?? '—'),
    guardian: s.next_of_kin || '—',
    phone: s.phone || '—',
    status: s.status ? s.status[0].toUpperCase() + s.status.slice(1) : 'Admitted',
    attendance: s.attendance != null ? Number(s.attendance) : null,
    intake: s.intake || null,
  }
}
export async function listStudents() {
  if (useHttp()) {
    const { data, error } = await supabase.from('students')
      .select('id,student_no,reference,full_name,next_of_kin,phone,status,attendance,year,intake,programmes(slug,name)')
    if (error) throw error
    return (data ?? []).map(toLearner)
  }
  return mock(db.LEARNERS)
}
export async function getStudent(id) {
  if (useHttp()) {
    const { data, error } = await supabase.from('students')
      .select('id,student_no,reference,full_name,next_of_kin,phone,status,attendance,year,intake,programmes(slug,name)')
      .or(`student_no.eq.${id},reference.eq.${id}`).maybeSingle()
    if (error) throw error
    return data ? toLearner(data) : null
  }
  return mock(db.LEARNERS.find((s) => s.id === id) || null)
}

export async function listProgrammes() {
  if (useHttp()) {
    const { data, error } = await supabase.from('programmes')
      .select('slug,name,nqf,years,coordinator,enrolled,accreditation').eq('category', 'suite-demo')
    if (error) throw error
    return (data ?? []).map((p) => ({
      code: p.slug.toUpperCase(), name: p.name, nqf: p.nqf, years: p.years,
      coordinator: p.coordinator, enrolled: p.enrolled, accreditation: p.accreditation,
    }))
  }
  return mock(db.PROGRAMMES)
}

export async function listCourses(progCode) {
  if (useHttp()) {
    const join = progCode ? 'programmes!inner(slug)' : 'programmes(slug)'
    let q = supabase.from('courses')
      .select(`id,code,title,credits,semester,capacity,enrolled,prereq_code,${join},staff(name)`)
    if (progCode) q = q.eq('programmes.slug', progCode.toLowerCase())
    const { data, error } = await q
    if (error) throw error
    return (data ?? [])
      .map((c) => ({
        id: c.id, code: c.code, title: c.title, prog: c.programmes?.slug?.toUpperCase(), credits: c.credits,
        sem: c.semester, lecturer: c.staff?.name, enrolled: c.enrolled, cap: c.capacity, prereq: c.prereq_code,
      }))
  }
  return mock(progCode ? db.COURSES.filter((c) => c.prog === progCode) : db.COURSES)
}

export async function getDegreeAudit(studentName) {
  if (useHttp()) {
    const sid = await studentIdByName(studentName)
    if (!sid) return null
    const { data, error } = await supabase.rpc('degree_audit', { p_student: sid })
    if (error) throw error
    return data // { prog, catalog, gpa, reqs: [...] }
  }
  return mock(db.DEGREE_AUDIT[studentName] || null)
}

// Reads wired to the backend (mapped back to the mock-compatible shapes the
// modules already consume). Others follow the same pattern in later B2 passes.
export async function getInvoicesForStudent(studentName) {
  if (useHttp()) {
    const sid = await studentIdByName(studentName)
    if (!sid) return []
    const { data, error } = await supabase.from('invoices')
      .select('id,amount,balance,due,status,invoice_payments(status)').eq('student_id', sid)
    if (error) throw error
    return (data ?? []).map((i) => ({
      id: i.id, learner: studentName, amount: Number(i.amount), balance: Number(i.balance),
      due: i.due, status: i.status[0].toUpperCase() + i.status.slice(1),
      proofPending: (i.invoice_payments ?? []).some((p) => p.status === 'pending'),
    }))
  }
  return mock(db.INVOICES.filter((i) => i.learner === studentName))
}

export async function getHoldsForStudent(studentName) {
  if (useHttp()) {
    const sid = await studentIdByName(studentName)
    if (!sid) return []
    const { data, error } = await supabase.from('holds')
      .select('type,reason,blocks,active,created_at').eq('student_id', sid).eq('active', true)
    if (error) throw error
    return (data ?? []).map((h) => ({
      student: studentName, type: h.type[0].toUpperCase() + h.type.slice(1), reason: h.reason,
      impact: (h.blocks ?? []).map((b) => 'Blocks ' + b), since: h.created_at,
    }))
  }
  return mock(db.HOLDS.filter((h) => h.student === studentName))
}

export async function getSponsorsForStudent(studentName) {
  if (useHttp()) {
    const sid = await studentIdByName(studentName)
    if (!sid) return []
    const { data, error } = await supabase.from('sponsor_claims')
      .select('id,coverage,billed,received,status,sponsors(name,type)').eq('student_id', sid)
    if (error) throw error
    return (data ?? []).map((c) => ({
      id: c.id, sponsor: c.sponsors?.name, type: c.sponsors?.type,
      coverage: Number(c.coverage), billed: Number(c.billed), received: Number(c.received), status: c.status,
    }))
  }
  return mock(db.SPONSORS.filter((s) => s.learners.includes(studentName)))
}

// Mutable results store (mock) so a lecturer's mark edits and publish flow reach
// the student's transcript this session. Seeded from data.js; http mode uses the
// Supabase `results` rows and ignores this store.
let _results = null
function results() {
  if (_results) return _results
  _results = {}
  for (const [code, rows] of Object.entries(db.COURSE_RESULTS)) {
    _results[code] = rows.map((r) => ({ ...r, exam2: r.exam2 ?? null, published: r.published ?? false }))
  }
  return _results
}
export async function getCourseResults(code) {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('course_marksheet', { p_course_code: code })
    if (error) throw error
    return (data ?? []).map((r) => ({
      learner: r.student, student_id: r.student_id,
      ca: Number(r.ca ?? 0), exam: Number(r.exam ?? 0),
      exam2: r.exam2 == null ? null : Number(r.exam2), published: r.published,
    }))
  }
  return mock(results()[code] || [])
}
export async function saveCourseMarks(code, rows) {
  if (useHttp()) {
    const p_marks = rows.map((r) => ({ student_id: r.student_id, ca: r.ca, exam: r.exam, exam2: r.exam2 ?? null }))
    const { data, error } = await supabase.rpc('save_course_marks', { p_course_code: code, p_marks })
    if (error) throw error
    return data
  }
  const cur = results()[code] || []
  rows.forEach((u) => {
    const r = cur.find((x) => x.learner === u.learner)
    if (r) { r.ca = u.ca; r.exam = u.exam; if ('exam2' in u) r.exam2 = u.exam2 }
  })
  return mock({ ok: true })
}
export async function publishCourseResults(code) {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('publish_course_results', { p_course_code: code })
    if (error) throw error
    return data
  }
  ;(results()[code] || []).forEach((r) => { r.published = true })
  return mock({ ok: true, code })
}

export async function getResultsForStudent(studentName) {
  if (useHttp()) {
    const sid = await studentIdByName(studentName)
    if (!sid) return []
    const { data, error } = await supabase.from('enrolments')
      .select('courses(code),results(ca,exam,final,grade,published)').eq('student_id', sid)
    if (error) throw error
    return (data ?? []).flatMap((e) => {
      const r = Array.isArray(e.results) ? e.results[0] : e.results
      if (!r) return []
      return [{ code: e.courses?.code, ca: Number(r.ca), exam: Number(r.exam), final: Number(r.final), grade: r.grade, published: r.published }]
    })
  }
  return mock(Object.entries(results()).flatMap(([code, rows]) =>
    rows.filter((r) => r.learner === studentName).map((r) => ({ code, ...r }))))
}

// Mock attendance store: name -> { attended, total } sessions, so a lecturer's
// register updates the student's % this session (drives the 80% permit rule).
let _attendance = {}
function seedAttendance(name) {
  if (_attendance[name]) return _attendance[name]
  const l = db.LEARNERS.find((x) => x.name === name)
  const pct = l?.attendance ?? 90
  const total = 25
  return (_attendance[name] = { attended: Math.round((pct / 100) * total), total })
}
const attendancePercentOf = (name) => {
  const a = _attendance[name] || seedAttendance(name)
  return Math.round((a.attended / a.total) * 100)
}
export async function getCourseAttendance(names, code) {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('course_attendance', { p_course_code: code })
    if (error) throw error
    return Object.fromEntries((data ?? []).map((r) => [r.student, Number(r.percent)]))
  }
  return mock(Object.fromEntries((names || []).map((n) => [n, attendancePercentOf(n)])))
}

// Class attendance for a student — feeds the 80% examination-admission rule.
export async function getAttendanceForStudent(studentName) {
  if (useHttp()) {
    const sid = await studentIdByName(studentName)
    if (!sid) return { percent: 0, hoursAttended: 0, hoursTotal: 0 }
    const { data } = await supabase.from('attendance_summary')
      .select('percent,hours_attended,hours_total').eq('student_id', sid).maybeSingle()
    return { percent: data?.percent ?? 0, hoursAttended: data?.hours_attended ?? 0, hoursTotal: data?.hours_total ?? 0 }
  }
  const percent = attendancePercentOf(studentName)
  const hoursTotal = 240 // demo: contact hours in the semester
  return mock({ percent, hoursAttended: Math.round((percent / 100) * hoursTotal), hoursTotal })
}

export async function listGraduands() {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('graduation_board')
    if (error) throw error
    return (data ?? []).map((g) => ({
      studentId: g.student_id, student: g.student, prog: g.programme, gpa: Number(g.gpa),
      finance: g.finance, library: g.library, academic: g.academic,
      cleared: g.cleared, hasCertificate: g.has_certificate,
    }))
  }
  return mock(db.GRADUANDS)
}
export async function listExamSchedule() {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('exam_schedule')
    if (error) throw error
    return (data ?? []).map((r) => {
      const d = r.at ? new Date(r.at) : null
      return {
        code: r.code, title: r.title,
        date: d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
        time: d ? d.toTimeString().slice(0, 5) : '',
        venue: r.venue, seats: r.seats, sat: r.sat, invigilator: r.invigilator,
      }
    })
  }
  return mock(db.EXAM_SCHEDULE)
}

// Exam board — per-course result aggregate + publication status. http computes
// from courses→enrolments→results; a course is 'Published' only when all its
// marks are locked, else 'Awaiting approval'.
export async function listExamBoard() {
  if (useHttp()) {
    const { data, error } = await supabase.from('courses')
      .select('id,code,title,staff(name),enrolments(results(final,published))')
    if (error) throw error
    return (data ?? []).map((c) => {
      const marks = (c.enrolments ?? []).flatMap((e) => e.results ?? [])
      if (marks.length === 0) return null
      const sat = marks.length
      const passRate = Math.round((marks.filter((m) => Number(m.final) >= 50).length / sat) * 100)
      const avg = Math.round(marks.reduce((s, m) => s + Number(m.final || 0), 0) / sat)
      const status = marks.every((m) => m.published) ? 'Published' : 'Awaiting approval'
      return { id: c.id, code: c.code, title: c.title, lecturer: c.staff?.name, sat, passRate, avg, status }
    }).filter(Boolean)
  }
  return mock(db.EXAM_BOARD)
}
const APP_STAGE_LABEL = {
  submitted: 'Applied', under_review: 'Under Review', approved: 'Approved',
  rejected: 'Rejected', paid: 'Paid', enrolled: 'Enrolled',
}
export async function listApplicants() {
  if (useHttp()) {
    const { data, error } = await supabase.from('applications')
      .select('id,reference,full_name,programme_slug,stage,created_at').order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((a) => ({
      id: a.reference || a.id, _uuid: a.id, name: a.full_name,
      prog: (a.programme_slug || '').toUpperCase(), points: 0,
      stage: APP_STAGE_LABEL[a.stage] || a.stage,
      applied: a.created_at ? new Date(a.created_at).toLocaleDateString('en-NA') : '',
      docs: {},
    }))
  }
  return mock(db.APPLICANTS)
}
export async function listResidences() {
  if (useHttp()) {
    const { data, error } = await supabase.from('residences')
      .select('name,capacity,allocations(id)')
    if (error) throw error
    return (data ?? []).map((r) => ({
      block: r.name, rooms: r.capacity, occupied: (r.allocations ?? []).length, fee: 0,
    }))
  }
  return mock(db.RESIDENCES)
}
export async function listNcheReturns() {
  if (useHttp()) {
    const { data, error } = await supabase.from('nche_returns')
      .select('title,period,due,status').order('due')
    if (error) throw error
    return (data ?? []).map((n) => ({ ret: n.title, period: n.period, due: n.due, status: n.status }))
  }
  return mock(db.NCHE_RETURNS)
}
export const getCourseware = (code) => mock(db.COURSEWARE[code] || null)

export async function listStaff() {
  if (useHttp()) {
    const { data, error } = await supabase.from('staff').select('staff_no,name,email,role,department')
    if (error) throw error
    return (data ?? []).map((s) => ({ id: s.staff_no, name: s.name, email: s.email, role: s.role, dept: s.department }))
  }
  return mock(db.STAFF)
}

// ============================ WRITES (stubs → backend) ============================
// Each returns the shape the backend will return; the mock just echoes success.
export async function registerCourse({ courseId, courseCode, studentId }) {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('register_course', { p_course_id: courseId })
    if (error) throw error
    return data // { ok, code, status, charge, message } — server-authoritative rules engine
  }
  return mock({ ok: true, studentId, courseCode, charge: (db.COURSES.find((c) => c.code === courseCode)?.credits || 0) * 1150, at: Date.now() })
}
export async function payInvoice({ invoiceId, amount, method, studentId }) {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('pay_invoice', { p_invoice_id: invoiceId, p_amount: amount, p_method: method || 'EFT' })
    if (error) throw error
    return data // { ok, paid, balance, total_open, holds_released, message }
  }
  return mock({ ok: true, ref: 'PAY-' + Date.now(), studentId, invoiceId, amount, method })
}

// Manual EFT (no gateway): student uploads a proof file + amount against an
// invoice; it sits PENDING until a staff member confirms it.
export async function submitInvoiceProof({ invoiceId, amount, file }) {
  if (useHttp()) {
    const { data: { user } } = await supabase.auth.getUser()
    const ext = ((file?.name || '').split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
    const path = `${user?.id || 'anon'}/${invoiceId}/${Date.now()}.${ext}`
    const up = await supabase.storage.from('payment-proofs').upload(path, file, { contentType: file?.type || 'application/octet-stream', upsert: true })
    if (up.error) throw up.error
    const { data, error } = await supabase.rpc('submit_invoice_proof', { p_invoice_id: invoiceId, p_amount: amount, p_path: path })
    if (error) throw error
    return data
  }
  await delay(); return { ok: true, code: 'submitted', message: 'Proof of payment submitted — the bursar will confirm it shortly (demo).' }
}

// Staff (bursar): review + confirm pending proofs.
export async function listPendingProofs() {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('pending_payment_proofs')
    if (error) throw error
    return (data ?? []).map((r) => ({
      paymentId: r.payment_id, student: r.student, invoiceId: r.invoice_id,
      amount: Number(r.amount), proofPath: r.proof_path, balance: Number(r.invoice_balance), submittedAt: r.submitted_at,
    }))
  }
  return mock([])
}

export async function confirmInvoicePayment(paymentId) {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('confirm_invoice_payment', { p_payment_id: paymentId })
    if (error) throw error
    return data
  }
  return mock({ ok: true, message: 'Payment confirmed (demo)' })
}

export async function proofUrl(path) {
  if (useHttp()) {
    const { data } = await supabase.storage.from('payment-proofs').createSignedUrl(path, 120)
    return data?.signedUrl ?? null
  }
  return '#'
}
export async function submitAssignment({ student, studentId, assignmentId }) {
  if (useHttp()) {
    const { data: a } = await supabase.from('assignments').select('id').eq('code', assignmentId).maybeSingle()
    if (!a) return { ok: false }
    const { error } = await supabase.rpc('submit_assignment', { p_assignment: a.id })
    if (error) throw error
    return { ok: true, assignmentId }
  }
  const list = _submissions[assignmentId] || (_submissions[assignmentId] = [])
  if (student && !list.some((s) => s.student === student)) {
    list.unshift({ id: 'sub-' + Date.now(), assignmentId, student, submittedAt: new Date().toISOString().slice(0, 10), grade: null, feedback: '', gradedBy: null })
  }
  return mock({ ok: true, student, studentId, assignmentId, at: Date.now() })
}
export const submitApplication = (payload) => mock({ ok: true, id: 'APP-' + Date.now(), ...payload, stage: 'Applied' })
export async function issueCertificate({ studentId }) {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('issue_certificate', { p_student_id: studentId })
    if (error) throw error
    return data // { ok, code, cert_no, clearance?, message }
  }
  return mock({ ok: true, studentId, certNo: 'CERT-' + Date.now() })
}

// Derived graduation clearance (finance/library/academic + gpa). http only.
export async function graduationClearance(studentId) {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('graduation_clearance', { p_student_id: studentId })
    if (error) throw error
    return data
  }
  return mock(null)
}
export const allocateRoom = ({ studentId, block }) => mock({ ok: true, studentId, block })
export const submitNcheReturn = ({ ret }) => mock({ ok: true, ret, submittedAt: Date.now() })
export async function publishExamResults({ courseId, courseCode }) {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('publish_exam_results', { p_course_id: courseId })
    if (error) throw error
    return data // { ok, course, published, message } — locks marks to the transcript
  }
  return mock({ ok: true, courseCode })
}
export const setInstitutionType = (type) => mock({ ok: true, type })

// True when the backend (Supabase) is active; lets modules pick persist+reload
// (http) vs optimistic in-memory updates (mock demo).
export const isHttpMode = () => useHttp()

// --- Class timetable (http-backed) ---
// Returns the TIMETABLES shape { class: { periodId: [Mon..Fri slot|null] } }.
export async function getTimetables() {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('timetable')
    if (error) throw error
    const periods = db.PERIODS.filter((p) => p.id !== 'BRK').map((p) => p.id)
    const out = {}
    for (const s of data ?? []) {
      if (!out[s.class_group]) { out[s.class_group] = {}; periods.forEach((pid) => { out[s.class_group][pid] = [null, null, null, null, null] }) }
      const arr = out[s.class_group][s.period_id]
      if (arr) arr[s.day_of_week - 1] = { s: s.subject, r: s.venue || '' }
    }
    return out
  }
  return mock(db.TIMETABLES)
}
export async function timetableSet({ classGroup, day, period, subject, venue }) {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('timetable_set', { p_class: classGroup, p_day: day, p_period: period, p_subject: subject, p_venue: venue })
    if (error) throw error
    return { ok: true, id: data }
  }
  return mock({ ok: true })
}

// --- Library (http-backed: catalogue + loans + issue/return/renew) ---
export async function listLibraryCatalogue() {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('library_catalogue')
    if (error) throw error
    return (data ?? []).map((b) => ({ isbn: b.isbn, title: b.title, author: b.author, cat: b.category, avail: b.avail, total: b.total }))
  }
  return mock(db.CATALOGUE)
}
export async function listLibraryLoans() {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('library_loans_active')
    if (error) throw error
    const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '')
    return (data ?? []).map((l) => ({ id: l.id, book: l.book, borrower: l.borrower, grade: '', issued: fmt(l.issued), due: fmt(l.due), status: l.status }))
  }
  return mock(db.LOANS)
}
export async function libraryIssue({ isbn, borrower, days = 14 }) {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('library_issue', { p_isbn: isbn, p_borrower: borrower, p_days: days })
    if (error) throw error
    return { ok: true, id: data }
  }
  return mock({ ok: true, id: 'loan-' + Date.now() })
}
export async function libraryReturn(loanId) {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('library_return', { p_loan: loanId })
    if (error) throw error
    return data // { ok, overdue_days, fine }
  }
  return mock({ ok: true })
}
export async function libraryRenew(loanId, days = 14) {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('library_renew', { p_loan: loanId, p_days: days })
    if (error) throw error
    return { ok: true, due: data }
  }
  return mock({ ok: true })
}

// Real dashboard aggregates (http). In mock mode returns null so the Dashboard
// keeps its demo constants — no fabricated numbers reach a real (http) deployment.
export async function getDashboardStats() {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('dashboard_stats')
    if (error) throw error
    return data // { enrolled_students, staff_count, fees_collected, enrolment_by_programme, … }
  }
  return mock(null)
}

// ============================ FEEDBACK FEATURES (2026 client review) ============================

// --- Announcements ---
// Module-level mock store so an announcement a lecturer posts this session is
// read back by the student portal (both go through these two functions). In
// http mode the Supabase table is the source of truth and this store is unused.
let _announcements = [
  { id: 'a1', title: 'Semester registration is open', body: 'Register your modules before the published deadline in the portal.', audience: 'students', author: 'Registrar', pinned: true, created_at: '2026-07-20' },
  { id: 'a2', title: 'Examination timetable published', body: 'Download it from the portal under Documents.', audience: 'all', author: 'Registrar', pinned: false, created_at: '2026-07-18' },
]
export async function listAnnouncements(audience = 'students') {
  if (useHttp()) {
    const { data, error } = await supabase.from('announcements')
      .select('id,title,body,audience,pinned,created_at')
      .in('audience', [audience, 'all']).order('pinned', { ascending: false }).order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  }
  const rows = _announcements
    .filter((a) => a.audience === audience || a.audience === 'all')
    .sort((x, y) => (y.pinned - x.pinned) || (y.created_at < x.created_at ? -1 : 1))
  return mock(rows)
}
export async function createAnnouncement({ title, body, audience = 'students', author = 'Lecturer' }) {
  if (useHttp()) {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('announcements').insert({ title, body, audience, created_by: user?.id }).select().single()
    if (error) throw error
    return data
  }
  const row = { id: 'a-' + Date.now(), title, body, audience, author, pinned: false, created_at: new Date().toISOString().slice(0, 10) }
  _announcements = [row, ..._announcements]
  return mock({ ok: true, ...row })
}

// --- Courseware submissions & grading (LMS feedback loop) ---
// Module-level store, seeded so a lecturer has work to grade and the student
// sees the grade + written feedback come back. Same pattern as announcements;
// http mode would use a `submissions` table (not yet in the schema).
let _submissions = {
  'VTW101-A1': [
    { id: 'sub-a1-gn', assignmentId: 'VTW101-A1', student: 'Gabriel !Naruseb', submittedAt: '2026-07-17', grade: null, feedback: '', gradedBy: null },
    { id: 'sub-a1-rn', assignmentId: 'VTW101-A1', student: 'Rauna Nakale', submittedAt: '2026-07-17', grade: 18, feedback: 'Solid grasp of PPE and lockout steps. Revise the fire-class table for the exam.', gradedBy: 'Tobias Shikongo' },
    { id: 'sub-a1-tg', assignmentId: 'VTW101-A1', student: 'Tuhafeni Gaoseb', submittedAt: '2026-07-18', grade: null, feedback: '', gradedBy: null },
  ],
  'VTW101-A2': [
    { id: 'sub-a2-gn', assignmentId: 'VTW101-A2', student: 'Gabriel !Naruseb', submittedAt: '2026-07-24', grade: null, feedback: '', gradedBy: null },
    { id: 'sub-a2-as', assignmentId: 'VTW101-A2', student: 'Anna Shiweda', submittedAt: '2026-07-24', grade: null, feedback: '', gradedBy: null },
  ],
}
export async function listSubmissions(assignmentId) {
  if (useHttp()) {
    const { data, error } = await supabase.from('submissions')
      .select('id,submitted_at,grade,feedback,graded_by,students(full_name),assignments!inner(code)')
      .eq('assignments.code', assignmentId)
    if (error) throw error
    return (data ?? []).map((s) => ({
      id: s.id, assignmentId, student: s.students?.full_name, submittedAt: s.submitted_at,
      grade: s.grade == null ? null : Number(s.grade), feedback: s.feedback || '', gradedBy: s.graded_by,
    }))
  }
  return mock(_submissions[assignmentId] || [])
}
export async function getSubmission(assignmentId, student) {
  if (useHttp()) {
    const rows = await listSubmissions(assignmentId)
    return rows.find((s) => s.student === student) || null
  }
  return mock((_submissions[assignmentId] || []).find((s) => s.student === student) || null)
}
export async function gradeSubmission({ id, assignmentId, grade, feedback = '', gradedBy = 'Lecturer' }) {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('grade_submission', { p_submission: id, p_grade: grade, p_feedback: feedback })
    if (error) throw error
    return data
  }
  const row = (_submissions[assignmentId] || []).find((s) => s.id === id)
  if (row) { row.grade = grade; row.feedback = feedback; row.gradedBy = gradedBy }
  return mock({ ok: !!row, id, grade, feedback })
}

// --- Student ↔ lecturer queries (two-way channel) ---
let _queries = [
  { id: 'q1', course: 'VTW101', student: 'Gabriel !Naruseb', lecturer: 'Tobias Shikongo', subject: 'Welding practical CA', body: 'Could you confirm my CA mark for the welding practical? I think a session may be missing.', createdAt: '2026-07-22', reply: '', repliedAt: null, status: 'open' },
]
export async function listQueries({ lecturer, student } = {}) {
  if (useHttp()) {
    // RLS scopes the rows: a student sees only their own; staff see all.
    const { data, error } = await supabase.from('queries')
      .select('id,subject,body,reply,status,created_at,replied_at,courses(code),students(full_name),staff(name)')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((r) => ({
      id: r.id, course: r.courses?.code, student: r.students?.full_name, lecturer: r.staff?.name,
      subject: r.subject, body: r.body, reply: r.reply || '', status: r.status,
      createdAt: r.created_at, repliedAt: r.replied_at,
    }))
  }
  let rows = _queries
  if (lecturer) rows = rows.filter((q) => q.lecturer === lecturer)
  if (student) rows = rows.filter((q) => q.student === student)
  return mock([...rows].sort((a, b) => (a.status === b.status ? 0 : a.status === 'open' ? -1 : 1)))
}
export async function createQuery({ course, student, lecturer, subject, body }) {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('create_query', { p_course_code: course, p_subject: subject, p_body: body })
    if (error) throw error
    return data
  }
  const row = { id: 'q-' + Date.now(), course, student, lecturer, subject, body, createdAt: new Date().toISOString().slice(0, 10), reply: '', repliedAt: null, status: 'open' }
  _queries = [row, ..._queries]
  return mock({ ok: true, ...row })
}
export async function replyQuery({ id, reply }) {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('reply_query', { p_id: id, p_reply: reply })
    if (error) throw error
    return data
  }
  const q = _queries.find((x) => x.id === id)
  if (q) { q.reply = reply; q.repliedAt = new Date().toISOString().slice(0, 10); q.status = 'answered' }
  return mock({ ok: !!q })
}

// --- Academic control windows (open/close) ---
export async function listAcademicWindows() {
  if (useHttp()) {
    const { data, error } = await supabase.from('academic_windows')
      .select('id,kind,academic_year,intake,opens_at,closes_at,is_open')
    if (error) throw error
    return data ?? []
  }
  return mock([
    { id: 'w1', kind: 'applications', is_open: true, opens_at: '2026-06-01', closes_at: '2026-09-30', academic_year: 2026, intake: 'july' },
    { id: 'w2', kind: 'registration', is_open: true, opens_at: '2026-07-01', closes_at: '2026-07-31', academic_year: 2026, intake: 'july' },
    { id: 'w3', kind: 'marks_insertion', is_open: true, opens_at: '2026-11-01', closes_at: '2026-11-20', academic_year: 2026, intake: 'july' },
    { id: 'w4', kind: 'marks_release', is_open: false, opens_at: '2026-12-05', closes_at: '2026-12-31', academic_year: 2026, intake: 'july' },
    { id: 'w5', kind: 'second_opportunity', is_open: false, opens_at: '2027-01-12', closes_at: '2027-01-23', academic_year: 2026, intake: 'july' },
    { id: 'w6', kind: 'graduation_clearance', is_open: false, opens_at: '2027-02-01', closes_at: '2027-02-28', academic_year: 2026, intake: 'july' },
  ])
}
export async function setAcademicWindow({ kind, isOpen, opensAt = null, closesAt = null, year = null, intake = null }) {
  if (useHttp()) {
    const { error } = await supabase.rpc('set_academic_window', {
      p_kind: kind, p_is_open: isOpen, p_opens_at: opensAt, p_closes_at: closesAt, p_year: year, p_intake: intake,
    })
    if (error) throw error
    return { ok: true }
  }
  return mock({ ok: true, kind, isOpen })
}

// --- Attendance (record + read is above via getAttendanceForStudent) ---
export async function recordAttendance({ student, studentId, courseId, hours = 1, present = true, date }) {
  if (useHttp()) {
    const { error } = await supabase.from('attendance').insert({
      student_id: studentId, course_id: courseId, hours, present, session_date: date || undefined,
    })
    if (error) throw error
    return { ok: true }
  }
  if (student) {
    const a = seedAttendance(student)
    a.total += 1
    if (present) a.attended += 1
  }
  return mock({ ok: true, student, present })
}
// Record a whole session's register in one call.
export async function recordSession({ present, code }) {
  if (useHttp()) {
    const { data } = await supabase.rpc('course_attendance', { p_course_code: code })
    const idByName = Object.fromEntries((data ?? []).map((r) => [r.student, r.student_id]))
    const p_present = Object.entries(present || {})
      .map(([name, isPresent]) => ({ student_id: idByName[name], present: isPresent }))
      .filter((x) => x.student_id)
    const { error } = await supabase.rpc('record_attendance_session', { p_course_code: code, p_present })
    if (error) throw error
    return { ok: true }
  }
  Object.entries(present || {}).forEach(([name, isPresent]) => {
    const a = seedAttendance(name)
    a.total += 1
    if (isPresent) a.attended += 1
  })
  return mock({ ok: true })
}

// --- HR: leave self-service ---
export async function applyLeave({ type, start, end }) {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('apply_leave', { p_type: type, p_start: start, p_end: end })
    if (error) throw error
    return { ok: true, id: data }
  }
  return mock({ ok: true, id: 'lv-' + Date.now(), type, start, end, status: 'pending' })
}
export async function decideLeave({ id, approve }) {
  if (useHttp()) {
    const { error } = await supabase.rpc('decide_leave', { p_id: id, p_approve: approve })
    if (error) throw error
    return { ok: true }
  }
  return mock({ ok: true, id, status: approve ? 'approved' : 'rejected' })
}
export async function listLeaveRequests() {
  if (useHttp()) {
    const { data, error } = await supabase.from('leave_requests')
      .select('id,type,start_date,end_date,status,staff(name)').order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((l) => ({ id: l.id, type: l.type, start: l.start_date, end: l.end_date, status: l.status, staff: l.staff?.name }))
  }
  return mock([
    { id: 'lv1', type: 'Annual', start: '2026-08-01', end: '2026-08-05', status: 'pending', staff: 'M. Amupolo' },
    { id: 'lv2', type: 'Sick', start: '2026-07-22', end: '2026-07-23', status: 'approved', staff: 'J. Nghipandulwa' },
  ])
}

// --- Role permission matrix ---
export async function listRolePermissions() {
  if (useHttp()) {
    const { data, error } = await supabase.from('role_permissions').select('role,module,can_view,can_edit')
    if (error) throw error
    return data ?? []
  }
  return mock([])
}

// --- Official documents (register + signed URL; PDF generated app/server-side) ---
export async function listDocumentsForStudent(studentName) {
  if (useHttp()) {
    const sid = await studentIdByName(studentName)
    if (!sid) return []
    const { data, error } = await supabase.from('documents')
      .select('id,type,path,issued_at').eq('student_id', sid).order('issued_at', { ascending: false })
    if (error) throw error
    return data ?? []
  }
  return mock([
    { id: 'd1', type: 'proof_of_registration', path: null, issued_at: '2026-07-15' },
    { id: 'd2', type: 'exam_permit', path: null, issued_at: '2026-07-20' },
  ])
}
export async function issueDocument({ studentId, type, meta = {} }) {
  if (useHttp()) {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('documents')
      .insert({ student_id: studentId, type, meta, issued_by: user?.id }).select().single()
    if (error) throw error
    return { ok: true, id: data.id }
  }
  return mock({ ok: true, id: 'doc-' + Date.now(), type })
}

// Official college identity + signatories used on generated documents.
// Mock defaults mirror the college_settings/signatories seed (migration
// 20260809120000) so letters look identical in mock and http mode.
const COLLEGE_SETTINGS_DEFAULT = {
  name: 'Symanek Specialized College',
  address: 'Extension 6, Okahandja, Republic of Namibia',
  po_box: 'P.O. Box 4270, Windhoek, Namibia',
  reg_no: 'cc/2022/10663',
  tax_no: '13469812-01-1',
  phone: '+264 62 502227',
  cell: '+264 85 804 5679',
  email: 'info@symanekacademy.com',
  website: 'www.symanekacademy.com',
  portal_url: 'www.symanek.educims.org',
  bank_name: 'First National Bank (FNB)',
  bank_account_name: 'Symanek Specialized College',
  bank_account_no: '64279814676',
  bank_account_type: 'Enterprise Business Account',
  bank_branch: 'Okahandja (branch code 280373)',
  stamp_path: null,
}
const SIGNATORIES_DEFAULT = [
  { role_key: 'ceo', name: 'Mrs. Olivia Nelumbu', title: 'Chief Executive Officer' },
  { role_key: 'registrar', name: 'Ms. Rebbeka Shilongo', title: 'Administration Assistant, Office of the Registrar' },
  { role_key: 'admin_assistant', name: 'Ms. Michelle Guchas', title: 'Administrative Assistant' },
]

export async function getCollegeSettings() {
  if (useHttp()) {
    const { data, error } = await supabase.from('college_settings').select('*').limit(1).maybeSingle()
    if (error) throw error
    return data ?? COLLEGE_SETTINGS_DEFAULT
  }
  return mock(COLLEGE_SETTINGS_DEFAULT)
}

export async function getSignatories() {
  if (useHttp()) {
    const { data, error } = await supabase.from('signatories').select('role_key,name,title,signature_path').eq('active', true)
    if (error) throw error
    return (data && data.length ? data : SIGNATORIES_DEFAULT)
  }
  return mock(SIGNATORIES_DEFAULT)
}

// ============================ AUTH / SESSION ============================
// Phase 1: pick a role card (no password). Phase 2: real credentials + JWT/session,
// with RBAC enforced server-side (see BACKEND.md), not by hiding nav items.
export const login = ({ roleId }) => mock({ ok: true, role: db.ROLES.find((r) => r.id === roleId) || null, tenant: TENANT })
export const currentSession = () => mock({ tenant: TENANT, mode: API_MODE })
