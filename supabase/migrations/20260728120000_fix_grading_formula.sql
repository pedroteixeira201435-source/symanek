-- ============================================================================
-- Symanek Suite — FIX: align the authoritative grading engine with the client's
-- 2026 review feedback and with the frontend source of truth (src/lib/academics.js).
--
-- Bug being fixed: publish_exam_results() computed final = 0.4*CA + 0.6*exam,
-- but the institution's rule (and the whole frontend) is:
--   • final = 60% CA + 40% exam
--   • pass the module: final >= 50 AND exam paper >= 40
--   • final 45–49%, OR module passed but exam paper < 40%  → SECOND OPPORTUNITY
--   • otherwise fail
-- Letter grades: A>=80, B>=70, C>=60, D>=50, else F (matches academics.gradeOf).
-- ============================================================================

-- Allow the enrolment to record a second-opportunity outcome.
alter table public.enrolments drop constraint if exists enrolments_status_check;
alter table public.enrolments add constraint enrolments_status_check
  check (status in ('registered', 'waitlisted', 'passed', 'second_opp', 'failed', 'dropped'));

create or replace function public.publish_exam_results(p_course_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_n int; v_code text;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select code into v_code from public.courses where id = p_course_id;
  if v_code is null then
    return jsonb_build_object('ok', false, 'code', 'no_course', 'message', 'Course not found.');
  end if;

  -- final = 60% CA + 40% exam; letter grade from the institutional scale.
  update public.results r
    set final = round(0.6 * coalesce(r.ca, 0) + 0.4 * coalesce(r.exam, 0), 2),
        grade = case
          when 0.6 * coalesce(r.ca,0) + 0.4 * coalesce(r.exam,0) >= 80 then 'A'
          when 0.6 * coalesce(r.ca,0) + 0.4 * coalesce(r.exam,0) >= 70 then 'B'
          when 0.6 * coalesce(r.ca,0) + 0.4 * coalesce(r.exam,0) >= 60 then 'C'
          when 0.6 * coalesce(r.ca,0) + 0.4 * coalesce(r.exam,0) >= 50 then 'D' else 'F' end,
        published = true
  from public.enrolments e
  where r.enrolment_id = e.id and e.course_id = p_course_id and r.published = false;
  get diagnostics v_n = row_count;

  -- Reflect the module outcome on the enrolment, mirroring academics.evaluateResult:
  --   pass  = final >= 50 AND exam >= 40
  --   2nd op = final in 45..49, OR (final >= 50 AND exam < 40)
  --   fail  = otherwise
  update public.enrolments e
    set status = case
          when r.final >= 50 and coalesce(r.exam,0) >= 40 then 'passed'
          when (r.final >= 45 and r.final <= 49)
            or (r.final >= 50 and coalesce(r.exam,0) < 40) then 'second_opp'
          else 'failed' end
  from public.results r
  where r.enrolment_id = e.id and e.course_id = p_course_id and r.published;

  return jsonb_build_object('ok', true, 'code', 'published', 'course', v_code, 'published', v_n,
    'message', 'Results published for ' || v_code || ' — ' || v_n || ' mark(s) locked to the transcript.');
end $$;
grant execute on function public.publish_exam_results(uuid) to authenticated;

notify pgrst, 'reload schema';
