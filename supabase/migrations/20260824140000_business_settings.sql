-- ============================================================================
-- Symanek — editable business rules (grade bands, assessment weights, PAYE/SSC/
-- VET levy, VAT, currency). Previously these lived as hard-coded constants in
-- src/data.js / src/lib. Moving them to a config table lets the college adjust
-- them from Settings without a code change — notably the exact grade boundaries,
-- which the client is still confirming (their sample shows 79→C).
--
-- Defaults seeded here reproduce the current values, so behaviour is unchanged
-- until an admin edits them. Idempotent (on conflict do nothing keeps edits).
-- ============================================================================

create table if not exists public.business_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.business_settings enable row level security;

drop policy if exists "business_settings staff read" on public.business_settings;
create policy "business_settings staff read" on public.business_settings
  for select using (public.is_admin());

drop policy if exists "business_settings admin write" on public.business_settings;
create policy "business_settings admin write" on public.business_settings
  for all
  using  ((select role from public.profiles where id = auth.uid()) = 'admin')
  with check ((select role from public.profiles where id = auth.uid()) = 'admin');

-- ---- defaults (current values; PAYE top bracket "to": null == +Infinity) ----
insert into public.business_settings (key, value) values
  ('grade_bands', '[{"min":80,"letter":"A","gpa":4},{"min":70,"letter":"B","gpa":3},{"min":60,"letter":"C","gpa":2},{"min":50,"letter":"D","gpa":1}]'::jsonb),
  ('assessment_weights', '{"ca":0.6,"exam":0.4}'::jsonb),
  ('pass_rules', '{"formativeMin":50,"moduleFinalMin":50,"examPaperMin":40,"secondOppLow":45,"secondOppHigh":49,"resitCap":50}'::jsonb),
  ('paye_brackets', '[{"from":0,"to":100000,"rate":0,"fixed":0},{"from":100001,"to":150000,"rate":0.18,"fixed":0},{"from":150001,"to":350000,"rate":0.25,"fixed":9000},{"from":350001,"to":550000,"rate":0.28,"fixed":59000},{"from":550001,"to":850000,"rate":0.30,"fixed":115000},{"from":850001,"to":1550000,"rate":0.32,"fixed":205000},{"from":1550001,"to":null,"rate":0.37,"fixed":429000}]'::jsonb),
  ('ssc', '{"rate":0.009,"cap":81}'::jsonb),
  ('vet_levy', '{"rate":0.01,"threshold":1000000}'::jsonb),
  ('tax', '{"corporateRate":0.30,"vatRate":0.15}'::jsonb),
  ('currency', '{"code":"NAD","symbol":"N$"}'::jsonb)
on conflict (key) do nothing;

-- ---- reads: all settings as one json object (staff-facing) ----
create or replace function public.get_business_settings()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_object_agg(key, value), '{}'::json) from public.business_settings;
$$;
revoke all on function public.get_business_settings() from public;
grant execute on function public.get_business_settings() to authenticated;

-- ---- write: admin only ----
create or replace function public.set_business_setting(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'not authorized';
  end if;
  insert into public.business_settings (key, value, updated_at, updated_by)
  values (p_key, p_value, now(), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
end $$;
revoke all on function public.set_business_setting(text, jsonb) from public;
grant execute on function public.set_business_setting(text, jsonb) to authenticated;

-- ---- grade letter from the configured bands (fallback to the current scale) ----
create or replace function public.grade_letter(p_mark numeric)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((
    select b->>'letter'
    from public.business_settings s
    cross join lateral jsonb_array_elements(s.value) b
    where s.key = 'grade_bands' and p_mark >= (b->>'min')::numeric
    order by (b->>'min')::numeric desc
    limit 1
  ), case when p_mark >= 80 then 'A' when p_mark >= 70 then 'B'
          when p_mark >= 60 then 'C' when p_mark >= 50 then 'D' else 'F' end);
$$;
revoke all on function public.grade_letter(numeric) from public;
grant execute on function public.grade_letter(numeric) to authenticated;

-- ---- publish_exam_results now derives the letter from the configured bands ----
create or replace function public.publish_exam_results(p_course_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_n int; v_code text;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select code into v_code from public.courses where id = p_course_id;
  if v_code is null then
    return jsonb_build_object('ok', false, 'code', 'no_course', 'message', 'Course not found.');
  end if;

  -- final = 60% CA + 40% exam; letter grade from the configured institutional scale.
  update public.results r
    set final = round(0.6 * coalesce(r.ca, 0) + 0.4 * coalesce(r.exam, 0), 2),
        grade = public.grade_letter(0.6 * coalesce(r.ca, 0) + 0.4 * coalesce(r.exam, 0)),
        published = true
  from public.enrolments e
  where r.enrolment_id = e.id and e.course_id = p_course_id and r.published = false;
  get diagnostics v_n = row_count;

  update public.enrolments e
    set status = case
          when r.final >= 50 and coalesce(r.exam,0) >= 40 then 'passed'
          when (r.final >= 45 and r.final <= 49)
            or (r.final >= 50 and coalesce(r.exam,0) < 40) then 'second_opp'
          else 'failed' end
  from public.results r
  where r.enrolment_id = e.id and e.course_id = p_course_id and r.published;

  return jsonb_build_object('ok', true, 'code', 'published', 'course', v_code, 'published', v_n,
    'message', 'Results published for ' || v_code || ' — ' || v_n || ' mark(s) locked to the transcript.');
end $$;
grant execute on function public.publish_exam_results(uuid) to authenticated;

notify pgrst, 'reload schema';
