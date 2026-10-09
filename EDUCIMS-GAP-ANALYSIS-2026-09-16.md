# EduCIMS (plataforma atual da Symanek) vs Symanek Suite — análise de lacunas

**Data:** 2026-09-16 · **Fonte:** `https://symanek.educims.org` com a conta de staff `jeremiaf@` (perfil *Systems Administrator*, vê quase tudo).
**Método:** navegação automática só de leitura (Playwright) em **2 passagens: 160 + 300 páginas**, com texto, formulários, modais e captura de cada ecrã. Os formulários "create/edit" foram abertos, mas nunca submetidos. Não se executou nenhuma ação que altere dados (apagar, aprovar, pagar, exportar ou alternar opções).
**Não coberto:** a vista do **aluno** (portal do estudante), porque a conta é de staff, e cerca de 370 formulários "create/edit" de tabelas de configuração (baixo valor). O LMS não tem página própria acessível com este perfil. Ver §6.

> Nota: este documento não inclui dados pessoais de alunos nem de staff (a plataforma tem dados reais).

---

## 1. O que é o EduCIMS

- **Stack:** Laravel 9 + PHP 8.2 + MySQL (tema Metronic), PWA instalável e SaaS multi-escola (`<escola>.educims.org`).
- **Login:** email + password + **reCAPTCHA v2**, com "Forgot password" e um PDF "How to Apply Online".
- **Controlo de acesso:** Spatie Permission, com **44 roles** e **648 permissões granulares** (`access-*`, `add-*`, `edit-*`, `post-journals`…). Os roles são por módulo (ex.: "Assessments", "Settings Finance") e o utilizador acumula vários.
- **Volume real da Symanek:**

  | Dado | Valor |
  |---|---|
  | Contas | 173 (156 alunos, 17 staff) |
  | Alunos ativos | 42 |
  | Funcionários ativos | 11 (16 registados) |
  | Qualificações | 8 |
  | Módulos ativos | 68 |
  | Candidaturas 2026 | 58 (48 admitidos, 38 registados) |
  | Alunos bloqueados | 15 |
  | Receita YTD | N$ 694,8K |
  | Dívida em atraso | N$ 1 022 100 (86 alunos, segundo "Outstanding Student Fees"; o dashboard mostra N$ 204K) |
  | Registos de presença de staff | quase diários desde Jun 2026 |
  | Registos no audit log | 39 067 |
  | Emails de cartas enviados | 88 |

  Há histórico desde **2024**.
- **Estrutura académica:** Academic Year (2024–2027) × **Intake (January/July)** × Qualification × **Study Mode (Full Time/Part Time/Distance)** × **Year Level (1–5)** × **Study Period (Semester 1/Semester 2/Year)** × **Campus**.

## 2. Mapa do menu (como está organizado)

| Secção | Itens |
|---|---|
| (topo) | Howdy (welcome), My Calendar, Staff Directory, Student Directory, **User Dashboards** (HR, Finance, Academic, Management, Maintenance, System Admin) |
| **HELP DESK** (documentos oficiais) | Exam Permit, Student Cards, Student Letters, Academic Record, Proof of Registration, Statement of Results |
| **STUDENT MANAGEMENT** | Applicants (Student Bio), Admissions, Registrations, Student Marks, Info Verification, User Timetables, Student Promotion, Student Financials, Bursary Management, Refunds Management, Learning (LMS) |
| **FINANCIAL ASPECTS** | Accounting, Maintenance, Accounts Payable, Human Resources, Fleet Management, Payroll Management, Accounts Receivable, Assets Management |
| **VALUE ADDITION** | Communications, Leave Applications, Library Applications, Hostel Management, Library Administrations, Student Services (Portal) |
| **SYSTEM REPORTS** | Student Debtors, Financial, Academic, Human Resources, Operational, Management, Student Management |
| **SYSTEM SETTINGS** | Control Panel, Access Control, School/General/HR/Academic Structure/Hostel/Library/Payroll/Exams & Assessments/Financial Settings, All Other Settings |

## 3. Funcionalidades módulo a módulo e cobertura na Suite

Legenda: ✅ temos · 🟡 parcial / diferente · ❌ não temos

