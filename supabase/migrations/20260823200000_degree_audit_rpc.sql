-- ============================================================================
-- Symanek — spine completion: real degree audit (StudentPortal).
--
-- getDegreeAudit was the last genuinely-used pure-mock stub. Back it with real
-- data derived from the student's programme (total credits), their published
-- results (earned credits where final >= 50, credit-weighted GPA) and their
-- enrolments (in-progress credits). The rich per-requirement breakdown (core /
-- elective / WIL groups) needs a curriculum-requirements model that doesn't
-- exist yet, so we return the truthful headline: total credits + GPA + status.
-- Uses the current grade scale (auto-corrects when A4 boundaries are confirmed).
-- ============================================================================

create or replace function public.degree_audit(p_student uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare v_name text; v_level text; v_prog_id uuid;
        v_need int; v_done int; v_inprog int; v_gpa numeric; v_status text;
begin
  -- the student themselves, or staff/admin, may view an audit
  if not (public.is_admin()
          or exists (select 1 from public.students s where s.id = p_student and s.user_id = auth.uid())) then
    raise exception 'not authorized';
  end if;

  select p.name, p.level, p.id into v_name, v_level, v_prog_id
    from public.students s join public.programmes p on p.id = s.programme_id
    where s.id = p_student;

  select coalesce(sum(c.credits), 0) into v_need
    from public.courses c where c.programme_id = v_prog_id;

  select coalesce(sum(c.credits), 0) into v_done
    from public.enrolments e
    join public.courses c on c.id = e.course_id
    join public.results r on r.enrolment_id = e.id
    where e.student_id = p_student and r.published and r.final >= 50;

  select coalesce(sum(c.credits), 0) into v_inprog
    from public.enrolments e
    join public.courses c on c.id = e.course_id
    where e.student_id = p_student
      and not exists (select 1 from public.results r
                      where r.enrolment_id = e.id and r.published and r.final >= 50);

  select round(coalesce(sum(g.pts * c.credits) / nullif(sum(c.credits), 0), 0), 2) into v_gpa
    from public.enrolments e
    join public.courses c on c.id = e.course_id
    join public.results r on r.enrolment_id = e.id
    cross join lateral (select case upper(coalesce(r.grade,'F'))
                          when 'A' then 4 when 'B' then 3 when 'C' then 2 when 'D' then 1 else 0 end as pts) g
    where e.student_id = p_student and r.published;

  v_status := case when v_need > 0 and v_done >= v_need then 'Satisfied'
                   when v_done > 0 or v_inprog > 0        then 'In progress'
                   else 'Not satisfied' end;

  return json_build_object(
    'prog', coalesce(v_name, ''),
    'catalog', to_char(now(), 'YYYY'),
    'gpa', v_gpa,
    'reqs', json_build_array(json_build_object(
      'req',  'Total credits' || coalesce(' — ' || v_level, ''),
      'need', v_need, 'done', v_done, 'inprog', v_inprog, 'status', v_status))
  );
end $$;

revoke all on function public.degree_audit(uuid) from public;
grant execute on function public.degree_audit(uuid) to authenticated;

notify pgrst, 'reload schema';
