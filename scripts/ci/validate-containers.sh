#!/usr/bin/env bash
set -Eeuo pipefail

API_IMAGE="${API_IMAGE:?Set API_IMAGE}"
WORKER_IMAGE="${WORKER_IMAGE:?Set WORKER_IMAGE}"
MIGRATION_IMAGE="${MIGRATION_IMAGE:?Set MIGRATION_IMAGE}"
EVIDENCE_DIR="${CONTAINER_EVIDENCE_DIR:-/tmp/gestschool-container-evidence}"
RUN_ID="gestschool-ci-${RANDOM}-$$"
NETWORK="${RUN_ID}-network"
POSTGRES="${RUN_ID}-postgres"
REDIS="${RUN_ID}-redis"
API="${RUN_ID}-api"
WORKER="${RUN_ID}-worker"
INVALID="${RUN_ID}-invalid"

mkdir -p "$EVIDENCE_DIR"

cleanup() {
  for container in "$INVALID" "$WORKER" "$API" "$REDIS" "$POSTGRES"; do
    docker rm -f "$container" >/dev/null 2>&1 || true
  done
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
}
trap cleanup EXIT

wait_for_container_health() {
  local container="$1"
  local expected="${2:-healthy}"
  local attempts="${3:-60}"
  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    local state
    state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container")"
    if [[ "$state" == "$expected" ]]; then
      return 0
    fi
    if [[ "$state" == "exited" || "$state" == "dead" || "$state" == "unhealthy" ]]; then
      docker logs "$container" >"$EVIDENCE_DIR/${container}.log" 2>&1 || true
      echo "$container reached terminal state: $state" >&2
      return 1
    fi
    sleep 1
  done
  docker logs "$container" >"$EVIDENCE_DIR/${container}.log" 2>&1 || true
  echo "Timed out waiting for $container to become $expected." >&2
  return 1
}

wait_for_http() {
  local url="$1"
  local expected="$2"
  local attempts="${3:-60}"
  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    local status
    status="$(curl -sS -o /dev/null -w '%{http_code}' "$url" || true)"
    if [[ "$status" == "$expected" ]]; then
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for HTTP $expected from $url." >&2
  return 1
}

container_port() {
  docker port "$1" "$2/tcp" | awk -F: 'NR == 1 { print $NF }'
}

assert_non_root_image() {
  local image="$1"
  local configured_user
  configured_user="$(docker image inspect --format '{{.Config.User}}' "$image")"
  if [[ -z "$configured_user" || "$configured_user" == "0" || "$configured_user" == "root" ]]; then
    echo "$image does not configure a non-root runtime user." >&2
    return 1
  fi
  printf '%s user=%s\n' "$image" "$configured_user" >>"$EVIDENCE_DIR/runtime-users.txt"
}

docker network create "$NETWORK" >/dev/null
docker run -d \
  --name "$POSTGRES" \
  --network "$NETWORK" \
  -e POSTGRES_USER=gestschool \
  -e POSTGRES_PASSWORD=gestschool \
  -e POSTGRES_DB=gestschool \
  --health-cmd='pg_isready -U gestschool -d gestschool' \
  --health-interval=2s \
  --health-timeout=2s \
  --health-retries=30 \
  postgres:16.14-bookworm >/dev/null
docker run -d \
  --name "$REDIS" \
  --network "$NETWORK" \
  --health-cmd='redis-cli ping' \
  --health-interval=2s \
  --health-timeout=2s \
  --health-retries=30 \
  redis:7.4.7-bookworm >/dev/null

wait_for_container_health "$POSTGRES"
wait_for_container_health "$REDIS"

DATABASE_URL="postgresql://gestschool:gestschool@${POSTGRES}:5432/gestschool"
REDIS_URL="redis://${REDIS}:6379"

docker run --rm \
  --network "$NETWORK" \
  -e DATABASE_URL="$DATABASE_URL" \
  -e DIRECT_URL="$DATABASE_URL" \
  "$MIGRATION_IMAGE" | tee "$EVIDENCE_DIR/migration.log"

assert_non_root_image "$API_IMAGE"
assert_non_root_image "$WORKER_IMAGE"
assert_non_root_image "$MIGRATION_IMAGE"

COMMON_ENV=(
  -e NODE_ENV=production
  -e DATABASE_URL="$DATABASE_URL"
  -e DIRECT_URL="$DATABASE_URL"
  -e REDIS_URL="$REDIS_URL"
  -e TRUST_PROXY_HOPS=1
  -e RATE_LIMIT_DISABLED=false
  -e JWT_ISSUER=gestschool-ci
  -e JWT_AUDIENCE=gestschool-ci-clients
  -e JWT_SECRET=ci-runtime-jwt-secret-with-more-than-32-characters
  -e PASSWORD_RESET_SECRET=ci-runtime-reset-secret-with-more-than-32-characters
  -e DEFAULT_TENANT_ID=00000000-0000-4000-8000-000000000001
  -e FILE_STORAGE_DRIVER=SUPABASE
  -e STORAGE_PROVIDER=supabase
  -e SUPABASE_URL=https://ci-project.supabase.invalid
  -e SUPABASE_SERVICE_ROLE_KEY=ci-supabase-service-role-key-with-32-characters
  -e SUPABASE_STORAGE_BUCKET_DOCUMENTS=gestschool-documents
  -e SUPABASE_STORAGE_BUCKET_AVATARS=gestschool-avatars
  -e SUPABASE_STORAGE_AVATARS_PUBLIC=false
  -e SUPABASE_STORAGE_SIGNED_URL_TTL_SECONDS=300
  -e CORS_ORIGINS=https://gestschool-ci.invalid
  -e SWAGGER_ENABLED=false
)

