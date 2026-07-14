-- ============================================================================
-- Symanek Specialized College — initial schema
-- Shared backend for the public site (Next.js) and the admin Suite (Vite).
-- Server-authoritative admissions flow:
--   submit -> (admin) approve -> reference SYM-YYYY-NNNN + letter -> EFT pay
--   -> (admin) mark paid -> enrolled (portal unlocks).
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------- enums ----------
create type public.application_stage as enum
  ('submitted', 'under_review', 'approved', 'rejected', 'paid', 'enrolled');

create type public.study_mode as enum ('full_time', 'distance');

-- ---------- updated_at helper ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- profiles (staff / student roles, keyed to auth.users) ----------
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  role       text not null default 'staff'
             check (role in ('admin', 'staff', 'student', 'applicant')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'staff')
  );
$$;

-- ---------- programmes (seeded from lib/content.ts) ----------
create table public.programmes (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  name         text not null,
  category     text not null,
  level        text,
  duration     text not null,
  fee          numeric(12,2),          -- N$
  modes        text,
  description  text not null,
  requirements text,
  careers      text[] not null default '{}',
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on public.programmes (category);

-- ---------- reference counter (SYM-YYYY-NNNN) ----------
create table public.reference_counters (
  year     int primary key,
  last_seq int not null default 0
);

create or replace function public.next_reference()
returns text language plpgsql security definer set search_path = public as $$
declare
  y int := extract(year from now())::int;
  n int;
begin
  insert into public.reference_counters (year, last_seq) values (y, 1)
    on conflict (year) do update set last_seq = public.reference_counters.last_seq + 1
    returning last_seq into n;
  return 'SYM-' || y || '-' || lpad(n::text, 4, '0');
end;
$$;

-- ---------- applications ----------
create table public.applications (
  id                   uuid primary key default gen_random_uuid(),
  reference            text unique,                    -- assigned on approval
  full_name            text not null,
  email                text not null,
  phone                text not null,
  programme_id         uuid not null references public.programmes(id),
  programme_slug       text not null,
  mode                 public.study_mode not null default 'full_time',
  message              text,
  stage                public.application_stage not null default 'submitted',
  applicant_user_id    uuid references auth.users(id) on delete set null,
  amount_due           numeric(12,2) not null default 0,
  approval_letter_path text,
  reviewed_by          uuid references auth.users(id),
  reviewed_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index on public.applications (stage);
create index on public.applications (lower(email));
create trigger trg_applications_updated
  before update on public.applications
  for each row execute function public.set_updated_at();

-- ---------- students (created on approval) ----------
create table public.students (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid unique references public.applications(id) on delete cascade,
  reference      text unique not null,
  full_name      text not null,
  email          text not null,
  programme_id   uuid references public.programmes(id),
  status         text not null default 'admitted',   -- admitted | enrolled
  user_id        uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);

-- ---------- payments (EFT, reconciled by reference) ----------
create table public.payments (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  reference      text not null,
  amount         numeric(12,2) not null,
  method         text not null default 'EFT',
  recorded_by    uuid references auth.users(id),
  created_at     timestamptz not null default now()
);
create index on public.payments (application_id);

-- ---------- contact messages ----------
create table public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  subject    text not null,
  message    text not null,
  handled    boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Server-authoritative operations (SECURITY DEFINER RPCs)
-- ============================================================================

-- Public: submit an application (anon). Locks down which fields can be set.
create or replace function public.submit_application(
  p_full_name text, p_email text, p_phone text,
  p_programme_slug text, p_mode text, p_message text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_prog uuid; v_id uuid;
begin
  select id into v_prog from public.programmes where slug = p_programme_slug and active;
  if v_prog is null then raise exception 'unknown programme %', p_programme_slug; end if;

  insert into public.applications
    (full_name, email, phone, programme_id, programme_slug, mode, message, stage)
  values
    (trim(p_full_name), lower(trim(p_email)), trim(p_phone), v_prog, p_programme_slug,
     (case when p_mode ilike 'dist%' then 'distance' else 'full_time' end)::public.study_mode,
     nullif(trim(p_message), ''), 'submitted')
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.submit_application(text,text,text,text,text,text) to anon, authenticated;

-- Public: contact form (anon).
create or replace function public.submit_contact(
  p_name text, p_email text, p_subject text, p_message text
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.contact_messages (name, email, subject, message)
  values (trim(p_name), lower(trim(p_email)), trim(p_subject), trim(p_message));
end;
$$;
grant execute on function public.submit_contact(text,text,text,text) to anon, authenticated;

-- Public: portal status lookup by reference OR email (anon). Returns safe fields only.
create or replace function public.get_application_status(p_ref text)
returns table (
  found boolean, full_name text, programme text, stage text,
  reference text, amount_due numeric, approval_letter_path text
) language plpgsql stable security definer set search_path = public as $$
declare v_app public.applications; v_prog text;
begin
  select a.* into v_app from public.applications a
   where upper(a.reference) = upper(trim(p_ref))
      or lower(a.email)     = lower(trim(p_ref))
   order by a.created_at desc limit 1;

  if v_app.id is null then
    return query select false, null::text, null::text, null::text,
                        null::text, null::numeric, null::text;
    return;
  end if;

  select p.name || coalesce(' (' || p.level || ')', '')
    into v_prog from public.programmes p where p.id = v_app.programme_id;

  return query select
    true, v_app.full_name, v_prog, v_app.stage::text, v_app.reference,
    case when v_app.stage in ('approved','paid') then v_app.amount_due else 0 end,
    case when v_app.stage in ('approved','paid','enrolled') then v_app.approval_letter_path else null end;
end;
$$;
grant execute on function public.get_application_status(text) to anon, authenticated;

-- Admin: approve an application -> reference + amount + student + letter path. Idempotent.
create or replace function public.approve_application(p_app uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_app public.applications; v_fee numeric; v_ref text;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select * into v_app from public.applications where id = p_app for update;
  if v_app.id is null then raise exception 'application not found'; end if;
  if v_app.reference is not null then return v_app.reference; end if;

  select fee into v_fee from public.programmes where id = v_app.programme_id;
  v_ref := public.next_reference();

  update public.applications set
    stage = 'approved', reference = v_ref, amount_due = coalesce(v_fee, 0),
    approval_letter_path = 'approval-letters/' || v_ref || '.pdf',
    reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_app;

  insert into public.students (application_id, reference, full_name, email, programme_id, status)
  values (p_app, v_ref, v_app.full_name, v_app.email, v_app.programme_id, 'admitted')
  on conflict (application_id) do nothing;

  return v_ref;
end;
$$;

-- Admin: record an EFT payment; auto-enrol once fully paid.
create or replace function public.mark_paid(
  p_app uuid, p_amount numeric, p_method text default 'EFT'
) returns text language plpgsql security definer set search_path = public as $$
declare v_app public.applications; v_total numeric;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select * into v_app from public.applications where id = p_app for update;
  if v_app.reference is null then raise exception 'application not approved yet'; end if;

  insert into public.payments (application_id, reference, amount, method, recorded_by)
  values (p_app, v_app.reference, p_amount, p_method, auth.uid());

  select coalesce(sum(amount), 0) into v_total from public.payments where application_id = p_app;

  if v_total >= v_app.amount_due then
    update public.applications set stage = 'enrolled' where id = p_app;
    update public.students set status = 'enrolled' where application_id = p_app;
  else
    update public.applications set stage = 'paid' where id = p_app;
  end if;
  return v_app.reference;
end;
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles          enable row level security;
alter table public.programmes        enable row level security;
alter table public.applications      enable row level security;
alter table public.students          enable row level security;
alter table public.payments          enable row level security;
alter table public.contact_messages  enable row level security;
alter table public.reference_counters enable row level security;

-- profiles: user reads own; admin manages all
create policy "profiles self read"  on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles admin write" on public.profiles for all using (public.is_admin()) with check (public.is_admin());

-- programmes: anyone can read active; admin manages
create policy "programmes public read" on public.programmes for select using (active or public.is_admin());
create policy "programmes admin write" on public.programmes for all using (public.is_admin()) with check (public.is_admin());

-- applications: admin full; applicant reads own (linked account). Anon writes via RPC only.
create policy "applications admin all" on public.applications for all using (public.is_admin()) with check (public.is_admin());
create policy "applications owner read" on public.applications for select using (applicant_user_id = auth.uid());

-- students / payments: admin full; student reads own
create policy "students admin all"  on public.students for all using (public.is_admin()) with check (public.is_admin());
create policy "students owner read"  on public.students for select using (user_id = auth.uid());
create policy "payments admin all"   on public.payments for all using (public.is_admin()) with check (public.is_admin());

-- contact messages: admin reads (insert via RPC)
create policy "contact admin read" on public.contact_messages for select using (public.is_admin());

-- reference_counters: no direct client access (RPC only)
create policy "counters admin read" on public.reference_counters for select using (public.is_admin());

-- ============================================================================
-- Storage buckets (private)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('application-docs', 'application-docs', false),
       ('approval-letters', 'approval-letters', false)
on conflict (id) do nothing;

-- admin manages everything in both buckets
create policy "storage admin all" on storage.objects for all
  using (bucket_id in ('application-docs','approval-letters') and public.is_admin())
  with check (bucket_id in ('application-docs','approval-letters') and public.is_admin());

-- authenticated applicants may upload their supporting documents
create policy "docs authenticated upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'application-docs');
