#!/usr/bin/env bash
# KAPWA k6 performance suite orchestration.
#
#   bash perf/k6/run.sh                      # full run (stack + k6 + artifacts + teardown)
#   bash perf/k6/run.sh --stack-only         # boot the disposable stack and leave it running
#   bash perf/k6/run.sh --stop               # tear down whatever --stack-only started
#   bash perf/k6/run.sh --profile quick      # smoke|reads|writes|quick|full (default full)
#   bash perf/k6/run.sh --reset-db           # drop/recreate kapwa_perf before migrating
#   bash perf/k6/run.sh --no-build           # skip the server build
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
K6_DIR="$ROOT/perf/k6"
RESULTS_ROOT="$ROOT/perf/results"
PGDATA=/tmp/opencode/kapwa-pg/data
DB_NAME=kapwa_perf
SERVER_PORT=3100
BASE_URL="http://localhost:${SERVER_PORT}/api/v1"
STATE_FILE="$RESULTS_ROOT/.stack-state"

mode=run
profile="${PROFILE:-full}"
build=1
reset=0
upload="${UPLOAD:-0}"

while [ $# -gt 0 ]; do
  case "$1" in
    --stack-only) mode=stack ;;
    --stop) mode=stop ;;
    --no-build) build=0 ;;
    --reset-db) reset=1 ;;
    --profile) shift; profile="$1" ;;
    --upload) upload=1 ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
  shift
done

db_env() {
  echo "DB_HOST=localhost DB_PORT=5433 DB_USER=kapwa DB_PASSWORD=kapwa DB_NAME=$DB_NAME"
}

pg_running() {
  pg_ctl -D "$PGDATA" status >/dev/null 2>&1
}

stop_all() {
  if [ -f "$STATE_FILE" ]; then
    # shellcheck disable=SC1090
    . "$STATE_FILE"
    if [ -n "${SERVER_PID:-}" ]; then
      kill "$SERVER_PID" 2>/dev/null || true
      wait "$SERVER_PID" 2>/dev/null || true
    fi
    if [ "${PG_STARTED_BY_US:-0}" = "1" ]; then
      pg_ctl -D "$PGDATA" stop >/dev/null 2>&1 || true
    fi
    rm -f "$STATE_FILE"
    echo "stack stopped"
  else
    echo "no stack state found"
  fi
}

if [ "$mode" = stop ]; then stop_all; exit 0; fi

# Re-entrant: reuse a healthy stack for --stack-only; clean up stale state otherwise.
if [ -f "$STATE_FILE" ]; then
  if [ "$mode" = stack ] && node -e "fetch('${BASE_URL}/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
    echo "stack already running at $BASE_URL"
    exit 0
  fi
  echo "cleaning up stale stack before starting"
  stop_all
fi

RUN_ID=$(date -u +%Y%m%dT%H%M%SZ)
RUN_DIR="$RESULTS_ROOT/$RUN_ID"
mkdir -p "$RUN_DIR"

startedAt=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# 1. Postgres
PG_STARTED_BY_US=0
if ! pg_running; then
  pg_ctl -D "$PGDATA" -o "-p 5433" -l /tmp/opencode/kapwa-pg/pg.log start
  PG_STARTED_BY_US=1
fi

# 2. Database
if [ "$reset" = 1 ]; then
  psql -h localhost -p 5433 -U kapwa -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME" >/dev/null
fi
if ! psql -h localhost -p 5433 -U kapwa -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
  psql -h localhost -p 5433 -U kapwa -d postgres -c "CREATE DATABASE $DB_NAME" >/dev/null
fi

# 3. Build (if needed)
if [ "$build" = 1 ] || [ ! -f "$ROOT/kapwa-server/dist/main.js" ]; then
  (cd "$ROOT/kapwa-server" && npm run build >/dev/null)
fi

# 4. Migrate + base seeds (direct DataSource)
(cd "$ROOT/kapwa-server" && env $(db_env) node dist/database/migrate.js >"$RUN_DIR/migrate.log" 2>&1)
(cd "$ROOT/kapwa-server" && env $(db_env) npx ts-node src/database/seed-accounts.ts >"$RUN_DIR/seed-accounts.log" 2>&1)
(cd "$ROOT/kapwa-server" && env $(db_env) npx ts-node src/database/seed-programs.ts >"$RUN_DIR/seed-programs.log" 2>&1)

# 5. Server
(cd "$ROOT/kapwa-server" && env $(db_env) PORT="$SERVER_PORT" THROTTLE_LIMIT=100000 THROTTLE_TTL_MS=60000 NODE_ENV=development \
  node dist/main.js >"$RUN_DIR/server.log" 2>&1 &
 echo $! > "$RUN_DIR/server.pid")
SERVER_PID=$(cat "$RUN_DIR/server.pid")

wait_health() {
  for _ in $(seq 1 60); do
    if node -e "fetch('${BASE_URL}/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
      return 0
    fi
    sleep 1
  done
  echo "server did not become healthy; see $RUN_DIR/server.log" >&2
  return 1
}
wait_health

# 6. Demo seed (API-driven; uploads warn without MinIO)
(cd "$ROOT/kapwa-server" && env $(db_env) API_BASE="$BASE_URL" npx ts-node src/database/seed-demo.ts >"$RUN_DIR/seed-demo.log" 2>&1)

if [ "$mode" = stack ]; then
  printf 'SERVER_PID=%s\nPG_STARTED_BY_US=%s\nRUN_DIR=%s\n' "$SERVER_PID" "$PG_STARTED_BY_US" "$RUN_DIR" > "$STATE_FILE"
  echo "stack ready at $BASE_URL (state: $STATE_FILE)"
  exit 0
fi

# 7. k6
set +e
if command -v k6 >/dev/null 2>&1; then
  runner=local
  BASE_URL="$BASE_URL" PROFILE="$profile" RESULTS_DIR="$RUN_DIR" UPLOAD="$upload" k6 run "$K6_DIR/main.js"
  k6_status=$?
else
  runner=docker
  docker run --rm --network host --user "$(id -u):$(id -g)" \
    -v "$K6_DIR:/scripts:ro" -v "$RUN_DIR:/results" \
    -e BASE_URL="$BASE_URL" -e PROFILE="$profile" -e RESULTS_DIR=/results -e UPLOAD="$upload" \
    grafana/k6 run /scripts/main.js
  k6_status=$?
fi
set -e

# 8. Run metadata + teardown
cat > "$RUN_DIR/run-meta.json" <<JSON
{
  "gitSha": "$(git -C "$ROOT" rev-parse --short HEAD)",
  "startedAt": "$startedAt",
  "profile": "$profile",
  "runner": "$runner",
  "baseUrl": "$BASE_URL",
  "database": "$DB_NAME",
  "throttleLimit": "100000",
  "throttleTtlMs": "60000",
  "upload": "$upload"
}
JSON

printf 'SERVER_PID=%s\nPG_STARTED_BY_US=%s\nRUN_DIR=%s\n' "$SERVER_PID" "$PG_STARTED_BY_US" "$RUN_DIR" > "$STATE_FILE"
stop_all

exit "$k6_status"
