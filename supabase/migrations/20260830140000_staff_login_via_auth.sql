-- ============================================================================
-- Symanek — staff logins the simple, native way.
--
-- Create the login with Supabase's own Authentication → Add user (GoTrue handles
-- the password, no fragile SQL). Two triggers make the workspace a one-cell edit:
--   * on auth.users insert → auto-create the matching profiles row (no workspace
--     yet, so a fresh login has NO access until an admin sets it).
--   * on profiles insert/update → derive the coarse role from suite_role and
--     block self-elevation, so the admin only ever edits ONE column: suite_role.
--
-- Flow for the admin (all in the dashboard):
--   1) Authentication → Add user (email + password + Auto Confirm).
--   2) Table Editor → profiles → the new row → set suite_role
--      (admin|bursar|hr|teacher|registrar|librarian|seller).
--   Revoke: delete the user in Authentication (cascades to profiles).
--
-- Replaces the earlier staff_access table + SQL-auth-insert approach.
-- ============================================================================

-- Convenience: lets the admin find the right profiles row by email.
alter table public.profiles add column if not exists email text;

-- ---- Trigger 1: mint an empty profile whenever an auth user is created -------
-- No suite_role (no access) and NO trust of user metadata for the role, so a
-- public sign-up can never mint itself a staff workspace. Students are unaffected:
-- grant-student-access creates the user (empty profile here) then
-- link_student_account upserts it to 'student' (ON CONFLICT DO UPDATE).
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_handle_new_auth_user on auth.users;
create trigger trg_handle_new_auth_user
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---- Trigger 2: keep coarse role in sync with suite_role + block self-elevation
-- Runs after trg_profiles_block_self_staff (alphabetical). The admin edits only
-- suite_role; this derives the correct role. is_admin() = role in ('admin','staff'),
-- so this is what makes a 'teacher'/'admin' workspace actually work.
create or replace function public.sync_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- A user writing their OWN row may never grant themselves a staff/admin
  -- workspace. Dashboard/service_role and SECURITY DEFINER RPCs have
  -- auth.uid() = null and bypass this guard.
  if auth.uid() is not null and new.id = auth.uid()
     and new.suite_role in ('admin','bursar','hr','teacher','seller','librarian','registrar') then
    new.suite_role := null;
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

drop trigger if exists trg_profiles_sync_role on public.profiles;
create trigger trg_profiles_sync_role
  before insert or update on public.profiles
  for each row execute function public.sync_profile_role();

-- ---- Clean up the earlier (rejected) staff_access approach -------------------
-- The SQL-auth-insert path is replaced by the native Add user flow above.
drop trigger if exists trg_provision_staff_login on public.staff_access;
drop trigger if exists trg_deprovision_staff_login on public.staff_access;
drop table if exists public.staff_access cascade;
drop function if exists public.provision_staff_login() cascade;
drop function if exists public.deprovision_staff_login() cascade;
