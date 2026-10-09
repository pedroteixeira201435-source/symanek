# O que falta na Symanek Suite (vs EduCIMS)

**Data:** 2026-09-16 · **Base:** 2 passagens de leitura pelo EduCIMS da Symanek (460 páginas) comparadas com o código da Suite (`src/modules`, `supabase/migrations`). Detalhe e evidências em `EDUCIMS-GAP-ANALYSIS-2026-09-16.md`.
**Fora de âmbito (decisão do Pedro):** portal do aluno do EduCIMS.

**Legenda:**
- ❌ **Não temos**
- 🟡 **Temos parcialmente** (o que falta vem descrito)
- **P0** = bloqueia a troca de sistema · **P1** = usado de facto pela Symanek · **P2** = existe no EduCIMS mas está vazio ou sem uso
- ⚠️ = precisa de decisão do cliente antes de construir

---

## Resumo

| Área | ❌ não temos | 🟡 parcial | Prioridade dominante |
|---|---|---|---|
| 0. Migração de dados | 1 | — | **P0** |
| 1. Finanças do aluno | 10 | 7 | **P0** |
| 2. Avaliação e exames | 7 | 7 | **P0** |
| 3. Estrutura académica / processos | 4 | 4 | **P0** |
| 4. Documentos oficiais (PDF) | 1 | 4 | **P0** |
| 5. Admissões | 4 | 4 | **P0/P1** |
| 6. Comunicações | 4 | 2 | **P0/P1** |
| 7. Registos (matrícula) | 3 | 2 | P1 |
| 8. Recursos Humanos | 8 | 2 | P1 |
| 9. Horários | 3 | 3 | P1 |
| 10. Relatórios | 1 | 1 | P1 |
| 11. Student Blocks / dispositivos | 2 | 1 | P1 |
| 12. Dashboards | 2 | 2 | P2 |
| 13. Contabilidade avançada | 14 | 3 | P2 |
| 14. Operações | 2 | 4 | P2 |
| 15. Sistema / configuração | 4 | 3 | P1/P2 |
| **Total** | **70** | **49** | |

---

## 0. Migração de dados: P0 ❌
Não existe nenhum processo de importação do EduCIMS. É preciso trazer:
- **Alunos:** 156 contas (bio, ID, contactos, next of kin, disciplinas escolares) e **15 bloqueios ativos**.
- **Admissões e registos:** candidaturas desde 2024 (estado, pontos, qualificação, intake), registos de qualificação e de módulos (incl. cancelados).
- **Académico:** 68 módulos, 8 qualificações, alocações lecturer↔módulo, notas CA, exame e final (normal e supplementary).
- **Finanças:** pagamentos, debit/credit memos, student charges, estrutura de propinas 2024–2026.
- **RH:** staff (16), presenças diárias, licenças e saídas.
- **Import em massa (bulk Excel)** reutilizável para alunos, staff, módulos, alocações, pesos de CA, livros e quartos: ❌.

---

