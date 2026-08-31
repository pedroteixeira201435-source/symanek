-- Students can read their own sponsorship/funding records in the portal.
-- Both sponsor_claims and sponsors had RLS enabled but NO read policy, so the
-- "Funding & sponsorships" panel in the Student Portal always showed nothing.
-- Mirror the invoices/holds owner-read pattern (scoped by students.user_id).
-- Idempotent: drop-then-create so re-running the migration is safe.

drop policy if exists "sponsor_claims owner read" on public.sponsor_claims;
create policy "sponsor_claims owner read" on public.sponsor_claims for select
  using (exists (
    select 1 from public.students s
    where s.id = sponsor_claims.student_id and s.user_id = auth.uid()
  ));

-- The portal joins sponsors(name, type); let a student read the sponsors that
-- are referenced by their own claims (and nothing else).
drop policy if exists "sponsors owner read" on public.sponsors;
create policy "sponsors owner read" on public.sponsors for select
  using (exists (
    select 1 from public.sponsor_claims c
    join public.students s on s.id = c.student_id
    where c.sponsor_id = sponsors.id and s.user_id = auth.uid()
  ));
