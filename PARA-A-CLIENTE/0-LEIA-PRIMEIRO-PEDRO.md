# Pasta para a cliente — o que é cada ficheiro

| Ficheiro | Para quê | Enviar à cliente? |
|---|---|---|
| `1-MESSAGE-DECISIONS-AND-EDUCIMS-EXPORT.txt` | Mensagem com as 5 decisões e o pedido de export do EduCIMS | ✅ copiar e colar (email/WhatsApp) |
| `2-HOW-TO-ADD-NEW-STUDENTS.txt` | Instruções simples para a escola preencher os alunos novos | ✅ anexar |
| `NEW-STUDENTS-TEMPLATE.csv` | O modelo que a escola preenche (1 linha por aluno) | ✅ anexar |
| `PROGRAMME-NAMES.txt` | Os 58 nomes de curso aceites na coluna `programme` | ✅ anexar |
| `4-MESSAGE-PILOT-TEST.txt` | Mensagem a pedir o piloto (5 decisões + emails dos 4 professores + professor de Nutrition) | ✅ copiar e colar (email/WhatsApp) |
| `3-PILOT-TEST-GUIDE.pdf` | Guião do teste-piloto em PDF (4 págs.) — anexar à mensagem acima | ✅ anexar |
| `3-PILOT-TEST-GUIDE.txt` | O mesmo guião em texto simples | opcional |
| `0-LEIA-PRIMEIRO-PEDRO.md` | Este ficheiro | ❌ é só para ti |

---

# Como meter os alunos novos no sistema (quando a escola mandar o ficheiro)

**1. Guarda o ficheiro que recebeste** em `supabase/import/entrada/`
(ex.: `entrada/jan-2027.csv`). Esta pasta está no `.gitignore` — dados pessoais nunca vão para o GitHub.

**2. Testa sem mexer em nada** (não liga à internet, não grava nada):

```bash
cd "/media/pedroteixeira/Arquivos/symanek college"
node supabase/import/import_students.mjs --dry-run --file supabase/import/entrada/jan-2027.csv
```

Se aparecer `row 5 (Nome): email looks wrong…`, manda à escola o número da linha para corrigir
(ou corrige tu no Excel). Só avança quando disser **All rows OK**.

**3. Importa a sério** (usa as chaves do `.env.codex-handoff`):

```bash
cd "/media/pedroteixeira/Arquivos/symanek college"
set -a; . ./.env.codex-handoff; set +a
node supabase/import/import_students.mjs --file supabase/import/entrada/jan-2027.csv
```

- Cria o aluno **e** o login do portal (senha temporária — o aluno troca no 1.º acesso).
- Se preferires dar acesso ao portal só mais tarde (botão *Grant portal access* na Suite), junta `--no-login`.
- Se o nome de um curso não bater com a base de dados, essa linha dá **ERROR programme not found** e as outras entram na mesma.

**4. Vê o resultado** em `supabase/import/saida/import-<data>.csv`: uma linha por aluno com o nº de
estudante (gerado se vinha vazio), a senha temporária e `OK`/`ERROR`. É daqui que tiras as senhas para
entregar aos alunos. **Não partilhes este ficheiro inteiro** — tem as senhas de todos.

**5. Confere na Suite** → *Students*: os alunos novos aparecem com o curso, intake e ano certos.

### Bom saber
- Pode correr-se o mesmo ficheiro duas vezes sem duplicar: o aluno é identificado pelo `student_no`
  e o login pelo email (se o `student_no` vinha vazio, reaproveita o número já dado a esse email).
- `status`: *Admitted* = aceite mas ainda não pagou; *Registered* = pagou o depósito e está matriculado.
- O Excel às vezes grava com `;` em vez de `,` — o script aceita os dois.
- O mesmo script serve para a migração do EduCIMS quando chegar o export: basta pôr as colunas
  com os mesmos nomes do modelo.

---

# Teste-piloto (guião `3-PILOT-TEST-GUIDE.txt`)

**Antes de enviar o guião**, a escola responde às 5 decisões do início do guião
(turma/cadeira, professora, 3–5 alunos voluntários, admin da escola, notas reais ou de treino).

**O teu dia 1 (preparação), tudo na Suite com a tua conta admin:**
1. *Programmes → Cohort Enrolment* → a turma do piloto → **Enrol…** → confirmar.
2. *Programmes → Lecturers* → confirmar que a cadeira do piloto tem a professora certa
   (se não, escolher na tabela e **Save allocation**).
3. *Lecturers* → na professora → **Grant Suite access** (Lecturer) → **Copy message** → WhatsApp.
4. Se o admin da escola ainda não está no staff: **+ Add lecturer** com o email dele →
   **Grant Suite access** com o workspace **Administrator**.
5. *Students* → cada aluno voluntário → **Grant portal access** → **Copy message** → WhatsApp.

**Durante:** apoio por WhatsApp; guarda os prints de erros.
**Depois:** apagar os dados de treino que a escola criou (alunos/professores de teste) e,
se as notas eram de treino, pedir-me para as limpar.

Já validado por mim a 27/09 com contas fictícias em produção (50/51 passos OK; a única falha —
o formulário de aluno não pedir o ano académico — já tem correção; ver migration 20260928130000).