## 1. Finanças do aluno: P0
| # | Funcionalidade | Estado | Prio |
|---|---|---|---|
| 1.1 | **Registo de pagamentos pelo staff** (Cash / Card / EFT / POS / Others), referência, POP reference, descrição (Monthly Installment, Tuition, Registration, Uniform, Student Card, Injection…) | 🟡 só temos upload do comprovativo EFT pelo aluno ⚠️ | **P0** |
| 1.2 | **Recibo** de pagamento imprimível | ❌ | **P0** |
| 1.3 | **Prestações mensais** (installments) | ❌ | **P0** |
| 1.4 | **Debit Memos**: individual e em lote (por qualificação/intake/módulo), com motivo | ❌ | **P0** |
| 1.5 | **Credit Memos**: individual e em lote, com motivo | ❌ | **P0** |
| 1.6 | **Student Charges** (encargos avulsos: vacinação, manuais…) + tipos configuráveis, individual e em lote | 🟡 temos invoices genéricas | **P0** |
| 1.7 | **Student Statement** completo (débitos, créditos, pagamentos e saldo corrido) | 🟡 portal mostra faturas | **P0** |
| 1.8 | **Estrutura de propinas por componentes:** Fee Types (repeatable), Other Fees (por qualificação × ano × year level × student type × processo académico, refundable), Admin Fees por processo, Course Fees, **Subject Fees por módulo** + Smart Allocate | 🟡 Finance → Fees é simples | **P0** |
| 1.9 | **Copiar propinas** de um ano para o seguinte | ❌ | **P0** |
| 1.10 | **Pro-forma / cotação** por qualificação, ano e tipo de aluno, impressa com os dados do interessado | ❌ | P1 |
| 1.11 | **Age Analysis** 30/60/90/120+ dias + Super Age Analysis + settings | ❌ | P1 |
| 1.12 | **Outstanding Student Fees** com extrato por aluno (lá: 86 alunos, N$ 1,02M) | 🟡 lista de devedores | P1 |
| 1.13 | **Cash-up report** por período / caixa + **cashier paypoints** | ❌ (só no canteen) | P1 |
| 1.14 | **Exam Financial Gates:** saldo máximo para ir a exame | 🟡 temos holds, sem limite configurável | P1 |
| 1.15 | **Refunds** (pedido, dados bancários, carta do banco, admin fee, aprovação) | ❌ | P2 |
| 1.16 | **Module Cancellation Policy** (% de crédito por intervalo de datas) | ❌ | P2 |
| 1.17 | **Bursaries:** candidatura a bolsa com itens patrocinados e carta, **Sponsor Invoice**, Bursary Fee Structure, estados | 🟡 temos sponsors/sponsor_claims | P2 |

## 2. Avaliação e exames: P0
| # | Funcionalidade | Estado | Prio |
|---|---|---|---|
| 2.1 | **Pesos CA/exame por módulo** (EduCIMS 50/50; Suite 60/40 fixo global) | 🟡 ⚠️ | **P0** |
| 2.2 | **Exam Admission Criteria por módulo:** CA mínimo para ir a exame, presença mínima, código de subminimum | 🟡 temos a regra de 80% de presença global | **P0** |
| 2.3 | **CA Weights por módulo** (Test 1, Test 2… com pesos) + copiar entre anos + bulk | 🟡 | **P0** |
| 2.4 | **Exam Papers por módulo** (vários papers, nota mínima de passagem 40/50, peso) + copiar | ❌ | **P0** |
| 2.5 | **Result Codes:** A, B, C, D, E, **SE** (qualifica p/ supp), **X** (mínimos exame), **XX** (subminimum), **AFE** (faltou) | 🟡 temos grelha de letras/GPA | **P0** |
| 2.6 | **Exam Registration Criteria** (quem vai a supplementary: final 30–49 / exame 30–39, tratamento de ausentes) | 🟡 temos resit + cap 50% | P1 |
| 2.7 | **Exam Registration** (inscrever alunos num exame normal ou supp) | ❌ | P1 |
| 2.8 | **Process Final Marks** como passo explícito (e bloqueado por janela) | 🟡 | P1 |
| 2.9 | **Exam Entry Gate:** à porta valida horário do dia + CA + presença + saldo e regista Admitted/Denied | ❌ | P1 |
| 2.10 | **Student Promotion:** Pass 1st/2nd Year, Graduated, Fail 1st/2nd Year, manual e por filtro + statuses configuráveis | ❌ | **P0** |
| 2.11 | **Copy Allocations** (alocações lecturer↔módulo para o ano seguinte) + bulk upload/delink | 🟡 | P1 |
| 2.12 | **Info Verification:** campanha em que finalistas confirmam os dados do certificado | ❌ | P2 |
| 2.13 | **Online Classes** (link, plataforma, duração, estado) | ❌ | P2 |
| 2.14 | **Module Evaluations** (avaliação do módulo pelos alunos) + relatório | ❌ | P2 |

