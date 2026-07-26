#!/usr/bin/env bash
set -Eeuo pipefail

MIGRATION_IMAGE="${MIGRATION_IMAGE:?Set MIGRATION_IMAGE}"
EVIDENCE_DIR="${BACKUP_RESTORE_EVIDENCE_DIR:-/tmp/gestschool-container-evidence/backup-restore}"
RUN_ID="gestschool-restore-${RANDOM}-$$"
NETWORK="${RUN_ID}-network"
POSTGRES="${RUN_ID}-postgres"
SOURCE_DATABASE="gestschool"
TARGET_DATABASE="gestschool_restore_check"
POSTGRES_IMAGE="postgres:16.14-bookworm"
REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="${EVIDENCE_DIR}/backup"

mkdir -p "$BACKUP_DIR"

cleanup() {
  docker rm -f "$POSTGRES" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
}
trap cleanup EXIT

wait_for_container_health() {
  local container="$1"
  local attempts="${2:-60}"
  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    local state
    state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container")"
    if [[ "$state" == "healthy" ]]; then
      return 0
    fi
    if [[ "$state" == "exited" || "$state" == "dead" || "$state" == "unhealthy" ]]; then
      docker logs "$container" >"${EVIDENCE_DIR}/postgres.log" 2>&1 || true
      echo "$container reached terminal state: $state" >&2
      return 1
    fi
    sleep 1
  done
  docker logs "$container" >"${EVIDENCE_DIR}/postgres.log" 2>&1 || true
  echo "Timed out waiting for $container." >&2
  return 1
}

docker network create "$NETWORK" >/dev/null
docker run -d \
  --name "$POSTGRES" \
  --network "$NETWORK" \
  -e POSTGRES_USER=gestschool \
  -e POSTGRES_PASSWORD=gestschool \
  -e POSTGRES_DB="$SOURCE_DATABASE" \
  --health-cmd="pg_isready -U gestschool -d ${SOURCE_DATABASE}" \
  --health-interval=2s \
  --health-timeout=2s \
  --health-retries=30 \
  "$POSTGRES_IMAGE" >/dev/null

wait_for_container_health "$POSTGRES"

SOURCE_URL="postgresql://gestschool:gestschool@${POSTGRES}:5432/${SOURCE_DATABASE}"
TARGET_URL="postgresql://gestschool:gestschool@${POSTGRES}:5432/${TARGET_DATABASE}"

docker run --rm \
  --network "$NETWORK" \
  -e DATABASE_URL="$SOURCE_URL" \
  -e DIRECT_URL="$SOURCE_URL" \
  "$MIGRATION_IMAGE" | tee "${EVIDENCE_DIR}/migration.log"

docker exec "$POSTGRES" \
  psql -U gestschool -d postgres -Xv ON_ERROR_STOP=1 \
  -c "CREATE DATABASE ${TARGET_DATABASE}" >/dev/null
docker exec "$POSTGRES" \
  psql -U gestschool -d "$SOURCE_DATABASE" -Xv ON_ERROR_STOP=1 \
  -c "CREATE TABLE lot9_restore_probe (id integer PRIMARY KEY, value text NOT NULL)" \
  -c "INSERT INTO lot9_restore_probe (id, value) VALUES (1, 'backup-restore-ok')" >/dev/null

set +e
docker run --rm \
  --network "$NETWORK" \
  -v "${REPOSITORY_ROOT}/Infrastructure/scripts:/scripts:ro" \
  -v "${BACKUP_DIR}:/backups" \
  -e BACKUP_DATABASE_URL="$SOURCE_URL" \
  -e BACKUP_DIR=/backups \
  -e GESTSCHOOL_BACKUP_ENVIRONMENT=production \
  "$POSTGRES_IMAGE" \
  bash /scripts/backup-postgres.sh \
  >"${EVIDENCE_DIR}/production-encryption-guard.log" 2>&1
PRODUCTION_GUARD_EXIT=$?
set -e
if [[ "$PRODUCTION_GUARD_EXIT" -eq 0 ]]; then
  echo "Production backup succeeded without an encryption recipient." >&2
  exit 1
fi
grep -q "BACKUP_ENCRYPTION_RECIPIENT is required" \
  "${EVIDENCE_DIR}/production-encryption-guard.log"

docker run --rm \
  --network "$NETWORK" \
  -v "${REPOSITORY_ROOT}/Infrastructure/scripts:/scripts:ro" \
  -v "${BACKUP_DIR}:/backups" \
  -e BACKUP_DATABASE_URL="$SOURCE_URL" \
  -e BACKUP_DIR=/backups \
  -e GESTSCHOOL_BACKUP_ENVIRONMENT=restore-drill \
  -e BACKUP_RETENTION_DAYS=1 \
  "$POSTGRES_IMAGE" \
  bash /scripts/backup-postgres.sh | tee "${EVIDENCE_DIR}/backup.log"

BACKUP_PATH="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.dump' -print -quit)"
if [[ -z "$BACKUP_PATH" ]]; then
  echo "The backup drill did not produce a PostgreSQL archive." >&2
  exit 1
fi
BACKUP_BASENAME="$(basename "$BACKUP_PATH")"

docker run --rm \
  --network "$NETWORK" \
  -v "${REPOSITORY_ROOT}/Infrastructure/scripts:/scripts:ro" \
  -v "${BACKUP_DIR}:/backups" \
  -e RESTORE_DATABASE_URL="$TARGET_URL" \
  -e RESTORE_CONFIRM_DATABASE="$TARGET_DATABASE" \
  "$POSTGRES_IMAGE" \
  bash /scripts/restore-postgres.sh "/backups/${BACKUP_BASENAME}" \
  | tee "${EVIDENCE_DIR}/restore.log"

SOURCE_MIGRATIONS="$(
  docker exec "$POSTGRES" \
    psql -U gestschool -d "$SOURCE_DATABASE" -XAtqc \
    'SELECT COUNT(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL'
)"
TARGET_MIGRATIONS="$(
  docker exec "$POSTGRES" \
    psql -U gestschool -d "$TARGET_DATABASE" -XAtqc \
    'SELECT COUNT(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL'
)"
PROBE_VALUE="$(
  docker exec "$POSTGRES" \
    psql -U gestschool -d "$TARGET_DATABASE" -XAtqc \
    'SELECT value FROM lot9_restore_probe WHERE id = 1'
)"

if [[ "$SOURCE_MIGRATIONS" -lt 1 || "$SOURCE_MIGRATIONS" != "$TARGET_MIGRATIONS" ]]; then
  echo "Migration history differs after restore." >&2
  exit 1
fi
if [[ "$PROBE_VALUE" != "backup-restore-ok" ]]; then
  echo "Application data probe differs after restore." >&2
  exit 1
fi

cat >"${EVIDENCE_DIR}/verification.txt" <<EOF
source_migrations=${SOURCE_MIGRATIONS}
target_migrations=${TARGET_MIGRATIONS}
probe_value=${PROBE_VALUE}
production_encryption_guard=passed
EOF

echo "Disposable PostgreSQL backup and restore drill completed successfully."
