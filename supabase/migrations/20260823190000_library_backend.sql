-- ============================================================================
-- Symanek — Phase C: Library backend (catalogue + loans + fines).
--
-- First real backend for a mock-only module. Schema + SECURITY DEFINER RPCs
-- (writes gated to the librarian workspace) + RLS + a seed of the catalogue.
-- Availability is derived (total_copies − active loans). Overdue returns create
-- a fine at N$2/day, matching the existing UI rule.
-- ============================================================================

create table if not exists public.library_books (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid references public.institutions(id),
  isbn         text unique,
  title        text not null,
  author       text,
  category     text,
  total_copies int  not null default 1 check (total_copies >= 0),
  created_at   timestamptz not null default now()
);

create table if not exists public.library_loans (
  id                  uuid primary key default gen_random_uuid(),
  book_id             uuid not null references public.library_books(id) on delete cascade,
  borrower_name       text not null,
  borrower_student_id uuid references public.students(id) on delete set null,
  issued_at           date not null default current_date,
  due_at              date not null,
  returned_at         date,
  status              text not null default 'on_loan' check (status in ('on_loan','returned')),
  created_at          timestamptz not null default now()
);
create index if not exists library_loans_active_idx on public.library_loans (book_id) where status = 'on_loan';

create table if not exists public.library_fines (
  id            uuid primary key default gen_random_uuid(),
  loan_id       uuid references public.library_loans(id) on delete set null,
  borrower_name text not null,
  book_title    text,
  days          int not null,
  amount        numeric(10,2) not null,
  paid          boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ---------- RPCs ----------
create or replace function public.library_catalogue()
returns table (id uuid, isbn text, title text, author text, category text, total int, avail int)
language sql stable security definer set search_path = public as $$
  select b.id, b.isbn, b.title, b.author, b.category, b.total_copies,
         b.total_copies - (select count(*)::int from public.library_loans l
                            where l.book_id = b.id and l.status = 'on_loan')
  from public.library_books b order by b.title;
$$;

create or replace function public.library_loans_active()
returns table (id uuid, book text, borrower text, issued date, due date, status text)
language sql stable security definer set search_path = public as $$
  select l.id, b.title, l.borrower_name, l.issued_at, l.due_at,
         case when l.due_at <  current_date     then 'Overdue'
              when l.due_at <= current_date + 3  then 'Due Soon'
              else 'On Loan' end
  from public.library_loans l join public.library_books b on b.id = l.book_id
  where l.status = 'on_loan' order by l.due_at;
$$;

create or replace function public.library_issue(p_isbn text, p_borrower text, p_days int default 14)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_book uuid; v_avail int; v_loan uuid;
begin
  if not public.has_suite_role('librarian') then raise exception 'not authorized'; end if;
  select id into v_book from public.library_books where isbn = p_isbn;
  if v_book is null then raise exception 'unknown book %', p_isbn; end if;
  select total_copies - (select count(*) from public.library_loans where book_id = v_book and status = 'on_loan')
    into v_avail from public.library_books where id = v_book;
  if v_avail <= 0 then raise exception 'no copies available'; end if;
  insert into public.library_loans (book_id, borrower_name, due_at)
    values (v_book, trim(p_borrower), current_date + coalesce(p_days,14))
    returning id into v_loan;
  return v_loan;
end $$;

create or replace function public.library_return(p_loan uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_loan public.library_loans; v_days int; v_title text; v_fine numeric;
begin
  if not public.has_suite_role('librarian') then raise exception 'not authorized'; end if;
  select * into v_loan from public.library_loans where id = p_loan and status = 'on_loan';
  if v_loan.id is null then raise exception 'loan not found or already returned'; end if;
  update public.library_loans set status = 'returned', returned_at = current_date where id = p_loan;
  select title into v_title from public.library_books where id = v_loan.book_id;
  v_days := greatest(0, current_date - v_loan.due_at);
  if v_days > 0 then
    v_fine := v_days * 2;
    insert into public.library_fines (loan_id, borrower_name, book_title, days, amount)
      values (p_loan, v_loan.borrower_name, v_title, v_days, v_fine);
  end if;
  return json_build_object('ok', true, 'overdue_days', v_days, 'fine', coalesce(v_fine, 0));
end $$;

create or replace function public.library_renew(p_loan uuid, p_days int default 14)
returns date language plpgsql security definer set search_path = public as $$
declare v_due date;
begin
  if not public.has_suite_role('librarian') then raise exception 'not authorized'; end if;
  update public.library_loans set due_at = greatest(due_at, current_date) + coalesce(p_days,14)
    where id = p_loan and status = 'on_loan' returning due_at into v_due;
  if v_due is null then raise exception 'loan not found'; end if;
  return v_due;
end $$;

revoke all on function public.library_catalogue()    from public;
revoke all on function public.library_loans_active()  from public;
revoke all on function public.library_issue(text,text,int)  from public;
revoke all on function public.library_return(uuid)    from public;
revoke all on function public.library_renew(uuid,int) from public;
grant execute on function public.library_catalogue()    to authenticated;
grant execute on function public.library_loans_active()  to authenticated;
grant execute on function public.library_issue(text,text,int)  to authenticated;
grant execute on function public.library_return(uuid)    to authenticated;
grant execute on function public.library_renew(uuid,int) to authenticated;

-- ---------- RLS (defense in depth; app access is via the RPCs) ----------
alter table public.library_books enable row level security;
alter table public.library_loans enable row level security;
alter table public.library_fines enable row level security;

drop policy if exists "library_books read"  on public.library_books;
drop policy if exists "library_books write" on public.library_books;
create policy "library_books read"  on public.library_books for select using (public.is_admin());
create policy "library_books write" on public.library_books for all
  using (public.has_suite_role('librarian')) with check (public.has_suite_role('librarian'));

drop policy if exists "library_loans read"  on public.library_loans;
drop policy if exists "library_loans write" on public.library_loans;
drop policy if exists "library_loans owner read" on public.library_loans;
create policy "library_loans read"  on public.library_loans for select using (public.is_admin());
create policy "library_loans owner read" on public.library_loans for select
  using (exists (select 1 from public.students s where s.id = library_loans.borrower_student_id and s.user_id = auth.uid()));
create policy "library_loans write" on public.library_loans for all
  using (public.has_suite_role('librarian')) with check (public.has_suite_role('librarian'));

drop policy if exists "library_fines read"  on public.library_fines;
drop policy if exists "library_fines write" on public.library_fines;
create policy "library_fines read"  on public.library_fines for select using (public.is_admin());
create policy "library_fines write" on public.library_fines for all
  using (public.has_suite_role('librarian')) with check (public.has_suite_role('librarian'));

-- ---------- seed catalogue (idempotent by isbn) ----------
insert into public.library_books (tenant_id, isbn, title, author, category, total_copies)
select (select id from public.institutions where name = 'Symanek Specialized College'),
       v.isbn, v.title, v.author, v.cat, v.total
from (values
  ('978-99916-42-18-3','Physical Science Grade 12','M. van Wyk','Textbook',40),
  ('978-99916-51-02-4','Accounting Grade 12','P. Basson','Textbook',30),
  ('978-99916-38-77-1','Mathematics Grade 10','J. Amakali','Textbook',45),
  ('978-0-435905-25-5','Things Fall Apart','Chinua Achebe','Literature',15),
  ('978-0-435910-08-2','The Purple Violet of Oshaantu','Neshani Andreas','Literature',12),
  ('978-0-19-274941-9','Oxford English Dictionary (School)','Oxford Press','Reference',10),
  ('978-99916-70-11-2','A History of Namibia','M. Wallace','Reference',8)
) as v(isbn,title,author,cat,total)
where not exists (select 1 from public.library_books b where b.isbn = v.isbn);

notify pgrst, 'reload schema';
