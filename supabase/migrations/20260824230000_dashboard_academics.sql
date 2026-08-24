-- ============================================================================
-- Symanek — Dashboard real aggregates (fee trend, cashflow, activity feed, work
-- queue) + Academics/Programmes/Courseware CRUD. Removes the last fabricated
-- dashboard charts and lets the registrar/teacher manage the catalogue & LMS.
-- Idempotent.
-- ============================================================================

-- ---- Dashboard aggregates (staff-facing) ----
create or replace function public.dashboard_fee_trend()
returns table (month text, collected numeric)
language sql stable security definer set search_path = public as $$
  select to_char(created_at, 'YYYY-MM') as month, sum(amount)
  from public.invoice_payments
  where created_at >= (date_trunc('month', current_date) - interval '5 months')
  group by 1 order by 1;
$$;

create or replace function public.dashboard_cashflow()
returns table (month text, income numeric, expense numeric)
language sql stable security definer set search_path = public as $$
  with m as (
    select to_char(d, 'YYYY-MM') as month
    from generate_series(date_trunc('month', current_date) - interval '5 months', date_trunc('month', current_date), interval '1 month') d
  )
  select m.month,
    coalesce((select sum(amount) from public.invoice_payments p where to_char(p.created_at,'YYYY-MM') = m.month), 0)
    + coalesce((select sum(amount) from public.payments pa where to_char(pa.created_at,'YYYY-MM') = m.month), 0),
    coalesce((select sum(amount) from public.expenses e where to_char(e.spent_on,'YYYY-MM') = m.month), 0)
  from m order by m.month;
$$;

create or replace function public.dashboard_activity()
returns table (action text, entity text, actor text, at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.action, a.entity, coalesce(p.full_name, 'System'), a.at
  from public.audit_log a left join public.profiles p on p.id = a.user_id
  order by a.at desc limit 12;
$$;

create or replace function public.dashboard_work_queue()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'pending_applications', (select count(*) from public.applications where stage in ('submitted','under_review')),
    'pending_proofs',       (select count(*) from public.invoice_payments where status = 'pending'),
    'pending_leave',        (select count(*) from public.leave_requests where status = 'pending'),
    'active_holds',         (select count(*) from public.holds where active)
  );
$$;

-- ---- Programmes / Courses (registrar) ----
create or replace function public.programme_upsert(
  p_id uuid, p_slug text, p_name text, p_category text, p_level text,
  p_duration text, p_fee numeric, p_modes text, p_description text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.has_suite_role('registrar') then raise exception 'not authorized'; end if;
  if p_id is null then
    insert into public.programmes (slug, name, category, level, duration, fee, modes, description)
    values (coalesce(nullif(trim(p_slug),''), lower(regexp_replace(trim(p_name),'[^a-zA-Z0-9]+','-','g'))),
            trim(p_name), coalesce(nullif(trim(p_category),''),'general'), nullif(trim(p_level),''),
            coalesce(nullif(trim(p_duration),''),'—'), p_fee, nullif(trim(p_modes),''), coalesce(nullif(trim(p_description),''),''))
    returning id into v_id;
  else
    update public.programmes set name = trim(p_name), category = coalesce(nullif(trim(p_category),''),category),
      level = nullif(trim(p_level),''), duration = coalesce(nullif(trim(p_duration),''),duration),
      fee = p_fee, modes = nullif(trim(p_modes),''), description = coalesce(nullif(trim(p_description),''),description),
      updated_at = now() where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;
create or replace function public.programme_set_active(p_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_suite_role('registrar') then raise exception 'not authorized'; end if;
  update public.programmes set active = p_active, updated_at = now() where id = p_id;
end $$;

create or replace function public.course_upsert(
  p_id uuid, p_code text, p_title text, p_programme uuid, p_credits int, p_semester text, p_capacity int, p_lecturer uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.has_suite_role('registrar') then raise exception 'not authorized'; end if;
  if p_id is null then
    insert into public.courses (tenant_id, code, title, programme_id, credits, semester, capacity, lecturer_staff_id)
    values ((select id from public.institutions order by created_at limit 1), trim(p_code), trim(p_title), p_programme,
            coalesce(p_credits,0), nullif(trim(p_semester),''), coalesce(p_capacity,0), p_lecturer) returning id into v_id;
  else
    update public.courses set code = trim(p_code), title = trim(p_title), programme_id = p_programme,
      credits = coalesce(p_credits,0), semester = nullif(trim(p_semester),''), capacity = coalesce(p_capacity,0),
      lecturer_staff_id = p_lecturer, updated_at = now() where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;
create or replace function public.course_delete(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_suite_role('registrar') then raise exception 'not authorized'; end if;
  delete from public.courses where id = p_id;
end $$;

-- ---- Courseware / LMS (teacher) ----
create or replace function public.courseware_upsert(p_id uuid, p_course uuid, p_title text, p_url text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.has_suite_role('teacher','registrar') then raise exception 'not authorized'; end if;
  if p_id is null then
    insert into public.courseware (course_id, title, url) values (p_course, trim(p_title), nullif(trim(p_url),'')) returning id into v_id;
  else
    update public.courseware set course_id = p_course, title = trim(p_title), url = nullif(trim(p_url),'') where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;
create or replace function public.courseware_delete(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_suite_role('teacher','registrar') then raise exception 'not authorized'; end if;
  delete from public.courseware where id = p_id;
end $$;
create or replace function public.courseware_list(p_course uuid)
returns table (id uuid, title text, url text)
language sql stable security definer set search_path = public as $$
  select id, title, url from public.courseware where course_id = p_course order by created_at;
$$;

-- ---- Academics analytics ----
create or replace function public.academics_at_risk()
returns table (student text, programme text, course text, final numeric)
language sql stable security definer set search_path = public as $$
  select s.full_name, p.name, c.code, r.final
  from public.results r
  join public.enrolments e on e.id = r.enrolment_id
  join public.students s on s.id = e.student_id
  left join public.programmes p on p.id = s.programme_id
  join public.courses c on c.id = e.course_id
  where r.published and r.final < 50 order by r.final;
$$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'dashboard_fee_trend()','dashboard_cashflow()','dashboard_activity()','dashboard_work_queue()',
    'programme_upsert(uuid,text,text,text,text,text,numeric,text,text)','programme_set_active(uuid,boolean)',
    'course_upsert(uuid,text,text,uuid,int,text,int,uuid)','course_delete(uuid)',
    'courseware_upsert(uuid,uuid,text,text)','courseware_delete(uuid)','courseware_list(uuid)','academics_at_risk()'
  ] loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;

notify pgrst, 'reload schema';
