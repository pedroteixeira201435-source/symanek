-- ============================================================================
-- Symanek — Scheduling: periods, staff duty roster and relief/cover board (the
-- remaining demo tabs). The academic timetable already persists (timetable_slots).
-- Writes gated to `registrar`. Empty by default. Idempotent.
-- ============================================================================

create table if not exists public.periods (
  id         text primary key,               -- 'P1'
  label      text not null,
  start_time text,
  end_time   text,
  ord        int not null default 0
);

create table if not exists public.duty_roster (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references public.institutions(id),
  day_of_week int not null check (day_of_week between 1 and 7),
  area       text not null,
  staff_id   uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.relief_cover (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid references public.institutions(id),
  cover_date      date not null default current_date,
  absent_staff_id uuid references public.staff(id) on delete set null,
  cover_staff_id  uuid references public.staff(id) on delete set null,
  class_group     text,
  period_id       text,
  note            text,
  created_at      timestamptz not null default now()
);

alter table public.periods       enable row level security;
alter table public.duty_roster   enable row level security;
alter table public.relief_cover  enable row level security;
do $$
declare t text;
begin
  foreach t in array array['periods','duty_roster','relief_cover'] loop
    execute format('drop policy if exists "%s read" on public.%s', t, t);
    execute format('drop policy if exists "%s write" on public.%s', t, t);
    execute format('create policy "%s read" on public.%s for select using (public.is_admin())', t, t);
    execute format('create policy "%s write" on public.%s for all using (public.has_suite_role(''registrar'')) with check (public.has_suite_role(''registrar''))', t, t);
  end loop;
end $$;

-- ---- reads ----
create or replace function public.periods_list()
returns table (id text, label text, start_time text, end_time text, ord int)
language sql stable security definer set search_path = public as $$
  select id, label, start_time, end_time, ord from public.periods order by ord, id;
$$;
create or replace function public.duty_roster_list()
returns table (id uuid, day_of_week int, area text, staff text, staff_id uuid)
language sql stable security definer set search_path = public as $$
  select d.id, d.day_of_week, d.area, s.name, d.staff_id
  from public.duty_roster d left join public.staff s on s.id = d.staff_id
  order by d.day_of_week, d.area;
$$;
create or replace function public.relief_list(p_date date default current_date)
returns table (id uuid, cover_date date, absent text, cover text, class_group text, period_id text, note text)
language sql stable security definer set search_path = public as $$
  select r.id, r.cover_date, a.name, c.name, r.class_group, r.period_id, r.note
  from public.relief_cover r
  left join public.staff a on a.id = r.absent_staff_id
  left join public.staff c on c.id = r.cover_staff_id
  where r.cover_date = coalesce(p_date, current_date) order by r.period_id;
$$;

-- ---- writes (registrar) ----
create or replace function public.period_set(p_id text, p_label text, p_start text, p_end text, p_ord int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_suite_role('registrar') then raise exception 'not authorized'; end if;
  insert into public.periods (id, label, start_time, end_time, ord)
  values (trim(p_id), trim(p_label), nullif(trim(p_start),''), nullif(trim(p_end),''), coalesce(p_ord,0))
  on conflict (id) do update set label = excluded.label, start_time = excluded.start_time, end_time = excluded.end_time, ord = excluded.ord;
end $$;
create or replace function public.period_delete(p_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_suite_role('registrar') then raise exception 'not authorized'; end if;
  delete from public.periods where id = p_id;
end $$;

create or replace function public.duty_set(p_id uuid, p_day int, p_area text, p_staff uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.has_suite_role('registrar') then raise exception 'not authorized'; end if;
  if p_id is null then
    insert into public.duty_roster (tenant_id, day_of_week, area, staff_id)
    values ((select id from public.institutions order by created_at limit 1), p_day, trim(p_area), p_staff) returning id into v_id;
  else
    update public.duty_roster set day_of_week = p_day, area = trim(p_area), staff_id = p_staff where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;
create or replace function public.duty_delete(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_suite_role('registrar') then raise exception 'not authorized'; end if;
  delete from public.duty_roster where id = p_id;
end $$;

create or replace function public.relief_set(p_date date, p_absent uuid, p_cover uuid, p_class text, p_period text, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.has_suite_role('registrar') then raise exception 'not authorized'; end if;
  insert into public.relief_cover (tenant_id, cover_date, absent_staff_id, cover_staff_id, class_group, period_id, note)
  values ((select id from public.institutions order by created_at limit 1), coalesce(p_date, current_date), p_absent, p_cover, nullif(trim(p_class),''), nullif(trim(p_period),''), nullif(trim(p_note),''))
  returning id into v_id;
  return v_id;
end $$;
create or replace function public.relief_delete(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_suite_role('registrar') then raise exception 'not authorized'; end if;
  delete from public.relief_cover where id = p_id;
end $$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'periods_list()','duty_roster_list()','relief_list(date)',
    'period_set(text,text,text,text,int)','period_delete(text)',
    'duty_set(uuid,int,text,uuid)','duty_delete(uuid)',
    'relief_set(date,uuid,uuid,text,text,text)','relief_delete(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;

notify pgrst, 'reload schema';