### 3.1 Dashboards
| EduCIMS | Suite |
|---|---|
| Academic dashboard: KPIs, funil candidatura→admissão→registo por ano, registos por qualificação, candidaturas por mês, matrícula por campus×género, top módulos, promoções por campus, "Today's Heroes", licenças aprovadas por tipo | 🟡 Dashboard único (cash flow, action queue, matrícula por programa, cobrança) |
| HR dashboard: headcount, presença hoje, licenças pendentes, onboarding, saídas, composição académica/não-académica, género, departamento, "most absent", **aniversários e aniversários de casa** | ❌ |
| Finance dashboard: receita/despesa YTD, dívida vencida, top devedores, pagamentos a fornecedores, reembolsos, ativos, bolsas, **orçamento vs gasto por departamento** | 🟡 Finance → Overview |
| Maintenance dashboard (job cards por estado e prioridade) | ❌ |
| System Admin dashboard (saúde do servidor, utilizadores por role, contas verificadas) | ❌ (menor prioridade) |
| Employee/Lecturer dashboard: os meus módulos, média de CA e de exame por módulo, o meu horário, licenças, presenças, atalhos | 🟡 Lecturer Portal |

### 3.2 Help Desk: documentos oficiais gerados
| EduCIMS | Suite |
|---|---|
| **Exam Permit**: individual (nº aluno/ID) e **em lote** (ano, campus, qualificação, intake, período) | 🟡 existe a regra (80% presença + clearance) em `controls.js`/portal; falta geração em PDF e em lote |
| **Student Cards**: individual e em lote, **4 temas** de cartão | ❌ |
| **Student Letters**: Acknowledgement, Admission, **Payment Reminder**, Rejection (preview + download) | 🟡 temos a carta de admissão (token); faltam Acknowledgement, Payment Reminder e Rejection |
| **Academic Record** (histórico completo) | 🟡 transcript no portal |
| **Proof of Registration** | 🟡 só a regra; falta o PDF |
| **Statement of Results** | 🟡 só a regra; falta o PDF |

### 3.3 Admissões e candidatos
| EduCIMS | Suite |
|---|---|
| **Student Bio** (ficha biográfica: nº aluno, DOB, ID, contactos, next of kin, disciplinas escolares) + **Bulk Upload Excel** | 🟡 Students register (sem import Excel) |
| Admissions: filtros ano/intake/tipo/qualificação/modo/campus, **pontuação (POINTS)** calculada das notas escolares, estados **Pending / Provisional / Full Admission / Rejected**, **escolha 1/2 (choice number)**, export | 🟡 Pipeline + docs + notas (feito a 14/09); **falta o cálculo de pontos**, "Provisional Admission", 2.ª escolha e export |
| Settings: School Subjects (47 disciplinas), Education Systems (NSSC, Cambridge, GCE, SC, JSC), **Matric Types & Grading** (símbolo → pontos: NSSCH 1=9…4=6; NSSCO A*=8…U=0; JSC) | 🟡 temos os símbolos no formulário; **falta a tabela símbolo→pontos editável** |

### 3.4 Registos (matrícula)
| EduCIMS | Suite |
|---|---|
| Qualification registration (Registered / De-registered / Pending) com **cancelamento com data e motivo** e **reversão do cancelamento** | 🟡 (matrícula existe; cancelar/reverter com motivo não) |
| **Module registration** por aluno, **isenção (exemption) com motivo**, cancelar módulo | 🟡 course registration no portal; isenções ❌ |
| Manual registration (staff regista o aluno) | 🟡 |

