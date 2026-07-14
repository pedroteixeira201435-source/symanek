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
```

- The repo path contains a space (`…/symanek college`) — **quote it** in every shell command.
- Deep-link any Suite role via URL hash in mock mode: `#admin`, `#bursar`, `#hr`, `#teacher`,
  `#seller`, `#librarian`, `#student`, `#registrar`, `#applicant` (and `#admin/accounting`).

## The data-access seam (the core architecture)

Both apps talk to the backend **only through a seam** that switches between a local mock and Supabase,
so UI components never change when flipping backends:

- **Suite**: `src/config.js` (`API_MODE`), `src/api.js` (every read/write), `src/supabaseClient.js`.
  Flip with `VITE_API_MODE=mock|http`. Each `api.js` function has a `useHttp()` branch (Supabase) and
  a `mock()` branch (returns `data.js`), **mapping DB rows back to the exact shapes the modules expect**.
- **Public site**: `lib/api.ts` (`API_MODE`), `lib/supabase.ts` (browser client), `lib/supabase-admin.ts`
  (server-only service-role client — never import into a Client Component). Flip with
  `NEXT_PUBLIC_API_MODE=mock|supabase`.

When migrating a Suite module from mock to backend: convert its top-level **synchronous `data.js`
reads into an async `useEffect` load via `api.js`**, keep the same prop/`ctx` shape so child components
are untouched, and add loading/error state. `StudentPortal.jsx`, `Academics.jsx` (ExamBoard tab) and
`Graduation.jsx` are the migrated reference examples; the other ~16 modules still read `data.js`.

## Backend (`supabase/`)

- **Migrations** `supabase/migrations/*.sql` — schema, RLS, and RPCs. Applied in timestamp order.
- **Auth model**: `profiles.role` (coarse: `admin|staff|student|applicant`, drives `is_admin()` and RLS)
  **plus** `profiles.suite_role` (fine: the 9 Suite workspaces). `src/auth.js` resolves the signed-in
  user's Suite role from their profile; `App.jsx` shows `EmailLogin` in http mode, the role-picker in
  mock. Students are linked to their record via `students.user_id` (enables RLS owner-reads).
- **Server-authoritative rules are RPCs, not client logic** (SECURITY DEFINER, resolve the actor via
  `auth.uid()`): `register_course` (holds → prereq → credit-cap → capacity/waitlist → charge),
  `pay_invoice` (records payment, reduces balance, **auto-releases financial holds** when cleared),
  `graduation_clearance`/`issue_certificate` (finance+library+academic, gated), `publish_exam_results`
  (`final = 0.4*CA + 0.6*exam`, locks marks — RLS blocks editing a published result), `graduation_board`.
  Public/anon RPCs: `submit_application`, `submit_contact`, `get_application_status`, and admin
  `approve_application`/`mark_paid`.
- **Storage buckets** (private): `approval-letters` (generated PDFs), `application-docs`,
  `payment-proofs` (applicant EFT proofs). Uploads/signing happen server-side via the service role.
- **Seeds**: `seed_programmes.sql` (auto-generated from `site-publico/lib/content.ts` — slugs MUST match
  or `submit_application` rejects), `seed.sql`, `seed_suite.sql` (demo slice around student
  **Gabriel !Naruseb**, CVT-4), `seed_auth.sh` (9 demo accounts, password `symanek123`). `db push` does
  NOT run seed files — they are bundled into a migration for cloud, or applied directly.

### Public-site server routes (Next, `nodejs` runtime, service-role)

- `app/api/letter/route.ts` — lazily generates the approval-letter PDF (`lib/letter.ts`, `pdf-lib`) into
  `approval-letters` and redirects to a signed URL. Portal links here via `/api/letter?ref=…`.
- `app/api/payment-proof/route.ts` — applicant uploads EFT proof (file + amount); validates the ref is
  approved, stores it, flags the application. Admin reviews it in `/admin` and records the payment.

## Suite front-end structure

No router, no state library, no CSS framework. `src/App.jsx` (login/role) → `src/Shell.jsx` (chrome +
**access-control registries**: `MODULES`, `ROLE_NAV` *is* the access control, `SEARCH_INDEX`,
`INSTITUTION_HIDE` multi-tenant filter) → `src/modules/*.jsx` (one self-contained file per module).
**Invariants:** the `seller` role never mounts Shell — it routes straight to fullscreen `POS.jsx`;
`goTo(mod, payload)` is the only navigation path and refuses modules outside the role's nav.

`src/data.js` is the single mock database. Its datasets historically **join by student NAME** (e.g.
`INVOICES.learner === "Gabriel !Naruseb"`) — the backend replaces this with `student_id` FKs (the seed
carries real ids). `src/ui.jsx` holds shared primitives (`StatCard`, `Tabs`, `Panel`, `Modal`,
`Donut`, `useToast`, …) — reuse these; every flow is table/row → `Modal` → state → toast.

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
  `final = 0.4*CA + 0.6*exam`. University nomenclature (Student/Programme/Semester/Credit/GPA) — avoid
  reintroducing school terms (learner/grade/guardian/term).
- "Today" in the demo is fixed around **3 Jul 2026**; keep new dates in that window. Headline numbers are
  reconciled (476 total enrolment across `SCHOOL`/`PROGRAMMES`/`FEE_STRUCTURE`) — keep them consistent.
- **Payments are manual EFT + uploaded proof — no gateway.** Emails are **generated in-app but sent
  manually** (admin "Copy email"). Real bank details in `content.ts` `college.bank` are still PLACEHOLDER.

## Env & deploy

- `.env.local` (both apps) → **local** Supabase (`supabase start`, `http://127.0.0.1:54321`).
  `site-publico/.env.production.local` → **cloud**; `next build` (production) prefers it over `.env.local`,
  so `dev` stays local and `build`/`start` hit cloud. `.env*.local` are gitignored — never commit secrets.
- Public-site prod needs the server-only vars `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (for the two
  API routes). See `site-publico/VERCEL-DEPLOY.md`. Deploy is via GitHub → Vercel (root dir `site-publico`).

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
