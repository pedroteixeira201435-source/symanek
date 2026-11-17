-- ============================================================================
-- Symanek Suite — exam permit with CA marks, outstanding balance and period.
-- Requests from the college (J. Fillemon, 16 Nov 2026): the permit must show
-- each module's CA mark next to attendance, the student's outstanding balance
-- and the study period, following the college's own template.
--
-- _exam_permit() (20261113120000) now also returns, per sitting:
--   ca       the CA mark: the saved results.ca (Marks tab) when the lecturer has
--            saved one, otherwise the CA % computed from the module's recorded
--            assessments (same formula as course_gradebook, rounded to a whole
--            number like "Fill CA from assessments"), otherwise null
--   ca_saved true when `ca` comes from a saved result
-- and at the top level:
--   balance  sum of the student's open invoice balances (N$); null when the
--            student has no invoice at all — "not recorded", not "zero"
--   period   { academic_year, semester_no } of the current registration
-- The rule for ADMITTED is unchanged: at least 80% attendance on the module
-- (a module with no register ever taken does not block) and no hold blocking
-- registration or results. Idempotent; RPC-only (helpers are not callable).
-- ============================================================================

-- CA % of one student in one module, from the recorded assessments and graded
-- assignments: the weighted average over the columns that have any mark; an
-- assessment the student has no mark for counts as 0 (same as course_gradebook).
create or replace function public._student_ca(p_course uuid, p_student uuid)
returns numeric language sql stable security definer set search_path = public as $$
  with cols as (
    select a.id, a.max_marks::numeric as mx, a.weight from public.assessments a where a.course_id = p_course
    union all
    select g.id, g.max_marks::numeric, 1::numeric from public.assignments g where g.course_id = p_course
  ), marks as (
    select m.assessment_id as col_id, m.student_id, m.mark
      from public.assessment_marks m join public.assessments a on a.id = m.assessment_id
     where a.course_id = p_course
    union all
    select s.assignment_id, s.student_id, s.grade::numeric
      from public.submissions s join public.assignments g on g.id = s.assignment_id
     where g.course_id = p_course and s.grade is not null
  ), used as (
    select c.* from cols c where c.mx > 0 and exists (select 1 from marks k where k.col_id = c.id)
  )
  select case when coalesce(sum(u.weight), 0) = 0 then null
              else round(100 * sum(coalesce(k.mark, 0) / u.mx * u.weight) / sum(u.weight), 1) end
  from used u left join marks k on k.col_id = u.id and k.student_id = p_student;
$$;

create or replace function public._student_balance(p_student uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select case when count(*) = 0 then null
              else coalesce(sum(i.balance) filter (where i.balance > 0), 0) end
  from public.invoices i where i.student_id = p_student and i.status <> 'void';
$$;

create or replace function public._exam_permit(p_student uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with hold as (select public._hold_blocks(p_student, array['registration','results']) as blocked),
  rows as (
    -- att = null when no register was ever taken for the module: nothing to judge, so it does not block
    select distinct on (es.id) es.id, c.code, c.title, es.at, es.venue,
           case when exists (select 1 from public.attendance a where a.course_id = c.id)
                then public.attendance_pct(p_student, c.id) end as att,
           (select r.ca from public.enrolments e join public.results r on r.enrolment_id = e.id
             where e.student_id = p_student and e.course_id = c.id and e.status <> 'dropped'
               and e.academic_year is not distinct from ce.academic_year
             order by r.created_at desc limit 1) as ca_saved,
           public._student_ca(c.id, p_student) as ca_calc
    from public._current_enrolments(p_student) ce
    join public.courses c on c.id = ce.course_id
    join public.exam_sittings es on es.course_id = c.id
    order by es.id
  )
  select jsonb_build_object(
    'hold', (select blocked from hold),
    'balance', public._student_balance(p_student),
    'period', (select jsonb_build_object('academic_year', max(academic_year), 'semester_no', max(semester_no))
               from public._current_enrolments(p_student)),
    'sittings', coalesce(jsonb_agg(jsonb_build_object(
        'code', r.code, 'title', r.title, 'at', r.at, 'venue', r.venue, 'attendance', r.att,
        'ca', coalesce(r.ca_saved, round(r.ca_calc)), 'ca_saved', r.ca_saved is not null,
        'admitted', coalesce(r.att >= 80, true) and not (select blocked from hold),
        'reason', case when (select blocked from hold) then 'Hold on account'
                       when r.att < 80 then 'Attendance below 80%' end)
      order by r.at nulls last, r.code) filter (where r.id is not null), '[]'::jsonb))
  from rows r right join (select 1) one on true;
$$;

do $$
declare fn text;
begin
  foreach fn in array array['_student_ca(uuid,uuid)', '_student_balance(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', fn);
  end loop;
end $$;

notify pgrst, 'reload schema';
