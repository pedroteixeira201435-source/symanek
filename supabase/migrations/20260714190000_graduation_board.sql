-- ============================================================================
-- Symanek Suite — graduation board (Phase 2 / B4)
-- One call returns every student with derived clearance (for the Registrar's
-- Graduation screen). Admin/registrar only.
-- ============================================================================

create or replace function public.graduation_board()
returns table (
  student_id uuid, student text, programme text, gpa numeric,
  finance boolean, library boolean, academic boolean, cleared boolean, has_certificate boolean
) language sql stable security definer set search_path = public as $$
  select
    s.id,
    s.full_name,
    upper(coalesce(p.slug, '')),
    public.student_gpa(s.id),
    coalesce((select sum(balance) from public.invoices i where i.student_id = s.id), 0) <= 0,
    not exists (select 1 from public.holds h where h.student_id = s.id and h.active and h.type = 'library'),
    public.student_gpa(s.id) >= 2,
    (coalesce((select sum(balance) from public.invoices i where i.student_id = s.id), 0) <= 0
      and not exists (select 1 from public.holds h where h.student_id = s.id and h.active and h.type = 'library')
      and public.student_gpa(s.id) >= 2),
    exists (select 1 from public.certificates c where c.student_id = s.id)
  from public.students s
  left join public.programmes p on p.id = s.programme_id
  where public.is_admin()
  order by s.full_name;
$$;
grant execute on function public.graduation_board() to authenticated;
