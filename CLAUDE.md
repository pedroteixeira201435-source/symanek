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
> migrations below are **APPLIED to the cloud** (tracker in sync through `20260824234000`).
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
>   from the cloud. `supabase/seed_golive_enrolments.sql` enrols the 24 real Aux-Nursing students.
> - **`src/api.js`** has one function per dataset. In **http** they hit the RPC; in **mock** they return
>   `[]`/`null` (no fabricated data reaches production). Helpers `rows()/one()/call()` wrap the CRUD RPCs.
> - **All modules migrated** to `useEffect`+`api` with loading/empty-states and Add/Edit/Delete `Modal`
>   forms. Reference the finished pattern in `Accommodation.jsx`, `Library.jsx`, `Programmes.jsx`.

## Commands

```bash
# Suite (repo root) — Vite 5, Node 18 (do NOT bump Vite; v6+ needs Node 20)
npm run dev                      # dev server (mock mode by default)
npm run build                    # production build = the verification step (no tests/lint configured)
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

# Vercel (both apps already deployed; redeploy from the app's dir)
cd site-publico && npx --yes vercel --prod --token "$VERCEL_TOKEN"   # public site
npx --yes vercel --prod --token "$VERCEL_TOKEN"                      # Suite (from repo root)
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
    `suite_role`, never `role`.** Students/staff are usually provisioned instead via the Suite's "Grant
    portal access"/"Grant staff access" (the edge functions above). `is_admin()` = `role in (admin,staff)`.
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
  (`App.jsx` → `ForcePasswordChange`).
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
    (dashboard/students/academics/admissions/programmes/exams/graduation/finance/teacher/portal); other
    modules stay hidden until their own UAT. Local `dev` still defaults to `mock` (role-picker).
- **Vercel CLI works here** (`npx --yes vercel …`, v56): `vercel link --yes --project NAME`,
  `printf '%s' VALUE | vercel env add NAME production`, `vercel --prod --yes` (all need `--token` or `VERCEL_TOKEN`).
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
  `drop function` first (a bare `create or replace` errors).
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
