-- ============================================================================
-- Symanek Suite — (1) tests/quizzes gradebook, (2) live classes + recordings.
--
--  1. assessments + assessment_marks: a lecturer sets up tests, quizzes,
--     practicals… per module and records a mark per student. course_gradebook()
--     returns them together with the graded assignments and a computed CA %
--     (weighted average; a missing mark counts as 0 once the assessment has
--     marks). The lecturer then copies the CA into the marksheet (60% CA).
--  2. class_sessions: scheduled / live / ended online classes per module, with a
--     meeting link (auto Jitsi room unless one is pasted) and a recording
--     (external link and/or parts uploaded to course-files/recordings/…).
--
-- All access is through SECURITY DEFINER RPCs gated by can_teach()/is_enrolled()
-- (20260927120000 / 20260928120000). Idempotent.
-- ============================================================================

-- ---- 1. assessments ---------------------------------------------------------
create table if not exists public.assessments (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses(id) on delete cascade,
  title       text not null,
  kind        text not null default 'test' check (kind in ('test','quiz','practical','presentation','other')),
  max_marks   numeric not null default 100 check (max_marks > 0),
  weight      numeric not null default 1 check (weight > 0),
  assessed_on date,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists assessments_course_idx on public.assessments(course_id);

create table if not exists public.assessment_marks (
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id    uuid not null references public.students(id) on delete cascade,
  mark          numeric not null check (mark >= 0),
  updated_at    timestamptz not null default now(),
  primary key (assessment_id, student_id)
);

alter table public.assessments enable row level security;
alter table public.assessment_marks enable row level security;   -- no policies: RPC-only

create or replace function public.assessment_upsert(
  p_id uuid, p_course uuid, p_title text, p_kind text, p_max numeric, p_weight numeric, p_date date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_id is not null then select course_id into p_course from public.assessments where id = p_id; end if;
  if p_course is null or not public.can_teach(p_course) then raise exception 'not authorized'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'title is required'; end if;
  if p_id is null then
    insert into public.assessments (course_id, title, kind, max_marks, weight, assessed_on)
    values (p_course, trim(p_title), coalesce(p_kind, 'test'), coalesce(p_max, 100), coalesce(p_weight, 1), p_date)
    returning id into v_id;
  else
    update public.assessments
      set title = trim(p_title), kind = coalesce(p_kind, kind), max_marks = coalesce(p_max, max_marks),
          weight = coalesce(p_weight, weight), assessed_on = p_date
      where id = p_id returning id into v_id;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.assessment_delete(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_course uuid;
begin
  select course_id into v_course from public.assessments where id = p_id;
  if v_course is null or not public.can_teach(v_course) then raise exception 'not authorized'; end if;
  delete from public.assessments where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- p_marks = [{student_id, mark}] ; blank/null mark clears it.
create or replace function public.assessment_save_marks(p_assessment uuid, p_marks jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_course uuid; v_max numeric; m jsonb; v_mark numeric; v_n int := 0; v_sid uuid;
begin
  select course_id, max_marks into v_course, v_max from public.assessments where id = p_assessment;
  if v_course is null or not public.can_teach(v_course) then raise exception 'not authorized'; end if;
  for m in select * from jsonb_array_elements(coalesce(p_marks, '[]'::jsonb)) loop
    v_sid := (m->>'student_id')::uuid;
    if not exists (select 1 from public.enrolments e where e.course_id = v_course and e.student_id = v_sid) then continue; end if;
    v_mark := nullif(m->>'mark', '')::numeric;
    if v_mark is null then
      delete from public.assessment_marks where assessment_id = p_assessment and student_id = v_sid;
    else
      if v_mark < 0 or v_mark > v_max then raise exception 'mark % is outside 0..%', v_mark, v_max; end if;
      insert into public.assessment_marks (assessment_id, student_id, mark) values (p_assessment, v_sid, v_mark)
      on conflict (assessment_id, student_id) do update set mark = excluded.mark, updated_at = now();
    end if;
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'saved', v_n);
end $$;

-- Gradebook for the lecturer: assessments (+ graded assignments) x students, with CA %.
-- Volatile on purpose (temp tables). CA = weighted % over the columns that have at least one mark.
create or replace function public.course_gradebook(p_course uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_cols jsonb; v_students jsonb;
begin
  if not public.can_teach(p_course) then raise exception 'not authorized'; end if;

  drop table if exists _gb_cols; drop table if exists _gb_marks;
  create temp table _gb_marks (col_id uuid, student_id uuid, mark numeric) on commit drop;
  insert into _gb_marks
    select m.assessment_id, m.student_id, m.mark from public.assessment_marks m
      join public.assessments a on a.id = m.assessment_id where a.course_id = p_course
    union all
    select s.assignment_id, s.student_id, s.grade::numeric from public.submissions s
      join public.assignments g on g.id = s.assignment_id where g.course_id = p_course and s.grade is not null;

  create temp table _gb_cols (id uuid, title text, kind text, max_marks numeric, weight numeric, on_date date, source text, has_marks boolean) on commit drop;
  insert into _gb_cols
    select a.id, a.title, a.kind, a.max_marks, a.weight, a.assessed_on, 'assessment', exists (select 1 from _gb_marks k where k.col_id = a.id)
      from public.assessments a where a.course_id = p_course
    union all
    select g.id, g.title, 'assignment', g.max_marks::numeric, 1::numeric, g.due::date, 'assignment', exists (select 1 from _gb_marks k where k.col_id = g.id)
      from public.assignments g where g.course_id = p_course;

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'title', title, 'kind', kind, 'max', max_marks,
           'weight', weight, 'date', on_date, 'source', source) order by on_date nulls last, title), '[]'::jsonb)
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

-- The signed-in student's own test/quiz marks (current + past modules).
create or replace function public.student_assessments()
returns table (course_id uuid, code text, course_title text, title text, kind text,
               max_marks numeric, mark numeric, assessed_on date)
language sql stable security definer set search_path = public as $$
  select c.id, c.code, c.title, a.title, a.kind, a.max_marks, m.mark, a.assessed_on
  from public.assessment_marks m
  join public.assessments a on a.id = m.assessment_id
  join public.courses c on c.id = a.course_id
  where m.student_id = public.my_student_id()
  order by a.assessed_on desc nulls last, a.created_at desc;
$$;

-- ---- 2. live classes --------------------------------------------------------
create table if not exists public.class_sessions (
  id              uuid primary key default gen_random_uuid(),
  course_id       uuid not null references public.courses(id) on delete cascade,
  title           text not null,
  starts_at       timestamptz not null default now(),
  duration_min    int not null default 60,
  status          text not null default 'scheduled' check (status in ('scheduled','live','ended','cancelled')),
  meeting_url     text,
  notes           text,
  started_at      timestamptz,
  ended_at        timestamptz,
  recording_url   text,
  recording_paths text[] not null default '{}',
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now()
);
create index if not exists class_sessions_course_idx on public.class_sessions(course_id, starts_at desc);
alter table public.class_sessions enable row level security;   -- RPC-only

create or replace function public.class_session_upsert(
  p_id uuid, p_course uuid, p_title text, p_starts_at timestamptz, p_duration int,
  p_meeting_url text, p_notes text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_code text; v_url text := nullif(trim(coalesce(p_meeting_url, '')), '');
begin
  if p_id is not null then select course_id into p_course from public.class_sessions where id = p_id; end if;
  if p_course is null or not public.can_teach(p_course) then raise exception 'not authorized'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'title is required'; end if;
  if v_url is not null and v_url !~* '^https?://' then raise exception 'meeting link must start with http(s)://'; end if;
  if p_id is null then
    select regexp_replace(code, '[^A-Za-z0-9]', '', 'g') into v_code from public.courses where id = p_course;
    v_url := coalesce(v_url, 'https://meet.jit.si/Symanek-' || coalesce(v_code, 'class') || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10));
    insert into public.class_sessions (course_id, title, starts_at, duration_min, meeting_url, notes)
    values (p_course, trim(p_title), coalesce(p_starts_at, now()), coalesce(p_duration, 60), v_url, nullif(trim(coalesce(p_notes, '')), ''))
    returning id into v_id;
  else
    update public.class_sessions
      set title = trim(p_title), starts_at = coalesce(p_starts_at, starts_at), duration_min = coalesce(p_duration, duration_min),
          meeting_url = coalesce(v_url, meeting_url), notes = nullif(trim(coalesce(p_notes, '')), '')
      where id = p_id returning id into v_id;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.class_session_set_status(p_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_course uuid;
begin
  if p_status not in ('scheduled','live','ended','cancelled') then raise exception 'invalid status'; end if;
  select course_id into v_course from public.class_sessions where id = p_id;
  if v_course is null or not public.can_teach(v_course) then raise exception 'not authorized'; end if;
  update public.class_sessions set status = p_status,
    started_at = case when p_status = 'live' then coalesce(started_at, now()) else started_at end,
    ended_at   = case when p_status = 'ended' then now() else ended_at end
  where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- p_url = external recording link (null keeps it); p_add_path = a part just uploaded.
create or replace function public.class_session_set_recording(p_id uuid, p_url text, p_add_path text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_course uuid; v_url text := nullif(trim(coalesce(p_url, '')), '');
begin
  select course_id into v_course from public.class_sessions where id = p_id;
  if v_course is null or not public.can_teach(v_course) then raise exception 'not authorized'; end if;
  if v_url is not null and v_url !~* '^https?://' then raise exception 'recording link must start with http(s)://'; end if;
  if p_add_path is not null and p_add_path not like 'recordings/' || v_course::text || '/%' then
    raise exception 'invalid recording path';
  end if;
  update public.class_sessions
    set recording_url = coalesce(v_url, recording_url),
        recording_paths = case when p_add_path is null then recording_paths
                               else array_append(recording_paths, p_add_path) end
  where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.class_session_delete(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_course uuid;
begin
  select course_id into v_course from public.class_sessions where id = p_id;
  if v_course is null or not public.can_teach(v_course) then raise exception 'not authorized'; end if;
  delete from public.class_sessions where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- Lecturer: their modules' classes. Student: classes of modules they are on.
create or replace function public.class_sessions_list(p_course uuid default null)
returns table (id uuid, course_id uuid, code text, course_title text, title text, starts_at timestamptz,
               duration_min int, status text, meeting_url text, notes text, started_at timestamptz,
               ended_at timestamptz, recording_url text, recording_paths text[])
language sql stable security definer set search_path = public as $$
  select s.id, s.course_id, c.code, c.title, s.title, s.starts_at, s.duration_min, s.status,
         s.meeting_url, s.notes, s.started_at, s.ended_at, s.recording_url, s.recording_paths
  from public.class_sessions s
  join public.courses c on c.id = s.course_id
  where (p_course is null or s.course_id = p_course)
    and (public.can_teach(s.course_id) or (s.status <> 'cancelled' and public.is_enrolled(s.course_id)))
  order by s.starts_at desc;
$$;

-- ---- recordings in the private bucket ---------------------------------------
-- recordings/<course_id>/<session_id>/<file>: lecturer writes, enrolled students read.
create or replace function public.course_file_access(p_name text, p_write boolean)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare parts text[] := string_to_array(p_name, '/'); v_course uuid; v_assignment uuid; v_student uuid;
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
  end if;
  return false;
exception when others then
  return false;
end $$;

-- ---- grants -----------------------------------------------------------------
do $$
declare fn text;
begin
  foreach fn in array array[
    'assessment_upsert(uuid,uuid,text,text,numeric,numeric,date)', 'assessment_delete(uuid)',
    'assessment_save_marks(uuid,jsonb)', 'course_gradebook(uuid)', 'student_assessments()',
    'class_session_upsert(uuid,uuid,text,timestamptz,int,text,text)', 'class_session_set_status(uuid,text)',
    'class_session_set_recording(uuid,text,text)', 'class_session_delete(uuid)', 'class_sessions_list(uuid)',
    'course_file_access(text,boolean)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;

notify pgrst, 'reload schema';
