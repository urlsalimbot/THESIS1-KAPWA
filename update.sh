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
docker compose -f kapwa-server/docker-compose.yml build --pull api client
echo ""

# 4. Recreate changed containers (existing volumes preserved)
echo "[3/4] Restarting updated containers..."
docker compose -f kapwa-server/docker-compose.yml up -d --no-deps api client
echo ""

# 5. Wait for API health
echo "[4/4] Waiting for API..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:8090/api/v1/health >/dev/null 2>&1; then
    echo "  API ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "  WARNING: API did not become healthy within 60s."
    echo "  Check logs: docker compose -f kapwa-server/docker-compose.yml logs api"
  fi
  sleep 2
done

# 6. Run pending migrations (never auto-seed — seeds truncate data)
echo ""
echo "  Running pending migrations..."
if docker exec kapwa-api node dist/database/migrate.js 2>/dev/null; then
  echo "  Migrations applied."
else
  echo "  WARNING: Migration command failed. Check if dist/ is built."
  echo "  Manual: docker exec kapwa-api npm run migration:run"
fi

echo ""
echo "=== Update complete ==="
echo "  API:    http://localhost:3000/api/"
echo "  Client: http://localhost:8090"
echo ""
echo "To reseed from scratch (WARNING: erases all data):"
echo "  docker exec kapwa-api node dist/database/seed-comprehensive.js"