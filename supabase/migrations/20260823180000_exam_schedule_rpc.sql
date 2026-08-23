-- ============================================================================
-- Symanek — spine completion: real exam timetable (StudentPortal).
--
-- listExamSchedule() in the Suite had no http branch, so a signed-in student's
-- "download exam timetable" returned demo data. exam_sittings now carries RLS
-- (registrar/teacher write, staff read) which would hide the schedule from a
-- student — the timetable isn't sensitive, so expose it via a SECURITY DEFINER
-- RPC granted to any authenticated user.
-- ============================================================================

create or replace function public.exam_schedule()
returns table (
  code text, title text, at timestamptz, venue text,
  seats int, sat int, invigilator text
) language sql stable security definer set search_path = public as $$
  select
    c.code, c.title, es.at, es.venue, es.seats,
    (select count(*)::int from public.enrolments e
       where e.course_id = es.course_id and e.status <> 'dropped') as sat,
    coalesce(st.name, '') as invigilator
  from public.exam_sittings es
  join public.courses c on c.id = es.course_id
  left join public.staff st on st.id = es.invigilator_staff_id
  order by es.at;
$$;

revoke all on function public.exam_schedule() from public;
grant execute on function public.exam_schedule() to authenticated;

notify pgrst, 'reload schema';
