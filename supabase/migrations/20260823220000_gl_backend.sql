-- ============================================================================
-- Symanek — Phase C: general-ledger backend (Accounting module core).
--
-- Standard double-entry: chart of accounts + journal entries + balanced lines.
-- RPCs to list the journal, post a balanced entry (rejects if debits<>credits),
-- and a trial balance. Writes gated to the bursar workspace; staff read.
-- The NamRA tax calendar and asset register stay demo (regulatory / separate).
-- ============================================================================

create table if not exists public.gl_accounts (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid references public.institutions(id),
  name        text not null unique,
  type        text not null check (type in ('Asset','Liability','Equity','Income','Expense')),
  normal_side char(1) not null check (normal_side in ('D','C')),
  created_at  timestamptz not null default now()
);

create table if not exists public.gl_journal (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid references public.institutions(id),
  entry_date  date not null default current_date,
  description text not null,
  ref         text,
  posted_by   uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create table if not exists public.gl_lines (
  id          uuid primary key default gen_random_uuid(),
  journal_id  uuid not null references public.gl_journal(id) on delete cascade,
  account_id  uuid not null references public.gl_accounts(id),
  debit       numeric(14,2) not null default 0 check (debit  >= 0),
  credit      numeric(14,2) not null default 0 check (credit >= 0),
  vat         text
);
create index if not exists gl_lines_journal_idx on public.gl_lines (journal_id);
create index if not exists gl_lines_account_idx on public.gl_lines (account_id);

-- ---------- RPCs ----------
-- Flat journal in the shape the Accounting UI expects: {date, desc, acc, dr, cr, vat}.
create or replace function public.gl_journal_list()
returns table (entry_date date, description text, account text, dr numeric, cr numeric, vat text)
language sql stable security definer set search_path = public as $$
  select j.entry_date, j.description, a.name, l.debit, l.credit, l.vat
  from public.gl_journal j
  join public.gl_lines l on l.journal_id = j.id
  join public.gl_accounts a on a.id = l.account_id
  order by j.entry_date, j.created_at, l.debit desc;
$$;

create or replace function public.gl_trial_balance()
returns table (account text, type text, debit numeric, credit numeric, balance numeric)
language sql stable security definer set search_path = public as $$
  select a.name, a.type,
         coalesce(sum(l.debit),0), coalesce(sum(l.credit),0),
         case when a.normal_side = 'D' then coalesce(sum(l.debit),0) - coalesce(sum(l.credit),0)
                                       else coalesce(sum(l.credit),0) - coalesce(sum(l.debit),0) end
  from public.gl_accounts a
  left join public.gl_lines l on l.account_id = a.id
  group by a.name, a.type, a.normal_side
  order by a.type, a.name;
$$;

-- Post a balanced entry. p_lines = [{ "acc": "<account name>", "dr": n, "cr": n, "vat": "..." }, ...]
create or replace function public.gl_post(p_date date, p_desc text, p_lines jsonb, p_ref text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_dr numeric := 0; v_cr numeric := 0; ln jsonb; v_acc uuid;
begin
  if not public.has_suite_role('bursar') then raise exception 'not authorized'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 2 then
    raise exception 'an entry needs at least two lines';
  end if;
  for ln in select * from jsonb_array_elements(p_lines) loop
    v_dr := v_dr + coalesce((ln->>'dr')::numeric, 0);
    v_cr := v_cr + coalesce((ln->>'cr')::numeric, 0);
  end loop;
  if round(v_dr,2) <> round(v_cr,2) then
    raise exception 'unbalanced entry: debits % <> credits %', v_dr, v_cr;
  end if;

  insert into public.gl_journal (tenant_id, entry_date, description, ref, posted_by)
  values ((select id from public.institutions where name='Symanek Specialized College'),
          p_date, trim(p_desc), nullif(trim(coalesce(p_ref,'')),''), auth.uid())
  returning id into v_id;

  for ln in select * from jsonb_array_elements(p_lines) loop
    select id into v_acc from public.gl_accounts where name = ln->>'acc';
    if v_acc is null then raise exception 'unknown account %', ln->>'acc'; end if;
    insert into public.gl_lines (journal_id, account_id, debit, credit, vat)
    values (v_id, v_acc, coalesce((ln->>'dr')::numeric,0), coalesce((ln->>'cr')::numeric,0), ln->>'vat');
  end loop;
  return v_id;
end $$;

revoke all on function public.gl_journal_list()  from public;
revoke all on function public.gl_trial_balance() from public;
revoke all on function public.gl_post(date,text,jsonb,text) from public;
grant execute on function public.gl_journal_list()  to authenticated;
grant execute on function public.gl_trial_balance() to authenticated;
grant execute on function public.gl_post(date,text,jsonb,text) to authenticated;

-- ---------- RLS ----------
alter table public.gl_accounts enable row level security;
alter table public.gl_journal  enable row level security;
alter table public.gl_lines    enable row level security;
do $$
declare t text;
begin
  foreach t in array array['gl_accounts','gl_journal','gl_lines'] loop
    execute format('drop policy if exists %I on public.%I', t||' read', t);
    execute format('drop policy if exists %I on public.%I', t||' write', t);
    execute format('create policy %I on public.%I for select using (public.is_admin())', t||' read', t);
    execute format('create policy %I on public.%I for all using (public.has_suite_role(''bursar'')) with check (public.has_suite_role(''bursar''))', t||' write', t);
  end loop;
end $$;

-- ---------- seed: chart of accounts + two balanced entries ----------
insert into public.gl_accounts (tenant_id, name, type, normal_side)
select (select id from public.institutions where name='Symanek Specialized College'), v.name, v.type, v.side
from (values
  ('Cash & Cash Equivalents','Asset','D'),
  ('Student Debtors (AR)','Asset','D'),
  ('Property, Plant & Equipment','Asset','D'),
  ('Accumulated Depreciation','Asset','C'),
  ('VAT Payable','Liability','C'),
  ('Income Tax Payable','Liability','C'),
  ('Share Capital','Equity','C'),
  ('Tuition Revenue (VAT-exempt)','Income','C'),
  ('Salaries & Wages','Expense','D')
) as v(name,type,side)
where not exists (select 1 from public.gl_accounts a where a.name = v.name);

do $$
declare v_j uuid;
begin
  if not exists (select 1 from public.gl_journal) then
    insert into public.gl_journal (tenant_id, entry_date, description, ref)
    values ((select id from public.institutions where name='Symanek Specialized College'),
            date '2026-01-15','Term 1 tuition invoiced (VAT-exempt supply)','INV-T1')
    returning id into v_j;
    insert into public.gl_lines (journal_id, account_id, debit, credit, vat) values
      (v_j,(select id from public.gl_accounts where name='Student Debtors (AR)'),1540000,0,'Exempt'),
      (v_j,(select id from public.gl_accounts where name='Tuition Revenue (VAT-exempt)'),0,1540000,'Exempt');
    insert into public.gl_journal (tenant_id, entry_date, description, ref)
    values ((select id from public.institutions where name='Symanek Specialized College'),
            date '2026-02-28','Tuition receipts — guardians & debit orders','RCT-FEB')
    returning id into v_j;
    insert into public.gl_lines (journal_id, account_id, debit, credit, vat) values
      (v_j,(select id from public.gl_accounts where name='Cash & Cash Equivalents'),1286000,0,'—'),
      (v_j,(select id from public.gl_accounts where name='Student Debtors (AR)'),0,1286000,'—');
  end if;
end $$;

notify pgrst, 'reload schema';
