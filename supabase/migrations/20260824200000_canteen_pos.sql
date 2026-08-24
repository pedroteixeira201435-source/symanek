-- ============================================================================
-- Symanek — Canteen/POS: product CRUD, inventory, till sessions and student
-- prepaid accounts (the remaining demo tabs). Sales already persist via
-- canteen_record_sale. Writes gated to `seller` (products/till) and topups too.
-- Empty by default. Idempotent.
-- ============================================================================

create table if not exists public.canteen_student_accounts (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  balance    numeric(10,2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (student_id)
);

create table if not exists public.canteen_till_sessions (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references public.institutions(id),
  opened_at  timestamptz not null default now(),
  opened_by  uuid references auth.users(id),
  float_amt  numeric(10,2) not null default 0,
  closed_at  timestamptz,
  counted    numeric(10,2),
  expected   numeric(10,2),
  status     text not null default 'open' check (status in ('open','closed'))
);

alter table public.canteen_student_accounts enable row level security;
alter table public.canteen_till_sessions    enable row level security;
do $$
declare t text;
begin
  foreach t in array array['canteen_student_accounts','canteen_till_sessions'] loop
    execute format('drop policy if exists "%s read" on public.%s', t, t);
    execute format('drop policy if exists "%s write" on public.%s', t, t);
    execute format('create policy "%s read" on public.%s for select using (public.is_admin())', t, t);
    execute format('create policy "%s write" on public.%s for all using (public.has_suite_role(''seller'',''bursar'')) with check (public.has_suite_role(''seller'',''bursar''))', t, t);
  end loop;
end $$;

-- ---- reads ----
create or replace function public.canteen_till_list()
returns table (id uuid, opened_at timestamptz, closed_at timestamptz, float_amt numeric, counted numeric, expected numeric, variance numeric, status text)
language sql stable security definer set search_path = public as $$
  select id, opened_at, closed_at, float_amt, counted, expected,
         (coalesce(counted,0) - coalesce(expected,0)) as variance, status
  from public.canteen_till_sessions order by opened_at desc;
$$;
create or replace function public.canteen_accounts_list()
returns table (student_id uuid, student text, balance numeric)
language sql stable security definer set search_path = public as $$
  select a.student_id, s.full_name, a.balance
  from public.canteen_student_accounts a join public.students s on s.id = a.student_id
  order by s.full_name;
$$;

-- ---- writes (seller/bursar) ----
create or replace function public.canteen_product_upsert(p_id uuid, p_name text, p_category text, p_price numeric, p_stock int, p_reorder int)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.has_suite_role('seller','bursar') then raise exception 'not authorized'; end if;
  if p_id is null then
    insert into public.canteen_products (tenant_id, name, category, price, stock, reorder)
    values ((select id from public.institutions order by created_at limit 1), trim(p_name), nullif(trim(p_category),''), coalesce(p_price,0), coalesce(p_stock,0), coalesce(p_reorder,0))
    on conflict (name) do update set category = excluded.category, price = excluded.price, stock = excluded.stock, reorder = excluded.reorder
    returning id into v_id;
  else
    update public.canteen_products set name = trim(p_name), category = nullif(trim(p_category),''),
      price = coalesce(p_price,0), stock = coalesce(p_stock,0), reorder = coalesce(p_reorder,0) where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.canteen_product_delete(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_suite_role('seller','bursar') then raise exception 'not authorized'; end if;
  delete from public.canteen_products where id = p_id;
end $$;

create or replace function public.canteen_inventory_adjust(p_id uuid, p_delta int)
returns int language plpgsql security definer set search_path = public as $$
declare v_stock int;
begin
  if not public.has_suite_role('seller','bursar') then raise exception 'not authorized'; end if;
  update public.canteen_products set stock = greatest(0, stock + coalesce(p_delta,0)) where id = p_id returning stock into v_stock;
  return v_stock;
end $$;

create or replace function public.canteen_till_open(p_float numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.has_suite_role('seller','bursar') then raise exception 'not authorized'; end if;
  insert into public.canteen_till_sessions (tenant_id, opened_by, float_amt)
  values ((select id from public.institutions order by created_at limit 1), auth.uid(), coalesce(p_float,0)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.canteen_till_close(p_id uuid, p_counted numeric)
returns void language plpgsql security definer set search_path = public as $$
declare v_open timestamptz; v_expected numeric;
begin
  if not public.has_suite_role('seller','bursar') then raise exception 'not authorized'; end if;
  select opened_at into v_open from public.canteen_till_sessions where id = p_id and status = 'open';
  if v_open is null then raise exception 'session not found or already closed'; end if;
  select coalesce(sum(total),0) into v_expected from public.canteen_sales where created_at >= v_open;
  update public.canteen_till_sessions set closed_at = now(), counted = p_counted,
    expected = v_expected + float_amt, status = 'closed' where id = p_id;
end $$;

create or replace function public.canteen_account_topup(p_student uuid, p_amount numeric)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_bal numeric;
begin
  if not public.has_suite_role('seller','bursar') then raise exception 'not authorized'; end if;
  insert into public.canteen_student_accounts (student_id, balance, updated_at)
  values (p_student, coalesce(p_amount,0), now())
  on conflict (student_id) do update set balance = canteen_student_accounts.balance + coalesce(p_amount,0), updated_at = now()
  returning balance into v_bal;
  return v_bal;
end $$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'canteen_till_list()','canteen_accounts_list()',
    'canteen_product_upsert(uuid,text,text,numeric,int,int)','canteen_product_delete(uuid)',
    'canteen_inventory_adjust(uuid,int)','canteen_till_open(numeric)','canteen_till_close(uuid,numeric)',
    'canteen_account_topup(uuid,numeric)'
  ] loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;

notify pgrst, 'reload schema';
