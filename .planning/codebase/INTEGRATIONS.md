# External Integrations

**Analysis Date:** 2026-06-19

## APIs & External Services

**SMS Gateway (Twilio):**
- Service: [Twilio](https://www.twilio.com) - Sends SMS OTP codes and notifications
- SDK: `twilio` 6.0 (`kapwa-server/package.json`)
- Auth: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` (environment variables)
- Implementation: `kapwa-server/src/otp/sms-gateway.service.ts` — lazy-init Twilio SDK; falls back to dev log mode when credentials are missing or `NODE_ENV` is not production
- Used by: OTP service (`otp.service.ts`) and Notifications service (`notifications.service.ts`)

**Swagger/OpenAPI:**
- Service: Self-hosted Swagger UI via `@nestjs/swagger` 11.4
- Endpoint: `GET /api/docs` at runtime
- Config: `kapwa-server/src/main.ts` — DocumentBuilder with bearer auth

## Data Storage

**Databases:**
- **PostgreSQL 16** — Primary data store
  - Connection: Environment variables `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
  - ORM: TypeORM 0.4 alpha via `@nestjs/typeorm` 11.0
  - Migrations: `kapwa-server/src/database/migrations/` (4 migration files)
  - Naming: Snake-case naming strategy (`kapwa-server/src/database/snake-naming.strategy.ts`)
  - Extensions: `uuid-ossp`, `pgcrypto`, `pg_trgm`, `pgAudit`
  - Security: Row-Level Security (RLS) enabled on beneficiaries, cases, interventions, consent_ledger, irf_cases tables

**File Storage:**
- Local filesystem under `kapwa-server/uploads/` — File uploads for document vault (signatures, vouchers, attachments)
- MinIO/S3-compatible storage is specified in `KAPWA-PROJECT.md` as a planned integration but NOT yet implemented in code

**Caching:**
- None — No Redis, Memcached, or in-memory cache framework detected
- The sync service (`sync.service.ts`) maintains a small in-memory idempotency cache (Map with 10,000 entry limit, 24h TTL)

**Client-Local Storage:**
- localStorage-based encrypted database (`kapwa-client/src/lib/encrypted-db.ts`) using AES-256-GCM + PBKDF2
- localStorage-based offline sync queue (`kapwa-client/src/lib/offline-queue.ts`)
- localStorage-based flat database (`kapwa-client/src/lib/database.ts`) with CRUD operations

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication
  - Implementation: `kapwa-server/src/auth/`
  - Strategy: Passport JWT Bearer token (`passport-jwt`)
  - Access tokens: 1h expiry, refresh tokens: 7d expiry
  - Token rotation via version counter (`tokenVersion` field on User entity)

**Multi-Factor Authentication:**
- TOTP-based MFA (custom implementation, no library) — `kapwa-server/src/auth/totp.ts`
- SMS OTP via Twilio — `kapwa-server/src/otp/`
  - 6-digit codes, 5-minute expiry, rate-limited (per-phone cooldown)
  - OTP codes stored as SHA-256 hashes

**Role-Based Access:**
- Roles: `social_worker`, `admin`, `coordinator`, `claimant`, `mayor`, `auditor`
- ABAC (Attribute-Based Access Control) service: `kapwa-server/src/auth/services/abac.service.ts`
- Roles Guard: `kapwa-server/src/auth/guards/roles.guard.ts`
- RLS policies in PostgreSQL enforce data-scoping by barangay and role

**Device Binding:**
- Ed25519 key pair generated in browser via Web Crypto API
- Device identity: public key fingerprint stored in localStorage (`kapwa_device_id`)
- Used for sync protocol message signing

## Monitoring & Observability

**Error Tracking:**
- None — No Sentry, DataDog, or similar error tracking detected
- Server-side: NestJS logger (console-based), AllExceptionsFilter for global error handling (`kapwa-server/src/common/filters/http-exception.filter.ts`)

**Logs:**
- Server: Console logging via NestJS Logger, `server.log` file
- Audit: PostgreSQL `pgAudit` extension captures all database DDL/DML
- Hash-chain audit: SHA-256 linked chain on `interventions` table (`kapwa-server/src/audit/`)

**Compliance Auditing:**
- `kapwa-server/src/database/compliance-audit.ts` — Script that verifies RLS, consent ledger, hash chains, schema completeness

## CI/CD & Deployment

**Hosting:**
- Docker Compose deployment (local/server) — `kapwa-server/docker-compose.yml`
- API container: Node 20 Alpine (`kapwa-server/Dockerfile`)
- DB container: PostgreSQL 16 with pgAudit (`kapwa-server/Dockerfile.db`)

**CI Pipeline:**
- None detected — No GitHub Actions, GitLab CI, or similar configuration

## Environment Configuration

**Required env vars (Server):**
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — PostgreSQL connection
- `JWT_SECRET` — JWT signing key (required, app errors on startup if missing)
- `SYNC_SECRET` — Sync protocol shared secret
- `PORT` — API listen port (default 3000)

**Optional env vars (Server):**
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` — SMS (dev fallback if absent)
- `NODE_ENV` — Controls production SMS failure behavior

**Required env vars (Client):**
- `VITE_API_URL` — API base URL (default `http://localhost:3000/api`)
- `VITE_WS_URL` — WebSocket URL (default `http://localhost:3000`)

**Secrets location:**
- `kapwa-server/.env` file (gitignored)
- `docker-compose.yml` has defaults for development (not for production)

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected

---

*Integration audit: 2026-06-19*
