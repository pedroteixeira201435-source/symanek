-- ============================================================================
-- Symanek Suite — editable attendance and printable student documents.
-- Requests from the college (J. Fillemon, 10 and 13 Nov 2026).
--
-- 1. Attendance: a lecturer can open a recorded session with its real ticks
--    (attendance_register), correct it (record_attendance_session already
--    replaces that day) and delete it (delete_attendance_session).
--    course_attendance now returns the attendance % for THIS module
--    (attendance_pct) — it used to return the student's overall % — and one
--    row per student even when they have enrolments in several years.
-- 2. Documents: student_document(type, student) returns everything a printed
--    proof of registration, academic record or examination permit needs; the
--    Suite renders and prints it. Staff (registrar/admin) may print any
--    student's; a student only their own, and not while a hold blocks it
--    ('registration' for the proof, 'results' for the record). The permit
--    marks each module admitted only with >= 80% attendance on that module
--    (a module with no register ever taken does not block) and no hold
--    blocking registration or results. exam_permits() returns
--    every student's permit for the registrar to print in one go.
-- RPC-only, idempotent.
-- ============================================================================

-- ---- 1. attendance ---------------------------------------------------------
create or replace function public.course_attendance(p_course_code text)
returns table (student_id uuid, student text, percent numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_course uuid;
begin
  select c.id into v_course from public.courses c where c.code = p_course_code;
  if v_course is null or not public.can_teach(v_course) then raise exception 'not authorized'; end if;
  return query
    select s.id, s.full_name, public.attendance_pct(s.id, v_course)
    from public.students s
    where exists (select 1 from public.enrolments e
                  where e.course_id = v_course and e.student_id = s.id and e.status <> 'dropped')
    order by s.full_name;
end $$;

-- The register of one recorded day: present = null when the student has no
-- entry for that day (e.g. enrolled after it was taken).
create or replace function public.attendance_register(p_course_code text, p_date date)
returns table (student_id uuid, student text, present boolean, hours numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_course uuid;
begin
  select c.id into v_course from public.courses c where c.code = p_course_code;
  if v_course is null or not public.can_teach(v_course) then raise exception 'not authorized'; end if;
  return query
    select s.id, s.full_name, a.present, a.hours
    from public.students s
    left join public.attendance a on a.student_id = s.id and a.course_id = v_course and a.session_date = p_date
    where exists (select 1 from public.enrolments e
                  where e.course_id = v_course and e.student_id = s.id and e.status <> 'dropped')
    order by s.full_name;
end $$;

create or replace function public.delete_attendance_session(p_course_code text, p_date date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_course uuid; v_n int;
begin
  select c.id into v_course from public.courses c where c.code = p_course_code;
  if v_course is null or not public.can_teach(v_course) then raise exception 'not authorized'; end if;
  delete from public.attendance where course_id = v_course and session_date = p_date;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'deleted', v_n, 'date', p_date);
end $$;

-- ---- 2. documents (internal helpers) ----------------------------------------
-- The student's current period, as student_courses() defines it: the latest
-- academic year and, within it, the latest semester plus year-long modules.
create or replace function public._current_enrolments(p_student uuid)
returns table (course_id uuid, academic_year int, semester_no smallint, intake text)
language sql stable security definer set search_path = public as $$
  with mine as (
    select e.* from public.enrolments e where e.student_id = p_student and e.status <> 'dropped'
  ), cur as (
    select (select max(academic_year) from mine) as y,
           (select max(semester_no) from mine
             where academic_year is not distinct from (select max(academic_year) from mine)) as sem
  )
  select distinct on (m.course_id) m.course_id, m.academic_year, m.semester_no, m.intake
  from mine m cross join cur
  where m.academic_year is not distinct from cur.y
    and (cur.sem is null or m.semester_no is null or m.semester_no = cur.sem)
  order by m.course_id;
$$;

create or replace function public._hold_blocks(p_student uuid, p_blocks text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.holds h
                 where h.student_id = p_student and h.active and h.blocks && p_blocks);
$$;

create or replace function public._student_card(p_student uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', s.id, 'full_name', s.full_name, 'student_no', coalesce(s.student_no, s.reference),
    'id_number', s.id_number, 'email', s.email, 'status', s.status, 'year', s.year,
    'academic_year', s.academic_year, 'intake', s.intake, 'campus', s.campus,
    'programme', p.name, 'programme_code', upper(p.slug), 'nqf', coalesce(p.nqf::text, p.level))
  from public.students s left join public.programmes p on p.id = s.programme_id
  where s.id = p_student;
$$;

create or replace function public._exam_permit(p_student uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with hold as (select public._hold_blocks(p_student, array['registration','results']) as blocked),
  rows as (
    -- att = null when no register was ever taken for the module: nothing to judge, so it does not block
    select distinct on (es.id) es.id, c.code, c.title, es.at, es.venue,
           case when exists (select 1 from public.attendance a where a.course_id = c.id)
                then public.attendance_pct(p_student, c.id) end as att
    from public._current_enrolments(p_student) ce
    join public.courses c on c.id = ce.course_id
    join public.exam_sittings es on es.course_id = c.id
    order by es.id
  )
  select jsonb_build_object(
    'hold', (select blocked from hold),
    'sittings', coalesce(jsonb_agg(jsonb_build_object(
        'code', r.code, 'title', r.title, 'at', r.at, 'venue', r.venue, 'attendance', r.att,
        'admitted', coalesce(r.att >= 80, true) and not (select blocked from hold),
        'reason', case when (select blocked from hold) then 'Hold on account'
                       when r.att < 80 then 'Attendance below 80%' end)
      order by r.at nulls last, r.code) filter (where r.id is not null), '[]'::jsonb))
  from rows r right join (select 1) one on true;
$$;

create or replace function public._document_header(p_signatory text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'college', (select to_jsonb(cs) - 'id' - 'tenant_id' - 'created_at' - 'updated_at'
                from public.college_settings cs limit 1),
    'signatory', (select jsonb_build_object('name', sg.name, 'title', sg.title)
                  from public.signatories sg where sg.active and sg.role_key = p_signatory limit 1),
    'issued_at', now());
$$;

-- ---- 2. documents (callable) ----------------------------------------------
-- p_type: proof_of_registration | academic_record | exam_permit.
-- p_student null = the signed-in student.
create or replace function public.student_document(p_type text, p_student uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_staff boolean := public.has_suite_role('registrar'); v_sid uuid; v_body jsonb;
begin
  v_sid := coalesce(p_student, public.my_student_id());
  if v_sid is null then raise exception 'no student record linked to this login'; end if;
  if not v_staff and v_sid is distinct from public.my_student_id() then raise exception 'not authorized'; end if;
  if not exists (select 1 from public.students where id = v_sid) then raise exception 'student not found'; end if;

  if p_type = 'proof_of_registration' then
    if not v_staff and public._hold_blocks(v_sid, array['registration']) then
      raise exception 'a hold on your account blocks this document — please contact the college';
    end if;
    v_body := jsonb_build_object('modules', coalesce((select jsonb_agg(jsonb_build_object(
        'code', c.code, 'title', c.title, 'credits', c.credits, 'semester', c.semester,
        'academic_year', ce.academic_year, 'semester_no', ce.semester_no) order by c.code)
      from public._current_enrolments(v_sid) ce join public.courses c on c.id = ce.course_id), '[]'::jsonb),
      'period', (select jsonb_build_object('academic_year', max(academic_year), 'semester_no', max(semester_no), 'intake', max(intake))
                 from public._current_enrolments(v_sid)));
  elsif p_type = 'academic_record' then
    if not v_staff and public._hold_blocks(v_sid, array['results']) then
      raise exception 'a hold on your account blocks this document — please contact the college';
    end if;
    v_body := jsonb_build_object(
      'results', coalesce((select jsonb_agg(jsonb_build_object(
          'academic_year', e.academic_year, 'semester_no', e.semester_no, 'code', c.code, 'title', c.title,
          'credits', c.credits, 'final', r.final, 'grade', r.grade, 'outcome', r.outcome)
          order by e.academic_year nulls first, e.semester_no nulls first, c.code)
        from public.enrolments e join public.results r on r.enrolment_id = e.id join public.courses c on c.id = e.course_id
        where e.student_id = v_sid and r.published), '[]'::jsonb),
      'gpa', public.student_gpa(v_sid),
      'credits_earned', (select coalesce(sum(c.credits), 0) from public.enrolments e
                           join public.results r on r.enrolment_id = e.id join public.courses c on c.id = e.course_id
                          where e.student_id = v_sid and r.published and r.final >= 50));
  elsif p_type = 'exam_permit' then
    v_body := public._exam_permit(v_sid);
  else
    raise exception 'unknown document type';
  end if;

  return public._document_header('registrar')
      || jsonb_build_object('type', p_type, 'student', public._student_card(v_sid))
      || v_body;
end $$;

-- Every student with an examination sitting this period, for bulk printing.
create or replace function public.exam_permits()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_suite_role('registrar') then raise exception 'not authorized'; end if;
  return public._document_header('registrar') || jsonb_build_object('type', 'exam_permit', 'permits',
    coalesce((select jsonb_agg(jsonb_build_object('student', public._student_card(s.id)) || public._exam_permit(s.id)
                               order by s.full_name)
      from public.students s
      where exists (select 1 from public._current_enrolments(s.id) ce
                    join public.exam_sittings es on es.course_id = ce.course_id)), '[]'::jsonb));
end $$;

-- ---- grants ----------------------------------------------------------------
do $$
declare fn text;
begin
  foreach fn in array array['_current_enrolments(uuid)', '_hold_blocks(uuid,text[])', '_student_card(uuid)',
                            '_exam_permit(uuid)', '_document_header(text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', fn);
  end loop;
  foreach fn in array array['course_attendance(text)', 'attendance_register(text,date)',
                            'delete_attendance_session(text,date)', 'student_document(text,uuid)', 'exam_permits()'] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;

notify pgrst, 'reload schema';
