# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **monorepo for Symanek Specialized College** (private Namibian higher-ed) with three parts that
**share one Supabase backend**:

1. **Symanek Suite** (repo root, `src/`) — a **Vite + React** internal management SaaS: student
   portal, admissions, NQF programmes, exam board, degree audit, graduation/clearance, finance,
   HR/payroll, accommodation, LMS, library, canteen POS, and Namibian tax/compliance.
2. **Public site** (`site-publico/`) — a **Next.js 14** marketing site rebuilding symanekacademy.com
   plus the applicant flow `apply → approve → EFT proof → mark paid → enrolled`.
3. **Backend** (`supabase/`) — Postgres schema, RLS, auth, storage, and **server-authoritative RPCs**,
   shared by both apps. **Live on the cloud project `zbtxhyxwtemproeomtzu`** (region eu-north-1).

> **Phase 2 is DONE, not a future boundary.** Older comments (and `BACKEND.md`) describe Phase 2 as
> "not yet built" — that is stale. Auth, RLS, and the write RPCs exist and are deployed. When you see
> "mock only / no backend" in a comment, verify against the current code before trusting it.

> **Mock-elimination / "empty-by-default" pass — DONE (2026-08-24).** Production carries ZERO mock data:
> every module reads/writes the real backend, starting empty and populated through CRUD forms. All the
> migrations below are **APPLIED to the cloud** (tracker in sync through `20260928130000`).
> - **`src/data.js` is DELETED.** Import formatting/logic from `src/lib/*`: `format.js` (`fmtN`,
>   `staffEmail`), `academics.js` (`gradeOf`, editable grade bands via `setGradeBands`), `institution.js`
>   (`SCHOOL`, `INSTITUTION_HIDE`, `getInstType`). Never reference `data.js` — it no longer exists.
> - **Every domain has a backend + CRUD RPCs** (`20260824130000`…`230000`): library, HR/payroll, finance,
>   accounting (assets/VAT), canteen/POS, scheduling, accommodation, compliance, dashboard aggregates,
>   programmes/courses/courseware. Writes are `SECURITY DEFINER` + RLS-gated by `suite_role`.
> - **Sensitive writes go ONLY through RPCs, never raw client DML.** Hardening RPCs (`20260824233000`):
>   `reject_application`, `student_upsert`, `student_archive`, `hold_place`, `hold_clear` (+ `staff_upsert`,
>   `mark_paid`/`pay_invoice`). **Enforced at the DB by `20260824235000`**: on `students`/`staff`/`payments`
>   the write policies are now **SELECT-only** and direct INSERT/UPDATE/DELETE is **revoked** from
>   `authenticated`/`anon` — so a raw client write is denied to **every** role (even the domain owner and
>   admin), while the `SECURITY DEFINER` RPCs still write (they run as owner, bypassing RLS). Reads are
>   preserved. The rls-rpc test asserts exactly this (raw write blocked; RPC write-path proven via
>   `approve_application`/`mark_paid`).
> - **`course_set_capacity`** (`20260824234000`): admins set real course capacities in Programmes → Course
>   Catalogue (touches only `capacity`, never programme/lecturer). Reference the finished module pattern
>   here (filter + inline-edit + batch save) in `src/modules/Programmes.jsx` `Catalogue`.
> - **`business_settings`** (`20260824140000`): editable business rules (grade bands, assessment weights,
>   PAYE/SSC/VET, VAT, currency) via `get_business_settings()` / `set_business_setting()`; `App.jsx` mirrors
>   the bands via `setGradeBands()` at boot. Edit in Settings → Business rules.
> - **`20260824130000_purge_demo_slice.sql`** (applied) deleted the Gabriel !Naruseb / `suite-demo` slice
>   from the cloud. `supabase/seed_golive_enrolments.sql` exists but was **not** applied (cloud had 0
>   enrolments on 2026-09-27) — enrol classes with **Programmes → Cohort Enrolment** (`enrol_cohort`) instead.
> - **`src/api.js`** has one function per dataset. In **http** they hit the RPC; in **mock** they return
>   `[]`/`null` (no fabricated data reaches production). Helpers `rows()/one()/call()` wrap the CRUD RPCs.
> - **All modules migrated** to `useEffect`+`api` with loading/empty-states and Add/Edit/Delete `Modal`
>   forms. Reference the finished pattern in `Accommodation.jsx`, `Library.jsx`, `Programmes.jsx`.

