// Runtime configuration — the single switch between the mock prototype and a real backend.
// `VITE_API_MODE` wins if set. Otherwise: PRODUCTION builds default to 'http' (the
// backend is live on Supabase — see supabaseClient.js cloud fallback), while local
// dev defaults to 'mock' so the demo/UAT experience is preserved without a backend.
const _env = (typeof import.meta !== 'undefined' && import.meta.env) || {}
export const API_MODE = _env.VITE_API_MODE || (_env.PROD ? 'http' : 'mock')
export const API_BASE = (import.meta.env && import.meta.env.VITE_API_BASE) || '/api'

// Multi-tenant: every request is scoped to one institution. In Phase 2 this comes
// from the subdomain or the authenticated session, not a constant.
export const TENANT = (import.meta.env && import.meta.env.VITE_TENANT) || 'symanek'

// Day-one Suite scope. Everything outside this set stays unavailable in the
// real backend deployment until it has its own data migration and signed UAT.
export const PRODUCTION_CORE_MODULES = new Set([
  'dashboard', 'students', 'academics', 'admissions', 'programmes',
  'exams', 'graduation', 'finance', 'teacher', 'portal',
])
