-- ============================================================================
-- Symanek Suite — more question types and PDF question papers for online quizzes.
-- Requests from the college (J. Fillemon, 31 Oct / 2 Nov 2026).
--
-- New question kinds (on top of mcq / tf / short, 20261018120000):
--   match  — options[] = left-hand items, correct = JSON array of the matching
--            right-hand items (same order). Students get the right-hand items
--            alphabetically, so the order gives nothing away. Partial credit:
--            marks * correct pairs / pairs.
--   essay  — a paragraph / long answer. correct = optional marking guide (never
--            sent to students). Marked by the lecturer.
--   upload — the student uploads scanned answer sheets (photos or PDF) to
--            course-files answers/<assessment>/<student>/…; the answer is a JSON
--            array of those paths. Marked by the lecturer.
--
-- Manual marking: quiz_attempts.manual = {question_id: mark}. A manual mark
-- replaces the automatic one for that question, so the lecturer can also
-- correct an auto-marked answer. Score = sum over questions; it still lands in
-- assessment_marks, so the gradebook / CA pick it up as before.
--
-- Question paper: assessments.paper_path = a PDF in course-files
-- papers/<assessment>/…; enrolled students can open it only once the quiz is no
-- longer a draft. Idempotent.
-- ============================================================================

alter table public.assessments add column if not exists paper_path text;
alter table public.quiz_attempts add column if not exists manual jsonb not null default '{}'::jsonb;
alter table public.quiz_attempts add column if not exists marked_at timestamptz;

alter table public.assessment_questions drop constraint if exists assessment_questions_kind_check;
do $$ begin
  alter table public.assessment_questions add constraint assessment_questions_kind_check
    check (kind in ('mcq','tf','short','match','essay','upload'));
exception when duplicate_object then null; end $$;

-- ---- marking (internal) ----------------------------------------------------
create or replace function public._quiz_auto_mark(p_kind text, p_correct text, p_marks numeric, p_answer text)
returns numeric language plpgsql immutable set search_path = public as $$
declare v_key jsonb; v_ans jsonb; v_n int; v_hit int := 0; i int;
begin
  p_answer := coalesce(p_answer, '');
  if p_kind = 'short' then
    return case when trim(p_answer) <> '' and lower(trim(p_answer)) in
                     (select lower(trim(x)) from unnest(string_to_array(p_correct, '|')) x)
                then p_marks else 0 end;
  elsif p_kind in ('mcq', 'tf') then
    return case when p_answer = p_correct then p_marks else 0 end;
  elsif p_kind = 'match' then
    begin v_key := p_correct::jsonb; v_ans := p_answer::jsonb;
    exception when others then return 0; end;
    if jsonb_typeof(v_ans) <> 'array' then return 0; end if;
    v_n := jsonb_array_length(v_key);
    if v_n = 0 then return 0; end if;
    for i in 0 .. v_n - 1 loop
      if coalesce(trim(v_ans->>i), '') <> '' and lower(trim(v_ans->>i)) = lower(trim(v_key->>i)) then v_hit := v_hit + 1; end if;
    end loop;
    return round(p_marks * v_hit / v_n, 2);
  end if;
  return 0;   -- essay / upload: the lecturer marks these
end $$;

-- Has the student written / uploaded something for this (manual) question?
create or replace function public._quiz_answered(p_kind text, p_answer text)
returns boolean language plpgsql immutable set search_path = public as $$
begin
  if coalesce(trim(p_answer), '') = '' then return false; end if;
  if p_kind = 'upload' then
    begin return jsonb_array_length(p_answer::jsonb) > 0; exception when others then return false; end;
  end if;
  return true;
end $$;

