-- ============================================================================
-- Symanek — Library: finish the backend so the module is fully live & empty-by-
-- default. Adds reservations, fines listing, and CRUD write RPCs (books, fines,
-- reservations) so the librarian populates the catalogue themselves. Also purges
-- the demo catalogue seeded by 20260823190000 (school-era placeholder textbooks)
-- so production starts with ZERO mock books. Writes gated to the librarian.
-- Idempotent.
-- ============================================================================

-- ---- purge the demo catalogue (cascades demo loans; fines.loan_id set null) ----
delete from public.library_books where isbn in (
  '978-99916-42-18-3','978-99916-51-02-4','978-99916-38-77-1','978-0-435905-25-5',
  '978-0-435910-08-2','978-0-19-274941-9','978-99916-70-11-2'
);

-- ---- reservations (hold queue for titles with no available copy) ----
create table if not exists public.library_reservations (
  id                   uuid primary key default gen_random_uuid(),
  book_id              uuid not null references public.library_books(id) on delete cascade,
  requester_name       text not null,
  requester_student_id uuid references public.students(id) on delete set null,
  placed_at            date not null default current_date,
  status               text not null default 'waiting'
                       check (status in ('waiting','notified','fulfilled','cancelled')),
  created_at           timestamptz not null default now()
);

alter table public.library_reservations enable row level security;
drop policy if exists "library_reservations read"  on public.library_reservations;
drop policy if exists "library_reservations write" on public.library_reservations;
create policy "library_reservations read"  on public.library_reservations for select using (public.is_admin());
create policy "library_reservations write" on public.library_reservations for all
  using (public.has_suite_role('librarian')) with check (public.has_suite_role('librarian'));

-- ---- reads ----
create or replace function public.library_fines_list()
returns table (id uuid, borrower text, book text, days int, amount numeric, paid boolean)
language sql stable security definer set search_path = public as $$
  select f.id, f.borrower_name, f.book_title, f.days, f.amount, f.paid
  from public.library_fines f order by f.paid, f.created_at desc;
$$;

create or replace function public.library_reservations_list()
returns table (id uuid, title text, requester text, placed date, pos int, avail int, status text)
language sql stable security definer set search_path = public as $$
  select r.id, b.title, r.requester_name, r.placed_at,
         row_number() over (partition by r.book_id order by r.created_at)::int as pos,
         (b.total_copies - (select count(*)::int from public.library_loans l
                             where l.book_id = b.id and l.status = 'on_loan')) as avail,
         r.status
  from public.library_reservations r
  join public.library_books b on b.id = r.book_id
  where r.status in ('waiting','notified')
  order by b.title, r.created_at;
$$;

-- ---- writes (librarian) ----
create or replace function public.library_book_upsert(
  p_isbn text, p_title text, p_author text, p_category text, p_total int)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.has_suite_role('librarian') then raise exception 'not authorized'; end if;
  if coalesce(trim(p_title),'') = '' then raise exception 'title required'; end if;
  insert into public.library_books (tenant_id, isbn, title, author, category, total_copies)
  values ((select id from public.institutions order by created_at limit 1),
          nullif(trim(p_isbn),''), trim(p_title), nullif(trim(p_author),''),
          nullif(trim(p_category),''), greatest(0, coalesce(p_total,1)))
  on conflict (isbn) do update set
    title = excluded.title, author = excluded.author,
    category = excluded.category, total_copies = excluded.total_copies
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.library_book_delete(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_suite_role('librarian') then raise exception 'not authorized'; end if;
  if exists (select 1 from public.library_loans where book_id = p_id and status = 'on_loan') then
    raise exception 'cannot delete: copies are on loan';
  end if;
  delete from public.library_books where id = p_id;
end $$;

create or replace function public.library_fine_settle(p_id uuid, p_waive boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_suite_role('librarian') then raise exception 'not authorized'; end if;
  if p_waive then delete from public.library_fines where id = p_id;
  else update public.library_fines set paid = true where id = p_id;
  end if;
end $$;

create or replace function public.library_reservation_add(
  p_isbn text, p_requester text, p_student uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_book uuid; v_id uuid;
begin
  if not public.has_suite_role('librarian') then raise exception 'not authorized'; end if;
  select id into v_book from public.library_books where isbn = p_isbn;
  if v_book is null then raise exception 'unknown book %', p_isbn; end if;
  insert into public.library_reservations (book_id, requester_name, requester_student_id)
    values (v_book, trim(p_requester), p_student) returning id into v_id;
  return v_id;
end $$;

create or replace function public.library_reservation_update(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_suite_role('librarian') then raise exception 'not authorized'; end if;
  if p_status not in ('waiting','notified','fulfilled','cancelled') then
    raise exception 'bad status %', p_status; end if;
  update public.library_reservations set status = p_status where id = p_id;
end $$;

revoke all on function public.library_fines_list()               from public;
revoke all on function public.library_reservations_list()        from public;
revoke all on function public.library_book_upsert(text,text,text,text,int) from public;
revoke all on function public.library_book_delete(uuid)          from public;
revoke all on function public.library_fine_settle(uuid,boolean)  from public;
revoke all on function public.library_reservation_add(text,text,uuid) from public;
revoke all on function public.library_reservation_update(uuid,text)   from public;
grant execute on function public.library_fines_list()               to authenticated;
grant execute on function public.library_reservations_list()        to authenticated;
grant execute on function public.library_book_upsert(text,text,text,text,int) to authenticated;
grant execute on function public.library_book_delete(uuid)          to authenticated;
grant execute on function public.library_fine_settle(uuid,boolean)  to authenticated;
grant execute on function public.library_reservation_add(text,text,uuid) to authenticated;
grant execute on function public.library_reservation_update(uuid,text)   to authenticated;

notify pgrst, 'reload schema';
