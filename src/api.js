// ---------------------------------------------------------------------------
// Data-access layer — the seam between the UI and the backend.
//
// Every screen should read/write through THESE functions, never by importing
// fixture data directly. In API_MODE='mock' reads intentionally resolve to
// empty/null after a tiny delay, so the UI exercises loading and empty states
// without fabricated production data.
//
// In API_MODE='http', Supabase/RPC is the source of truth and joins must use
// database identifiers/session scope rather than display names.
// ---------------------------------------------------------------------------
import { API_MODE, API_BASE, TENANT } from './config.js'
import { ROLES } from './lib/institution.js'
import { supabase } from './supabaseClient.js'

const clone = (d) => (typeof structuredClone === 'function' ? structuredClone(d) : JSON.parse(JSON.stringify(d)))
const delay = (ms = 100) => new Promise((r) => setTimeout(r, ms))

// mock resolver — empty-by-default local mode
async function mock(data) { await delay(); return clone(data) }

// Phase-2 backend path (Supabase). Active when API_MODE='http' and the client is
// configured. Env is read here too so Node tests can flip it without Vite.
const httpMode = () =>
  API_MODE === 'http' || (typeof process !== 'undefined' && process.env && process.env.VITE_API_MODE === 'http')
const useHttp = () => httpMode() && supabase !== null

// name → student uuid. Kept for admin-side name lookups; the student portal now
// resolves the caller via currentStudentId() (session), never by name.
// eslint-disable-next-line no-unused-vars
async function studentIdByName(name) {
  const { data } = await supabase.from('students').select('id').eq('full_name', name).maybeSingle()
  return data?.id ?? null
}

// The signed-in student's own uuid, resolved from the session (never by name).
// RLS (students owner read: user_id = auth.uid()) guarantees this returns only
// the caller's row, so every portal read below is scoped to themselves.
async function currentStudentId() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('students').select('id').eq('user_id', user.id).maybeSingle()
  return data?.id ?? null
}

async function resolveStudentId(student) {
  if (!useHttp()) return null
  if (!student) return currentStudentId()
  const raw = String(student)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)
  if (isUuid) return raw
  const safe = raw.replace(/[%*,()]/g, '').trim()
  const { data, error } = await supabase.from('students')
    .select('id')
    .or(`student_no.eq.${safe},reference.eq.${safe},full_name.eq.${safe}`)
    .maybeSingle()
  if (error) throw error
  return data?.id ?? currentStudentId()
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
    reference: s.reference,
    name: s.full_name,
    email: s.email || null,
    programmeId: s.programme_id || null,
    grade: grade || (s.programmes?.name ?? '—'),
    guardian: s.next_of_kin || '—',
    phone: s.phone || '—',
    status: s.status ? s.status[0].toUpperCase() + s.status.slice(1) : 'Admitted',
    attendance: s.attendance != null ? Number(s.attendance) : null,
    year: s.year || null,
    intake: s.intake || null,
    idNumber: s.id_number || null,
    campus: s.campus || null,
  }
}
export async function listStudents() {
  if (useHttp()) {
    const { data, error } = await supabase.from('students')
      .select('id,student_no,reference,full_name,email,next_of_kin,phone,status,attendance,year,intake,id_number,campus,programme_id,programmes(slug,name)')
    if (error) throw error
    return (data ?? []).map(toLearner)
  }
  return mock([])
}
export async function getStudent(id) {
  if (useHttp()) {
    const { data, error } = await supabase.from('students')
      .select('id,student_no,reference,full_name,email,next_of_kin,phone,status,attendance,year,intake,id_number,campus,programme_id,programmes(slug,name)')
      .or(`id.eq.${id},student_no.eq.${id},reference.eq.${id}`).maybeSingle()
    if (error) throw error
    return data ? toLearner(data) : null
  }
  return mock(null)
}

export async function listProgrammes() {
  if (useHttp()) {
    const { data, error } = await supabase.from('programmes')
      .select('id,slug,name,category,level,duration,fee,modes,active')
      .neq('category', 'suite-demo').order('name')
    if (error) throw error
    return (data ?? []).map((p) => ({
      id: p.id, slug: p.slug, code: p.slug.toUpperCase(), name: p.name, category: p.category,
      level: p.level, nqf: p.level, duration: p.duration, fee: p.fee, modes: p.modes, active: p.active,
    }))
  }
  return []
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
  return mock([])
}

