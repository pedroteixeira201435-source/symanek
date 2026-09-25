# Pasta para a cliente — o que é cada ficheiro

| Ficheiro | Para quê | Enviar à cliente? |
|---|---|---|
| `1-MESSAGE-DECISIONS-AND-EDUCIMS-EXPORT.txt` | Mensagem com as 5 decisões e o pedido de export do EduCIMS | ✅ copiar e colar (email/WhatsApp) |
| `2-HOW-TO-ADD-NEW-STUDENTS.txt` | Instruções simples para a escola preencher os alunos novos | ✅ anexar |
| `NEW-STUDENTS-TEMPLATE.csv` | O modelo que a escola preenche (1 linha por aluno) | ✅ anexar |
| `PROGRAMME-NAMES.txt` | Os 58 nomes de curso aceites na coluna `programme` | ✅ anexar |
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
