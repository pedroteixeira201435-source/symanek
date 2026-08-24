# CODEX — Plano de migração dos 12 módulos da Suite (`data.js` → backend)

**Para:** agente Codex (OpenAI) que roda no terminal deste repo.
**Objetivo:** eliminar o mock dos **12 módulos** que ainda importam `../data.js`, ligando-os ao
backend real via `src/api.js`. Estado final: `grep -rn "from '../data" src/` = **0**, `src/data.js`
apagado, `npm run build` verde. Isto é o único trabalho de **código** que falta antes do go-live da Suite.

> **Contexto já resolvido (não repetir):** o build está VERDE, a camada `api.js` está **100% pronta**
> (78 wrappers, todos os RPCs existem nas migrações), e a segurança está limpa (service-role só server-side,
> zero segredos no Git). **Não há trabalho de backend a fazer nesta tarefa** — só front-end.

---

## 0. Regras de ouro (NÃO violar)

1. **NÃO tocar na cloud.** Não correr `supabase db push`, não criar contas, não aplicar migrações.
   As migrações e RPCs já existem no repo; o Pedro aplica-as. Tu só editas front-end.
2. **NÃO inventar API.** Só usar funções que **já existem** em `src/api.js` (lista na §3). Se um dataset
   não tiver wrapper nem RPC, **renderiza empty-state** — nunca fabriques dados nem inventes um RPC.
3. **NÃO adicionar imports de `../data.js`.** O objetivo é removê-los todos. `fmtN`/`staffEmail` vêm de
   `../lib/format.js`; `gradeOf`/grade bands de `../lib/academics.js`.
4. **Empty-by-default.** Em mock o seam devolve `[]`/`null` de propósito. É esperado que o módulo apareça
   vazio em mock — o teste real é: (a) `npm run build` verde, (b) empty-state limpo, (c) modais CRUD
   ligados aos wrappers certos. Não "consertes" o vazio com mock.
5. **Diff mínimo.** Mantém a mesma estrutura de props/`ctx` para os componentes-filho não partirem.
6. **Verifica a cada 1-3 módulos:** `npm run build`. Não acumules 12 módulos sem compilar.

## 1. Acessos e ambiente (o que tens / o que precisas)

- **Path do repo tem espaço** (`…/symanek college`) — **cita sempre** em comandos shell.
- **Node 18 + Vite 5.** NÃO subir o Vite (v6+ exige Node 20). Build: `npm run build` (é o único passo de
  verificação — não há testes nem lint configurados). Sintaxe de um ESM: `node --check src/ficheiro.js`.
- **Modo de teste:** o build corre em **mock** por default e devolve vazio — isso basta para validar
  compilação e empty-states. Não precisas de tokens de cloud para esta tarefa. Se quiseres exercer o
  caminho http, precisas de um Supabase **local** (`npx supabase start`) — **opcional**, e o
  `supabase db reset` costuma pendurar (workaround em `CLAUDE.md` → "Local-dev gotchas"). Não é preciso
  para entregar esta tarefa; o critério é build verde + padrão correto.
- **Deep-link de roles em mock** (para inspeção visual, `npm run dev`): hash na URL — `#admin`, `#bursar`,
  `#hr`, `#teacher`, `#seller`, `#librarian`, `#student`, `#registrar`, `#applicant`, `#admin/accounting`.
- **Tokens de cloud (Vercel/Turnstile):** NÃO precisas deles para esta tarefa. O deploy é passo
  operacional do Pedro. Aqui só existe um `VERCEL_OIDC_TOKEN` de curta duração — não uses.

### Credenciais do Supabase — onde estão (NÃO as copies para ficheiros rastreados)

A ligação ao backend **já existe** em ficheiros locais **gitignored**. Se precisares de correr em http,
**lê estes ficheiros diretamente** — não os cites em commits, não os copies para `.md`/código:

- **Suite** → `./.env.local` : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_MODE`
  (mudar para `http` liga a Suite ao Supabase configurado). A anon key respeita RLS — é o correto no cliente.
- **Site público (server)** → `./site-publico/.env.production.local` : `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  A **service-role key** só pode ser usada em rotas server (`app/api/*`) — **nunca** em código cliente
  nem colada em docs. Esta tarefa (Suite front-end) **não a usa**.

> **Regra de segurança:** os valores destas chaves **nunca** entram em ficheiros rastreados pelo Git
> (`.md`, `.jsx`, `.js`, seeds). Este próprio `CODEX-PLAN-SUITE-MIGRATION.md` **não é gitignored** — por
> isso não escrevas segredos aqui. Para esta tarefa, o build em **mock** basta; a cloud é opcional.

## 2. O PADRÃO (copiar deste ficheiro de referência)

