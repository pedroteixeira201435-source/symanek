-- ============================================================================
-- Symanek — manual EFT proof-of-payment (no gateway).
-- Applicant pays by EFT and uploads a proof; admin reviews it and marks paid
-- (amount) via mark_paid. Upload is done server-side (Next /api/payment-proof
-- using the service role), so no anon storage policy is needed.
-- ============================================================================

alter table public.applications
  add column if not exists proof_path         text,
  add column if not exists proof_amount       numeric(12,2),
  add column if not exists proof_submitted_at timestamptz;

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

drop policy if exists "payment-proofs admin read" on storage.objects;
drop policy if exists "payment-proofs admin manage" on storage.objects;
create policy "payment-proofs admin read" on storage.objects for select
  using (bucket_id = 'payment-proofs' and public.is_admin());
create policy "payment-proofs admin manage" on storage.objects for all
  using (bucket_id = 'payment-proofs' and public.is_admin())
  with check (bucket_id = 'payment-proofs' and public.is_admin());

-- extend the public status lookup to expose whether a proof was submitted
drop function if exists public.get_application_status(text);
create or replace function public.get_application_status(p_ref text)
returns table (
  found boolean, full_name text, programme text, stage text,
  reference text, amount_due numeric, approval_letter_path text,
  proof_submitted boolean, proof_amount numeric
) language plpgsql stable security definer set search_path = public as $$
declare v_app public.applications; v_prog text;
begin
  select a.* into v_app from public.applications a
   where upper(a.reference) = upper(trim(p_ref))
      or lower(a.email)     = lower(trim(p_ref))
   order by a.created_at desc limit 1;

  if v_app.id is null then
    return query select false, null::text, null::text, null::text,
                        null::text, null::numeric, null::text, false, null::numeric;
    return;
  end if;

  select p.name || coalesce(' (' || p.level || ')', '')
    into v_prog from public.programmes p where p.id = v_app.programme_id;

  return query select
    true, v_app.full_name, v_prog, v_app.stage::text, v_app.reference,
    case when v_app.stage in ('approved','paid') then v_app.amount_due else 0 end,
    case when v_app.stage in ('approved','paid','enrolled') then v_app.approval_letter_path else null end,
    (v_app.proof_path is not null), v_app.proof_amount;
end;
$$;
grant execute on function public.get_application_status(text) to anon, authenticated;
