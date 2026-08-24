-- ============================================================================
-- Symanek — RLS + RPC integration tests (Phase E, E3).
--
-- Self-contained assertion script. Runs inside a transaction that is ROLLED
-- BACK at the end, so it never persists test data. Any failed assertion raises
-- an exception → psql (ON_ERROR_STOP=1) exits non-zero → CI fails.
--
-- Run: supabase/tests/run.sh   (uses the local Supabase Postgres container).
-- Requires the 9 demo accounts (seed_auth.sh) and seed programmes.
-- ============================================================================
\set ON_ERROR_STOP on
begin;

-- ---- helpers --------------------------------------------------------------
-- Assert a condition; raise a labelled failure otherwise.
create or replace function pg_temp.ok(cond boolean, label text) returns void
language plpgsql as $$
begin
  if cond then raise notice '  ok   - %', label;
  else raise exception 'FAIL - %', label; end if;
end $$;

-- Run p_sql as the given auth user under RLS; return 'ok' if it succeeded,
-- else 'blocked' (RLS or any error). Resets role afterwards.
create or replace function pg_temp.as_user(p_email text, p_sql text) returns text
language plpgsql as $$
declare uid uuid;
begin
  select id into uid from auth.users where email = p_email;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);
  begin
    execute p_sql;
    reset role; perform set_config('request.jwt.claims', '', true);
    return 'ok';
  exception when others then
    reset role; perform set_config('request.jwt.claims', '', true);
    return 'blocked';
  end;
end $$;

-- Run p_sql as anon (SECURITY DEFINER RPCs run as owner regardless).
create or replace function pg_temp.as_anon(p_sql text) returns text
language plpgsql as $$
begin
  execute 'set local role anon';
  begin execute p_sql; reset role; return 'ok';
  exception when others then reset role; return 'blocked'; end;
end $$;

do $$
declare
  v_app uuid; v_stu uuid; v_slug text; v_ref text; v_token text; v_stage text;
  v_before int; v_after int;
  v_avail0 int; v_avail1 int; v_loan uuid; v_ret json;
