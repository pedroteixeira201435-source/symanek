-- ============================================================================
-- Symanek Suite — Phase 1 (production): backend for the 2026 client-review
-- features that currently exist only as mock UI. Adds real tables, views, RPCs
-- and RLS for: intakes (Jan/Jul), subject types, class attendance + the 80%
-- exam-admission rule, 1st/2nd examination opportunities, academic control
-- windows (open/close), student announcements, official documents, a role
-- permission matrix, and staff activation (block access).
-- Idempotent where practical; follows the is_admin()/tenant_id patterns.
-- ============================================================================

-- ---------- Intakes (January / July) ----------
alter table public.students     add column if not exists intake text check (intake in ('january','july'));
alter table public.students     add column if not exists academic_year int;
alter table public.applications add column if not exists intake text check (intake in ('january','july'));
alter table public.enrolments   add column if not exists intake text check (intake in ('january','july'));
alter table public.enrolments   add column if not exists academic_year int;

-- ---------- Subject type (semester vs year) ----------
alter table public.courses add column if not exists subject_type text
  check (subject_type in ('semester','year')) default 'semester';

-- ---------- Staff activation (block access) ----------
alter table public.staff add column if not exists active boolean not null default true;

-- ---------- Second-opportunity exam mark ----------
-- results.exam holds the first-opportunity paper; exam2 the second-opportunity re-sit.
alter table public.results add column if not exists exam2   numeric(5,2);
alter table public.results add column if not exists outcome text
  check (outcome in ('pass','second_opportunity','fail'));

-- exam_sittings: which opportunity this sitting is for.
alter table public.exam_sittings add column if not exists opportunity int not null default 1
  check (opportunity in (1,2));
alter table public.exam_sittings add column if not exists intake text check (intake in ('january','july'));

-- ============================================================================
-- Class attendance (feeds the 80% examination-admission rule)
-- ============================================================================
create table if not exists public.attendance (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references public.institutions(id),
  student_id uuid not null references public.students(id) on delete cascade,
  course_id  uuid references public.courses(id) on delete cascade,
  session_date date not null default current_date,
  hours      numeric(5,2) not null default 1,
  present    boolean not null default true,
  recorded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists attendance_student_idx on public.attendance (student_id);

-- Per-student attendance % across all recorded sessions (api.js reads this).
create or replace view public.attendance_summary as
select
  s.id as student_id,
  coalesce(sum(a.hours) filter (where a.present), 0)          as hours_attended,
  coalesce(sum(a.hours), 0)                                    as hours_total,
  case when coalesce(sum(a.hours),0) = 0 then 0
       else round(100 * sum(a.hours) filter (where a.present) / sum(a.hours), 1)
  end                                                          as percent
from public.students s
left join public.attendance a on a.student_id = s.id
group by s.id;

-- 80% rule: is a student cleared for the final examination?
create or replace function public.exam_admission_ok(p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select percent from public.attendance_summary where student_id = p_student), 0) >= 80;
$$;
grant execute on function public.exam_admission_ok(uuid) to authenticated;

-- ============================================================================
-- Academic control windows (open/close application, registration, marks, etc.)
-- ============================================================================
create table if not exists public.academic_windows (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid references public.institutions(id),
  kind          text not null check (kind in
                  ('applications','registration','marks_insertion','marks_release',
                   'second_opportunity','graduation_clearance')),
  academic_year int,
  intake        text check (intake in ('january','july')),
  opens_at      timestamptz,
  closes_at     timestamptz,
  is_open       boolean not null default false,   -- manual master switch
  updated_at    timestamptz not null default now(),
  unique (kind, academic_year, intake)
);

-- A window counts as open if the master switch is on AND (no date bounds, or now is within them).
create or replace function public.window_open(p_kind text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.academic_windows w
    where w.kind = p_kind
      and w.is_open
      and (w.opens_at  is null or now() >= w.opens_at)
      and (w.closes_at is null or now() <= w.closes_at)
  );
$$;
grant execute on function public.window_open(text) to anon, authenticated;

