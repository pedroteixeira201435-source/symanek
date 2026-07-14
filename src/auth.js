// Auth seam for the Suite. In mock mode the app keeps its role-picker (no
// password) so the demo runs with no backend. In http mode this authenticates
// against Supabase, resolves the signed-in user's Suite role from their profile
// (profiles.suite_role + full_name), and RLS enforces what they can see/do.
import { supabase } from './supabaseClient.js'
import { ROLES } from './data.js'
import { API_MODE } from './config.js'

export const authMode = () =>
  API_MODE === 'http' || (typeof process !== 'undefined' && process.env && process.env.VITE_API_MODE === 'http')
export const authEnabled = () => authMode() && supabase !== null

// Merge the fine-grained Suite role definition with the person's real name so
// student modules keep joining on role.user.
function buildRole(suiteRole, fullName) {
  const base = ROLES.find((r) => r.id === suiteRole)
  if (!base) return null
  return { ...base, user: fullName || base.user }
}

async function roleFromSession() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: prof } = await supabase.from('profiles').select('suite_role,full_name').eq('id', user.id).maybeSingle()
  if (!prof) return null
  return buildRole(prof.suite_role, prof.full_name)
}

// Resolve the role from a persisted session (page reload). Null if not signed in.
export async function currentRole() {
  if (!authEnabled()) return null
  return roleFromSession()
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (error) return { ok: false, error: error.message }
  const role = await roleFromSession()
  if (!role) {
    await supabase.auth.signOut()
    return { ok: false, error: 'No workspace is assigned to this account.' }
  }
  return { ok: true, role }
}

export async function signOut() {
  if (authEnabled()) await supabase.auth.signOut()
}
