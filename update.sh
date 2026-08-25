#!/bin/bash
set -euo pipefail

# ============================================================
# Kapwa — Update Deployment (no data loss)
# ============================================================
# Pulls latest code, rebuilds api/client images, runs pending
# migrations, restarts containers.  Never truncates or reseeds.
# ============================================================

cd "$(dirname "$0")"

echo "=== Kapwa Update ==="
echo ""

# Engine detection: prefer the docker daemon when available, otherwise fall
# back to podman-compose (e.g. local stacks where the docker daemon is down).
if docker info >/dev/null 2>&1; then
  COMPOSE=(docker compose -f kapwa-server/docker-compose.yml)
  EXEC=(docker exec)
  echo "Using engine: docker compose"
else
  COMPOSE=(podman-compose -f kapwa-server/docker-compose.yml)
  EXEC=(podman exec)
  echo "Using engine: podman-compose"
fi
echo ""

# 1. Validate .env.production
if [ ! -f infra/.env.production ]; then
  echo "ERROR: infra/.env.production not found."
  echo "  Copy from .env.example and fill secrets before deploying."
  exit 1
fi

# 2. Pull latest code
echo "[1/4] Pulling latest code..."
git pull --ff-only
echo ""

# 3. Rebuild api + client images (db, minio, caddy unchanged)
echo "[2/4] Rebuilding api and client images..."
if docker info >/dev/null 2>&1; then
  "${COMPOSE[@]}" build --pull api client
else
  # podman-compose's --pull takes a value (missing = pull base images only when absent)
  "${COMPOSE[@]}" build --pull=missing api client
fi
echo ""

# 4. Recreate changed containers (existing volumes preserved)
echo "[3/4] Restarting updated containers..."
"${COMPOSE[@]}" up -d --no-deps api client
echo ""

# 5. Wait for API health through Caddy
echo "[4/4] Waiting for API..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:8090/api/v1/health >/dev/null 2>&1; then
    echo "  API ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "  WARNING: API did not become healthy within 60s."
    echo "  Check logs: ${COMPOSE[@]} logs api"
  fi
  sleep 2
done

# 6. Run pending migrations (never auto-seed — seeds truncate data)
echo ""
echo "  Running pending migrations..."
if "${EXEC[@]}" kapwa-api node dist/database/migrate.js 2>/dev/null; then
  echo "  Migrations applied."
else
  echo "  WARNING: Migration command failed. Check if dist/ is built."
  echo "  Manual: ${EXEC[@]} kapwa-api npm run migration:run"
fi

echo ""
echo "=== Update complete ==="
echo "  App:    http://localhost:8090"
echo "  Swagger: http://localhost:8090/api/docs"
echo ""
echo "To reseed from scratch (WARNING: erases all data):"
echo "  ${EXEC[@]} kapwa-api node dist/database/seed-comprehensive.js"