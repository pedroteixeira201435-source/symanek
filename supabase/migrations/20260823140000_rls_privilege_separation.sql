-- ============================================================================
-- Symanek — Phase A security A3: real RLS privilege separation by suite_role.
--
-- Before: is_admin() = role in ('admin','staff') and nearly every write policy
-- used it, so ANY staff account (bursar, librarian, teacher…) could write
-- students, payments, results, staff directly at the API layer. suite_role was
-- never used in RLS. Role scoping existed only in the client nav (not a boundary).
--
-- This migration adds has_suite_role() and restricts WRITES on the crown-jewel
-- tables (money + official records + HR/PII) to the matching workspace, while
-- keeping staff READ broad (is_admin) and preserving students' owner-reads.
--
-- Safe because the Suite writes these tables ONLY through SECURITY DEFINER RPCs
-- (register_course, pay_invoice, mark_paid, publish_exam_results, …) which
-- bypass RLS; the sole direct sensitive write is the public /admin "reject"
-- (applications), which an admin/registrar still satisfies.
--
-- Scope (this pass): payments, invoices, invoice_payments, applications,
-- students, results, staff. Remaining operational tables (accommodation,
-- sponsors, exam_sittings, HR contracts/payroll, compliance) still use the
-- broad admin policy — a documented follow-up.
--
-- Idempotent.
-- ============================================================================

-- admin always passes; otherwise the signed-in user's suite_role must match.
create or replace function public.has_suite_role(variadic p_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'admin' or suite_role = any(p_roles))
  );
$$;

-- ---- Finance (bursar) --------------------------------------------------------
drop policy if exists "payments admin all" on public.payments;
create policy "payments bursar write" on public.payments for all
  using (public.has_suite_role('bursar')) with check (public.has_suite_role('bursar'));
create policy "payments staff read" on public.payments for select using (public.is_admin());

drop policy if exists "invoices admin all" on public.invoices;
create policy "invoices bursar write" on public.invoices for all
  using (public.has_suite_role('bursar')) with check (public.has_suite_role('bursar'));
create policy "invoices staff read" on public.invoices for select using (public.is_admin());

drop policy if exists "invoice_payments admin all" on public.invoice_payments;
create policy "invoice_payments bursar write" on public.invoice_payments for all
  using (public.has_suite_role('bursar')) with check (public.has_suite_role('bursar'));
create policy "invoice_payments staff read" on public.invoice_payments for select using (public.is_admin());

-- ---- Admissions & student records (registrar) --------------------------------
drop policy if exists "applications admin all" on public.applications;
create policy "applications registrar write" on public.applications for all
  using (public.has_suite_role('registrar')) with check (public.has_suite_role('registrar'));
create policy "applications staff read" on public.applications for select using (public.is_admin());

drop policy if exists "students admin all" on public.students;
create policy "students registrar write" on public.students for all
  using (public.has_suite_role('registrar')) with check (public.has_suite_role('registrar'));
create policy "students staff read" on public.students for select using (public.is_admin());

-- ---- Academic results (registrar + teacher) ----------------------------------
drop policy if exists "results admin all"    on public.results;
drop policy if exists "results admin read"   on public.results;
drop policy if exists "results admin insert" on public.results;
drop policy if exists "results admin update" on public.results;
drop policy if exists "results admin delete" on public.results;
create policy "results academic write" on public.results for all
  using (public.has_suite_role('registrar','teacher')) with check (public.has_suite_role('registrar','teacher'));
create policy "results staff read" on public.results for select using (public.is_admin());

-- ---- Staff / HR & PII (hr) ---------------------------------------------------
drop policy if exists "staff admin all" on public.staff;
create policy "staff hr write" on public.staff for all
  using (public.has_suite_role('hr')) with check (public.has_suite_role('hr'));
create policy "staff staff read" on public.staff for select using (public.is_admin());

notify pgrst, 'reload schema';
