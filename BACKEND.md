# Symanek Suite — Prontidão para o Backend (Fase 2)

Este documento é o contrato para sair do protótipo visual e ligar um backend real.
Stack recomendada: **Supabase** (Postgres + Auth + Storage + Realtime) — cobre schema,
RBAC (via RLS), uploads e tempo-real sem infra própria.

## Como a migração funciona (a costura já está pronta)
- `src/config.js` — `API_MODE = 'mock' | 'http'` (default `mock`). Backend = `VITE_API_MODE=http`.
- `src/api.js` — **camada de acesso**. Todo ecrã deve ler/escrever por aqui, nunca importando
  `data.js`. Hoje devolve o mock via `Promise`; na Fase 2 troca-se o corpo por `fetch()` — **nenhum
  componente muda**. (Migração pendente: os módulos ainda importam `data.js` direto; ligar cada um
  ao `api.js` é o 1º passo da Fase 2 — a interface já existe.)

## Dívida técnica que o backend TEM de resolver
1. **Join por nome → join por `student_id` (FK).** Hoje `INVOICES.learner === "Gabriel !Naruseb"`.
   Frágil. Todo relacionamento vira FK por id.
2. **`tenant_id` em todas as tabelas** — multi-instituição é na raiz, não enxerto.
3. **RBAC no servidor** (RLS), não esconder itens de menu. `INSTITUTION_HIDE` (config de tenant) e
   `ROLE_NAV` (permissões) migram para tabelas + policies.

## Schema (tabelas mínimas, PK/FK)
> Todas com `id uuid pk`, `tenant_id uuid`, `created_at`, `updated_at`.

- **institutions** (tenant): `type` (Vocational college | Full university | Distance), `name`, `modules_enabled[]`.
- **users**: `email`, `role` (admin|bursar|hr|teacher|librarian|registrar|student|applicant|seller), `staff_id?`, `student_id?`.
- **students**: `student_no`, `name`, `programme_id fk`, `year`, `status`, `next_of_kin`, `phone`, `attendance`.
- **programmes**: `code`, `name`, `nqf`, `years`, `coordinator_staff_id fk`, `accreditation`.
- **courses**: `code`, `title`, `programme_id fk`, `credits`, `semester`, `lecturer_staff_id fk`, `capacity`, `prereq_course_id fk?`.
- **enrolments**: `student_id fk`, `course_id fk`, `semester`, `status` (registered|waitlisted|passed|failed), `charge`.
- **results**: `enrolment_id fk`, `ca`, `exam`, `final`, `grade`, `published bool`.
- **invoices**: `student_id fk`, `amount`, `balance`, `due`, `status`. **payments**: `invoice_id fk`, `amount`, `method`, `ref`.
- **holds**: `student_id fk`, `type` (financial|advising), `reason`, `blocks[]`, `active bool`. *(derivar automaticamente de saldo/advising).*
- **sponsors** + **sponsor_claims**: `student_id fk`, `coverage`, `billed`, `received`, `status`.
- **staff**, **contracts**, **qualifications**, **leave_requests**, **payroll_runs**.
- **residences** + **allocations**: `student_id fk`, `room`, `fee`, `status`.
- **applications**: `applicant_user_id fk`, `programme_id fk`, `points`, `stage`, `documents[]`.
- **graduands** (view/derivado), **exam_sittings** (`course_id`, `venue`, `seats`, `invigilator_staff_id`), **nche_returns**.
- **courseware** (`course_id`) + **assignments** + **submissions** (`student_id`, `assignment_id`, `file_url`, `grade`).
- **audit_log** (`user_id`, `action`, `entity`, `at`).

## Regras que são AUTORITATIVAS no servidor (não confiar no cliente)
- **Motor de matrícula**: holds → pré-requisito → capacidade/waitlist → limite de créditos → cobrança. (hoje em `StudentPortal.Registration`).
- **Holds financeiros**: criar/libertar automaticamente por saldo em aberto.
- **Clearance de graduação**: derivar de invoices/loans/results (já derivado no front em `Graduation.jsx`).
- **Fiscalidade NamRA**: PAYE/SSC/VET, IVA de suprimentos mistos, imposto 30%, provisional tax (hoje em `Accounting.jsx`).
- **Assessment**: `final = 0.4*CA + 0.6*exam`, publicação bloqueia edição.

## Contratos de operação (mapa `api.js` → endpoint)
| Operação (api.js) | Método/rota (sugerido) | Regras server-side |
|---|---|---|
| `listStudents/getStudent` | `GET /students`, `/students/:id` | paginação; scope tenant + RBAC |
| `listCourses(prog)` | `GET /courses?programme=` | — |
| `registerCourse` | `POST /enrolments` | motor de matrícula completo |
| `payInvoice` | `POST /payments` | gateway (ex. PayToday/DPO); baixa saldo; liberta hold |
| `submitAssignment` | `POST /submissions` | upload p/ storage |
| `submitApplication` | `POST /applications` | candidato autenticado |
| `issueCertificate` | `POST /graduands/:id/certificate` | exige clearance = ok |
| `submitNcheReturn` | `POST /nche-returns/:id/submit` | — |
| `setInstitutionType` | `PATCH /institution` | admin only; recarrega módulos |
| `login/currentSession` | Supabase Auth | JWT + RLS por role/tenant |

## Não-funcionais a decidir antes de codar
- **Paginação/busca** server-side (476+ alunos).
- **Storage**: documentos de candidatura, material de curso, transcripts/certificados (PDF).
- **Pagamentos**: escolher provedor namibiano (PayToday / DPO Pay).
- **Notificações**: provedor SMS/email para os "notified".
- **Realtime**: inbox/holds/matrícula ao vivo (Supabase Realtime).

## Ordem sugerida da Fase 2
1. Criar schema Supabase + seed a partir de `data.js` (com ids e `tenant_id`).
2. Ligar `api.js` ao Supabase (reads primeiro) e migrar os módulos para consumir `api.js`.
3. Auth + RLS (RBAC/tenant). 4. Writes + motor de matrícula. 5. Storage + pagamentos + notificações.