## Commands

```bash
# Suite (repo root) — Vite 5, Node 18 (do NOT bump Vite; v6+ needs Node 20)
npm run dev                      # dev server (mock mode by default)
npm run build                    # production build = the verification step (no JS tests/lint configured)
./supabase/tests/run.sh          # backend RLS/RPC tests (one SQL file, rolled back) — needs `supabase start`
                                 # + seed_auth.sh + seed programmes; no per-test runner, exit 0 = all pass
node --check src/api.js          # syntax-check an ESM module (copy to /tmp/x.mjs if node treats .js as CJS)

# Public site
cd site-publico && npm run dev   # dev (uses .env.local → local Supabase)
cd site-publico && npm run build # prod build (uses .env.production.local → CLOUD); 70+ static pages
cd site-publico && npm run start # serve the production build

# Supabase (invoked via npx; the CLI is not on PATH)
npx supabase status
npx supabase db push             # apply migrations to the LINKED cloud project (needs SUPABASE_ACCESS_TOKEN)

# Validation + cloud-apply scripts (Node ESM in scripts/; read $VALIDATION_ENV or .env.codex-handoff)
npm run validate:supabase        # E2E vs cloud: admission→payment→access→registration→holds (self-cleans)
npm run validate:uat-core        # core UAT flow + public site
npm run validate:public-site     # public API routes against the LIVE site
npm run apply:migration -- <sql> # apply one migration via `pg` + Session pooler (needs SUPABASE_DB_PASSWORD)
npm run apply:course-capacities  # bulk-set capacities from supabase/templates/course-capacities.csv
npm run cleanup:codex-test-data  # delete codex.* / test rows

# Bulk student import (new intake / EduCIMS migration) — CSV template or legacy JSON, no npm deps
node supabase/import/import_students.mjs --dry-run --file supabase/import/entrada/<file>.csv   # offline check
set -a; . ./.env.codex-handoff; set +a
node supabase/import/import_students.mjs --file supabase/import/entrada/<file>.csv [--no-login]

# Vercel — Suite, from the repo root, using the CLI's own login (`npx vercel login`).
# Do NOT source .env.codex-handoff first: its VERCEL_TOKEN lost access to the team scope
# (2026-09-27), and its VERCEL_ORG_ID without VERCEL_PROJECT_ID makes the CLI abort.
npx --yes vercel --prod --yes
# confirm the new bundle is live: grep the served /assets/index-*.js for a new identifier
```

- The repo path contains a space (`…/symanek college`) — **quote it** in every shell command.
- Deep-link any Suite role via URL hash in mock mode: `#admin`, `#bursar`, `#hr`, `#teacher`,
  `#seller`, `#librarian`, `#student`, `#registrar`, `#applicant` (and `#admin/accounting`).

## The data-access seam (the core architecture)

Both apps talk to the backend **only through a seam** that switches between a local mock and Supabase,
so UI components never change when flipping backends:

- **Suite**: `src/config.js` (`API_MODE`), `src/api.js` (every read/write), `src/supabaseClient.js`.
  Flip with `VITE_API_MODE=mock|http`. Each `api.js` function has a `useHttp()` branch (Supabase) and
  a `mock()` branch that now returns `[]`/`null` (`data.js` is deleted); the http branch **maps DB rows
  back to the exact shapes the modules expect**.
