# Symanek College — Plano de Produção (Site Público + Student Portal + Suite)

**Data:** 28 Jul 2026
**Objetivo:** levar as três partes do monorepo de "protótipo demonstrável" a **produção real**
(dados persistidos, multi-utilizador, seguro, com backups e suporte operacional).

---

## 0. Ponto de partida honesto (o que está REALMENTE feito)

Antes de planear, o estado verificado no código — que diverge do `CLIENT-REPORT-2026-07-19.md`:

| Parte | Estado real | Distância até produção |
|---|---|---|
| **Site público** (Next.js) | Deployado, conteúdo maioritariamente real, fluxo `apply→approve→EFT→enrolled` ligado ao Supabase | **Curta** — falta conteúdo final + endurecimento |
| **Student Portal** (dentro da Suite) | Migrado para backend (leituras), mas depende de tabelas que não existem para metade das features do feedback | **Média** |
| **Suite / gestão** | Protótipo mock. **~5 de 21 módulos** ligados ao backend. Deployada em **modo mock** (sem persistência em produção) | **Longa** |
| **Backend** (Supabase) | Schema core + RPCs autoritativos (matrícula, pagamento, graduação, resultados). Faltam tabelas para as features do feedback | **Média** |

### 🔴 Bloqueadores de verdade descobertos (têm de entrar no Fase 0)

1. **Fórmula de notas inconsistente entre camadas.**
   - Frontend `StudentPortal.jsx`: `WEIGHTS.ca = 0.6` → **60% CA**
   - Backend `publish_results.sql` (RPC autoritativo): `final = 0.4*CA + 0.6*exam` → **40% CA**
   - O relatório diz "corrigido"; só o mock mudou. **O motor que calcula as notas oficiais ainda usa a fórmula antiga.**

2. **Features do feedback (PART 2 e 3) são mock-only.** Sem migrations depois de 14 Jul.
   Assiduidade, intakes Jan/Jul, suppression, 1ª/2ª oportunidade, janelas open/close, leave/payslips,
   "log in as", matriz de permissões, documentos oficiais — tudo `useState` + arrays no JSX. **Não persistem.**

3. **Suite em produção corre em modo mock** (sem env vars → role-picker, dados em memória).
   Nada do que um admin fizer na Suite "de produção" é guardado.

> **Consequência:** o relatório ao cliente sobre-declara o estado. Recomendo reconciliar isto com o
> cliente logo no Fase 0 (ver secção final "Comunicação com o cliente").

---

## Registo de progresso (2026-07-28)

Trabalho autónomo executado nesta sessão (build da Suite verde após cada passo):

- **Fase 0** ✅ — decisões fixadas/documentadas; fórmula de notas corrigida; `CLIENT-QUESTIONS-2026-07-28.md` criado para a Symanek; multi-tenant = single-tenant por agora.
- **Fase 1 (backend)** ✅ *código escrito, por aplicar à cloud* — 3 migrations novas:
  - `20260728120000_fix_grading_formula.sql` — `final = 0.6*CA + 0.4*exam`, bandas de nota, 2ª oportunidade (`second_opp`).
  - `20260728130000_feedback_features.sql` — intakes (Jan/Jul), subject types, `attendance` + `attendance_summary` + regra 80% (`exam_admission_ok`), `academic_windows` + `window_open`/`set_academic_window`, `announcements`, `documents` (+bucket privado), `role_permissions`, `staff.active`, `results.exam2/outcome`, `exam_sittings.opportunity`.
  - `20260728140000_windows_enforcement_and_seeds.sql` — `window_gate` (permite se não configurado) ligado a `register_course` e `publish_exam_results`; seed de `role_permissions` a partir do `ROLE_NAV`.
