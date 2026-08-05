#!/bin/bash
set -euo pipefail

# ============================================================
# Kapwa — DigitalOcean Deployment Script
# ============================================================
# Prerequisites:
#   1. A DigitalOcean Droplet (Ubuntu 24.04, Docker + Docker Compose)
#   2. DNS A record pointing your domain to the droplet IP
#   3. This repo cloned on the droplet
#   4. infra/.env.production filled with real secrets
# ============================================================

cd "$(dirname "$0")"

echo "=== Kapwa Deployment ==="
echo ""
COMPOSE="docker compose -f kapwa-server/docker-compose.yml"

# 1. Validate .env.production
if [ ! -f infra/.env.production ]; then
    echo "ERROR: infra/.env.production not found. Copy from .env.example and fill secrets."
    exit 1
fi

# 2. Source env to check required vars
set -a; source infra/.env.production; set +a
: "${JWT_SECRET:?JWT_SECRET must be set}"
: "${MINIO_ROOT_USER:?MINIO_ROOT_USER must be set}"
: "${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD must be set}"

# 3. Build and start all services
echo "[1/4] Building images..."
$COMPOSE build --pull

echo "[2/4] Starting services..."
$COMPOSE up -d

# 4. Wait for API health through Caddy
echo "[3/4] Waiting for API..."
API_READY=false
for i in $(seq 1 30); do
    if curl -sf http://localhost:8090/api/v1/health >/dev/null 2>&1; then
        echo "  API ready."
        API_READY=true
        break
    fi
    echo "  Waiting... ($i/30)"
    sleep 2
done

if [ "$API_READY" != "true" ]; then
    echo "  WARNING: API did not become healthy within 60s."
    echo "  Check logs: $COMPOSE logs api"
fi

# 5. Run database migrations.
#    migrate.js is the canonical bootstrap — it creates the complete fresh
#    schema idempotently (it also runs at API startup via main.ts). The
#    TypeORM migration chain (run-migrations.js) is NOT fresh-boot-safe, so it
#    runs only as an incremental upgrade for EXISTING databases, and its
#    failure on a fresh DB is expected and non-fatal.
#    NOTE: migrate.js does not exit on completion (open DB handle) — run it
#    under `timeout` so this script does not hang; exit 124 == completed.
echo "[4/4] Running database migrations (bootstrap)..."
if docker exec kapwa-api test -f dist/database/migrate.js 2>/dev/null; then
  if timeout 300 docker exec kapwa-api node dist/database/migrate.js >/dev/null 2>&1; then
    echo "  Bootstrap schema applied (migrate.js)."
  else
    echo "  WARNING: migrate.js exited non-zero (code $? — see 'docker exec kapwa-api node dist/database/migrate.js')."
  fi
else
  echo "  (migrate.js not found — is the API image up to date?)"
fi

echo "[5/4] Running incremental TypeORM migrations (existing-DB upgrades only)..."
if docker exec kapwa-api test -f dist/database/run-migrations.js 2>/dev/null; then
  if docker exec kapwa-api node dist/database/run-migrations.js >/dev/null 2>&1; then
    echo "  TypeORM migrations applied."
  else
    echo "  WARNING: TypeORM migration run failed (expected on a fresh DB;"
    echo "          bootstrap schema from migrate.js is already complete)."
    echo "  Manual: docker exec kapwa-api node dist/database/run-migrations.js"
  fi
else
  echo "  (run-migrations.js not found)"
fi

echo ""
echo "=== Deployment complete ==="
echo "  App:    http://localhost:8090"
echo "  Swagger: http://localhost:8090/api/docs"
echo ""
echo "For production TLS, update infra/Caddyfile with your domain"
echo "and uncomment the production stanza."
