#!/usr/bin/env bash
# ============================================================
# KAPWA — AWS Deployment Script (EC2 API + RDS + S3/CloudFront)
# ============================================================
# Deploys the AWS-managed stack documented in docs/DEPLOYMENT-AWS.md:
#
#   1. API  -> EC2, rebuilt from kapwa-server/docker-compose.aws.yml
#   2. DB   -> fresh-boot bootstrap (idempotent) + pending migrations.
#              NEVER seeds — seeds truncate data.
#   3. SPA  -> built in place, synced to S3 with the correct cache
#              headers, then invalidated on CloudFront.
#
# Usage: ./deploy-aws.sh [all|api|frontend]      (default: all)
#
# Modes:
#   AWS_HOST=<user@host>  (default) — run from a dev machine; rsyncs the repo
#                                     to the EC2 over SSH.
#   AWS_HOST=local                  — run ON the EC2 (self-hosted runner or
#                                     by hand); operates in place.
#
# Prerequisites: ssh + rsync (remote mode), docker (on the host),
#                node/npm (frontend build), aws CLI v2.
#
# Credentials:
#   Remote mode: pass a profile via AWS_PROFILE_NAME (default `kapwa`).
#   Local mode:  set AWS_PROFILE_NAME="" and provide AWS_ACCESS_KEY_ID /
#                AWS_SECRET_ACCESS_KEY in the environment.
#   `api` mode needs no AWS credentials at all.
# ============================================================
set -euo pipefail

cd "$(dirname "$0")"

MODE="${1:-all}"
case "$MODE" in
  all|api|frontend) ;;
  *) echo "usage: $0 [all|api|frontend]" >&2; exit 2 ;;
esac

# --- configuration (override via environment) --------------------------------
AWS_HOST="${AWS_HOST:-ubuntu@3.1.190.141}"
AWS_SSH_KEY="${AWS_SSH_KEY:-$HOME/.ssh/kapwa-key.pem}"
AWS_REGION_NAME="${AWS_REGION_NAME:-ap-southeast-1}"
AWS_PROFILE_NAME="${AWS_PROFILE_NAME-kapwa}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/kapwa}"
FRONTEND_BUCKET="${FRONTEND_BUCKET:-kapwa-software-frontend}"
CF_DIST_ID="${CF_DIST_ID:-E121A545H6DE4O}"
COMPOSE_FILE="kapwa-server/docker-compose.aws.yml"
API_CONTAINER="kapwa-api"
PUBLIC_URL="${PUBLIC_URL:-https://kapwa.software}"

case "$MODE" in
  all)      STEPS="Prepare|Sync repo|Validate env|Build API|Health|Migrate|Publish SPA" ;;
  api)      STEPS="Prepare|Sync repo|Validate env|Build API|Health|Migrate" ;;
  frontend) STEPS="Prepare|Publish SPA" ;;
esac
TOTAL_STEPS=$(echo "$STEPS" | tr '|' '\n' | wc -l | tr -d ' ')
STEP_N=0

log()  { echo "  $*"; }
step() { STEP_N=$((STEP_N + 1)); echo ""; echo "─── [$STEP_N/$TOTAL_STEPS] $1 ───"; }
die()  { echo "ERROR: $*" >&2; exit 1; }

AWS_ARGS=(--region "$AWS_REGION_NAME")
if [ -n "$AWS_PROFILE_NAME" ]; then
  AWS_ARGS+=(--profile "$AWS_PROFILE_NAME")
fi

remote() {
  if [ "$AWS_HOST" = "local" ]; then
    bash -lc "$1"
  else
    ssh -i "$AWS_SSH_KEY" -o StrictHostKeyChecking=accept-new -o BatchMode=yes "$AWS_HOST" "$1"
  fi
}

echo "=== KAPWA AWS Deployment ($MODE) ==="
echo "  target: $AWS_HOST  ($([ "$AWS_HOST" = local ] && echo "self-hosted" || echo remote))"

# ── 1. Validate tooling ──────────────────────────────────────────────────────
step "Validate tooling and credentials"
if [ "$MODE" != "api" ]; then
  command -v node >/dev/null || die "node not found (needed to build the SPA)"
  command -v npm  >/dev/null || die "npm not found (needed to build the SPA)"
fi
if [ "$MODE" != "frontend" ]; then
  if [ "$AWS_HOST" = "local" ]; then
    command -v docker >/dev/null || die "docker not found"
  else
    command -v ssh   >/dev/null || die "ssh not found"
    command -v rsync >/dev/null || die "rsync not found"
    [ -f "$AWS_SSH_KEY" ] || die "SSH key not found: $AWS_SSH_KEY"
  fi