## 3. Estrutura académica e processos: P0
| # | Funcionalidade | Estado | Prio |
|---|---|---|---|
| 3.1 | **Intakes January/July** como dimensão em matrícula, horários, notas e propinas | 🟡 existe a coluna `intake` no aluno | **P0** |
| 3.2 | **Study Mode** (Full Time/Part Time/Distance) como dimensão | 🟡 coluna na init, sem uso | **P0** |
| 3.3 | **Year Level** (1–5) e **Study Period** (Semester 1/2/Year) | 🟡 | **P0** |
| 3.4 | **Academic Processes:** janelas de datas por processo × ano × intake (Application, Assessments, Cancellations, Create Student Account, Process Final Marks, Display Exam Timetable, Late Registration, Graduation Verification…) com estado Open/Closed | 🟡 windows enforcement mais simples | **P0** |
| 3.5 | **Academic Years** com datas e flag "display" | ❌ | P1 |
| 3.6 | **Multi-campus** real (filtro em todos os módulos) | ❌ (1 campus, baixa urgência) | P2 |
| 3.7 | **Qualification Specialisations** (eletivas escolhidas na candidatura) | ❌ | P2 |
| 3.8 | **Spaces** (salas com capacidade, por campus) | ❌ | P1 |

## 4. Documentos oficiais em PDF: P0
| # | Funcionalidade | Estado | Prio |
|---|---|---|---|
| 4.1 | **Exam Permit**: individual e **em lote** | 🟡 regra existe; falta PDF | **P0** |
| 4.2 | **Proof of Registration** | 🟡 regra existe; falta PDF | **P0** |
| 4.3 | **Statement of Results** | 🟡 regra existe; falta PDF | **P0** |
| 4.4 | **Academic Record** (histórico completo) + transcripts em lote | 🟡 transcript no portal | **P0** |
| 4.5 | **Student Cards**: individual e em lote, com temas | ❌ | P1 |

## 5. Admissões: P0/P1
| # | Funcionalidade | Estado | Prio |
|---|---|---|---|
| 5.1 | **Pontos de admissão:** tabela símbolo→pontos editável (NSSCH 1=9…4=6; NSSCO A*=8…U=0; JSC) e cálculo automático | 🟡 recolhemos símbolos, não calculamos | **P0** |
| 5.2 | **Education Systems** (NSSC, Cambridge, GCE, SC, JSC) + **School Subjects** (47) editáveis | 🟡 fixos no formulário | P1 |
| 5.3 | Estado **Provisional Admission** (além de Full/Rejected) com descrição | ❌ | **P0** |
| 5.4 | **2.ª escolha** de qualificação (choice number) | ❌ | P1 |
| 5.5 | **Documentos obrigatórios configuráveis** (lá: ID certificado, **POP taxa N$200**, **foto**, **certidão de nascimento**) | 🟡 pedimos ID + certificado fixo ⚠️ | P1 |
| 5.6 | **Manual Admissions** filtráveis + **export** | 🟡 | P1 |
| 5.7 | Limite de candidaturas por aluno por ano; toggle de verificação de email | ❌ | P2 |
| 5.8 | **Bulk upload** de Student Bio (Excel) | ❌ | P1 |

## 6. Comunicações: P0/P1
| # | Funcionalidade | Estado | Prio |
|---|---|---|---|
| 6.1 | **Envio real de email** (SMTP/transacional configurável) | ❌ hoje é "Copy email" ⚠️ (decisão antiga: envio manual) | **P0** |
| 6.2 | **Templates de cartas editáveis** (editor rico com variáveis): Acknowledgement, Admission, Rejection, **Payment Reminder** | 🟡 só a carta de admissão fixa | **P0** |
| 6.3 | **Auto-send por evento** (application submitted / admitted / rejected) + envio em massa filtrado | ❌ | P1 |
| 6.4 | **Email Logs** (Queued/Sent/Failed/Bounced, erro, data) | ❌ | P1 |
| 6.5 | **Notice Board** com público-alvo (qualificação/intake/campus), categorias, anexos e **avisos para staff** | 🟡 Class Board / Announcements | P1 |
| 6.6 | Calendário de eventos | ❌ | P2 |