- **Public site**: `lib/api.ts` (`API_MODE`), `lib/supabase.ts` (browser client), `lib/supabase-admin.ts`
  (server-only service-role client — never import into a Client Component). Flip with
  `NEXT_PUBLIC_API_MODE=mock|supabase`.

When migrating a Suite module from mock to backend: convert its top-level **synchronous `data.js`
reads into an async `useEffect` load via `api.js`**, keep the same prop/`ctx` shape so child components
are untouched, and add loading/error state. **This pass is complete for every module** (see the callout
above): each module loads through `api.js`, renders empty-states, and offers Add/Edit/Delete forms.
Reference examples: `Graduation.jsx`, `Library.jsx`, `Accounting.jsx`, `Accommodation.jsx`, `Programmes.jsx`.
**For demo/UAT the Suite still runs in mock**, but in mock the seam returns empty, so exercise new work in
**http** against a Supabase (local or cloud).

## Backend (`supabase/`)

- **Migrations** `supabase/migrations/*.sql` — schema, RLS, and RPCs. Applied in timestamp order.
- **Auth model**: `profiles.role` (coarse: `admin|staff|student|applicant`, drives `is_admin()` and RLS)
  **plus** `profiles.suite_role` (fine: the 9 Suite workspaces). `src/auth.js` resolves the signed-in
  user's Suite role from their profile; `App.jsx` shows `EmailLogin` in http mode, the role-picker in
  mock. Students are linked to their record via `students.user_id` (enables RLS owner-reads).
  - **Provisioning a login (current model, migration `20260830140000`, replaces the old `staff_access`
    table):** create the user natively in **Supabase → Authentication → Add user** (Auto Confirm); a
    trigger mints an **empty** profile (no access). Then set **`profiles.suite_role`** in the Table
    Editor — a trigger derives `role` from it (`admin`→admin, the staff roles→staff). **Only ever edit
    `suite_role`, never `role`.** Students/staff are usually provisioned instead via the Suite:
    **Students → Student 360 → "Grant portal access"** and **Programmes → Lecturers → "Grant Suite access"**
    (the edge functions below). A login created outside these paths is **not linked** to its
    `students`/`staff` row (`user_id` null) — a lecturer then sees no modules, and "Grant" refuses with
    "already registered". `is_admin()` = `role in (admin,staff)`.
  - **Gotcha (fixed): the login role-check must filter to the caller's own profile row.** RLS is
    `profiles: id = auth.uid() OR is_admin()`, so an admin can read *every* profile — an unfiltered
    `.select('role').maybeSingle()` returns multiple rows once a 2nd admin exists and wrongly rejects the
    login. Always `.eq('id', user.id)` (both `src/auth.js` and `site-publico/lib/api.ts` do this now).
  - **The student portal IS the Suite** (there is no separate student app): a `student` logs into
    `symanek-suite.vercel.app` and `ROLE_NAV`/`PRODUCTION_CORE_MODULES` show them only the `portal`
    module. The public site's "Enter Student Portal" button points to `college.studentPortalUrl`
    (`site-publico/lib/content.ts`) = the Suite; the former external **EduCIMS** LMS is deprecated.
- **Server-authoritative rules are RPCs, not client logic** (SECURITY DEFINER, resolve the actor via
  `auth.uid()`): `register_course` (holds → prereq → credit-cap → capacity/waitlist → charge),
  `pay_invoice` (records payment, reduces balance, **auto-releases financial holds** when cleared),
  `graduation_clearance`/`issue_certificate` (finance+library+academic, gated), `publish_exam_results`
  (`final = 0.6*CA + 0.4*exam`, locks marks — RLS blocks editing a published result), `graduation_board`.
  **Manual-EFT proof model** (no gateway): `submit_invoice_proof` (student, sits PENDING, balance
  unchanged) → `confirm_invoice_payment` (staff → reduces balance + releases holds); `pending_payment_proofs`
  lists them for the bursar (Suite `Finance → Payments`).
  Public/anon RPCs: `submit_application`, `submit_contact`, `get_application_status`, and admin
  `approve_application`/`mark_paid`.
