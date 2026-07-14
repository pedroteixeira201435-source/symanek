-- ============================================================================
-- Symanek Suite — manual EFT proof of payment for tuition invoices (Phase 2).
-- Aligns the Suite with the public site's model: the student uploads a proof
-- (file + amount) against an invoice -> it sits PENDING (balance unchanged) ->
-- a staff member confirms it -> balance is reduced and financial holds release.
-- ============================================================================

alter table public.invoice_payments
  add column if not exists status     text not null default 'confirmed'
                                       check (status in ('pending', 'confirmed', 'rejected')),
  add column if not exists proof_path text;

-- authenticated students may upload their proof files (read/manage stays admin)
drop policy if exists "payment-proofs auth upload" on storage.objects;
create policy "payment-proofs auth upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs');

-- Student: submit a proof against their own invoice (does NOT change the balance).
create or replace function public.submit_invoice_proof(
  p_invoice_id uuid, p_amount numeric, p_path text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_student public.students; v_inv public.invoices; v_id uuid;
begin
  select * into v_student from public.students where user_id = auth.uid();
  if v_student.id is null then
    return jsonb_build_object('ok', false, 'code', 'no_student', 'message', 'No student record for this account.');
  end if;
  select * into v_inv from public.invoices where id = p_invoice_id;
  if v_inv.id is null or v_inv.student_id <> v_student.id then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'Invoice not found on your account.');
  end if;
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'code', 'bad_amount', 'message', 'Enter the amount you paid.');
  end if;

  insert into public.invoice_payments (invoice_id, amount, method, ref, status, proof_path)
  values (v_inv.id, p_amount, 'EFT', 'PROOF-' || to_char(now(), 'YYYYMMDDHH24MISS'), 'pending', p_path)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'code', 'submitted', 'id', v_id,
    'message', 'Proof of payment submitted — the bursar will confirm it shortly.');
end $$;
grant execute on function public.submit_invoice_proof(uuid, numeric, text) to authenticated;

-- Staff: confirm a pending proof -> reduce balance + auto-release financial holds.
create or replace function public.confirm_invoice_payment(p_payment_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_pay public.invoice_payments; v_inv public.invoices; v_open numeric; v_released int := 0;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select * into v_pay from public.invoice_payments where id = p_payment_id;
  if v_pay.id is null then return jsonb_build_object('ok', false, 'message', 'Payment not found.'); end if;
  if v_pay.status <> 'pending' then
    return jsonb_build_object('ok', false, 'code', v_pay.status, 'message', 'This proof is already ' || v_pay.status || '.');
  end if;

  select * into v_inv from public.invoices where id = v_pay.invoice_id for update;

  update public.invoice_payments set status = 'confirmed' where id = p_payment_id;
  update public.invoices
    set balance = greatest(balance - v_pay.amount, 0),
        status  = case when balance - v_pay.amount <= 0 then 'paid' else 'part' end
  where id = v_inv.id;

  select coalesce(sum(balance), 0) into v_open from public.invoices where student_id = v_inv.student_id;
  if v_open <= 0 then
    update public.holds set active = false
     where student_id = v_inv.student_id and active and type = 'financial';
    get diagnostics v_released = row_count;
  end if;

  return jsonb_build_object('ok', true, 'code', 'confirmed', 'amount', v_pay.amount,
    'holds_released', v_released, 'message', 'Payment confirmed.');
end $$;
grant execute on function public.confirm_invoice_payment(uuid) to authenticated;

-- Staff: list pending proofs for review (student, invoice, amount).
create or replace function public.pending_payment_proofs()
returns table (payment_id uuid, student text, invoice_id uuid, amount numeric,
               proof_path text, invoice_balance numeric, submitted_at timestamptz)
language sql stable security definer set search_path = public as $$
  select ip.id, s.full_name, i.id, ip.amount, ip.proof_path, i.balance, ip.created_at
  from public.invoice_payments ip
  join public.invoices i on i.id = ip.invoice_id
  join public.students s on s.id = i.student_id
  where ip.status = 'pending' and public.is_admin()
  order by ip.created_at;
$$;
grant execute on function public.pending_payment_proofs() to authenticated;
