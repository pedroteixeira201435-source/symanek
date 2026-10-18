-- ============================================================================
-- Symanek Suite — live online quizzes.
--
-- An online quiz is an `assessments` row (kind 'quiz') that also has questions.
-- The lecturer writes the questions, then opens the quiz live; enrolled
-- students answer it in the portal against a countdown. Answers autosave, the
-- server marks MCQ / true-false / short-answer questions, and the score goes
-- straight into assessment_marks — so it appears in the gradebook and CA %
-- like any other test (20261007120000). The lecturer can still override a mark
-- with "Enter marks".
--
-- Correct answers never leave the server for students: quiz_start() returns
-- the questions without them, and grading happens in _quiz_grade().
-- Time limits are enforced server-side (deadline + 30 s grace for the network).
-- RPC-only, gated by can_teach()/is_enrolled()/my_student_id(). Idempotent.
-- ============================================================================

alter table public.assessments
  add column if not exists online         boolean not null default false,
  add column if not exists quiz_status    text not null default 'draft',
  add column if not exists time_limit_min int,
  add column if not exists opened_at      timestamptz,
  add column if not exists closes_at      timestamptz,
  add column if not exists show_results   boolean not null default true;

do $$ begin
  alter table public.assessments add constraint assessments_quiz_status_chk
    check (quiz_status in ('draft','open','closed'));
exception when duplicate_object then null; end $$;

-- kind: mcq (options[], correct = option index), tf (correct = 'true'/'false'),
-- short (correct = accepted answers separated by '|', compared case-insensitively).
create table if not exists public.assessment_questions (
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  position      int not null default 0,
  kind          text not null default 'mcq' check (kind in ('mcq','tf','short')),
  prompt        text not null,
  options       text[] not null default '{}',
  correct       text not null,
  marks         numeric not null default 1 check (marks > 0)
);
create index if not exists assessment_questions_idx on public.assessment_questions(assessment_id, position);

create table if not exists public.quiz_attempts (
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id    uuid not null references public.students(id) on delete cascade,
  started_at    timestamptz not null default now(),
  deadline      timestamptz,
  submitted_at  timestamptz,
  answers       jsonb not null default '{}'::jsonb,
  score         numeric,
  primary key (assessment_id, student_id)
);

alter table public.assessment_questions enable row level security;   -- RPC-only
alter table public.quiz_attempts enable row level security;          -- RPC-only

-- ---- marking (internal) ----------------------------------------------------
create or replace function public._quiz_grade(p_assessment uuid, p_student uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_score numeric; v_answers jsonb;
begin
  select answers into v_answers from public.quiz_attempts
    where assessment_id = p_assessment and student_id = p_student;
  if v_answers is null then return null; end if;
  select coalesce(sum(q.marks), 0) into v_score
  from public.assessment_questions q
  where q.assessment_id = p_assessment
    and case q.kind
          when 'short' then lower(trim(coalesce(v_answers->>q.id::text, ''))) <> ''
                        and lower(trim(v_answers->>q.id::text)) in
                            (select lower(trim(x)) from unnest(string_to_array(q.correct, '|')) x)
          else coalesce(v_answers->>q.id::text, '') = q.correct
        end;
  update public.quiz_attempts set score = v_score, submitted_at = coalesce(submitted_at, now())
    where assessment_id = p_assessment and student_id = p_student;
  insert into public.assessment_marks (assessment_id, student_id, mark) values (p_assessment, p_student, v_score)
    on conflict (assessment_id, student_id) do update set mark = excluded.mark, updated_at = now();
  return v_score;
end $$;

-- Submit (and mark) every attempt whose time ran out; with p_all, every open one.
create or replace function public._quiz_finalize(p_assessment uuid, p_all boolean default false)
returns int language plpgsql security definer set search_path = public as $$
declare r record; v_n int := 0;
begin
  for r in select student_id from public.quiz_attempts
           where assessment_id = p_assessment and submitted_at is null
             and (p_all or (deadline is not null and now() > deadline + interval '30 seconds')) loop
    perform public._quiz_grade(p_assessment, r.student_id); v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- An open quiz whose closing time has passed closes itself on the next read.
create or replace function public._quiz_autoclose(p_assessment uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.assessments where id = p_assessment and quiz_status = 'open'
             and closes_at is not null and now() > closes_at + interval '30 seconds') then
    update public.assessments set quiz_status = 'closed' where id = p_assessment;
    perform public._quiz_finalize(p_assessment, true);
  else
    perform public._quiz_finalize(p_assessment, false);
  end if;
end $$;

-- ---- lecturer --------------------------------------------------------------
-- p_questions = [{kind, prompt, options:[..], correct, marks}] in display order.
-- Replaces all questions; only while the quiz is a draft. Out-of = sum of marks.
create or replace function public.quiz_save_questions(p_assessment uuid, p_questions jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_course uuid; v_status text; q jsonb; v_i int := 0; v_kind text; v_opts text[]; v_correct text; v_total numeric := 0; v_marks numeric;
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
    if v_kind = 'mcq' then
      if coalesce(array_length(v_opts, 1), 0) < 2 then raise exception 'question % needs at least 2 options', v_i; end if;
      if v_correct !~ '^\d+$' or v_correct::int >= array_length(v_opts, 1) then raise exception 'question %: choose the correct option', v_i; end if;
    elsif v_kind = 'tf' then
      if v_correct not in ('true','false') then raise exception 'question %: choose true or false', v_i; end if;
      v_opts := '{}';
    elsif v_kind = 'short' then
      if v_correct = '' then raise exception 'question %: give at least one accepted answer', v_i; end if;
      v_opts := '{}';
    else raise exception 'question %: unknown type', v_i;
    end if;
    insert into public.assessment_questions (assessment_id, position, kind, prompt, options, correct, marks)
    values (p_assessment, v_i, v_kind, trim(q->>'prompt'), v_opts, v_correct, v_marks);
    v_total := v_total + v_marks;
  end loop;
  update public.assessments
    set online = v_i > 0, kind = case when v_i > 0 then 'quiz' else kind end,
        max_marks = case when v_total > 0 then v_total else max_marks end
    where id = p_assessment;
  return jsonb_build_object('ok', true, 'questions', v_i, 'max_marks', v_total);
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
    'opened_at', a.opened_at, 'closes_at', a.closes_at, 'show_results', a.show_results,
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'kind', q.kind, 'prompt', q.prompt,
                   'options', to_jsonb(q.options), 'correct', q.correct, 'marks', q.marks) order by q.position)
                 from public.assessment_questions q where q.assessment_id = a.id), '[]'::jsonb))
    from public.assessments a where a.id = p_assessment);