- **Fase 2 (frontend seam)** 🟡 em progresso — `src/api.js` ganhou funções http/mock para anúncios, janelas académicas, assiduidade (record), leave (apply/decide/list), permissões, documentos, e **branches http para reads core** (`listStudents`/`getStudent`→students+programme join, `listApplicants`→applications). **Módulos ligados ao seam com backend real** (11): StudentPortal, Academics, Graduation, Finance (já feitos) + **Settings** (janelas open/close, end-to-end), **Students** (roster), **Admissions** (pipeline), **Programmes** (lista+catálogo via `listProgrammes`/`listCourses`), **HR** (directory via `listStaff` + leave via `listLeaveRequests`/`decideLeave`). Build da Suite verde após cada passo.
  - **Falta (2 tipos de trabalho):**
    1. **Módulos só-mock** (Accounting, Library, Canteen/POS, TeacherPortal, Dashboard, Scheduling, Compliance, Accommodation, Courseware, Exams, ApplyOnline): ligá-los ao seam é conformidade arquitetural **sem ganho de backend** até criarem schema/RPCs próprios (finanças, POS, LMS) — trabalho de Fase 1 ainda não coberto.
    2. **Geração de PDFs** dos documentos oficiais + **desligar o mock em produção**.
  - ⚠️ **Nada disto se valida sem a cloud deployada** (`@supabase/supabase-js` não corre em Node 18 local; build só prova compilação).

### 🚧 Bloqueadores reais que impedem "concluir todas as fases" autonomamente
1. **Aplicar à cloud (`db push`) e redeploy** = ação de deploy → precisa da **autorização do Pedro**.
2. **Dados reais** (alunos, staff, programas/módulos, calendário, dados bancários, letterhead, valores oficiais, requisitos/fees dos Bachelors) → dependem das **respostas da Symanek** (`CLIENT-QUESTIONS-2026-07-28.md`).
3. **Decisões de negócio** (email auto vs manual, gateway vs EFT, âmbito go-live) → **Symanek**.
> Fases 6, 8 e 9 (dados reais, UAT com o cliente, go-live) **não podem ser concluídas sem 1–3**.

---

## Fases

### Fase 0 — Verdade, alinhamento e decisões que bloqueiam tudo
*Objetivo: fechar ambiguidades antes de escrever schema. Sem isto, retrabalho garantido.*

- [ ] **Confirmar a fórmula oficial** com o cliente (o feedback diz 60% CA + 40% exame). Depois:
  - alinhar `publish_results.sql`, `BACKEND.md`, `StudentPortal.jsx`, `CLAUDE.md` **numa só fonte**.
- [ ] **Confirmar regras de avaliação** e traduzi-las em constantes de sistema, não hard-code espalhado:
  pass formativo 50%, pass módulo final 50%, pass do exame 40%, 2ª oportunidade 45–49%,
  exame 100 marcas/3h, semester subject = 3 formativas, year subject = 5 formativas.
- [ ] **Decisões não-funcionais que mudam a arquitetura** (ver Fase 6/7):
  - Email: continua **manual (copy)** ou passa a **envio automático** (Resend/Postmark/SES)?
  - Pagamentos: fica **EFT + comprovativo** ou integra gateway namibiano (PayToday/DPO)?
  - Multi-tenant: fica só Symanek ou o `tenant_id` tem de funcionar a sério já?
- [ ] **Reconciliar o relatório com o cliente** (o que está demo vs. produção real).
- [ ] Definir **âmbito de go-live**: MVP de produção = quais módulos são obrigatórios no dia 1.

**Entregável:** documento de decisões assinado + `PRODUCTION-PLAN.md` atualizado com as respostas.

---

### Fase 1 — Fundação de backend (schema + RPCs + RLS das features em falta)
*Objetivo: parar de simular. Toda regra de negócio vive no servidor.*

Novas migrations (seguir a ordem timestamp; lembrar `notify pgrst` após DDL):

- [ ] **Assiduidade:** `attendance` (por aluno×curso×sessão) + `attendance_summary` (view/derivado %).
  Regra 80% para emissão de exam permit vira função server-side.
- [ ] **Intakes:** coluna/tabela `intake` (Jan/Jul) em students/enrolments/applications + filtros em toda a app.
- [ ] **Sittings de exame:** `exam_sittings` com `opportunity` (1ª/2ª), regra automática de elegibilidade
  para 2ª oportunidade (média 45–49%).
- [ ] **Janelas de controlo:** `academic_windows` (marks_insertion, marks_release, application, registration…)
  com `open/close` + validação nos RPCs (recusar inserir/registar fora da janela).
