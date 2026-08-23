// Supabase browser client for the Suite. Null until env vars are set, so the app
// still runs in pure mock mode (API_MODE='mock'). Reads Vite env in the browser,
// falls back to process.env for Node (tests/SSR). Flip API_MODE='http' to use it.
import { createClient } from '@supabase/supabase-js'

const env = (k) =>
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[k]) ||
  (typeof process !== 'undefined' && process.env && process.env[k]) ||
  undefined

// Cloud fallback so a production build works without Vercel env vars. These are
// the PUBLIC (publishable) values — safe to ship in the browser bundle; RLS +
// SECURITY DEFINER RPCs enforce all access. Override with VITE_SUPABASE_* to
// point the Suite at another project (e.g. local Supabase in dev).
const CLOUD_URL = 'https://zbtxhyxwtemproeomtzu.supabase.co'
const CLOUD_ANON = 'sb_publishable_yGOmYZdogELoA4souInSsA_jx24j8dg'

const url = env('VITE_SUPABASE_URL') || CLOUD_URL
const anon = env('VITE_SUPABASE_ANON_KEY') || CLOUD_ANON

export const supabase = url && anon ? createClient(url, anon, { auth: { persistSession: true } }) : null