- **Storage buckets** (private): `approval-letters` (generated PDFs), `application-docs`,
  `payment-proofs` (applicant EFT proofs). Uploads/signing happen server-side via the service role.
- **Seeds**: `seed_programmes.sql` (auto-generated from `site-publico/lib/content.ts` via
  `site-publico/scripts/gen-seed.ts` — slugs MUST match or `submit_application` rejects; regenerate after
  editing programmes, don't hand-edit), `seed.sql`, `seed_suite.sql` (demo slice around student
  **Gabriel !Naruseb**, CVT-4), `seed_golive.sql` (**REAL** go-live data — staff, the OHS L4/L5
  NQA unit-standard modules with unit-ID codes, lecturer-per-module mapping, Auxiliary roster; idempotent,
  applied directly, NOT in the migration chain), `seed_auth.sh` (9 demo accounts, password `symanek123`).
  `db push` does NOT run seed files — they are bundled into a migration for cloud, or applied directly.

### Classroom loop: lecturer ↔ student (`20260927120000`, `20260928120000`, `20260928130000`, `20261002120000`)

- **Lecturer scoping is server-side.** `my_staff_id()` = the `staff` row whose `user_id = auth.uid()`;
  `can_teach(course)` = registrar/admin, or `courses.lecturer_staff_id = my_staff_id()`. Every lecturer RPC
  (`course_marksheet`, `save_course_marks`, `publish_course_results`, `record_attendance_session`,
  `course_attendance`, `grade_submission`, `courseware_*`, `assignment_*`, `submissions_list`, `reply_query`)
  and the RLS on `results` (writes: registrar only), `attendance`, `assignments`, `submissions`,
  `courseware`, `queries`, `announcements` use it. `is_admin()` alone is **not** enough for new
  course-level features — gate them with `can_teach`. Student side: `my_student_id()`, `is_enrolled(course)`.
- **Enrolment = `enrolments` rows, one per student + module + academic year** (unique index
  `enrolments_student_course_year_uq`; `20261002120000`). Each row carries `academic_year`, `intake` and
  `semester_no` (1 | 2 | null = year-long). A BEFORE INSERT trigger fills them from the course label
  (`course_semester_no('Y2 S1') = 1`, `'S1&S2'` → null) and from the student, so every insert path agrees.
  - Whole class: `enrol_cohort(programme, academic_year, intake, semester, dry_run)` (UI: Programmes →
    Cohort Enrolment, preview with a semester picker; registrar/admin). A cohort is
    `students.programme_id + academic_year + intake` (status `enrolled`). It registers that semester's
    modules plus the year-long ones; programmes whose labels start `Y1 …/Y2 …` also filter by the
    student's `year`. No charge (fees stay on invoices).
  - One student: `student_enrolments`, `enrol_student_module` (re-activates a dropped row) and
    `drop_enrolment` (refused once results are published). UI: Students → Student 360 → Modules.
  - **The student sees only the current period**: `student_courses()` returns their latest academic year
    and, within it, their latest `semester_no` (plus year-long modules); `student_courses(true)` is the
    history. So registering semester 2 is what moves a class on: semester 1 drops out of My Studies,
    Ask Lecturer and Courseware. `is_enrolled()` (file/announcement access) still covers every period.
- **Who teaches what** = `courses.lecturer_staff_id`, one lecturer per module (no co-teaching or per-intake
  split). Set in Programmes → Lecturers (allocation table) or Add course. `my_courses()` feeds the
  Lecturer Portal and Courseware; `student_courses()` feeds My Studies, Ask Lecturer and Courseware.
- **Attendance is per module**: `attendance_pct(student, course)`, `exam_admission_ok_course` (80%);
  `record_attendance_session(code, present[], date, hours)` replaces that day's register. The older
  per-student `attendance_summary` / `exam_admission_ok(student)` still exist (overall %).
