#!/usr/bin/env bash
# Symanek — logical backup of the application schema (public) + data.
# Uses the pg_dump binary inside the local Supabase container, so no Postgres
# client tools need to be installed on the host. Works for both the local DB
# and the cloud project (via the Session-pooler connection string).
#
#   ./supabase/backups/backup.sh                 # local Supabase
#   SUPABASE_DB_URL='postgresql://postgres.<ref>:<pwd>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require' \
#     ./supabase/backups/backup.sh               # cloud
#
# Output: supabase/backups/dumps/symanek-<target>-<timestamp>.sql.gz (gitignored).
# Keeps the newest 14 dumps. Restore instructions: see DR-RUNBOOK.md.
set -euo pipefail

CONTAINER="${SYMANEK_DB_CONTAINER:-supabase_db_symanek_college}"
OUT_DIR="${BACKUP_DIR:-$(cd "$(dirname "$0")" && pwd)/dumps}"
mkdir -p "$OUT_DIR"
TS="$(date +%Y%m%d-%H%M%S)"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "✖ container '${CONTAINER}' not running (needed for its pg_dump)."; exit 2
fi

DUMP_ARGS=(--schema=public --no-owner --no-privileges --clean --if-exists)

if [ -n "${SUPABASE_DB_URL:-}" ]; then
  TARGET="cloud"
  echo "▶ Logical backup (CLOUD)"
  docker exec -i "$CONTAINER" pg_dump "$SUPABASE_DB_URL" "${DUMP_ARGS[@]}" | gzip > "$OUT_DIR/symanek-${TARGET}-${TS}.sql.gz"
else
  TARGET="local"
  echo "▶ Logical backup (LOCAL)"
  docker exec -i "$CONTAINER" pg_dump -U postgres -d postgres "${DUMP_ARGS[@]}" | gzip > "$OUT_DIR/symanek-${TARGET}-${TS}.sql.gz"
fi

OUT="$OUT_DIR/symanek-${TARGET}-${TS}.sql.gz"
echo "✓ $(du -h "$OUT" | cut -f1)  $OUT"

# retention: keep the 14 most recent dumps
ls -1t "$OUT_DIR"/symanek-*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm -f
