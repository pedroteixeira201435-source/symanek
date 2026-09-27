# Criar um login de staff (Supabase Dashboard)

Fluxo simples, só no Supabase — sem app, sem terminal. **2 passos.**

## Criar o login

**Passo 1 — criar o utilizador**
1. Supabase Dashboard → projeto `symanek` → **Authentication** → **Add user** → *Create new user*.
2. Preenche:
   - **Email** — o email de login (ex.: `maria@symanek.edu.na`)
   - **Password** — a que quiseres (entregas depois à pessoa)
   - ✔ **Auto Confirm User** (importante — deixa entrar sem confirmar email)
3. **Create user.**

**Passo 2 — escolher o workspace**
1. **Table Editor** → tabela **`profiles`**.
2. Filtra por **email** (o que criaste) — ou ordena por `created_at` e apanha a linha nova.
3. Na coluna **`suite_role`**, escreve o workspace:
   `admin` · `bursar` · `hr` · `teacher` · `registrar` · `librarian` · `seller`
4. **Save.**

Pronto. (Não precisas de mexer na coluna `role` — ela acerta-se sozinha.)

## Dar acesso à pessoa

Entrega-lhe o **email** + a **password** que definiste no Passo 1. Ela entra em
`https://symanek-suite.vercel.app` e vê só o workspace do papel dela.

## Mudar o workspace de alguém

**Table Editor → `profiles`** → muda o **`suite_role`** dessa pessoa → Save.

## Revogar / desativar um login

**Authentication → Users** → encontra o utilizador → **Delete user**.
Isso remove o login e o perfil (em cascata). Simples assim.

## Notas

- **`suite_role`** tem de ser exatamente um dos 7 valores acima.
- `admin` dá acesso total; os outros só ao respetivo workspace.
- Um utilizador acabado de criar **não tem acesso** até definires o `suite_role` (é de propósito, por segurança).
- A coluna `role` (admin/staff/student/applicant) é preenchida automaticamente a partir do `suite_role` — não lhe toques.
