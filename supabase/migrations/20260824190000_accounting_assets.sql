-- ============================================================================
-- Symanek — Accounting: asset register + VAT calendar (the two remaining demo
-- tabs). GL (journal / trial balance) already has a real backend. Writes gated
-- to `bursar`. Empty by default. Idempotent.
-- ============================================================================

create table if not exists public.asset_register (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid references public.institutions(id),
  name         text not null,
  category     text,
  acquired_on  date,
  cost         numeric(14,2) not null default 0,
  life_years   int not null default 5 check (life_years > 0),
  method       text not null default 'straight-line',
  accumulated  numeric(14,2) not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists public.vat_periods (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references public.institutions(id),
  period     text not null,             -- e.g. '2026-05/06'
  output_vat numeric(14,2) not null default 0,
  input_vat  numeric(14,2) not null default 0,
  status     text not null default 'open' check (status in ('open','filed','paid')),
  due        date,
  created_at timestamptz not null default now(),
  unique (period)
);

alter table public.asset_register enable row level security;
alter table public.vat_periods    enable row level security;
do $$
declare t text;
begin
  foreach t in array array['asset_register','vat_periods'] loop
    execute format('drop policy if exists "%s read" on public.%s', t, t);
    execute format('drop policy if exists "%s write" on public.%s', t, t);
    execute format('create policy "%s read" on public.%s for select using (public.is_admin())', t, t);
    execute format('create policy "%s write" on public.%s for all using (public.has_suite_role(''bursar'')) with check (public.has_suite_role(''bursar''))', t, t);
  end loop;
end $$;

create or replace function public.asset_register_list()
returns table (id uuid, name text, category text, acquired_on date, cost numeric, life_years int, accumulated numeric, book_value numeric)
language sql stable security definer set search_path = public as $$
  select id, name, category, acquired_on, cost, life_years, accumulated, (cost - accumulated) as book_value
  from public.asset_register order by acquired_on desc nulls last, name;
$$;

create or replace function public.vat_calendar_list()
returns table (id uuid, period text, output_vat numeric, input_vat numeric, net numeric, status text, due date)
language sql stable security definer set search_path = public as $$
  select id, period, output_vat, input_vat, (output_vat - input_vat) as net, status, due
  from public.vat_periods order by period desc;
$$;

create or replace function public.asset_add(p_name text, p_category text, p_acquired date, p_cost numeric, p_life int)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.has_suite_role('bursar') then raise exception 'not authorized'; end if;
  insert into public.asset_register (tenant_id, name, category, acquired_on, cost, life_years)
  values ((select id from public.institutions order by created_at limit 1), trim(p_name), nullif(trim(p_category),''), p_acquired, coalesce(p_cost,0), greatest(1, coalesce(p_life,5)))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.asset_delete(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_suite_role('bursar') then raise exception 'not authorized'; end if;
  delete from public.asset_register where id = p_id;
end $$;

-- Record one year of straight-line depreciation (capped at cost).
create or replace function public.asset_depreciate(p_id uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_annual numeric; v_new numeric; v_cost numeric; v_acc numeric; v_life int;
begin
  if not public.has_suite_role('bursar') then raise exception 'not authorized'; end if;
  select cost, accumulated, life_years into v_cost, v_acc, v_life from public.asset_register where id = p_id;
  if v_cost is null then raise exception 'asset not found'; end if;
  v_annual := round(v_cost / v_life, 2);
  v_new := least(v_cost, v_acc + v_annual);
  update public.asset_register set accumulated = v_new where id = p_id;
  return v_new - v_acc;
end $$;

create or replace function public.vat_period_set(p_period text, p_output numeric, p_input numeric, p_status text, p_due date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_suite_role('bursar') then raise exception 'not authorized'; end if;
  insert into public.vat_periods (tenant_id, period, output_vat, input_vat, status, due)
  values ((select id from public.institutions order by created_at limit 1), trim(p_period), coalesce(p_output,0), coalesce(p_input,0), coalesce(p_status,'open'), p_due)
  on conflict (period) do update set output_vat = excluded.output_vat, input_vat = excluded.input_vat, status = excluded.status, due = excluded.due;
end $$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'asset_register_list()','vat_calendar_list()','asset_add(text,text,date,numeric,int)',
    'asset_delete(uuid)','asset_depreciate(uuid)','vat_period_set(text,numeric,numeric,text,date)'
  ] loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;

notify pgrst, 'reload schema';
