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
# The API refuses to boot in production without a valid IRF_ENCRYPTION_KEY
# (fail-closed), so fail fast here instead of boot-looping the API container.
: "${IRF_ENCRYPTION_KEY:?IRF_ENCRYPTION_KEY must be set - generate one with: openssl rand -hex 32}"
if [ "${#IRF_ENCRYPTION_KEY}" -lt 64 ]; then
    echo "ERROR: IRF_ENCRYPTION_KEY must be at least 64 hex chars (32 bytes). Got ${#IRF_ENCRYPTION_KEY}."
    echo "  Generate one with: openssl rand -hex 32"
    exit 1
fi

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
#    schema idempotently and marks the TypeORM chain as applied (it also runs
#    at API startup via main.ts). run-migrations.js is therefore a no-op on
#    fresh deployments and only applies pending upgrades on existing DBs.
#    NOTE: migrate.js exits cleanly on completion (connections are closed).
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
    echo "  WARNING: TypeORM migration run failed."
    echo "  Manual: docker exec kapwa-api node dist/database/run-migrations.js"
  fi
else
  echo "  (run-migrations.js not found)"
fi

echo "[6/4] Seeding initial accounts (empty DB only)..."
USERS=$(docker exec kapwa-api node -e "const{AppDataSource}=require('./dist/database/data-source.js');(async()=>{await AppDataSource.initialize();const c=await AppDataSource.query('SELECT COUNT(*)::int AS c FROM users');console.log(c[0].c);await AppDataSource.destroy()})().catch(e=>{console.error(e.message);process.exit(1)})" 2>/dev/null || echo "ERR")
if [ "$USERS" = "0" ]; then
  if docker exec kapwa-api node dist/database/seed-accounts.js >/dev/null 2>&1 \
     && docker exec kapwa-api node dist/database/seed-programs.js >/dev/null 2>&1; then
    echo "  Seed accounts + programs applied (test credentials - change before going live)."
  else
    echo "  WARNING: seeding failed - run manually:"
    echo "    docker exec kapwa-api node dist/database/seed-accounts.js"
    echo "    docker exec kapwa-api node dist/database/seed-programs.js"
  fi
elif [ "$USERS" = "ERR" ]; then
  echo "  WARNING: could not read user count - skipping seeds (run manually if needed)."
else
  echo "  Users already exist ($USERS) - seeds skipped."
fi

echo ""
echo "=== Deployment complete ==="
echo "  App:    http://localhost:8090"
echo "  Swagger: http://localhost:8090/api/docs"
echo ""
echo "For production TLS, update infra/Caddyfile with your domain"
echo "and uncomment the production stanza."
