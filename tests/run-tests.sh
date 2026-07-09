#!/bin/bash
set -e

echo "=== KAPWA Test Setup ==="

# Start db container with Podman (rootless — port 5433 is safe)
podman run -d --name kapwa-test-db \
  -e POSTGRES_USER=kapwa \
  -e POSTGRES_PASSWORD=kapwa \
  -e POSTGRES_DB=kapwa_test \
  -p 5433:5432 \
  postgres:16

# Wait for db
sleep 5

# Run migrations
podman exec kapwa-test-db psql -U kapwa -d kapwa_test -f /docker-entrypoint-initdb.d/init.sql || true

echo "=== Running Tests ==="
cd kapwa-client
npm run test:run

echo "=== Tests Complete ==="