**Referência canónica: `src/modules/Accommodation.jsx`** (já feito, limpo, com CRUD).
Módulos de referência adicionais já convertidos: `Library.jsx`, `Dashboard.jsx`, `Accounting.jsx`,
`CanteenAdmin.jsx`, `Scheduling.jsx`, `Compliance.jsx`, `TeacherPortal.jsx`.

Esqueleto exato a replicar:

```jsx
import React, { useState, useEffect, useCallback } from 'react'
import { StatCard, Panel, Badge, Modal, useToast } from '../ui.jsx'  // reutiliza primitivas de ui.jsx
import { fmtN } from '../lib/format.js'                              // NUNCA de ../data.js
import { listX, xUpsert, xDelete } from '../api.js'                  // só wrappers da §3

export default function Modulo() {
  const [toast, showToast] = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const reload = useCallback(() => Promise.all([
    listX().then(setRows).catch(() => setRows([])),
  ]), [])
  useEffect(() => { reload().finally(() => setLoading(false)) }, [reload])

  const add = async (e) => {
    e.preventDefault(); const f = e.target
    try { await xUpsert({ /* campos do form */ }) }
    catch (err) { showToast('Could not save' + (err?.message ? `: ${err.message}` : '')); return }
    setShowForm(false); await reload(); showToast('Saved')
  }
  const remove = async (r) => {
    try { await xDelete(r.id) } catch (err) { showToast('Could not delete: ' + err.message); return }
    await reload(); showToast('Removed')
  }

  if (loading) return <Panel title="…" flush><Empty>Loading…</Empty></Panel>
  // tabela/row → botão "+ Add" → <Modal> com <form onSubmit={add}> → toast
  // empty-state quando rows.length === 0
}
```

Regras do padrão: leituras top-level síncronas → **`useEffect` async** via `api.js`; **loading state**;
**empty-state** quando vazio; **Add/Edit/Delete** por `Modal` (de `src/ui.jsx`) → wrapper → `reload()` → toast.
Toda a UI reaproveita `src/ui.jsx` (`StatCard, Tabs, Panel, Modal, Donut, Badge, Progress, useToast`).

## 3. Mapa exato: cada módulo → funções `api.js` a usar

> Todas estas funções **já existem** em `src/api.js`. Import: `import { … } from '../api.js'`.
> `fmtN`, `staffEmail` → `../lib/format.js`. `gradeOf` → `../lib/academics.js`.

