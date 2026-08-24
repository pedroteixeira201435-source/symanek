-- ============================================================================
-- PURGE DEMO SLICE (idempotent). Removes the "Gabriel !Naruseb / CVT-4" demo
-- data seeded by 20260714180000_seed_demo.sql so a production cloud carries ZERO
-- mock records. Safe to re-run.
--
-- What it removes (by demo-specific keys only — real data is never matched):
--   * students  reference like 'SYM-STU-%'      (12 demo students)  -> cascades
--       enrolments, results, invoices, invoice_payments, holds, sponsor_claims,
--       allocations, submissions (all FK ON DELETE CASCADE from students).
--   * courses   under the 5 suite-demo programmes                    -> cascades
--       exam_sittings, courseware, assignments (and any enrolments/results).
--   * programmes category = 'suite-demo'         (dba-6/daf-6/cit-5/cvt-4/bed-7)
--   * staff     staff_no ~ '^SYM-0[0-9][0-9]$'   (7 demo staff SYM-001..SYM-008;
--       real staff use 'SYM-STF-%' and are NOT matched).
--   * applications reference in ('SYM-2026-0042','SYM-2026-0043')  (2 demo apps)
--   * sponsors  seeded by the demo slice (5 names)                  (their claims
--       already cascade-deleted with the students).
--
-- What it KEEPS: the real programme catalogue (all non 'suite-demo' rows), the
-- real institution 'Symanek Specialized College', and every real go-live record.
--
-- NOTE: courses.programme_id has NO cascade, so demo courses are deleted BEFORE
-- the demo programmes. lecturer_staff_id is a loose uuid (no FK), so deleting
-- demo staff is unconstrained.
-- ============================================================================

do $$
declare
  v_students int;
  v_courses  int;
  v_progs    int;
  v_staff    int;
  v_apps     int;
begin
  -- 1) demo students (cascades enrolments/results/invoices/payments/holds/claims/allocations/submissions)
  delete from public.students where reference like 'SYM-STU-%';
  get diagnostics v_students = row_count;

  -- 2) demo courses (cascades exam_sittings/courseware/assignments) — before their programmes
  delete from public.courses
   where programme_id in (select id from public.programmes where category = 'suite-demo');
  get diagnostics v_courses = row_count;

  -- 3) demo programmes (hidden suite-demo set)
  delete from public.programmes where category = 'suite-demo';
  get diagnostics v_progs = row_count;

  -- 4) demo staff (SYM-0NN; real staff are SYM-STF-NNN)
  delete from public.staff where staff_no ~ '^SYM-0[0-9][0-9]$';
  get diagnostics v_staff = row_count;

  -- 5) demo applications (Gabriel Naruseb / Maria Shikongo placeholders)
  delete from public.applications where reference in ('SYM-2026-0042', 'SYM-2026-0043');
  get diagnostics v_apps = row_count;

  -- 6) demo sponsors (claims already removed via student cascade)
  delete from public.sponsors
   where name in ('NSFAF','NTA Levy Fund','FNB Namibia Foundation','Symanek Merit Bursary','Ohorongo Cement Trust')
     and not exists (select 1 from public.sponsor_claims sc where sc.sponsor_id = sponsors.id);

  raise notice 'purge_demo_slice: students=% courses=% programmes=% staff=% applications=%',
    v_students, v_courses, v_progs, v_staff, v_apps;
end $$;