- **Announcements** may carry `course_id`: lecturers can only post to modules they teach (a school-wide
  post needs registrar/admin); students read general posts plus those of modules they're enrolled on.
- **LMS**: the cloud `assignments`/`submissions` are the **2026-07-14 shape** (`due`, `max_marks`,
  `file_url`) plus the columns added in `20260928120000` (`description`, `file_path`, `submitted_at`,
  `note`, `feedback`, `graded_*`). The `20260729120000` `create table if not exists` definitions (`code`,
  `due_date`, `points`) were **never applied** — don't write against them. Students may resubmit until graded;
  `grade_submission` enforces `0..max_marks`.
- **Files**: private bucket `course-files` (25 MB). Access is decided by the path in `course_file_access()`:
  `materials/<course_id>/…` and `assignments/<course_id>/…` (lecturer writes; enrolled students read),
  `submissions/<assignment_id>/<student_id>/…` (that student writes; the module's lecturer reads). Clients
  upload with `api.uploadCourseFile(prefix, file)` and open with `api.courseFileUrl(path)` (signed URL).

- **Assessments & live classes** (`20261007120000`, applied to cloud 2026-10-07): tables
  `assessments` / `assessment_marks` (tests, quizzes, practicals; per-module, weighted) with RPCs
  `assessment_upsert/delete/save_marks`, `course_gradebook(course)` (assessments + graded assignments → CA %),
  `student_assessments()`; `class_sessions` + `class_session_*` RPCs (schedule/start/end, Jitsi room or pasted link,
  recording link and/or parts in `course-files/recordings/<course>/<session>/…`, which `course_file_access` now allows).
  UI: `Assessments.jsx` + `LiveClasses.jsx` (lecturer tabs *Live Classes*/*Assessments*; student tab *Live Classes* and
  *My test & quiz marks* under Grades). Marks tab has "Fill CA from assessments". In-browser recording uploads ~8-min parts.

### Public-site server routes (Next, `nodejs` runtime, service-role)

- `app/api/letter/route.ts` — lazily generates the approval-letter PDF (`lib/letter.ts`, `pdf-lib`) into
  `approval-letters` and redirects to a signed URL. Portal links here via `/api/letter?ref=…`. The
  **official stamp** is `public/stamp.png` (extracted from the 18 Aug 2026 scan; a light provisional
  image — swap when the cleaner one arrives): `letter.ts` embeds it via `embedPng`, and the Suite letters
  (`src/modules/Students.jsx`) use `college_settings.stamp_path` with a `${origin}/stamp.png` fallback.
  Signatures are printed name + title only (client declined scanned signatures — forgery risk).
- `app/api/payment-proof/route.ts` — applicant uploads EFT proof (file + amount); validates the ref is
  approved, stores it, flags the application. Admin reviews it in `/admin` and records the payment.
- `app/api/public/{application,application-status,contact}/route.ts` — the applicant/contact write path,
  **rate-limited** via `lib/public-security.ts` (`rateLimit`). CAPTCHA/**Turnstile was removed** (the
  widget component is gone); `verifyTurnstile` is a no-op unless `TURNSTILE_SECRET_KEY` is set. Client
  requirement: rate limiting yes, CAPTCHA no.
- **Edge functions** `supabase/functions/grant-student-access/` and `grant-staff-access/` — admin-only;
  create an `auth.users` row with a temp password and link it (`link_student_account()` /
  `link_staff_account()`), returning the credentials **once** (no email provider is wired — the admin
  copies them; the Suite shows a copyable modal after granting). `grant-student-access` also takes
  `{ reset: true }` to reissue a lost password for an already-linked student (returns code
  `already_granted` otherwise so the UI can offer a confirm-to-reset). Both re-flag
  `must_reset_password`, so the student/staff must choose a new password on first sign-in
  (`App.jsx` → `ForcePasswordChange`). `grant-staff-access` takes `{ staff_id, suite_role }` to grant and
  `{ staff_id, action: 'revoke' }` to remove the login (keeps the `staff` row) — any other `action`
  falls through to the grant path and fails with `invalid suite_role`.
- **These functions do their own admin check + CORS, so their `verify_jwt` is effectively bypassed for
  the browser preflight.** Their `Access-Control-Allow-Headers` MUST include `x-client-info` and `apikey`
  (supabase-js sends both on `invoke()`); if not, the browser preflight fails and the call dies with
  `FunctionsFetchError: Failed to send a request to the Edge Function` — a CORS failure, NOT a function
  bug. Redeploy with `SUPABASE_ACCESS_TOKEN=… npx supabase functions deploy <name> --project-ref <ref>`.

## Suite front-end structure

No router, no state library, no CSS framework. `src/App.jsx` (login/role) → `src/Shell.jsx` (chrome +
**access-control registries**: `MODULES`, `ROLE_NAV` *is* the access control, `SEARCH_INDEX`,
`INSTITUTION_HIDE` multi-tenant filter) → `src/modules/*.jsx` (one self-contained file per module).
**Invariants:** the `seller` role never mounts Shell — it routes straight to fullscreen `POS.jsx`;
`goTo(mod, payload)` is the only navigation path and refuses modules outside the role's nav.

`src/data.js` **is deleted** (the old mock DB joined datasets by student NAME, e.g.
`INVOICES.learner === "Gabriel !Naruseb"`; the backend uses `student_id` FKs instead). `src/ui.jsx` holds
shared primitives (`StatCard`, `Tabs`, `Panel`, `Modal`, `Donut`, `useToast`, `Badge`, `Progress`, …) —
reuse these; every flow is table/row → `Modal` → state → toast.

## Design systems

- **Suite** (`src/styles.css`): institutional steel-blue theme keyed on CSS vars. **Naming quirk:**
  `--petrol-*` is the steel-blue scale and `--amber` is the **blue accent** (real amber only in
  `.banner`) — don't "fix" the names. Emojis render monochrome via `.gs` (exception: POS food emojis
  keep color); login uses stroke SVG icons, no emojis. Charts are dependency-free.
- **Public site** (`app/globals.css`, Tailwind): `petrol`/`accent` palette, `.card`, `.btn-*` (built
  with skills **emil-design-eng** + **apple-design**). `lib/content.ts` is the single source of truth —
  content is REAL (see `CONTENT-SOURCE.md`); **do not invent programmes, fees or contacts**.

## Domain conventions

- Currency **N$** (`fmtN`/`formatN`); UI copy is English. Compliance: **NamRA** (tax), **NCHE/NQA/NTA**
  (accreditation), **Labour Act 2007** (PAYE/SSC/VET in payroll).
- Academic calendar is **semesters** (S1/S2); marks are **continuous assessment** (CA);
  `final = 0.6*CA + 0.4*exam` (client rule, 2026; source of truth `src/lib/academics.js`). University
  nomenclature (Student/Programme/Semester/Credit/GPA) — avoid
  reintroducing school terms (learner/grade/guardian/term).
- Production is **empty-by-default** (no mock/demo numbers to reconcile — the old `data.js` "476 enrolment"
  figures are gone). Any remaining mock/dev copy anchors "today" around **3 Jul 2026**.
- **Payments are manual EFT + uploaded proof — no gateway.** Emails are **generated in-app but sent
  manually** (admin "Copy email"). Bank details are **REAL and confirmed** (client, 2026-08-23):
  `content.ts` `college.bank` and `college_settings` = *Symanek Specialized College* /
  *Enterprise Business Account* / FNB Okahandja / `64279814676` / branch `280373`. No cash / ATM.

## Env & deploy

- `.env.local` (both apps) → **local** Supabase (`supabase start`, `http://127.0.0.1:54321`).
  `site-publico/.env.production.local` → **cloud**; `next build` (production) prefers it over `.env.local`,
  so `dev` stays local and `build`/`start` hit cloud. `.env*.local` are gitignored — never commit secrets.
- **Live on Vercel (two projects, one GitHub repo `pedroteixeira201435-source/symanek`):**
  - **`https://symanek-site.vercel.app`** — public site, Root Directory `site-publico`. Needs 6 env vars
    incl. server-only `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (for `/api/letter`, `/api/payment-proof`)
    and `NEXT_PUBLIC_SITE_URL` (absolute portal link in the generated email). See `site-publico/VERCEL-DEPLOY.md`.
  - **`https://symanek-suite.vercel.app`** — Suite, Root Directory `.` (repo root `vercel.json`, Vite→`dist`).
    A **production build defaults to `http`** (`config.js`: `API_MODE = VITE_API_MODE || (PROD ? 'http' : 'mock')`)
    with real `EmailLogin` + cloud data — **no Vercel env vars needed** (`supabaseClient.js` has a baked cloud
    fallback). `PRODUCTION_CORE_MODULES` (`config.js`) gates the http nav to the day-one academic core
    (dashboard/students/academics/admissions/programmes/exams/graduation/finance/teacher/portal/lms); other
    modules stay hidden until their own UAT. Local `dev` still defaults to `mock` (role-picker).
- **Vercel CLI works here** (`npx --yes vercel …`): `vercel link --yes --project NAME`,
  `printf '%s' VALUE | vercel env add NAME production`, `vercel --prod --yes` (authenticated by the CLI
  login; see Commands).
  Both apps build clean on Vercel's Node 20. UAT test scripts + staff runbook are in `UAT-GUIA.md`.
  Deploy runbook is in `PRODUCTION-OPERATIONS.md`. **Neither project auto-deploys from Git — deploy via
  CLI.** Repo root `.vercel` is linked to `symanek-suite`, so `vercel --prod` from the root deploys the
  **Suite** (Vite→`dist`). The **site** project's Root Directory is `site-publico`, so `cd site-publico &&
  vercel --prod` FAILS (it looks for `site-publico/site-publico`). Deploy the site from the **repo root**
  targeting the site project: `env VERCEL_PROJECT_ID=<site-prj> VERCEL_ORG_ID=<org> vercel --prod --yes`
  with the root `.vercel` moved aside. `site-publico/vercel.json` (`{"framework":"nextjs"}`) is required
  so the root Vite `vercel.json` doesn't force a `dist` output on the Next build. Add a temporary
  `.vercelignore` for `fotos graduation/` (74 MB of source photos) to keep uploads lean.
- **CI** — `.github/workflows/ci.yml` runs on push to `main` and PRs: **suite** (`npm run build`), **site**
  (`tsc --noEmit` + build), and **rls-rpc** (`supabase start` + `seed_auth.sh` + `tests/run.sh`). The
  rls-rpc job is **blocking** (as of `20260824235000` — the suite now matches the enforced RPC-only write
  model: raw writes to `students`/`staff`/`payments` denied to every role, RPC write-path proven). Verified
  green locally against the container stack. Pushing `.github/workflows/**` needs a token with the
  `workflow` scope.

## Bulk student import & client pack

- `supabase/import/import_students.mjs` writes **directly via PostgREST with the service role** (it bypasses
  the `student_upsert` RPC), upserting `students` on `reference` and creating GoTrue logins (temp password +
  `must_reset_password` on new logins only). Blank `student_no` → generated `<academic_year><5 digits>`, or reused by email on re-run.
  Programme matches slug **or** full name. Template: `supabase/import/templates/new-students-template.csv`.
- Input goes in `supabase/import/entrada/`, per-row results (incl. temp passwords) land in
  `supabase/import/saida/` — **both gitignored (PII)**.
- `PARA-A-CLIENTE/` holds client-facing material (English messages/guides to send to Symanek) plus
  `0-LEIA-PRIMEIRO-PEDRO.md` (Portuguese runbook for Pedro). Keep client copy in English.

## Local-dev gotchas (verified, will bite you)

- `supabase db reset` **hangs** waiting for the `analytics` (logflare) container to become healthy.
  Workaround: apply migrations/seeds directly —
  `docker exec -i supabase_db_symanek_college psql -U postgres -d postgres -f - < file.sql`.
- After DDL, PostgREST caches the schema — run `notify pgrst, 'reload schema';` (cloud: via Management API
  `POST /v1/projects/{ref}/database/query`) before the new function/column is callable over REST.
- `@supabase/supabase-js` **throws on Node 18** (no native WebSocket) — it works in the browser/Vite;
  test the backend from Node via `curl`/PostgREST, not a Node script.
- In Next route handlers on Node 18 the **`File` global is undefined** — duck-type on `Blob`.
- `supabase db push` connects to cloud via the access token (no DB password needed); a `pg-delta`
  certificate warning is **non-fatal** — the migration still applies. Changing an RPC's return type needs
  `drop function` first (a bare `create or replace` errors). **Adding a parameter creates an overload**:
  `drop function` the old signature in the same migration, or calls become ambiguous when the new
  parameter has a default (done for `student_upsert`, `submit_assignment`, `courseware_upsert`,
  `record_attendance_session`). If `db push` lists old migrations that already exist in the DB
  (applied out of band), `npx supabase migration repair --status applied <version>` them. Don't re-run them.
- **Test a migration before pushing** in a throwaway container: `docker run -d --name symtest -e
  POSTGRES_PASSWORD=postgres public.ecr.aws/supabase/postgres:17.6.1.167`, create stub
  `storage.buckets`/`storage.objects`/`storage.foldername()` **as `supabase_admin`** (the image's
  `postgres` role can't touch the `storage` schema), then pipe every `supabase/migrations/*.sql` in order
  with `psql -v ON_ERROR_STOP=1`. To act as a user: `set_config('request.jwt.claims', '{"sub":…}')` **and**
  `set_config('request.jwt.claim.sub', …)` (both), then `set role authenticated`. Don't call a volatile
  RPC inside a `WHERE` over an empty table — it never runs.
- **Production end-to-end checks** are done with `fetch` from Node (not supabase-js): create throwaway
  `@symanek.test` users via the GoTrue admin API with the service role, sign in with
  `/auth/v1/token?grant_type=password` using the Suite's publishable key (`src/supabaseClient.js`), call
  RPCs and the `grant-*` edge functions with the user's JWT, and delete everything in a `finally`. Then
  verify that nothing was left behind.
- **Applying SQL/DDL to cloud — simplest path is the Management API** (used 2026-08-24, no DB password):
  `POST https://api.supabase.com/v1/projects/<ref>/database/query` with `Authorization: Bearer <token>`
  (a personal `sbp_…` access token) and body `{"query":"<sql>"}`. Runs as postgres, returns `[]` on DDL
  success. It does **not** update the migration tracker, so record it yourself:
  `insert into supabase_migrations.schema_migrations(version,name) values (…) on conflict (version) do nothing;`.
- **Alternative apply path (`apply:migration` script)** uses `pg` + the **Session pooler** and needs
  `SUPABASE_DB_PASSWORD`: the `supabase` CLI/`psql` aren't installed and the **direct** host
  `db.<ref>.supabase.co:5432` is **IPv6-only** (`ENETUNREACH` here) — so override `SUPABASE_DB_HOST` to
  `aws-0-<region>.pooler.supabase.com` (IPv4, port **5432**, user `postgres.<ref>`, not the 6543 txn pooler).
  The DB password is a secret — keep it out of committed files and have the user rotate it after.
- **Sensitive tokens** (`sbp_…`, GitHub PAT, DB password) live only in the gitignored `.env.codex-handoff`
  (the validation/apply scripts read it via `loadEnv`); never commit them, and have the user rotate any
  token that passed through chat.
