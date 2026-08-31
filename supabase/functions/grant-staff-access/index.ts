// grant-staff-access — admin-only provisioning of a STAFF Suite login.
//
// Mirrors grant-student-access. The browser cannot create auth.users (that needs
// the service_role key, which bypasses RLS and must never ship to the client),
// so the Suite calls this Edge Function: it (1) verifies the caller is an admin
// using THEIR JWT, then (2) with the service_role key creates the staff auth user
// with a temporary password and links it via link_staff_account(). The staff row
// is only an HR record until this runs — a profiles.suite_role IS the approval.
// Credentials are returned to the admin once and never stored in plaintext.
//
// Deploy: supabase functions deploy grant-staff-access
// The Supabase-hosted runtime injects SUPABASE_URL / SUPABASE_ANON_KEY /
// SUPABASE_SERVICE_ROLE_KEY automatically.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  // supabase-js also sends x-client-info and apikey on invoke(); they must be
  // allowed or the browser preflight fails ("Failed to send a request").
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Allowed staff workspaces (keep in sync with the DB is_staff_suite_role()).
const STAFF_ROLES = ['admin', 'bursar', 'hr', 'teacher', 'seller', 'librarian', 'registrar']

// 12+ chars, cryptographically random, mixed classes.
function tempPassword(): string {
  const b = crypto.getRandomValues(new Uint8Array(9))
  return 'Sy' + btoa(String.fromCharCode(...b)).replace(/[+/=]/g, 'x') + '9!'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' })

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''

    // (a) verify the caller is authenticated AND an admin, using their JWT.
    const asCaller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: uErr } = await asCaller.auth.getUser()
    if (uErr || !user) return json(401, { error: 'not authenticated' })
    const { data: prof } = await asCaller.from('profiles')
      .select('role,suite_role').eq('id', user.id).maybeSingle()
    const isAdmin = !!prof && (prof.role === 'admin' || prof.suite_role === 'admin')
    if (!isAdmin) return json(403, { error: 'admin only' })

    const { staff_id, suite_role, action } = await req.json().catch(() => ({}))
    if (!staff_id) return json(400, { error: 'staff_id required' })

    // service client — bypasses RLS, holds the secret key (never sent to browser).
    const admin = createClient(url, service, { auth: { persistSession: false } })

    // ---- revoke: deactivate the login and hard-delete the orphaned auth user ----
    if (action === 'revoke') {
      const { data: uid, error: dErr } = await admin.rpc('deactivate_staff_account', { p_staff: staff_id })
      if (dErr) return json(400, { error: dErr.message })
      if (uid) await admin.auth.admin.deleteUser(uid as string)
      return json(200, { ok: true, revoked: !!uid })
    }

    // ---- grant: create the login and link it ----
    if (!STAFF_ROLES.includes(suite_role)) return json(400, { error: 'invalid suite_role' })

    // (b) load the staff record; must have an email and no existing login.
    const { data: s } = await admin.from('staff')
      .select('id,name,email,user_id').eq('id', staff_id).maybeSingle()
    if (!s) return json(404, { error: 'staff not found' })
    if (!s.email) return json(422, { error: 'staff has no email on file' })
    if (s.user_id) return json(409, { error: 'login already granted' })

    // (c) create the auth user with a temporary password, email pre-confirmed.
    const password = tempPassword()
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: s.email, password, email_confirm: true,
      user_metadata: { full_name: s.name },
    })
    if (cErr || !created?.user) return json(400, { error: cErr?.message ?? 'createUser failed' })

    // (d) link staff + seed profile with the chosen suite_role (must_reset_password).
    const { error: lErr } = await admin.rpc('link_staff_account', {
      p_staff: s.id, p_user: created.user.id, p_suite_role: suite_role, p_full_name: s.name,
    })
    if (lErr) {
      // best-effort rollback of the orphan auth user
      await admin.auth.admin.deleteUser(created.user.id)
      return json(400, { error: lErr.message })
    }

    // (e) return credentials to the admin (shown once).
    return json(200, { email: s.email, password, suite_role })
  } catch (e) {
    return json(500, { error: String((e as Error)?.message ?? e) })
  }
})