fi
if [ "$MODE" != "api" ]; then
  command -v aws >/dev/null || die "aws CLI not found"
  aws sts get-caller-identity "${AWS_ARGS[@]}" >/dev/null 2>&1 \
    || die "AWS credentials invalid/expired. Run: aws login ${AWS_PROFILE_NAME:+--profile $AWS_PROFILE_NAME}"
  log "AWS credentials OK"
fi
log "tooling OK"

if [ "$MODE" != "frontend" ]; then
  # ── 2. Sync repository (remote mode only) ──────────────────────────────────
  step "Sync repository"
  if [ "$AWS_HOST" = "local" ]; then
    log "local mode — using the working tree in place"
  else
    rsync -az --delete \
      --exclude '.git/' --exclude 'node_modules/' --exclude 'dist/' --exclude 'coverage/' \
      --exclude '.planning/' --exclude '.superpowers/' --exclude '.playwright-mcp/' \
      --exclude '*.log' --exclude 'infra/.env.production' --exclude 'infra/.env' \
      --exclude 'kapwa-server/docker-compose.override.yml' --exclude 'test-results/' \
      -e "ssh -i $AWS_SSH_KEY -o StrictHostKeyChecking=accept-new" \
      ./ "$AWS_HOST:$DEPLOY_PATH/" && log "synced to $AWS_HOST:$DEPLOY_PATH"
  fi

  # ── 3. Validate server-side env ────────────────────────────────────────────
  step "Validate server-side env"
  remote "test -f $DEPLOY_PATH/infra/.env.production" \
    || die "$DEPLOY_PATH/infra/.env.production missing on the host (secrets are never synced)"
  log "infra/.env.production present"

  # ── 4. Build + restart the API ─────────────────────────────────────────────
  step "Build and restart the API"
  remote "cd $DEPLOY_PATH && docker compose -f $COMPOSE_FILE up -d --build api" >/dev/null
  log "API image rebuilt and container recreated"

  # ── 5. Wait for health ─────────────────────────────────────────────────────
  step "Wait for API health"
  HEALTHY=0
  for i in $(seq 1 30); do
    if remote "curl -sf http://localhost:3000/api/v1/health" >/dev/null 2>&1; then
      HEALTHY=1; log "API healthy"; break
    fi
    sleep 4
  done
  [ "$HEALTHY" = "1" ] || die "API did not become healthy in 120s — check: docker logs $API_CONTAINER"

  # ── 6. Apply schema ────────────────────────────────────────────────────────
  step "Apply schema (bootstrap + incremental migrations, no seeding)"
  remote "cd $DEPLOY_PATH && docker exec $API_CONTAINER node dist/database/migrate.js" >/dev/null \
    && log "fresh-boot bootstrap applied (idempotent)" \
    || log "WARNING: migrate.js failed — run manually: docker exec $API_CONTAINER node dist/database/migrate.js"
  remote "cd $DEPLOY_PATH && docker exec $API_CONTAINER node dist/database/run-migrations.js" >/dev/null \
    && log "incremental migrations applied" \
    || log "WARNING: incremental migrations failed — run manually: docker exec $API_CONTAINER node dist/database/run-migrations.js"
fi

if [ "$MODE" != "api" ]; then
  # ── 7. Build + publish the SPA ─────────────────────────────────────────────
  step "Build and publish the SPA"
  cd kapwa-client
  [ -d node_modules ] || { log "installing client deps..."; npm ci >/dev/null 2>&1; }
  VITE_API_URL=/api/v1 VITE_WS_URL="" npm run build >/dev/null
  log "SPA built"
  aws s3 sync dist/ "s3://$FRONTEND_BUCKET/" --delete "${AWS_ARGS[@]}" \
    --cache-control "no-cache" --exclude "assets/*" >/dev/null
  aws s3 sync dist/assets/ "s3://$FRONTEND_BUCKET/assets/" "${AWS_ARGS[@]}" \
    --cache-control "public, max-age=31536000, immutable" >/dev/null
  log "uploaded to s3://$FRONTEND_BUCKET"
  aws cloudfront create-invalidation --distribution-id "$CF_DIST_ID" --paths "/*" "${AWS_ARGS[@]}" >/dev/null
  log "CloudFront invalidation requested"
fi

echo ""
echo "=== Deployment complete ($MODE) ==="
echo "  App:  $PUBLIC_URL"
echo "  Docs: $PUBLIC_URL/api/docs"
