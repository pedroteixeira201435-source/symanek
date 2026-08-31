// grant-student-access — admin-only provisioning of a student portal login.
//
// The browser cannot create auth.users (that needs the service_role key, which
// bypasses RLS and must never ship to the client). So the Suite calls this
// Edge Function: it (1) verifies the caller is an admin using THEIR JWT, then
// (2) with the service_role key creates the student's auth user with a temporary
// password and links it via link_student_account(). Credentials are returned to
// the admin once and never stored in plaintext.
//
// Deploy: supabase functions deploy grant-student-access
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

    const { student_id, reset } = await req.json().catch(() => ({}))
    if (!student_id) return json(400, { error: 'student_id required' })

    // service client — bypasses RLS, holds the secret key (never sent to browser).
    const admin = createClient(url, service, { auth: { persistSession: false } })

    // (b) load the student; must be enrolled.
    const { data: s } = await admin.from('students')
      .select('id,full_name,email,status,user_id').eq('id', student_id).maybeSingle()
    if (!s) return json(404, { error: 'student not found' })
    if (!s.email) return json(422, { error: 'student has no email on file' })
    if (s.status !== 'enrolled') return json(409, { error: 'student is not enrolled yet' })

    // Already has a login: refuse unless the admin explicitly asked to reset it
    // (e.g. the student lost their temporary password). `code` lets the UI offer
    // a one-click reset instead of a dead end.
    if (s.user_id && !reset) return json(409, { error: 'portal access already granted', code: 'already_granted' })
    if (s.user_id && reset) {
      const password = tempPassword()
      const { error: rErr } = await admin.auth.admin.updateUserById(s.user_id, { password, email_confirm: true })
      if (rErr) return json(400, { error: rErr.message })
      // force the student to choose a new password again on next sign-in
      await admin.from('profiles').update({ must_reset_password: true }).eq('id', s.user_id)
      return json(200, { email: s.email, password, reset: true })
    }

    // (c) create the auth user with a temporary password, email pre-confirmed.
    const password = tempPassword()
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: s.email, password, email_confirm: true,
      user_metadata: { full_name: s.full_name },
    })
    if (cErr || !created?.user) return json(400, { error: cErr?.message ?? 'createUser failed' })

    // (d) link student + seed profile as STUDENT (must_reset_password = true).
    const { error: lErr } = await admin.rpc('link_student_account', {
      p_student: s.id, p_user: created.user.id, p_full_name: s.full_name,
    })
    if (lErr) {
      // best-effort rollback of the orphan auth user
      await admin.auth.admin.deleteUser(created.user.id)
      return json(400, { error: lErr.message })
    }

    // (e) return credentials to the admin (shown once).
    return json(200, { email: s.email, password })
  } catch (e) {
    return json(500, { error: String((e as Error)?.message ?? e) })
  }
})
