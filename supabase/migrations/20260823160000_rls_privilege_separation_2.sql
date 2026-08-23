-- ============================================================================
-- Symanek — Phase A security A3 (completion): extend RLS privilege separation
-- to the remaining operational tables (the first pass covered the crown-jewel
-- money/records/PII tables in 20260823140000).
--
-- Same pattern: WRITE scoped to the owning workspace via has_suite_role();
-- READ stays broad for staff (is_admin()); existing owner/self policies are
-- preserved (they are OR-combined). All writes in the app for these tables go
-- through SECURITY DEFINER RPCs (apply_leave, decide_leave, allocate_room, …)
-- which bypass RLS, so tightening direct writes does not break the flows.
--
-- Idempotent.
-- ============================================================================

-- Uniform tables: "<t> admin all"  ->  "<t> role write" + "<t> staff read".
do $$
declare m text; tbl text; roles text; rolarg text;
begin
  foreach m in array array[
    'contracts=hr', 'qualifications=hr', 'leave_requests=hr', 'payroll_runs=hr,bursar',
    'enrolments=registrar', 'holds=bursar,registrar', 'sponsors=bursar', 'sponsor_claims=bursar',
    'residences=registrar', 'allocations=registrar', 'exam_sittings=registrar,teacher',
    'nche_returns=registrar', 'assignments=teacher'
  ] loop
    tbl   := split_part(m, '=', 1);
    roles := split_part(m, '=', 2);
    select string_agg(quote_literal(r), ', ')
      into rolarg from unnest(string_to_array(roles, ',')) r;

    execute format('drop policy if exists %I on public.%I', tbl || ' admin all', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || ' role write', tbl);
    execute format(
      'create policy %I on public.%I for all using (public.has_suite_role(%s)) with check (public.has_suite_role(%s))',
      tbl || ' role write', tbl, rolarg, rolarg);
    execute format('drop policy if exists %I on public.%I', tbl || ' staff read', tbl);
    execute format('create policy %I on public.%I for select using (public.is_admin())',
      tbl || ' staff read', tbl);
  end loop;
end $$;

-- Catalogue tables keep their public read; scope the write.
drop policy if exists "courses admin write" on public.courses;
drop policy if exists "courses registrar write" on public.courses;
create policy "courses registrar write" on public.courses for all
  using (public.has_suite_role('registrar')) with check (public.has_suite_role('registrar'));

drop policy if exists "courseware admin" on public.courseware;
drop policy if exists "courseware teacher write" on public.courseware;
create policy "courseware teacher write" on public.courseware for all
  using (public.has_suite_role('teacher')) with check (public.has_suite_role('teacher'));

-- Submissions: keep students' owner-manage; scope staff writes to teacher.
drop policy if exists "submissions admin all" on public.submissions;
drop policy if exists "submissions teacher write" on public.submissions;
create policy "submissions teacher write" on public.submissions for all
  using (public.has_suite_role('teacher')) with check (public.has_suite_role('teacher'));
drop policy if exists "submissions staff read" on public.submissions;
create policy "submissions staff read" on public.submissions for select using (public.is_admin());

-- Institutions: admin only (only the admin has role='admin'/suite_role='admin').
drop policy if exists "institutions admin all" on public.institutions;
drop policy if exists "institutions admin write" on public.institutions;
create policy "institutions admin write" on public.institutions for all
  using (public.has_suite_role('admin')) with check (public.has_suite_role('admin'));
drop policy if exists "institutions staff read" on public.institutions;
create policy "institutions staff read" on public.institutions for select using (public.is_admin());

-- Audit log: read-only for admin; writes happen only via SECURITY DEFINER
-- triggers/functions (which bypass RLS) — no client can insert/alter/delete it.
drop policy if exists "audit_log admin all" on public.audit_log;
drop policy if exists "audit_log admin read" on public.audit_log;
create policy "audit_log admin read" on public.audit_log for select using (public.is_admin());

notify pgrst, 'reload schema';