-- Admin opens/closes a window.
create or replace function public.set_academic_window(
  p_kind text, p_is_open boolean,
  p_opens_at timestamptz default null, p_closes_at timestamptz default null,
  p_year int default null, p_intake text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  insert into public.academic_windows (kind, is_open, opens_at, closes_at, academic_year, intake)
  values (p_kind, p_is_open, p_opens_at, p_closes_at, p_year, p_intake)
  on conflict (kind, academic_year, intake) do update
    set is_open = excluded.is_open, opens_at = excluded.opens_at,
        closes_at = excluded.closes_at, updated_at = now();
  insert into public.audit_log (user_id, action, entity)
  values (auth.uid(), 'set_window:' || p_kind || '=' || p_is_open, 'academic_windows');
end $$;
grant execute on function public.set_academic_window(text,boolean,timestamptz,timestamptz,int,text) to authenticated;

-- ============================================================================
-- Student announcements
-- ============================================================================
create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references public.institutions(id),
  title      text not null,
  body       text not null,
  audience   text not null default 'students' check (audience in ('students','staff','all')),
  programme_id uuid references public.programmes(id),
  intake     text check (intake in ('january','july')),
  pinned     boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists announcements_audience_idx on public.announcements (audience);

-- ============================================================================
-- Official documents (exam permit, proof of registration, academic record,
-- statement of results, admission/rejection letter). The PDF is generated
-- app-side into the private bucket; this table is the register.
-- ============================================================================
create table if not exists public.documents (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references public.institutions(id),
  student_id uuid references public.students(id) on delete cascade,
  type       text not null check (type in
               ('exam_permit','proof_of_registration','academic_record',
                'statement_of_results','admission_letter','rejection_letter')),
  path       text,          -- storage path in 'student-documents'
  meta       jsonb not null default '{}',
  issued_by  uuid references auth.users(id),
  issued_at  timestamptz not null default now()
);
create index if not exists documents_student_idx on public.documents (student_id);

insert into storage.buckets (id, name, public)
values ('student-documents', 'student-documents', false)
on conflict (id) do nothing;

-- ============================================================================
-- Role permission matrix (moves ROLE_NAV / access-control out of the client)
-- ============================================================================
create table if not exists public.role_permissions (
  id       uuid primary key default gen_random_uuid(),
  role     text not null,      -- suite_role: admin|bursar|hr|teacher|librarian|registrar|student|seller|applicant
  module   text not null,      -- Shell MODULES key
  can_view boolean not null default false,
  can_edit boolean not null default false,
  unique (role, module)
);

-- ============================================================================
-- HR self-service RPCs (apply for leave; manager approves)
-- ============================================================================
create or replace function public.apply_leave(
  p_type text, p_start date, p_end date
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_staff uuid; v_id uuid;
begin
  select id into v_staff from public.staff where user_id = auth.uid();
  if v_staff is null then raise exception 'no staff record for current user'; end if;
  insert into public.leave_requests (staff_id, type, start_date, end_date, status)
  values (v_staff, p_type, p_start, p_end, 'pending') returning id into v_id;
  return v_id;
end $$;
grant execute on function public.apply_leave(text,date,date) to authenticated;

create or replace function public.decide_leave(p_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.leave_requests set status = case when p_approve then 'approved' else 'rejected' end
  where id = p_id;
  insert into public.audit_log (user_id, action, entity)
  values (auth.uid(), 'decide_leave:' || p_approve, 'leave_requests');
end $$;
grant execute on function public.decide_leave(uuid,boolean) to authenticated;

-- ============================================================================
-- RLS for the new tables
-- ============================================================================
alter table public.attendance        enable row level security;
alter table public.academic_windows  enable row level security;
alter table public.announcements     enable row level security;
alter table public.documents         enable row level security;
alter table public.role_permissions  enable row level security;

-- admin-manage-all
do $$
declare t text;
begin
  foreach t in array array['attendance','academic_windows','announcements','documents','role_permissions'] loop
    execute format('create policy %I on public.%I for all using (public.is_admin()) with check (public.is_admin());',
                   t || ' admin all', t);
  end loop;
end $$;

-- students read their own attendance, announcements, and documents
create policy "attendance owner read" on public.attendance for select
  using (exists (select 1 from public.students s where s.id = attendance.student_id and s.user_id = auth.uid()));
create policy "documents owner read" on public.documents for select
  using (exists (select 1 from public.students s where s.id = documents.student_id and s.user_id = auth.uid()));
create policy "announcements read" on public.announcements for select
  using (audience in ('students','all') or public.is_admin());
create policy "windows public read" on public.academic_windows for select using (true);
create policy "role_permissions read" on public.role_permissions for select using (true);

-- staff read their own leave; students already covered by earlier owner policies.
create policy "leave owner read" on public.leave_requests for select
  using (exists (select 1 from public.staff st where st.id = leave_requests.staff_id and st.user_id = auth.uid()));
create policy "leave owner insert" on public.leave_requests for insert to authenticated
  with check (exists (select 1 from public.staff st where st.id = leave_requests.staff_id and st.user_id = auth.uid()));

-- documents in the private bucket: admin manages; owner reads via signed URLs (server-side).
create policy "student-docs admin all" on storage.objects for all
  using (bucket_id = 'student-documents' and public.is_admin())
  with check (bucket_id = 'student-documents' and public.is_admin());

notify pgrst, 'reload schema';