-- Every path in a JSON array sits under the student's own answers folder.
create or replace function public._quiz_paths_ok(p_value text, p_prefix text)
returns boolean language plpgsql immutable set search_path = public as $$
declare v jsonb;
begin
  v := p_value::jsonb;
  if jsonb_typeof(v) <> 'array' then return false; end if;
  return not exists (select 1 from jsonb_array_elements(v) x
                     where jsonb_typeof(x) <> 'string' or left(x #>> '{}', length(p_prefix)) <> p_prefix
                        or position('..' in x #>> '{}') > 0);
exception when others then return false;
end $$;

-- Answered essay / upload questions the lecturer has not marked yet.
create or replace function public._quiz_pending(p_assessment uuid, p_student uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.assessment_questions q
  join public.quiz_attempts t on t.assessment_id = q.assessment_id and t.student_id = p_student
  where q.assessment_id = p_assessment and q.kind in ('essay', 'upload')
    and public._quiz_answered(q.kind, t.answers->>q.id::text)
    and not (t.manual ? q.id::text);
$$;

create or replace function public._quiz_grade(p_assessment uuid, p_student uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_score numeric; v_answers jsonb; v_manual jsonb;
begin
  select answers, manual into v_answers, v_manual from public.quiz_attempts
    where assessment_id = p_assessment and student_id = p_student;
  if v_answers is null then return null; end if;
  select coalesce(sum(coalesce((v_manual->>q.id::text)::numeric,
                               public._quiz_auto_mark(q.kind, q.correct, q.marks, v_answers->>q.id::text))), 0)
    into v_score
  from public.assessment_questions q where q.assessment_id = p_assessment;
  update public.quiz_attempts set score = v_score, submitted_at = coalesce(submitted_at, now())
    where assessment_id = p_assessment and student_id = p_student;
  insert into public.assessment_marks (assessment_id, student_id, mark) values (p_assessment, p_student, v_score)
    on conflict (assessment_id, student_id) do update set mark = excluded.mark, updated_at = now();
  return v_score;
end $$;

-- ---- lecturer --------------------------------------------------------------
create or replace function public.quiz_save_questions(p_assessment uuid, p_questions jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_course uuid; v_status text; q jsonb; v_i int := 0; v_kind text; v_opts text[]; v_correct text;
        v_total numeric := 0; v_marks numeric; v_key jsonb;
begin
  select course_id, quiz_status into v_course, v_status from public.assessments where id = p_assessment;
  if v_course is null or not public.can_teach(v_course) then raise exception 'not authorized'; end if;
  if v_status <> 'draft' or exists (select 1 from public.quiz_attempts where assessment_id = p_assessment) then
    raise exception 'questions are locked once the quiz has been opened';
  end if;
  delete from public.assessment_questions where assessment_id = p_assessment;
  for q in select * from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) loop
    v_i := v_i + 1;
    v_kind := coalesce(q->>'kind', 'mcq');
    if coalesce(trim(q->>'prompt'), '') = '' then raise exception 'question % has no text', v_i; end if;
    v_opts := array(select trim(x) from jsonb_array_elements_text(coalesce(q->'options', '[]'::jsonb)) x where trim(x) <> '');
    v_correct := trim(coalesce(q->>'correct', ''));
    v_marks := coalesce(nullif(q->>'marks', '')::numeric, 1);
    if v_marks <= 0 then raise exception 'question %: marks must be more than 0', v_i; end if;
    if v_kind = 'mcq' then
      if coalesce(array_length(v_opts, 1), 0) < 2 then raise exception 'question % needs at least 2 options', v_i; end if;
      if v_correct !~ '^\d+$' or v_correct::int >= array_length(v_opts, 1) then raise exception 'question %: choose the correct option', v_i; end if;
    elsif v_kind = 'tf' then
      if v_correct not in ('true','false') then raise exception 'question %: choose true or false', v_i; end if;
      v_opts := '{}';
    elsif v_kind = 'short' then
      if v_correct = '' then raise exception 'question %: give at least one accepted answer', v_i; end if;
      v_opts := '{}';
    elsif v_kind = 'match' then
      begin v_key := v_correct::jsonb; exception when others then v_key := null; end;
      if v_key is null or jsonb_typeof(v_key) <> 'array'
         or exists (select 1 from jsonb_array_elements_text(v_key) x where trim(x) = '')
         or coalesce(array_length(v_opts, 1), 0) <> jsonb_array_length(v_key) then
        raise exception 'question %: every pair needs an item on both sides', v_i;
      end if;
      if jsonb_array_length(v_key) < 2 then raise exception 'question %: add at least 2 pairs', v_i; end if;
      v_correct := (select jsonb_agg(trim(x) order by n) from jsonb_array_elements_text(v_key) with ordinality as e(x, n))::text;
    elsif v_kind in ('essay', 'upload') then
      v_opts := '{}';   -- correct = optional marking guide
    else raise exception 'question %: unknown type', v_i;
    end if;
    insert into public.assessment_questions (assessment_id, position, kind, prompt, options, correct, marks)
    values (p_assessment, v_i, v_kind, trim(q->>'prompt'), v_opts, v_correct, v_marks);
    v_total := v_total + v_marks;
  end loop;
  update public.assessments
    set online = v_i > 0, kind = case when v_i > 0 and kind not in ('quiz', 'test') then 'quiz' else kind end,
        max_marks = case when v_total > 0 then v_total else max_marks end
    where id = p_assessment;
  return jsonb_build_object('ok', true, 'questions', v_i, 'max_marks', v_total);
end $$;

-- The PDF question paper (path in course-files papers/<assessment>/…), or null to remove it.
create or replace function public.quiz_set_paper(p_assessment uuid, p_path text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_course uuid;
begin
  select course_id into v_course from public.assessments where id = p_assessment;
  if v_course is null or not public.can_teach(v_course) then raise exception 'not authorized'; end if;
  if p_path is not null and (left(p_path, length('papers/' || p_assessment || '/')) <> 'papers/' || p_assessment || '/'
                             or position('..' in p_path) > 0) then
    raise exception 'invalid file path';
  end if;
  update public.assessments set paper_path = nullif(p_path, '') where id = p_assessment;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.quiz_get(p_assessment uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_course uuid;
begin
  select course_id into v_course from public.assessments where id = p_assessment;
  if v_course is null or not public.can_teach(v_course) then raise exception 'not authorized'; end if;
  perform public._quiz_autoclose(p_assessment);
  return (select jsonb_build_object(
    'id', a.id, 'title', a.title, 'status', a.quiz_status, 'max', a.max_marks, 'time_limit_min', a.time_limit_min,
    'opened_at', a.opened_at, 'closes_at', a.closes_at, 'show_results', a.show_results, 'paper_path', a.paper_path,
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'kind', q.kind, 'prompt', q.prompt,
                   'options', to_jsonb(q.options), 'correct', q.correct, 'marks', q.marks) order by q.position)
                 from public.assessment_questions q where q.assessment_id = a.id), '[]'::jsonb))
    from public.assessments a where a.id = p_assessment);
end $$;

create or replace function public.quiz_monitor(p_assessment uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_course uuid;
begin
  select course_id into v_course from public.assessments where id = p_assessment;
  if v_course is null or not public.can_teach(v_course) then raise exception 'not authorized'; end if;
  perform public._quiz_autoclose(p_assessment);
  return (select jsonb_build_object(
    'status', a.quiz_status, 'closes_at', a.closes_at, 'max', a.max_marks, 'now', now(),
    'students', coalesce((select jsonb_agg(jsonb_build_object(
        'student_id', s.id, 'name', s.full_name,
        'state', case when t.student_id is null then 'not_started' when t.submitted_at is null then 'in_progress' else 'submitted' end,
        'answered', (select count(*) from jsonb_object_keys(coalesce(t.answers, '{}'::jsonb))),
        'to_mark', case when t.submitted_at is not null then public._quiz_pending(a.id, s.id) else 0 end,
        'started_at', t.started_at, 'submitted_at', t.submitted_at, 'score', t.score) order by s.full_name)
      from public.enrolments e join public.students s on s.id = e.student_id
      left join public.quiz_attempts t on t.assessment_id = a.id and t.student_id = s.id
      where e.course_id = a.course_id and e.status <> 'dropped'), '[]'::jsonb),
    'questions', (select count(*) from public.assessment_questions q where q.assessment_id = a.id),
    'manual', (select count(*) from public.assessment_questions q where q.assessment_id = a.id and q.kind in ('essay', 'upload')))
    from public.assessments a where a.id = p_assessment);
end $$;

-- One student's attempt, with the correct answers, for marking.
create or replace function public.quiz_attempt_review(p_assessment uuid, p_student uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_course uuid; t record;
begin
  select course_id into v_course from public.assessments where id = p_assessment;
  if v_course is null or not public.can_teach(v_course) then raise exception 'not authorized'; end if;
  select * into t from public.quiz_attempts where assessment_id = p_assessment and student_id = p_student;
  if t.student_id is null then raise exception 'this student has not started the quiz'; end if;
  return jsonb_build_object(
    'student_id', p_student, 'name', (select full_name from public.students where id = p_student),
    'submitted_at', t.submitted_at, 'marked_at', t.marked_at, 'score', t.score,
    'max', (select max_marks from public.assessments where id = p_assessment),
    'questions', coalesce((select jsonb_agg(jsonb_build_object(
        'id', q.id, 'kind', q.kind, 'prompt', q.prompt, 'options', to_jsonb(q.options), 'correct', q.correct,
        'marks', q.marks, 'answer', t.answers->>q.id::text,
        'auto', public._quiz_auto_mark(q.kind, q.correct, q.marks, t.answers->>q.id::text),
        'manual', t.manual->q.id::text) order by q.position)
      from public.assessment_questions q where q.assessment_id = p_assessment), '[]'::jsonb));
end $$;

-- p_marks = {question_id: mark | null}; replaces the lecturer's marks for this attempt.
create or replace function public.quiz_mark_attempt(p_assessment uuid, p_student uuid, p_marks jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_course uuid; v_manual jsonb := '{}'::jsonb; e record; v_max numeric; v_mark numeric; v_score numeric;
begin
  select course_id into v_course from public.assessments where id = p_assessment;
  if v_course is null or not public.can_teach(v_course) then raise exception 'not authorized'; end if;
  if (select submitted_at from public.quiz_attempts where assessment_id = p_assessment and student_id = p_student) is null then
    raise exception 'the student has not submitted yet';
  end if;
  for e in select * from jsonb_each(coalesce(p_marks, '{}'::jsonb)) loop
    if jsonb_typeof(e.value) = 'null' or coalesce(e.value #>> '{}', '') = '' then continue; end if;
    select marks into v_max from public.assessment_questions where assessment_id = p_assessment and id::text = e.key;
    if v_max is null then raise exception 'unknown question'; end if;
    v_mark := (e.value #>> '{}')::numeric;
    if v_mark < 0 or v_mark > v_max then raise exception 'a mark must be between 0 and % for that question', v_max; end if;
    v_manual := v_manual || jsonb_build_object(e.key, v_mark);
  end loop;
  update public.quiz_attempts set manual = v_manual, marked_at = now()
    where assessment_id = p_assessment and student_id = p_student;
  v_score := public._quiz_grade(p_assessment, p_student);
  return jsonb_build_object('ok', true, 'score', v_score, 'pending', public._quiz_pending(p_assessment, p_student));
end $$;

-- ---- student ---------------------------------------------------------------
create or replace function public.student_quizzes()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_sid uuid := public.my_student_id(); r record;
begin
  if v_sid is null then return '[]'::jsonb; end if;
  for r in select a.id from public.assessments a
           where a.online and a.quiz_status = 'open' and public.is_enrolled(a.course_id) loop
    perform public._quiz_autoclose(r.id);
  end loop;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'title', a.title, 'code', c.code, 'course_title', c.title, 'status', a.quiz_status,
      'time_limit_min', a.time_limit_min, 'closes_at', a.closes_at, 'max', a.max_marks,
      'questions', (select count(*) from public.assessment_questions q where q.assessment_id = a.id),
      'has_paper', a.paper_path is not null,
      'state', case when t.student_id is null then 'not_started' when t.submitted_at is null then 'in_progress' else 'submitted' end,
      'score', case when a.show_results or a.quiz_status = 'closed' then t.score end,
      'pending', case when t.submitted_at is not null then public._quiz_pending(a.id, v_sid) else 0 end,
      'submitted_at', t.submitted_at) order by (a.quiz_status = 'open') desc, a.opened_at desc nulls last)
    from public.assessments a
    join public.courses c on c.id = a.course_id
    left join public.quiz_attempts t on t.assessment_id = a.id and t.student_id = v_sid
    where a.online and a.quiz_status in ('open','closed') and public.is_enrolled(a.course_id)), '[]'::jsonb);
end $$;

-- Start (or resume) my attempt. Returns the questions WITHOUT answers; matching
-- questions carry their right-hand items as `choices`, sorted alphabetically.
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
                     (select jsonb_agg(distinct x order by x) from jsonb_array_elements_text(q.correct::jsonb) x) end)
        order by q.position)
      from public.assessment_questions q where q.assessment_id = a.id), '[]'::jsonb) end);