export async function getDegreeAudit(studentName) {
  if (useHttp()) {
    const sid = await resolveStudentId(studentName)
    if (!sid) return null
    const { data, error } = await supabase.rpc('degree_audit', { p_student: sid })
    if (error) throw error
    return data // { prog, catalog, gpa, reqs: [...] }
  }
  return mock(null)
}

// Reads wired to the backend (mapped back to the mock-compatible shapes the
// modules already consume). Others follow the same pattern in later B2 passes.
export async function getInvoicesForStudent(studentName) {
  if (useHttp()) {
    const sid = await resolveStudentId(studentName)
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
  return mock([])
}

export async function getHoldsForStudent(studentName) {
  if (useHttp()) {
    const sid = await resolveStudentId(studentName)
    if (!sid) return []
    const { data, error } = await supabase.from('holds')
      .select('id,type,reason,blocks,active,created_at').eq('student_id', sid).eq('active', true)
    if (error) throw error
    return (data ?? []).map((h) => ({
      id: h.id, student: studentName, type: h.type[0].toUpperCase() + h.type.slice(1), rawType: h.type, reason: h.reason,
      blocks: h.blocks ?? [],
      impact: (h.blocks ?? []).map((b) => 'Blocks ' + b), since: h.created_at,
    }))
  }
  return mock([])
}

export async function getSponsorsForStudent(studentName) {
  if (useHttp()) {
    const sid = await resolveStudentId(studentName)
    if (!sid) return []
    const { data, error } = await supabase.from('sponsor_claims')
      .select('id,coverage,billed,received,status,sponsors(name,type)').eq('student_id', sid)
    if (error) throw error
    return (data ?? []).map((c) => ({
      id: c.id, sponsor: c.sponsors?.name, type: c.sponsors?.type,
      coverage: Number(c.coverage), billed: Number(c.billed), received: Number(c.received), status: c.status,
    }))
  }
  return mock([])
}

// Empty-by-default mock result store. The http path uses Supabase results.
let _results = null
function results() {
  if (_results) return _results
  _results = {}
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
    const sid = await resolveStudentId(studentName)
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

// Mock attendance store starts empty; recordAttendance/recordSession can still
// update it during a local session without importing fixture data.
let _attendance = {}
function seedAttendance(name) {
  if (_attendance[name]) return _attendance[name]
  const total = 25
  return (_attendance[name] = { attended: 0, total })
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
    const sid = await resolveStudentId(studentName)
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
  return mock([])
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
  return mock([])
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
  return mock([])
}
const APP_STAGE_LABEL = {
  submitted: 'Applied', under_review: 'Under Review', approved: 'Approved',
  rejected: 'Rejected', paid: 'Paid', enrolled: 'Enrolled',
}
export async function listApplicants() {
  if (useHttp()) {
    const { data, error } = await supabase.from('applications')
      .select('id,reference,full_name,programme_slug,stage,amount_due,created_at').order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((a) => ({
      id: a.reference || a.id, _uuid: a.id, name: a.full_name,
      prog: (a.programme_slug || '').toUpperCase(), points: 0,
      stage: APP_STAGE_LABEL[a.stage] || a.stage,
      amountDue: Number(a.amount_due || 0),
      applied: a.created_at ? new Date(a.created_at).toLocaleDateString('en-NA') : '',
      docs: {},
    }))
  }
  return mock([])
}

export async function approveApplication(appId) {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('approve_application', { p_app: appId })
    if (error) throw error
    return { ok: true, reference: data }
  }
  return mock({ ok: true, reference: null })
}

export async function markApplicationPaid({ appId, amount, method = 'EFT' }) {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('mark_paid', { p_app: appId, p_amount: amount, p_method: method })
    if (error) throw error
    return { ok: true, reference: data }
  }
  return mock({ ok: true, reference: null })
}

