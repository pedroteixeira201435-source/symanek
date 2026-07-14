-- ============================================================================
-- Symanek Suite — server-authoritative registration engine (Phase 2 / B4)
-- Moves the rules that live in StudentPortal.Registration to the server.
-- The signed-in student registers ONLY themselves (resolved via auth.uid).
-- Order: holds -> already passed/duplicate -> prerequisite -> credit cap ->
--        capacity (waitlist if full) -> charge (enrolment + invoice).
-- ============================================================================

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
  -- who: the signed-in student
  select * into v_student from public.students where user_id = auth.uid();
  if v_student.id is null then
    return jsonb_build_object('ok', false, 'code', 'no_student',
      'message', 'No student record is linked to this account.');
  end if;

  select * into v_course from public.courses where id = p_course_id;
  if v_course.id is null then
    return jsonb_build_object('ok', false, 'code', 'no_course', 'message', 'Course not found.');
  end if;

  -- already registered for this course/semester?
  if exists (select 1 from public.enrolments e
             where e.student_id = v_student.id and e.course_id = v_course.id) then
    return jsonb_build_object('ok', false, 'code', 'duplicate',
      'message', 'You are already registered for ' || v_course.code || '.');
  end if;

  -- already passed?
  if exists (select 1 from public.enrolments e join public.results r on r.enrolment_id = e.id
             where e.student_id = v_student.id and e.course_id = v_course.id and r.final >= 50) then
    return jsonb_build_object('ok', false, 'code', 'passed',
      'message', 'You have already passed ' || v_course.code || '.');
  end if;

  -- 1) holds that block registration
  if exists (select 1 from public.holds h
             where h.student_id = v_student.id and h.active and 'registration' = any(h.blocks)) then
    return jsonb_build_object('ok', false, 'code', 'hold',
      'message', 'A hold on your record blocks registration. It must be cleared first.');
  end if;

  -- 2) prerequisite (by code, must be passed)
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

  -- 3) credit cap (registered + waitlisted this semester)
  select coalesce(sum(c.credits), 0) into v_credits
  from public.enrolments e join public.courses c on c.id = e.course_id
  where e.student_id = v_student.id and e.semester = v_course.semester
    and e.status in ('registered', 'waitlisted');
  if v_credits + v_course.credits > v_sem_cap then
    return jsonb_build_object('ok', false, 'code', 'credit_cap',
      'message', 'This would exceed the ' || v_sem_cap || '-credit semester limit.');
  end if;

  -- 4) capacity -> waitlist if full
  select count(*) into v_taken from public.enrolments e
  where e.course_id = v_course.id and e.status = 'registered';
  if v_taken >= v_course.capacity then
    v_status := 'waitlisted';
    v_charge := 0;
  else
    v_status := 'registered';
    v_charge := v_course.credits * v_rate;
  end if;

  insert into public.enrolments (tenant_id, student_id, course_id, semester, status, charge)
  values (v_student.tenant_id, v_student.id, v_course.id, v_course.semester, v_status, v_charge);

  -- charge assessed on registration flows to the student's account
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
