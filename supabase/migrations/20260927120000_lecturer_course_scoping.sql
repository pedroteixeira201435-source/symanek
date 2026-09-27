-- ============================================================================
-- Symanek Suite — lecturer ↔ course scoping (pre-go-live security fix).
--
-- Until now every lecturer RPC was gated by is_admin() (= any staff), and the
-- results/submissions/attendance/queries/assignments policies let any teacher
-- write to any course. A lecturer could read, edit and publish the marks of
-- every course in the college.
--
-- New rule: a lecturer may only act on courses where
--   courses.lecturer_staff_id = the staff row linked to auth.uid() (staff.user_id).
-- Admin and registrar keep college-wide access. Reads needed by other staff
-- workspaces (results/attendance "staff read") are left as they were.
--
-- Idempotent. Ends with notify pgrst.
-- ============================================================================

-- ---- helpers ----------------------------------------------------------------
create or replace function public.my_staff_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.staff where user_id = auth.uid() and coalesce(active, true) limit 1;
$$;
revoke all on function public.my_staff_id() from public;
grant execute on function public.my_staff_id() to authenticated;

-- admin/registrar: any course; lecturer: only the courses assigned to them.
create or replace function public.can_teach(p_course_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_suite_role('registrar')
      or exists (select 1 from public.courses c
                 where c.id = p_course_id
                   and c.lecturer_staff_id is not null
                   and c.lecturer_staff_id = public.my_staff_id());
$$;
revoke all on function public.can_teach(uuid) from public;
grant execute on function public.can_teach(uuid) to authenticated;

-- The lecturer's own course list (admin/registrar see all). Feeds TeacherPortal.
create or replace function public.my_courses()
returns table (id uuid, code text, title text, credits int, semester text,
               prog text, lecturer text, enrolled bigint)
language sql stable security definer set search_path = public as $$
  select c.id, c.code, c.title, c.credits::int, c.semester::text,
         upper(p.slug), st.name,
         (select count(*) from public.enrolments e where e.course_id = c.id)
  from public.courses c
  left join public.programmes p on p.id = c.programme_id
  left join public.staff st     on st.id = c.lecturer_staff_id
  where public.can_teach(c.id)
  order by c.code;
$$;
grant execute on function public.my_courses() to authenticated;

-- ---- marks ------------------------------------------------------------------
create or replace function public.course_marksheet(p_course_code text)
returns table (student_id uuid, student text, ca numeric, exam numeric, exam2 numeric,
               final numeric, grade text, published boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_course uuid;
begin
  select c.id into v_course from public.courses c where c.code = p_course_code;
  if v_course is null or not public.can_teach(v_course) then raise exception 'not authorized'; end if;
  return query
    select s.id, s.full_name, r.ca, r.exam, r.exam2, r.final, r.grade, coalesce(r.published, false)
    from public.enrolments e
    join public.students   s on s.id = e.student_id
    left join public.results r on r.enrolment_id = e.id
    where e.course_id = v_course
    order by s.full_name;
end $$;
grant execute on function public.course_marksheet(text) to authenticated;

create or replace function public.save_course_marks(p_course_code text, p_marks jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_course uuid; m jsonb; v_enr uuid;
  v_ca numeric; v_exam numeric; v_exam2 numeric; v_final numeric; v_n int := 0;
begin
  select id into v_course from public.courses where code = p_course_code;
  if v_course is null then return jsonb_build_object('ok', false, 'message', 'course not found'); end if;
  if not public.can_teach(v_course) then raise exception 'not authorized'; end if;

  for m in select * from jsonb_array_elements(coalesce(p_marks, '[]'::jsonb)) loop
    select e.id into v_enr from public.enrolments e
      where e.course_id = v_course and e.student_id = (m->>'student_id')::uuid;
    if v_enr is null then continue; end if;

    v_ca    := nullif(m->>'ca', '')::numeric;
    v_exam  := nullif(m->>'exam', '')::numeric;
    v_exam2 := nullif(m->>'exam2', '')::numeric;
    v_final := round(0.6 * coalesce(v_ca, 0) + 0.4 * coalesce(v_exam, 0), 2);

    -- published results are locked: only unpublished rows are touched
    update public.results
      set ca = v_ca, exam = v_exam, exam2 = v_exam2, final = v_final,
          grade = public.grade_letter(v_final)
      where enrolment_id = v_enr and not published;
    if not found then
      insert into public.results (enrolment_id, ca, exam, exam2, final, grade, published)
      select v_enr, v_ca, v_exam, v_exam2, v_final, public.grade_letter(v_final), false
      where not exists (select 1 from public.results where enrolment_id = v_enr);
      if not found then continue; end if;
    end if;
    v_n := v_n + 1;
  end loop;

  return jsonb_build_object('ok', true, 'saved', v_n);
end $$;
grant execute on function public.save_course_marks(text, jsonb) to authenticated;

create or replace function public.publish_course_results(p_course_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_course uuid;
begin
  select id into v_course from public.courses where code = p_course_code;
  if v_course is null then return jsonb_build_object('ok', false, 'message', 'course not found'); end if;
  if not public.can_teach(v_course) then raise exception 'not authorized'; end if;
  return public.publish_exam_results(v_course);
end $$;
grant execute on function public.publish_course_results(text) to authenticated;

-- ---- attendance -------------------------------------------------------------
create or replace function public.record_attendance_session(p_course_code text, p_present jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_course uuid; rec jsonb; v_n int := 0;
begin
  select id into v_course from public.courses where code = p_course_code;
  if v_course is null then return jsonb_build_object('ok', false, 'message', 'course not found'); end if;
  if not public.can_teach(v_course) then raise exception 'not authorized'; end if;

  for rec in select * from jsonb_array_elements(coalesce(p_present, '[]'::jsonb)) loop
    -- only students actually enrolled on this course
    if not exists (select 1 from public.enrolments e
                   where e.course_id = v_course and e.student_id = (rec->>'student_id')::uuid) then
      continue;
    end if;
    insert into public.attendance (student_id, course_id, session_date, hours, present, recorded_by)
    values ((rec->>'student_id')::uuid, v_course, current_date, 1,
            coalesce((rec->>'present')::boolean, true), auth.uid());
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'recorded', v_n);
end $$;
grant execute on function public.record_attendance_session(text, jsonb) to authenticated;

create or replace function public.course_attendance(p_course_code text)
returns table (student_id uuid, student text, percent numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_course uuid;
begin
  select c.id into v_course from public.courses c where c.code = p_course_code;
  if v_course is null or not public.can_teach(v_course) then raise exception 'not authorized'; end if;
  return query
    select s.id, s.full_name, coalesce(a.percent, 0)
    from public.enrolments e
    join public.students   s on s.id = e.student_id
    left join public.attendance_summary a on a.student_id = s.id
    where e.course_id = v_course
    order by s.full_name;
end $$;
grant execute on function public.course_attendance(text) to authenticated;

-- ---- LMS --------------------------------------------------------------------
create or replace function public.grade_submission(p_submission uuid, p_grade numeric, p_feedback text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_course uuid;
begin
  select a.course_id into v_course
    from public.submissions s join public.assignments a on a.id = s.assignment_id
    where s.id = p_submission;
  if v_course is null or not public.can_teach(v_course) then raise exception 'not authorized'; end if;
  update public.submissions
    set grade = p_grade, feedback = p_feedback, graded_by = auth.uid(), graded_at = now()
    where id = p_submission;
  return jsonb_build_object('ok', found);
end $$;
grant execute on function public.grade_submission(uuid, numeric, text) to authenticated;

create or replace function public.courseware_upsert(p_id uuid, p_course uuid, p_title text, p_url text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_old uuid;
begin
  if not public.can_teach(p_course) then raise exception 'not authorized'; end if;
  if p_id is null then
    insert into public.courseware (course_id, title, url) values (p_course, trim(p_title), nullif(trim(p_url),'')) returning id into v_id;
  else
    select course_id into v_old from public.courseware where id = p_id;
    if v_old is null or not public.can_teach(v_old) then raise exception 'not authorized'; end if;
    update public.courseware set course_id = p_course, title = trim(p_title), url = nullif(trim(p_url),'') where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.courseware_delete(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_course uuid;
begin
  select course_id into v_course from public.courseware where id = p_id;
  if v_course is null then return; end if;
  if not public.can_teach(v_course) then raise exception 'not authorized'; end if;
  delete from public.courseware where id = p_id;
end $$;

-- ---- queries ----------------------------------------------------------------
create or replace function public.reply_query(p_id uuid, p_reply text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_course uuid; v_lect uuid;
begin
  select course_id, lecturer_staff_id into v_course, v_lect from public.queries where id = p_id;
  if not found then return jsonb_build_object('ok', false); end if;
  if not (public.has_suite_role('registrar')
          or (v_lect is not null and v_lect = public.my_staff_id())
          or (v_course is not null and public.can_teach(v_course))) then
    raise exception 'not authorized';
  end if;
  update public.queries set reply = p_reply, status = 'answered', replied_at = now() where id = p_id;
  return jsonb_build_object('ok', found);
end $$;
grant execute on function public.reply_query(uuid, text) to authenticated;

-- ============================================================================
-- Row Level Security: direct table writes follow the same course scoping
-- ============================================================================

-- results: writes only by registrar/admin; lecturers go through the RPCs above.
drop policy if exists "results academic write" on public.results;
drop policy if exists "results registrar write" on public.results;
create policy "results registrar write" on public.results for all
  using (public.has_suite_role('registrar')) with check (public.has_suite_role('registrar'));

-- attendance: staff read stays; writes only on courses the user can teach.
drop policy if exists "attendance admin all" on public.attendance;
drop policy if exists "attendance staff read" on public.attendance;
drop policy if exists "attendance lecturer write" on public.attendance;
create policy "attendance staff read" on public.attendance for select using (public.is_admin());
create policy "attendance lecturer write" on public.attendance for all
  using (public.can_teach(course_id)) with check (public.can_teach(course_id));

-- assignments: staff read; writes on own courses.
drop policy if exists "assignments admin all" on public.assignments;
drop policy if exists "assignments staff read" on public.assignments;
drop policy if exists "assignments lecturer write" on public.assignments;
create policy "assignments staff read" on public.assignments for select using (public.is_admin());
create policy "assignments lecturer write" on public.assignments for all
  using (public.can_teach(course_id)) with check (public.can_teach(course_id));

-- submissions: a lecturer reads/grades only submissions for their own courses.
drop policy if exists "submissions teacher write" on public.submissions;
drop policy if exists "submissions staff read" on public.submissions;
drop policy if exists "submissions lecturer all" on public.submissions;
create policy "submissions lecturer all" on public.submissions for all
  using (exists (select 1 from public.assignments a
                 where a.id = submissions.assignment_id and public.can_teach(a.course_id)))
  with check (exists (select 1 from public.assignments a
                      where a.id = submissions.assignment_id and public.can_teach(a.course_id)));

-- courseware: public read stays; writes on own courses.
drop policy if exists "courseware teacher write" on public.courseware;
drop policy if exists "courseware lecturer write" on public.courseware;
create policy "courseware lecturer write" on public.courseware for all
  using (public.can_teach(course_id)) with check (public.can_teach(course_id));

-- queries: a lecturer sees/answers only queries addressed to them or their courses.
drop policy if exists "queries admin all" on public.queries;
drop policy if exists "queries lecturer all" on public.queries;
create policy "queries lecturer all" on public.queries for all
  using (public.has_suite_role('registrar')
         or (lecturer_staff_id is not null and lecturer_staff_id = public.my_staff_id())
         or (course_id is not null and public.can_teach(course_id)))
  with check (public.has_suite_role('registrar')
         or (lecturer_staff_id is not null and lecturer_staff_id = public.my_staff_id())
         or (course_id is not null and public.can_teach(course_id)));

notify pgrst, 'reload schema';
