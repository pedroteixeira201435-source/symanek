# Backend integration tests

`rls_rpc.test.sql` asserts the security + flow guarantees that RLS/RPC unit
review can't easily catch:

- **RLS privilege separation** — each `suite_role` may write only its own tables
  (bursar↔payments, registrar↔students, hr↔staff, teacher↔assignments…), admin
  passes everything, `audit_log` is write-protected, students aren't anon-readable.
- **Applicant flow** — `submit_application` (anon) → `approve_application` (admin,
  assigns `SYM-…` + student) → `mark_paid` (enrols).
- **Letter token gating (A1)** — `get_application_status` hides the letter token
  on a reference lookup and releases it on an email lookup.
- **Audit trigger** — a payment writes an `audit_log` row.

The script runs inside a transaction that is **rolled back**, so it never leaves
test data behind.

## Run

```bash
./supabase/tests/run.sh          # against the local Supabase container
```

Prerequisites: `supabase start` running, the 9 demo accounts (`seed_auth.sh`)
and seed programmes loaded. Exit code 0 = all passed.
