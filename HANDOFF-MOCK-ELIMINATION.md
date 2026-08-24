# HANDOFF — Eliminação de mock / produção (Symanek Suite)

**Última sessão: 2026-08-24.** Plano: `~/.claude/plans/snuggly-questing-lynx.md` (7 fases).
Objetivo: zero dados mock; arrancar VAZIO mas 100% funcional (CRUD real que persiste no Supabase).
Restrição: **NÃO tocar na cloud** — só preparar migrações/scripts; o Pedro aplica.

## ⚠️ ESTADO DO BUILD: VERMELHO (arranca já por aqui)

`npm run build` falha em `src/modules/StudentPortal.jsx`:
- **Linha 7:** `import { TimetableGrid } from './Scheduling.jsx'` — `TimetableGrid` já **NÃO existe**
  (removido no rewrite do Scheduling). **É o bloqueio do build.**
- **Linha 338:** `<TimetableGrid data={MY_TT} />` usa grid mock `MY_TT`.
- **Linha 3:** `import { COURSES, EXAM_BOARD, gradeOf, fmtN } from '../data.js'` — trocar por
  `gradeOf` de `../lib/academics.js`, `fmtN` de `../lib/format.js`; largar `COURSES`/`EXAM_BOARD` (já vêm da API).

**Próximo passo imediato:** reescrever `StudentPortal.jsx` — remover import de `TimetableGrid` e o
separador de horário mock (ou ligar a `api.listTimetable()`); tirar import de `../data.js`. Build volta a verde.

## FEITO (não repetir)
- **Backend/migrações CRIADAS** (não aplicadas na cloud): `supabase/migrations/`
  `20260824130000_purge_demo_slice`, `140000_business_settings`, `160000_library_crud`,
  `170000_hr_payroll`, `180000_finance_crud`, `190000_accounting_assets`, `200000_canteen_pos`,
  `210000_scheduling`, `220000_accommodation_compliance`, `230000_dashboard_academics`.
  + `supabase/seed_golive_enrolments.sql` (matricula os 24 alunos reais de Aux-Nursing).
- **Seam:** `src/api.js` — bloco "DOMAIN CRUD" (~70 wrappers), helpers `rows()/one()/call()`,
  `getBusinessSettings/setBusinessSetting`; ramos mock passam a devolver `[]`/`null`.
  `listProgrammes` corrigido para ler o catálogo real (`.neq('category','suite-demo')`).
- **lib:** `src/lib/format.js` (`fmtN`, `staffEmail`); `src/lib/academics.js` (grade bands editáveis:
  `setGradeBands`, `gradeOf` itera `_bands`). `App.jsx` faz boot das bands.
- **Módulos JÁ reescritos** (backend + empty-state + CRUD, sem `data.js`):
  Library, Dashboard, Accommodation, Compliance, CanteenAdmin, Accounting, Scheduling, **TeacherPortal**.

## POR FAZER — Fase 4: cutover dos 12 módulos que ainda importam `data.js`
Confirmado por `grep -rn "from '../data" src/`:
1. **StudentPortal** ← FIX BUILD PRIMEIRO (ver acima)
2. HR (`STAFF, LEAVE_*, PAYROLL, CONTRACTS, QUALIFICATIONS, RECRUITS, WORKLOAD, PAYE_*, payeMonthly, sscMonthly, VET_LEVY_RATE`)
3. Finance (`FIN_STATS, EXPENSE_BREAKDOWN, COLLECTION_BY_BAND, INVOICES, FEE_STRUCTURE, PAYMENTS, DEBTORS, SPONSORS, BUDGET`)
4. Students (`SCHOOL, LEARNERS, INVOICES, GRADEBOOKS, LOANS, INCIDENTS, HOLDS`)
5. Admissions (`APPLICANTS, ADMISSION_STAGES, INTAKES, PROGRAMMES`)
6. Programmes (`PROGRAMMES, COURSES, HOLDS, DEGREE_AUDIT, STAFF`)
7. Academics (`MODERATION, AT_RISK, PROGRAMMES`)
8. Courseware (`COURSES, COURSEWARE, COURSE_RESULTS, DEGREE_AUDIT`)
9. Exams (`EXAM_SCHEDULE`)
10. Settings (`SCHOOL, ROLES, AUDIT_LOG, BP_DEFS, staffEmail`) — inclui aba **Business rules** (grade bands editáveis)
11. POS (`POS_PRODUCTS, POS_CATS, SCHOOL, STUDENT_ACCOUNTS`)
12. ApplyOnline (`PROGRAMMES, ADMISSION_STAGES`) — já redireciona em http; limpar imports

Padrão por módulo: trocar `../data` por `../api` + `../lib/*`; leituras → `useEffect` async com
loading/erro/empty-state; adicionar Add/Edit/Delete via `Modal` ligados aos RPCs. Verificar `npm run build` a cada 1-3.

## POR FAZER — Fases 5-7
- **F5:** mover restantes helpers p/ `src/lib/`; desmamar `App/Shell/auth` de `SCHOOL/ROLES/INSTITUTION_HIDE/getInstType`;
  **apagar `src/data.js`**; garantir `grep -rn "from '../data" src/` = 0; `config.js` prod só http.
- **F6:** `supabase/golive/provision_accounts.sh` + atualizar `GO-LIVE-CHECKLIST.md` (NÃO executar).
- **F7:** estender `supabase/tests/rls_rpc.test.sql`; `npm run build` (Suite + `site-publico/`); `node --check`.

## Verificação final
`npm run build` (raiz + site-publico) verde · `grep -rn "from '../data" src/` = 0 · empty-state + Add funcional por módulo.

## Bloqueado no cliente/Pedro (documentar, não inventar)
Valores exatos dos grade bands · emails dos 4 docentes · rosters dos outros cursos · `public/stamp.png` ·
**aplicar migrações na cloud + criar contas + `retire_demo_accounts.sql` + PITR + rodar password** (só o Pedro).