| # | Módulo | Import atual de `../data.js` | Substituir por (`api.js` / `lib`) |
|---|--------|------------------------------|-----------------------------------|
| 1 | **StudentPortal** | `COURSES, EXAM_BOARD, gradeOf, fmtN` | `listCourses`, `getResultsForStudent`/`listExamBoard`; `gradeOf`←lib/academics; `fmtN`←lib/format. (Horário: `listTimetable`.) |
| 2 | **HR** | `STAFF, LEAVE_REQUESTS, PAYROLL, LEAVE_BALANCES, CONTRACTS, QUALIFICATIONS, RECRUITS, RECRUIT_STAGES, WORKLOAD, PAYE_BRACKETS, payeMonthly, sscMonthly, VET_LEVY_RATE, staffEmail, fmtN` | `listStaff`, `listLeaveRequests`, `listPayroll`, `listLeaveBalances`, `getStaffDetail`(contratos/qualificações), `listRecruitment`, `listWorkload`; CRUD: `staffUpsert/staffDelete/contractSet/qualificationAdd/leaveBalanceSet/recruitUpsert/workloadSet/payrollRun`. `staffEmail/fmtN`←lib/format. **⚠ ver §4** p/ `payeMonthly/sscMonthly/PAYE_BRACKETS/VET_LEVY_RATE`. |
| 3 | **Students** | `SCHOOL, LEARNERS, INVOICES, GRADEBOOKS, LOANS, INCIDENTS, HOLDS, gradeOf, fmtN` | `getInstitution`(SCHOOL), `listStudents`(LEARNERS), `listInvoices`/`getInvoicesForStudent`, `getResultsForStudent`(GRADEBOOKS), `getHoldsForStudent`; `gradeOf`←lib/academics; `fmtN`←lib/format. **⚠ LOANS/INCIDENTS: ver §4.** |
| 4 | **Exams** | `EXAM_SCHEDULE` | `listExamSchedule` |
| 5 | **Settings** | `SCHOOL, ROLES, AUDIT_LOG, BP_DEFS, staffEmail` | `getInstitution`(SCHOOL), `listRolePermissions`(ROLES), `getBusinessSettings`(aba **Business rules** = grade bands editáveis, no lugar de BP_DEFS + `setBusinessSetting`); `staffEmail`←lib/format. **⚠ AUDIT_LOG: ver §4.** |
| 6 | **POS** | `POS_PRODUCTS, POS_CATS, SCHOOL, STUDENT_ACCOUNTS, fmtN` | `listCanteenProducts`(POS_PRODUCTS; deriva POS_CATS do campo categoria), `listCanteenAccounts`(STUDENT_ACCOUNTS), `getInstitution`(SCHOOL); `fmtN`←lib/format. Venda: `canteenRecordSale`. |
| 7 | **Finance** | `FIN_STATS, EXPENSE_BREAKDOWN, COLLECTION_BY_BAND, INVOICES, FEE_STRUCTURE, PAYMENTS, DEBTORS, SPONSORS, BUDGET, fmtN` | `getFinanceStats`, `listExpenseBreakdown`, `listCollectionByProgramme`(COLLECTION_BY_BAND), `listInvoices`, `listFeeStructures`, `listDebtors`, `listBudgets`; pagamentos: `listPendingProofs`+`confirmInvoicePayment`(aba Payments); SPONSORS→`getSponsorsForStudent`; `fmtN`←lib/format. CRUD: `invoiceCreate/feeStructureSet/budgetSet/expenseRecord`. |
| 8 | **ApplyOnline** | `PROGRAMMES, ADMISSION_STAGES` | Já redireciona em http — só **limpar imports**; se precisar da lista: `listProgrammes`. |
| 9 | **Programmes** | `PROGRAMMES, COURSES, HOLDS, DEGREE_AUDIT, STAFF, fmtN` | `listProgrammes`, `listCourses`, `getHoldsForStudent`, `getDegreeAudit`, `listStaff`; `fmtN`←lib/format. CRUD: `programmeUpsert/programmeSetActive/courseUpsert/courseDelete`. |
| 10 | **Admissions** | `APPLICANTS, ADMISSION_STAGES, INTAKES, PROGRAMMES` | `listApplicants`, `listProgrammes`. **⚠ INTAKES/ADMISSION_STAGES: ver §4** (config estática vs backend). |
| 11 | **Courseware** | `COURSES, COURSEWARE, COURSE_RESULTS, DEGREE_AUDIT` | `listCourses`, `listCourseware`, `getCourseResults`, `getDegreeAudit`; CRUD: `coursewareUpsert/coursewareDelete`. |
| 12 | **Academics** | `MODERATION, AT_RISK, PROGRAMMES` | `listAtRisk`(AT_RISK), `listProgrammes`. **⚠ MODERATION: ver §4.** |

### Lista completa de wrappers disponíveis em `api.js` (confirma o nome antes de importar)
`listStudents getStudent listProgrammes listCourses getDegreeAudit getInvoicesForStudent
getHoldsForStudent getSponsorsForStudent getCourseResults saveCourseMarks publishCourseResults
getResultsForStudent getCourseAttendance getAttendanceForStudent listGraduands listExamSchedule
listExamBoard listApplicants listResidences listNcheReturns listStaff registerCourse payInvoice
submitInvoiceProof listPendingProofs confirmInvoicePayment proofUrl submitAssignment issueCertificate
graduationClearance publishExamResults canteenRecordSale getCanteenSummary listCanteenProducts
getGlJournal listGlAccounts glPost getTimetables timetableSet listTimetable timetableClear
listLibraryCatalogue listLibraryLoans listLibraryFines listLibraryReservations libraryBookUpsert
libraryBookDelete libraryFineSettle libraryReservationAdd libraryReservationUpdate libraryIssue
libraryReturn libraryRenew getDashboardStats listAnnouncements createAnnouncement listSubmissions
getSubmission gradeSubmission listQueries createQuery replyQuery listAcademicWindows setAcademicWindow
recordAttendance recordSession applyLeave decideLeave listLeaveRequests listRolePermissions
listDocumentsForStudent issueDocument getCollegeSettings getSignatories grantStudentAccess
clearPasswordReset getBusinessSettings setBusinessSetting listStaffOptions getCourseware
allocateRoom submitNcheReturn setInstitutionType isHttpMode listPayroll listLeaveBalances
listRecruitment listWorkload getStaffDetail staffUpsert staffDelete contractSet qualificationAdd
leaveBalanceSet recruitUpsert workloadSet payrollRun getFinanceStats listDebtors
listCollectionByProgramme listExpenseBreakdown listInvoices listFeeStructures listBudgets
listExpenses invoiceCreate feeStructureSet budgetSet expenseRecord listAssets listVatCalendar
assetAdd assetDelete assetDepreciate vatPeriodSet listTillSessions listCanteenAccounts
canteenProductUpsert canteenProductDelete canteenInventoryAdjust canteenTillOpen canteenTillClose
canteenAccountTopup listPeriods listDutyRoster listRelief periodSet periodDelete dutySet dutyDelete
reliefSet reliefDelete listAllocations listResidencesFull residenceUpsert residenceDelete
allocateRoomRpc allocationSetStatus listNcheReturnsFull ncheReturnSet getInstitution setInstitution
getFeeTrend getCashflow getActivityFeed getWorkQueue programmeUpsert programmeSetActive courseUpsert
courseDelete listCourseware coursewareUpsert coursewareDelete listAtRisk`

