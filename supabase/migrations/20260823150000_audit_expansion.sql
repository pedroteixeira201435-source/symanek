-- ============================================================================
-- Symanek — Phase A security A5: expand audit_log to the sensitive tables.
--
-- Until now only two functions wrote audit_log; payments, results, admissions
-- and student/staff CRUD went unaudited. Add a generic AFTER trigger that logs
-- every insert/update/delete on the money + official-record + PII tables, with
-- the real actor (auth.uid() resolves the caller even inside SECURITY DEFINER
-- RPCs). SECURITY DEFINER so the audit write itself is never blocked by RLS.
--
-- Idempotent.
-- ============================================================================

create or replace function public.audit_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_row jsonb; v_id text;
begin
  v_row := to_jsonb(case when TG_OP = 'DELETE' then OLD else NEW end);
  v_id  := coalesce(v_row->>'id', v_row->>'reference', '');
  insert into public.audit_log (user_id, action, entity)
  values (auth.uid(), TG_OP || ' ' || TG_TABLE_NAME, TG_TABLE_NAME || ':' || v_id);
  return case when TG_OP = 'DELETE' then OLD else NEW end;
end$$;

do $$
declare t text;
begin
  foreach t in array array[
    'payments','applications','students','results','invoices','invoice_payments','staff'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'trg_audit_' || t, t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.audit_change()',
      'trg_audit_' || t, t);
  end loop;
end $$;

notify pgrst, 'reload schema';