export async function rejectApplication(appId, reason = null) {
  if (useHttp()) {
    const { error } = await supabase.rpc('reject_application', { p_app: appId, p_reason: reason })
    if (error) throw error
    return { ok: true }
  }
  return mock({ ok: true })
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
  return mock([])
}
export async function listNcheReturns() {
  if (useHttp()) {
    const { data, error } = await supabase.from('nche_returns')
      .select('title,period,due,status').order('due')
    if (error) throw error
    return (data ?? []).map((n) => ({ ret: n.title, period: n.period, due: n.due, status: n.status }))
  }
  return mock([])
}
export const getCourseware = (code) => mock(null)

export async function listStaff() {
  if (useHttp()) {
    const { data, error } = await supabase.from('staff').select('staff_no,name,email,role,department')
    if (error) throw error
    return (data ?? []).map((s) => ({ id: s.staff_no, name: s.name, email: s.email, role: s.role, dept: s.department }))
  }
  return mock([])
}

// ============================ WRITES (stubs → backend) ============================
// Each returns the shape the backend will return; the mock just echoes success.
export async function registerCourse({ courseId, courseCode, studentId }) {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('register_course', { p_course_id: courseId })
    if (error) throw error
    return data // { ok, code, status, charge, message } — server-authoritative rules engine
  }
  return mock({ ok: true, studentId, courseCode, charge: 0, at: Date.now() })
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

// --- Canteen (http-backed): POS records sales, CanteenAdmin reads the summary ---
export async function canteenRecordSale({ total, pay, lines }) {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('canteen_record_sale', { p_total: total, p_pay: pay, p_lines: lines })
    if (error) throw error
    return { ok: true, id: data }
  }
  return mock({ ok: true })
}
export async function getCanteenSummary() {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('canteen_summary')
    if (error) throw error
    return data // { sales_today, transactions, avg_basket, top_sellers }
  }
  return null
}
export async function listCanteenProducts() {
  if (!useHttp()) return []
  const { data, error } = await supabase.from('canteen_products').select('id,name,category,price,stock,reorder').order('name')
  if (error) throw error
  return (data ?? []).map((p) => ({ id: p.id, name: p.name, cat: p.category, price: Number(p.price), stock: p.stock, reorder: p.reorder }))
}

// --- General ledger (http-backed): journal drives trial balance / income stmt ---
export async function getGlJournal() {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('gl_journal_list')
    if (error) throw error
    return (data ?? []).map((r) => ({
      date: r.entry_date ? new Date(r.entry_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '',
      desc: r.description, acc: r.account, dr: Number(r.dr), cr: Number(r.cr), vat: r.vat || '—',
    }))
  }
  return []
}
// Chart of accounts from the GL (name → type/normal side). Replaces the mock COA.
export async function listGlAccounts() {
  if (!useHttp()) return []
  const { data, error } = await supabase.from('gl_accounts').select('name,type,normal_side').order('type')
  if (error) throw error
  return (data ?? []).map((a) => ({ name: a.name, type: a.type, side: a.normal_side }))
}
export async function glPost({ desc, drAcc, crAcc, amount }) {
  if (useHttp()) {
    const lines = [{ acc: drAcc, dr: amount, cr: 0, vat: '—' }, { acc: crAcc, dr: 0, cr: amount, vat: '—' }]
    const { data, error } = await supabase.rpc('gl_post', { p_date: new Date().toISOString().slice(0, 10), p_desc: desc, p_lines: lines })
    if (error) throw error
    return { ok: true, id: data }
  }
  return mock({ ok: true })
}

// --- Class timetable (http-backed) ---
// Returns the TIMETABLES shape { class: { periodId: [Mon..Fri slot|null] } }.
export async function getTimetables() {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('timetable')
    if (error) throw error
    const periods = [...new Set((data ?? []).map((p) => p.period_id))]
    const out = {}
    for (const s of data ?? []) {
      if (!out[s.class_group]) { out[s.class_group] = {}; periods.forEach((pid) => { out[s.class_group][pid] = [null, null, null, null, null] }) }
      const arr = out[s.class_group][s.period_id]
      if (arr) arr[s.day_of_week - 1] = { s: s.subject, r: s.venue || '' }
    }
    return out
  }
  return mock({})
}
export async function timetableSet({ classGroup, day, period, subject, venue, lecturerStaffNo = null }) {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('timetable_set', { p_class: classGroup, p_day: day, p_period: period, p_subject: subject, p_venue: venue, p_lecturer_staff_no: lecturerStaffNo })
    if (error) throw error
    return { ok: true, id: data }
  }
  return { ok: true }
}
// Flat list of timetable slots (all classes) for the schedule table.
export async function listTimetable() {
  if (!useHttp()) return []
  const { data, error } = await supabase.rpc('timetable')
  if (error) throw error
  return (data ?? []).map((s) => ({ id: s.id, classGroup: s.class_group, day: s.day_of_week, period: s.period_id, subject: s.subject, venue: s.venue, lecturer: s.lecturer }))
}
export async function timetableClear(id) {
  if (!useHttp()) return { ok: true }
  const { error } = await supabase.rpc('timetable_clear', { p_id: id })
  if (error) throw error
  return { ok: true }
}

