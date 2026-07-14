# Deploy — Symanek public site (Vercel)

Backend is already **live** on Supabase cloud (`zbtxhyxwtemproeomtzu`): schema,
seeds, RPCs, RLS and the 9 demo auth accounts are all deployed and verified.
Only the frontend hosting remains.

## Env vars to set in Vercel (Project → Settings → Environment Variables)

| Name | Value | Exposed |
|------|-------|---------|
| `NEXT_PUBLIC_API_MODE` | `supabase` | browser |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://zbtxhyxwtemproeomtzu.supabase.co` | browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_yGOmYZdogELoA4souInSsA_jx24j8dg` | browser |
| `SUPABASE_URL` | `https://zbtxhyxwtemproeomtzu.supabase.co` | **server only** |
| `SUPABASE_SERVICE_ROLE_KEY` | *(the service_role key — see .env.production.local)* | **server only** |
| `NEXT_PUBLIC_SITE_URL` | your deployed URL, e.g. `https://symanek.vercel.app` | browser |

> `NEXT_PUBLIC_SITE_URL` is used to build the absolute portal link in the generated
> approval email. Set it after the first deploy gives you the domain, then redeploy.

## Two Vercel projects, one GitHub repo

Import `pedroteixeira201435-source/symanek` twice:

1. **Public website** — Root Directory = **`site-publico`** (Next.js, auto-detected). Env vars above.
2. **Management system (Suite)** — Root Directory = **`.`** (repo root). Uses the root `vercel.json`
   (Vite → `dist`). **No env vars needed** — the Suite runs in demo/mock mode by default
   (`VITE_API_MODE` unset ⇒ mock). Login is the on-screen role picker.

## Deploy (CLI, no git repo needed)

```bash
cd "…/symanek college/site-publico"
npx vercel login          # run once: ! npx vercel login   (in the Claude session)
npx vercel --prod         # builds + deploys this directory; add the env vars above when prompted or via dashboard
```

Or: Vercel dashboard → Add New → Project → import this folder (or push it to a
GitHub repo first) → add the env vars → Deploy. Framework auto-detects Next.js 14.

## Verify after deploy
1. Open the deployment URL → `/apply` → submit an application → success screen.
2. `/admin` → sign in `admin@symanek.local` / `symanek123` → Approve → Record EFT.
3. `/portal` → look up the reference → status + Download approval letter (PDF).

## Demo accounts (password `symanek123`)
admin@ · bursar@ · hr@ · teacher@ · librarian@ · registrar@ · seller@ ·
applicant@ · student@  (all `…@symanek.local`; student = Gabriel !Naruseb)
