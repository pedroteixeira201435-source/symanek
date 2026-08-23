-- ============================================================================
-- Symanek — Phase A security A1: stop enumeration of the approval-letter PDF.
--
-- References (SYM-YYYY-NNNN) are sequential and printed on documents, so the
-- bare reference cannot be the only secret guarding the official letter (it is
-- guessable). Add a random per-application access token. `get_application_status`
-- only reveals the token when the caller proved knowledge of the applicant's
-- EMAIL (i.e. looked up by email, not by a guessed reference); `/api/letter`
-- then requires ref + token. Enumerating references can no longer pull letters.
--
-- Idempotent. Changing the RPC's return type needs drop-first (CLAUDE.md).
-- ============================================================================

alter table public.applications
  add column if not exists access_token uuid not null default gen_random_uuid();

drop function if exists public.get_application_status(text);
create or replace function public.get_application_status(p_ref text)
returns table (
  found boolean, full_name text, programme text, stage text,
  reference text, amount_due numeric, approval_letter_path text,
  proof_submitted boolean, proof_amount numeric, access_token text
) language plpgsql stable security definer set search_path = public as $$
declare v_app public.applications; v_prog text; v_by_email boolean;
begin
  select a.* into v_app from public.applications a
   where upper(a.reference) = upper(trim(p_ref))
      or lower(a.email)     = lower(trim(p_ref))
   order by a.created_at desc limit 1;

  if v_app.id is null then
    return query select false, null::text, null::text, null::text,
                        null::text, null::numeric, null::text, false, null::numeric, null::text;
    return;
  end if;

  -- Only release the letter token when the lookup proved the email — a guessed
  -- reference must not be enough to download the official letter PDF.
  v_by_email := lower(trim(p_ref)) = lower(v_app.email);

  select p.name || coalesce(' (' || p.level || ')', '')
    into v_prog from public.programmes p where p.id = v_app.programme_id;

  return query select
    true, v_app.full_name, v_prog, v_app.stage::text, v_app.reference,
    case when v_app.stage in ('approved','paid') then v_app.amount_due else 0 end,
    case when v_app.stage in ('approved','paid','enrolled') then v_app.approval_letter_path else null end,
    (v_app.proof_path is not null), v_app.proof_amount,
    case when v_by_email and v_app.stage in ('approved','paid','enrolled')
         then v_app.access_token::text else null end;
end;
$$;
grant execute on function public.get_application_status(text) to anon, authenticated;

notify pgrst, 'reload schema';
