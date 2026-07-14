// Supabase browser client for the Suite. Null until env vars are set, so the app
// still runs in pure mock mode (API_MODE='mock'). Reads Vite env in the browser,
// falls back to process.env for Node (tests/SSR). Flip API_MODE='http' to use it.
import { createClient } from '@supabase/supabase-js'

const env = (k) =>
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[k]) ||
  (typeof process !== 'undefined' && process.env && process.env[k]) ||
  undefined

const url = env('VITE_SUPABASE_URL')
const anon = env('VITE_SUPABASE_ANON_KEY')

export const supabase = url && anon ? createClient(url, anon, { auth: { persistSession: true } }) : null
