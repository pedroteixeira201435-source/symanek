-- ============================================================================
-- Symanek — GO-LIVE step B2: retire the demo login accounts.
--
-- Removes every `*@symanek.local` auth user (the 9 demo accounts seeded by
-- seed_auth.sh with password `symanek123`). Deleting from auth.users cascades
-- to public.profiles (FK on delete cascade).
--
-- SAFETY GUARD: refuses to run unless at least one NON-demo account exists, so
-- you can't lock yourself out. Provision the real staff/admin logins FIRST.
--
-- Run against the production project only, once real accounts are in place:
--   (paste in the SQL editor, or pipe via psql/pooler)
-- ============================================================================

do $$
declare v_real int; v_demo int;
begin
  select count(*) into v_real from auth.users where email not like '%@symanek.local';
  select count(*) into v_demo from auth.users where email     like '%@symanek.local';

  if v_real = 0 then
    raise exception 'Refusing to delete demo accounts: no non-demo accounts exist yet. Provision real logins first (B2).';
  end if;

  delete from auth.users where email like '%@symanek.local';
  raise notice 'Removed % demo account(s); % real account(s) remain.', v_demo, v_real;
end $$;

-- NOTE: this does NOT remove the demo *data* slice (the "Gabriel !Naruseb" /
-- demo-programme rows from seed_demo/seed_suite). Preferred production hygiene is
-- to seed a fresh project with the REAL seeds only (seed_programmes + seed_golive)
-- and never apply the demo seeds — see GO-LIVE-CHECKLIST.md.
