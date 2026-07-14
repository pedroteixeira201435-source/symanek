-- ============================================================================
-- Symanek Suite — core management schema (Phase 2, Track B / B1)
-- Extends the shared backend (init.sql) with the internal SaaS domain:
-- tenant, academics, finance, HR/payroll, residences, exams, LMS, compliance.
-- Follows BACKEND.md. Seed from src/data.js is a follow-up (B1b).
-- Does NOT collide with the public-site tables (programmes/applications/
-- students/payments) — it references and extends them.
-- ============================================================================

-- ---------- tenant ----------
create table public.institutions (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  type            text not null default 'Vocational college'
                  check (type in ('Vocational college', 'Full university', 'Distance')),
  modules_enabled text[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Extend site `students` with the Suite fields (BACKEND.md §students).
alter table public.students
  add column if not exists tenant_id    uuid references public.institutions(id),
  add column if not exists student_no   text,
  add column if not exists year         int,
  add column if not exists next_of_kin  text,
  add column if not exists phone        text,
  add column if not exists attendance   numeric(5,2);

-- Fine-grained Suite role on the profile (the 4-value profiles.role enum from
-- init.sql is too coarse for the 9 Suite workspaces). auth.js resolves the
-- workspace from this; profiles.role stays authoritative for is_admin()/RLS.
alter table public.profiles
  add column if not exists suite_role text;

-- Enrich site `programmes` with Suite catalogue fields (coordinator/enrolled/etc).
alter table public.programmes
  add column if not exists nqf           int,
  add column if not exists years         int,
  add column if not exists coordinator   text,
  add column if not exists enrolled      int,
  add column if not exists accreditation text;

-- ---------- courses / curriculum ----------
create table public.courses (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid references public.institutions(id),
  code              text not null,
  title             text not null,
  programme_id      uuid references public.programmes(id),
  credits           int not null default 0,
  semester          text,
  lecturer_staff_id uuid,
  capacity          int not null default 0,
  prereq_course_id  uuid references public.courses(id),
  prereq_code       text,
  enrolled          int,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on public.courses (programme_id);

-- ---------- staff / HR ----------
create table public.staff (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid references public.institutions(id),
  user_id     uuid references auth.users(id) on delete set null,
  staff_no    text,
  name        text not null,
  email       text,
  role        text,
  department  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.courses
  add constraint courses_lecturer_fk
  foreign key (lecturer_staff_id) references public.staff(id) on delete set null;

create table public.contracts (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid not null references public.staff(id) on delete cascade,
  type       text,
  start_date date,
  end_date   date,
  fte        numeric(4,2) default 1.0,
  created_at timestamptz not null default now()
);

create table public.qualifications (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid not null references public.staff(id) on delete cascade,
  title       text not null,
  institution text,
  year        int
);

create table public.leave_requests (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid not null references public.staff(id) on delete cascade,
  type       text,
  start_date date,
  end_date   date,
  status     text not null default 'pending'
             check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table public.payroll_runs (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid not null references public.staff(id) on delete cascade,
  month      text not null,
  gross      numeric(12,2) not null default 0,
  paye       numeric(12,2) not null default 0,
  ssc        numeric(12,2) not null default 0,
  vet        numeric(12,2) not null default 0,
  net        numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- enrolments / results ----------
create table public.enrolments (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references public.institutions(id),
  student_id uuid not null references public.students(id) on delete cascade,
  course_id  uuid not null references public.courses(id) on delete cascade,
  semester   text,
  status     text not null default 'registered'
             check (status in ('registered', 'waitlisted', 'passed', 'failed', 'dropped')),
  charge     numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (student_id, course_id, semester)
);

create table public.results (
  id           uuid primary key default gen_random_uuid(),
  enrolment_id uuid not null references public.enrolments(id) on delete cascade,
  ca           numeric(5,2),
  exam         numeric(5,2),
  final        numeric(5,2),
  grade        text,
  published    boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ---------- finance (tuition; site `payments` stays for application fees) ----------
create table public.invoices (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references public.institutions(id),
  student_id uuid not null references public.students(id) on delete cascade,
  amount     numeric(12,2) not null default 0,
  balance    numeric(12,2) not null default 0,
  due        date,
  status     text not null default 'open'
             check (status in ('open', 'part', 'paid', 'overdue', 'void')),
  created_at timestamptz not null default now()
);
create index on public.invoices (student_id);

create table public.invoice_payments (
  id         uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount     numeric(12,2) not null,
  method     text not null default 'EFT',
  ref        text,
  created_at timestamptz not null default now()
);

create table public.holds (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  type       text not null check (type in ('financial', 'advising', 'conduct', 'library')),
  reason     text,
  blocks     text[] not null default '{}',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.holds (student_id) where active;

-- ---------- sponsors ----------
create table public.sponsors (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references public.institutions(id),
  name       text not null,
  type       text
);

create table public.sponsor_claims (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  coverage   numeric(12,2) not null default 0,
  billed     numeric(12,2) not null default 0,
  received   numeric(12,2) not null default 0,
  status     text not null default 'pending',
  created_at timestamptz not null default now()
);

-- ---------- residences ----------
create table public.residences (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.institutions(id),
  name      text not null,
  capacity  int not null default 0
);

create table public.allocations (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students(id) on delete cascade,
  residence_id uuid not null references public.residences(id) on delete cascade,
  room         text,
  fee          numeric(12,2) not null default 0,
  status       text not null default 'allocated'
               check (status in ('allocated', 'waitlisted', 'vacated')),
  created_at   timestamptz not null default now()
);

-- ---------- exams ----------
create table public.exam_sittings (
  id                  uuid primary key default gen_random_uuid(),
  course_id           uuid not null references public.courses(id) on delete cascade,
  venue               text,
  seats               int not null default 0,
  invigilator_staff_id uuid references public.staff(id) on delete set null,
  at                  timestamptz
);

-- ---------- compliance ----------
create table public.nche_returns (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references public.institutions(id),
  title      text not null,
  period     text,
  status     text not null default 'draft'
             check (status in ('draft', 'submitted', 'accepted')),
  due        date,
  created_at timestamptz not null default now()
);

-- ---------- LMS / courseware ----------
create table public.courseware (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid not null references public.courses(id) on delete cascade,
  title      text not null,
  url        text,
  created_at timestamptz not null default now()
);

create table public.assignments (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid not null references public.courses(id) on delete cascade,
  title      text not null,
  due        date,
  max_marks  int not null default 100,
  created_at timestamptz not null default now()
);

create table public.submissions (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  file_url      text,
  grade         numeric(5,2),
  created_at    timestamptz not null default now(),
  unique (student_id, assignment_id)
);

-- ---------- audit ----------
create table public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references public.institutions(id),
  user_id    uuid references auth.users(id) on delete set null,
  action     text not null,
  entity     text,
  at         timestamptz not null default now()
);

-- ---------- updated_at triggers ----------
create trigger trg_institutions_updated before update on public.institutions
  for each row execute function public.set_updated_at();
create trigger trg_courses_updated before update on public.courses
  for each row execute function public.set_updated_at();
create trigger trg_staff_updated before update on public.staff
  for each row execute function public.set_updated_at();

-- ============================================================================
-- RLS — staff/admin manage everything; students read their own rows.
-- Mirrors init.sql's is_admin() model. Refined per-role in B3.
-- ============================================================================
alter table public.institutions    enable row level security;
alter table public.courses         enable row level security;
alter table public.staff           enable row level security;
alter table public.contracts       enable row level security;
alter table public.qualifications  enable row level security;
alter table public.leave_requests  enable row level security;
alter table public.payroll_runs    enable row level security;
alter table public.enrolments      enable row level security;
alter table public.results         enable row level security;
alter table public.invoices        enable row level security;
alter table public.invoice_payments enable row level security;
alter table public.holds           enable row level security;
alter table public.sponsors        enable row level security;
alter table public.sponsor_claims  enable row level security;
alter table public.residences      enable row level security;
alter table public.allocations     enable row level security;
alter table public.exam_sittings   enable row level security;
alter table public.nche_returns    enable row level security;
alter table public.courseware      enable row level security;
alter table public.assignments     enable row level security;
alter table public.submissions     enable row level security;
alter table public.audit_log       enable row level security;

-- programmes & courseware & courses are public-readable (catalogue); rest admin-only for now.
create policy "courses public read"  on public.courses for select using (true);
create policy "courses admin write"  on public.courses for all using (public.is_admin()) with check (public.is_admin());
create policy "courseware read"      on public.courseware for select using (true);
create policy "courseware admin"     on public.courseware for all using (public.is_admin()) with check (public.is_admin());

-- admin-manage-all for the operational tables
do $$
declare t text;
begin
  foreach t in array array[
    'institutions','staff','contracts','qualifications','leave_requests','payroll_runs',
    'enrolments','results','invoices','invoice_payments','holds','sponsors','sponsor_claims',
    'residences','allocations','exam_sittings','nche_returns','assignments','submissions','audit_log'
  ] loop
    execute format('create policy %I on public.%I for all using (public.is_admin()) with check (public.is_admin());',
                   t || ' admin all', t);
  end loop;
end $$;

-- students read their own academic/financial rows (by students.user_id).
create policy "enrolments owner read" on public.enrolments for select
  using (exists (select 1 from public.students s where s.id = enrolments.student_id and s.user_id = auth.uid()));
create policy "results owner read" on public.results for select
  using (exists (select 1 from public.enrolments e join public.students s on s.id = e.student_id
                 where e.id = results.enrolment_id and s.user_id = auth.uid()));
create policy "invoices owner read" on public.invoices for select
  using (exists (select 1 from public.students s where s.id = invoices.student_id and s.user_id = auth.uid()));
create policy "holds owner read" on public.holds for select
  using (exists (select 1 from public.students s where s.id = holds.student_id and s.user_id = auth.uid()));
create policy "submissions owner" on public.submissions for all
  using (exists (select 1 from public.students s where s.id = submissions.student_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.students s where s.id = submissions.student_id and s.user_id = auth.uid()));