- [ ] **Tipos de subject:** `subject_type` (semester|year) + nº de formativas esperadas; validação no gradebook.
- [ ] **HR:** `leave_requests` (apply→approve online) + geração de **payslips** (PDF) a partir de `payroll_runs`.
- [ ] **Documentos oficiais:** exam permit, proof of registration, academic record, statement of results,
  admission/rejection letter — geração server-side (pdf-lib) para bucket privado + URL assinado.
- [ ] **Permissões:** migrar `ROLE_NAV`/`INSTITUTION_HIDE` de config no cliente para **tabelas + RLS**;
  `staff` com `active` (block access) e "log in as" (impersonation auditada).
- [ ] **Audit log** em todas as escritas sensíveis.
- [ ] **Corrigir a fórmula** no RPC conforme Fase 0 e recalcular grades existentes.

**Entregável:** migrations aplicadas em cloud, seed real mínimo, RPCs testados via PostgREST/curl.

---

### Fase 2 — Migração dos módulos da Suite (mock → http)
*Objetivo: zero `data.js` em produção. Todos os 21 módulos leem/escrevem por `api.js`.*

- [ ] Migrar os **~16 módulos ainda em mock**, um a um, seguindo o padrão já provado
  (`StudentPortal`, `Academics`, `Graduation`, `Finance`): reads síncronos → `useEffect` async via `api.js`,
  manter shape de props, adicionar loading/erro. Ordem sugerida por risco/valor:
  1. Students · Admissions · Programmes (core admin)
  2. Exams · TeacherPortal · Scheduling (académico)
  3. HR · Accounting · Compliance (operações/fiscal)
  4. Library · Accommodation · Canteen/POS · Courseware · Dashboard · Settings
- [ ] Substituir **joins por nome** (`INVOICES.learner === "Gabriel !Naruseb"`) por FK `student_id`.
- [ ] **Desligar o mock em produção**: Suite passa a exigir env vars + login real (fim do role-picker em prod).
- [ ] Cada módulo migrado: `npm run build` verde (é o passo de verificação — não há testes configurados).

**Entregável:** Suite a correr `VITE_API_MODE=http` ponta a ponta, persistindo tudo.

---

### Fase 3 — Auth, papéis e segurança de acesso
*Objetivo: cada utilizador vê e faz exatamente o que pode.*

- [ ] Auth real para **todos** os papéis (hoje: `EmailLogin` em http; validar os 9 workspaces).
- [ ] RLS revista tabela a tabela (owner-reads de aluno, scopes de staff, admin full).
- [ ] "Log in as" (impersonation) auditado e restrito a admin.
- [ ] Matriz de permissões editável em Settings, refletida em RLS (não só no menu).
- [ ] Reset de password, bloqueio/ativação de staff, política de sessões.
- [ ] Onboarding de contas reais (staff + alunos) — substituir contas demo `symanek123`.

**Entregável:** teste de acesso por papel (cada role tenta o que não pode → negado no servidor).

---

### Fase 4 — Conclusão funcional do feedback UAT (agora com backend por trás)
*Objetivo: o que o relatório diz "feito" passar a ser verdade persistida.*

- [ ] **Student Portal:** assiduidade real, exam permit gated a 80%, anúncios, documentos, timetable download.
- [ ] **Registrar:** marcas 1ª/2ª oportunidade, timetable, suppression por ano×intake (CA/Exam/Final).
- [ ] **HR:** download de payslips, apply/approve leave online.
- [ ] **Admin full control:** CRUD de alunos + Action button (profile/update/docs/applications/reset/login-as),
  admissão manual, registration (módulos/qualificações/blocks), alocação de módulos a docentes,
  permissões, documentos oficiais, Settings completo (perfil, calendário, toggles, janelas).
- [ ] **Janelas open/close** a bloquear operações fora do período.

**Entregável:** re-executar o checklist do feedback do cliente, agora contra a BD real.

---

### Fase 5 — Finalização do site público
*Objetivo: conteúdo definitivo e endurecimento (está perto).*

- [ ] Fechar itens "awaiting input": fees + requisitos dos Bachelors, duração exata Auxiliary Nursing,
  "Our Values" oficiais, fotos de graduação do Jeremia (galeria sem repetidos).
