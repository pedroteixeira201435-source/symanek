-- ============================================================================
-- Symanek Suite — module registration per academic year, semester and intake.
--
-- Asked by the administrator (2026-10-02): "register the student's modules so
-- that they can only see the modules they registered that academic year,
-- semester and intake".
--
--   1. enrolments.semester_no (1 | 2 | null = year-long). Derived from the
--      course label ("S1", "Y2 S2" → 1/2; "S1&S2"/blank → null) by a trigger on
--      every insert path (cohort, individual, student self-registration), and
--      backfilled for existing rows. Missing academic_year/intake are copied
--      from the student.
--   2. One registration per student + module + academic year (was student +
--      module + course label, which blocked repeating a module next year).
--   3. enrol_cohort(…, p_semester): register a class for ONE semester (plus its
--      year-long modules); "already registered" now means in that academic year.
--      enrolment_cohorts() also reports registrations per semester.
--   4. Registrar tools for one student: student_enrolments, enrol_student_module
--      (also re-activates a dropped registration), drop_enrolment.
--   5. student_courses(p_all): by default only the student's CURRENT period —
--      their latest academic year and, within it, their latest semester (plus
--      year-long modules). p_all = true returns the full history.
--
-- Idempotent.
-- ============================================================================

-- ---- 1. semester number ------------------------------------------------------
alter table public.enrolments add column if not exists semester_no smallint;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'enrolments_semester_no_check') then
    alter table public.enrolments add constraint enrolments_semester_no_check check (semester_no in (1, 2));
  end if;
end $$;

-- "S1" → 1, "Y2 S2" → 2, "S1&S2" / null / anything else → null (year-long)
create or replace function public.course_semester_no(p_label text)
returns smallint language sql immutable as $$
  select case
    when p_label ~* '(^|\s)S1$' then 1::smallint
    when p_label ~* '(^|\s)S2$' then 2::smallint
    else null end;
$$;

create or replace function public.enrolments_fill_period()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.semester_no is null then
    select public.course_semester_no(c.semester) into new.semester_no from public.courses c where c.id = new.course_id;
  end if;
  if new.academic_year is null or new.intake is null then
    select coalesce(new.academic_year, s.academic_year), coalesce(new.intake, s.intake)
      into new.academic_year, new.intake
      from public.students s where s.id = new.student_id;
  end if;
  return new;
end $$;

drop trigger if exists enrolments_fill_period on public.enrolments;
create trigger enrolments_fill_period before insert on public.enrolments
  for each row execute function public.enrolments_fill_period();

update public.enrolments e set semester_no = public.course_semester_no(c.semester)
  from public.courses c where c.id = e.course_id and e.semester_no is null;
update public.enrolments e set academic_year = coalesce(e.academic_year, s.academic_year),
                               intake = coalesce(e.intake, s.intake)
  from public.students s where s.id = e.student_id and (e.academic_year is null or e.intake is null);

-- ---- 2. one registration per module per academic year -------------------------
alter table public.enrolments drop constraint if exists enrolments_student_id_course_id_semester_key;
create unique index if not exists enrolments_student_course_year_uq
  on public.enrolments (student_id, course_id, coalesce(academic_year, 0));

