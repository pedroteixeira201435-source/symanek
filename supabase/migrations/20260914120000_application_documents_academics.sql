-- ============================================================================
-- Symanek — Admissions academic background + applicant documents
--
-- Applicants must submit school background, English symbol, subject results and
-- mandatory private documents (identity + Grade 11/12 certificate/statement).
-- Admissions staff can review document status; approval is blocked until the
-- mandatory document set is present and no document is rejected.
-- ============================================================================

alter table public.applications
  add column if not exists highest_school_level text
    check (highest_school_level is null or highest_school_level in ('grade_11_nssco','grade_12_nsscas','nssc_higher','other')),
  add column if not exists school_name text,
  add column if not exists year_completed int,
  add column if not exists english_symbol text;

create table if not exists public.application_academic_results (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  subject text not null,
  level text not null check (level in ('nssco_grade_11','nsscas_grade_12','nssc_higher','other')),
  symbol text not null,
  is_english boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists application_academic_results_app_idx
  on public.application_academic_results(application_id);
create unique index if not exists application_academic_results_one_english_idx
  on public.application_academic_results(application_id)
  where is_english;

create table if not exists public.application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  category text not null check (category in (
    'identity_document',
    'grade_11_or_12_certificate',
    'proof_of_residence',
    'previous_qualification',
    'other'
  )),
  file_name text not null,
  file_type text,
  file_size bigint not null default 0,
  storage_bucket text not null default 'application-documents',
  storage_path text not null,
  status text not null default 'submitted'
    check (status in ('submitted','verified','rejected','needs_resubmission')),
  review_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists application_documents_app_idx
  on public.application_documents(application_id);
create index if not exists application_documents_status_idx
  on public.application_documents(status);

insert into storage.buckets (id, name, public)
values ('application-documents', 'application-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "application-documents admin read" on storage.objects;
drop policy if exists "application-documents admin manage" on storage.objects;
create policy "application-documents admin read" on storage.objects for select
  using (bucket_id = 'application-documents' and public.is_admin());
create policy "application-documents admin manage" on storage.objects for all
  using (bucket_id = 'application-documents' and public.is_admin())
  with check (bucket_id = 'application-documents' and public.is_admin());

alter table public.application_academic_results enable row level security;
alter table public.application_documents enable row level security;

drop policy if exists "application academic staff read" on public.application_academic_results;
drop policy if exists "application academic owner read" on public.application_academic_results;
drop policy if exists "application documents staff read" on public.application_documents;
drop policy if exists "application documents owner read" on public.application_documents;

create policy "application academic staff read" on public.application_academic_results
  for select using (public.is_admin());
create policy "application academic owner read" on public.application_academic_results
  for select using (
    exists (
      select 1 from public.applications a
      where a.id = application_id and a.applicant_user_id = auth.uid()
    )
  );

create policy "application documents staff read" on public.application_documents
  for select using (public.is_admin());
create policy "application documents owner read" on public.application_documents
  for select using (
    exists (
      select 1 from public.applications a
      where a.id = application_id and a.applicant_user_id = auth.uid()
    )
  );

create or replace function public.application_document_set_status(
  p_document uuid,
  p_status text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_suite_role('registrar') and not public.is_admin() then
    raise exception 'forbidden';
  end if;

  if p_status not in ('submitted','verified','rejected','needs_resubmission') then
    raise exception 'invalid document status';
  end if;

  update public.application_documents
  set
    status = p_status,
    review_note = nullif(trim(coalesce(p_note, '')), ''),
    reviewed_by = auth.uid(),
    reviewed_at = now()
  where id = p_document;

  if not found then
    raise exception 'document not found';
  end if;
end;
$$;
grant execute on function public.application_document_set_status(uuid, text, text) to authenticated;

drop function if exists public.get_application_status(text);
create or replace function public.get_application_status(p_ref text)
returns table (
  found boolean, full_name text, programme text, stage text,
  reference text, amount_due numeric, approval_letter_path text,
  proof_submitted boolean, proof_amount numeric, access_token text,
  highest_school_level text, school_name text, year_completed int,
  english_symbol text, documents_complete boolean,
  documents jsonb, academic_results jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_app public.applications;
  v_prog text;
  v_by_email boolean;
  v_by_id boolean;
begin
  select a.* into v_app from public.applications a
   where upper(a.reference) = upper(trim(p_ref))
      or lower(a.email) = lower(trim(p_ref))
      or a.id::text = trim(p_ref)
   order by a.created_at desc limit 1;

  if v_app.id is null then
    return query select false, null::text, null::text, null::text,
                        null::text, null::numeric, null::text, false, null::numeric, null::text,
                        null::text, null::text, null::int, null::text, false,
                        '[]'::jsonb, '[]'::jsonb;
    return;
  end if;

  v_by_email := lower(trim(p_ref)) = lower(v_app.email);
  v_by_id := trim(p_ref) = v_app.id::text;

  select p.name || coalesce(' (' || p.level || ')', '')
    into v_prog from public.programmes p where p.id = v_app.programme_id;

  return query select
    true, v_app.full_name, v_prog, v_app.stage::text, v_app.reference,
    case when v_app.stage in ('approved','paid') then v_app.amount_due else 0 end,
    case when v_app.stage in ('approved','paid','enrolled') then v_app.approval_letter_path else null end,
    (v_app.proof_path is not null), v_app.proof_amount,
    case when v_by_email and v_app.stage in ('approved','paid','enrolled')
         then v_app.access_token::text else null end,
    v_app.highest_school_level, v_app.school_name, v_app.year_completed, v_app.english_symbol,
    exists (
      select 1 from public.application_documents d
      where d.application_id = v_app.id and d.category = 'identity_document'
    )
    and exists (
      select 1 from public.application_documents d
      where d.application_id = v_app.id and d.category = 'grade_11_or_12_certificate'
    )
    and not exists (
      select 1 from public.application_documents d
      where d.application_id = v_app.id and d.status = 'rejected'
    ),
    case when v_by_email or v_by_id then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', d.id,
        'category', d.category,
        'file_name', d.file_name,
        'status', d.status,
        'review_note', d.review_note,
        'created_at', d.created_at
      ) order by d.created_at), '[]'::jsonb)
      from public.application_documents d
      where d.application_id = v_app.id
    ) else '[]'::jsonb end,
    case when v_by_email or v_by_id then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'subject', r.subject,
        'level', r.level,
        'symbol', r.symbol,
        'is_english', r.is_english
      ) order by r.is_english desc, r.subject), '[]'::jsonb)
      from public.application_academic_results r
      where r.application_id = v_app.id
    ) else '[]'::jsonb end;
