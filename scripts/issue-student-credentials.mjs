// issue-student-credentials — re-issue portal temporary passwords in bulk.
//
// The Suite's "Grant portal access" button shows a student's temporary password
// ONCE and never stores it (see supabase/functions/grant-student-access). When
// the admin needs to hand out a whole class at a time, this script resets each
// student's password to a fresh temporary one, re-arms must_reset_password, and
// prints the list so it can be pasted into the handout for the school admin.
//
// Resetting invalidates whatever password was issued before, so only run it for
// students who have NOT yet chosen their own: the script refuses any student
// with must_reset_password = false unless --force is passed.
//
// Usage (from the project root):
//   node scripts/issue-student-credentials.mjs BDOHSEM202602 BDOHSEM202603 ...
//   node scripts/issue-student-credentials.mjs --like 'BDOHSEM%'
//   node scripts/issue-student-credentials.mjs --like 'BDOHSEM%' --out creds.csv
//
// Reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from .env.codex-handoff.

import fs from "node:fs";
import crypto from "node:crypto";
import { authAdmin, env, rest } from "./supabase-rest.mjs";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};
const like = flag("--like");
const out = flag("--out");
const force = args.includes("--force");
const numbers = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));

if (!like && numbers.length === 0) {
  console.error("Nothing selected. Pass student numbers, or --like 'BDOHSEM%'.");
  process.exit(1);
}

// Same recipe as the Edge Function: 12 random chars from an alphabet without
// look-alikes (no 0/O, 1/l/I), because admins read these out over WhatsApp.
function tempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return "Sy" + Array.from(crypto.randomBytes(12), (n) => chars[n % chars.length]).join("") + "9!";
}

const cfg = env();
const select = "select=id,student_no,full_name,email,status,user_id";
const query = like
  ? `students?student_no=like.${encodeURIComponent(like)}&${select}&order=student_no.asc`
  : `students?student_no=in.(${numbers.join(",")})&${select}&order=student_no.asc`;

const students = await rest(cfg, query);
if (students.length === 0) {
  console.error("No student matched.");
  process.exit(1);
}

const issued = [];
for (const s of students) {
  const label = `${s.student_no} ${s.full_name}`;
  if (!s.user_id) {
    console.error(`skip  ${label} — no portal login yet (use "Grant portal access" in the Suite first)`);
    continue;
  }
  const [profile] = await rest(cfg, `profiles?id=eq.${s.user_id}&select=must_reset_password`);
  if (profile && profile.must_reset_password === false && !force) {
    console.error(`skip  ${label} — already chose their own password (pass --force to override)`);
    continue;
  }

  const password = tempPassword();
  await authAdmin(cfg, `/users/${s.user_id}`, { method: "PUT", body: { email: s.email.trim().toLowerCase(), password, email_confirm: true } });
  await rest(cfg, `profiles?id=eq.${s.user_id}`, { method: "PATCH", body: { must_reset_password: true } });
  issued.push({ student_no: s.student_no, full_name: s.full_name, email: s.email, password });
  console.error(`ok    ${label}`);
}

console.error(`\n${issued.length} credential(s) issued.\n`);

const header = "STUDENT NUMBER,FULL NAME,EMAIL (username),TEMPORARY PASSWORD";
const lines = issued.map((c) => `${c.student_no},"${c.full_name}",${c.email},${c.password}`);
const csv = [header, ...lines].join("\n");

if (out) {
  fs.writeFileSync(out, csv + "\n");
  console.error(`Written to ${out} — delete it once the passwords are handed out.`);
} else {
  console.log(csv);
}
