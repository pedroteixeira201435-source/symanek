-- Registrar can create / edit / delete examination sittings (date, venue,
-- seats, invigilator). exam_schedule() also returns the ids the editor needs.

drop function if exists public.exam_schedule();
create function public.exam_schedule()
returns table (
  id uuid, course_id uuid, code text, title text, at timestamptz, venue text,
  seats int, sat int, invigilator text, invigilator_id uuid
) language sql stable security definer set search_path = public as $$
  select
    es.id, es.course_id, c.code, c.title, es.at, es.venue, es.seats,
    (select count(*)::int from public.enrolments e
       where e.course_id = es.course_id and e.status <> 'dropped') as sat,
    coalesce(st.name, '') as invigilator, es.invigilator_staff_id
  from public.exam_sittings es
  join public.courses c on c.id = es.course_id
  left join public.staff st on st.id = es.invigilator_staff_id
  order by es.at;
$$;
revoke all on function public.exam_schedule() from public;
grant execute on function public.exam_schedule() to authenticated;

create or replace function public.exam_sitting_upsert(
  p_id uuid, p_course uuid, p_at timestamptz, p_venue text, p_seats int, p_invigilator uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.has_suite_role('registrar') then raise exception 'not authorized'; end if;
  if p_course is null then raise exception 'course required'; end if;
  if p_id is null then
    insert into public.exam_sittings (course_id, at, venue, seats, invigilator_staff_id)
    values (p_course, p_at, nullif(trim(p_venue),''), coalesce(p_seats,0), p_invigilator) returning id into v_id;
  else
    update public.exam_sittings set course_id = p_course, at = p_at, venue = nullif(trim(p_venue),''),
      seats = coalesce(p_seats,0), invigilator_staff_id = p_invigilator
    where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;
revoke all on function public.exam_sitting_upsert(uuid, uuid, timestamptz, text, int, uuid) from public;
grant execute on function public.exam_sitting_upsert(uuid, uuid, timestamptz, text, int, uuid) to authenticated;

create or replace function public.exam_sitting_delete(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_suite_role('registrar') then raise exception 'not authorized'; end if;
  delete from public.exam_sittings where id = p_id;
end $$;
revoke all on function public.exam_sitting_delete(uuid) from public;
grant execute on function public.exam_sitting_delete(uuid) to authenticated;

notify pgrst, 'reload schema';
