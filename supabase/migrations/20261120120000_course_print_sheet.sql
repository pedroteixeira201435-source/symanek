-- ============================================================================
-- Printable lecturer sheets (client request, 2026-11-19):
--   * CA sheet  : every assessment recorded per student with their marks and CA %
--   * Attendance register : every recorded session per student (present / absent) and the %
-- One RPC returns everything for one module; src/lib/documents.js lays it out (landscape A4).
-- Lecturer scoping as everywhere: can_teach(course) = the module's lecturer, registrar or admin.
-- ============================================================================
create or replace function public.course_print_sheet(p_course uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_gb jsonb; v_course jsonb; v_sessions jsonb; v_att jsonb;
begin
  if not public.can_teach(p_course) then raise exception 'not authorized'; end if;
  v_gb := public.course_gradebook(p_course);

  select jsonb_build_object('code', c.code, 'title', c.title, 'credits', c.credits, 'semester', c.semester,
           'programme', (select p.name from public.programmes p where p.id = c.programme_id),
           'lecturer', (select st.name from public.staff st where st.id = c.lecturer_staff_id),
           'academic_year', (select max(e.academic_year) from public.enrolments e where e.course_id = c.id and e.status <> 'dropped'))
    into v_course from public.courses c where c.id = p_course;

  select coalesce(jsonb_agg(jsonb_build_object('date', d.session_date, 'hours', d.h) order by d.session_date), '[]'::jsonb)
    into v_sessions
    from (select a.session_date, max(a.hours) as h from public.attendance a where a.course_id = p_course group by a.session_date) d;

  select coalesce(jsonb_agg(jsonb_build_object(
           'student_id', s.id, 'name', s.full_name, 'student_no', s.student_no,
           'present', coalesce((select jsonb_object_agg(a.session_date::text, a.present)
                                from public.attendance a where a.course_id = p_course and a.student_id = s.id), '{}'::jsonb),
           'percent', public.attendance_pct(s.id, p_course)) order by s.full_name), '[]'::jsonb)
    into v_att
    from public.students s
    where exists (select 1 from public.enrolments e where e.course_id = p_course and e.student_id = s.id and e.status <> 'dropped');

  return public._document_header('registrar') || jsonb_build_object(
    'course', v_course,
    'assessments', v_gb->'assessments',
    'ca_students', (select coalesce(jsonb_agg(x.v order by x.v->>'name'), '[]'::jsonb) from (
        select g.v || jsonb_build_object('student_no', (select s.student_no from public.students s where s.id = (g.v->>'student_id')::uuid)) as v
        from jsonb_array_elements(v_gb->'students') g(v)) x),
    'sessions', v_sessions,
    'attendance', v_att);
end $$;

revoke all on function public.course_print_sheet(uuid) from public, anon;
grant execute on function public.course_print_sheet(uuid) to authenticated;
notify pgrst, 'reload schema';
