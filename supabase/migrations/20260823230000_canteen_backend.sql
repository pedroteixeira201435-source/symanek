-- ============================================================================
-- Symanek — Phase C: canteen backend (POS + CanteenAdmin).
--
-- canteen_products (catalogue/inventory) + canteen_sales/_lines (transactions).
-- RPCs: record a sale (seller), today's summary, product list. Sale lines are
-- denormalized by product name so the till can post regardless of its catalogue
-- source. Writes gated to the seller workspace; staff read.
-- ============================================================================

create table if not exists public.canteen_products (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references public.institutions(id),
  name       text not null unique,
  category   text,
  price      numeric(10,2) not null default 0,
  stock      int not null default 0,
  reorder    int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.canteen_sales (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid references public.institutions(id),
  total       numeric(10,2) not null,
  pay_method  text not null default 'Cash',
  cashier     uuid references auth.users(id),
  created_at  timestamptz not null default now()
);
create index if not exists canteen_sales_day_idx on public.canteen_sales (created_at);

create table if not exists public.canteen_sale_lines (
  id           uuid primary key default gen_random_uuid(),
  sale_id      uuid not null references public.canteen_sales(id) on delete cascade,
  product_name text not null,
  qty          int not null check (qty > 0),
  unit_price   numeric(10,2) not null
);

-- ---------- RPCs ----------
create or replace function public.canteen_record_sale(p_total numeric, p_pay text, p_lines jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; ln jsonb;
begin
  if not public.has_suite_role('seller') then raise exception 'not authorized'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 1 then
    raise exception 'a sale needs at least one line';
  end if;
  insert into public.canteen_sales (tenant_id, total, pay_method, cashier)
  values ((select id from public.institutions where name='Symanek Specialized College'),
          p_total, coalesce(nullif(trim(p_pay),''),'Cash'), auth.uid())
  returning id into v_id;
  for ln in select * from jsonb_array_elements(p_lines) loop
    insert into public.canteen_sale_lines (sale_id, product_name, qty, unit_price)
    values (v_id, ln->>'name', coalesce((ln->>'qty')::int,1), coalesce((ln->>'price')::numeric,0));
    update public.canteen_products
      set stock = greatest(0, stock - coalesce((ln->>'qty')::int,1))
      where name = ln->>'name';
  end loop;
  return v_id;
end $$;

create or replace function public.canteen_summary()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'sales_today',  coalesce((select sum(total) from public.canteen_sales where created_at::date = current_date),0),
    'transactions', (select count(*) from public.canteen_sales where created_at::date = current_date),
    'avg_basket',   coalesce((select round(avg(total),2) from public.canteen_sales where created_at::date = current_date),0),
    'top_sellers',  coalesce((select json_agg(row_to_json(t)) from (
                        select l.product_name as item, sum(l.qty)::int as units,
                               sum(l.qty * l.unit_price) as revenue
                        from public.canteen_sale_lines l
                        join public.canteen_sales s on s.id = l.sale_id
                        where s.created_at::date = current_date
                        group by l.product_name order by sum(l.qty * l.unit_price) desc limit 5
                      ) t), '[]'::json)
  );
$$;

create or replace function public.canteen_products_list()
returns table (name text, category text, price numeric, stock int, reorder int)
language sql stable security definer set search_path = public as $$
  select name, category, price, stock, reorder from public.canteen_products order by category, name;
$$;

revoke all on function public.canteen_record_sale(numeric,text,jsonb) from public;
revoke all on function public.canteen_summary() from public;
revoke all on function public.canteen_products_list() from public;
grant execute on function public.canteen_record_sale(numeric,text,jsonb) to authenticated;
grant execute on function public.canteen_summary() to authenticated;
grant execute on function public.canteen_products_list() to authenticated;

-- ---------- RLS ----------
alter table public.canteen_products   enable row level security;
alter table public.canteen_sales      enable row level security;
alter table public.canteen_sale_lines enable row level security;
do $$
declare t text;
begin
  foreach t in array array['canteen_products','canteen_sales','canteen_sale_lines'] loop
    execute format('drop policy if exists %I on public.%I', t||' read', t);
    execute format('drop policy if exists %I on public.%I', t||' write', t);
    execute format('create policy %I on public.%I for select using (public.is_admin())', t||' read', t);
    execute format('create policy %I on public.%I for all using (public.has_suite_role(''seller'')) with check (public.has_suite_role(''seller''))', t||' write', t);
  end loop;
end $$;

-- ---------- seed products ----------
insert into public.canteen_products (tenant_id, name, category, price, stock, reorder)
select (select id from public.institutions where name='Symanek Specialized College'), v.name, v.cat, v.price, v.stock, v.reorder
from (values
  ('Beef Kapana Roll','Meals',22,38,15),
  ('Chicken & Chips','Meals',35,24,10),
  ('Vetkoek + Mince','Meals',18,41,15),
  ('Coca-Cola 300ml','Drinks',14,60,20),
  ('Water 500ml','Drinks',10,80,25),
  ('Fat Cakes (2)','Snacks',8,50,20)
) as v(name,cat,price,stock,reorder)
where not exists (select 1 from public.canteen_products p where p.name = v.name);

notify pgrst, 'reload schema';
