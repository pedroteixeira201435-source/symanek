-- ============================================================================
-- Symanek — Finance backend: fee structures, budgets, expenses + CRUD and real
-- aggregate RPCs (stats, debtors, expense breakdown) so the bursar workspace is
-- fully live and empty by default. Invoices/payments/sponsors already exist.
-- Writes gated to `bursar`. Idempotent.
-- ============================================================================

create table if not exists public.fee_structures (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid references public.institutions(id),
  programme_id uuid references public.programmes(id) on delete cascade,
  year         int not null default 1,
  tuition      numeric(12,2) not null default 0,
  other        numeric(12,2) not null default 0,
  created_at   timestamptz not null default now(),
  unique (programme_id, year)
);

create table if not exists public.budgets (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references public.institutions(id),
  category   text not null,
  allocated  numeric(14,2) not null default 0,
  spent      numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (category)
);

create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid references public.institutions(id),
  spent_on    date not null default current_date,
  category    text not null,
  description text,
  amount      numeric(14,2) not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.fee_structures enable row level security;
alter table public.budgets        enable row level security;
alter table public.expenses       enable row level security;
do $$
declare t text;
begin
  foreach t in array array['fee_structures','budgets','expenses'] loop
    execute format('drop policy if exists "%s read" on public.%s', t, t);
    execute format('drop policy if exists "%s write" on public.%s', t, t);
    execute format('create policy "%s read" on public.%s for select using (public.is_admin())', t, t);
    execute format('create policy "%s write" on public.%s for all using (public.has_suite_role(''bursar'')) with check (public.has_suite_role(''bursar''))', t, t);
  end loop;
end $$;

-- ---- reads / aggregates ----
create or replace function public.finance_stats()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'invoiced',    (select coalesce(sum(amount),0)  from public.invoices),
    'collected',   (select coalesce(sum(amount),0)  from public.invoice_payments)
                 + (select coalesce(sum(amount),0)  from public.payments),
    'outstanding', (select coalesce(sum(balance),0) from public.invoices),
    'debtors',     (select count(distinct student_id) from public.invoices where balance > 0),
    'expenses',    (select coalesce(sum(amount),0)  from public.expenses)
  );
$$;

create or replace function public.finance_debtors_list()
returns table (student text, programme text, outstanding numeric, invoices int)
language sql stable security definer set search_path = public as $$
  select s.full_name, p.name, sum(i.balance), count(*)::int
  from public.invoices i
  join public.students s on s.id = i.student_id
  left join public.programmes p on p.id = s.programme_id
  where i.balance > 0
  group by s.full_name, p.name order by sum(i.balance) desc;
$$;

create or replace function public.finance_collection_by_programme()
returns table (programme text, invoiced numeric, collected numeric, outstanding numeric)
language sql stable security definer set search_path = public as $$
  select coalesce(p.name,'—'), coalesce(sum(i.amount),0),
         coalesce(sum(i.amount - i.balance),0), coalesce(sum(i.balance),0)
  from public.invoices i
  join public.students s on s.id = i.student_id
  left join public.programmes p on p.id = s.programme_id
  group by p.name order by sum(i.amount) desc;
$$;

create or replace function public.finance_expense_breakdown()
returns table (category text, amount numeric)
language sql stable security definer set search_path = public as $$
  select category, sum(amount) from public.expenses group by category order by sum(amount) desc;
$$;

create or replace function public.invoices_list()
returns table (id uuid, student text, amount numeric, balance numeric, due date, status text)
language sql stable security definer set search_path = public as $$
  select i.id, s.full_name, i.amount, i.balance, i.due, i.status
  from public.invoices i join public.students s on s.id = i.student_id
  order by i.created_at desc;
$$;
create or replace function public.fee_structures_list()
returns table (id uuid, programme text, programme_id uuid, year int, tuition numeric, other numeric)
language sql stable security definer set search_path = public as $$
  select f.id, p.name, f.programme_id, f.year, f.tuition, f.other
  from public.fee_structures f join public.programmes p on p.id = f.programme_id order by p.name, f.year;
$$;
create or replace function public.budgets_list()
returns table (id uuid, category text, allocated numeric, spent numeric)
language sql stable security definer set search_path = public as $$
  select id, category, allocated, spent from public.budgets order by category;
$$;
create or replace function public.expenses_list()
returns table (id uuid, spent_on date, category text, description text, amount numeric)
language sql stable security definer set search_path = public as $$
  select id, spent_on, category, description, amount from public.expenses order by spent_on desc;
$$;

-- ---- writes (bursar) ----
create or replace function public.invoice_create(p_student uuid, p_amount numeric, p_due date)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_tenant uuid;
begin
  if not public.has_suite_role('bursar') then raise exception 'not authorized'; end if;
  select tenant_id into v_tenant from public.students where id = p_student;
  insert into public.invoices (tenant_id, student_id, amount, balance, due, status)
  values (v_tenant, p_student, p_amount, p_amount, p_due, 'open') returning id into v_id;
  return v_id;
end $$;

create or replace function public.fee_structure_set(p_programme uuid, p_year int, p_tuition numeric, p_other numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_suite_role('bursar') then raise exception 'not authorized'; end if;
  insert into public.fee_structures (tenant_id, programme_id, year, tuition, other)
  values ((select id from public.institutions order by created_at limit 1), p_programme, coalesce(p_year,1), coalesce(p_tuition,0), coalesce(p_other,0))
  on conflict (programme_id, year) do update set tuition = excluded.tuition, other = excluded.other;
end $$;

create or replace function public.budget_set(p_category text, p_allocated numeric, p_spent numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_suite_role('bursar') then raise exception 'not authorized'; end if;
  insert into public.budgets (tenant_id, category, allocated, spent)
  values ((select id from public.institutions order by created_at limit 1), trim(p_category), coalesce(p_allocated,0), coalesce(p_spent,0))
  on conflict (category) do update set allocated = excluded.allocated, spent = excluded.spent;
end $$;

create or replace function public.expense_record(p_date date, p_category text, p_description text, p_amount numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.has_suite_role('bursar') then raise exception 'not authorized'; end if;
  insert into public.expenses (tenant_id, spent_on, category, description, amount)
  values ((select id from public.institutions order by created_at limit 1), coalesce(p_date, current_date), trim(p_category), nullif(trim(p_description),''), coalesce(p_amount,0))
  returning id into v_id;
  update public.budgets set spent = spent + coalesce(p_amount,0) where category = trim(p_category);
  return v_id;
end $$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'finance_stats()','finance_debtors_list()','finance_collection_by_programme()','finance_expense_breakdown()',
    'invoices_list()','fee_structures_list()','budgets_list()','expenses_list()',
    'invoice_create(uuid,numeric,date)','fee_structure_set(uuid,int,numeric,numeric)',
    'budget_set(text,numeric,numeric)','expense_record(date,text,text,numeric)'
  ] loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;

notify pgrst, 'reload schema';
