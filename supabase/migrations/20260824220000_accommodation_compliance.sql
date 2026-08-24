-- ============================================================================
-- Symanek — Accommodation (residences/allocations CRUD, replacing the mock
-- allocateRoom stub) + Compliance (NCHE returns submit, institution profile).
-- Residence writes gated to `registrar`; compliance to `registrar`. Idempotent.
-- ============================================================================

-- ---- Accommodation ----
create or replace function public.residences_list()
returns table (id uuid, name text, capacity int, allocated int, waitlisted int)
language sql stable security definer set search_path = public as $$
  select r.id, r.name, r.capacity,
         (select count(*)::int from public.allocations a where a.residence_id = r.id and a.status = 'allocated'),
         (select count(*)::int from public.allocations a where a.residence_id = r.id and a.status = 'waitlisted')
  from public.residences r order by r.name;
$$;
create or replace function public.allocations_list()
returns table (id uuid, student text, residence text, room text, fee numeric, status text)
language sql stable security definer set search_path = public as $$
  select a.id, s.full_name, r.name, a.room, a.fee, a.status
  from public.allocations a
  join public.students s on s.id = a.student_id
  join public.residences r on r.id = a.residence_id
  order by r.name, a.room;
$$;

create or replace function public.residence_upsert(p_id uuid, p_name text, p_capacity int)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.has_suite_role('registrar') then raise exception 'not authorized'; end if;
  if p_id is null then
    insert into public.residences (tenant_id, name, capacity)
    values ((select id from public.institutions order by created_at limit 1), trim(p_name), coalesce(p_capacity,0)) returning id into v_id;
  else
    update public.residences set name = trim(p_name), capacity = coalesce(p_capacity,0) where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;
create or replace function public.residence_delete(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_suite_role('registrar') then raise exception 'not authorized'; end if;
  delete from public.residences where id = p_id;
end $$;

-- Allocate (or waitlist if the residence is full) a student to a room.
create or replace function public.allocate_room(p_student uuid, p_residence uuid, p_room text, p_fee numeric)
returns json language plpgsql security definer set search_path = public as $$
declare v_cap int; v_used int; v_status text;
begin
  if not public.has_suite_role('registrar') then raise exception 'not authorized'; end if;
  select capacity into v_cap from public.residences where id = p_residence;
  if v_cap is null then raise exception 'residence not found'; end if;
  select count(*) into v_used from public.allocations where residence_id = p_residence and status = 'allocated';
  v_status := case when v_used >= v_cap then 'waitlisted' else 'allocated' end;
  insert into public.allocations (student_id, residence_id, room, fee, status)
  values (p_student, p_residence, nullif(trim(p_room),''), coalesce(p_fee,0), v_status);
  return json_build_object('ok', true, 'status', v_status);
end $$;

create or replace function public.allocation_set_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_suite_role('registrar') then raise exception 'not authorized'; end if;
  if p_status not in ('allocated','waitlisted','vacated') then raise exception 'bad status'; end if;
  update public.allocations set status = p_status where id = p_id;
end $$;

-- ---- Compliance ----
create or replace function public.nche_returns_list()
returns table (id uuid, title text, period text, status text, due date)
language sql stable security definer set search_path = public as $$
  select id, title, period, status, due from public.nche_returns order by due desc nulls last, created_at desc;
$$;

create or replace function public.nche_return_set(p_id uuid, p_title text, p_period text, p_status text, p_due date)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.has_suite_role('registrar') then raise exception 'not authorized'; end if;
  if p_status not in ('draft','submitted','accepted') then raise exception 'bad status'; end if;
  if p_id is null then
    insert into public.nche_returns (tenant_id, title, period, status, due)
    values ((select id from public.institutions order by created_at limit 1), trim(p_title), nullif(trim(p_period),''), coalesce(p_status,'draft'), p_due) returning id into v_id;
  else
    update public.nche_returns set title = trim(p_title), period = nullif(trim(p_period),''), status = coalesce(p_status,'draft'), due = p_due where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.institution_get()
returns json language sql stable security definer set search_path = public as $$
  select coalesce((select row_to_json(t) from (
    select id, name, type, modules_enabled from public.institutions order by created_at limit 1) t), '{}'::json);
$$;
create or replace function public.institution_set(p_name text, p_type text, p_modules text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then raise exception 'not authorized'; end if;
  update public.institutions set name = coalesce(nullif(trim(p_name),''), name),
    type = coalesce(p_type, type), modules_enabled = coalesce(p_modules, modules_enabled), updated_at = now()
  where id = (select id from public.institutions order by created_at limit 1);
end $$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'residences_list()','allocations_list()','residence_upsert(uuid,text,int)','residence_delete(uuid)',
    'allocate_room(uuid,uuid,text,numeric)','allocation_set_status(uuid,text)',
    'nche_returns_list()','nche_return_set(uuid,text,text,text,date)','institution_get()','institution_set(text,text,text[])'
  ] loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;

notify pgrst, 'reload schema';
