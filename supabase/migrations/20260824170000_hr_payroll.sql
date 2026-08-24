-- ============================================================================
-- Symanek — HR / Payroll backend. Adds leave balances, recruitment and workload
-- tables, and CRUD + payroll RPCs so the HR workspace is fully live and empty by
-- default. Statutory deductions (PAYE/SSC/VET) are computed from the editable
-- business_settings (Namibia, Labour Act 2007 / NamRA). Writes gated to `hr`.
-- Idempotent.
-- ============================================================================

create table if not exists public.leave_balances (
  id       uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  annual   int not null default 24,
  sick     int not null default 30,
  taken    int not null default 0,
  unique (staff_id)
);

create table if not exists public.recruitment (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references public.institutions(id),
  position   text not null,
  candidate  text,
  stage      text not null default 'applied'
             check (stage in ('applied','screening','interview','offer','hired','rejected')),
  notes      text,
  created_at timestamptz not null default now()
);

create table if not exists public.workload (
  id        uuid primary key default gen_random_uuid(),
  staff_id  uuid not null references public.staff(id) on delete cascade,
  courses   int not null default 0,
  periods   int not null default 0,
  students  int not null default 0,
  unique (staff_id)
);

alter table public.leave_balances enable row level security;
alter table public.recruitment    enable row level security;
alter table public.workload       enable row level security;
do $$ begin
  perform 1;
  -- leave_balances
  execute 'drop policy if exists "leave_balances read" on public.leave_balances';
  execute 'drop policy if exists "leave_balances write" on public.leave_balances';
  execute 'create policy "leave_balances read" on public.leave_balances for select using (public.is_admin())';
  execute 'create policy "leave_balances write" on public.leave_balances for all using (public.has_suite_role(''hr'')) with check (public.has_suite_role(''hr''))';
  -- recruitment
  execute 'drop policy if exists "recruitment read" on public.recruitment';
  execute 'drop policy if exists "recruitment write" on public.recruitment';
  execute 'create policy "recruitment read" on public.recruitment for select using (public.is_admin())';
  execute 'create policy "recruitment write" on public.recruitment for all using (public.has_suite_role(''hr'')) with check (public.has_suite_role(''hr''))';
  -- workload
  execute 'drop policy if exists "workload read" on public.workload';
  execute 'drop policy if exists "workload write" on public.workload';
  execute 'create policy "workload read" on public.workload for select using (public.is_admin())';
  execute 'create policy "workload write" on public.workload for all using (public.has_suite_role(''hr'')) with check (public.has_suite_role(''hr''))';
end $$;

-- ---- statutory helpers (read rates from business_settings) ----
create or replace function public.paye_monthly(p_gross numeric)
returns numeric language sql stable security definer set search_path = public as $$
  with b as (
    select (e->>'from')::numeric as f, (e->>'to') as t, (e->>'rate')::numeric as rate, (e->>'fixed')::numeric as fixed
    from public.business_settings s cross join lateral jsonb_array_elements(s.value) e
    where s.key = 'paye_brackets'
  ), annual as (select p_gross * 12 as a)
  select coalesce((
    select round((b.fixed + b.rate * greatest(0, annual.a - (b.f - 1))) / 12, 2)
    from b, annual
    where annual.a >= b.f and (b.t is null or b.t = 'null' or annual.a <= b.t::numeric)
    limit 1
  ), 0);
$$;

create or replace function public.ssc_monthly(p_gross numeric)
returns numeric language sql stable security definer set search_path = public as $$
  select least(round(p_gross * coalesce((select (value->>'rate')::numeric from public.business_settings where key='ssc'), 0.009), 2),
               coalesce((select (value->>'cap')::numeric from public.business_settings where key='ssc'), 81));
$$;

-- ---- reads ----
create or replace function public.hr_payroll_list()
returns table (id uuid, staff text, month text, gross numeric, paye numeric, ssc numeric, vet numeric, net numeric)
language sql stable security definer set search_path = public as $$
  select r.id, s.name, r.month, r.gross, r.paye, r.ssc, r.vet, r.net
  from public.payroll_runs r join public.staff s on s.id = r.staff_id
  order by r.created_at desc;
$$;
create or replace function public.hr_leave_balances_list()
returns table (staff_id uuid, staff text, annual int, sick int, taken int)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, coalesce(b.annual,24), coalesce(b.sick,30), coalesce(b.taken,0)
  from public.staff s left join public.leave_balances b on b.staff_id = s.id order by s.name;
$$;
create or replace function public.hr_recruitment_list()
returns table (id uuid, position text, candidate text, stage text, notes text)
language sql stable security definer set search_path = public as $$
  select id, position, candidate, stage, notes from public.recruitment order by created_at desc;
$$;
create or replace function public.hr_workload_list()
returns table (staff_id uuid, staff text, department text, courses int, periods int, students int)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.department, coalesce(w.courses,0), coalesce(w.periods,0), coalesce(w.students,0)
  from public.staff s left join public.workload w on w.staff_id = s.id order by s.name;