## 7. Registos (matrícula): P1
| # | Funcionalidade | Estado | Prio |
|---|---|---|---|
| 7.1 | **Cancelar registo de qualificação** com data e motivo + **reverter cancelamento** | ❌ | P1 |
| 7.2 | **Isenção de módulo** (exemption) com motivo + remover isenção | ❌ | P1 |
| 7.3 | **Cancelar módulo** com data e motivo | ❌ | P1 |
| 7.4 | **Manual Registration** (staff regista o aluno) | 🟡 | P1 |
| 7.5 | Estados Registered / **De-registered** / Pending + filtros | 🟡 | P1 |

## 8. Recursos Humanos: P1
| # | Funcionalidade | Estado | Prio |
|---|---|---|---|
| 8.1 | **Attendance Register diário** (Present/Absent/Late/Half-day/On Leave + hora entrada/saída), histórico e relatório. **Em uso diário** | ❌ | **P1** |
| 8.2 | **Self-service de licenças** (o funcionário pede, com anexos) + My Leave Balances + My Leave Report | 🟡 temos pedidos/saldos do lado do admin | P1 |
| 8.3 | **Accumulative leave** (dias/mês) e tipos com dias/ano editáveis | 🟡 | P1 |
| 8.4 | **Employee Exits** com checklist (equipamento, acessos, exit interview, pagamento final), tipos de saída | ❌ | P1 |
| 8.5 | **Employee Documents** para download (Payslip, PAYE5, Attendance, Appraisal) | ❌ | P1 |
| 8.6 | Onboarding com checklist | ❌ | P2 |
| 8.7 | Performance / KPIs / avaliações de staff | ❌ | P2 |
| 8.8 | Required Employee Documents (ID, CV…) | ❌ | P2 |
| 8.9 | Public holidays | ❌ | P2 |
| 8.10 | HR Dashboard (presenças hoje, saídas, aniversários, composição) | ❌ | P2 |

## 9. Horários: P1
| # | Funcionalidade | Estado | Prio |
|---|---|---|---|
| 9.1 | **Publish / Suppress** do horário de exames para alunos + log | ❌ | P1 |
| 9.2 | **Exam Slots** (manhã/tarde) | ❌ | P1 |
| 9.3 | **Copy Timetable** para outro ano/intake | ❌ | P1 |
| 9.4 | Filtros por campus × qualificação × year level × intake × study mode × período | 🟡 | P1 |
| 9.5 | Horário individual de invigilação | 🟡 | P2 |
| 9.6 | Download / impressão dos horários | 🟡 | P1 |

## 10. Relatórios: P1
| # | Funcionalidade | Estado | Prio |
|---|---|---|---|
| 10.1 | **Centro de relatórios** com filtros e export PDF/Excel. Prioritários: Admissions, Applications, Registrations, **Payments**, Statements, Full Statements, Memos, Age Analysis, **Blocked Students**, CA Marks, Student Marks, **Student Attendance**, Promotions, Module Allocations, Employees, Leave, Employees Attendance, User Access | ❌ | P1 |
| 10.2 | Export de tabelas (Copy/Excel/CSV/PDF) nas listas | 🟡 | P1 |

## 11. Student Blocks e portal: P1
| # | Funcionalidade | Estado | Prio |
|---|---|---|---|
| 11.1 | **Bloqueio em lote** (batch number) + **Bulk Revoke** | 🟡 temos holds individuais | P1 |
| 11.2 | Blocked Exemptions | ❌ | P2 |
| 11.3 | Student Devices (inventário e alocação por IMEI) | ❌ | P2 |

