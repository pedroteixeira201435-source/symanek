#!/usr/bin/env node
// ============================================================================
// Symanek — import students (new intake or a migration export) into the cloud.
//   • reads a CSV (the template in ./templates/new-students-template.csv) or the
//     legacy JSON roster (./students_real.json, the 2026-08-09 SYSPCO import)
//   • optionally creates an auth.users login for each student (GoTrue admin API)
//   • upserts profiles (role=student) and students (linked to programme + user)
//   • idempotent: safe to re-run; existing users/students are reused, not duped
//
// Uses plain fetch() against the GoTrue admin API + PostgREST — NO npm deps, so
// it runs on Node 18+ (avoids the supabase-js WebSocket requirement).
//
// Usage (run against the LIVE project — needs the service-role key):
//   SUPABASE_URL="https://zbtxhyxwtemproeomtzu.supabase.co" \
//   SERVICE_ROLE_KEY="<service-role-key>" \
//   node supabase/import/import_students.mjs --file supabase/import/entrada/jan-2027.csv [--dry-run] [--no-login]
//
//   --file      CSV or JSON to import (default: ./students_real.json)
//   --dry-run   validate the file offline (no network, nothing written)
//   --no-login  create the student records only; grant portal access later in
//               the Suite ("Grant portal access")
//
// A blank student_no is generated as <academic_year><5 digits> (the EduCIMS
// pattern, e.g. 202712345). New logins get a random temp password; the result
// of every row is written to ./saida/import-<timestamp>.csv (git-ignored).
// ============================================================================
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes, randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const NO_LOGIN = args.includes('--no-login');
const fileArg = args.includes('--file') ? args[args.indexOf('--file') + 1] : null;
const FILE = fileArg ? resolve(fileArg) : join(HERE, 'students_real.json');
const URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!DRY && (!URL || !KEY)) {
  console.error('Set SUPABASE_URL and SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

// ---------- reading the input ----------

// Minimal RFC-4180 parser; auto-detects "," vs ";" (Excel in some locales saves
// with ";") and strips the UTF-8 BOM Excel adds.
function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0];
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.some((v) => v.trim()));
  const keys = header.map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

// Normalise a CSV row (template columns) or a legacy JSON record to one shape.
function normalise(r, line) {
  const intake = (r.intake || '').toLowerCase();
  const status = (r.status || r.registration_status || '').toLowerCase();
  return {
    line,
    student_no: String(r.student_no || '').trim(),
    full_name: (r.full_name || '').replace(/\s+/g, ' ').trim(),
    email: (r.email || '').toLowerCase().trim(),
    phone: String(r.phone || '').trim() || null,
    id_number: String(r.id_number || '').trim() || null,
    next_of_kin: (r.next_of_kin || '').trim() || null,
    programme: (r.programme || r.programme_slug || '').trim(),
    intake: intake.startsWith('jan') ? 'january' : intake.startsWith('jul') ? 'july' : null,
    academic_year: Number(r.academic_year) || null,
    year: Number(r.year_of_study || r.year) || 1,
    campus: (r.campus || '').trim() || 'Main campus',
    status: status.startsWith('reg') || status.startsWith('enrol') ? 'enrolled' : 'admitted',
  };
}

function readInput() {
  const text = readFileSync(FILE, 'utf8');
  const raw = FILE.toLowerCase().endsWith('.json') ? JSON.parse(text) : parseCsv(text);
  // line = spreadsheet row number (header is row 1) so errors point at Excel rows
  return raw.map((r, i) => normalise(r, i + 2));
}

// Row checks that need no network. Returns a list of problems per row.
function validate(students) {
  const problems = [];
  const seenNo = new Set(), seenEmail = new Set();
  for (const s of students) {
    const p = [];
    if (!s.full_name) p.push('full_name is empty');
    if (!s.email) p.push('email is empty (needed for the login)');
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.email)) p.push(`email looks wrong: ${s.email}`);
    else if (seenEmail.has(s.email)) p.push(`email repeated: ${s.email}`);
    if (!s.programme) p.push('programme is empty');
    if (!s.intake) p.push('intake must be January or July');
    if (!s.academic_year) p.push('academic_year is empty');
    if (s.student_no && seenNo.has(s.student_no)) p.push(`student_no repeated: ${s.student_no}`);
    seenEmail.add(s.email); if (s.student_no) seenNo.add(s.student_no);
    if (p.length) problems.push({ line: s.line, name: s.full_name || '(no name)', p });
  }
  return problems;
}

// ---------- network ----------

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

