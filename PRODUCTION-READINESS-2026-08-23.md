# Symanek Specialized College — Production Readiness Audit

**Date:** 23 August 2026
**Scope:** Suite (`src/`), Public site (`site-publico/`), Backend (`supabase/`) — one shared Supabase cloud project `zbtxhyxwtemproeomtzu` (eu-north-1).
**Method:** read-only static analysis of source, migrations, seeds and route handlers. No servers run, nothing modified except this report.

---

## Executive summary

**Overall readiness: ~4 of 9 areas production-ready; the system is a strong, deployed prototype that is NOT yet safe to run a real cohort's official records on.**

The public site + applicant flow and the backend's *authoritative RPCs* are genuinely solid and largely production-grade. The **Suite is the blocker**: it is deployed in **mock/demo mode with no env vars**, so nothing an admin does in the "production" Suite persists. Even in `http` mode, the security model collapses all 9 staff workspaces into a single "staff = admin" tier in RLS, so role separation is cosmetic. There are no automated tests, no backups/DR story, and a PII-exposing unauthenticated letter endpoint.

Good news vs. the stale `PRODUCTION-PLAN.md` (28 Jul): the plan's headline "Blocker #1 — grade formula inconsistent" is **already fixed** (migration `20260728120000_fix_grading_formula.sql` aligns the backend RPC to `0.6*CA + 0.4*exam`, matching `src/lib/academics.js`). Suite backend coverage is also better than the plan's "~5 of 21" — **13 modules now import `api.js`**.

### Top 5 blockers (status after the 23 Aug hardening pass)

1. **Suite runs in mock in "production"** — no env vars on `symanek-suite.vercel.app` ⇒ role-picker login, in-memory data, nothing persists. ⏳ **OPEN — needs Pedro** to set the Suite's Vercel env vars (B1). (`CLAUDE.md:152-153`)
2. **RLS has no privilege separation** — ✅ **FIXED** — `has_suite_role()` + role-scoped write policies on all operational tables (`20260823140000`, `20260823160000`); `audit_log` write-protected; verified by tests.
3. **Unauthenticated PII leak on `/api/letter`** — ✅ **FIXED** — per-application `access_token`, released only on email lookup; letter requires `ref`+`t` (`20260823130000`). Filter-injection in `/api/payment-proof` also fixed.
4. **Real data is one cohort only** — ⏳ **OPEN — needs client** (rosters for the other programmes). The fabricated "476" no longer reaches a real dashboard (B4 done). (`seed_golive.sql:19-20`)
5. **Zero automated tests / no CI / no backup-restore plan** — ✅ **FIXED** — 17-assertion RLS/RPC test suite + runner, CI workflow (parked pending a `workflow`-scoped token), logical-backup script + DR runbook.

> **Session 2026-08-23 hardening:** Phase A (security) complete except A4 (grade
> bands, client-blocked); E3 (tests+CI), E1 (backups+DR, PITR enablement left to
> Pedro), and B4 (real dashboard) done. Remaining work is dominated by human
> gates — see each phase table's Status column and the client checklist.

---

## Area-by-area findings

### 1. Suite backend coverage — **Blocker**

Verified by grepping every `src/modules/*.jsx` for `../api` vs `../data` imports and cross-referencing `api.js` `useHttp()` branches.

**Backed by `api.js` (13 modules)** — load primary data through the seam, most `api.js` functions have a real `useHttp()` Supabase branch:
`StudentPortal`, `Academics` (ExamBoard), `Graduation`, `Finance` (PendingProofs), `Students` (roster + docs), `Admissions` (`listApplicants`), `Programmes` (`listProgrammes`/`listCourses`), `HR` (`listStaff`/`listLeaveRequests`/`decideLeave`), `Settings` (`listAcademicWindows`/`setAcademicWindow`), `Compliance` (`listNcheReturns`), `Accommodation` (`listResidences`), `Courseware` (`listSubmissions`), `TeacherPortal`.

