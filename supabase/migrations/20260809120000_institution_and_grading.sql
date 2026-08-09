-- ============================================================================
-- Symanek Suite — institutional settings, signatories & grading descriptions.
--   (Symanek response 2026-08-09: official letterhead, signatories, statement
--    of result grading scale.)
--
--   • college_settings  — single-row official identity used on every generated
--     document (letterhead, address, reg/tax no, banking, portal).
--   • signatories       — who signs which letter (CEO, Registrar, Admin).
--   • students          — add id_number / campus for the real registration rosters.
--   • results           — add exam_type (Normal/Supplementary/Special) and expose
--     the official result description keyed to the existing letter grade, matching
--     the Statement of Result the college issues.
--
-- Idempotent. Follows the RLS pattern in 20260728130000_feedback_features.sql.
-- ============================================================================

-- ---------- college settings (official identity for documents) ----------
create table if not exists public.college_settings (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid references public.institutions(id),
  name          text not null,
  address       text,
  po_box        text,
  reg_no        text,
  tax_no        text,
  phone         text,
  cell          text,
  fax           text,
  email         text,
  website       text,
  portal_url    text,
  bank_name     text,
  bank_account_name text,
  bank_account_no   text,
  bank_account_type text,
  bank_branch   text,
  logo_path     text,          -- storage path (bucket: student-documents) — pending client asset
  stamp_path    text,          -- official stamp image — PENDING from client (E-02)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create or replace trigger trg_college_settings_updated
  before update on public.college_settings
  for each row execute function public.set_updated_at();

-- Seed the single official row (values from the 2026-08-09 letterhead template).
insert into public.college_settings
  (tenant_id, name, address, po_box, reg_no, tax_no, phone, cell, fax, email, website,
   portal_url, bank_name, bank_account_name, bank_account_no, bank_account_type, bank_branch)
select (select id from public.institutions where name = 'Symanek Specialized College'),
       'Symanek Specialized College',
       'Extension 6, Okahandja, Republic of Namibia',
       'P.O. Box 4270, Windhoek, Namibia',
       'cc/2022/10663',
       '13469812-01-1',
       '+264 62 502227',
       '+264 85 804 5679',
       '+264 62 502227',
       'info@symanekacademy.com',
       'www.symanekacademy.com',
       'www.symanek.educims.org',
       'First National Bank (FNB)',
       'Symanek Training Academy',
       '64279814676',
       'Cheque',
       'Okahandja'
where not exists (select 1 from public.college_settings);

-- ---------- signatories (who signs which document) ----------
create table if not exists public.signatories (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid references public.institutions(id),
  role_key       text not null,   -- ceo | registrar | admin_assistant  (matched by letter type)
  name           text not null,
  title          text not null,
  signature_path text,            -- storage path — PENDING from client
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);
create unique index if not exists signatories_role_key_uniq on public.signatories (role_key) where active;

insert into public.signatories (tenant_id, role_key, name, title)
select (select id from public.institutions where name = 'Symanek Specialized College'),
       v.role_key, v.name, v.title
from (values
  ('ceo',             'Mrs. Olivia Nelumbu',  'Chief Executive Officer'),
  ('registrar',       'Ms. Rebbeka Shilongo', 'Administration Assistant, Office of the Registrar'),
  ('admin_assistant', 'Ms. Michelle Guchas',  'Administrative Assistant')
) as v(role_key, name, title)
where not exists (select 1 from public.signatories s where s.role_key = v.role_key);

-- ---------- students: fields required by the real registration rosters ----------
alter table public.students add column if not exists id_number text;
alter table public.students add column if not exists campus    text default 'Main campus';

-- ---------- results: exam type + official result description ----------
alter table public.results add column if not exists exam_type text
  not null default 'Normal Exams'
  check (exam_type in ('Normal Exams', 'Supplementary/Special Exams'));

-- Official result description keyed to the institutional letter grade, matching
-- the Statement of Result. 'XX' = wrote the exam but sub-minimum not obtained.
-- NB: the exact mark→letter boundaries are being reconfirmed with the college
-- (their sample shows 79→C); this function only maps letter→description and does
-- not change the boundaries in publish_exam_results().
create or replace function public.result_description(p_grade text)
returns text language sql immutable as $$
  select case upper(coalesce(p_grade, ''))
    when 'A'  then 'Excellent'
    when 'B'  then 'Very Good'
    when 'C'  then 'Good'
    when 'D'  then 'Satisfactory'
    when 'XX' then 'Fail - Sub minimum not obtained'
    when 'F'  then 'Fail'
    else '' end;
$$;

-- ---------- RLS ----------
alter table public.college_settings enable row level security;
alter table public.signatories      enable row level security;

drop policy if exists "college_settings public read" on public.college_settings;
create policy "college_settings public read" on public.college_settings for select using (true);
drop policy if exists "college_settings admin write" on public.college_settings;
create policy "college_settings admin write" on public.college_settings for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "signatories public read" on public.signatories;
create policy "signatories public read" on public.signatories for select using (true);
drop policy if exists "signatories admin write" on public.signatories;
create policy "signatories admin write" on public.signatories for all
  using (public.is_admin()) with check (public.is_admin());

notify pgrst, 'reload schema';
