#!/usr/bin/env bash
# grant_staff.sh — create a STAFF Suite login on the CLOUD project, one command.
#
# Auth users live in the auth schema and can't be seeded via plain SQL, so we
# create them through the GoTrue admin API and then link them with the
# link_staff_account() RPC (service_role bypasses the REVOKE). No psql/docker.
#
# Usage:
#   SUPABASE_URL=https://zbtxhyxwtemproeomtzu.supabase.co \
#   SERVICE_ROLE_KEY=<service_role key> \
#   ./supabase/grant_staff.sh <email> <suite_role> "<Full Name>" [staff_uuid]
#
#   <suite_role>: admin | bursar | hr | teacher | seller | librarian | registrar
#   [staff_uuid]: optional; if given, links public.staff.user_id to the new login.
#
# Prints the email + one-time temporary password. The staff member is forced to
# change it on first login (must_reset_password).
set -euo pipefail

API="${SUPABASE_URL:?set SUPABASE_URL (e.g. https://zbtxhyxwtemproeomtzu.supabase.co)}"
SVC="${SERVICE_ROLE_KEY:?set SERVICE_ROLE_KEY}"

EMAIL="${1:?usage: grant_staff.sh <email> <suite_role> \"<Full Name>\" [staff_uuid]}"
SROLE="${2:?missing <suite_role>}"
NAME="${3:?missing \"<Full Name>\"}"
STAFF_UUID="${4:-}"

case "$SROLE" in
  admin|bursar|hr|teacher|seller|librarian|registrar) ;;
  *) echo "invalid suite_role: $SROLE (admin|bursar|hr|teacher|seller|librarian|registrar)" >&2; exit 1 ;;
esac

# Temporary password: random, mixed classes.
PW="Sy$(head -c 9 /dev/urandom | base64 | tr -d '+/=')9!"

# 1) Create (or find) the auth user.
CREATE=$(curl -s -X POST "$API/auth/v1/admin/users" \
  -H "apikey: $SVC" -H "Authorization: Bearer $SVC" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\",\"email_confirm\":true,\"user_metadata\":{\"full_name\":\"$NAME\"}}")

UID=$(printf '%s' "$CREATE" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')

if [ -z "$UID" ]; then
  # Already exists? look it up so the command is idempotent.
  LIST=$(curl -s "$API/auth/v1/admin/users?filter=email.eq.$EMAIL" \
    -H "apikey: $SVC" -H "Authorization: Bearer $SVC")
  UID=$(printf '%s' "$LIST" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
  if [ -z "$UID" ]; then
    echo "could not create or find auth user for $EMAIL" >&2
    echo "response: $CREATE" >&2
    exit 1
  fi
  echo "note: auth user already existed; re-using it and re-linking (password unchanged)."
  PW="(unchanged — user already existed)"
fi

# 2) Seed profile + link staff via the SECURITY DEFINER RPC (service_role allowed).
STAFF_JSON="null"
[ -n "$STAFF_UUID" ] && STAFF_JSON="\"$STAFF_UUID\""
LINK=$(curl -s -X POST "$API/rest/v1/rpc/link_staff_account" \
  -H "apikey: $SVC" -H "Authorization: Bearer $SVC" -H "Content-Type: application/json" \
  -d "{\"p_staff\":$STAFF_JSON,\"p_user\":\"$UID\",\"p_suite_role\":\"$SROLE\",\"p_full_name\":\"$NAME\"}")

if printf '%s' "$LINK" | grep -qi '"message"\|"code"\|error'; then
  echo "link_staff_account failed: $LINK" >&2
  exit 1
fi

echo "----------------------------------------------"
echo " Staff login ready"
echo "  email:      $EMAIL"
echo "  password:   $PW"
echo "  workspace:  $SROLE"
echo "  user id:    $UID"
[ -n "$STAFF_UUID" ] && echo "  linked to:  staff $STAFF_UUID"
echo "  sign in at: https://symanek-suite.vercel.app  (must change password on first login)"
echo "----------------------------------------------"