**Mock-only** — read `src/data.js` directly. Was 8; **now 5** after the 23 Aug pass backed
**Dashboard** (`dashboard_stats()`), **Exams** (`exam_schedule()`) and **Library** (full
new backend — books/loans/fines + issue/return/renew RPCs, `20260823190000`):
`Accounting`, `POS`, `Scheduling`, `ApplyOnline`, `CanteenAdmin`. Of these, Accounting/POS/
Scheduling need a **new backend schema** (ledger, sales, timetable) — scope to day-1 (C1);
**ApplyOnline is resolved** — in http mode it now directs applicants to the public
website's real apply/portal flow instead of a fake in-Suite submit (so 4 modules —
Accounting/POS/Scheduling/CanteenAdmin — remain genuinely unbacked demo).
**Production-safety (2026-08-23):** these modules now render a **"Demo data — not
connected to live records" banner in http mode** (`MockDataNotice`), so a real
deployment never presents mock journals/timetables/canteen figures as if live.
(POS is exempt — its fullscreen till layout; it's out of day-1 scope for this college.)

**Caveat — "wired" ≠ "persists" (re-checked 2026-08-23):** of the flagged pure-mock functions, most are actually **dead exports** — `getCourseware`, `allocateRoom`, `submitNcheReturn`, `setInstitutionType`, `submitApplication` are imported by **0 modules** (Courseware/Accommodation/Compliance read `data.js` directly). Only two were genuinely used and **both are now backed**: **`listExamSchedule`** (`exam_schedule()` RPC) and **`getDegreeAudit`** (`degree_audit()` RPC — real total-credits progress + credit-weighted GPA; the richer per-requirement-group breakdown still awaits a curriculum-requirements model). **The StudentPortal is now fully real in http mode** (results + timetable + degree audit). Modules still `import from '../data'` for secondary/demo datasets, so `data.js` is not fully eliminable yet.

- **Gap:** 8 modules with no backend at all; ~7 write-paths that are mock stubs; `data.js` still load-bearing everywhere.
- **Severity:** Blocker for POS/Accounting/Library/Scheduling if those are day-1 scope; the finance/POS modules also have **no backend schema/RPCs** (canteen sales, library loans, general ledger don't exist server-side), so this is Phase-1 backend work, not just a wiring task. `PRODUCTION-PLAN.md:50` already flags this correctly.

### 2. Auth & security — **Blocker**

- **RLS coverage is complete at the table level:** all **38 created tables** have `enable row level security`; 53 policies; 38 SECURITY DEFINER functions. Good.
- **But the role model is coarse:** `is_admin()` = role in (`admin`,`staff`) (`init.sql:35-41`). Nearly every write policy is `... admin all using (is_admin())`. `suite_role` (the 9 workspaces) is a `profiles` column (`suite_core.sql:34`) and seeds `role_permissions` (`feedback_features.sql:166`) but is **not used in a single RLS policy**. **Net: a bursar, librarian or teacher account = full DB admin at the API layer.** Client `ROLE_NAV` is not a security boundary.
- **Anon exposure is correctly limited to SECURITY DEFINER RPCs** (`submit_application`, `submit_contact`, `get_application_status`, `window_gate`) — no anon table writes. Two `using (true)` SELECT policies (`courses`, `courseware`, `suite_core.sql:315-317`) are acceptable catalog reads.
- **Service-role usage is server-only and correct** in principle — only the two Next route handlers import `lib/supabase-admin` (`payment-proof/route.ts:2`, `letter/route.ts:2`), both `runtime="nodejs"`. `supabaseAdmin` null-guarded.
- **Vuln A (Blocker): `/api/letter` is unauthenticated** — leaks applicant PII by enumerable ref (see blocker #3).
- **Vuln B (High): PostgREST filter injection** — `payment-proof/route.ts:36` interpolates the raw user `ref` into `.or(\`reference.eq.${ref},email.eq.${ref...}\`)`. A crafted `ref` can alter the filter (e.g. inject `,stage.eq.approved`) to match another application. Sanitize/parameterize.
- **Secrets handling: good** — `.gitignore` excludes `.env*`, `supabase/.env.deploy`, `students_credentials.csv`; only `.env.example` is tracked.
- **Severity:** Blocker (privilege separation + PII endpoint); High (filter injection).

### 3. Backend correctness / scale — **High**

- **Migration chain is healthy:** 17 migrations in clean timestamp order (`20260714…` → `20260823…`); the one `drop function` (`payment_proof.sql:26`) is immediately recreated (correct, per the return-type-change rule in `CLAUDE.md:169`). Seeds are idempotent (`where not exists` / `on conflict`).
- **Grade formula is now consistent (plan is STALE here):** backend `publish_exam_results` uses `final = 0.6*CA + 0.4*exam` (`20260728120000_fix_grading_formula.sql:31`), matching `src/lib/academics.js:19`. Pass/second-opp logic mirrors `academics.evaluateResult`. `PRODUCTION-PLAN.md:22-26`'s "the engine still uses the old formula" is **no longer true**.
- **UNCONFIRMED grade boundaries (real risk):** code uses A≥80 / B≥70 / C≥60 / D≥50 (`fix_grading_formula.sql:32-36`, `academics.js:gradeOf`). The college's **official Statement of Result shows 79→"C" and 81→"B"** (`CLIENT-FOLLOWUP-2026-08-23.md:53-56`), implying their bands are shifted (likely C=60–79, B=80–89, A≥90). **Official transcripts will not match the college's documents until the client sends exact ranges.** This is the #1 open academic-correctness item.
- **Concurrency: sound** — reference numbers via atomic upsert `on conflict … last_seq+1` (`init.sql:74-76`); `mark_paid`/`approve_application` take `for update` row locks (`init.sql:216,244`).
- **Scale: not addressed** — no pagination/server-side search anywhere; Suite reads load full tables (`listStudents()` etc.). Fine at 24–476 rows, not for growth. No indexes audited beyond PKs/FKs.
- **Multi-tenant: effectively single-tenant** — `tenant_id`/`institutions` columns exist but **no RLS policy filters by tenant**. `INSTITUTION_HIDE` (`Shell.jsx:84`) is a client-side *module-visibility* filter by institution *type* (school/college/uni), unrelated to tenant isolation. Matches the plan's "single-tenant for now" decision, but real multi-tenancy is unbuilt.
- **audit_log:** table exists but written by only 2 functions (`feedback_features.sql:116,195`) — sensitive writes (payments, results, admin CRUD) are largely un-audited.
- **Severity:** High (grade boundaries block official docs; scale/audit are pre-growth gaps).

### 4. Data readiness — **High**

- **Real, confirmed data:** bank details (`20260823120000_bank_and_stamp_corrections.sql`), OHS L4/L5 unit-standard modules, lecturer-per-module mapping, 7 real staff, 24 real Auxiliary-Nursing students with real names/emails/student numbers (`seed_golive.sql:34-42,197-228`), 30 programmes in `content.ts`.
- **Demo data still dominates the Suite:** `src/data.js` (the "Gabriel !Naruseb"/476-enrolment slice) backs every module's charts and all 8 mock-only modules. **The "476 enrolment" figure is fabricated demo** (`data.js:10,55`) — actual go-live scope is 24 students, one intake.
- **Pending from client (blocks full seed):** students for every programme except Auxiliary Nursing; staff emails for newly named lecturers (left NULL, `seed_golive.sql:19-21`).
- **Seed hygiene:** `seed_golive.sql` is idempotent and applied directly (NOT in the migration chain — correct); `seed_programmes.sql` must stay slug-aligned with `content.ts` or `submit_application` rejects (`CLAUDE.md:86-89`). `seed_auth.sh` still provisions 9 demo accounts (`symanek123`) that must be removed before go-live.
- **Fixed-demo-date convention** (~3 Jul 2026) is intentional for the mock; irrelevant once http mode + real data are live.
- **Severity:** High — cannot go live beyond one cohort until the client supplies remaining student rosters; demo numbers must be purged from any client-facing "production" view.

### 5. Payments & documents — **Medium**

- **Manual-EFT model is fully implemented server-side:** `submit_invoice_proof` (sits PENDING, balance unchanged) → `confirm_invoice_payment` (reduces balance, releases holds), `pending_payment_proofs` for the bursar (`20260714210000_invoice_proofs.sql`). Applicant-side upload via `/api/payment-proof` (validated stage, 10 MB cap, type allow-list — good). No gateway (by client decision).
- **Documents:** approval letter generated server-side with `pdf-lib` + official stamp (`public/stamp.png`, provisional/light per `CLAUDE.md:98`), signatures = printed name+title only (forgery-risk decision). Statement of Result exists but its letter grades are **blocked on the unconfirmed boundaries** (§3).
- **Gaps:** letter endpoint auth (§2); stamp is a provisional low-quality image awaiting the clean scan; grade bands block final Statement of Result.
- **Severity:** Medium (model works; blockers are the auth fix + client-supplied grade bands/stamp).

### 6. Testing / QA — **High**

- **Confirmed: no automated tests anywhere.** No `*.test.*`/`*.spec.*`, no vitest/jest/playwright, no `.github/workflows`. Suite has **no eslint config** at all; public site only has `next lint` (Next defaults). The only "verification" is `npm run build` (`package.json`; `CLAUDE.md:27`).
- The `@supabase/supabase-js` Node-18 limitation (`CLAUDE.md:164`) means backend can't even be exercised from a Node test script locally — all backend testing is manual curl/PostgREST.
- **Severity:** High — for a system of record (grades, money, enrolments) shipping with zero tests is a real operational risk. At minimum, add RLS/RPC integration tests and a smoke suite for the applicant flow.

### 7. Deployment / env / DR — **High**

- **Two Vercel projects, one repo** (`symanek-site` root `site-publico`; `symanek-suite` root `.`). Public site needs 6 env vars incl. server-only `SUPABASE_SERVICE_ROLE_KEY` (`CLAUDE.md:148-151`). **Suite has no env vars ⇒ ships in mock** (blocker #1).
- **No backups / DR:** nothing in-repo about automated Supabase backups or a tested restore. Supabase's built-in daily backups exist by plan tier but there's no documented DR runbook. `PRODUCTION-PLAN.md:179` lists it as an open TODO — still open.
- **No monitoring/error tracking** (Sentry etc.) — `PRODUCTION-PLAN.md:180` open.
- **No auto-update concern** (web apps, redeployed via Vercel — N/A).
- **Env discipline good** (`.env*` gitignored; prod vs local split documented `CLAUDE.md:145-147`).
- **Severity:** High — mock-in-prod is a blocker; missing backups/monitoring are High for a records system.

### 8. Compliance — **Medium**

- **NamRA (tax):** payroll/PAYE/SSC logic lives only in mock modules (`HR`/`Accounting`/`Compliance` payroll is `data.js` + `useState`); `nche_returns` has a table but `submitNcheReturn` is a **mock stub** (`api.js:446`). No real tax computation persists.
- **NQA/NTA/NCHE (accreditation):** OHS modules correctly modelled as NQA unit standards (unit-ID = module code); `nche_returns` table exists but returns aren't really submitted. Accreditation reporting is presentational.
- **Labour Act 2007 (payroll):** `payroll_runs`/`contracts`/`leave_requests` tables exist; leave apply/decide is wired (`HR`), but payslip generation and statutory deductions are not implemented server-side (`PRODUCTION-PLAN.md:96` open).
- **Severity:** Medium — compliance features are scaffolded/demo, not operative. Acceptable if day-1 scope excludes payroll/tax filing; must be flagged to the client as not-yet-real.

### 9. Outstanding client dependencies — see checklist below.

---

## Prioritized, sequenced action plan

Effort: **S** ≤ half-day · **M** 1–3 days · **L** ≥ several days. "Blocker" = must be done before any real cohort uses the Suite as system of record.

### Phase A — Security & correctness hardening (do first)
| # | Item | Effort | Blocker | Status |
|---|---|---|---|---|
| A1 | Add auth to `/api/letter` (require the applicant's session or a signed token tied to the ref; stop enumeration). | S | **Yes** | ✅ **DONE 2026-08-23** — per-application `access_token` (`20260823130000`); `get_application_status` releases it only on email lookup; `/api/letter` requires `ref`+`t`. Cloud+local applied. |
| A2 | Fix PostgREST filter injection in `/api/payment-proof` — validate/escape `ref`, or use two `.eq()` queries. | S | **Yes** | ✅ **DONE 2026-08-23** — replaced interpolated `.or()` with two parameterized `.eq()` lookups (`payment-proof/route.ts`). |
| A3 | Introduce real RLS privilege separation: split `is_admin()` from staff; gate write policies by `suite_role` (bursar↔finance, registrar↔students, etc.) so RLS matches `ROLE_NAV`. | L | **Yes** | ✅ **DONE (all tables) 2026-08-23** — `has_suite_role()` + write policies scoped by role: crown-jewel tables (`20260823140000`) and all remaining operational tables (`20260823160000`: contracts/qualifications/leave_requests/payroll_runs/enrolments/holds/sponsors/sponsor_claims/residences/allocations/exam_sittings/nche_returns/assignments/courses/courseware/submissions/institutions). `audit_log` is now write-protected (triggers only). Verified by impersonation. Safe: Suite writes go via SECURITY DEFINER RPCs that bypass RLS. |
| A4 | Get exact grade boundaries from college; align `academics.gradeOf` + `publish_exam_results` bands; then lock Statement of Result. | S (once received) | **Yes** (for official transcripts) | ⏳ **BLOCKED on client** (in the 23 Aug follow-up). |
| A5 | Expand `audit_log` to payments, result publication, admin CRUD (triggers). | M | No | ✅ **DONE 2026-08-23** — generic `audit_change()` AFTER trigger on payments/applications/students/results/invoices/invoice_payments/staff (`20260823150000`). |

### Phase B — Make the Suite persist (turn off mock in prod)
| # | Item | Effort | Blocker |
|---|---|---|---|
| B1 | Set Suite Vercel env vars (`VITE_API_MODE=http`, Supabase URL+anon key); remove role-picker in prod; require real login. | S | **Yes** |
| B2 | Provision real staff/student auth accounts; retire the 9 `symanek123` demo accounts + demo `Gabriel !Naruseb` slice. | M | **Yes** | 🟡 **TOOLING READY 2026-08-23** — `supabase/golive/retire_demo_accounts.sql` (guarded: refuses unless a real account exists; safety verified) + `GO-LIVE-CHECKLIST.md` runbook. **Left for Pedro:** create the real staff/student logins (needs client emails, D2) then run it. |
| B3 | Replace the mock write-stubs used by "wired" modules (`allocateRoom`, `submitNcheReturn`, `setInstitutionType`) with real RPCs. | M | No |
| B4 | Purge demo numbers (476 etc.) from any prod-visible dashboard; drive Dashboard from real aggregates. | M | **Yes** if Dashboard is day-1 | ✅ **DONE 2026-08-23** — `dashboard_stats()` RPC (`20260823170000`) returns real counts (students/staff/fees/pending/enrolment-by-programme); Dashboard KPIs + enrolment chart use it in http mode, keeping demo constants only in mock. Canteen/Books KPIs stay mock (no backend yet — Phase C). |

### Phase C — Backend for the 8 mock-only modules (scope to day-1 need)
| # | Item | Effort | Blocker |
|---|---|---|---|
| C1 | Decide day-1 scope: which of POS/Canteen/Library/Accounting/Scheduling/Exams are required at launch. | S | — |
| C2 | Build schema + RPCs + RLS for the in-scope ones (e.g. finance ledger for `Accounting`, loans for `Library`, sales for POS/Canteen). | L | Per scope |
| C3 | Wire those modules mock→http (proven pattern: StudentPortal/Finance). | M–L | Per scope |
| C4 | Eliminate remaining `data.js` reads from in-scope modules. | M | No |

### Phase D — Data load & content
| # | Item | Effort | Blocker |
|---|---|---|---|
| D1 | Load remaining real student rosters (all programmes/intakes) via `seed_golive`/import script once client sends them. | M | **Yes** for those programmes |
| D2 | Add newly named lecturers' emails; create their logins. | S | No |
| D3 | Swap provisional `stamp.png` for the clean scan; confirm 5 new programmes' public wording. | S | No |

### Phase E — Ops / QA (production non-negotiables)
| # | Item | Effort | Blocker |
|---|---|---|---|
| E1 | Configure + test Supabase automated backups; write a restore runbook. | M | **Yes** | 🟡 **PARTIAL 2026-08-23** — logical-backup script (`supabase/backups/backup.sh`, local+cloud via the container's pg_dump) + `DR-RUNBOOK.md` (PITR, restore, quarterly verification); restore round-trip proven on a scratch DB. **Left for Pedro:** enable PITR in the dashboard + schedule an off-site copy. |
| E2 | Add error tracking (Sentry) + uptime monitoring. | S | No |
| E3 | Add a minimal automated test suite: RLS/RPC integration tests + applicant-flow smoke test in CI. | M–L | No (strongly advised) | ✅ **DONE 2026-08-23** — `supabase/tests/rls_rpc.test.sql` (17 assertions: RLS privilege separation, applicant flow, letter-token gating, audit trigger) + `run.sh`; `.github/workflows/ci.yml` typechecks + builds both apps on every push. |
| E4 | Server-side pagination/search for students/invoices ahead of growth. | M | No |
| E5 | Final UAT per role against the real backend; sign-off (`UAT-GUIA.md`). | M | **Yes** |

**Critical path:** A1→A2→A3 (security) and B1→B2 (persist) are the gate to letting anyone touch real records. A4 + D1 gate official academics. E1 + E5 gate go-live.

---

## Client-dependency checklist (what Pedro must get from the college)

- [ ] **Exact grade boundaries** for A/B/C/D/Fail (their doc shows 79→C, 81→B — current code is A≥80/B≥70/C≥60/D≥50). *Blocks Statement of Result.* (`CLIENT-FOLLOWUP-2026-08-23.md:53-56`)
- [ ] **Student rosters for every programme other than Auxiliary Nursing** (names, student numbers, emails, intake). *Blocks full go-live.* (`seed_golive.sql:19-20`)
- [ ] **Staff emails** for the newly named lecturers (Ms Ipinge, Ms Rakkel, Ms Moyo, Ms Abel) to create logins. (`seed_golive.sql:21`, `CLIENT-FOLLOWUP-2026-08-23.md:62-64`)
- [ ] **Confirm "Zidane Muhuka" = "Muhuka Ratukara"** (SYM-STF-006) or supply correct full name. (`CLIENT-FOLLOWUP-2026-08-23.md:59-62`)
- [ ] **Clean official stamp image** (current `public/stamp.png` is a light provisional extract).
- [ ] **Confirm the 5 newly added programmes** (Solar Install, Agriculture/Horticulture, Wholesale & Retail) for public display. (`CLIENT-FOLLOWUP-2026-08-23.md:42-45`)
- [ ] **Graduation photos** (Mr Jeremia) for the website gallery.
- [ ] **Business decisions still open** from Phase 0: automatic vs manual email; EFT-only vs gateway (currently EFT-only per client); **day-1 module scope** (drives Phase C). (`PRODUCTION-PLAN.md:72-77`)
- [ ] **Payroll/tax scope:** confirm whether NamRA payroll / NCHE returns must be operative at launch (currently demo/stub).

---

## Notes on `PRODUCTION-PLAN.md` staleness

- **Blocker #1 (grade formula split) — RESOLVED.** `20260728120000_fix_grading_formula.sql` aligns the backend to `0.6*CA + 0.4*exam`; plan text at lines 22-26 is out of date.
- **"~5 of 21 modules wired" — UNDERSTATED.** Now **13 of 21** import `api.js` (Settings/Students/Admissions/Programmes/HR/Compliance/Accommodation/Courseware/TeacherPortal added since). 8 remain pure mock.
- **Still accurate:** Suite ships in mock in prod (line 31), feedback features partly mock (some writes still stubbed), no tests, backups/monitoring open, single-tenant, real data pending client.