### 3.5 Avaliação e exames (Student Marks)
| EduCIMS | Suite |
|---|---|
| My Modules (lecturer): listas de turma, notas, registos de presença | ✅ Lecturer Portal |
| Continuous Assessments, Examinations (**Normal vs Supplementary/Special**), **Process Final Marks** | ✅ CA + exame → final (0.6/0.4) + resit; 🟡 "process final marks" como passo explícito |
| **Exam Registration** (inscrever alunos num exame) | ❌ |
| **Exam Entry Gate**: à porta da sala valida horário do dia + CA mínimo + % presença + **saldo financeiro** e regista cada entrada (Admitted/Denied) | ❌ (**diferenciador forte**) |
| Marks Suppression por ano/intake/campus/qualificação/modo × tipo (CA/Exam/Final) | ✅ Academics → Marks Suppression |
| **Module Allocations** (lecturer↔módulo por ano/intake/modo) + bulk upload + **Copy Allocations** (copiar para o ano seguinte) | ✅ Programmes → Module Allocation; 🟡 falta copiar/bulk |
| **Online Classes** (agenda de aulas online: link, plataforma, duração, estado) | ❌ |
| **Info Verification**: campanhas em que finalistas confirmam os dados a imprimir no certificado | ❌ (liga-se a Graduation) |
| **Exam Financial Gates**: saldo máximo permitido para ir a exame | 🟡 temos holds/clearance; não há limite configurável |

### 3.6 Horários
| EduCIMS | Suite |
|---|---|
| Lecture timetable por campus/qualificação/ano/intake/modo/período + **Copy Timetable** + download | ✅ Scheduling (🟡 copiar/download) |
| Horário individual do lecturer | ✅ |
| **Exam timetable** (data, hora, sala, **invigilador**) com **Publish/Suppress** para o portal + log | ✅ Exams (🟡 publicar/suprimir) |
| Horário de invigilação por pessoa | 🟡 |
| **Spaces** (salas com capacidade) | 🟡 |

### 3.7 Promoção
| EduCIMS | Suite |
|---|---|
| **Student Promotion** (manual/por filtro): Pass First Year, Pass Second Year, **Graduated – Course completion**, Fail First/Second Year | ❌ (temos Graduation e degree audit, mas não a passagem de ano) |

### 3.8 Finanças do aluno
| EduCIMS | Suite |
|---|---|
| **Cashier** com **paypoints** (caixa ligado ao utilizador) + bulk upload de pagamentos | ❌ (nós: EFT + comprovativo, por decisão) |
| **Debit Memos / Credit Memos** (ajustes ao extrato com motivo; individual e em lote) | ❌ **muito usado** |
| **Student Charges** (encargos avulsos: vacinação, manuais…) + tipos | 🟡 invoices |
| **Student Statements** (extrato de conta) | 🟡 portal "My invoices" |
| **Pro-forma Statements / Quotation** (orçamento por qualificação, ano e tipo de aluno, impresso com os dados do interessado) | ❌ |
| **Cash-up report** | 🟡 só no Canteen |
| **Fee structure por componentes**: Fee Types (Registration, Student Card, Uniform, Practical, Tuition, Maintenance, Assessment, Vaccination, Study Manuals), Other Fees, Admin Fees, **Course Fees** por qualificação×ano×year level×student type, **Subject Fees** por módulo + **Smart Allocate**, **Copy Fees** ano a ano, refundable flag | 🟡 Finance → Fees (estrutura mais simples) |
| **Bursary Management**: sponsors (ex.: SSC), candidaturas a bolsa, montante patrocinado vs alocado, **Sponsor Invoice**, Bursary Fee Structure (o que a bolsa cobre) | 🟡 sponsorships/sponsor_claims; falta faturar o sponsor e a estrutura do que cobre |
| **Refunds Management** (pedido, admin fee, aprovação) | ❌ |
| **Age Analysis** (30/60/90/120+ dias) + **Super Age Analysis** + settings | ❌ (temos só a lista de devedores) |

### 3.9 Contabilidade (GL)
| EduCIMS | Suite |
|---|---|
| Chart of Accounts completo de instituição de ensino (≈70 contas: bancos operações/propinas/restritos, AR alunos, bolsas NSFAF, VAT, PAYE, SSC, deferred tuition, restricted funds…) | 🟡 GL simples |
| Journal Vouchers com tipos (Journal, Cash receipt, Cash disbursement, AP/AR invoice, Petty cash, Payroll, Depreciation, FX, Reversal) e **workflow Draft→Pending approval→Posted→Reversed/Void** | 🟡 journal double-entry sem aprovação |
| **Cost Centres** (Campus→Faculty→Department) | ❌ |
| **Bank Accounts, Bank Statements upload, Bank Reconciliation** | ❌ |
| Cash Receipts / Cash Disbursements journals, Cash Book | ❌ |
| **Budgets** + Budget vs Actual | ✅ Finance → Budgets (🟡 vs actual) |
| Restricted Funds (doador, burn-down) | ❌ |
| **Period Close / lock** | ❌ |
| Relatórios: Trial Balance ✅, Income Statement ✅, **Balance Sheet** ❌, **Cash Flow (direto)** ❌, General Ledger listing 🟡, Journal listing 🟡, **VAT 201 (NamRA)** 🟡, FX revaluation ❌ | |
| Tax codes, FX rates | 🟡 Tax Engine |

