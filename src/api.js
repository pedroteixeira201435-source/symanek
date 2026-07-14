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
export const listStudents = () => mock(db.LEARNERS)
export const getStudent = (id) => mock(db.LEARNERS.find((s) => s.id === id) || null)

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

export const getDegreeAudit = (studentName) => mock(db.DEGREE_AUDIT[studentName] || null)

// Reads wired to the backend (mapped back to the mock-compatible shapes the
// modules already consume). Others follow the same pattern in later B2 passes.
export async function getInvoicesForStudent(studentName) {
  if (useHttp()) {
    const sid = await studentIdByName(studentName)
    if (!sid) return []
    const { data, error } = await supabase.from('invoices')
      .select('id,amount,balance,due,status').eq('student_id', sid)
    if (error) throw error
    return (data ?? []).map((i) => ({
      id: i.id, learner: studentName, amount: Number(i.amount), balance: Number(i.balance),
      due: i.due, status: i.status[0].toUpperCase() + i.status.slice(1),
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
      return [{ code: e.courses?.code, ca: Number(r.ca), exam: Number(r.exam), final: Number(r.final), grade: r.grade }]
    })
  }
  return mock(Object.entries(db.COURSE_RESULTS).flatMap(([code, rows]) =>
    rows.filter((r) => r.learner === studentName).map((r) => ({ code, ...r }))))
}

export const listGraduands = () => mock(db.GRADUANDS)
export const listExamSchedule = () => mock(db.EXAM_SCHEDULE)

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
export const listApplicants = () => mock(db.APPLICANTS)
export const listResidences = () => mock(db.RESIDENCES)
export const listNcheReturns = () => mock(db.NCHE_RETURNS)
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
export const submitAssignment = ({ studentId, assignmentId }) => mock({ ok: true, studentId, assignmentId, at: Date.now() })
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

// ============================ AUTH / SESSION ============================
// Phase 1: pick a role card (no password). Phase 2: real credentials + JWT/session,
// with RBAC enforced server-side (see BACKEND.md), not by hiding nav items.
export const login = ({ roleId }) => mock({ ok: true, role: db.ROLES.find((r) => r.id === roleId) || null, tenant: TENANT })
export const currentSession = () => mock({ tenant: TENANT, mode: API_MODE })