## 4. Lacunas (datasets SEM wrapper direto) — como tratar

Estes campos do mock **não têm** wrapper 1-para-1. Regra: **verifica** `src/api.js` e as migrações em
`supabase/migrations/`; se existir RPC, usa/cria o wrapper correspondente; se **não** existir, **renderiza
empty-state** e deixa um `// TODO(backend): <nome>` — **nunca inventes dados nem RPCs**.

- **`payeMonthly`, `sscMonthly`, `PAYE_BRACKETS`, `VET_LEVY_RATE`** (HR): são **cálculo**, não dados.
  As RPCs `paye_monthly`/`ssc_monthly` existem em `20260824170000_hr_payroll.sql` e as taxas vivem em
  `business_settings` (`get_business_settings()`). Opção A (preferida): mover o cálculo para
  `src/lib/payroll.js` lendo as taxas de `getBusinessSettings()`. Opção B: adicionar wrappers `payeMonthly`/
  `sscMonthly` em `api.js` (ramo http → `.rpc(...)`; ramo mock → `null`). **Não** deixes a fórmula a
  importar de `data.js`.
- **`LOANS`, `INCIDENTS`** (Students): sem tabela/RPC nas migrações atuais → **empty-state** + `// TODO`.
- **`AUDIT_LOG`** (Settings): sem RPC → **empty-state** + `// TODO`.
- **`MODERATION`** (Academics): sem RPC dedicado → deriva de resultados se trivial, senão **empty-state**.
- **`INTAKES`, `ADMISSION_STAGES`** (Admissions/ApplyOnline): são **estágios de pipeline** (config). Se não
  houver RPC, mantém como **constante local no próprio módulo** (não em `data.js`) — é config de UI, não dado.
- **`POS_CATS`** (POS): **deriva** das categorias distintas de `listCanteenProducts()` — não é dataset próprio.
- **`ROLES`/`BP_DEFS`** (Settings): usa `listRolePermissions` e `getBusinessSettings`. A aba **Business rules**
  edita as grade bands via `setBusinessSetting` (o cliente já espelha com `setGradeBands` no boot do `App.jsx`).

Se criares algum wrapper novo em `api.js`: segue o padrão existente — **ramo `useHttp()`** chama
`.rpc('nome_exato_da_migração', {args})` e **ramo mock devolve `[]`/`null`** (sem fallback a `data.js`).
Confirma o nome/assinatura do RPC no ficheiro de migração antes (não suponhas argumentos).

## 5. Ordem de execução recomendada

Do mais simples ao mais complexo (compila a cada 1-3):

1. **Exams** (1 import) · **ApplyOnline** (2, já redireciona) · **Academics** (3) → `npm run build`
2. **Settings** · **StudentPortal** (fix build já feito; confirmar imports) → build
3. **POS** · **Courseware** · **Programmes** · **Admissions** → build
4. **Students** · **Finance** · **HR** (os maiores) → build

## 6. Fase de fecho (depois dos 12)

1. Mover helpers restantes para `src/lib/` (ver `HANDOFF-MOCK-ELIMINATION.md` §F5); desmamar
   `App.jsx`/`Shell.jsx`/`src/auth.js` de `SCHOOL/ROLES/INSTITUTION_HIDE/getInstType`.
2. `grep -rn "from '../data" src/` deve dar **0**. Só então **apagar `src/data.js`**.
3. `config.js`: garantir que produção é só `http`.
4. Remover termos de escola (learner/grade/guardian, "8A/9C") que sobrarem — nomenclatura universitária
   (Student/Programme/Semester/Credit/GPA).

## 7. Verificação final (critério de "feito")

```bash
cd "/media/pedroteixeira/Arquivos/symanek college"
npm run build                       # VERDE (raiz)
grep -rn "from '../data" src/       # deve dar 0 linhas
ls src/data.js                      # deve dar "No such file" (apagado na fase de fecho)
```

Por módulo, confirmação visual em mock (`npm run dev` + deep-link `#…`): carrega sem crash, mostra
**loading → empty-state**, e o botão **+ Add** abre `Modal` (mesmo que o submit não persista em mock).

> **Não digas "feito" sem `npm run build` verde E `grep` = 0.** Não toques na cloud. Não inventes API.
> Em dúvida sobre um RPC, lê a migração em `supabase/migrations/` — não suponhas.
