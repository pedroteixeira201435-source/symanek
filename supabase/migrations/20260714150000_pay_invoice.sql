-- ============================================================================
-- Symanek Suite — server-authoritative tuition payment (Phase 2 / B4)
-- The signed-in student pays their OWN invoice. Records the payment, reduces the
-- balance, and auto-releases financial holds once the total balance is clear
-- (BACKEND.md: financial holds created/released automatically by balance).
-- ============================================================================

create or replace function public.pay_invoice(
  p_invoice_id uuid, p_amount numeric, p_method text default 'EFT'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_student  public.students;
  v_inv      public.invoices;
  v_pay      numeric;
  v_open     numeric;
  v_released int := 0;
begin
  select * into v_student from public.students where user_id = auth.uid();
  if v_student.id is null then
    return jsonb_build_object('ok', false, 'code', 'no_student',
      'message', 'No student record is linked to this account.');
  end if;

  select * into v_inv from public.invoices where id = p_invoice_id;
  if v_inv.id is null or v_inv.student_id <> v_student.id then
    return jsonb_build_object('ok', false, 'code', 'not_found',
      'message', 'Invoice not found on your account.');
  end if;
  if v_inv.balance <= 0 then
    return jsonb_build_object('ok', false, 'code', 'settled',
      'message', 'This invoice is already settled.');
  end if;
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'code', 'bad_amount', 'message', 'Enter a valid amount.');
  end if;

  v_pay := least(p_amount, v_inv.balance);   -- never overpay a single invoice

  insert into public.invoice_payments (invoice_id, amount, method, ref)
  values (v_inv.id, v_pay, coalesce(p_method, 'EFT'), 'PAY-' || to_char(now(), 'YYYYMMDDHH24MISS'));

  update public.invoices
    set balance = balance - v_pay,
        status  = case when balance - v_pay <= 0 then 'paid' else 'part' end
  where id = v_inv.id;

  -- auto-release financial holds once the student's total balance is clear
  select coalesce(sum(balance), 0) into v_open from public.invoices where student_id = v_student.id;
  if v_open <= 0 then
    update public.holds set active = false
     where student_id = v_student.id and active and type = 'financial';
    get diagnostics v_released = row_count;
  end if;

  return jsonb_build_object(
    'ok', true, 'code', 'paid', 'paid', v_pay,
    'balance', v_inv.balance - v_pay, 'total_open', v_open, 'holds_released', v_released,
    'message', 'Payment of N$ ' || to_char(v_pay, 'FM999,999') || ' recorded'
      || case when v_released > 0 then ' — your financial hold has been released.' else '.' end);
end $$;

grant execute on function public.pay_invoice(uuid, numeric, text) to authenticated;
