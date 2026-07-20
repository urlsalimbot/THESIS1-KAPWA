#!/bin/bash
set -euo pipefail

# ============================================================
# Kapwa — DigitalOcean Deployment Script
# ============================================================
# Prerequisites:
#   1. A DigitalOcean Droplet (Ubuntu 24.04, Podman + Podman Compose)
#   2. DNS A record pointing your domain to the droplet IP
#   3. This repo cloned on the droplet
#   4. infra/.env.production filled with real secrets
# ============================================================

cd "$(dirname "$0")"

echo "=== Kapwa Deployment ==="
echo ""
COMPOSE="docker-compose -f kapwa-server/docker-compose.yml"

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
echo "[1/3] Building images..."
$COMPOSE build --pull

echo "[2/3] Starting services..."
$COMPOSE up -d

# 4. Wait for API health through Caddy
echo "[3/3] Waiting for API..."
for i in $(seq 1 30); do
    if curl -sf http://localhost:8090/api/v1/health >/dev/null 2>&1; then
        echo "  API ready."
        break
    fi
    sleep 2
done

echo ""
echo "=== Deployment complete ==="
echo "  App:    http://localhost:8090"
echo "  Swagger: http://localhost:8090/api/docs"
echo ""
echo "For production TLS, update infra/Caddyfile with your domain"
echo "and uncomment the production stanza."
