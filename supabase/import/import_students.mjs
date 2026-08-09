#!/usr/bin/env node
// ============================================================================
// Symanek — import real registered students (2026-08-09 rosters) into the cloud.
//   • creates an auth.users login for each student (GoTrue admin API)
//   • upserts profiles (role=student) and students (linked to programme + user)
//   • idempotent: safe to re-run; existing users/students are reused, not duped
//
// Uses plain fetch() against the GoTrue admin API + PostgREST — NO npm deps, so
// it runs on Node 18+ (avoids the supabase-js WebSocket requirement).
//
// Source of truth: ./students_real.json (generated from the SYSPCO xlsx rosters;
//   one record per PERSON — a student who progressed L4->L5 is kept at L5).
//
// Usage (run against the LIVE project — needs the service-role key):
//   SUPABASE_URL="https://zbtxhyxwtemproeomtzu.supabase.co" \
//   SERVICE_ROLE_KEY="<service-role-key>" \
//   node supabase/import/import_students.mjs [--dry-run]
//
// New logins get a random temp password, written to ./students_credentials.csv
// (git-ignored). Distribute those, or have students use "forgot password".
// ============================================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes('--dry-run');
const URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SERVICE_ROLE_KEY;
if (!DRY && (!URL || !KEY)) {
  console.error('Set SUPABASE_URL and SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const students = JSON.parse(readFileSync(join(HERE, 'students_real.json'), 'utf8'));
const tempPw = () => randomBytes(9).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) + 'A1!';

const authHeaders = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function rest(path, { method = 'GET', body, prefer } = {}) {
  const headers = { ...authHeaders };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${URL}/rest/v1/${path}`, { method, headers, body: body && JSON.stringify(body) });
  if (!res.ok) throw new Error(`REST ${method} ${path}: ${res.status} ${await res.text()}`);
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

async function main() {
  if (DRY) return dryRun();

  // programme slug -> id
  const progs = await rest('programmes?select=id,slug');
  const progById = Object.fromEntries(progs.map((p) => [p.slug, p.id]));

  // institution (tenant) id
  const inst = await rest(`institutions?select=id&name=eq.${encodeURIComponent('Symanek Specialized College')}`);
  const tenantId = inst?.[0]?.id ?? null;

  // existing auth users: email -> id (paginate the GoTrue admin API)
  const userByEmail = new Map();
  for (let page = 1; ; page++) {
    const res = await fetch(`${URL}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers: authHeaders });
    if (!res.ok) throw new Error(`listUsers: ${res.status} ${await res.text()}`);
    const j = await res.json();
    const arr = Array.isArray(j) ? j : j.users || [];
    arr.forEach((u) => u.email && userByEmail.set(u.email.toLowerCase(), u.id));
    if (arr.length < 1000) break;
  }

  const created = [];
  let reused = 0, upserts = 0, skippedNoProg = 0, errors = 0;

  for (const s of students) {
    const email = (s.email || '').toLowerCase().trim();
    const programmeId = progById[s.programme_slug] || null;
    if (!programmeId) { console.warn(`! no programme for ${s.student_no} (${s.programme_slug})`); skippedNoProg++; }
    if (!email) { console.warn(`! no email for ${s.student_no} — skipped (needs a login email)`); errors++; continue; }

    // 1) auth user
    let userId = userByEmail.get(email);
    if (!userId) {
      const pw = tempPw();
      const res = await fetch(`${URL}/auth/v1/admin/users`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ email, password: pw, email_confirm: true,
          user_metadata: { full_name: s.full_name, student_no: s.student_no } }),
      });
      if (!res.ok) { console.error(`x createUser ${email}: ${res.status} ${await res.text()}`); errors++; continue; }
      userId = (await res.json()).id;
      userByEmail.set(email, userId);
      created.push({ ...s, email, password: pw });
    } else reused++;

    // 2) profile (upsert on id)
    try {
      await rest('profiles?on_conflict=id', { method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: { id: userId, full_name: s.full_name, role: 'student', suite_role: 'student' } });
    } catch (e) { console.error(`x profile ${email}: ${e.message}`); errors++; }

    // 3) student record (upsert on reference = student_no)
    try {
      await rest('students?on_conflict=reference', { method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: {
          reference: s.student_no, student_no: s.student_no, full_name: s.full_name,
          email, phone: s.phone || null, id_number: s.id_number || null,
          campus: s.campus || 'Main campus', programme_id: programmeId,
          status: (s.registration_status || '').toLowerCase().startsWith('reg') ? 'enrolled' : 'admitted',
          user_id: userId, tenant_id: tenantId, year: s.year || 1,
          intake: s.intake || null, academic_year: s.academic_year || null,
        } });
      upserts++;
    } catch (e) { console.error(`x student ${s.student_no}: ${e.message}`); errors++; }
  }

  if (created.length) {
    const csv = 'student_no,full_name,email,temp_password\n' +
      created.map((c) => `${c.student_no},"${c.full_name}",${c.email},${c.password}`).join('\n') + '\n';
    writeFileSync(join(HERE, 'students_credentials.csv'), csv);
  }

  console.log('\n=== import summary ===');
  console.log(`students in file : ${students.length}`);
  console.log(`logins created   : ${created.length}`);
  console.log(`logins reused    : ${reused}`);
  console.log(`student upserts  : ${upserts}`);
  console.log(`no-programme     : ${skippedNoProg}`);
  console.log(`errors           : ${errors}`);
  if (created.length) console.log('credentials written to supabase/import/students_credentials.csv');
}

// --dry-run validates the JSON + field mapping fully offline (no network).
function dryRun() {
  const seen = new Set();
  let noEmail = 0, noSlug = 0, dupRef = 0;
  const slugs = new Set();
  for (const s of students) {
    if (!s.email) noEmail++;
    if (!s.programme_slug) noSlug++;
    if (seen.has(s.student_no)) dupRef++; else seen.add(s.student_no);
    slugs.add(s.programme_slug);
    tempPw();
  }
  console.log('=== dry-run (offline) ===');
  console.log(`students in file : ${students.length}`);
  console.log(`unique student_no: ${seen.size}`);
  console.log(`missing email    : ${noEmail}`);
  console.log(`missing slug     : ${noSlug}`);
  console.log(`duplicate refs   : ${dupRef}`);
  console.log(`programme slugs  : ${[...slugs].join(', ')}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