> **Observação:** no EduCIMS a contabilidade está praticamente vazia (sem bancos nem journals, tudo a 0,00). **Na prática, a Symanek usa as finanças do aluno (memos, charges, statements), não o GL.**

### 3.10 Recursos Humanos
| EduCIMS | Suite |
|---|---|
| Employee Bio + bulk upload (auth e completo) | ✅ Staff (🟡 bulk) |
| **Onboarding** (checklist, % de conclusão) | ❌ |
| **Employee Exits** (resignation/dismissal, clearance final, progresso) | ❌ |
| **Attendance Register diário** (Present/Absent/Late/Half-day/On Leave + hora entrada/saída), bulk upload, histórico | ❌ |
| **Performance Management** (avaliações com score %) | ❌ |
| Leave: tipos com dias de direito (Annual 24, Sick, Compassionate, Maternity 90, Study 20, Absent without pay), candidatura self-service, **My Leave Balances**, **My Leave Report**, aprovação | 🟡 Leave requests + balances (falta self-service do funcionário) |
| Payroll Management *(não visto)* | ✅ HR → Payroll (PAYE/SSC/VET) |
| Staff Directory (address book) | 🟡 |

### 3.11 Operações
| EduCIMS | Suite |
|---|---|
| **Maintenance Job Cards** (categoria, departamento, prioridade, atribuição, tempo de resolução, export) | ❌ |
| **Fleet** (veículos, trip logs, manutenção, analytics, motoristas e cartas de condução) | ❌ (dados de exemplo lá; provavelmente não usado) |
| **Inventory** (stock, reorder level, fornecedor, localização, issue out/return) | 🟡 só inventário do canteen |
| **Fixed Assets** (categoria, depreciação, localização, estado) | ✅ Accounting → Asset Register |
| Accounts Receivable (outras receitas) | 🟡 |
| **Student Devices** (inventário de dispositivos, alocação por IMEI) | ❌ |

### 3.12 Comunicação, portal, biblioteca e residência
| EduCIMS | Suite |
|---|---|
| **Letters** configuráveis por estado de admissão (templates) + **envio real por email** com **Email Logs** (Queued/Sent/Failed/Bounced) | 🟡 geramos o email e o admin copia (envio manual, por decisão) |
| **Notice Board** (avisos para staff e para alunos, com público-alvo e prazo) | ✅ Lecturer Class Board / Announcements (🟡 avisos para staff) |
| My Calendar (eventos) | ❌ |
| Library: livros, issuing/returns, fines, **E-Books link**, borrow self-service de staff, histórico | ✅ Library (🟡 e-books e self-service de staff) |
| Hostel: alunos em residência, quartos, camas, preço, quotas | ✅ Accommodation (🟡 cama/preço/quotas) |
| LMS *(não visto)* | 🟡 Courseware |

### 3.13 Relatórios (≈50)
Todos com filtros e a maioria com **download PDF/Excel**:
- **Financeiros:** Bursary, Refunds, Full Statements, Statements, Age Analysis, Super Age Analysis, Balance Sheet, Trial Balance, FX, VAT 201, Journal listing, Budget vs Actual, Cash Book, Restricted Funds, Petty Cash (**dá erro 500 lá**), Bank Recon, Cash Flow, Library Fees, GL, P&L, Memos.
- **Académicos:** CA Marks, Promotions, Module Allocations, **Module Evaluations**, Academic Transcripts (lote), Student Marks, **Student Attendance (horas por módulo)**, Continuous Assessment, Modules per Qualification.
- **RH:** Employees, Leave Applications, Employees Attendance, Staff Evaluation.
- **Operacionais:** Hostel Quotas, Hostel Students, Inventory, Book Allocations, Device Allocations/Inventories, Fixed Assets, Maintenance Job Cards, Library Books.
- **Gestão:** Performance, **User Access Report** (quem tem que permissão), Cost Centre Performance.
- **Gestão de alunos:** Admissions, Applications, Registrations.