end $$;

-- Autosave: merges {question_id: answer}. Ignored once time is up or submitted.
-- Upload answers must only point at the student's own answers/<assessment>/<student>/ files.
create or replace function public.quiz_save_answers(p_assessment uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_sid uuid := public.my_student_id(); v_n int;
begin
  update public.quiz_attempts t
    set answers = t.answers || (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
                                from jsonb_each_text(coalesce(p_answers, '{}'::jsonb)) as e(k, v)
                                where exists (select 1 from public.assessment_questions q
                                              where q.assessment_id = p_assessment and q.id::text = e.k
                                                and (q.kind <> 'upload'
                                                     or public._quiz_paths_ok(e.v, 'answers/' || p_assessment || '/' || v_sid || '/'))))
    where t.assessment_id = p_assessment and t.student_id = v_sid and t.submitted_at is null
      and (t.deadline is null or now() <= t.deadline + interval '30 seconds')
      and exists (select 1 from public.assessments a where a.id = p_assessment and a.quiz_status = 'open');
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', v_n > 0);
end $$;

create or replace function public.quiz_submit(p_assessment uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_sid uuid := public.my_student_id(); v_score numeric; v_show boolean; v_max numeric;
begin
  if not exists (select 1 from public.quiz_attempts where assessment_id = p_assessment and student_id = v_sid) then
    raise exception 'start the quiz first';
  end if;
  perform public.quiz_save_answers(p_assessment, p_answers);   -- no-op if time is up
  if (select submitted_at from public.quiz_attempts where assessment_id = p_assessment and student_id = v_sid) is null then
    v_score := public._quiz_grade(p_assessment, v_sid);
  else
    select score into v_score from public.quiz_attempts where assessment_id = p_assessment and student_id = v_sid;
  end if;
  select show_results, max_marks into v_show, v_max from public.assessments where id = p_assessment;
  return jsonb_build_object('ok', true, 'score', case when v_show then v_score end, 'max', v_max,
                            'pending', public._quiz_pending(p_assessment, v_sid));
end $$;

-- ---- files: + papers/<assessment>/… and answers/<assessment>/<student>/… ----
create or replace function public.course_file_access(p_name text, p_write boolean)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare parts text[] := string_to_array(p_name, '/'); v_course uuid; v_assignment uuid; v_student uuid; v_status text;
begin
  if array_length(parts, 1) < 3 then return false; end if;
  if parts[1] in ('materials', 'assignments', 'recordings') then
    v_course := parts[2]::uuid;
    if p_write then return public.can_teach(v_course); end if;
    return public.can_teach(v_course) or public.is_enrolled(v_course);
  elsif parts[1] = 'submissions' and array_length(parts, 1) >= 4 then
    v_assignment := parts[2]::uuid; v_student := parts[3]::uuid;
    select course_id into v_course from public.assignments where id = v_assignment;
    if v_course is null then return false; end if;
    if v_student = public.my_student_id() and public.is_enrolled(v_course) then return true; end if;
    return (not p_write) and public.can_teach(v_course);
  elsif parts[1] = 'papers' then
    -- question paper: the lecturer writes; students read once the quiz is open
    select course_id, quiz_status into v_course, v_status from public.assessments where id = parts[2]::uuid;
    if v_course is null then return false; end if;
    if p_write then return public.can_teach(v_course); end if;
    return public.can_teach(v_course) or (public.is_enrolled(v_course) and v_status <> 'draft');
  elsif parts[1] = 'answers' and array_length(parts, 1) >= 4 then
    -- scanned answer sheets: the student writes their own while the quiz is open; the lecturer reads
    v_student := parts[3]::uuid;
    select course_id, quiz_status into v_course, v_status from public.assessments where id = parts[2]::uuid;
    if v_course is null then return false; end if;
    if v_student = public.my_student_id() and public.is_enrolled(v_course) then
      return (not p_write) or v_status = 'open';
    end if;
    return (not p_write) and public.can_teach(v_course);
  end if;
  return false;
exception when others then
  return false;
end $$;

-- ---- grants ----------------------------------------------------------------
do $$
declare fn text;
begin
  foreach fn in array array['_quiz_auto_mark(text,text,numeric,text)', '_quiz_answered(text,text)',
                            '_quiz_paths_ok(text,text)', '_quiz_pending(uuid,uuid)', '_quiz_grade(uuid,uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', fn);
  end loop;
  foreach fn in array array[
    'quiz_save_questions(uuid,jsonb)', 'quiz_set_paper(uuid,text)', 'quiz_get(uuid)', 'quiz_monitor(uuid)',
    'quiz_attempt_review(uuid,uuid)', 'quiz_mark_attempt(uuid,uuid,jsonb)',
    'student_quizzes()', 'quiz_start(uuid)', 'quiz_save_answers(uuid,jsonb)', 'quiz_submit(uuid,jsonb)',
    'course_file_access(text,boolean)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;

notify pgrst, 'reload schema';