end;
$$;
grant execute on function public.get_application_status(text) to anon, authenticated;

drop function if exists public.approve_application(uuid);
create or replace function public.approve_application(p_app uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.applications;
  v_fee numeric;
  v_ref text;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  select * into v_app from public.applications where id = p_app for update;
  if v_app.id is null then raise exception 'application not found'; end if;
  if v_app.reference is not null then return v_app.reference; end if;

  if v_app.highest_school_level is null
     or nullif(trim(coalesce(v_app.school_name, '')), '') is null
     or v_app.year_completed is null
     or nullif(trim(coalesce(v_app.english_symbol, '')), '') is null then
    raise exception 'academic background is incomplete';
  end if;

  if not exists (
    select 1 from public.application_documents
    where application_id = p_app and category = 'identity_document'
  ) then
    raise exception 'identity document is required';
  end if;

  if not exists (
    select 1 from public.application_documents
    where application_id = p_app and category = 'grade_11_or_12_certificate'
  ) then
    raise exception 'grade 11/12 certificate or statement is required';
  end if;

  if exists (
    select 1 from public.application_documents
    where application_id = p_app and status = 'rejected'
  ) then
    raise exception 'application has rejected documents';
  end if;

  select fee into v_fee from public.programmes where id = v_app.programme_id;
  v_ref := public.next_reference();

  update public.applications set
    stage = 'approved', reference = v_ref, amount_due = coalesce(v_fee, 0),
    approval_letter_path = 'approval-letters/' || v_ref || '.pdf',
    reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_app;

  insert into public.students (application_id, reference, full_name, email, programme_id, status)
  values (p_app, v_ref, v_app.full_name, v_app.email, v_app.programme_id, 'admitted')
  on conflict (application_id) do nothing;

  return v_ref;
end;
$$;
grant execute on function public.approve_application(uuid) to authenticated;

notify pgrst, 'reload schema';
