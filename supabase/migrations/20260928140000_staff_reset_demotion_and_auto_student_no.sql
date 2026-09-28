-- ============================================================================
-- Two faults reported by the school admin (Jeremia) on 2026-09-28:
--
-- 1) "Could not save: not authorized" when adding a lecturer.
--    Cause: on first sign-in every staff member changes the temporary password,
--    and clear_password_reset() updates their OWN profiles row. The self-write
--    guard profiles_block_self_staff() saw role 'admin'/'staff' on a self-write
--    and clamped it to role='student', suite_role=null — so every admin and
--    lecturer lost their workspace the moment they set their own password.
--    Fix: on a self UPDATE the role columns are simply kept as they were (a user
--    still cannot raise themselves, and no longer demotes themselves); on a self
--    INSERT the old clamp stays. Accounts already demoted are restored below.
--
-- 2) Add student required a student number.
--    student_upsert now generates one when it is left empty, in the EduCIMS
--    format already used by the college: <academic year><5 digits>, e.g.
--    202610273. The reference defaults to that number.
-- ============================================================================

-- ---- 1a) Self-write guard: keep, don't demote -------------------------------
create or replace function public.profiles_block_self_staff()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and new.id = auth.uid() then
    if tg_op = 'UPDATE' then
      new.role := old.role;
      new.suite_role := old.suite_role;
    elsif coalesce(new.role, 'staff') in ('admin', 'staff') then
      new.role := 'student';
      new.suite_role := null;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.sync_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- A user writing their OWN row may never change their workspace: on UPDATE
  -- it stays what it was, on INSERT a staff workspace is refused.
  -- Dashboard/service_role and SECURITY DEFINER RPCs have auth.uid() = null.
  if auth.uid() is not null and new.id = auth.uid() then
    if tg_op = 'UPDATE' then
      new.suite_role := old.suite_role;
    elsif new.suite_role in ('admin','bursar','hr','teacher','seller','librarian','registrar') then
      new.suite_role := null;
    end if;
  end if;

  new.role := case
    when new.suite_role = 'admin' then 'admin'
    when new.suite_role in ('bursar','hr','teacher','seller','librarian','registrar') then 'staff'
    when new.suite_role = 'student' then 'student'
    when new.suite_role = 'applicant' then 'applicant'
    else new.role
  end;
  return new;
end;
$$;

-- ---- 1b) Restore staff logins demoted by the old guard ----------------------
-- A linked staff login whose profile fell to suite_role null / role student.
-- Runs as the migration owner (auth.uid() null), so the guards do not apply.
update public.profiles p
set suite_role = 'admin'
from public.staff s
where s.user_id = p.id and p.suite_role is null
  and lower(s.email) = 'jeremiaf@symanekacademy.com';

update public.profiles p
set suite_role = 'teacher'
from public.staff s
where s.user_id = p.id and p.suite_role is null
  and coalesce(s.role, '') ~* '(lecturer|teacher|tutor|hod)';

-- ---- 2) Auto student number -------------------------------------------------
create or replace function public.next_student_no(p_year integer default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_year text := coalesce(p_year, extract(year from now())::int)::text;
  v_no text;
begin
  loop
    v_no := v_year || lpad((floor(random() * 100000))::int::text, 5, '0');
    exit when not exists (
      select 1 from public.students where student_no = v_no or reference = v_no);
  end loop;
  return v_no;
end;
$$;
revoke all on function public.next_student_no(integer) from public, anon, authenticated;

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
  p_campus text default null,
  p_academic_year integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_student_no text := nullif(trim(coalesce(p_student_no, '')), '');
  v_reference text;
begin
  if not public.has_suite_role('registrar') then
    raise exception 'forbidden';
  end if;

  -- New student without a number: generate one (EduCIMS format).
  if p_id is null and v_student_no is null then
    v_student_no := public.next_student_no(p_academic_year);
  end if;
  v_reference := coalesce(nullif(trim(coalesce(p_reference, '')), ''), v_student_no);

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
      programme_id, status, year, intake, id_number, campus, academic_year
    )
    values (
      v_student_no,
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
      nullif(trim(coalesce(p_campus, '')), ''),
      coalesce(p_academic_year, extract(year from now())::int)
    )
    returning id into v_id;
  else
    update public.students
    set
      student_no = coalesce(v_student_no, student_no),
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
      campus = nullif(trim(coalesce(p_campus, '')), ''),
      academic_year = coalesce(p_academic_year, academic_year)
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'student not found';
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.student_upsert(uuid, text, text, text, text, text, text, uuid, text, integer, text, text, text, integer) from public, anon;
grant execute on function public.student_upsert(uuid, text, text, text, text, text, text, uuid, text, integer, text, text, text, integer) to authenticated;

notify pgrst, 'reload schema';
