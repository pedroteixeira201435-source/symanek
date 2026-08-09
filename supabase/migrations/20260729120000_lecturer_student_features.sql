-- ============================================================================
-- Symanek Suite — Phase 1 (cont.): real backend for the lecturer↔student
-- features that shipped as mock UI in the 2026 experience pass:
--   • Marks: lecturer marksheet read / save (provisional) / publish
--   • Attendance: per-course session register that feeds the 80% permit rule
--   • LMS: assignment submissions + grading with written feedback
--   • Queries: two-way student→lecturer question/answer channel
--
-- Builds on 20260714130000_suite_core.sql (courses/enrolments/results/staff)
-- and 20260728130000_feedback_features.sql (attendance/attendance_summary,
-- results.exam2/outcome, announcements). is_admin() already covers admin+staff,
-- so lecturers (profiles.role = 'staff') can drive the staff-side RPCs.
--
-- Publish REUSES public.publish_exam_results() (grading-formula fix migration):
--   final = 60% CA + 40% exam; pass = final>=50 AND exam>=40; 45–49% or
--   (final>=50 AND exam<40) = second opportunity; else fail.
--
-- Idempotent where practical. Ends with notify pgrst so PostgREST reloads.
-- NOTE: written against the existing schema/conventions but NOT yet validated
-- against a live database — smoke-test on the first `supabase db push`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- MARKS
-- ---------------------------------------------------------------------------

