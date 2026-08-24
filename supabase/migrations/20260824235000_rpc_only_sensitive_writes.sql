-- ============================================================================
-- Enforce RPC-only writes on the audit-sensitive tables (students, staff, payments).
--
-- The Suite already writes these tables ONLY through SECURITY DEFINER RPCs
-- (student_upsert / student_archive, staff_upsert, mark_paid / pay_invoice /
-- confirm_invoice_payment) — verified: no module issues a raw insert/update/delete
-- against them. But the earlier privilege-separation policies were `FOR ALL`, which
-- also PERMITTED the owning role to raw-write directly. That is a defense-in-depth
-- gap: a compromised registrar/bursar/hr token could bypass an RPC's validation and
-- audit context and write the table straight from the client.
--
-- Here we downgrade those write policies to SELECT-only and revoke direct DML, so
-- every write MUST go through a SECURITY DEFINER RPC (which runs as the function
-- owner and bypasses RLS, so the sanctioned path is unaffected). Reads are preserved.
-- ============================================================================

-- students: drop the registrar write policy, keep registrar SELECT (owner-read and
-- admin-read policies are left intact).
drop policy if exists "students registrar write" on public.students;
create policy "students registrar read" on public.students
  for select using (public.has_suite_role('registrar'));

-- payments: drop the bursar write policy, keep bursar SELECT.
drop policy if exists "payments bursar write" on public.payments;
create policy "payments bursar read" on public.payments
  for select using (public.has_suite_role('bursar'));

-- staff: drop the hr write policy, keep hr SELECT.
drop policy if exists "staff hr write" on public.staff;
create policy "staff hr read" on public.staff
  for select using (public.has_suite_role('hr'));

-- Belt-and-suspenders: strip direct DML grants. RLS already governs, but Supabase's
-- default table grants are permissive. SECURITY DEFINER RPCs are unaffected (owner
-- rights); the app only SELECTs these tables directly.
revoke insert, update, delete on public.students, public.staff, public.payments
  from authenticated, anon;

notify pgrst, 'reload schema';
