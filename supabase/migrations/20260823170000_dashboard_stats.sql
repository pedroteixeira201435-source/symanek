-- ============================================================================
-- Symanek — Phase B (B4): real dashboard aggregates.
--
-- The Suite dashboard KPIs were hard-coded demo numbers (e.g. a fabricated
-- "476 enrolled", "N$ 1.42M"). This RPC returns the real figures so the Suite
-- can show truthful headline numbers in http mode (the UI keeps a mock fallback
-- for demo mode and for the modules that still have no backend, e.g. canteen).
-- ============================================================================

create or replace function public.dashboard_stats()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return (select json_build_object(
    'enrolled_students',  (select count(*) from public.students where status = 'enrolled'),
    'total_students',     (select count(*) from public.students),
    'staff_count',        (select count(*) from public.staff),
    'programmes_count',   (select count(*) from public.programmes where active),
    'fees_collected',     (select coalesce(sum(amount), 0) from public.payments),
    'applications_pending',
        (select count(*) from public.applications where stage in ('submitted','under_review')),
    'applications_approved',
        (select count(*) from public.applications where stage in ('approved','paid')),
    'pending_proofs',     (select count(*) from public.applications
                            where proof_path is not null and stage <> 'enrolled'),
    'enrolment_by_programme',
        coalesce((select json_agg(row_to_json(t)) from (
            select p.name, count(s.id)::int as count
            from public.programmes p
            join public.students s on s.programme_id = p.id
            group by p.name
            order by count(s.id) desc
            limit 8
        ) t), '[]'::json)
  ));
end $$;

-- Dashboard is staff-facing; gate to admin/staff (is_admin covers both).
revoke all on function public.dashboard_stats() from public;
grant execute on function public.dashboard_stats() to authenticated;

notify pgrst, 'reload schema';
