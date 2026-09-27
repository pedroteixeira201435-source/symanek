-- ============================================================================
-- Symanek — staff portal access (admin-granted).
--
-- Mirrors the student path (20260824120000_student_portal_access.sql). A staff
-- ROW in public.staff is just an HR record — it grants NO login. A real login
-- needs an auth.users row plus a profiles row carrying a suite_role (the Suite
-- resolves the workspace from profiles.suite_role; a null rejects the sign-in).
--
-- Provisioning path (admin-only): the grant-staff-access Edge Function (service
-- role) creates the auth user with a temporary password and calls
-- link_staff_account() below. The staff member logs in with that temp password
-- and is forced to change it (must_reset_password). A terminal helper
-- (supabase/grant_staff.sh) can drive the same RPC directly for cloud ops.
--
-- These RPCs are SECURITY DEFINER and revoked from anon/authenticated: only the
-- service_role (Edge Function / helper) may execute them. Never self-service.
-- ============================================================================

-- Allowed staff workspaces. 'student'/'applicant' are NOT staff roles.
-- Keep in sync with src/lib/institution.js ROLES (staff subset).
create or replace function public.is_staff_suite_role(p_role text)
returns boolean language sql immutable as $$
  select p_role in ('admin','bursar','hr','teacher','seller','librarian','registrar');
$$;

-- Link a freshly-created auth user to a staff record and seed its profile with
-- the given suite_role. Coarse role: 'admin' for the admin workspace (so
-- is_admin() matches), 'staff' for every other workspace. must_reset_password
-- forces a first-login change. Called with the service_role key.
create or replace function public.link_staff_account(
  p_staff uuid, p_user uuid, p_suite_role text, p_full_name text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_role text;
begin
  if not public.is_staff_suite_role(p_suite_role) then
    raise exception 'invalid staff suite_role: %', p_suite_role;
  end if;
  v_role := case when p_suite_role = 'admin' then 'admin' else 'staff' end;

  insert into public.profiles (id, full_name, role, suite_role, must_reset_password)
  values (p_user, p_full_name, v_role, p_suite_role, true)
  on conflict (id) do update
    set role = excluded.role, suite_role = excluded.suite_role,
        full_name = excluded.full_name, must_reset_password = true;

  if p_staff is not null then
    update public.staff set user_id = p_user, updated_at = now() where id = p_staff;
  end if;
end;
$$;
revoke all on function public.link_staff_account(uuid, uuid, text, text) from anon, authenticated;

-- Change the workspace of an already-linked staff member (no new login).
-- Updates their profile via staff.user_id.
create or replace function public.set_staff_suite_role(
  p_staff uuid, p_suite_role text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_role text;
begin
  if not public.is_staff_suite_role(p_suite_role) then
    raise exception 'invalid staff suite_role: %', p_suite_role;
  end if;
  select user_id into v_user from public.staff where id = p_staff;
  if v_user is null then raise exception 'staff has no linked login'; end if;
  v_role := case when p_suite_role = 'admin' then 'admin' else 'staff' end;

  update public.profiles
    set role = v_role, suite_role = p_suite_role
    where id = v_user;
end;
$$;
revoke all on function public.set_staff_suite_role(uuid, text) from anon, authenticated;

-- Deactivate a staff login: drop their profile (so sign-in loses its workspace
-- and is rejected) and unlink staff.user_id. The auth.users row is left for the
-- Edge Function / helper to hard-delete with the service_role key.
create or replace function public.deactivate_staff_account(
  p_staff uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
begin
  select user_id into v_user from public.staff where id = p_staff;
  if v_user is not null then
    delete from public.profiles where id = v_user;
    update public.staff set user_id = null, updated_at = now() where id = p_staff;
  end if;
  return v_user; -- so the caller can delete the orphaned auth.users row
end;
$$;
revoke all on function public.deactivate_staff_account(uuid) from anon, authenticated;
