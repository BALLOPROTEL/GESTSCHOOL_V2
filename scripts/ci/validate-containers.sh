#!/usr/bin/env bash
set -Eeuo pipefail

API_IMAGE="${API_IMAGE:?Set API_IMAGE}"
WORKER_IMAGE="${WORKER_IMAGE:?Set WORKER_IMAGE}"
MIGRATION_IMAGE="${MIGRATION_IMAGE:?Set MIGRATION_IMAGE}"
RUN_ID="gestschool-ci-${RANDOM}-$$"
EVIDENCE_ROOT="${CONTAINER_EVIDENCE_DIR:-/tmp/gestschool-container-evidence}"
EVIDENCE_DIR="${EVIDENCE_ROOT}/${RUN_ID}"
NETWORK="${RUN_ID}-network"
POSTGRES="${RUN_ID}-postgres"
REDIS="${RUN_ID}-redis"
API="${RUN_ID}-api"
WORKER="${RUN_ID}-worker"
INVALID="${RUN_ID}-invalid"
PROMETHEUS="${RUN_ID}-prometheus"

mkdir -p "$EVIDENCE_DIR"

cleanup() {
  for container in "$INVALID" "$PROMETHEUS" "$WORKER" "$API" "$REDIS" "$POSTGRES"; do
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

wait_for_container_http() {
  local container="$1"
  local url="$2"
  local expected="$3"
  local attempts="${4:-60}"
  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    local status
    status="$(
      docker exec "$container" node -e \
        "fetch(process.argv[1]).then((response) => process.stdout.write(String(response.status))).catch(() => process.stdout.write('000'))" \
        "$url" 2>/dev/null || true
    )"
    if [[ "$status" == "$expected" ]]; then
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for HTTP $expected from $url in $container." >&2
  return 1
}

