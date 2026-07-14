# Symanek Specialized College — Public Website

Rebuild of [symanekacademy.com](https://symanekacademy.com) as a modern, fast public site
(**Option A**: separate Next.js app, aligned with the future Supabase backend in `../BACKEND.md`).

Built applying two design skills: **emil-design-eng** (motion/craft) + **apple-design**
(fluid interfaces, materials, typography).

## Run

```bash
npm run dev      # dev server
npm run build    # production build (verification step) — currently green, 70 static pages
npm run start    # serve the production build
```

Node 18 on this machine. The parent path has a space (`…/symanek college`) — quote it in the shell.

## Structure

- `lib/content.ts` — **single source of truth** for all copy/programmes/fees/contacts.
  Content is REAL, extracted from the live site (see `CONTENT-SOURCE.md`). Do not invent data here.
- `lib/api.ts` — data-access seam (`API_MODE = mock | supabase`). Mock today; Phase 2 swaps the
  bodies for Supabase (`submitApplication`, `submitContact`, `lookupApplication`) — no component changes.
- `app/` — routes: `/`, `/about`, `/programmes`, `/programmes/[category]`, `/course/[slug]`,
  `/gallery`, `/contact`, `/apply`, `/portal`.
- `components/` — header (translucent nav), footer, reveal-on-scroll, forms, programme cards, icons.

## The admissions flow (built into the UI, server-authoritative in Phase 2)

Apply (`/apply` → `applications`) → admin approves in the Symanek Suite → a **reference code
`SYM-YYYY-NNNN`** + approval-letter PDF are issued → applicant tracks status at `/portal`,
downloads the letter, and pays fees by **EFT using the reference** → admin marks paid → the
Student Portal unlocks. No payment gateway — EFT is reconciled manually by reference.

Demo portal references (mock mode): `SYM-2026-0042` (approved), `SYM-2026-0043` (enrolled).

## Assets

Real logo + photos copied from the live site into `public/images/`.
