-- Exam permit: a student qualifies only when BOTH conditions hold (client request, 2026-11-19):
--   attendance on the module >= 80% (unchanged) AND a recorded CA mark >= 50% (the college's
--   minimum for formative work, see src/lib/academics.js PASS.formativeMin).
-- No CA mark recorded = not qualified. No hold on the account (unchanged).
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
        'admitted', coalesce(r.att >= 80, true) and coalesce(coalesce(r.ca_saved, round(r.ca_calc)) >= 50, false)
                    and not (select blocked from hold),
        'reason', nullif(concat_ws('; ',
                       case when (select blocked from hold) then 'Hold on account' end,
                       case when r.att < 80 then 'Attendance below 80%' end,
                       case when coalesce(r.ca_saved, round(r.ca_calc)) is null then 'No CA mark recorded'
                            when coalesce(r.ca_saved, round(r.ca_calc)) < 50 then 'CA below 50%' end), ''))
      order by r.at nulls last, r.code) filter (where r.id is not null), '[]'::jsonb))
  from rows r right join (select 1) one on true;
$$;

notify pgrst, 'reload schema';
