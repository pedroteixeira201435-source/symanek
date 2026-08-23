-- ============================================================================
-- Symanek — Phase C: class timetable backend (Scheduling module core).
--
-- A standard timetable-slot model: one row per (class group × weekday × period)
-- with the subject, venue and lecturer. RPCs to read/set/clear slots, writes
-- gated to the registrar workspace, staff read. The relief board and duty roster
-- (HR-ops) stay demo for now — this backs the academic-timetable core.
-- ============================================================================

create table if not exists public.timetable_slots (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid references public.institutions(id),
  class_group       text not null,                 -- e.g. 'CVT-4 Y2'
  day_of_week       int  not null check (day_of_week between 1 and 5),
  period_id         text not null,                 -- e.g. 'P1' (see PERIODS)
  subject           text not null,
  venue             text,
  lecturer_staff_id uuid references public.staff(id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (class_group, day_of_week, period_id)     -- one class can't be double-booked
);
create index if not exists timetable_class_idx on public.timetable_slots (class_group);

-- ---------- RPCs ----------
create or replace function public.timetable(p_class text default null)
returns table (id uuid, class_group text, day_of_week int, period_id text,
               subject text, venue text, lecturer text)
language sql stable security definer set search_path = public as $$
  select t.id, t.class_group, t.day_of_week, t.period_id, t.subject, t.venue,
         coalesce(st.name, '') as lecturer
  from public.timetable_slots t
  left join public.staff st on st.id = t.lecturer_staff_id
  where p_class is null or t.class_group = p_class
  order by t.class_group, t.day_of_week, t.period_id;
$$;

create or replace function public.timetable_set(
  p_class text, p_day int, p_period text, p_subject text,
  p_venue text default null, p_lecturer_staff_no text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_staff uuid; v_id uuid;
begin
  if not public.has_suite_role('registrar') then raise exception 'not authorized'; end if;
  if p_lecturer_staff_no is not null then
    select id into v_staff from public.staff where staff_no = p_lecturer_staff_no;
  end if;
  insert into public.timetable_slots (class_group, day_of_week, period_id, subject, venue, lecturer_staff_id)
  values (trim(p_class), p_day, trim(p_period), trim(p_subject), nullif(trim(coalesce(p_venue,'')),''), v_staff)
  on conflict (class_group, day_of_week, period_id) do update
    set subject = excluded.subject, venue = excluded.venue, lecturer_staff_id = excluded.lecturer_staff_id
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.timetable_clear(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_suite_role('registrar') then raise exception 'not authorized'; end if;
  delete from public.timetable_slots where id = p_id;
end $$;

revoke all on function public.timetable(text) from public;
revoke all on function public.timetable_set(text,int,text,text,text,text) from public;
revoke all on function public.timetable_clear(uuid) from public;
grant execute on function public.timetable(text) to authenticated;
grant execute on function public.timetable_set(text,int,text,text,text,text) to authenticated;
grant execute on function public.timetable_clear(uuid) to authenticated;

-- ---------- RLS ----------
alter table public.timetable_slots enable row level security;
drop policy if exists "timetable read"  on public.timetable_slots;
drop policy if exists "timetable write" on public.timetable_slots;
create policy "timetable read"  on public.timetable_slots for select using (public.is_admin());
create policy "timetable write" on public.timetable_slots for all
  using (public.has_suite_role('registrar')) with check (public.has_suite_role('registrar'));

-- ---------- seed a sample week for one class group ----------
insert into public.timetable_slots (tenant_id, class_group, day_of_week, period_id, subject, venue)
select (select id from public.institutions where name = 'Symanek Specialized College'),
       v.cg, v.d, v.p, v.subj, v.rm
from (values
  ('CVT-4 Y2',1,'P1','Workshop Practice & Safety','Workshop A'),
  ('CVT-4 Y2',1,'P2','Workshop Practice & Safety','Workshop A'),
  ('CVT-4 Y2',2,'P1','Trade Theory','Rm 12'),
  ('CVT-4 Y2',3,'P4','Mathematics for OHS','Rm 12'),
  ('CVT-4 Y2',4,'P1','Industry Attachment Prep','Rm 8'),
  ('CVT-4 Y2',5,'P2','Entrepreneurship','Rm 8')
) as v(cg,d,p,subj,rm)
where not exists (select 1 from public.timetable_slots t
                  where t.class_group = v.cg and t.day_of_week = v.d and t.period_id = v.p);

notify pgrst, 'reload schema';
