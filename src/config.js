// Runtime configuration — the single switch between the mock prototype and a real backend.
// Phase 1 (now): API_MODE = 'mock' — api.js returns the in-memory data in data.js.
// Phase 2 (backend): set API_MODE = 'http' (or VITE_API_MODE=http) — api.js calls fetch(API_BASE/...).
export const API_MODE = (import.meta.env && import.meta.env.VITE_API_MODE) || 'mock'
export const API_BASE = (import.meta.env && import.meta.env.VITE_API_BASE) || '/api'

// Multi-tenant: every request is scoped to one institution. In Phase 2 this comes
// from the subdomain or the authenticated session, not a constant.
export const TENANT = (import.meta.env && import.meta.env.VITE_TENANT) || 'symanek'
