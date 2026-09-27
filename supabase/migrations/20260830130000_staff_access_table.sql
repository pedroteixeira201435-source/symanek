-- ============================================================================
-- Symanek — table-driven staff login provisioning (Supabase Table Editor).
--
-- The simplest possible admin flow: add a row to public.staff_access with the
-- person's email, full_name and suite_role, and a BEFORE INSERT trigger creates
-- the auth login + profile (with the workspace) + links the staff record, then
-- writes a generated temp_password back into the row. Delete the row to revoke.
--
-- No app, no terminal — just the Supabase dashboard Table Editor. Reuses
-- link_staff_account()/is_staff_suite_role() from 20260830120000.
-- ============================================================================

-- The editable table. Admin fills: full_name, email, suite_role (+ optional
-- staff_id). The trigger fills: temp_password, user_id, status, provisioned_at.
create table if not exists public.staff_access (
  id             uuid primary key default gen_random_uuid(),
  staff_id       uuid references public.staff(id) on delete set null,
  full_name      text not null,
  email          text not null,
  suite_role     text not null,             -- admin|bursar|hr|teacher|seller|librarian|registrar
  status         text not null default 'pending',
  temp_password  text,                       -- shown once; hand to the person, then clear
  user_id        uuid,                       -- filled by the trigger (auth.users id)
  provisioned_at timestamptz,
  created_at     timestamptz not null default now()
);

comment on table public.staff_access is
  'Add a row (full_name, email, suite_role) to create a staff Suite login. The trigger fills temp_password. Delete a row to revoke the login.';
comment on column public.staff_access.suite_role is
  'One of: admin, bursar, hr, teacher, seller, librarian, registrar';
comment on column public.staff_access.staff_id is
  'Optional: link to an existing public.staff record (sets staff.user_id).';

-- Only admins may see/edit this table from the app. The Supabase dashboard uses
-- the service_role and bypasses RLS, so this only clamps anon/authenticated app
-- clients (keeps temp_password out of their reach).
alter table public.staff_access enable row level security;
drop policy if exists "staff_access admin all" on public.staff_access;
create policy "staff_access admin all" on public.staff_access
  for all using (public.is_admin()) with check (public.is_admin());

-- BEFORE INSERT: provision the auth login and populate the row. Runs in the
-- same transaction, so any failure rolls the whole insert back (atomic).
create or replace function public.provision_staff_login()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := gen_random_uuid();
  v_email text := lower(trim(new.email));
  v_pw    text;
begin
  if v_email is null or v_email = '' then
    raise exception 'email required';
  end if;
  if not public.is_staff_suite_role(new.suite_role) then
    raise exception 'invalid suite_role: % (use admin|bursar|hr|teacher|seller|librarian|registrar)', new.suite_role;
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'a login already exists for %', v_email;
  end if;

  -- random temporary password (mixed classes), safe for a URL/console copy.
  v_pw := 'Sy' || translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/=', 'xy9') || '7!';

  -- 1) the GoTrue auth user (email pre-confirmed). Token columns set to '' to
  --    avoid NULL-scan errors on sign-in.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change, email_change_token_new, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
    extensions.crypt(v_pw, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', new.full_name),
    '', '', '', '', ''
  );

  -- 2) the matching email identity (provider_id required by current GoTrue).
  insert into auth.identities (
    id, user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_uid, 'email', v_email,
    jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    now(), now(), now()
  );

  -- 3) seed profile with the workspace + link the staff record (forces reset).
  perform public.link_staff_account(new.staff_id, v_uid, new.suite_role, new.full_name);

  new.email          := v_email;
  new.user_id        := v_uid;
  new.temp_password  := v_pw;
  new.status         := 'active';
  new.provisioned_at := now();
  return new;
end;
$$;

drop trigger if exists trg_provision_staff_login on public.staff_access;
create trigger trg_provision_staff_login
  before insert on public.staff_access
  for each row when (new.status = 'pending')
  execute function public.provision_staff_login();

-- AFTER DELETE: deleting a row revokes the login. Removing the auth user
-- cascades to auth.identities and public.profiles, and null-sets staff.user_id.
create or replace function public.deprovision_staff_login()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.user_id is not null then
    delete from auth.users where id = old.user_id;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_deprovision_staff_login on public.staff_access;
create trigger trg_deprovision_staff_login
  after delete on public.staff_access
  for each row execute function public.deprovision_staff_login();