end $$;

-- open: students can start now (p_time_limit minutes each; p_closes_in minutes
-- until no one can start or continue). closed: submits & marks every attempt.
-- draft: back to editing (only if nobody has started).
create or replace function public.quiz_set_status(p_assessment uuid, p_status text, p_time_limit int default null,
                                                  p_closes_in int default null, p_show_results boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_course uuid;
begin
  select course_id into v_course from public.assessments where id = p_assessment;
  if v_course is null or not public.can_teach(v_course) then raise exception 'not authorized'; end if;
  if p_status = 'open' then
    if not exists (select 1 from public.assessment_questions where assessment_id = p_assessment) then
      raise exception 'add at least one question before opening the quiz';
    end if;
    update public.assessments set quiz_status = 'open', online = true,
      time_limit_min = nullif(p_time_limit, 0),
      opened_at = now(), assessed_on = coalesce(assessed_on, current_date),
      closes_at = case when coalesce(p_closes_in, 0) > 0 then now() + make_interval(mins => p_closes_in) else null end,
      show_results = coalesce(p_show_results, true)
    where id = p_assessment;
  elsif p_status = 'closed' then
    update public.assessments set quiz_status = 'closed', closes_at = least(coalesce(closes_at, now()), now()) where id = p_assessment;
    perform public._quiz_finalize(p_assessment, true);
  elsif p_status = 'draft' then
    if exists (select 1 from public.quiz_attempts where assessment_id = p_assessment) then
      raise exception 'students have already started this quiz';
    end if;
    update public.assessments set quiz_status = 'draft', opened_at = null, closes_at = null where id = p_assessment;
  else raise exception 'invalid status';
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- Live monitor: every enrolled student with their attempt state.
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
        'started_at', t.started_at, 'submitted_at', t.submitted_at, 'score', t.score) order by s.full_name)
      from public.enrolments e join public.students s on s.id = e.student_id
      left join public.quiz_attempts t on t.assessment_id = a.id and t.student_id = s.id
      where e.course_id = a.course_id and e.status <> 'dropped'), '[]'::jsonb),
    'questions', (select count(*) from public.assessment_questions q where q.assessment_id = a.id))
    from public.assessments a where a.id = p_assessment);
end $$;

-- ---- student ---------------------------------------------------------------
-- Online quizzes on my modules that are open or closed (drafts stay hidden).
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
      'state', case when t.student_id is null then 'not_started' when t.submitted_at is null then 'in_progress' else 'submitted' end,
      'score', case when a.show_results or a.quiz_status = 'closed' then t.score end,
      'submitted_at', t.submitted_at) order by (a.quiz_status = 'open') desc, a.opened_at desc nulls last)
    from public.assessments a
    join public.courses c on c.id = a.course_id
    left join public.quiz_attempts t on t.assessment_id = a.id and t.student_id = v_sid
    where a.online and a.quiz_status in ('open','closed') and public.is_enrolled(a.course_id)), '[]'::jsonb);
