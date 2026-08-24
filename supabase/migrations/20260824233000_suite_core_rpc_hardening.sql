-- Production hardening: move sensitive Suite writes behind audited RPCs.
-- These functions intentionally enforce role checks even when called by a
-- signed-in user whose table-level RLS would otherwise allow direct writes.

set check_function_bodies = off;

create or replace function public.reject_application(p_app uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stage text;
begin
  if not public.has_suite_role('registrar') then
    raise exception 'forbidden';
  end if;

  select stage into v_stage
  from public.applications
  where id = p_app
  for update;

  if v_stage is null then
    raise exception 'application not found';
  end if;

  if v_stage = 'enrolled' then
    raise exception 'enrolled applications cannot be rejected';
  end if;

  update public.applications
  set
    stage = 'rejected',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    message = case
      when nullif(trim(coalesce(p_reason, '')), '') is null then message
      when nullif(trim(coalesce(message, '')), '') is null then trim(p_reason)
      else message || E'\n\nRejection reason: ' || trim(p_reason)
    end
  where id = p_app;
end;
$$;

create or replace function public.student_upsert(
  p_id uuid default null,
  p_student_no text default null,
  p_reference text default null,
  p_full_name text default null,
  p_email text default null,
  p_phone text default null,
  p_next_of_kin text default null,
  p_programme uuid default null,
  p_status text default 'admitted',
  p_year integer default null,
  p_intake text default null,
  p_id_number text default null,
  p_campus text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_reference text := nullif(trim(coalesce(p_reference, p_student_no, '')), '');
begin
  if not public.has_suite_role('registrar') then
    raise exception 'forbidden';
  end if;

  if v_reference is null then
    raise exception 'student reference is required';
  end if;

  if nullif(trim(coalesce(p_full_name, '')), '') is null then
    raise exception 'student name is required';
  end if;

  if nullif(trim(coalesce(p_email, '')), '') is null then
    raise exception 'student email is required';
  end if;

  if p_id is null then
    insert into public.students (
      student_no, reference, full_name, email, phone, next_of_kin,
      programme_id, status, year, intake, id_number, campus
    )
    values (
      nullif(trim(coalesce(p_student_no, '')), ''),
      v_reference,
      trim(p_full_name),
      lower(trim(p_email)),
      nullif(trim(coalesce(p_phone, '')), ''),
      nullif(trim(coalesce(p_next_of_kin, '')), ''),
      p_programme,
      coalesce(nullif(trim(coalesce(p_status, '')), ''), 'admitted'),
      p_year,
      nullif(trim(coalesce(p_intake, '')), ''),
      nullif(trim(coalesce(p_id_number, '')), ''),
      nullif(trim(coalesce(p_campus, '')), '')
    )
    returning id into v_id;
  else
    update public.students
    set
      student_no = nullif(trim(coalesce(p_student_no, '')), ''),
      reference = v_reference,
      full_name = trim(p_full_name),
      email = lower(trim(p_email)),
      phone = nullif(trim(coalesce(p_phone, '')), ''),
      next_of_kin = nullif(trim(coalesce(p_next_of_kin, '')), ''),
      programme_id = p_programme,
      status = coalesce(nullif(trim(coalesce(p_status, '')), ''), status),
      year = p_year,
      intake = nullif(trim(coalesce(p_intake, '')), ''),
      id_number = nullif(trim(coalesce(p_id_number, '')), ''),
      campus = nullif(trim(coalesce(p_campus, '')), '')
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'student not found';
    end if;
  end if;

  return v_id;
end;
$$;

create or replace function public.student_archive(p_student uuid, p_status text default 'inactive')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_suite_role('registrar') then
    raise exception 'forbidden';
  end if;

  update public.students
  set status = coalesce(nullif(trim(coalesce(p_status, '')), ''), 'inactive')
  where id = p_student;

  if not found then
    raise exception 'student not found';
  end if;
end;
$$;

create or replace function public.hold_place(
  p_student uuid,
  p_type text,
  p_reason text default null,
  p_blocks text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_type text := lower(trim(coalesce(p_type, '')));
begin
  if not public.has_suite_role('registrar', 'bursar') then
    raise exception 'forbidden';
  end if;

  if v_type not in ('financial', 'advising', 'conduct', 'library') then
    raise exception 'invalid hold type';
  end if;

  if not exists (select 1 from public.students where id = p_student) then
    raise exception 'student not found';
  end if;

  insert into public.holds (student_id, type, reason, blocks, active)
  values (p_student, v_type, nullif(trim(coalesce(p_reason, '')), ''), coalesce(p_blocks, '{}'), true)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.hold_clear(p_hold uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_suite_role('registrar', 'bursar') then
    raise exception 'forbidden';
  end if;

  update public.holds
  set active = false
  where id = p_hold;

  if not found then
    raise exception 'hold not found';
  end if;
end;
$$;

grant execute on function public.reject_application(uuid, text) to authenticated;
grant execute on function public.student_upsert(uuid, text, text, text, text, text, text, uuid, text, integer, text, text, text) to authenticated;
grant execute on function public.student_archive(uuid, text) to authenticated;
grant execute on function public.hold_place(uuid, text, text, text[]) to authenticated;
grant execute on function public.hold_clear(uuid) to authenticated;

notify pgrst, 'reload schema';