-- ---- 3. cohort registration by semester ----------------------------------------
drop function if exists public.enrolment_cohorts();
create or replace function public.enrolment_cohorts()
returns table (programme_id uuid, programme text, academic_year int, intake text,
               students bigint, modules bigint, enrolments bigint,
               s1_enrolments bigint, s2_enrolments bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_suite_role('registrar') then raise exception 'not authorized'; end if;
  return query
    select p.id, p.name, s.academic_year, s.intake,
           count(distinct s.id),
           (select count(*) from public.courses c where c.programme_id = p.id),
           count(e.id) filter (where e.id is not null),
           count(e.id) filter (where e.semester_no = 1),
           count(e.id) filter (where e.semester_no = 2)
    from public.students s
    join public.programmes p on p.id = s.programme_id
    left join public.enrolments e on e.student_id = s.id and e.status <> 'dropped'
                                 and e.academic_year is not distinct from s.academic_year
    where s.status = 'enrolled'
    group by p.id, p.name, s.academic_year, s.intake
    order by s.academic_year desc nulls last, p.name, s.intake;
end $$;

drop function if exists public.enrol_cohort(uuid, int, text, boolean);
create or replace function public.enrol_cohort(
  p_programme uuid, p_academic_year int, p_intake text,
  p_semester int default null, p_dry_run boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_students int; v_courses int; v_pairs int; v_created int := 0; v_by_year boolean;
begin
  if not public.has_suite_role('registrar') then raise exception 'not authorized'; end if;
  if p_semester is not null and p_semester not in (1, 2) then raise exception 'semester must be 1 or 2'; end if;

  select exists (select 1 from public.courses where programme_id = p_programme and semester ~ '^Y[0-9]')
    into v_by_year;

  create temp table if not exists _enrol_pairs (student_id uuid, course_id uuid, semester text,
    semester_no smallint, tenant_id uuid, exists_already boolean) on commit drop;
  truncate _enrol_pairs;

  insert into _enrol_pairs
  select s.id, c.id, c.semester, public.course_semester_no(c.semester), s.tenant_id,
         exists (select 1 from public.enrolments e
                  where e.student_id = s.id and e.course_id = c.id
                    and coalesce(e.academic_year, 0) = coalesce(p_academic_year, 0))
  from public.students s
  join public.courses c on c.programme_id = s.programme_id
  where s.programme_id = p_programme
    and s.status = 'enrolled'
    and s.academic_year is not distinct from p_academic_year
    and s.intake is not distinct from p_intake
    and (not v_by_year or c.semester ~ ('^Y' || coalesce(s.year, 1) || '( |$)'))
    and (p_semester is null or public.course_semester_no(c.semester) is null
         or public.course_semester_no(c.semester) = p_semester);

  select count(distinct student_id), count(distinct course_id), count(*)
    into v_students, v_courses, v_pairs from _enrol_pairs;

  if not p_dry_run then
    insert into public.enrolments (tenant_id, student_id, course_id, semester, semester_no, status, charge, intake, academic_year)
    select tenant_id, student_id, course_id, semester, semester_no, 'registered', 0, p_intake, p_academic_year
    from _enrol_pairs where not exists_already;
    get diagnostics v_created = row_count;

    update public.courses c
      set enrolled = (select count(*) from public.enrolments e where e.course_id = c.id and e.status <> 'dropped')
      where c.programme_id = p_programme;
  end if;

  return jsonb_build_object('ok', true, 'dry_run', p_dry_run, 'semester', p_semester,
    'students', v_students, 'courses', v_courses, 'pairs', v_pairs,
    'already', (select count(*) from _enrol_pairs where exists_already),
    'created', v_created);
end $$;

-- ---- 4. one student's registrations (registrar) --------------------------------
create or replace function public.student_enrolments(p_student uuid)
returns table (id uuid, course_id uuid, code text, title text, course_semester text, credits int,
               academic_year int, semester_no smallint, intake text, status text, has_result boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_suite_role('registrar') then raise exception 'not authorized'; end if;
  return query
    select e.id, c.id, c.code, c.title, c.semester, c.credits,
           e.academic_year, e.semester_no, e.intake, e.status,
           exists (select 1 from public.results r where r.enrolment_id = e.id)
    from public.enrolments e
    join public.courses c on c.id = e.course_id
    where e.student_id = p_student
    order by e.academic_year desc nulls last, e.semester_no nulls first, c.code;
end $$;

create or replace function public.enrol_student_module(
  p_student uuid, p_course uuid, p_academic_year int, p_semester int default null, p_intake text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_student public.students; v_course public.courses; v_existing public.enrolments; v_sem smallint;
begin
  if not public.has_suite_role('registrar') then raise exception 'not authorized'; end if;
  select * into v_student from public.students where id = p_student;
  if v_student.id is null then raise exception 'student not found'; end if;
  select * into v_course from public.courses where id = p_course;
  if v_course.id is null then raise exception 'module not found'; end if;
  if p_academic_year is null then raise exception 'academic year is required'; end if;
  if p_semester is not null and p_semester not in (1, 2) then raise exception 'semester must be 1 or 2'; end if;
  if p_intake is not null and p_intake not in ('january', 'july') then raise exception 'intake must be january or july'; end if;
  v_sem := coalesce(p_semester, public.course_semester_no(v_course.semester));

  select * into v_existing from public.enrolments
   where student_id = p_student and course_id = p_course and coalesce(academic_year, 0) = p_academic_year;
  if v_existing.id is not null then
    if v_existing.status <> 'dropped' then
      raise exception '% is already registered for % in %', v_student.full_name, v_course.code, p_academic_year;
    end if;
    update public.enrolments
       set status = 'registered', semester_no = v_sem, intake = coalesce(p_intake, v_student.intake)
     where id = v_existing.id;
  else
    insert into public.enrolments (tenant_id, student_id, course_id, semester, semester_no, status, charge, intake, academic_year)
    values (v_student.tenant_id, p_student, p_course, v_course.semester, v_sem, 'registered', 0,
            coalesce(p_intake, v_student.intake), p_academic_year);
  end if;

  update public.courses c
     set enrolled = (select count(*) from public.enrolments e where e.course_id = c.id and e.status <> 'dropped')
   where c.id = p_course;
  return jsonb_build_object('ok', true, 'code', v_course.code, 'reactivated', v_existing.id is not null);
end $$;

create or replace function public.drop_enrolment(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_course uuid;
begin
  if not public.has_suite_role('registrar') then raise exception 'not authorized'; end if;
  if exists (select 1 from public.results r where r.enrolment_id = p_id and r.published) then
    raise exception 'this module already has published results and cannot be removed';
  end if;
  update public.enrolments set status = 'dropped' where id = p_id returning course_id into v_course;
  if v_course is null then raise exception 'registration not found'; end if;
  update public.courses c
     set enrolled = (select count(*) from public.enrolments e where e.course_id = c.id and e.status <> 'dropped')
   where c.id = v_course;
  return jsonb_build_object('ok', true);
end $$;

-- ---- 5. the student sees the current period only -------------------------------
drop function if exists public.student_courses();
create or replace function public.student_courses(p_all boolean default false)
returns table (course_id uuid, code text, title text, semester text, credits int,
               lecturer text, status text, attendance numeric,
               academic_year int, semester_no smallint, intake text)
language sql stable security definer set search_path = public as $$
  with mine as (
    select e.* from public.enrolments e
    where e.student_id = public.my_student_id() and e.status <> 'dropped'
  ), cur_year as (
    select max(academic_year) as y from mine
  ), cur as (
    select (select y from cur_year) as y,
           (select max(semester_no) from mine
             where academic_year is not distinct from (select y from cur_year)) as sem
  )
  select c.id, c.code, c.title, c.semester, c.credits, st.name, m.status,
         public.attendance_pct(m.student_id, c.id),
         m.academic_year, m.semester_no, m.intake
  from mine m
  join public.courses c on c.id = m.course_id
  left join public.staff st on st.id = c.lecturer_staff_id
  cross join cur
  where p_all
     or (m.academic_year is not distinct from cur.y
         and (cur.sem is null or m.semester_no is null or m.semester_no = cur.sem))
  order by m.academic_year desc nulls last, m.semester_no nulls first, c.code;
$$;

-- ---- grants -------------------------------------------------------------------
do $$
declare fn text;
begin
  foreach fn in array array[
    'enrolment_cohorts()', 'enrol_cohort(uuid,int,text,int,boolean)',
    'student_enrolments(uuid)', 'enrol_student_module(uuid,uuid,int,int,text)',
    'drop_enrolment(uuid)', 'student_courses(boolean)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;

notify pgrst, 'reload schema';
