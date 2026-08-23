# Disaster-recovery runbook — Symanek backend

Cloud project: `zbtxhyxwtemproeomtzu` (eu-north-1). Two layers of protection:

## 1. Supabase platform backups (primary)
- **Daily automated backups** are taken by Supabase on paid plans. **Point-in-Time
  Recovery (PITR)** can be enabled per project — do so once real cohorts are live.
  - Enable/verify: Dashboard → Project → **Database → Backups**. Turn on PITR;
    confirm the retention window (7 days is a sensible start).
- **Restore:** Dashboard → Database → Backups → pick a timestamp → *Restore*.
  This restores the **whole cluster** (incl. `auth.users`). Restoring is
  destructive to current data — always take a fresh logical dump first (below).

## 2. Logical backups (portable, off-platform copy)
Independent of the platform, in case the project is lost or you need a copy
outside Supabase. Uses the local container's `pg_dump` (no host tools needed).

```bash
# Local dev DB
./supabase/backups/backup.sh

# Cloud (Session-pooler string, sslmode=require)
SUPABASE_DB_URL='postgresql://postgres.zbtxhyxwtemproeomtzu:<PWD>@aws-0-eu-north-1.pooler.supabase.com:5432/postgres?sslmode=require' \
  ./supabase/backups/backup.sh
```

Dumps land in `supabase/backups/dumps/` (gitignored — **never commit dumps**;
they contain student PII). Keep them in a private, access-controlled store.
Recommended cadence: **daily automated (platform) + weekly logical dump** copied
off-site, plus a logical dump immediately before any risky migration.

Scope: the dump is `--schema=public` (all app tables + data). Supabase-managed
schemas (`auth`, `storage`) are **not** in it — the platform backup / PITR covers
those. Real auth accounts are re-created from Supabase Auth, not this dump.

### Restore a logical dump

```bash
# To local:
gunzip -c supabase/backups/dumps/symanek-<...>.sql.gz \
  | docker exec -i supabase_db_symanek_college psql -U postgres -d postgres

# To a fresh/cloud project (via the container's psql, pooler URL):
gunzip -c symanek-<...>.sql.gz \
  | docker exec -i supabase_db_symanek_college psql "$SUPABASE_DB_URL"
```

The dump uses `--clean --if-exists`, so it drops+recreates the public objects
before loading — restore into an empty or known-state target. After restore run
`notify pgrst, 'reload schema';` so PostgREST picks up the schema.

## 3. Verification checklist (do quarterly)
- [ ] PITR is ON and the retention window is as expected.
- [ ] A logical dump completes and is > 0 bytes, and `gunzip -t` passes.
- [ ] A **test restore** into a scratch/local DB succeeds and
      `./supabase/tests/run.sh` passes against it.
- [ ] Off-site dump copy is current and access-controlled.

## 4. Rotate credentials after any exposure
The DB password and service-role key are the crown-jewel secrets. Rotate the DB
password (Dashboard → Database → **Reset database password**) after anyone shares
a connection string, and update it wherever it's stored (never in git).
