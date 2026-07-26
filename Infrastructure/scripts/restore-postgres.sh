#!/usr/bin/env bash
set -Eeuo pipefail

BACKUP_PATH="${1:-}"
DATABASE_URL="${RESTORE_DATABASE_URL:-}"
CONFIRMED_DATABASE="${RESTORE_CONFIRM_DATABASE:-}"
ALLOW_NON_DISPOSABLE="${ALLOW_NON_DISPOSABLE_RESTORE:-false}"
AGE_IDENTITY_FILE="${BACKUP_AGE_IDENTITY_FILE:-}"

if [[ -z "$BACKUP_PATH" || ! -f "$BACKUP_PATH" ]]; then
  echo "Usage: RESTORE_DATABASE_URL=... RESTORE_CONFIRM_DATABASE=... $0 <backup.dump[.age]>" >&2
  exit 1
fi
if [[ -z "$DATABASE_URL" || -z "$CONFIRMED_DATABASE" ]]; then
  echo "RESTORE_DATABASE_URL and RESTORE_CONFIRM_DATABASE are required." >&2
  exit 1
fi

for command in psql pg_restore sha256sum; do
  command -v "$command" >/dev/null || {
    echo "$command is required." >&2
    exit 1
  }
done

checksum_file="${BACKUP_PATH}.sha256"
if [[ ! -f "$checksum_file" ]]; then
  echo "Missing checksum file: $checksum_file" >&2
  exit 1
fi
(
  cd "$(dirname "$BACKUP_PATH")"
  sha256sum --check "$(basename "$checksum_file")"
)

actual_database="$(psql "$DATABASE_URL" -XAtqc 'SELECT current_database()')"
if [[ "$actual_database" != "$CONFIRMED_DATABASE" ]]; then
  echo "RESTORE_CONFIRM_DATABASE does not match the target database." >&2
  exit 1
fi
if [[ "$actual_database" =~ ^(postgres|template0|template1)$ ]]; then
  echo "Refusing to restore into a system database." >&2
  exit 1
fi
if [[ "$ALLOW_NON_DISPOSABLE" != "true" ]] &&
   [[ ! "$actual_database" =~ (_restore|_restore_check|_test|_drill|_e2e)$ ]]; then
  echo "Target must be a disposable restore/test database." >&2
  echo "Set ALLOW_NON_DISPOSABLE_RESTORE=true only in an approved recovery window." >&2
  exit 1
fi

archive="$BACKUP_PATH"
temporary_archive=""
cleanup() {
  [[ -z "$temporary_archive" ]] || rm -f "$temporary_archive"
}
trap cleanup EXIT

if [[ "$BACKUP_PATH" == *.age ]]; then
  command -v age >/dev/null || {
    echo "age is required to decrypt this backup." >&2
    exit 1
  }
  if [[ -z "$AGE_IDENTITY_FILE" || ! -f "$AGE_IDENTITY_FILE" ]]; then
    echo "BACKUP_AGE_IDENTITY_FILE must reference the age identity file." >&2
    exit 1
  fi
  temporary_archive="$(mktemp "${TMPDIR:-/tmp}/gestschool-restore.XXXXXX.dump")"
  age --decrypt --identity "$AGE_IDENTITY_FILE" \
    --output "$temporary_archive" "$BACKUP_PATH"
  archive="$temporary_archive"
fi

pg_restore --list "$archive" >/dev/null
pg_restore \
  --dbname="$DATABASE_URL" \
  --clean \
  --if-exists \
  --exit-on-error \
  --no-owner \
  --no-acl \
  "$archive"

psql "$DATABASE_URL" -Xv ON_ERROR_STOP=1 <<'SQL'
SELECT 1;
SELECT COUNT(*) >= 1 AS migrations_present FROM "_prisma_migrations";
SQL

if command -v node >/dev/null 2>&1 &&
   [[ -f Backend/api/scripts/prisma-command.cjs ]]; then
  (
    export DATABASE_URL="$RESTORE_DATABASE_URL"
    export DIRECT_URL="${RESTORE_DIRECT_URL:-$RESTORE_DATABASE_URL}"
    cd Backend/api
    node scripts/prisma-command.cjs migrate status
  )
fi

echo "Restore verification completed for disposable database: $actual_database"