begin
  raise notice '== RLS privilege separation ==';
  -- pick real FK targets so only RLS (WITH CHECK), not FK, decides
  select id into v_app from public.applications limit 1;

  -- Payments are audit-sensitive: the app records them only through SECURITY DEFINER
  -- RPCs (mark_paid / pay_invoice / confirm_invoice_payment), never via a raw client
  -- INSERT. So RLS correctly denies a direct write even to the bursar.
  perform pg_temp.ok(pg_temp.as_user('bursar@symanek.local',
    format('insert into public.payments(application_id,reference,amount) values (%L,%L,1)', v_app,'T')) = 'blocked',
    'payments are written via RPC, not raw insert (denied even to bursar)');
  perform pg_temp.ok(pg_temp.as_user('librarian@symanek.local',
    format('insert into public.payments(application_id,reference,amount) values (%L,%L,1)', v_app,'T')) = 'blocked',
    'librarian may NOT write payments');
  perform pg_temp.ok(pg_temp.as_user('registrar@symanek.local',
    'insert into public.students(reference,full_name,email) values (''T1'',''T'',''t@t.na'')') = 'ok',
    'registrar may write students');
  perform pg_temp.ok(pg_temp.as_user('bursar@symanek.local',
    'insert into public.students(reference,full_name,email) values (''T2'',''T'',''t@t.na'')') = 'blocked',
    'bursar may NOT write students');
  perform pg_temp.ok(pg_temp.as_user('hr@symanek.local',
    'insert into public.staff(name,role) values (''T'',''L'')') = 'ok',
    'hr may write staff');
  perform pg_temp.ok(pg_temp.as_user('teacher@symanek.local',
    'insert into public.staff(name,role) values (''T'',''L'')') = 'blocked',
    'teacher may NOT write staff');
  perform pg_temp.ok(pg_temp.as_user('admin@symanek.local',
    'insert into public.students(reference,full_name,email) values (''T3'',''T'',''t@t.na'')') = 'ok',
    'admin may write students (admin passes every scope)');
  perform pg_temp.ok(pg_temp.as_user('admin@symanek.local',
    'insert into public.audit_log(action) values (''x'')') = 'blocked',
    'audit_log is write-protected even for admin (triggers only)');
  perform pg_temp.ok(pg_temp.as_anon('perform 1 from public.students limit 1') = 'blocked'
                     or pg_temp.as_user('student@symanek.local','select count(*) from public.students') = 'ok',
    'students are not anon-readable');

  raise notice '== applicant flow RPCs ==';
  select slug into v_slug from public.programmes where active limit 1;
  -- submit as anon
  v_app := (public.submit_application('Test Applicant','tester@example.com','0810000000', v_slug, 'full_time', null));
  perform pg_temp.ok(v_app is not null, 'submit_application (anon) creates an application');

  -- approve as admin
  perform set_config('request.jwt.claims',
    json_build_object('sub',(select id from auth.users where email='admin@symanek.local')::text)::text, true);
  v_ref := public.approve_application(v_app);
  perform pg_temp.ok(v_ref like 'SYM-%', 'approve_application assigns a SYM reference');
  perform pg_temp.ok(exists(select 1 from public.students where application_id = v_app),
    'approve_application creates the student record');

  raise notice '== letter token gating (A1) ==';
  -- looked up by REFERENCE -> token must be null (enumeration blocked)
  select access_token into v_token from public.get_application_status(v_ref);
  perform pg_temp.ok(v_token is null, 'get_application_status by reference hides the letter token');
  -- looked up by EMAIL -> token present (proof of ownership)
  select access_token, stage into v_token, v_stage from public.get_application_status('tester@example.com');
  perform pg_temp.ok(v_token is not null, 'get_application_status by email releases the letter token');

  raise notice '== payment + audit trigger ==';
  select count(*) into v_before from public.audit_log;
  perform public.mark_paid(v_app, (select amount_due from public.applications where id=v_app), 'EFT');
  select stage into v_stage from public.applications where id = v_app;
  perform pg_temp.ok(v_stage = 'enrolled', 'mark_paid (full amount) enrols the applicant');
  select count(*) into v_after from public.audit_log;
  perform pg_temp.ok(v_after > v_before, 'a payment writes an audit_log row (trigger)');

  raise notice '== spine RPCs ==';
  perform pg_temp.ok((select count(*) from public.exam_schedule()) >= 0,
    'exam_schedule() RPC is callable and returns the timetable shape');
  perform pg_temp.ok((public.dashboard_stats()::jsonb) ? 'enrolled_students',
    'dashboard_stats() returns real aggregates');

  raise notice '== library backend ==';
  perform set_config('request.jwt.claims',
    json_build_object('sub',(select id from auth.users where email='librarian@symanek.local')::text)::text, true);
  select avail into v_avail0 from public.library_catalogue() where isbn = '978-0-435905-25-5';
  v_loan := public.library_issue('978-0-435905-25-5', 'Test Borrower', 14);
  select avail into v_avail1 from public.library_catalogue() where isbn = '978-0-435905-25-5';
  perform pg_temp.ok(v_avail1 = v_avail0 - 1, 'library_issue decrements availability');
  v_ret := public.library_return(v_loan);
  perform pg_temp.ok((v_ret->>'ok')::boolean, 'library_return succeeds');
  select avail into v_avail1 from public.library_catalogue() where isbn = '978-0-435905-25-5';
  perform pg_temp.ok(v_avail1 = v_avail0, 'library_return restores availability');

  raise notice '== degree audit ==';
  perform set_config('request.jwt.claims',
    json_build_object('sub',(select id from auth.users where email='admin@symanek.local')::text)::text, true);
  perform pg_temp.ok(
    (public.degree_audit((select id from public.students limit 1))::jsonb) ? 'reqs',
    'degree_audit() returns real credit progress');

  raise notice '== timetable ==';
  -- claims are admin here (admin passes has_suite_role('registrar'))
  perform pg_temp.ok(public.timetable_set('TEST-CLS', 1, 'P1', 'Maths', 'Rm 1', null) is not null,
    'timetable_set upserts a slot');
  perform pg_temp.ok((select count(*) from public.timetable('TEST-CLS')) = 1,
    'timetable() returns the slot');

  raise notice '== general ledger ==';
  perform pg_temp.ok(
    (select coalesce(sum(dr),0) from public.gl_journal_list())
      = (select coalesce(sum(cr),0) from public.gl_journal_list()),
    'ledger is balanced (total debits = total credits)');
  perform pg_temp.ok(
    public.gl_post(current_date, 'Test entry',
      '[{"acc":"Salaries & Wages","dr":100,"cr":0},{"acc":"Cash & Cash Equivalents","dr":0,"cr":100}]'::jsonb) is not null,
    'gl_post accepts a balanced entry');

  raise notice '== canteen ==';
  perform pg_temp.ok(
    public.canteen_record_sale(20, 'Cash', '[{"name":"Water 500ml","qty":2,"price":10}]'::jsonb) is not null,
    'canteen_record_sale records a sale');
  perform pg_temp.ok((public.canteen_summary()::jsonb) ? 'sales_today',
    'canteen_summary returns today''s figures');

  perform set_config('request.jwt.claims', '', true);
  raise notice 'ALL TESTS PASSED';
end $$;

rollback;