// --- Library (http-backed: catalogue + loans + issue/return/renew) ---
export async function listLibraryCatalogue() {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('library_catalogue')
    if (error) throw error
    return (data ?? []).map((b) => ({ id: b.id, isbn: b.isbn, title: b.title, author: b.author, cat: b.category, avail: b.avail, total: b.total }))
  }
  return []
}
export async function listLibraryLoans() {
  if (useHttp()) {
    const { data, error } = await supabase.rpc('library_loans_active')
    if (error) throw error
    const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '')
    return (data ?? []).map((l) => ({ id: l.id, book: l.book, borrower: l.borrower, issued: fmt(l.issued), due: fmt(l.due), status: l.status }))
  }
  return []
}
export async function listLibraryFines() {
  if (!useHttp()) return []
  const { data, error } = await supabase.rpc('library_fines_list')
  if (error) throw error
  return (data ?? []).map((f) => ({ id: f.id, borrower: f.borrower, book: f.book, days: f.days, amount: Number(f.amount), paid: f.paid }))
}
export async function listLibraryReservations() {
  if (!useHttp()) return []
  const { data, error } = await supabase.rpc('library_reservations_list')
  if (error) throw error
  const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '')
  return (data ?? []).map((r) => ({ id: r.id, title: r.title, requester: r.requester, placed: fmt(r.placed), pos: r.pos, avail: r.avail, status: r.status }))
}
export async function libraryBookUpsert({ isbn, title, author, category, total }) {
  if (!useHttp()) return { ok: true }
  const { data, error } = await supabase.rpc('library_book_upsert', {
    p_isbn: isbn || null, p_title: title, p_author: author || null, p_category: category || null, p_total: Number(total) || 1 })
  if (error) throw error
  return { ok: true, id: data }
}
export async function libraryBookDelete(id) {
  if (!useHttp()) return { ok: true }
  const { error } = await supabase.rpc('library_book_delete', { p_id: id })
  if (error) throw error
  return { ok: true }
}
export async function libraryFineSettle(id, waive = false) {
  if (!useHttp()) return { ok: true }
  const { error } = await supabase.rpc('library_fine_settle', { p_id: id, p_waive: waive })
  if (error) throw error
  return { ok: true }
}
export async function libraryReservationAdd({ isbn, requester, student = null }) {
  if (!useHttp()) return { ok: true }
  const { data, error } = await supabase.rpc('library_reservation_add', { p_isbn: isbn, p_requester: requester, p_student: student })
  if (error) throw error
  return { ok: true, id: data }
}
export async function libraryReservationUpdate(id, status) {
  if (!useHttp()) return { ok: true }
  const { error } = await supabase.rpc('library_reservation_update', { p_id: id, p_status: status })
  if (error) throw error
  return { ok: true }
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
    const sid = await currentStudentId()
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
export const login = ({ roleId }) => mock({ ok: true, role: ROLES.find((r) => r.id === roleId) || null, tenant: TENANT })
export const currentSession = () => mock({ tenant: TENANT, mode: API_MODE })

// Admin grants a student portal login. Creates the auth user server-side (Edge
// Function, service_role) and links students.user_id; returns the one-time
// email + temporary password to show the admin. The student must change it on
// first login. In mock mode returns demo credentials so the UI is exercisable.
export async function grantStudentAccess(studentUuid) {
  if (!useHttp()) return mock({ email: 'demo.student@symanek.local', password: 'Symanek-temp-1!' })
  const { data, error } = await supabase.functions.invoke('grant-student-access', {
    body: { student_id: studentUuid },
  })
  if (error) {
    // Non-2xx bodies arrive on error.context (a Response), not on `data`.
    let msg = error.message
    try { msg = (await error.context?.json())?.error || msg } catch { /* keep msg */ }
    throw new Error(msg)
  }
  return data // { email, password }
}

// Called after a student sets a new password on first login — clears the flag.
export async function clearPasswordReset() {
  if (!useHttp()) return mock({ ok: true })
  const { error } = await supabase.rpc('clear_password_reset')
  if (error) throw error
  return { ok: true }
}

// ======================= BUSINESS SETTINGS =======================
// Editable business rules (grade bands, PAYE/SSC/VET, VAT, currency) stored in
// business_settings. In mock/dev returns null so callers keep their built-in
// defaults; in http returns the { key: value } object.
export async function getBusinessSettings() {
  if (!useHttp()) return null
  const { data, error } = await supabase.rpc('get_business_settings')
  if (error) throw error
  return data // { grade_bands, assessment_weights, paye_brackets, ssc, vet_levy, tax, currency }
}

// Admin-only write of a single setting; value is any JSON-serialisable value.
export async function setBusinessSetting(key, value) {
  if (!useHttp()) return { ok: true }
  const { error } = await supabase.rpc('set_business_setting', { p_key: key, p_value: value })
  if (error) throw error
  return { ok: true }
}

// ======================= DOMAIN CRUD (Phase 2 backends) =======================
// Thin wrappers over the SECURITY DEFINER RPCs. Reads return [] / null in mock so
// no fabricated data reaches a real deployment; writes are no-ops in mock.
const rows = async (fn, args) => {
  if (!useHttp()) return []
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw error
  return data ?? []
}
const one = async (fn, args) => {
  if (!useHttp()) return null
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw error
  return data
}
const call = async (fn, args) => {
  if (!useHttp()) return { ok: true }
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw error
  return { ok: true, result: data }
}

// ---- Library extra CRUD is defined above (listLibraryFines, …) ----

// ---- HR / Payroll ----
export const listPayroll        = () => rows('hr_payroll_list')
export const listLeaveBalances  = () => rows('hr_leave_balances_list')
export const listRecruitment    = () => rows('hr_recruitment_list')
export const listWorkload       = () => rows('hr_workload_list')
export const getStaffDetail     = (id) => one('hr_staff_detail', { p_staff: id })
export const staffUpsert        = (s) => call('staff_upsert', { p_id: s.id ?? null, p_staff_no: s.staffNo ?? null, p_name: s.name, p_email: s.email ?? null, p_role: s.role ?? null, p_department: s.department ?? null })
export const staffDelete        = (id) => call('staff_delete', { p_id: id })
export const contractSet        = (c) => call('contract_set', { p_staff: c.staffId, p_type: c.type, p_start: c.start ?? null, p_end: c.end ?? null, p_fte: c.fte ?? 1 })
export const qualificationAdd   = (q) => call('qualification_add', { p_staff: q.staffId, p_title: q.title, p_institution: q.institution ?? null, p_year: q.year ?? null })
export const leaveBalanceSet    = (b) => call('leave_balance_set', { p_staff: b.staffId, p_annual: b.annual, p_sick: b.sick, p_taken: b.taken })
export const recruitUpsert      = (r) => call('recruit_upsert', { p_id: r.id ?? null, p_position: r.position, p_candidate: r.candidate ?? null, p_stage: r.stage ?? 'applied', p_notes: r.notes ?? null })
export const workloadSet        = (w) => call('workload_set', { p_staff: w.staffId, p_courses: w.courses, p_periods: w.periods, p_students: w.students })
export const payrollRun         = (p) => call('payroll_run', { p_staff: p.staffId, p_month: p.month, p_gross: p.gross })

// ---- Finance ----
export const getFinanceStats    = () => one('finance_stats')
export const listDebtors        = () => rows('finance_debtors_list')
export const listCollectionByProgramme = () => rows('finance_collection_by_programme')
export const listExpenseBreakdown = () => rows('finance_expense_breakdown')
export const listInvoices       = () => rows('invoices_list')
export const listFeeStructures  = () => rows('fee_structures_list')
export const listBudgets        = () => rows('budgets_list')
export const listExpenses       = () => rows('expenses_list')
export const invoiceCreate      = (i) => call('invoice_create', { p_student: i.studentId, p_amount: i.amount, p_due: i.due ?? null })
export const feeStructureSet    = (f) => call('fee_structure_set', { p_programme: f.programmeId, p_year: f.year, p_tuition: f.tuition, p_other: f.other })
export const budgetSet          = (b) => call('budget_set', { p_category: b.category, p_allocated: b.allocated, p_spent: b.spent ?? 0 })
export const expenseRecord      = (e) => call('expense_record', { p_date: e.date ?? null, p_category: e.category, p_description: e.description ?? null, p_amount: e.amount })

// ---- Accounting (assets + VAT) ----
export const listAssets         = () => rows('asset_register_list')
export const listVatCalendar    = () => rows('vat_calendar_list')
export const assetAdd           = (a) => call('asset_add', { p_name: a.name, p_category: a.category ?? null, p_acquired: a.acquired ?? null, p_cost: a.cost, p_life: a.life ?? 5 })
export const assetDelete        = (id) => call('asset_delete', { p_id: id })
export const assetDepreciate    = (id) => call('asset_depreciate', { p_id: id })
export const vatPeriodSet       = (v) => call('vat_period_set', { p_period: v.period, p_output: v.output, p_input: v.input, p_status: v.status ?? 'open', p_due: v.due ?? null })

// ---- Canteen / POS ----
export const listTillSessions   = () => rows('canteen_till_list')
export const listCanteenAccounts = () => rows('canteen_accounts_list')
export const canteenProductUpsert = (p) => call('canteen_product_upsert', { p_id: p.id ?? null, p_name: p.name, p_category: p.category ?? null, p_price: p.price, p_stock: p.stock ?? 0, p_reorder: p.reorder ?? 0 })
export const canteenProductDelete = (id) => call('canteen_product_delete', { p_id: id })
export const canteenInventoryAdjust = (id, delta) => call('canteen_inventory_adjust', { p_id: id, p_delta: delta })
export const canteenTillOpen    = (float) => call('canteen_till_open', { p_float: float })
export const canteenTillClose   = (id, counted) => call('canteen_till_close', { p_id: id, p_counted: counted })
export const canteenAccountTopup = (studentId, amount) => call('canteen_account_topup', { p_student: studentId, p_amount: amount })

// ---- Scheduling ----
export const listPeriods        = () => rows('periods_list')
export const listDutyRoster     = () => rows('duty_roster_list')
export const listRelief         = (date) => rows('relief_list', { p_date: date ?? null })
export const periodSet          = (p) => call('period_set', { p_id: p.id, p_label: p.label, p_start: p.start ?? null, p_end: p.end ?? null, p_ord: p.ord ?? 0 })
export const periodDelete       = (id) => call('period_delete', { p_id: id })
export const dutySet            = (d) => call('duty_set', { p_id: d.id ?? null, p_day: d.day, p_area: d.area, p_staff: d.staffId ?? null })
export const dutyDelete         = (id) => call('duty_delete', { p_id: id })
export const reliefSet          = (r) => call('relief_set', { p_date: r.date ?? null, p_absent: r.absentId ?? null, p_cover: r.coverId ?? null, p_class: r.classGroup ?? null, p_period: r.periodId ?? null, p_note: r.note ?? null })
export const reliefDelete       = (id) => call('relief_delete', { p_id: id })

// ---- Accommodation ----
export const listAllocations    = () => rows('allocations_list')
export const listResidencesFull = () => rows('residences_list')
export const residenceUpsert    = (r) => call('residence_upsert', { p_id: r.id ?? null, p_name: r.name, p_capacity: r.capacity })
export const residenceDelete    = (id) => call('residence_delete', { p_id: id })
export const allocateRoomRpc    = (a) => call('allocate_room', { p_student: a.studentId, p_residence: a.residenceId, p_room: a.room ?? null, p_fee: a.fee ?? 0 })
export const allocationSetStatus = (id, status) => call('allocation_set_status', { p_id: id, p_status: status })

// ---- Compliance / Institution ----
export const listNcheReturnsFull = () => rows('nche_returns_list')
export const ncheReturnSet      = (n) => call('nche_return_set', { p_id: n.id ?? null, p_title: n.title, p_period: n.period ?? null, p_status: n.status ?? 'draft', p_due: n.due ?? null })
export const getInstitution     = () => one('institution_get')
export const setInstitution     = (i) => call('institution_set', { p_name: i.name ?? null, p_type: i.type ?? null, p_modules: i.modules ?? null })

// ---- Dashboard aggregates ----
export const getFeeTrend        = () => rows('dashboard_fee_trend')
export const getCashflow        = () => rows('dashboard_cashflow')
export const getActivityFeed    = () => rows('dashboard_activity')
export const getWorkQueue       = () => one('dashboard_work_queue')

// ---- Students / Holds ----
export async function studentUpsert(s) {
  if (!useHttp()) return { ok: true, id: s.id ?? null }
  const { data, error } = await supabase.rpc('student_upsert', {
    p_id: s.id ?? null,
    p_student_no: s.studentNo ?? s.student_no ?? null,
    p_reference: s.reference ?? s.studentNo ?? s.student_no ?? null,
    p_full_name: s.name,
    p_email: s.email,
    p_phone: s.phone ?? null,
    p_next_of_kin: s.nextOfKin ?? s.next_of_kin ?? null,
    p_programme: s.programmeId ?? null,
    p_status: s.status ?? 'admitted',
    p_year: s.year ? Number(s.year) : null,
    p_intake: s.intake ?? null,
    p_id_number: s.idNumber ?? s.id_number ?? null,
    p_campus: s.campus ?? null,
  })
  if (error) throw error
  return { ok: true, id: data }
}

export async function studentDelete(id) {
  if (!useHttp()) return { ok: true }
  const { error } = await supabase.rpc('student_archive', { p_student: id, p_status: 'inactive' })
  if (error) throw error
  return { ok: true }
}

export async function holdUpsert(h) {
  if (!useHttp()) return { ok: true, id: h.id ?? null }
  if (h.id) throw new Error('Hold updates are not supported. Clear the hold and create a new one.')
  const { data, error } = await supabase.rpc('hold_place', {
    p_student: h.studentId,
    p_type: h.type,
    p_reason: h.reason ?? null,
    p_blocks: h.blocks ?? [],
  })
  if (error) throw error
  return { ok: true, id: data }
}

export async function holdClear(id) {
  if (!useHttp()) return { ok: true }
  const { error } = await supabase.rpc('hold_clear', { p_hold: id })
  if (error) throw error
  return { ok: true }
}

// ---- Programmes / Courses / Courseware / Academics ----
export const programmeUpsert    = (p) => call('programme_upsert', { p_id: p.id ?? null, p_slug: p.slug ?? null, p_name: p.name, p_category: p.category ?? null, p_level: p.level ?? null, p_duration: p.duration ?? null, p_fee: p.fee ?? null, p_modes: p.modes ?? null, p_description: p.description ?? null })
export const programmeSetActive = (id, active) => call('programme_set_active', { p_id: id, p_active: active })
export const courseUpsert       = (c) => call('course_upsert', { p_id: c.id ?? null, p_code: c.code, p_title: c.title, p_programme: c.programmeId ?? null, p_credits: c.credits ?? 0, p_semester: c.semester ?? null, p_capacity: c.capacity ?? 0, p_lecturer: c.lecturerId ?? null })
export const courseDelete       = (id) => call('course_delete', { p_id: id })
export const listCourseware     = (courseId) => rows('courseware_list', { p_course: courseId })
export const coursewareUpsert   = (c) => call('courseware_upsert', { p_id: c.id ?? null, p_course: c.courseId, p_title: c.title, p_url: c.url ?? null })
export const coursewareDelete   = (id) => call('courseware_delete', { p_id: id })
export const listAtRisk         = () => rows('academics_at_risk')

// Staff options with uuid + staff_no + name (for pickers that persist by uuid).
export async function listStaffOptions() {
  if (!useHttp()) return []
  const { data, error } = await supabase.from('staff').select('id,staff_no,name').order('name')
  if (error) throw error
  return (data ?? []).map((s) => ({ uuid: s.id, staffNo: s.staff_no, name: s.name }))
}
