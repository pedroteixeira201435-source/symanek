-- ============================================================================
-- Symanek Suite — Phase 1: wire the academic control windows into the
-- authoritative RPCs, and seed the role permission matrix from the Suite's
-- ROLE_NAV. Supersedes the register_course / publish_exam_results definitions
-- from the earlier migrations (append-only; latest definition wins).
-- ============================================================================

-- Gate: a window only BLOCKS if it has been configured and is currently closed.
-- If no row exists for that kind, the gate is open (backwards compatible with
-- the demo seed, which does not configure windows).
create or replace function public.window_gate(p_kind text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when not exists (select 1 from public.academic_windows where kind = p_kind) then true
    else public.window_open(p_kind)
  end;
$$;
grant execute on function public.window_gate(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- register_course + registration-window gate (rest of the engine unchanged)
-- ---------------------------------------------------------------------------
create or replace function public.register_course(p_course_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_student   public.students;
  v_course    public.courses;
  v_rate      constant numeric := 1150;   -- N$ per credit
  v_sem_cap   constant int     := 72;     -- credit cap per semester
  v_taken     int;
  v_credits   int;
  v_status    text;
  v_charge    numeric;
begin
  select * into v_student from public.students where user_id = auth.uid();
  if v_student.id is null then
    return jsonb_build_object('ok', false, 'code', 'no_student',
      'message', 'No student record is linked to this account.');
  end if;

  -- registration window (open/close controlled by the admin)
  if not public.window_gate('registration') then
    return jsonb_build_object('ok', false, 'code', 'window_closed',
      'message', 'Registration is currently closed. Please register within the published registration period.');
  end if;

  select * into v_course from public.courses where id = p_course_id;
  if v_course.id is null then
    return jsonb_build_object('ok', false, 'code', 'no_course', 'message', 'Course not found.');
  end if;

  if exists (select 1 from public.enrolments e
             where e.student_id = v_student.id and e.course_id = v_course.id) then
    return jsonb_build_object('ok', false, 'code', 'duplicate',
      'message', 'You are already registered for ' || v_course.code || '.');
  end if;

  if exists (select 1 from public.enrolments e join public.results r on r.enrolment_id = e.id
             where e.student_id = v_student.id and e.course_id = v_course.id and r.final >= 50) then
    return jsonb_build_object('ok', false, 'code', 'passed',
      'message', 'You have already passed ' || v_course.code || '.');
  end if;

  if exists (select 1 from public.holds h
             where h.student_id = v_student.id and h.active and 'registration' = any(h.blocks)) then
    return jsonb_build_object('ok', false, 'code', 'hold',
      'message', 'A hold on your record blocks registration. It must be cleared first.');
  end if;

  if v_course.prereq_code is not null and v_course.prereq_code <> '—' then
    if not exists (
      select 1 from public.enrolments e
        join public.courses c on c.id = e.course_id
        join public.results  r on r.enrolment_id = e.id
      where e.student_id = v_student.id and c.code = v_course.prereq_code and r.final >= 50
    ) then
      return jsonb_build_object('ok', false, 'code', 'prereq',
        'message', 'Prerequisite ' || v_course.prereq_code || ' has not been met.');
    end if;
  end if;

  select coalesce(sum(c.credits), 0) into v_credits
  from public.enrolments e join public.courses c on c.id = e.course_id
  where e.student_id = v_student.id and e.semester = v_course.semester
    and e.status in ('registered', 'waitlisted');
  if v_credits + v_course.credits > v_sem_cap then
    return jsonb_build_object('ok', false, 'code', 'credit_cap',
      'message', 'This would exceed the ' || v_sem_cap || '-credit semester limit.');
  end if;

  select count(*) into v_taken from public.enrolments e
  where e.course_id = v_course.id and e.status = 'registered';
  if v_taken >= v_course.capacity then
    v_status := 'waitlisted'; v_charge := 0;
  else
    v_status := 'registered'; v_charge := v_course.credits * v_rate;
  end if;

  insert into public.enrolments (tenant_id, student_id, course_id, semester, status, charge, intake, academic_year)
  values (v_student.tenant_id, v_student.id, v_course.id, v_course.semester, v_status, v_charge,
          v_student.intake, v_student.academic_year);

  if v_charge > 0 then
    insert into public.invoices (tenant_id, student_id, amount, balance, due, status)
    values (v_student.tenant_id, v_student.id, v_charge, v_charge, current_date + 30, 'open');
  end if;

  return jsonb_build_object(
    'ok', true, 'status', v_status, 'charge', v_charge, 'code', v_status,
    'message', case when v_status = 'registered'
      then 'Registered in ' || v_course.code || ' — N$ ' || to_char(v_charge, 'FM999,999') || ' assessed to your account.'
      else v_course.code || ' is full — you have been added to the waitlist.' end);
end $$;
grant execute on function public.register_course(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- publish_exam_results + marks-release-window gate (60/40 formula retained)
-- ---------------------------------------------------------------------------
create or replace function public.publish_exam_results(p_course_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_n int; v_code text;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if not public.window_gate('marks_release') then
    return jsonb_build_object('ok', false, 'code', 'window_closed',
      'message', 'The marks-release window is closed. Open it in Settings → Academic control windows to publish.');
  end if;
  select code into v_code from public.courses where id = p_course_id;
  if v_code is null then
    return jsonb_build_object('ok', false, 'code', 'no_course', 'message', 'Course not found.');
  end if;

  update public.results r
    set final = round(0.6 * coalesce(r.ca, 0) + 0.4 * coalesce(r.exam, 0), 2),
        grade = case
          when 0.6 * coalesce(r.ca,0) + 0.4 * coalesce(r.exam,0) >= 80 then 'A'
          when 0.6 * coalesce(r.ca,0) + 0.4 * coalesce(r.exam,0) >= 70 then 'B'
          when 0.6 * coalesce(r.ca,0) + 0.4 * coalesce(r.exam,0) >= 60 then 'C'
          when 0.6 * coalesce(r.ca,0) + 0.4 * coalesce(r.exam,0) >= 50 then 'D' else 'F' end,
        outcome = case
          when (0.6*coalesce(r.ca,0)+0.4*coalesce(r.exam,0)) >= 50 and coalesce(r.exam,0) >= 40 then 'pass'
          when ((0.6*coalesce(r.ca,0)+0.4*coalesce(r.exam,0)) between 45 and 49)
            or ((0.6*coalesce(r.ca,0)+0.4*coalesce(r.exam,0)) >= 50 and coalesce(r.exam,0) < 40) then 'second_opportunity'
          else 'fail' end,
        published = true
  from public.enrolments e
  where r.enrolment_id = e.id and e.course_id = p_course_id and r.published = false;
  get diagnostics v_n = row_count;

  update public.enrolments e
    set status = case
          when r.outcome = 'pass' then 'passed'
          when r.outcome = 'second_opportunity' then 'second_opp'
          else 'failed' end
  from public.results r
  where r.enrolment_id = e.id and e.course_id = p_course_id and r.published;

  return jsonb_build_object('ok', true, 'code', 'published', 'course', v_code, 'published', v_n,
    'message', 'Results published for ' || v_code || ' — ' || v_n || ' mark(s) locked to the transcript.');
end $$;
grant execute on function public.publish_exam_results(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Seed the role permission matrix from the Suite's ROLE_NAV.
-- can_edit = true for staff workspaces; read-only for student/applicant.
-- ---------------------------------------------------------------------------
insert into public.role_permissions (role, module, can_view, can_edit)
select r.role, m.module, true,
       case when r.role in ('student','applicant') then false else true end
from (values
  ('admin', array['dashboard','students','academics','admissions','programmes','exams','graduation','scheduling','finance','accounting','hr','accommodation','canteen','library','compliance','settings']),
  ('bursar', array['finance','accounting','canteen','hr']),
  ('hr', array['hr']),
  ('teacher', array['teacher','lms','library']),
  ('librarian', array['library']),
  ('student', array['portal','lms']),
  ('registrar', array['dashboard','students','admissions','programmes','academics','exams','graduation','compliance']),
  ('applicant', array['apply'])
) as r(role, mods)
cross join lateral unnest(r.mods) as m(module)
on conflict (role, module) do nothing;

notify pgrst, 'reload schema';
