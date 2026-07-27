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

# 5. Run TypeORM migrations (with migrate.ts fallback)
echo "[4/4] Running database migrations..."
MIGRATIONS_OK=false
if docker exec kapwa-api test -f dist/database/run-migrations.js 2>/dev/null; then
  if docker exec kapwa-api node dist/database/run-migrations.js 2>/dev/null; then
    echo "  TypeORM migrations applied."
    MIGRATIONS_OK=true
  else
    echo "  WARNING: TypeORM migration command failed."
    echo "  Will try supplementary migrations as fallback."
  fi
else
  echo "  (run-migrations.js not found)"
fi

if [ "$MIGRATIONS_OK" != "true" ] && docker exec kapwa-api test -f dist/database/migrate.js 2>/dev/null; then
  echo "  Running supplementary migrations (migrate.js)..."
  if docker exec kapwa-api node dist/database/migrate.js 2>/dev/null; then
    echo "  Supplementary migrations applied."
    MIGRATIONS_OK=true
  else
    echo "  WARNING: Supplementary migration command failed."
    echo "  Manual: docker exec kapwa-api node dist/database/migrate.js"
  fi
fi

echo ""
echo "=== Deployment complete ==="
echo "  App:    http://localhost:8090"
echo "  Swagger: http://localhost:8090/api/docs"
echo ""
echo "For production TLS, update infra/Caddyfile with your domain"
echo "and uncomment the production stanza."
