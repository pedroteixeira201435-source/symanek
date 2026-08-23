#!/usr/bin/env bash
# Symanek — run the RLS/RPC integration tests against the local Supabase DB.
# Exit 0 = all passed, non-zero = failure (CI-friendly).
#
#   ./supabase/tests/run.sh
#   SYMANEK_DB_CONTAINER=my_db ./supabase/tests/run.sh   # override container
set -uo pipefail

CONTAINER="${SYMANEK_DB_CONTAINER:-supabase_db_symanek_college}"
DIR="$(cd "$(dirname "$0")" && pwd)"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "✖ Supabase DB container '${CONTAINER}' is not running. Start it with: supabase start"
  exit 2
fi

echo "▶ RLS/RPC integration tests (${CONTAINER})"
out=$(docker exec -i "${CONTAINER}" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "${DIR}/rls_rpc.test.sql" 2>&1)
code=$?

echo "${out}" | grep -E '== |ok   -|FAIL|PASSED|ERROR' || true

if [ "${code}" -eq 0 ] && echo "${out}" | grep -q "ALL TESTS PASSED"; then
  echo "✅ PASS"
  exit 0
fi
echo "❌ FAIL"
exit 1
