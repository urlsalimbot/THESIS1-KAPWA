#!/bin/bash
set -euo pipefail

# ============================================================
# KAPWA — Deployment Script
# ============================================================
# Deploys the full stack (Postgres, MinIO, API, client, Caddy) on a
# Docker host. Intended to be run from the repo root on the target
# machine — the GitHub Actions Deploy workflow (self-hosted runner)
# rsyncs the repo to DEPLOY_PATH and invokes this script.
#
# Prerequisites:
#   1. A Docker host (Ubuntu + Docker + Compose v2) — e.g. a self-owned PC
#   2. infra/.env.production present with real secrets (never committed)
#   3. The deploy user in the `docker` group (no sudo needed)
# ============================================================

cd "$(dirname "$0")"

TOTAL_STEPS=7

log() { echo "  $*"; }
step() { echo ""; echo "─── [$1/$TOTAL_STEPS] $2 ───"; }

COMPOSE="docker compose -f kapwa-server/docker-compose.yml"

echo "=== KAPWA Deployment ==="

# 1. Validate infra/.env.production exists
step 1 "Validate infra/.env.production"
if [ ! -f infra/.env.production ]; then
    echo "ERROR: infra/.env.production not found. Copy from .env.example and fill secrets."
    exit 1
fi
log "infra/.env.production present."

# 2. Validate required secrets (fail fast — the API refuses to boot without them)
step 2 "Validate required secrets"
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
log "Required secrets OK (JWT, MinIO, IRF)."

# 3. Build images
step 3 "Build images"
$COMPOSE build --pull

# 4. Start services
step 4 "Start services"
$COMPOSE up -d

# 5. Wait for API health through Caddy
step 5 "Wait for API health"
API_READY=false
for i in $(seq 1 30); do
    if curl -sf http://localhost:8090/api/v1/health >/dev/null 2>&1; then
        log "API ready."
        API_READY=true
        break
    fi
    log "Waiting... ($i/30)"
    sleep 2
done

if [ "$API_READY" != "true" ]; then
    echo "  WARNING: API did not become healthy within 60s."
    echo "  Check logs: $COMPOSE logs api"
fi

# 6. Apply schema.
#    migrate.js is the canonical bootstrap — it creates the complete fresh
#    schema idempotently and marks the TypeORM chain as applied (it also runs
#    at API startup via main.ts). run-migrations.js is therefore a no-op on
#    fresh deployments and only applies pending upgrades on existing DBs.
step 6 "Apply schema (bootstrap + incremental migrations)"
if docker exec kapwa-api test -f dist/database/migrate.js 2>/dev/null; then
  if timeout 300 docker exec kapwa-api node dist/database/migrate.js >/dev/null 2>&1; then
    log "Bootstrap schema applied (migrate.js)."
  else
    RC=$?
    echo "  WARNING: migrate.js exited non-zero (code $RC)."
    echo "  Manual: docker exec kapwa-api node dist/database/migrate.js"
  fi
else
  echo "  (migrate.js not found — is the API image up to date?)"
fi

if docker exec kapwa-api test -f dist/database/run-migrations.js 2>/dev/null; then
  if docker exec kapwa-api node dist/database/run-migrations.js >/dev/null 2>&1; then
    log "Incremental TypeORM migrations applied."
  else
    echo "  WARNING: incremental TypeORM migrations failed."
    echo "  Manual: docker exec kapwa-api node dist/database/run-migrations.js"
  fi
else
  echo "  (run-migrations.js not found)"
fi

# 7. Seed initial accounts (empty DB only)
step 7 "Seed initial accounts (empty DB only)"
USERS=$(docker exec kapwa-api node -e "const{AppDataSource}=require('./dist/database/data-source.js');(async()=>{await AppDataSource.initialize();const c=await AppDataSource.query('SELECT COUNT(*)::int AS c FROM users');console.log(c[0].c);await AppDataSource.destroy()})().catch(e=>{console.error(e.message);process.exit(1)})" 2>/dev/null || echo "ERR")
if [ "$USERS" = "0" ]; then
  if docker exec kapwa-api node dist/database/seed-accounts.js >/dev/null 2>&1 \
     && docker exec kapwa-api node dist/database/seed-programs.js >/dev/null 2>&1; then
    log "Seed accounts + programs applied (test credentials — change before going live)."
  else
    echo "  WARNING: seeding failed — run manually:"
    echo "    docker exec kapwa-api node dist/database/seed-accounts.js"
    echo "    docker exec kapwa-api node dist/database/seed-programs.js"
  fi
elif [ "$USERS" = "ERR" ]; then
  echo "  WARNING: could not read user count — skipping seeds (run manually if needed)."
else
  log "Users already exist ($USERS) — seeds skipped."
fi

echo ""
echo "=== Deployment complete ==="
echo "  App:      http://localhost:8090"
echo "  Swagger:  http://localhost:8090/api/docs"
echo ""
echo "For production TLS, update infra/Caddyfile with your domain"
echo "and uncomment the production stanza."