## 12. Dashboards: P2
| # | Funcionalidade | Estado |
|---|---|---|
| 12.1 | Academic dashboard com funil por ano, candidaturas por mês, género × campus, top módulos, promoções | 🟡 |
| 12.2 | Finance dashboard com orçamento vs gasto por departamento | 🟡 |
| 12.3 | HR, Maintenance e System Admin dashboards | ❌ |
| 12.4 | Lecturer dashboard com médias de CA e exame por módulo | ❌ |

## 13. Contabilidade avançada: P2 (vazia no EduCIMS)
Chart of Accounts de instituição de ensino completo 🟡 · Journal com workflow Draft→Pending approval→Posted→Reversed/Void 🟡 · **Cost Centres** ❌ · **Bank Accounts** ❌ · **Bank Statements (import CSV)** ❌ · **Bank Reconciliation** ❌ · Cash Receipts / Cash Disbursements / Cash Book ❌ · Restricted Funds ❌ · **Period Close / lock** ❌ · Financial Periods (ano fiscal Out–Set) ❌ · **Balance Sheet** ❌ · **Cash Flow** ❌ · FX revaluation / FX rates ❌ · Budget vs Actual 🟡 · Accounts Payable + Vendors ❌ · **Petty Cash** (top-up, administradores) ❌ · Accounts Receivable (outras receitas) ❌.

## 14. Operações: P2 (vazias no EduCIMS)
Maintenance Job Cards ❌ · Fleet (veículos, trip logs, motoristas) ❌ · Inventory geral (stock, reorder, issue/return) 🟡 (só canteen) · Fixed Assets com localização/estado 🟡 (temos asset register) · Hostel: blocos, quartos, **camas, preço por cama, quotas, cancelamentos** 🟡 · Library: várias bibliotecas, shelf locations, categorias, **e-books link**, borrow self-service de staff, penalty rules 🟡.

## 15. Sistema e configuração: P1/P2
| # | Funcionalidade | Estado | Prio |
|---|---|---|---|
| 15.1 | **Audit Log** consultável no ecrã | 🟡 tabela existe, ecrã é TODO | P1 |
| 15.2 | Roles e permissões granulares editáveis na UI (lá: 44 roles / 648 permissões) | 🟡 matriz fixa server-side | P2 |
| 15.3 | Gestão de utilizadores staff (ativar/inativar, reset) | 🟡 | P1 |
| 15.4 | Mail settings (SMTP) na UI | ❌ | P1 (se 6.1) |
| 15.6 | Listas de valores editáveis (titles, gender, next-of-kin relationships, marital status, highest qualifications, payment descriptions/methods, banks, departments, designations) | ❌ | P2 |
| 15.7 | Integrações (SSO Google/Microsoft, Zoom, Turnitin, SMS, PayToday, PayPulse, DPO, Stripe…) | ❌ (nenhuma ativa lá) | P2 |
| 15.8 | Login banners, security setup, system log | ❌ | P2 |

---

## Decisões pendentes do cliente (⚠️)
1. **Pesos CA/exame:** 60/40 global (regra de 2026 na Suite) ou por módulo (50/50 no EduCIMS)?
2. **Pagamentos:** manter só EFT + comprovativo, ou o staff regista também cash, cartão e POS com recibo?
3. **Documentos obrigatórios na candidatura:** acrescentar POP da taxa de N$200, foto e certidão de nascimento?
4. **Email:** manter "Copy email" manual, ou passar a envio real com templates e auto-send?
5. **Módulos P2:** quais querem de facto (contabilidade avançada, frota, manutenção, dispositivos, payroll no sistema)?

## O que a Suite já tem e o EduCIMS não usa / não tem
Payroll funcional (PAYE/SSC/VET) · Canteen POS · Residência e biblioteca operacionais · Revisão de documentos na candidatura · Degree audit, students at risk, exam board · Motor de impostos NamRA · Compliance NCHE · Ask Lecturer.