container_fetch() {
  local container="$1"
  local url="$2"
  local authorization="${3:-}"
  docker exec "$container" node -e '
    const [url, authorization] = process.argv.slice(1);
    const headers = authorization ? { Authorization: authorization } : undefined;
    fetch(url, { headers }).then(async (response) => {
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      process.stdout.write(body);
    }).catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
  ' "$url" "$authorization"
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

docker network create --internal "$NETWORK" >/dev/null
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
docker run --rm \
  --network "$NETWORK" \
  -e DATABASE_URL="$DATABASE_URL" \
  -e DIRECT_URL="$DATABASE_URL" \
  "$MIGRATION_IMAGE" \
  node scripts/prisma-command.cjs migrate status | tee "$EVIDENCE_DIR/migration-status.log"
grep -q "Database schema is up to date" "$EVIDENCE_DIR/migration-status.log"

assert_non_root_image "$API_IMAGE"
assert_non_root_image "$WORKER_IMAGE"
assert_non_root_image "$MIGRATION_IMAGE"

COMMON_ENV=(
  -e NODE_ENV=production
  -e GESTSCHOOL_RUNTIME_ENV=rc
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
  --network-alias api \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=128m \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  "${COMMON_ENV[@]}" \
  -e GESTSCHOOL_PROCESS_ROLE=api \
  -e API_PORT=3000 \
  -e MONITORING_METRICS_TOKEN=ci-monitoring-token-with-more-than-32-characters \
  -e NOTIFICATIONS_WORKER_ENABLED=false \
  -e NOTIFICATIONS_EMAIL_ENABLED=true \
  -e NOTIFICATIONS_SMS_ENABLED=true \
  -e ALLOW_MOCK_NOTIFICATION_PROVIDERS_IN_RC=true \
  -e NOTIFICATIONS_EMAIL_PROVIDER=MOCK \
  -e NOTIFICATIONS_SMS_PROVIDER=MOCK \
  -e OUTBOX_IN_PROCESS_ENABLED=false \
  "$API_IMAGE" >/dev/null

docker run -d \
  --name "$WORKER" \
  --network "$NETWORK" \
  --network-alias worker \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=128m \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  "${COMMON_ENV[@]}" \
  -e GESTSCHOOL_PROCESS_ROLE=worker \
  -e WORKER_HEALTH_HOST=0.0.0.0 \
  -e WORKER_HEALTH_PORT=3001 \
  -e MONITORING_METRICS_TOKEN=ci-monitoring-token-with-more-than-32-characters \
  -e NOTIFICATIONS_WORKER_ENABLED=true \
  -e OUTBOX_IN_PROCESS_ENABLED=false \
  -e NOTIFICATIONS_EMAIL_ENABLED=true \
  -e NOTIFICATIONS_SMS_ENABLED=true \
  -e ALLOW_MOCK_NOTIFICATION_PROVIDERS_IN_RC=true \
  -e NOTIFICATIONS_EMAIL_PROVIDER=MOCK \
  -e NOTIFICATIONS_SMS_PROVIDER=MOCK \
  -e BREVO_SMS_DRY_RUN=true \
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
API_READY="http://127.0.0.1:3000/api/v1/health/ready"
WORKER_READY="http://127.0.0.1:3001/health/ready"
wait_for_container_http "$API" "$API_READY" 200
wait_for_container_http "$WORKER" "$WORKER_READY" 200

container_fetch "$API" "$API_READY" >"$EVIDENCE_DIR/api-ready.json"
container_fetch "$WORKER" "$WORKER_READY" >"$EVIDENCE_DIR/worker-ready.json"
container_fetch \
  "$API" \
  "http://127.0.0.1:3000/api/v1/monitoring/metrics" \
  'Bearer ci-monitoring-token-with-more-than-32-characters' \
  >"$EVIDENCE_DIR/metrics.prom"
container_fetch \
  "$WORKER" \
  "http://127.0.0.1:3001/metrics" \
  'Bearer ci-monitoring-token-with-more-than-32-characters' \
  >"$EVIDENCE_DIR/worker-metrics.prom"
grep -q "gestschool_worker_outbox_due_total" "$EVIDENCE_DIR/worker-metrics.prom"

printf '%s' 'ci-monitoring-token-with-more-than-32-characters' \
  >"$EVIDENCE_DIR/metrics-token"
chmod 0444 "$EVIDENCE_DIR/metrics-token"
docker run --rm \
  --entrypoint /bin/promtool \
  -v "$PWD/Infrastructure/monitoring:/etc/prometheus:ro" \
  -v "$EVIDENCE_DIR/metrics-token:/run/secrets/metrics_token:ro" \
  prom/prometheus:v2.54.1 \
  check config /etc/prometheus/prometheus.yml \
  | tee "$EVIDENCE_DIR/prometheus-config-check.log"
docker run --rm \
  --entrypoint /bin/promtool \
  -v "$PWD/Infrastructure/monitoring:/etc/prometheus:ro" \
  prom/prometheus:v2.54.1 \
  test rules /etc/prometheus/alerts.test.yml \
  | tee "$EVIDENCE_DIR/prometheus-alert-tests.log"

docker run -d \
  --name "$PROMETHEUS" \
  --network "$NETWORK" \
  --read-only \
  --tmpfs /prometheus:rw,noexec,nosuid,size=128m,uid=65534,gid=65534,mode=0700 \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  -v "$PWD/Infrastructure/monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro" \
  -v "$PWD/Infrastructure/monitoring/alerts.yml:/etc/prometheus/alerts.yml:ro" \
  -v "$EVIDENCE_DIR/metrics-token:/run/secrets/metrics_token:ro" \
  prom/prometheus:v2.54.1 >/dev/null
wait_for_container_http "$API" "http://${PROMETHEUS}:9090/-/ready" 200 30
sleep 20
container_fetch \
  "$API" \
  "http://${PROMETHEUS}:9090/api/v1/query?query=up" \
  >"$EVIDENCE_DIR/prometheus-up.json"
node - "$EVIDENCE_DIR/prometheus-up.json" <<'NODE'
const fs = require("node:fs");
const report = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const health = new Map(
  report.data.result.map((row) => [row.metric.job, Number(row.value[1])])
);
for (const job of ["gestschool-api", "gestschool-worker"]) {
  if (health.get(job) !== 1) {
    throw new Error(`Prometheus target ${job} is not up.`);
  }
}
NODE

docker stop "$REDIS" >/dev/null
wait_for_container_http "$API" "$API_READY" 503 20
wait_for_container_http "$WORKER" "$WORKER_READY" 503 20
docker start "$REDIS" >/dev/null
wait_for_container_health "$REDIS"
wait_for_container_http "$API" "$API_READY" 200 30
wait_for_container_http "$WORKER" "$WORKER_READY" 200 30

docker stop "$POSTGRES" >/dev/null
wait_for_container_http "$API" "$API_READY" 503 20
wait_for_container_http "$WORKER" "$WORKER_READY" 503 20
docker start "$POSTGRES" >/dev/null
wait_for_container_health "$POSTGRES"
wait_for_container_http "$API" "$API_READY" 200 30
wait_for_container_http "$WORKER" "$WORKER_READY" 200 30

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
