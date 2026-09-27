-- ============================================================================
-- Symanek Suite — the lecturer ↔ student classroom loop.
--
--   1. Cohort enrolment: put a whole intake on its programme's modules
--      (enrol_cohort + enrolment_cohorts), no charge (fees stay on invoices).
--   2. student_courses(): the signed-in student's modules + lecturer + attendance.
--   3. Queries: a student may only ask about a module they are enrolled on.
--   4. Attendance per module (not per student overall) + optional session date.
--   5. Announcements can target one module (course_id); lecturers only post to
--      their own modules.
--   6. LMS repair: the cloud still has the 2026-07-14 assignments/submissions
--      shape (the 07-29 "create table if not exists" never added its columns),
--      so grading failed. Add the missing columns + assignment RPCs.
--   7. Private bucket 'course-files' with path-scoped access:
--        materials/<course_id>/…, assignments/<course_id>/…  (lecturer writes,
--        enrolled students read) and submissions/<assignment_id>/<student_id>/…
--        (the student writes their own, the module's lecturer reads).
--
-- Builds on can_teach()/my_staff_id() (20260927120000). Idempotent.
-- ============================================================================

-- ---- helpers ----------------------------------------------------------------
create or replace function public.my_student_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.students where user_id = auth.uid() limit 1;
$$;

create or replace function public.is_enrolled(p_course_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.enrolments e
                 where e.course_id = p_course_id
                   and e.student_id = public.my_student_id()
                   and e.status <> 'dropped');
$$;

-- attendance % of one student on one module (0 when no sessions yet)
create or replace function public.attendance_pct(p_student uuid, p_course uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select case when coalesce(sum(a.hours), 0) = 0 then 0
              else round(100 * coalesce(sum(a.hours) filter (where a.present), 0) / sum(a.hours), 1) end
  from public.attendance a
  where a.student_id = p_student and a.course_id = p_course;
$$;

-- ============================================================================
-- 1. COHORT ENROLMENT
-- ============================================================================
-- Cohorts that exist in the student register, with how far their enrolment is.
create or replace function public.enrolment_cohorts()
returns table (programme_id uuid, programme text, academic_year int, intake text,
               students bigint, modules bigint, enrolments bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_suite_role('registrar') then raise exception 'not authorized'; end if;
  return query
    select p.id, p.name, s.academic_year, s.intake,
           count(distinct s.id),
           (select count(*) from public.courses c where c.programme_id = p.id),
           (select count(*) from public.enrolments e
              join public.students s2 on s2.id = e.student_id
             where s2.programme_id = p.id and s2.academic_year is not distinct from s.academic_year
               and s2.intake is not distinct from s.intake)
    from public.students s
    join public.programmes p on p.id = s.programme_id
    where s.status = 'enrolled'
    group by p.id, p.name, s.academic_year, s.intake
    order by s.academic_year desc nulls last, p.name, s.intake;
end $$;

-- Enrol every 'enrolled' student of a cohort on their programme's modules.
-- Programmes whose semesters are labelled "Y1 S1", "Y2 S2"… only get the
-- modules of the student's year of study; all others get every module.
-- p_dry_run = true only counts.
create or replace function public.enrol_cohort(
  p_programme uuid, p_academic_year int, p_intake text, p_dry_run boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_students int; v_courses int; v_pairs int; v_created int := 0; v_by_year boolean;
begin
  if not public.has_suite_role('registrar') then raise exception 'not authorized'; end if;

  select exists (select 1 from public.courses where programme_id = p_programme and semester ~ '^Y[0-9]')
    into v_by_year;

  create temp table if not exists _enrol_pairs (student_id uuid, course_id uuid, semester text,
    tenant_id uuid, exists_already boolean) on commit drop;
  truncate _enrol_pairs;

  insert into _enrol_pairs
  select s.id, c.id, c.semester, s.tenant_id,
         exists (select 1 from public.enrolments e where e.student_id = s.id and e.course_id = c.id)
  from public.students s
  join public.courses c on c.programme_id = s.programme_id
  where s.programme_id = p_programme
    and s.status = 'enrolled'
    and s.academic_year is not distinct from p_academic_year
    and s.intake is not distinct from p_intake
    and (not v_by_year or c.semester ~ ('^Y' || coalesce(s.year, 1) || '( |$)'));

  select count(distinct student_id), count(distinct course_id), count(*)
    into v_students, v_courses, v_pairs from _enrol_pairs;

  if not p_dry_run then
    insert into public.enrolments (tenant_id, student_id, course_id, semester, status, charge, intake, academic_year)
    select tenant_id, student_id, course_id, semester, 'registered', 0, p_intake, p_academic_year
    from _enrol_pairs where not exists_already;
    get diagnostics v_created = row_count;

    update public.courses c
      set enrolled = (select count(*) from public.enrolments e where e.course_id = c.id and e.status <> 'dropped')
      where c.programme_id = p_programme;
  end if;

  return jsonb_build_object('ok', true, 'dry_run', p_dry_run, 'students', v_students, 'courses', v_courses,
    'pairs', v_pairs, 'already', (select count(*) from _enrol_pairs where exists_already),
    'created', v_created);
end $$;

-- ============================================================================
-- 2. STUDENT'S OWN MODULES
-- ============================================================================
create or replace function public.student_courses()
returns table (course_id uuid, code text, title text, semester text, credits int,
               lecturer text, status text, attendance numeric)
language sql stable security definer set search_path = public as $$
  select c.id, c.code, c.title, c.semester, c.credits, st.name, e.status,
         public.attendance_pct(e.student_id, c.id)
  from public.enrolments e
  join public.courses c on c.id = e.course_id
  left join public.staff st on st.id = c.lecturer_staff_id
  where e.student_id = public.my_student_id() and e.status <> 'dropped'
  order by c.semester nulls last, c.code;
$$;

-- ============================================================================
-- 3. QUERIES — only about a module you are enrolled on
-- ============================================================================
create or replace function public.create_query(p_course_code text, p_subject text, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_student uuid; v_course uuid; v_lect uuid;
begin
  v_student := public.my_student_id();
  if v_student is null then raise exception 'no student record for current user'; end if;
  select id, lecturer_staff_id into v_course, v_lect from public.courses where code = p_course_code;
  if v_course is null then raise exception 'module not found'; end if;
  if not exists (select 1 from public.enrolments where student_id = v_student and course_id = v_course and status <> 'dropped') then
    raise exception 'you are not enrolled on %', p_course_code;
  end if;
  if coalesce(trim(p_subject), '') = '' or coalesce(trim(p_body), '') = '' then
    raise exception 'subject and question are required';
  end if;
  insert into public.queries (course_id, student_id, lecturer_staff_id, subject, body)
  values (v_course, v_student, v_lect, trim(p_subject), trim(p_body));
  return jsonb_build_object('ok', true);
end $$;

-- ============================================================================
-- 4. ATTENDANCE PER MODULE
-- ============================================================================
create or replace function public.course_attendance(p_course_code text)
returns table (student_id uuid, student text, percent numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_course uuid;
begin
  select c.id into v_course from public.courses c where c.code = p_course_code;
  if v_course is null or not public.can_teach(v_course) then raise exception 'not authorized'; end if;
  return query
    select s.id, s.full_name, public.attendance_pct(s.id, v_course)
    from public.enrolments e
    join public.students s on s.id = e.student_id
    where e.course_id = v_course and e.status <> 'dropped'
    order by s.full_name;
end $$;

-- One register per module per day: re-saving the same date replaces it.
drop function if exists public.record_attendance_session(text, jsonb);
create or replace function public.record_attendance_session(
  p_course_code text, p_present jsonb, p_date date default null, p_hours numeric default 1)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_course uuid; v_date date := coalesce(p_date, current_date); rec jsonb; v_sid uuid; v_n int := 0;
begin
  select id into v_course from public.courses where code = p_course_code;
  if v_course is null then return jsonb_build_object('ok', false, 'message', 'course not found'); end if;
  if not public.can_teach(v_course) then raise exception 'not authorized'; end if;
  if v_date > current_date then raise exception 'cannot record attendance for a future date'; end if;

  for rec in select * from jsonb_array_elements(coalesce(p_present, '[]'::jsonb)) loop
    v_sid := (rec->>'student_id')::uuid;
    if not exists (select 1 from public.enrolments e where e.course_id = v_course and e.student_id = v_sid) then
      continue;
    end if;
    delete from public.attendance where course_id = v_course and student_id = v_sid and session_date = v_date;
    insert into public.attendance (student_id, course_id, session_date, hours, present, recorded_by)
    values (v_sid, v_course, v_date, coalesce(p_hours, 1), coalesce((rec->>'present')::boolean, true), auth.uid());
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'recorded', v_n, 'date', v_date);
end $$;

-- Dates already recorded for a module (so the lecturer sees the register history).
create or replace function public.course_attendance_sessions(p_course_code text)
returns table (session_date date, present bigint, total bigint)
language plpgsql stable security definer set search_path = public as $$
declare v_course uuid;
begin
  select c.id into v_course from public.courses c where c.code = p_course_code;
  if v_course is null or not public.can_teach(v_course) then raise exception 'not authorized'; end if;
  return query
    select a.session_date, count(*) filter (where a.present), count(*)
    from public.attendance a where a.course_id = v_course
    group by a.session_date order by a.session_date desc;
end $$;

-- 80% rule per module.
create or replace function public.exam_admission_ok_course(p_student uuid, p_course uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.attendance_pct(p_student, p_course) >= 80;
$$;

-- ============================================================================
-- 5. ANNOUNCEMENTS PER MODULE
-- ============================================================================
alter table public.announcements add column if not exists course_id uuid references public.courses(id) on delete cascade;
create index if not exists announcements_course_idx on public.announcements (course_id);

drop policy if exists "announcements admin all" on public.announcements;
drop policy if exists "announcements read" on public.announcements;
drop policy if exists "announcements read scoped" on public.announcements;
drop policy if exists "announcements write scoped" on public.announcements;
create policy "announcements read scoped" on public.announcements for select using (
  public.is_admin()
  or (course_id is null and audience in ('students', 'all'))
  or (course_id is not null and public.is_enrolled(course_id)));
create policy "announcements write scoped" on public.announcements for all
  using (public.has_suite_role('registrar') or (course_id is not null and public.can_teach(course_id)))
  with check (public.has_suite_role('registrar') or (course_id is not null and public.can_teach(course_id)));

-- ============================================================================
-- 6. LMS REPAIR + ASSIGNMENT RPCS
-- ============================================================================
alter table public.assignments add column if not exists description text;
alter table public.assignments add column if not exists file_path   text;
alter table public.assignments add column if not exists created_by  uuid references auth.users(id);
alter table public.submissions add column if not exists submitted_at timestamptz not null default now();
alter table public.submissions add column if not exists file_path    text;
alter table public.submissions add column if not exists note         text;
alter table public.submissions add column if not exists feedback     text;
alter table public.submissions add column if not exists graded_by    uuid references auth.users(id);
alter table public.submissions add column if not exists graded_at    timestamptz;
alter table public.courseware  add column if not exists file_path    text;

-- materials: now also carry an uploaded file
drop function if exists public.courseware_upsert(uuid, uuid, text, text);
create or replace function public.courseware_upsert(
  p_id uuid, p_course uuid, p_title text, p_url text, p_file_path text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_old uuid;
begin
  if not public.can_teach(p_course) then raise exception 'not authorized'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'title required'; end if;
  if p_id is null then
    insert into public.courseware (course_id, title, url, file_path)
    values (p_course, trim(p_title), nullif(trim(p_url), ''), nullif(p_file_path, '')) returning id into v_id;
  else
    select course_id into v_old from public.courseware where id = p_id;
    if v_old is null or not public.can_teach(v_old) then raise exception 'not authorized'; end if;
    update public.courseware set course_id = p_course, title = trim(p_title), url = nullif(trim(p_url), ''),
      file_path = coalesce(nullif(p_file_path, ''), file_path)
      where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;

drop function if exists public.courseware_list(uuid);
create or replace function public.courseware_list(p_course uuid)
returns table (id uuid, title text, url text, file_path text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.can_teach(p_course) or public.is_enrolled(p_course)) then raise exception 'not authorized'; end if;
  return query select w.id, w.title, w.url, w.file_path, w.created_at
    from public.courseware w where w.course_id = p_course order by w.created_at;
end $$;

create or replace function public.assignment_upsert(
  p_id uuid, p_course uuid, p_title text, p_description text, p_due date,
  p_max_marks int default 100, p_file_path text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_old uuid;
begin
  if not public.can_teach(p_course) then raise exception 'not authorized'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'title required'; end if;
  if p_id is null then
    insert into public.assignments (course_id, title, description, due, max_marks, file_path, created_by)
    values (p_course, trim(p_title), nullif(trim(p_description), ''), p_due, coalesce(p_max_marks, 100),
            nullif(p_file_path, ''), auth.uid())
    returning id into v_id;
  else
    select course_id into v_old from public.assignments where id = p_id;
    if v_old is null or not public.can_teach(v_old) then raise exception 'not authorized'; end if;
    update public.assignments set title = trim(p_title), description = nullif(trim(p_description), ''),
      due = p_due, max_marks = coalesce(p_max_marks, 100), file_path = coalesce(nullif(p_file_path, ''), file_path)
      where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.assignment_delete(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_course uuid;
begin
  select course_id into v_course from public.assignments where id = p_id;
  if v_course is null then return; end if;
  if not public.can_teach(v_course) then raise exception 'not authorized'; end if;
  delete from public.assignments where id = p_id;
end $$;

-- Assignments of a module. Lecturer: submission counts. Student: their own submission.
create or replace function public.assignments_list(p_course uuid)
returns table (id uuid, title text, description text, due date, max_marks int, file_path text,
               created_at timestamptz, submissions bigint, graded bigint,
               my_submitted_at timestamptz, my_file_path text, my_note text,
               my_grade numeric, my_feedback text, my_graded_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_teach boolean := public.can_teach(p_course); v_me uuid := public.my_student_id();
begin
  if not (v_teach or public.is_enrolled(p_course)) then raise exception 'not authorized'; end if;
  return query
    select a.id, a.title, a.description, a.due, a.max_marks, a.file_path, a.created_at,
           case when v_teach then (select count(*) from public.submissions s where s.assignment_id = a.id) end,
           case when v_teach then (select count(*) from public.submissions s where s.assignment_id = a.id and s.graded_at is not null) end,
           m.submitted_at, m.file_path, m.note, m.grade, m.feedback, m.graded_at
    from public.assignments a
    left join public.submissions m on m.assignment_id = a.id and m.student_id = v_me
    where a.course_id = p_course
    order by a.due nulls last, a.created_at;
end $$;

-- Lecturer: every submission of one assignment.
create or replace function public.submissions_list(p_assignment uuid)
returns table (id uuid, student_id uuid, student text, student_no text, submitted_at timestamptz,
               file_path text, note text, grade numeric, feedback text, graded_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_course uuid;
begin
  select a.course_id into v_course from public.assignments a where a.id = p_assignment;
  if v_course is null or not public.can_teach(v_course) then raise exception 'not authorized'; end if;
  return query
    select s.id, st.id, st.full_name, st.student_no, s.submitted_at, s.file_path, s.note, s.grade, s.feedback, s.graded_at
    from public.submissions s join public.students st on st.id = s.student_id
    where s.assignment_id = p_assignment order by st.full_name;
end $$;

-- Student submits (or re-submits until it has been graded).
drop function if exists public.submit_assignment(uuid);
create or replace function public.submit_assignment(p_assignment uuid, p_file_path text default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_student uuid := public.my_student_id(); v_course uuid; v_graded timestamptz;
begin
  if v_student is null then raise exception 'no student record for current user'; end if;
  select course_id into v_course from public.assignments where id = p_assignment;
  if v_course is null then raise exception 'assignment not found'; end if;
  if not public.is_enrolled(v_course) then raise exception 'you are not enrolled on this module'; end if;
  if coalesce(p_file_path, '') = '' and coalesce(trim(p_note), '') = '' then raise exception 'attach a file or write an answer'; end if;
  select graded_at into v_graded from public.submissions where assignment_id = p_assignment and student_id = v_student;
  if v_graded is not null then raise exception 'already graded — ask your lecturer to reopen it'; end if;

  insert into public.submissions (assignment_id, student_id, file_path, note, submitted_at)
  values (p_assignment, v_student, nullif(p_file_path, ''), nullif(trim(p_note), ''), now())
  on conflict (student_id, assignment_id) do update
    set file_path = coalesce(excluded.file_path, public.submissions.file_path),
        note = excluded.note, submitted_at = now();
  return jsonb_build_object('ok', true);
end $$;

-- grading: validate the mark against the assignment's maximum
create or replace function public.grade_submission(p_submission uuid, p_grade numeric, p_feedback text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_course uuid; v_max int;
begin
  select a.course_id, a.max_marks into v_course, v_max
    from public.submissions s join public.assignments a on a.id = s.assignment_id
    where s.id = p_submission;
  if v_course is null or not public.can_teach(v_course) then raise exception 'not authorized'; end if;
  if p_grade is not null and (p_grade < 0 or p_grade > coalesce(v_max, 100)) then
    raise exception 'mark must be between 0 and %', coalesce(v_max, 100);
  end if;
  update public.submissions
    set grade = p_grade, feedback = nullif(trim(p_feedback), ''), graded_by = auth.uid(),
        graded_at = case when p_grade is null then null else now() end
    where id = p_submission;
  return jsonb_build_object('ok', found);
end $$;

-- ============================================================================
-- 7. FILES — private bucket 'course-files', access decided by the path
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('course-files', 'course-files', false, 26214400)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

create or replace function public.course_file_access(p_name text, p_write boolean)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare parts text[] := string_to_array(p_name, '/'); v_course uuid; v_assignment uuid; v_student uuid;
begin
  if array_length(parts, 1) < 3 then return false; end if;
  if parts[1] in ('materials', 'assignments') then
    v_course := parts[2]::uuid;
    if p_write then return public.can_teach(v_course); end if;
    return public.can_teach(v_course) or public.is_enrolled(v_course);
  elsif parts[1] = 'submissions' and array_length(parts, 1) >= 4 then
    v_assignment := parts[2]::uuid; v_student := parts[3]::uuid;
    select course_id into v_course from public.assignments where id = v_assignment;
    if v_course is null then return false; end if;
    if v_student = public.my_student_id() and public.is_enrolled(v_course) then return true; end if;
    return (not p_write) and public.can_teach(v_course);
  end if;
  return false;
exception when others then
  return false;   -- malformed path / uuid
end $$;

drop policy if exists "course-files read" on storage.objects;
drop policy if exists "course-files insert" on storage.objects;
drop policy if exists "course-files update" on storage.objects;
drop policy if exists "course-files delete" on storage.objects;
create policy "course-files read" on storage.objects for select to authenticated
  using (bucket_id = 'course-files' and public.course_file_access(name, false));
create policy "course-files insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'course-files' and public.course_file_access(name, true));
create policy "course-files update" on storage.objects for update to authenticated
  using (bucket_id = 'course-files' and public.course_file_access(name, true))
  with check (bucket_id = 'course-files' and public.course_file_access(name, true));
create policy "course-files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'course-files' and public.course_file_access(name, true));

-- ============================================================================
-- grants: signed-in users only
-- ============================================================================
do $$
declare fn text;
begin
  foreach fn in array array[
    'my_student_id()', 'is_enrolled(uuid)', 'attendance_pct(uuid,uuid)',
    'enrolment_cohorts()', 'enrol_cohort(uuid,int,text,boolean)', 'student_courses()',
    'create_query(text,text,text)', 'course_attendance(text)',
    'record_attendance_session(text,jsonb,date,numeric)', 'course_attendance_sessions(text)',
    'exam_admission_ok_course(uuid,uuid)',
    'courseware_upsert(uuid,uuid,text,text,text)', 'courseware_list(uuid)',
    'assignment_upsert(uuid,uuid,text,text,date,int,text)', 'assignment_delete(uuid)',
    'assignments_list(uuid)', 'submissions_list(uuid)', 'submit_assignment(uuid,text,text)',
    'grade_submission(uuid,numeric,text)', 'course_file_access(text,boolean)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;

notify pgrst, 'reload schema';
