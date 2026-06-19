---
phase: 01-foundation-deploy-authenticate
plan: 01
created: 2026-06-19
status: Incomplete
---

# Phase 01 User Setup: Foundation — Deploy & Authenticate

External services requiring manual configuration before production deployment.

## 1. MinIO (S3-Compatible Object Storage)

S3-compatible object storage for document vault (signatures, vouchers, IRF attachments).

### Required Environment Variables

| Variable | How to Generate | Set In |
|----------|----------------|--------|
| `MINIO_ROOT_USER` | `openssl rand -hex 16` | `infra/.env.production` or Docker secrets |
| `MINIO_ROOT_PASSWORD` | `openssl rand -hex 32` | `infra/.env.production` or Docker secrets |

### Dashboard Configuration

1. Start the stack: `docker compose -f kapwa-server/docker-compose.yml up -d`
2. Open MinIO Console: http://localhost:9001
3. Log in with `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`
4. Verify 6 buckets are auto-created: **worker-signatures**, **client-receipts**, **irf-attachments**, **coa-exports**, **backups**, **documents**
   - If buckets are missing, the NestJS `MinioService.onModuleInit()` will create them on startup, or run:
     ```bash
     npx ts-node kapwa-server/src/minio/init-buckets.ts
     ```

### Verification

```bash
# Check MinIO health
curl -f http://localhost:9000/minio/health/live

# List buckets (requires mc client)
mc alias set kapwa http://localhost:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD
mc ls kapwa
```

## 2. Caddy 2 (Reverse Proxy with Auto-TLS)

Reverse proxy with rate limiting, security headers, and automatic Let's Encrypt TLS.

### Required Environment Variables

| Variable | How to Generate | Set In |
|----------|----------------|--------|
| `CADDY_DOMAIN` | Your production domain (e.g., `kapwa.mswdo-norzagaray.gov.ph`) | `infra/.env.production` |
| `CADDY_EMAIL` | Admin email for Let's Encrypt certificate notifications | `infra/.env.production` |

### Production Configuration

In production, uncomment and customize the `tls` section in `infra/Caddyfile`:

```
# Replace :80 with domain
kapwa.mswdo-norzagaray.gov.ph {
    tls admin@mswdo-norzagaray.gov.ph
    # ... copy all handlers from :80 block ...
}
```

### Verification

```bash
# Caddy is running and proxying API requests
curl -f http://localhost/health
curl -f http://localhost/api/docs
```

## 3. Production Environment Variables

Copy `infra/.env.production` to `.env` and fill in ALL values:

```bash
cp infra/.env.production .env
# Edit .env with real values:
# - DB_PASSWORD (strong password)
# - JWT_SECRET, SYNC_SECRET (openssl rand -hex 32)
# - MINIO_ROOT_USER, MINIO_ROOT_PASSWORD
# - TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
```

## Verification Commands

After all setup, run:

```bash
# 1. Start the stack
docker compose -f kapwa-server/docker-compose.yml up -d

# 2. Check all services are healthy
docker compose -f kapwa-server/docker-compose.yml ps

# 3. Run health check
bash infra/healthcheck.sh

# 4. Run e2e test (optional)
npx playwright test tests/e2e/auth-flow.spec.ts --config=tests/playwright.config.ts
```

## Status

- [ ] MinIO credentials generated
- [ ] Caddy domain configured
- [ ] Production .env populated
- [ ] `infra/healthcheck.sh` returns all healthy
