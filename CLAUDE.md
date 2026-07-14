# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Symanek Suite** — a front-end-only, clickable prototype of a **university/tertiary management SaaS**
for private Namibian higher-education institutions (demo tenant: Symanek Specialized College, Semester 2
2026). Built for client presentation: **no backend, no persistence** — all data is mock and every "save"
is local React state + a toast. Do not add a real backend/auth/network calls unless explicitly asked;
that is the deliberate Phase-2 boundary (see **BACKEND.md** for the migration plan and `src/api.js`/
`src/config.js` for the seam already staged for it).

It began as a K-12 school prototype and was converted to higher education: student portal, admissions,
NQF programmes/curriculum, exam board, degree audit, graduation/clearance, accommodation, LMS, and
Namibian tax/compliance. Nomenclature is now university (Students/Programmes/Semesters/Credits/GPA), not
school (avoid reintroducing "learner/grade/guardian/term" in UI copy).

## Commands

```bash
npm run dev      # Vite dev server (usually: npm run dev -- --port 5199)
npm run build    # production build — the verification step (no tests/lint configured)
node --check src/<file>.js   # syntax-check a standalone module (e.g. api.js)
```

- **Node 18** on this machine — Vite is pinned to v5 (Vite 6+ needs Node 20). Don't bump Vite.
- Path contains a space (`…/symanek college`) — quote it in shell commands.
- Visual check: `firefox --headless --profile /tmp/ffprof-sym --screenshot out.png --window-size 1440,900 "http://localhost:5199/#student"` (temp profile required; the user's Firefox is running). Headless Firefox can be flaky here (GLX/framebuffer errors); if screenshots fail, fall back to `npm run build` + static/grep verification.
- Deep-link any role via URL hash: `#admin`, `#bursar`, `#hr`, `#teacher`, `#seller`, `#librarian`, `#student`, `#registrar`, `#applicant` (and `#admin/accounting` to open a module).

## Architecture

No router, no state library, no CSS framework. Layers:

1. **`src/App.jsx`** — role picker (login). `ROLES` (in `data.js`) drives everything; the grid renders
   automatically from it, so a new role only needs a `ROLES` entry + a stroke SVG in `ROLE_ICONS`.
   **Invariant:** the `seller` role never mounts Shell — it routes straight to fullscreen `POS.jsx`.
2. **`src/Shell.jsx`** — sidebar + topbar chrome, and the access-control registries at the top:
   - `MODULES`: id → {label, icon, group, comp, subtitle, count}
   - `ROLE_NAV`: role id → ordered module ids (**this IS the access control**)
   - `SEARCH_INDEX`: global search rows, filtered to the role's nav
   - **Multi-tenant filter:** `INSTITUTION_HIDE[getInstType()]` (from `data.js`, backed by
     `localStorage['sym.insttype']`) removes modules per institution type — e.g. "Distance / open
     learning" hides `accommodation` + `canteen`. Set from the **Compliance** module (writes localStorage
     + `window.location.reload()`).
   - `isStudent` (student **or** applicant) hides the staff-oriented Messages/Notifications dropdowns.
   - `goTo(mod, payload)` is the only navigation path; it refuses modules outside the role's nav. The
     `payload` lands in the module as a `focus` prop (searching a student opens their Student 360°).
3. **`src/modules/*.jsx`** — one self-contained file per module (own tabs + local state). Cross-tab
   state that must stay consistent is lifted to the module's parent (e.g. `StudentPortal` lifts
   `registered` so Registration charges flow into My Finance; Finance lifts payments/expenses; Library
   lifts books/loans/fines).

**`src/data.js`** — the single mock database (all datasets + `fmtN()` + `gradeOf()` + PAYE/tax helpers).
**Datasets join by student NAME**, not id (e.g. `INVOICES.learner === "Gabriel !Naruseb"`) — deliberately
cross-linked so Student 360° and the Student Portal can assemble one student's file. This name-join is
the main tech debt the backend must replace with `student_id` FKs (noted in `api.js`/BACKEND.md). The
demo student for `#student` is **Gabriel !Naruseb** (CVT-4), chosen for maximal dataset coverage.

**`src/ui.jsx`** — shared primitives: `StatCard`, `Tabs`, `Panel`, `Badge`, `Progress`, `Avatar`,
`Modal`, `Donut`, `Toast` + `useToast()`. Reuse these; every flow follows table/row → `Modal` → state
update → toast.

**`src/api.js` + `src/config.js`** — the Phase-2 seam (async data layer + `API_MODE='mock'|'http'`
switch). **Not yet wired** — modules still import `data.js` directly; migrating them to `api.js` is the
first Phase-2 step. Keep new data access going through `api.js` where practical.

## Design system (`src/styles.css`)

- Institutional steel-blue theme (corporate; the client rejected the earlier warm/amber look).
- Keyed on CSS variables in `:root`. **Naming quirk:** `--petrol-*` is the steel-blue scale and
  `--amber` is now the **blue accent** (real amber survives only in `.banner`). Don't "fix" the names.
- Emojis are icons rendered monochrome via `.gs`; exception: **POS food emojis** keep color. The login
  uses inline **stroke SVG icons** (`ROLE_ICONS`) — no emojis there by client request.
- Fonts: Inter everywhere + JetBrains Mono for numbers (class `mono`). Charts are dependency-free (CSS
  bars, conic-gradient `Donut`, hand-rolled SVG).
- Timetables use `<TimetableGrid data={...}>` (exported from `Scheduling.jsx`); grid data is
  `{P1..P6: [Mon..Fri slots]}` where a slot is `{s, r}` or null; `PERIODS` includes `BRK`.

## Domain conventions

- Currency N$ via `fmtN()`; UI copy is English. Compliance anchors: **NamRA** (tax), **NCHE**/NQA/NTA
  (higher-ed accreditation/returns), **Labour Act 2007** (PAYE/SSC in payroll).
- Academic calendar is **semesters** (S1/S2), marks are **continuous assessment** (CA), final =
  `0.4*CA + 0.6*exam`; do not reintroduce school "terms".
- "Today" in the demo is fixed around 3 Jul 2026 (topbar, Library fines, POS shift) — keep new dates in
  that window.
- Rules demonstrated in-UI that are **server-authoritative in Phase 2**: registration engine
  (holds → prereq → capacity/waitlist → credit cap → charge), financial holds, graduation clearance
  (derived from invoices/loans/results), NamRA tax. Keep these coherent across modules.
- When adding mock rows, reuse existing student names or add to **all** relevant datasets, and keep
  headline numbers reconciled (`SCHOOL.learners`, `ENROLMENT_BY_GRADE`, `FEE_STRUCTURE`,
  `PROGRAMMES.enrolled` currently agree — 476 total).