- [ ] `content.ts` como fonte única — validar contra `seed_programmes.sql` (slugs têm de bater com `submit_application`).
- [ ] **Dados bancários reais** em `content.ts` `college.bank` (hoje PLACEHOLDER).
- [ ] SEO/meta/OG, sitemap, performance (Lighthouse), acessibilidade básica.
- [ ] Rate-limit + validação nos endpoints `api/letter` e `api/payment-proof`.

**Entregável:** site com conteúdo 100% real, verificado pelo cliente.

---

### Fase 6 — Dados reais e migração
- [ ] Carregar programas, módulos, staff e alunos reais (2026, intakes Jan/Jul) — fim do seed demo `Gabriel !Naruseb`.
- [ ] Reconciliar números de cabeçalho (matrículas) com a realidade.
- [ ] Script de importação (CSV/Excel do cliente → tabelas) + validação.

---

### Fase 7 — Não-funcionais / operação (obrigatório para "produção")
- [ ] **Email real** se decidido no Fase 0 (deliverability, templates, envio das cartas/aprovações).
- [ ] **Pagamentos**: manter EFT+comprovativo (mais simples) ou integrar gateway — decisão do Fase 0.
- [ ] **Backups** automáticos da BD + teste de restore.
- [ ] **Monitorização**: erros (Sentry ou equivalente), logs, uptime, alertas.
- [ ] **Segurança**: revisão de RLS, service-role só server-side, secrets fora do git, storage privado.
- [ ] **Performance**: paginação/busca server-side (476+ alunos), índices.
- [ ] ~~Domínios próprios (symanekacademy.com)~~ **ADIADO por decisão do Pedro (2026-07-28)** — fica em Vercel `*.vercel.app` por agora; HTTPS já ativo. Env de produção separado de staging mantém-se.

---

### Fase 8 — QA, UAT e formação
- [ ] Plano de teste por papel + fluxos críticos (candidatura, matrícula, notas, graduação, pagamento).
- [ ] UAT final com o cliente (usar/atualizar `UAT-GUIA.md`).
- [ ] Manual/runbook do staff + formação (admin, bursar, registrar, HR, docentes).
- [ ] Correção de bugs de UAT até sign-off.

---

### Fase 9 — Go-live e pós-lançamento
- [ ] Deploy de produção (ambos os apps), smoke test, DNS.
- [ ] Janela de suporte reforçado nas primeiras semanas (intake).
- [ ] Backlog pós-lançamento: multi-tenant a sério, LMS completo, realtime, gateway de pagamento, etc.

---

## Caminho crítico (dependências)
```
Fase 0 (decisões) → Fase 1 (backend) → Fase 2 (migração módulos) → Fase 3 (auth/RLS)
                                                     ↘ Fase 4 (features UAT)
Fase 5 (site) corre em paralelo (depende só de conteúdo do cliente)
Fase 6/7 (dados + não-funcionais) → Fase 8 (QA/UAT) → Fase 9 (go-live)
```
- **Fase 0 bloqueia tudo** (fórmula, email, pagamentos, âmbito).
- **Fase 1 bloqueia 2, 3, 4** (sem schema não há para onde migrar).
- **Fase 5 é independente** — pode avançar já assim que o cliente enviar conteúdo.

## Estimativa grosseira de esforço (relativa, não em dias — depende das decisões do Fase 0)
| Fase | Peso | Nota |
|---|---|---|
| 0 Decisões | ▪ | rápido, mas bloqueante |
| 1 Backend | ▪▪▪▪ | o maior bloco novo |
| 2 Migração módulos | ▪▪▪▪ | 16 módulos, repetitivo mas extenso |
| 3 Auth/RLS | ▪▪ | |
| 4 Features UAT | ▪▪▪ | |
| 5 Site | ▪ | quase feito |
| 6 Dados | ▪▪ | depende do cliente |
| 7 Não-funcionais | ▪▪ | |
| 8 QA/UAT | ▪▪ | |
| 9 Go-live | ▪ | |

## Comunicação com o cliente (recomendação)
Reposicionar o que hoje está apresentado como "produção" para **"demo funcional aprovada em UAT"**, e
apresentar este plano como o caminho acordado até produção real. É honesto e evita surpresas no go-live
(ex.: o cliente inserir notas na "produção" atual e elas desaparecerem, porque a Suite está em modo mock).
```
```