**Suite:** 🟡 temos vistas equivalentes a alguns relatórios, mas **não um centro de relatórios com filtros + export PDF/Excel**.

### 3.14 Sistema
| EduCIMS | Suite |
|---|---|
| Roles + 648 permissões editáveis na UI, Users (ativar/inativar) | 🟡 Settings → Roles (matriz server-side, menos granular) |
| **Audit Log** consultável | 🟡 (tabela existe; ecrã "TODO audit log RPC") |
| System log | ❌ (não precisamos: Supabase) |
| **Integrations**: Google/Microsoft SSO, Zoom, BigBlueButton, Cloudflare Stream, Copyleaks/Turnitin, OpenAI/Anthropic, Postmark/SendGrid, Twilio SMS/WhatsApp, Africa's Talking… (todas **por configurar**) | ❌ (vitrine; nenhuma está ativa na Symanek) |
| Mail settings (SMTP editável na UI) | ❌ |
| General: Titles, Gender, **Campuses**, **Spaces**, Login banners | 🟡 |

### 3.15 Descobertas da 2.ª passagem (detalhe e configurações)

**Regras académicas configuráveis por módulo.** São as mais importantes para a paridade:
| EduCIMS | Suite |
|---|---|
| **Exam Admission Criteria por módulo × ano × tipo de exame:** presença mínima, **CA mínimo para ir a exame (50)**, **peso CA e peso exame para a nota final (lá 50/50)**, código de resultado do subminimum | 🟡 temos `final = 0.6*CA + 0.4*exam` **fixo e global**; lá é **por módulo** (**conflito a confirmar com o cliente**) |
| **Exam Papers por módulo:** papers, nota mínima de passagem (40 ou 50) e peso | ❌ |
| **CA Weights por módulo** (Test 1, Test 2… com pesos) + copiar entre anos + bulk | 🟡 |
| **Result Codes:** A Distinction, B Very Good, C Good, D Satisfactory, E Fail, **SE** (qualifica para supp), **X** (mínimos do exame falhados), **XX** (subminimum), **AFE** (faltou ao exame) | 🟡 temos grelha de letras (A–F/GPA), sem os códigos SE/X/XX/AFE |
| **Assessment Types:** Normal (cap 100%) e **Supplementary/Special (nota limitada a 50%)** | ✅ resit cap (migration 20260804) |
| **Exam Registration Criteria:** vai a supp quem tem final 30–49 ou exame 30–39 ("handle absent") | 🟡 |
| **Exam Slots** (manhã 08–11h, tarde 12–15h) | 🟡 |
| **Academic Processes:** janelas de datas que abrem ou fecham cada processo (Application, Assessments, Cancellations, Create Student Account, Process Final Marks, Display Exam Timetable, Graduation Info Verification, Late Registration…) por ano × intake, com estado Open/Closed em tempo real | 🟡 temos windows enforcement (migration 20260728140000), menos granular |
| **Module Cancellation Policy:** % de crédito por intervalo de datas ao cancelar um módulo | ❌ |
| **Qualification Specialisations** (eletivas escolhidas na candidatura) | ❌ |
| Qualifications (código, NQF, créditos, nº de anos, módulos ligados) e Modules (duração da aula, créditos, NQF) | ✅ Programmes/Course catalogue |

**Admissões e configuração**
| EduCIMS | Suite |
|---|---|
| **Required Student Documents:** Certified ID ✔, **Proof of Payment da taxa de candidatura (N$ 200)** ✔, **Passport photo** ✔, **Birth certificate** ✔ (obrigatórios); School leaving cert, testimonials, qualificações, NQA evaluation (opcionais) | 🟡 pedimos ID + certificado Grade 11/12; **faltam POP N$200, foto e certidão de nascimento** (confirmar com o cliente) |
| **Admission Statuses:** Rejected / Provisional / Full, com descrição | 🟡 |
| **List of Values:** nº de candidaturas por aluno por ano, forma de cobrar a matrícula (por disciplina), **verificação de email** on/off, **carta de receção automática** | ❌ |
| Next-of-kin relationships, Highest Qualifications, Marital status, Titles, Student Types (Namibian…) | 🟡 |
| **Letters:** editor rico (CKEditor) com variáveis, filtro por qualificação/intake/campus/estado, **AUTO-SEND por evento** (application submitted/admitted/rejected), preview em PDF e contagem de destinatários | 🟡 (cópia manual do email) |

