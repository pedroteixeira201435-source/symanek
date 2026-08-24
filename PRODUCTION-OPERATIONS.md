# Production operations — required external actions

These actions require access to Vercel, Supabase, Cloudflare and the college's
private document store; they cannot be safely completed from the repository.

## Before Release 1

1. In Cloudflare Turnstile, create a production widget for the final domain and
   add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in Vercel.
2. Set all variables from `site-publico/.env.example` in Vercel Production.
   `SUPABASE_SERVICE_ROLE_KEY` and `TURNSTILE_SECRET_KEY` must never use a
   `NEXT_PUBLIC_` prefix.
3. Enable Supabase PITR, schedule encrypted off-site logical backups, and test
   a restore into a separate project at least quarterly.
4. Configure error tracking and uptime probes for `/`, `/apply`, `/portal`,
   `/admin`, `/api/public/application` and `/api/payment-proof`.

## Before Release 2

1. Create real staff and student accounts, assign `suite_role`, link each
   student to `students.user_id`, and require a password reset on first login.
2. Verify a real admin can sign in, then run
   `supabase/golive/retire_demo_accounts.sql` exactly once.
3. Obtain written grade boundaries and update `business_settings.grade_bands`;
   do not issue Statements of Result before that approval.
4. Rotate the database password and any key previously shared outside the
   secret manager.

## Privacy and retention

- Store rosters, scans, PDFs and payment proofs in private managed storage,
  not Git. Keep only anonymized fixtures in source control.
- Limit proof/document access to admissions and bursar staff; use short-lived
  signed URLs and retain documents only for the period required by policy.
- Record incidents, revoke affected credentials, preserve audit evidence and
  notify the college's designated privacy contact under its legal obligations.

## Deploy runbook (avoid cross-deploys)

Two Vercel projects, one GitHub repo. Each project builds from its own root:

| App          | Vercel project   | Root directory  | `.vercel/project.json` |
| ------------ | ---------------- | --------------- | ---------------------- |
| Public site  | `symanek-site`   | `site-publico`  | `site-publico/.vercel` |
| Suite        | `symanek-suite`  | `.` (repo root) | `.vercel` (repo root)  |

- **Preferred path = Git push.** Each project auto-builds only its own root
  directory, so a push to `main` deploys both correctly. Keep `symanek-site`'s
  Root Directory = `site-publico` in the Vercel dashboard (a wrong root causes
  `404` on `/api/public/*`).
- **CLI danger.** The repo root is linked to `symanek-suite`. Running
  `vercel --prod` from the repo root deploys the **Suite**, never the site.
  - Deploy the **Suite**:  `npx --yes vercel --prod --token "$VERCEL_TOKEN"` (from repo root)
  - Deploy the **site**:   `cd site-publico && npx --yes vercel --prod --token "$VERCEL_TOKEN"`
- The CLI deploys the **local working tree**, not the remote. Commit and push
  first, otherwise the next Git-triggered build reverts to the old committed code.
