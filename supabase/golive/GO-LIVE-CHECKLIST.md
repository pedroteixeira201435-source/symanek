# Symanek — Go-live checklist (production runbook)

The single ordered path from the current deployed prototype to production. Items
marked ✅ are done (2026-08-23 hardening pass); ⏳ need a human input as noted.
Follow top to bottom — later steps assume earlier ones.

Legend: **[Pedro]** you do it · **[Client]** the college must supply · **[Auto]** already done by the assistant.

---

## 0. Security & correctness (Phase A) — ✅ mostly done
- [x] **[Auto]** Approval-letter enumeration closed (access-token); payment-proof filter-injection fixed.
- [x] **[Auto]** RLS privilege separation by `suite_role` on all tables; `audit_log` write-protected.
- [x] **[Auto]** Audit triggers on the sensitive tables.
- [ ] **[Client]** **A4 — exact grade boundaries (A/B/C/D/Fail).** Until received, official
      Statements of Result may not match the college's documents. Blocks transcripts only.

## 1. Make the Suite persist (Phase B) — ⏳ needs Pedro
- [ ] **[Pedro] B1 — set the Suite's Vercel env vars** (project `symanek-suite`, root `.`):
      `VITE_API_MODE=http`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
      (see `site-publico/VERCEL-DEPLOY.md` for the values). Redeploy. This removes the
      role-picker and requires real login. **Without this the Suite stays mock in prod.**
- [ ] **[Pedro] B2 — provision real accounts & retire demo:**
      1. Create staff auth accounts from the `staff` table (needs their emails — some are
         still NULL, see D2). Assign each a `profiles.suite_role` (bursar/registrar/hr/…).
      2. Link each student to an auth account (`students.user_id`).
      3. **Retire the 9 demo accounts**: run `supabase/golive/retire_demo_accounts.sql`
         (removes every `*@symanek.local` login). Do this only after real admin logins exist.
- [x] **[Auto] B4** — dashboard shows real aggregates in http mode (no fabricated numbers).

## 2. Data load (Phase D) — ⏳ needs Client
- [ ] **[Client] D1 — student rosters for every programme** other than Auxiliary Nursing
      (names, student numbers, emails, intake). Load via the `seed_golive.sql` pattern.
- [ ] **[Client] D2 — staff emails** for the newly named lecturers (Ms Ipinge, Ms Rakkel,
      Ms Moyo, Ms Abel) + confirm Mr Muhuka's full name → then create their logins.
- [ ] **[Client] D3 — clean official stamp image** (current `public/stamp.png` is a light
      provisional extract) and confirm the 5 newly added programmes for public display.

> **Production data hygiene:** a production project should be seeded with the REAL seeds
> only — `seed_programmes.sql` + `seed_golive.sql`. Do **not** run `seed_demo`,
> `seed_suite.sql` or `seed_auth.sh` (those carry the "Gabriel !Naruseb" / 476-enrolment
> demo slice and the `symanek123` accounts).

## 3. Day-1 module scope (Phase C) — ⏳ needs a decision
- [ ] **[Pedro] C1 — decide which mock-only modules are required at launch.** Still mock
      (no backend): Accounting, Library, POS, Scheduling, Exams, ApplyOnline, CanteenAdmin.
      For each in scope, the assistant then builds schema + RPCs + RLS and wires it
      (proven pattern: StudentPortal/Finance). If none are day-1, the admissions→enrolment
      →payment→results→documents spine is already backed and can go live without them.

## 4. Ops / QA (Phase E)
- [x] **[Auto] E3** — RLS/RPC test suite (`supabase/tests/run.sh`) + CI workflow
      (`supabase/tests/github-ci.yml` → move to `.github/workflows/` with a `workflow`-scoped
      token to activate).
- [x] **[Auto] E1** — logical backup script + DR runbook (restore round-trip verified).
- [ ] **[Pedro] E1 — enable PITR** in the Supabase dashboard (Database → Backups) and
      schedule an off-site copy of `backup.sh` (see `supabase/backups/DR-RUNBOOK.md`).
- [ ] **[Pedro] E2 — error tracking** (Sentry DSN) + uptime monitoring.
- [ ] **[Pedro] E5 — final UAT** per role against the real (http) backend and sign-off
      (`UAT-GUIA.md`). Run `supabase/tests/run.sh` green as the automated gate first.

## 5. Security housekeeping
- [ ] **[Pedro] Rotate the database password** (Database → Reset database password) — it
      was shared over chat during the 23 Aug cloud applies. Update any stored copy.

---

### Minimal go-live definition
The system is production-ready for a **first cohort** when: **B1** + **B2** done, **A4**
grade bands received, **D1** rosters loaded, **E1** PITR on, **E5** UAT signed off.
Day-1 module scope (**C1**) only gates whichever extra modules the college needs beyond the
core spine. Everything else above is already in place.