**Finanças do aluno**
| EduCIMS | Suite |
|---|---|
| **Payments (Cashier):** staff regista pagamentos com método (**Cash, Card, EFT, POS, Others**), referência PAY-, **POP reference**, descrição (**Monthly Installment**, Tuition, Registration, Uniform, Student Card, Injection…), recibo imprimível. **Muito usado**: há pagamentos mensais de alunos | 🟡 nós só temos EFT + upload do comprovativo pelo aluno; **falta o staff registar pagamentos, prestações mensais e recibo** |
| Cashier paypoints (1 caixa: Finance clerk) | ❌ |
| **Outstanding Student Fees: 86 alunos com N$ 1 022 100 em atraso** (o dashboard mostra N$ 204K: incoerência deles) | 🟡 debtors |
| **Student Blocks:** bloqueio de portal (15 alunos, motivo "School fees"), por lote (batch number), **Bulk Revoke** | ✅ holds (🟡 lote/bulk) |
| Payment Descriptions, Payment Methods (se exige POP ref) | 🟡 |
| Financial Periods (**ano fiscal Out–Set**) | 🟡 |

**RH (uso real confirmado)**
| EduCIMS | Suite |
|---|---|
| **Attendance Register diário em uso:** registos quase diários de Jun a Set 2026, feitos pela administração | ❌ **(P1 → subir)** |
| Exits com **checklist** (recuperar equipamento, acessos, exit interview, pagamento final) e tipos (Resignation, Dismissal, End of Contract, Retirement…); 4 saídas registadas | ❌ |
| Onboarding checklist (template pré-definido, sem uso) | ❌ |
| Leave: tipos com dias/ano + **accumulative leave (1 dia/mês)** + anexos + aprovação com motivo | 🟡 |
| Required Employee Documents (ID, CV…) | ❌ |
| Public holidays (usado só com fins de semana) | ❌ |
| Payroll: **praticamente NÃO configurado** (tax brackets vazios, 1 payslip item de teste, pension/medical aid sem página). Há "Employee Documents" (Payslip, PAYE5, Attendance, Appraisal) | ✅ **a nossa Suite está à frente** (PAYE/SSC/VET) |

**Módulos que a Symanek NÃO usa no EduCIMS** (tudo vazio): Hostels/blocks/rooms/beds, Library (sem bibliotecas criadas), Accounts Payable, Petty Cash, Vendors, Inventory e categorias, Fixed Assets, Fleet (só dados de exemplo), Maintenance, Student Devices, Performance/KPIs, Bank accounts/GL, Bursaries (1 sponsor e zero bolsas), Refunds, Online classes, Integrações.

**Bugs vistos no EduCIMS:** erro 500 em `reports/petty-cash-report`, `reports/module-cancellations-report`, `account/refund-applications` e `education_systems/*/edit`; pedidos lentos (3–4,6 s); "Fake Qualification" em produção.

---

## 4. Lacunas priorizadas (o que a Symanek USA de facto)

A prioridade tem em conta os dados reais vistos nas 2 passagens.

