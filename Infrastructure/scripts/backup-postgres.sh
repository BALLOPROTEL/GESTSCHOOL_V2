#!/usr/bin/env bash
set -Eeuo pipefail

DATABASE_URL="${BACKUP_DATABASE_URL:-${DATABASE_URL:-}}"
BACKUP_DIR="${BACKUP_DIR:-$(pwd)/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
ENVIRONMENT="${GESTSCHOOL_BACKUP_ENVIRONMENT:-development}"
ENCRYPTION_RECIPIENT="${BACKUP_ENCRYPTION_RECIPIENT:-}"

if [[ -z "$DATABASE_URL" ]]; then
  echo "BACKUP_DATABASE_URL or DATABASE_URL is required." >&2
  exit 1
fi
if ! [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || ((RETENTION_DAYS < 1)); then
  echo "BACKUP_RETENTION_DAYS must be a positive integer." >&2
  exit 1
fi
if [[ "$ENVIRONMENT" == "production" && -z "$ENCRYPTION_RECIPIENT" ]]; then
  echo "BACKUP_ENCRYPTION_RECIPIENT is required for production backups." >&2
  exit 1
fi

for command in pg_dump pg_restore sha256sum; do
  command -v "$command" >/dev/null || {
    echo "$command is required." >&2
    exit 1
  }
done
if [[ -n "$ENCRYPTION_RECIPIENT" ]]; then
  command -v age >/dev/null || {
    echo "age is required when BACKUP_ENCRYPTION_RECIPIENT is set." >&2
    exit 1
  }
fi

umask 077
mkdir -p "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
base_name="gestschool-${ENVIRONMENT}-${timestamp}"
plain_tmp="$(mktemp "${BACKUP_DIR}/.${base_name}.XXXXXX.dump")"
list_tmp="$(mktemp "${BACKUP_DIR}/.${base_name}.XXXXXX.list")"
manifest_tmp="$(mktemp "${BACKUP_DIR}/.${base_name}.XXXXXX.manifest")"

cleanup() {
  rm -f "$plain_tmp" "$list_tmp" "$manifest_tmp"
}
trap cleanup EXIT

echo "Creating PostgreSQL custom-format backup for environment: $ENVIRONMENT"
pg_dump \
  --dbname="$DATABASE_URL" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-acl \
  --file="$plain_tmp"

pg_restore --list "$plain_tmp" >"$list_tmp"
grep -Eq "(SCHEMA|TABLE)" "$list_tmp" || {
  echo "Backup integrity check failed: archive catalogue is incomplete." >&2
  exit 1
}

if [[ -n "$ENCRYPTION_RECIPIENT" ]]; then
  final_path="${BACKUP_DIR}/${base_name}.dump.age"
  encrypted_tmp="${final_path}.tmp"
  age --recipient "$ENCRYPTION_RECIPIENT" --output "$encrypted_tmp" "$plain_tmp"
  mv "$encrypted_tmp" "$final_path"
else
  final_path="${BACKUP_DIR}/${base_name}.dump"
  mv "$plain_tmp" "$final_path"
fi

checksum="$(sha256sum "$final_path" | awk '{print $1}')"
cat >"$manifest_tmp" <<EOF
backup_file=$(basename "$final_path")
created_at_utc=${timestamp}
environment=${ENVIRONMENT}
format=postgresql-custom
encrypted=$([[ "$final_path" == *.age ]] && echo true || echo false)
sha256=${checksum}
pg_dump_version=$(pg_dump --version)
EOF
manifest_path="${final_path}.manifest"
mv "$manifest_tmp" "$manifest_path"
printf '%s  %s\n' "$checksum" "$(basename "$final_path")" >"${final_path}.sha256"

find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'gestschool-*.dump' -o -name 'gestschool-*.dump.age' \
     -o -name 'gestschool-*.dump.manifest' -o -name 'gestschool-*.dump.age.manifest' \
     -o -name 'gestschool-*.dump.sha256' -o -name 'gestschool-*.dump.age.sha256' \) \
  -mtime "+${RETENTION_DAYS}" -delete

echo "Backup complete: $final_path"
echo "Manifest: $manifest_path"