-- Read the marksheet for a course (staff only). Returns one row per enrolled
-- student, joined to any existing result. Frontend keys by student_id.
create or replace function public.course_marksheet(p_course_code text)
returns table (student_id uuid, student text, ca numeric, exam numeric, exam2 numeric,
               final numeric, grade text, published boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
    select s.id, s.full_name, r.ca, r.exam, r.exam2, r.final, r.grade, coalesce(r.published, false)
    from public.courses c
    join public.enrolments e on e.course_id = c.id
    join public.students   s on s.id = e.student_id
    left join public.results r on r.enrolment_id = e.id
    where c.code = p_course_code
    order by s.full_name;
end $$;
grant execute on function public.course_marksheet(text) to authenticated;

-- Save CA/exam/exam2 for a course (provisional — published stays false).
-- p_marks = [{ "student_id": uuid, "ca": num, "exam": num, "exam2": num|null }, ...]
-- Recomputes final + letter grade so the student sees a provisional final mark.
create or replace function public.save_course_marks(p_course_code text, p_marks jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_course uuid; m jsonb; v_enr uuid;
  v_ca numeric; v_exam numeric; v_exam2 numeric; v_final numeric; v_grade text; v_n int := 0;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select id into v_course from public.courses where code = p_course_code;
  if v_course is null then return jsonb_build_object('ok', false, 'message', 'course not found'); end if;

  for m in select * from jsonb_array_elements(coalesce(p_marks, '[]'::jsonb)) loop
    select e.id into v_enr from public.enrolments e
      where e.course_id = v_course and e.student_id = (m->>'student_id')::uuid;
    if v_enr is null then continue; end if;

    v_ca    := nullif(m->>'ca', '')::numeric;
    v_exam  := nullif(m->>'exam', '')::numeric;
    v_exam2 := nullif(m->>'exam2', '')::numeric;
    v_final := round(0.6 * coalesce(v_ca, 0) + 0.4 * coalesce(v_exam, 0), 2);
    v_grade := case when v_final >= 80 then 'A' when v_final >= 70 then 'B'
                    when v_final >= 60 then 'C' when v_final >= 50 then 'D' else 'F' end;

    update public.results
      set ca = v_ca, exam = v_exam, exam2 = v_exam2, final = v_final, grade = v_grade
      where enrolment_id = v_enr;
    if not found then
      insert into public.results (enrolment_id, ca, exam, exam2, final, grade, published)
      values (v_enr, v_ca, v_exam, v_exam2, v_final, v_grade, false);
    end if;
    v_n := v_n + 1;
  end loop;

  return jsonb_build_object('ok', true, 'saved', v_n);
end $$;
grant execute on function public.save_course_marks(text, jsonb) to authenticated;

-- Publish a course by code — thin wrapper over the authoritative engine.
create or replace function public.publish_course_results(p_course_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_course uuid;
begin
  select id into v_course from public.courses where code = p_course_code;
  if v_course is null then return jsonb_build_object('ok', false, 'message', 'course not found'); end if;
  return public.publish_exam_results(v_course);   -- is_admin() gated inside
end $$;
grant execute on function public.publish_course_results(text) to authenticated;

-- ---------------------------------------------------------------------------
-- ATTENDANCE — per-course session register (writes to public.attendance,
-- which feeds public.attendance_summary + public.exam_admission_ok)
-- ---------------------------------------------------------------------------

-- Record one session for a course. p_present = [{ "student_id": uuid, "present": bool }, ...]
create or replace function public.record_attendance_session(p_course_code text, p_present jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_course uuid; rec jsonb; v_n int := 0;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select id into v_course from public.courses where code = p_course_code;
  if v_course is null then return jsonb_build_object('ok', false, 'message', 'course not found'); end if;

  for rec in select * from jsonb_array_elements(coalesce(p_present, '[]'::jsonb)) loop
    insert into public.attendance (student_id, course_id, session_date, hours, present, recorded_by)
    values ((rec->>'student_id')::uuid, v_course, current_date, 1,
            coalesce((rec->>'present')::boolean, true), auth.uid());
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'recorded', v_n);
end $$;
grant execute on function public.record_attendance_session(text, jsonb) to authenticated;

-- Current attendance % for every student on a course (staff view of the register).
create or replace function public.course_attendance(p_course_code text)
returns table (student_id uuid, student text, percent numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
    select s.id, s.full_name, coalesce(a.percent, 0)
    from public.courses c
    join public.enrolments e on e.course_id = c.id
    join public.students   s on s.id = e.student_id
    left join public.attendance_summary a on a.student_id = s.id
    where c.code = p_course_code
    order by s.full_name;
end $$;
grant execute on function public.course_attendance(text) to authenticated;

-- ---------------------------------------------------------------------------
-- LMS — assignments + submissions with grading & feedback
-- ---------------------------------------------------------------------------
create table if not exists public.assignments (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references public.institutions(id),
  course_id  uuid not null references public.courses(id) on delete cascade,
  code       text,                       -- external id used by the UI (e.g. VTW101-A1)
  title      text not null,
  due_date   date,
  points     int not null default 100,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists assignments_course_idx on public.assignments (course_id);

create table if not exists public.submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id    uuid not null references public.students(id) on delete cascade,
  submitted_at  timestamptz not null default now(),
  grade         numeric(5,2),
  feedback      text,
  graded_by     uuid references auth.users(id),
  graded_at     timestamptz,
  unique (assignment_id, student_id)
);
create index if not exists submissions_assignment_idx on public.submissions (assignment_id);

-- Student submits (idempotent). Resolves the current user's student record.
create or replace function public.submit_assignment(p_assignment uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_student uuid;
begin
  select id into v_student from public.students where user_id = auth.uid();
  if v_student is null then raise exception 'no student record for current user'; end if;
  insert into public.submissions (assignment_id, student_id)
  values (p_assignment, v_student)
  on conflict (assignment_id, student_id) do nothing;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.submit_assignment(uuid) to authenticated;

-- Lecturer grades a submission with a mark + written feedback.
create or replace function public.grade_submission(p_submission uuid, p_grade numeric, p_feedback text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.submissions
    set grade = p_grade, feedback = p_feedback, graded_by = auth.uid(), graded_at = now()
    where id = p_submission;
  return jsonb_build_object('ok', found);
end $$;
grant execute on function public.grade_submission(uuid, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- QUERIES — two-way student ↔ lecturer channel
-- ---------------------------------------------------------------------------
create table if not exists public.queries (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid references public.institutions(id),
  course_id         uuid references public.courses(id) on delete set null,
  student_id        uuid not null references public.students(id) on delete cascade,
  lecturer_staff_id uuid references public.staff(id) on delete set null,
  subject           text not null,
  body              text not null,
  reply             text,
  status            text not null default 'open' check (status in ('open','answered')),
  created_at        timestamptz not null default now(),
  replied_at        timestamptz
);
create index if not exists queries_student_idx  on public.queries (student_id);
create index if not exists queries_lecturer_idx on public.queries (lecturer_staff_id);

-- Student raises a question about one of their courses (routes to its lecturer).
create or replace function public.create_query(p_course_code text, p_subject text, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_student uuid; v_course uuid; v_lect uuid;
begin
  select id into v_student from public.students where user_id = auth.uid();
  if v_student is null then raise exception 'no student record for current user'; end if;
  select id, lecturer_staff_id into v_course, v_lect from public.courses where code = p_course_code;
  insert into public.queries (course_id, student_id, lecturer_staff_id, subject, body)
  values (v_course, v_student, v_lect, trim(p_subject), trim(p_body));
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.create_query(text, text, text) to authenticated;

-- Lecturer replies (marks it answered).
create or replace function public.reply_query(p_id uuid, p_reply text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.queries set reply = p_reply, status = 'answered', replied_at = now() where id = p_id;
  return jsonb_build_object('ok', found);
end $$;
grant execute on function public.reply_query(uuid, text) to authenticated;

-- ============================================================================
-- Row Level Security for the new tables
-- ============================================================================
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.queries     enable row level security;

-- admin/staff manage everything
drop policy if exists "assignments admin all" on public.assignments;
create policy "assignments admin all" on public.assignments for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "submissions admin all" on public.submissions;
create policy "submissions admin all" on public.submissions for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "queries admin all" on public.queries;
create policy "queries admin all"     on public.queries     for all using (public.is_admin()) with check (public.is_admin());

-- students read assignments for courses they are enrolled in
drop policy if exists "assignments student read" on public.assignments;
create policy "assignments student read" on public.assignments for select using (
  exists (select 1 from public.enrolments e join public.students s on s.id = e.student_id
          where e.course_id = assignments.course_id and s.user_id = auth.uid()));

-- students read + create their own submissions
drop policy if exists "submissions owner read" on public.submissions;
create policy "submissions owner read" on public.submissions for select using (
  exists (select 1 from public.students s where s.id = submissions.student_id and s.user_id = auth.uid()));
drop policy if exists "submissions owner insert" on public.submissions;
create policy "submissions owner insert" on public.submissions for insert to authenticated with check (
  exists (select 1 from public.students s where s.id = submissions.student_id and s.user_id = auth.uid()));

-- students read + create their own queries
drop policy if exists "queries owner read" on public.queries;
create policy "queries owner read" on public.queries for select using (
  exists (select 1 from public.students s where s.id = queries.student_id and s.user_id = auth.uid()));
drop policy if exists "queries owner insert" on public.queries;
create policy "queries owner insert" on public.queries for insert to authenticated with check (
  exists (select 1 from public.students s where s.id = queries.student_id and s.user_id = auth.uid()));

notify pgrst, 'reload schema';
