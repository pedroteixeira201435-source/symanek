-- Course capacity management from the Suite (admin/registrar), audited + safe.
-- Touches ONLY capacity so it can never wipe programme/lecturer (unlike course_upsert).

create or replace function public.course_set_capacity(p_id uuid, p_capacity int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_suite_role('registrar') then raise exception 'not authorized'; end if;
  update public.courses
    set capacity = greatest(coalesce(p_capacity, 0), 0), updated_at = now()
    where id = p_id;
  if not found then raise exception 'course not found'; end if;
end; $$;

grant execute on function public.course_set_capacity(uuid, int) to authenticated;

notify pgrst, 'reload schema';