end $$;

-- Start (or resume) my attempt. Returns the questions WITHOUT answers.
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
    'submitted', t.submitted_at is not null, 'answers', t.answers,
    'score', case when t.submitted_at is not null and (a.show_results or a.quiz_status = 'closed') then t.score end,
    'questions', case when t.submitted_at is not null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object(
        'id', q.id, 'kind', q.kind, 'prompt', q.prompt, 'options', to_jsonb(q.options), 'marks', q.marks) order by q.position)
      from public.assessment_questions q where q.assessment_id = a.id), '[]'::jsonb) end);
end $$;

-- Autosave: merges {question_id: answer}. Ignored once time is up or submitted.
create or replace function public.quiz_save_answers(p_assessment uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_sid uuid := public.my_student_id(); v_n int;
begin
  update public.quiz_attempts t
    set answers = t.answers || (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
                                from jsonb_each_text(coalesce(p_answers, '{}'::jsonb)) as e(k, v)
                                where exists (select 1 from public.assessment_questions q
                                              where q.assessment_id = p_assessment and q.id::text = e.k))
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
  return jsonb_build_object('ok', true, 'score', case when v_show then v_score end, 'max', v_max);
end $$;

-- ---- gradebook: same as 20261007120000, plus each column's online/quiz_status
create or replace function public.course_gradebook(p_course uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_cols jsonb; v_students jsonb; r record;
begin
  if not public.can_teach(p_course) then raise exception 'not authorized'; end if;
  for r in select id from public.assessments where course_id = p_course and online and quiz_status = 'open' loop
    perform public._quiz_autoclose(r.id);
  end loop;

  drop table if exists _gb_cols; drop table if exists _gb_marks;
  create temp table _gb_marks (col_id uuid, student_id uuid, mark numeric) on commit drop;
  insert into _gb_marks
    select m.assessment_id, m.student_id, m.mark from public.assessment_marks m
      join public.assessments a on a.id = m.assessment_id where a.course_id = p_course
    union all
    select s.assignment_id, s.student_id, s.grade::numeric from public.submissions s
      join public.assignments g on g.id = s.assignment_id where g.course_id = p_course and s.grade is not null;

  create temp table _gb_cols (id uuid, title text, kind text, max_marks numeric, weight numeric, on_date date, source text,
                              has_marks boolean, online boolean, quiz_status text) on commit drop;
  insert into _gb_cols
    select a.id, a.title, a.kind, a.max_marks, a.weight, a.assessed_on, 'assessment', exists (select 1 from _gb_marks k where k.col_id = a.id),
           a.online, a.quiz_status
      from public.assessments a where a.course_id = p_course
    union all
    select g.id, g.title, 'assignment', g.max_marks::numeric, 1::numeric, g.due::date, 'assignment', exists (select 1 from _gb_marks k where k.col_id = g.id),
           false, null
      from public.assignments g where g.course_id = p_course;

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'title', title, 'kind', kind, 'max', max_marks,
           'weight', weight, 'date', on_date, 'source', source, 'online', online, 'quiz_status', quiz_status)
           order by on_date nulls last, title), '[]'::jsonb)
    into v_cols from _gb_cols;

  select coalesce(jsonb_agg(row order by name), '[]'::jsonb) into v_students from (
    select s.full_name as name, jsonb_build_object(
      'student_id', s.id, 'name', s.full_name,
      'marks', coalesce((select jsonb_object_agg(k.col_id::text, k.mark) from _gb_marks k where k.student_id = s.id), '{}'::jsonb),
      'ca', (select case when coalesce(sum(c.weight), 0) = 0 then null
                    else round(100 * sum(coalesce(k.mark, 0) / c.max_marks * c.weight) / sum(c.weight), 1) end
             from _gb_cols c left join _gb_marks k on k.col_id = c.id and k.student_id = s.id
             where c.has_marks)
    ) as row
    from public.enrolments e join public.students s on s.id = e.student_id
    where e.course_id = p_course and e.status <> 'dropped'
  ) q;

  return jsonb_build_object('assessments', v_cols, 'students', v_students);
end $$;

-- ---- grants ----------------------------------------------------------------
do $$
declare fn text;
begin
  foreach fn in array array['_quiz_grade(uuid,uuid)', '_quiz_finalize(uuid,boolean)', '_quiz_autoclose(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', fn);
  end loop;
  foreach fn in array array[
    'quiz_save_questions(uuid,jsonb)', 'quiz_get(uuid)', 'quiz_set_status(uuid,text,int,int,boolean)',
    'quiz_monitor(uuid)', 'student_quizzes()', 'quiz_start(uuid)', 'quiz_save_answers(uuid,jsonb)', 'quiz_submit(uuid,jsonb)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;

notify pgrst, 'reload schema';
