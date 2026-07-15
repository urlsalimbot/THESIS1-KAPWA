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
docker compose -f kapwa-server/docker-compose.yml build --pull

echo "[2/3] Starting services..."
docker compose -f kapwa-server/docker-compose.yml up -d

# 4. Wait for API health
echo "[3/3] Waiting for API..."
for i in $(seq 1 30); do
    if curl -sf http://localhost:3000/api/ >/dev/null 2>&1; then
        echo "  API ready."
        break
    fi
    sleep 2
done

echo ""
echo "=== Deployment complete ==="
echo "  Caddy:  http://localhost:8080"
echo "  API:    http://localhost:3000/api/"
echo "  Swagger: http://localhost:3000/api/docs"
echo ""
echo "For production TLS, update infra/Caddyfile with your domain"
echo "and uncomment the production stanza."