const key = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function main() {
  const students = readInput();
  const problems = validate(students);

  if (DRY) return dryRun(students, problems);
  if (problems.length) {
    printProblems(problems);
    console.error('\nFix these rows first (nothing was imported).');
    process.exit(1);
  }

  // programme: accept the slug OR the full name as written on the website
  const progs = await rest('programmes?select=id,slug,name');
  const progByKey = new Map();
  progs.forEach((p) => { progByKey.set(key(p.slug), p.id); progByKey.set(key(p.name), p.id); });

  const inst = await rest(`institutions?select=id&name=eq.${encodeURIComponent('Symanek Specialized College')}`);
  const tenantId = inst?.[0]?.id ?? null;

  // existing student numbers, so generated ones never collide; a blank student_no
  // for an email already in the system reuses that student's number (safe re-run)
  const existing = await rest('students?select=reference,email');
  const usedNo = new Set(existing.map((r) => r.reference));
  const noByEmail = new Map(existing.map((r) => [(r.email || '').toLowerCase(), r.reference]));
  students.forEach((s) => s.student_no && usedNo.add(s.student_no));
  const newNo = (year) => {
    let n;
    do n = `${year}${String(randomInt(0, 100000)).padStart(5, '0')}`; while (usedNo.has(n));
    usedNo.add(n);
    return n;
  };

  // existing auth users: email -> id (paginate the GoTrue admin API)
  const userByEmail = new Map();
  if (!NO_LOGIN) {
    for (let page = 1; ; page++) {
      const res = await fetch(`${URL}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers: authHeaders });
      if (!res.ok) throw new Error(`listUsers: ${res.status} ${await res.text()}`);
      const j = await res.json();
      const arr = Array.isArray(j) ? j : j.users || [];
      arr.forEach((u) => u.email && userByEmail.set(u.email.toLowerCase(), u.id));
      if (arr.length < 1000) break;
    }
  }

  const out = [];
  let created = 0, reused = 0, upserts = 0, errors = 0;

  for (const s of students) {
    const rec = { student_no: s.student_no, full_name: s.full_name, email: s.email, temp_password: '', result: '' };
    out.push(rec);
    const programmeId = progByKey.get(key(s.programme));
    if (!programmeId) { rec.result = `ERROR programme not found: ${s.programme}`; errors++; continue; }
    if (!s.student_no) rec.student_no = s.student_no = noByEmail.get(s.email) || newNo(s.academic_year);

    // 1) auth user
    let userId = null;
    if (!NO_LOGIN) {
      userId = userByEmail.get(s.email);
      if (!userId) {
        const pw = tempPw();
        const res = await fetch(`${URL}/auth/v1/admin/users`, {
          method: 'POST', headers: authHeaders,
          body: JSON.stringify({ email: s.email, password: pw, email_confirm: true,
            user_metadata: { full_name: s.full_name, student_no: s.student_no } }),
        });
        if (!res.ok) { rec.result = `ERROR login: ${res.status} ${await res.text()}`; errors++; continue; }
        userId = (await res.json()).id;
        userByEmail.set(s.email, userId);
        rec.temp_password = pw;
        created++;
      } else reused++;

      try {
        await rest('profiles?on_conflict=id', { method: 'POST',
          prefer: 'resolution=merge-duplicates,return=minimal',
          body: { id: userId, full_name: s.full_name, role: 'student', suite_role: 'student',
            // a fresh temp password must be changed on first sign-in (App.jsx ForcePasswordChange)
            ...(rec.temp_password && { must_reset_password: true }) } });
      } catch (e) { rec.result = `ERROR profile: ${e.message}`; errors++; continue; }
    }

    // 2) student record (upsert on reference = student_no)
    try {
      const body = {
        reference: s.student_no, student_no: s.student_no, full_name: s.full_name,
        email: s.email, phone: s.phone, id_number: s.id_number, next_of_kin: s.next_of_kin,
        campus: s.campus, programme_id: programmeId, status: s.status,
        tenant_id: tenantId, year: s.year, intake: s.intake, academic_year: s.academic_year,
      };
      if (userId) body.user_id = userId; // --no-login never unlinks an existing login
      await rest('students?on_conflict=reference', { method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal', body });
      rec.result = 'OK';
      upserts++;
    } catch (e) { rec.result = `ERROR student: ${e.message}`; errors++; }
  }

  mkdirSync(join(HERE, 'saida'), { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const outFile = join(HERE, 'saida', `import-${stamp}.csv`);
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  writeFileSync(outFile, 'student_no,full_name,email,temp_password,result\n' +
    out.map((r) => [r.student_no, r.full_name, r.email, r.temp_password, r.result].map(q).join(',')).join('\n') + '\n');

  console.log('\n=== import summary ===');
  console.log(`students in file : ${students.length}`);
  console.log(`student records  : ${upserts}`);
  if (!NO_LOGIN) console.log(`logins created   : ${created}  (reused: ${reused})`);
  console.log(`errors           : ${errors}`);
  console.log(`result per row   : ${outFile}`);
}

function printProblems(problems) {
  for (const { line, name, p } of problems) console.log(`  row ${line} (${name}): ${p.join('; ')}`);
}

// --dry-run validates the file fully offline (no network).
function dryRun(students, problems) {
  const progs = new Set(students.map((s) => s.programme));
  console.log('=== dry-run (offline) ===');
  console.log(`file             : ${FILE}`);
  console.log(`students in file : ${students.length}`);
  console.log(`no student_no    : ${students.filter((s) => !s.student_no).length} (will be generated)`);
  console.log(`programmes       : ${[...progs].join(' | ')}`);
  if (problems.length) { console.log(`\n${problems.length} row(s) with problems:`); printProblems(problems); }
  else console.log('\nAll rows OK. (Programme names are checked against the database on the real run.)');
}

main().catch((e) => { console.error(e); process.exit(1); });
