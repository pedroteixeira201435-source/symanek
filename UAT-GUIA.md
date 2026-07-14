# Symanek — Guia de teste humano (UAT)

Dois produtos, um repositório:

- **Website público** (`site-publico/`, Next.js) — para candidatos. Backend **real** no Supabase cloud.
- **Sistema de gestão / Suite** (raiz, Vite) — para o staff/alunos internos. Corre em **modo demo (mock)**:
  tudo funciona visualmente mas **não persiste** e **não está ligado** às candidaturas reais do site.

Contas de teste (todas password **`symanek123`**):
`admin@`, `bursar@`, `hr@`, `teacher@`, `librarian@`, `registrar@`, `seller@`, `applicant@`,
`student@` — todas `…@symanek.local`. (`student@` = Gabriel !Naruseb.)

---

## A) Website público — cenários (backend real)

> Estas ações **persistem** no cloud. Usa dados de teste; o pagamento é por EFT manual — **não faças
> transferências reais** a menos que os dados bancários na carta sejam confirmados como reais.

1. **Candidatar** — `/apply`: preencher e submeter → ecrã de sucesso com código de acompanhamento.
2. **Aprovar** — `/admin` (login `admin@symanek.local`): na candidatura, **Approve** → é gerada a
   referência `SYM-2026-xxxx`. **Copy email** copia o email de aprovação para enviares à mão.
3. **Acompanhar + carta** — `/portal`: procurar pela referência ou email → estado "approved" +
   **Download approval letter** (PDF).
4. **Comprovativo** — `/portal`: "Already paid? Upload your proof of payment" → anexar ficheiro
   (imagem/PDF) + valor → "Proof of payment received".
5. **Confirmar pagamento** — `/admin`: na candidatura vê-se "📎 Proof uploaded"; **View proof** abre o
   ficheiro; **Record EFT** (valor pré-preenchido) → estado passa a "enrolled".
6. **Rejeitar** — `/admin`: numa candidatura em "submitted", **Reject**.
7. **Contacto** — `/contact`: enviar mensagem (chega à base de dados; a vista de admin de mensagens é
   um follow-up planeado).

**Esperado:** cada passo reflete-se no `/admin` e no `/portal`; a carta e o comprovativo abrem;
nenhum ecrã "parte" (há um ecrã de recuperação se algo falhar).

## B) Sistema de gestão (Suite) — demo (mock)

1. Abrir a Suite → **escolher um workspace** (role picker) — ex.: `Admin`, `Registrar`, `Student`,
   `Bursar`, `Canteen (seller)`.
2. **Student** → percorrer: My Studies, Registration, Grades, Timetable, My Finance, Holds. Registar
   uma cadeira, "Upload proof of payment" (demo).
3. **Registrar** → Academics (Exam Board), Graduation (emitir certificado a um aluno "cleared").
4. **Bursar** → Finance → Payments (painel de comprovativos pendentes — vazio em mock).
5. **Canteen (seller)** → abre em ecrã cheio (POS), sem barra lateral.
6. Navegar por todos os módulos e confirmar que **nada faz white-screen** (aparece um ecrã "Reload" se
   houver erro).

> A Suite em UAT é uma **demonstração de fluxos e UI**, não o sistema com dados reais. O backend real
> (auth, RLS, motor de matrícula, pagamentos) existe e está testado, mas só é exercido pelo website
> público neste UAT (decisão: manter a Suite em mock para coerência).

---

## Notas para o staff (runbook curto)
- **Aprovar candidatura:** `/admin` → Approve. Copia o email gerado (**Copy email**) e envia-o
  manualmente ao candidato (o envio automático não está ativo — demanda baixa).
- **Registar pagamento:** quando o candidato anexa o comprovativo, abre-o (**View proof**), confere o
  valor e clica **Record EFT** (podes ajustar o valor). Ao cobrir o total, o aluno fica "enrolled".
- **Rejeitar:** **Reject** na candidatura.

## Antes de produção (fora do âmbito do UAT)
Endurecer RLS por role (hoje qualquer `staff` = admin), rodar os tokens partilhados, dados bancários
reais na carta, e migrar os restantes módulos da Suite para dados reais.