$$;
create or replace function public.hr_staff_detail(p_staff uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'contracts', coalesce((select json_agg(row_to_json(c)) from (
        select type, start_date, end_date, fte from public.contracts where staff_id = p_staff order by start_date desc) c), '[]'::json),
    'qualifications', coalesce((select json_agg(row_to_json(q)) from (
        select title, institution, year from public.qualifications where staff_id = p_staff order by year desc) q), '[]'::json)
  );
$$;

-- ---- writes (hr) ----
create or replace function public.staff_upsert(
  p_id uuid, p_staff_no text, p_name text, p_email text, p_role text, p_department text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.has_suite_role('hr') then raise exception 'not authorized'; end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'name required'; end if;
  if p_id is null then
    insert into public.staff (tenant_id, staff_no, name, email, role, department)
    values ((select id from public.institutions order by created_at limit 1),
            nullif(trim(p_staff_no),''), trim(p_name), nullif(trim(p_email),''), nullif(trim(p_role),''), nullif(trim(p_department),''))
    returning id into v_id;
  else
    update public.staff set staff_no = nullif(trim(p_staff_no),''), name = trim(p_name),
      email = nullif(trim(p_email),''), role = nullif(trim(p_role),''), department = nullif(trim(p_department),''),
      updated_at = now() where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.staff_delete(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_suite_role('hr') then raise exception 'not authorized'; end if;
  delete from public.staff where id = p_id;
end $$;

create or replace function public.contract_set(p_staff uuid, p_type text, p_start date, p_end date, p_fte numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_suite_role('hr') then raise exception 'not authorized'; end if;
  insert into public.contracts (staff_id, type, start_date, end_date, fte)
  values (p_staff, p_type, p_start, p_end, coalesce(p_fte,1.0));
end $$;

create or replace function public.qualification_add(p_staff uuid, p_title text, p_institution text, p_year int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_suite_role('hr') then raise exception 'not authorized'; end if;
  insert into public.qualifications (staff_id, title, institution, year) values (p_staff, trim(p_title), nullif(trim(p_institution),''), p_year);
end $$;

create or replace function public.leave_balance_set(p_staff uuid, p_annual int, p_sick int, p_taken int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_suite_role('hr') then raise exception 'not authorized'; end if;
  insert into public.leave_balances (staff_id, annual, sick, taken)
  values (p_staff, coalesce(p_annual,24), coalesce(p_sick,30), coalesce(p_taken,0))
  on conflict (staff_id) do update set annual = excluded.annual, sick = excluded.sick, taken = excluded.taken;
end $$;

create or replace function public.recruit_upsert(p_id uuid, p_position text, p_candidate text, p_stage text, p_notes text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.has_suite_role('hr') then raise exception 'not authorized'; end if;
  if p_id is null then
    insert into public.recruitment (tenant_id, position, candidate, stage, notes)
    values ((select id from public.institutions order by created_at limit 1), trim(p_position), nullif(trim(p_candidate),''), coalesce(p_stage,'applied'), nullif(trim(p_notes),''))
    returning id into v_id;
  else
    update public.recruitment set position = trim(p_position), candidate = nullif(trim(p_candidate),''),
      stage = coalesce(p_stage,'applied'), notes = nullif(trim(p_notes),'') where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.workload_set(p_staff uuid, p_courses int, p_periods int, p_students int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_suite_role('hr') then raise exception 'not authorized'; end if;
  insert into public.workload (staff_id, courses, periods, students)
  values (p_staff, coalesce(p_courses,0), coalesce(p_periods,0), coalesce(p_students,0))
  on conflict (staff_id) do update set courses = excluded.courses, periods = excluded.periods, students = excluded.students;
end $$;

-- Compute + record a payslip. PAYE/SSC from business_settings; VET levy is the
-- employer 1% of gross (Vocational Education & Training Act). net = gross-PAYE-SSC.
create or replace function public.payroll_run(p_staff uuid, p_month text, p_gross numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_paye numeric; v_ssc numeric; v_vet numeric; v_net numeric; v_id uuid;
begin
  if not public.has_suite_role('hr') then raise exception 'not authorized'; end if;
  v_paye := public.paye_monthly(p_gross);
  v_ssc  := public.ssc_monthly(p_gross);
  v_vet  := round(p_gross * coalesce((select (value->>'rate')::numeric from public.business_settings where key='vet_levy'), 0.01), 2);
  v_net  := p_gross - v_paye - v_ssc;
  insert into public.payroll_runs (staff_id, month, gross, paye, ssc, vet, net)
  values (p_staff, p_month, p_gross, v_paye, v_ssc, v_vet, v_net) returning id into v_id;
  return v_id;
end $$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'paye_monthly(numeric)','ssc_monthly(numeric)','hr_payroll_list()','hr_leave_balances_list()',
    'hr_recruitment_list()','hr_workload_list()','hr_staff_detail(uuid)',
    'staff_upsert(uuid,text,text,text,text,text)','staff_delete(uuid)','contract_set(uuid,text,date,date,numeric)',
    'qualification_add(uuid,text,text,int)','leave_balance_set(uuid,int,int,int)',
    'recruit_upsert(uuid,text,text,text,text)','workload_set(uuid,int,int,int)','payroll_run(uuid,text,numeric)'
  ] loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;

notify pgrst, 'reload schema';
