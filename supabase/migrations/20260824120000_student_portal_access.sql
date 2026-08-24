-- ============================================================================
-- Symanek — student portal access (admin-granted) + staff self-signup hardening.
--
-- Two-track access model:
--   * Staff (admin/bursar/hr/teacher/registrar/librarian/seller) are provisioned
--     MANUALLY in Supabase — a profile row with a suite_role IS the approval.
--     Nothing self-service may ever mint a staff profile.
--   * Students get portal access when an admin clicks "Grant portal access" in
--     the Suite. That path runs through the grant-student-access Edge Function
--     (service_role) which creates the auth user and calls link_student_account()
--     below. The student logs in with a temporary password they must change.
-- ============================================================================

-- 1) Least-privilege default. New profiles must never silently become staff.
--    A real staff row is only ever written by the manual/admin path.
alter table public.profiles alter column role set default 'student';

-- 2) First-login forced password change flag, surfaced to the app.
alter table public.profiles
  add column if not exists must_reset_password boolean not null default false;

-- 3) Belt-and-braces: a self-service write can never elevate itself to staff.
--    Admin writes go through the "profiles admin write" RLS policy (is_admin());
--    the Edge Function runs as service_role with auth.uid() = null. Both bypass
--    this guard — it only clamps a row a user writes for THEMSELVES.
create or replace function public.profiles_block_self_staff()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and new.id = auth.uid()
     and coalesce(new.role, 'staff') in ('admin', 'staff') then
    new.role := 'student';
    new.suite_role := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_block_self_staff on public.profiles;
create trigger trg_profiles_block_self_staff
  before insert or update on public.profiles
  for each row execute function public.profiles_block_self_staff();

-- 4) Link a freshly-created auth user to a student and seed the profile as a
--    STUDENT workspace. suite_role = 'student' is REQUIRED (the Suite resolves
--    the workspace from suite_role; a null would reject the login) and grants
--    NO staff access — is_admin() and has_suite_role('bursar'|...) never match it.
--    Called by the grant-student-access Edge Function with the service_role key.
create or replace function public.link_student_account(
  p_student uuid, p_user uuid, p_full_name text
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role, suite_role, must_reset_password)
  values (p_user, p_full_name, 'student', 'student', true)
  on conflict (id) do update
    set role = 'student', suite_role = 'student',
        full_name = excluded.full_name, must_reset_password = true;

  update public.students set user_id = p_user where id = p_student;
end;
$$;
revoke all on function public.link_student_account(uuid, uuid, text) from anon, authenticated;

-- 5) Cleared by the app once the student sets a new password on first login.
create or replace function public.clear_password_reset()
returns void language sql security definer set search_path = public as $$
  update public.profiles set must_reset_password = false where id = auth.uid();
$$;
grant execute on function public.clear_password_reset() to authenticated;
