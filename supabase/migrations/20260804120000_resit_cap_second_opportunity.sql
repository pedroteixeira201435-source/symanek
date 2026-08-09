-- ============================================================================
-- Symanek Suite — Second-opportunity (re-sit) publishing with the 50% cap.
--
-- Client rule confirmed in the 2026-08 response (D2):
--   "Second-opportunity exam: the re-sit mark is 50%."
-- i.e. a student who passes on the second opportunity is recorded as a BARE
-- PASS — the module final mark is CAPPED at 50%, regardless of how high the
-- re-sit score is.
--
-- This mirrors the frontend source of truth src/lib/academics.js:
--   resitFinal(ca, exam2) = min( round(0.6*ca + 0.4*exam2), 50 )
--
-- The first-opportunity engine (publish_exam_results) is unchanged: it still
-- computes final = 60% CA + 40% exam and flags the 'second_opportunity'
-- outcome. This function is run afterwards, once exam2 has been captured, to
-- finalise those students.
-- ============================================================================

create or replace function public.publish_second_opportunity(p_course_id uuid)
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

  -- Recompute the final for second-opportunity students from the re-sit paper
  -- (exam2), capped at 50%. Pass requires the re-sit paper >= 40% as well.
  update public.results r
    set final = least(round(0.6 * coalesce(r.ca, 0) + 0.4 * coalesce(r.exam2, 0), 2), 50),
        grade = case
          when least(round(0.6*coalesce(r.ca,0)+0.4*coalesce(r.exam2,0),2), 50) >= 50 then 'D'
          else 'F' end,
        outcome = case
          when least(round(0.6*coalesce(r.ca,0)+0.4*coalesce(r.exam2,0),2), 50) >= 50
               and coalesce(r.exam2,0) >= 40 then 'pass'
          else 'fail' end,
        published = true
  from public.enrolments e
  where r.enrolment_id = e.id
    and e.course_id = p_course_id
    and e.status = 'second_opp'
    and r.exam2 is not null;
  get diagnostics v_n = row_count;

  -- Reflect the final outcome on the enrolment (no third opportunity).
  update public.enrolments e
    set status = case when r.outcome = 'pass' then 'passed' else 'failed' end
  from public.results r
  where r.enrolment_id = e.id
    and e.course_id = p_course_id
    and e.status = 'second_opp'
    and r.exam2 is not null;

  return jsonb_build_object('ok', true, 'code', 'published', 'course', v_code, 'published', v_n,
    'message', 'Second-opportunity results published for ' || v_code || ' — ' || v_n ||
               ' re-sit mark(s) finalised (capped at 50%).');
end $$;
grant execute on function public.publish_second_opportunity(uuid) to authenticated;

-- Code wrapper, consistent with publish_course_results / save_course_marks.
create or replace function public.publish_second_opportunity_by_code(p_course_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_course uuid;
begin
  select id into v_course from public.courses where code = p_course_code;
  if v_course is null then return jsonb_build_object('ok', false, 'message', 'course not found'); end if;
  return public.publish_second_opportunity(v_course);   -- is_admin() gated inside
end $$;
grant execute on function public.publish_second_opportunity_by_code(text) to authenticated;

notify pgrst, 'reload schema';
