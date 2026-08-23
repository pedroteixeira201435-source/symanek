-- ============================================================================
-- Symanek — security fix (caught by http-path E2E validation): several
-- read RPCs were granted to `authenticated` with no guard, so any signed-in
-- user (incl. students) could read finance/loan data. Add an is_admin() gate
-- to the staff-only reads. (exam_schedule / library_catalogue / timetable stay
-- open — they are legitimately student-facing catalogue/timetable data.)
-- ============================================================================

create or replace function public.gl_journal_list()
returns table (entry_date date, description text, account text, dr numeric, cr numeric, vat text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
    select j.entry_date, j.description, a.name, l.debit, l.credit, l.vat
    from public.gl_journal j
    join public.gl_lines l on l.journal_id = j.id
    join public.gl_accounts a on a.id = l.account_id
    order by j.entry_date, j.created_at, l.debit desc;
end $$;

create or replace function public.gl_trial_balance()
returns table (account text, type text, debit numeric, credit numeric, balance numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
    select a.name, a.type,
           coalesce(sum(l.debit),0), coalesce(sum(l.credit),0),
           case when a.normal_side = 'D' then coalesce(sum(l.debit),0) - coalesce(sum(l.credit),0)
                                         else coalesce(sum(l.credit),0) - coalesce(sum(l.debit),0) end
    from public.gl_accounts a
    left join public.gl_lines l on l.account_id = a.id
    group by a.name, a.type, a.normal_side
    order by a.type, a.name;
end $$;

create or replace function public.canteen_summary()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return (select json_build_object(
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
  ));
end $$;

create or replace function public.library_loans_active()
returns table (id uuid, book text, borrower text, issued date, due date, status text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
    select l.id, b.title, l.borrower_name, l.issued_at, l.due_at,
           case when l.due_at <  current_date     then 'Overdue'
                when l.due_at <= current_date + 3  then 'Due Soon'
                else 'On Loan' end
    from public.library_loans l join public.library_books b on b.id = l.book_id
    where l.status = 'on_loan' order by l.due_at;
end $$;

notify pgrst, 'reload schema';
