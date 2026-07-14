-- Local dev seed (demo applications). Runs on `supabase db reset` AFTER
-- seed_programmes.sql (order set in config.toml [db.seed].sql_paths).
-- Programmes themselves come from seed_programmes.sql (auto-generated from lib/content.ts).

-- Keep the reference counter ahead of the demo references below.
insert into public.reference_counters (year, last_seq) values (2026, 43)
  on conflict (year) do update set last_seq = greatest(public.reference_counters.last_seq, 43);

-- Demo applications so the Student Portal is explorable before real data exists.
insert into public.applications
  (reference, full_name, email, phone, programme_id, programme_slug, mode, stage, amount_due, approval_letter_path)
select 'SYM-2026-0042', 'Gabriel Naruseb', 'gabriel@example.com', '+264 81 000 0042',
       p.id, p.slug, 'full_time', 'approved', p.fee, 'approval-letters/SYM-2026-0042.pdf'
from public.programmes p where p.slug = 'certificate-ohs-level-4'
on conflict (reference) do nothing;

insert into public.applications
  (reference, full_name, email, phone, programme_id, programme_slug, mode, stage, amount_due, approval_letter_path)
select 'SYM-2026-0043', 'Maria Shikongo', 'maria@example.com', '+264 81 000 0043',
       p.id, p.slug, 'full_time', 'enrolled', 0, 'approval-letters/SYM-2026-0043.pdf'
from public.programmes p where p.slug = 'certificate-caregiving'
on conflict (reference) do nothing;