**P0: sem isto não podem trocar de sistema**
1. **Migração de dados** do EduCIMS: 156 alunos (bio + next of kin + disciplinas escolares), candidaturas desde 2024, registos, alocações de módulos, notas CA/exame, **pagamentos**, memos e encargos, bloqueios, staff, presenças e licenças. Pedir **export Excel/SQL** à Educims/Symanek.
2. **Pagamentos registados pelo staff:** Cash/Card/EFT/POS, prestações mensais, POP reference e **recibo**. Fica ao lado do nosso fluxo de upload do comprovativo EFT (**decisão a rever com o cliente**, porque hoje eles aceitam cash e POS).
3. **Débitos, créditos e encargos avulsos (Debit/Credit Memos, Student Charges)**, individuais e em lote, + **Student Statement** completo.
4. **Estrutura de propinas por componentes** (fee types + course fees + subject fees por ano, year level e tipo de aluno; refundable; processo académico) e **copiar para o ano seguinte**.
5. **Regras de avaliação configuráveis por módulo:** pesos CA/exame (lá 50/50, nós 0.6/0.4 fixo: **confirmar**), CA mínimo para exame, presença mínima, papers com nota mínima, result codes (SE/X/XX/AFE) e critérios de supplementary.
6. **Documentos oficiais em PDF:** Exam Permit (individual e lote), Proof of Registration, Statement of Results, Academic Record e **Student Cards**.
7. **Modelo académico:** **Intake January/July**, Study Mode, Year Level e **Promotion** (passagem de ano / course completion), com **janelas de processos académicos** por ano × intake.
8. **Cartas** (Acknowledgement / Admission / Rejection / **Payment Reminder**) com template editável, **auto-send por evento**, envio real e log.

**P1: usados e com valor claro**

9. **Registo diário de presenças do staff** (em uso quase diário) + **self-service de licenças** (balances, report, accumulative leave, anexos).
10. **Pontos de admissão** (tabela símbolo→pontos) + Provisional Admission + 2.ª escolha + **documentos obrigatórios configuráveis** (POP N$200, foto, certidão de nascimento).
11. **Student Blocks** em lote (batch) + bulk revoke (temos holds individuais).
12. **Exam Entry Gate** + Exam Registration + **limite de saldo para exame**.
13. **Age Analysis** 30/60/90/120+ e lista de devedores com extrato.
14. **Centro de relatórios** com filtros + export PDF/Excel (admissões, registos, marks, attendance, statements, memos, payments, blocked students, employees, leave).
15. Horário de exames com **Publish/Suppress** + exam slots + **copiar horários, alocações, pesos e papers** para o ano seguinte.
16. **Employee Exits** com checklist (4 saídas registadas).
17. **Audit log** visível.

**P2: existem lá, mas vazios ou sem uso** (confirmar com a Symanek se os querem)

18. Refunds + module cancellation policy (configurados, 0 pedidos; página de refunds dá erro 500).
19. Bursaries/sponsor invoice (1 sponsor, 0 bolsas).
20. Contabilidade avançada: bancos, reconciliação, cost centres, period close, balance sheet, cash flow, AP, petty cash, vendors (tudo a 0).
21. Hostels e Library (nada criado; **nós já temos ambos**).
22. Onboarding, Performance/KPIs, Maintenance, Inventory, Fixed Assets, Student Devices, Info Verification, Online Classes, Calendar, Specialisations.
23. Fleet (só dados de exemplo), Integrações (nenhuma configurada), System log.

## 5. Onde a Suite já é melhor / diferente

- Candidatura online com **documentos + notas + revisão de docs** (verified/rejected/needs_resubmission) e bloqueio da aprovação.
- **Payroll real** (PAYE/SSC/VET): no EduCIMS o payroll nem está configurado.
- **Canteen POS** (não existe no EduCIMS).
- **Degree audit**, students at risk, exam board, NamRA tax engine, compliance NCHE.
- Portal do aluno com Ask Lecturer, sponsorships e upload do comprovativo EFT.
- Stack moderna (RLS Supabase) e UI mais limpa; o EduCIMS é lento (3–4,6 s por pedido) e tem páginas com erro 500.

## 6. Próximos passos sugeridos

1. **Validar com a Symanek 3 decisões:**
   - Pesos CA/exame: 60/40 global (a nossa regra de 2026) ou por módulo (50/50 no EduCIMS)?
   - Aceitar pagamentos cash/POS registados pelo staff, ou só EFT?
   - Documentos obrigatórios na candidatura: POP N$200, foto, certidão de nascimento?
2. Pedir **acesso de aluno** (ou demo) para ver o **Student Services Portal** do lado do aluno.
3. Pedir **export de dados** do EduCIMS para planear a migração (P0 #1).
4. Confirmar quais módulos P2 querem de facto.
