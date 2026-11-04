-- ============================================================================
-- Matching questions: show the right-hand items in a stable shuffled order
-- (by hash) instead of alphabetically. Alphabetical gave the answers away
-- whenever the lecturer typed the pairs in alphabetical order (seen in UAT,
-- 2026-11-04). Only quiz_start changes; same signature and shape as
-- 20261104120000. Idempotent.
-- ============================================================================

create or replace function public.quiz_start(p_assessment uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_sid uuid := public.my_student_id(); a record; t record;
begin
  select * into a from public.assessments where id = p_assessment;
  if a.id is null or v_sid is null or not a.online or not public.is_enrolled(a.course_id) then raise exception 'not authorized'; end if;
  perform public._quiz_autoclose(p_assessment);
  select * into a from public.assessments where id = p_assessment;
  select * into t from public.quiz_attempts where assessment_id = p_assessment and student_id = v_sid;
  if t.student_id is null then
    if a.quiz_status <> 'open' then raise exception 'this quiz is not open'; end if;
    insert into public.quiz_attempts (assessment_id, student_id, deadline)
    values (p_assessment, v_sid,
            case when a.time_limit_min is null then a.closes_at
                 else least(now() + make_interval(mins => a.time_limit_min), coalesce(a.closes_at, 'infinity'::timestamptz)) end)
    returning * into t;
  end if;
  return jsonb_build_object(
    'id', a.id, 'title', a.title, 'max', a.max_marks, 'now', now(), 'deadline', t.deadline,
    'student_id', v_sid, 'paper_path', a.paper_path,
    'submitted', t.submitted_at is not null, 'answers', t.answers,
    'score', case when t.submitted_at is not null and (a.show_results or a.quiz_status = 'closed') then t.score end,
    'pending', case when t.submitted_at is not null then public._quiz_pending(a.id, v_sid) else 0 end,
    'questions', case when t.submitted_at is not null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object(
        'id', q.id, 'kind', q.kind, 'prompt', q.prompt, 'options', to_jsonb(q.options), 'marks', q.marks,
        'choices', case when q.kind = 'match' then
                     (select jsonb_agg(x order by md5(q.id::text || x)) from (select distinct x from jsonb_array_elements_text(q.correct::jsonb) x) d) end)
        order by q.position)
      from public.assessment_questions q where q.assessment_id = a.id), '[]'::jsonb) end);
end $$;

notify pgrst, 'reload schema';