docker run -d \
  --name "$API" \
  --network "$NETWORK" \
  -p 127.0.0.1::3000 \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=128m \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  "${COMMON_ENV[@]}" \
  -e GESTSCHOOL_PROCESS_ROLE=api \
  -e API_PORT=3000 \
  -e MONITORING_METRICS_TOKEN=ci-monitoring-token-with-more-than-32-characters \
  -e NOTIFICATIONS_WORKER_ENABLED=false \
  -e OUTBOX_IN_PROCESS_ENABLED=false \
  "$API_IMAGE" >/dev/null

docker run -d \
  --name "$WORKER" \
  --network "$NETWORK" \
  -p 127.0.0.1::3001 \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=128m \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  "${COMMON_ENV[@]}" \
  -e GESTSCHOOL_PROCESS_ROLE=worker \
  -e WORKER_HEALTH_HOST=0.0.0.0 \
  -e WORKER_HEALTH_PORT=3001 \
  -e NOTIFICATIONS_WORKER_ENABLED=true \
  -e OUTBOX_IN_PROCESS_ENABLED=false \
  -e NOTIFICATIONS_EMAIL_PROVIDER=BREVO \
  -e NOTIFICATIONS_SMS_PROVIDER=BREVO \
  -e BREVO_API_KEY=ci-brevo-key-with-more-than-16-characters \
  -e BREVO_SENDER_EMAIL=no-reply@ci.invalid \
  -e BREVO_SMS_DRY_RUN=true \
  -e BREVO_TIMEOUT_MS=8000 \
  -e NOTIFICATION_WEBHOOK_SIGNING_SECRET=ci-webhook-signing-secret-with-more-than-32-characters \
  -e NOTIFICATION_WEBHOOK_REPLAY_WINDOW_SECONDS=300 \
  -e OUTBOX_CLAIM_TTL_SECONDS=120 \
  -e OUTBOX_MAX_ATTEMPTS=6 \
  -e OUTBOX_RETRY_BASE_SECONDS=15 \
  -e OUTBOX_RETRY_MAX_SECONDS=600 \
  -e NOTIFICATIONS_DISPATCH_CLAIM_TTL_SECONDS=120 \
  -e NOTIFY_MAX_ATTEMPTS=5 \
  -e NOTIFY_RETRY_BASE_SECONDS=30 \
  -e NOTIFY_RETRY_MAX_SECONDS=600 \
  "$WORKER_IMAGE" >/dev/null

wait_for_container_health "$API"
wait_for_container_health "$WORKER"
API_PORT="$(container_port "$API" 3000)"
WORKER_PORT="$(container_port "$WORKER" 3001)"
API_READY="http://127.0.0.1:${API_PORT}/api/v1/health/ready"
WORKER_READY="http://127.0.0.1:${WORKER_PORT}/health/ready"
wait_for_http "$API_READY" 200
wait_for_http "$WORKER_READY" 200

curl -fsS "$API_READY" >"$EVIDENCE_DIR/api-ready.json"
curl -fsS "$WORKER_READY" >"$EVIDENCE_DIR/worker-ready.json"
curl -fsS \
  -H 'Authorization: Bearer ci-monitoring-token-with-more-than-32-characters' \
  "http://127.0.0.1:${API_PORT}/api/v1/monitoring/metrics" \
  >"$EVIDENCE_DIR/metrics.prom"

docker stop "$REDIS" >/dev/null
wait_for_http "$API_READY" 503 20
wait_for_http "$WORKER_READY" 503 20
docker start "$REDIS" >/dev/null
wait_for_container_health "$REDIS"
wait_for_http "$API_READY" 200 30
wait_for_http "$WORKER_READY" 200 30

docker stop "$POSTGRES" >/dev/null
wait_for_http "$API_READY" 503 20
wait_for_http "$WORKER_READY" 503 20
docker start "$POSTGRES" >/dev/null
wait_for_container_health "$POSTGRES"
wait_for_http "$API_READY" 200 30
wait_for_http "$WORKER_READY" 200 30

set +e
docker run --name "$INVALID" --network "$NETWORK" -e NODE_ENV=production "$API_IMAGE" \
  >"$EVIDENCE_DIR/invalid-config.log" 2>&1
INVALID_EXIT=$?
set -e
if [[ "$INVALID_EXIT" -eq 0 ]]; then
  echo "API image accepted an invalid production configuration." >&2
  exit 1
fi
grep -q "Invalid production configuration" "$EVIDENCE_DIR/invalid-config.log"

docker logs "$API" >"$EVIDENCE_DIR/api.log" 2>&1
docker logs "$WORKER" >"$EVIDENCE_DIR/worker.log" 2>&1
docker stop --time 15 "$API" "$WORKER" >/dev/null

for container in "$API" "$WORKER"; do
  exit_code="$(docker inspect --format '{{.State.ExitCode}}' "$container")"
  printf '%s exit_code=%s\n' "$container" "$exit_code" >>"$EVIDENCE_DIR/graceful-stop.txt"
  if [[ "$exit_code" -ne 0 && "$exit_code" -ne 143 ]]; then
    echo "$container did not stop cleanly (exit $exit_code)." >&2
    exit 1
  fi
done

echo "Container validation completed successfully."
