#!/usr/bin/env bash
# Demo auth accounts for the Suite (B3). Auth users live in the auth schema and
# can't be seeded via plain SQL, so we create them through the GoTrue admin API
# and set profiles.role / profiles.suite_role. Idempotent (upserts profiles).
#
# Usage (local): SUPABASE_URL=http://127.0.0.1:54321 SERVICE_ROLE_KEY=<key> ./seed_auth.sh
# All accounts use password: symanek123
set -euo pipefail

API="${SUPABASE_URL:-http://127.0.0.1:54321}"
SVC="${SERVICE_ROLE_KEY:?set SERVICE_ROLE_KEY}"
PSQL=(docker exec -i supabase_db_symanek_college psql -U postgres -d postgres -tAc)

# email : profiles.role (coarse, for is_admin/RLS) : suite_role : full_name
ACCOUNTS=(
  "admin@symanek.local:admin:admin:Symanek Admin"
  "bursar@symanek.local:staff:bursar:Petrus Shilongo"
  "hr@symanek.local:staff:hr:Ndapewa Amutenya"
  "teacher@symanek.local:staff:teacher:Tobias Shikongo"
  "librarian@symanek.local:staff:librarian:Frans Kandjii"
  "registrar@symanek.local:staff:registrar:Registrar Office"
  "seller@symanek.local:staff:seller:Ester Nghifikwa"
  "applicant@symanek.local:applicant:applicant:Prospective Applicant"
  "student@symanek.local:student:student:Gabriel !Naruseb"
)

for a in "${ACCOUNTS[@]}"; do
  IFS=':' read -r email role srole name <<<"$a"
  curl -s -X POST "$API/auth/v1/admin/users" \
    -H "apikey: $SVC" -H "Authorization: Bearer $SVC" -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"symanek123\",\"email_confirm\":true}" >/dev/null || true
  "${PSQL[@]}" "insert into public.profiles(id,full_name,role,suite_role)
    select id,'$name','$role','$srole' from auth.users where email='$email'
    on conflict (id) do update set role='$role',suite_role='$srole',full_name='$name';" >/dev/null
  echo "seeded $email ($srole)"
done

# Link the demo student to their student record so RLS owner-read applies.
"${PSQL[@]}" "update public.students set user_id=(select id from auth.users where email='student@symanek.local')
  where full_name='Gabriel !Naruseb';" >/dev/null
echo "linked student@symanek.local -> Gabriel !Naruseb"
