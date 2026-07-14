-- ============================================================================
-- Symanek Suite — exam board publication (Phase 2 / B4)
-- Registrar publishes a course's marks: final = 0.4*CA + 0.6*exam, letter grade
-- assigned, results locked (published), enrolment marked passed/failed. Once
-- published, marks can no longer be edited (RLS). Feeds transcripts + GPA +
-- graduation clearance.
-- ============================================================================

create or replace function public.publish_exam_results(p_course_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_n int; v_code text;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select code into v_code from public.courses where id = p_course_id;
  if v_code is null then
    return jsonb_build_object('ok', false, 'code', 'no_course', 'message', 'Course not found.');
  end if;

  update public.results r
    set final = round(0.4 * coalesce(r.ca, 0) + 0.6 * coalesce(r.exam, 0), 2),
        grade = case
          when 0.4 * coalesce(r.ca,0) + 0.6 * coalesce(r.exam,0) >= 80 then 'A'
          when 0.4 * coalesce(r.ca,0) + 0.6 * coalesce(r.exam,0) >= 70 then 'B'
          when 0.4 * coalesce(r.ca,0) + 0.6 * coalesce(r.exam,0) >= 60 then 'C'
          when 0.4 * coalesce(r.ca,0) + 0.6 * coalesce(r.exam,0) >= 50 then 'D' else 'F' end,
        published = true
  from public.enrolments e
  where r.enrolment_id = e.id and e.course_id = p_course_id and r.published = false;
  get diagnostics v_n = row_count;

  -- reflect pass/fail on the enrolment
  update public.enrolments e
    set status = case when r.final >= 50 then 'passed' else 'failed' end
  from public.results r
  where r.enrolment_id = e.id and e.course_id = p_course_id and r.published;

  return jsonb_build_object('ok', true, 'code', 'published', 'course', v_code, 'published', v_n,
    'message', 'Results published for ' || v_code || ' — ' || v_n || ' mark(s) locked to the transcript.');
end $$;
grant execute on function public.publish_exam_results(uuid) to authenticated;

-- "Publication locks editing": replace the blanket admin-all on results with
-- granular policies so a PUBLISHED mark can no longer be updated directly.
drop policy if exists "results admin all" on public.results;
create policy "results admin read"   on public.results for select using (public.is_admin());
create policy "results admin insert" on public.results for insert with check (public.is_admin());
create policy "results admin update" on public.results for update
  using (public.is_admin() and not published) with check (public.is_admin());
create policy "results admin delete" on public.results for delete using (public.is_admin());
