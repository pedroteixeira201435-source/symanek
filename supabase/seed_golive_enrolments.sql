-- ============================================================================
-- GO-LIVE ENROLMENTS (idempotent, applied directly — NOT in the migration chain).
-- The 24 real January-2026 Auxiliary Nursing students seeded in seed_golive.sql
-- exist but have no enrolments. This enrols every student on the Auxiliary
-- Nursing programme into every Auxiliary Nursing course/module.
--
-- Generic + safe to re-run: it matches students by their programme (so future
-- Auxiliary Nursing intakes are covered on re-run) and skips existing rows.
-- No charge is assessed here — tuition is invoiced from the Suite (Finance) so
-- no fabricated money enters the ledger.
--
-- Apply after seed_golive.sql, e.g. (local container):
--   docker exec -i supabase_db_symanek_college psql -U postgres -d postgres \
--     -f - < supabase/seed_golive_enrolments.sql
-- ============================================================================

insert into public.enrolments (tenant_id, student_id, course_id, semester, status, charge)
select s.tenant_id, s.id, c.id, c.semester, 'registered', 0
from public.students s
join public.programmes p
  on p.id = s.programme_id and p.slug = 'certificate-auxiliary-nursing-science'
join public.courses c
  on c.programme_id = p.id
where s.status = 'enrolled'
  and not exists (
    select 1 from public.enrolments e
    where e.student_id = s.id and e.course_id = c.id
      and coalesce(e.semester,'') = coalesce(c.semester,'')
  );
