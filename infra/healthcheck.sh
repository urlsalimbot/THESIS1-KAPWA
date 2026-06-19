#!/bin/bash
# Kapwa Service Health Check
# Verifies all core services are running and responding.
# Exit 0 if all healthy, exit 1 otherwise.
#
# Usage: ./healthcheck.sh
# Dependencies: pg_isready, curl

set -euo pipefail

FAILED=0

check_service() {
    local name="$1"
    local check_cmd="$2"
    if eval "${check_cmd}" >/dev/null 2>&1; then
        echo "  ✓ ${name} — healthy"
    else
        echo "  ✗ ${name} — FAILED"
        FAILED=1
    fi
}

echo "Kapwa Service Health Check"
echo "=========================="
echo ""

# PostgreSQL health
check_service "PostgreSQL" "pg_isready -h ${DB_HOST:-db} -p ${DB_PORT:-5432} -U ${DB_USER:-kapwa}"

# MinIO health
check_service "MinIO S3 API" "curl -sf http://${MINIO_ENDPOINT:-localhost}:${MINIO_PORT:-9000}/minio/health/live"

# API health
check_service "NestJS API" "curl -sf http://localhost:3000/api/health 2>/dev/null || curl -sf http://api:3000/api/health"

# Caddy health (via port 80)
check_service "Caddy Proxy" "curl -sf http://localhost/health"

echo ""
if [ "${FAILED}" -eq 0 ]; then
    echo "All services healthy."
    exit 0
else
    echo "One or more services failed health check."
    exit 1
fi
