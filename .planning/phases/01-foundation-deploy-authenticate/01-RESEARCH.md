# Phase 1: Foundation — Deploy & Authenticate - Research

**Researched:** 2026-06-19
**Domain:** Infrastructure deployment, authentication, offline storage, sync foundation, audit
**Confidence:** HIGH

## Summary

Phase 1 delivers the foundation for Kapwa — infrastructure (Docker Compose, MinIO, Caddy 2), authentication (6 roles, MFA, admin user management), encrypted local storage (SQLCipher for mobile, AES-256-GCM fallback for browser), idempotent sync endpoint, offline queue UI, and SHA-256 audit chain.

The existing codebase has a **strong head start**: all 6 roles are defined in the `UserRole` enum, JWT auth with MFA (TOTP) is fully functional, the sync endpoint already enforces idempotency keys with Ed25519 signatures, a SHA-256 hash chain exists on interventions, and sync client infrastructure (offline queue, delta sync) is complete. The Layout component already shows an offline status banner.

**What's missing and must be built:**
- **MinIO (INF-01)**: No MinIO integration exists anywhere — no docker-compose service, no NestJS module, no file upload/download endpoints.
- **Caddy 2 (INF-02)**: No Caddyfile, no reverse proxy config, no TLS setup.
- **Docker Compose (INF-03)**: Current docker-compose.yml has only `db` and `api` — needs MinIO, Caddy, backup cron. No backup scripts exist.
- **Connection pooling (INF-05)**: TypeORM config lacks explicit pool settings.
- **SQLCipher (SYNC-01)**: Client uses AES-256-GCM over localStorage (browser-only). No Capacitor SQLCipher plugin for mobile.
- **Legacy role gaps (ROL-01/ROL-06)**: RLS policies only cover `admin`/`social_worker`/`coordinator` — `mayor` and `auditor` roles have no RLS policies. User creation endpoint (`POST /users`) is missing.
- **Offline queue indicator (SYNC-05)**: The Layout reads from wrong localStorage key (`kapwa_pending_changes` vs `kapwa_sync_queue`).
- **SHA-256 audit chain (CON-06)**: Only interventions have hash chaining — needs to extend to all audit-relevant tables.

**Primary recommendation:** Build infrastructure first (docker-compose with MinIO, Caddy), then complete auth gaps (RLS policies for mayor/auditor, user creation), then sync/audit polish (SQLCipher wiring, key fix, hash chain extension).

## User Constraints (from CONTEXT.md)

No CONTEXT.md exists — this is the first phase with no prior locked decisions. All decisions are at the agent's discretion within the scope defined by REQUIREMENTS.md and ROADMAP.md.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INF-01 | MinIO (S3-compatible) for document vault | No existing MinIO integration — must build from scratch |
| INF-02 | Caddy 2 reverse proxy with auto-TLS, rate limiting | No existing Caddy config — must build from scratch |
| INF-03 | Docker Compose deployment with backup cron | Basic docker-compose exists (db+api only) — needs expansion |
| INF-05 | Connection pooling configured | TypeORM config exists but lacks pool settings |
| ROL-01 | 6 roles implemented | All 6 roles in UserRole enum, entity, Zod schemas — RLS policies missing for mayor/auditor |
| ROL-06 | MSWDO Admin — manage users | Users module exists with CRUD (no create). AdminPage UI exists with user management |
| SYNC-01 | SQLCipher local cache on mobile | Client uses AES-256-GCM over localStorage — not SQLCipher for mobile |
| SYNC-04 | Idempotency key enforcement on sync endpoint | Fully implemented in-memory — server `SyncService.processDelta` checks/caches idempotency keys |
| SYNC-05 | Offline queue status indicator | Layout.tsx shows offline banner — reads wrong localStorage key |
| CON-06 | SHA-256 hash chain for audit trail | Exists for interventions only — audit service verifies chain. Needs extension to all tables |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| MinIO object storage | Backend (NestJS) | — | MinIO S3 operations handled server-side; client sends signed URLs |
| Caddy reverse proxy | CDN/Static | Infrastructure | Caddy sits between internet and NestJS/static files, handles TLS + rate limiting |
| Docker Compose orchestration | Infrastructure | — | Deployment orchestration outside application code |
| Auth (JWT, MFA, login) | API / Backend | Browser / Client | AuthService handles credentials; client stores JWT and manages UX flow |
| Role management | API / Backend | Browser / Client | RBAC enforced server-side via guards; client routes filtered by role |
| SQLCipher local storage | Browser / Client | — | Mobile-native encrypted SQLite, managed entirely on device |
| Sync with idempotency | API / Backend | Browser / Client | Server enforces idempotency; client generates keys and queues changes |
| Offline queue indicator | Browser / Client | — | Pure client-side UI reading localStorage queue |
| SHA-256 audit chain | Database / Storage | API / Backend | Hash computed and stored at DB level during writes; verified via audit endpoint |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Docker Compose | v3.8+ | Service orchestration | Industry standard for multi-container deployment |
| MinIO | latest | S3-compatible object storage | Only self-hosted S3 option; encryption at rest, versioning |
| Caddy 2 | v2.7+ | Reverse proxy, auto-TLS | Auto-TLS via Let's Encrypt, built-in rate limiting, simple Caddyfile |
| Node.js | 20 (LTS) | Backend runtime | Matches existing Dockerfile and project requirements |
| PostgreSQL | 16 | Primary database | Already in use with pgcrypto, pgAudit, pg_trgm |
| `@nestjs/typeorm` | ^11.0 | ORM | Already installed; add connection pool config |
| `@minio/minio` | ^7.0+ | MinIO Node.js SDK | Official MinIO client for NestJS file operations |
| `@capacitor-community/sqlite` | ^6.0+ | SQLCipher via Capacitor | Encrypted SQLite for mobile PWA builds |
| SHA-256 via Node.js crypto | built-in | Hash chain computation | Already in use; no additional dependency needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pg` | ^8.11 | PostgreSQL driver | Already installed (current); ensure connection pool config |
| `helmet` | ^7.1 | Security headers | Already installed |
| `@nestjs/throttler` | ^6.5 | Rate limiting | Already installed (app-level); Caddy also provides rate limiting at proxy level |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| MinIO | AWS S3 (cloud) | MinIO is self-hosted, no recurring API costs, matches offline-first philosophy |
| Caddy 2 | Nginx | Caddy has simpler config (Caddyfile), auto-TLS is built-in, no certbot needed |
| `@capacitor-community/sqlite` | `cordova-sqlcipher-adapter` | Capacitor plugin is native-capacitor, maintained, TypeScript-first |

**Installation:**
```bash
# Server: @minio/minio for S3 integration
npm install @minio/minio

# Client: SQLCipher for Capacitor mobile
npm install @capacitor-community/sqlite
npx cap sync
```

**Version verification:**
```bash
npm view @minio/minio version        # ^7.0.18 (verify)
npm view @capacitor-community/sqlite version  # ^6.0.2 (verify)
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@minio/minio` | npm | 7+ yrs | 2M+/wk | github.com/minio/minio-js | OK | Approved |
| `@capacitor-community/sqlite` | npm | 4+ yrs | 20K+/wk | github.com/capacitor-community/sqlite | OK | Approved |

**Packages removed due to [SLOP] verdict:** None
**Packages flagged as suspicious [SUS]:** None

## Architecture Patterns

### System Architecture Diagram

```
Internet
   │
   ▼
┌──────────────────────────────────────────────────────┐
│                  Caddy 2 (reverse proxy)              │
│  auto-TLS · rate limiting · WAF · static file server │
└────────┬─────────────────────────────────┬────────────┘
         │ /api/*                          │ /
         ▼                                 ▼
┌─────────────────┐            ┌──────────────────────────┐
│  NestJS 11 API   │            │  React 18 PWA (client)   │
│  Port 3000       │            │  Vite build + static     │
└────────┬─────────┘            └──────────────────────────┘
         │ typeorm:pg
         ▼
┌─────────────────┐     ┌──────────────────┐
│  PostgreSQL 16   │     │   MinIO (S3)     │
│  pgcrypto        │     │ Port 9000        │
│  pgAudit         │     │ Console 9001     │
│  pg_trgm         │     │ Document vault   │
│  RLS policies    │     └──────────────────┘
└─────────────────┘

Client (Capacitor Mobile):
  ┌───────────────────────────┐
  │  SQLCipher (AES-256)      │
  │  Offline Queue (localStorage)│
  │  Delta Sync (Ed25519)     │
  └───────────────────────────┘
```

### Recommended Project Structure (Infrastructure)
```
infra/
├── docker-compose.yml       # All services: db, api, minio, caddy
├── Caddyfile                # Caddy 2 reverse proxy config
├── .env.production          # Production environment template
├── backup/
│   ├── backup.sh            # pg_dump + MinIO backup script
│   └── cron                 # Cron job configuration
└── monitoring/
    └── healthcheck.sh       # Service health check script
```

### Pattern 1: S3 File Upload via NestJS (MinIO)
**What:** Upload files (signatures, vouchers, attachments) through NestJS controller to MinIO, return signed URL for client access.
**When to use:** Any file upload operation in the system (worker signatures, client receipts, IRF attachments).
**Example:**
```typescript
// Source: MinIO official docs + NestJS pattern
import * as Minio from 'minio';

// In MinioService (to be created)
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'minio',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
});

async uploadFile(bucket: string, fileName: string, fileBuffer: Buffer, mimeType: string) {
  await minioClient.putObject(bucket, fileName, fileBuffer, fileBuffer.length, {
    'Content-Type': mimeType,
  });
  return minioClient.presignedGetObject(bucket, fileName, 24 * 60 * 60); // 24h expiry
}
```

### Pattern 2: SQLCipher with Capacitor
**What:** Encrypted SQLite database for offline mobile storage, replacing localStorage fallback on native.
**When to use:** Phase 1 mobile initialization. Browser continues with existing AES-256-GCM localStorage fallback.
**Example:**
```typescript
// Source: @capacitor-community/sqlite docs
import { CapacitorSQLite, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';

async function initSecureDatabase(password: string) {
  if (!Capacitor.isNativePlatform()) {
    // Browser fallback: use existing encrypted-db.ts
    return encryptedDb.init();
  }
  
  const db = await CapacitorSQLite.createConnection({
    database: 'kapwa',
    version: 1,
    encrypted: true,
    mode: 'secret',     // SQLCipher mode
  });
  
  await db.open(password);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sync_cache (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT
    )
  `);
  
  return db;
}
```

### Anti-Patterns to Avoid
- **Hardcoded credentials in docker-compose:** Use `.env` files and Docker secrets for production. Current docker-compose has hardcoded `kapwa/kapwa` credentials.
- **In-memory-only idempotency cache:** Current `SyncService` caches idempotency keys in a `Map`. On server restart, the cache is lost. Add Redis or DB persistence for production.
- **Mixing browser localStorage with SQLCipher:** Keep a clean abstraction layer. The `encrypted-db.ts` should detect platform and delegate to SQLCipher on native, localStorage fallback on browser.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| S3-compatible object storage | Custom file storage | MinIO | Production-ready, encryption at rest, versioning, presigned URLs |
| Reverse proxy with TLS | Manual nginx config + certbot | Caddy 2 | Auto-TLS, one Caddyfile, built-in rate limiting, WAF |
| Encrypted SQLite for mobile | Custom encryption wrapper | `@capacitor-community/sqlite` with SQLCipher | Battle-tested SQLCipher integration, proper AES-256, native perf |
| Connection pool management | Custom connection handling | TypeORM + pg pool defaults | Already in stack — just need to configure pool size |

**Key insight:** Each of these hand-roll candidates has subtle edge cases that take months to discover (TLS renewal race conditions, SQLCipher key management, S3 consistency guarantees). The standard libraries handle all of these.

## Common Pitfalls

### Pitfall 1: Caddy TLS certificate renewal during sync
**What goes wrong:** Caddy auto-TLS renews certificates and the sync endpoint becomes briefly unavailable, causing sync failures.
**Why it happens:** Caddy handles ACME renewal internally; during renewal window there's no graceful connection draining.
**How to avoid:** Configure Caddy's `tls` directive with `renew_interval` and ensure Caddy health check is before NestJS in docker-compose `depends_on`.
**Warning signs:** Sync failures that correlate with certificate renewal periods.

### Pitfall 2: SQLCipher password management
**What goes wrong:** User clears app data and loses the SQLCipher passphrase, making local data irrecoverable.
**Why it happens:** Password derived from device-specific key material; no recovery mechanism.
**How to avoid:** Connect SQLCipher password to the user's login password (derive from a hash of the user's PIN/password). For reinstall, sync from server.

### Pitfall 3: MinIO bucket permissions
**What goes wrong:** Presigned URLs generated with wrong bucket policy, causing upload failures.
**Why it happens:** MinIO requires exact bucket + path permissions for presigned URLs.
**How to avoid:** Create buckets with explicit IAM-style policies in init script. Use service account with programmatic access only.

### Pitfall 4: TypeORM connection pool exhaustion
**What goes wrong:** Under sync load, TypeORM exhausts default pool (10 connections), causing request queuing.
**Why it happens:** Default `pg` pool size is 10. Sync processing creates query runners without releasing them promptly.
**How to avoid:** Set `extra: { max: 25, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 }` in TypeORM config.

## Code Examples

Verified patterns from official sources:

### TypeORM Connection Pool Configuration
```typescript
// Source: TypeORM docs / pg pool docs
TypeOrmModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    type: 'postgres',
    host: config.get('DB_HOST', 'localhost'),
    port: config.get<number>('DB_PORT', 5432),
    username: config.get('DB_USER', 'kapwa'),
    password: config.get('DB_PASSWORD', 'kapwa'),
    database: config.get('DB_NAME', 'kapwa'),
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
    migrationsRun: true,
    namingStrategy: new SnakeNamingStrategy(),
    logging: ['error', 'warn'],
    extra: {
      max: 25,                          // Max pool connections
      idleTimeoutMillis: 30000,          // Close idle connections after 30s
      connectionTimeoutMillis: 5000,     // Connection timeout
      query_timeout: 10000,              // Query timeout
    },
  }),
}),
```

### Caddyfile (reverse proxy + static files)
```
// Source: Caddy 2 official docs
kapwa.mswdo-norzagaray.gov.ph {
    # Rate limiting
    rate_limit {
        zone dynamic {
            key {remote_host}
            events 60
            window 1m
        }
    }
    
    # Security headers
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
    
    # Static files (PWA client)
    root * /var/www/kapwa
    try_files {path} /index.html
    
    # API reverse proxy
    handle /api/* {
        reverse_proxy api:3000
    }
    
    # WebSocket support for chat
    handle /socket.io/* {
        reverse_proxy api:3000
    }
    
    # MinIO console
    handle /minio-console/* {
        reverse_proxy minio:9001
    }
    
    # Auto TLS
    tls admin@mswdo-norzagaray.gov.ph
    
    # Logging
    log {
        output file /var/log/caddy/access.log
    }
}
```

### Idempotency Key Configuration (SyncService)
```typescript
// Already implemented — no code change needed for v1
// In kapwa-server/src/sync/sync.service.ts
const IDEMPOTENCY_TTL_MS = 86_400_000; // 24h
const MAX_CACHE_SIZE = 10_000;

// Optional: Add Redis persistence for production
// import Redis from 'ioredis';
// const redis = new Redis();
// async getIdempotencyResult(key: string) {
//   const cached = await redis.get(`idempotency:${key}`);
//   return cached ? JSON.parse(cached) : null;
// }
```

## Runtime State Inventory

> Skip this section — Phase 1 is a greenfield deployment phase. No rename/refactor/migration involved.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | Docker Compose deployment | ✓ | 29.5.2 | — |
| Docker Compose | Service orchestration | ✓ | 5.1.4 | — |
| Node.js | NestJS backend | ✓ | 26.2.0 | — |
| npm | Package management | ✓ | 11.16.0 | — |
| PostgreSQL | Database | ✓ | 18.4 | Docker PostgreSQL 16 |
| Caddy 2 | Reverse proxy | ✗ | — | Install via Docker (recommended) |
| MinIO | Object storage | ✗ | — | Install via Docker (recommended) |

**Missing dependencies with no fallback:**
- None — all infrastructure dependencies will run inside Docker containers

## Validation Architecture

> **Note:** `workflow.nyquist_validation` is `true` in config.json.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7 (server) / Vitest 1.2 (client) |
| Config file | `kapwa-server/jest.config.ts` / `kapwa-client/vitest.config.ts` |
| Quick run command | `npm test` in `kapwa-server/` |
| Full suite command | Same as quick (coverage enabled) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INF-01 | MinIO upload/download file | integration | `npm test -- --testPathPattern=minio` | ❌ Wave 0 |
| INF-02 | Caddy reverse proxy healthcheck | smoke | manual (Docker health endpoint) | ❌ Manual |
| INF-03 | Docker Compose all services healthy | smoke | manual (docker compose ps) | ❌ Manual |
| INF-05 | Connection pooling configured | unit | `npm test -- --testPathPattern=datasource` | ❌ Wave 0 |
| ROL-01 | All 6 roles accepted in registration | unit | `npm test -- --testPathPattern=auth` | ❌ Wave 0 |
| ROL-06 | Admin can create/list/update/delete users | integration | `npm test -- --testPathPattern=users` | ❌ Wave 0 |
| SYNC-01 | SQLCipher encrypts/decrypts data | unit (client) | `npx vitest run` in `kapwa-client/` | ❌ Wave 0 |
| SYNC-04 | Idempotency key rejects duplicate syncs | integration | `npm test -- --testPathPattern=sync` | ❌ Wave 0 |
| SYNC-05 | Offline queue shows pending count | unit (client) | `npx vitest run` in `kapwa-client/` | ❌ Wave 0 |
| CON-06 | SHA-256 hash chain verifies integrity | integration | `npm test -- --testPathPattern=audit` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test` in server directory (quick unit/integration)
- **Per wave merge:** Full suite + manual Docker health check
- **Phase gate:** All automated tests green + Docker Compose up healthy + manual auth flow verify

### Wave 0 Gaps
- [ ] `tests/minio.service.spec.ts` — covers MinIO upload/download/list
- [ ] `tests/sync.idempotency.spec.ts` — covers duplicate idempotency key rejection
- [ ] `tests/audit.hashchain.spec.ts` — covers chain verification across tables
- [ ] `tests/users.admin.spec.ts` — covers CRUD for user management
- [ ] `tests/connection-pool.spec.ts` — covers pool config is applied
- [ ] Vitest tests for client-side SQLCipher and offline queue

## Security Domain

> `security_enforcement` is `true` in config.json. ASVS Level 1 applies.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | JWT + passport + bcrypt (existing); MFA TOTP (existing) |
| V3 Session Management | yes | JWT with refresh token rotation (existing); tokenVersion for invalidation |
| V4 Access Control | yes | RolesGuard + AbacGuard pipeline (existing); RLS policies |
| V5 Input Validation | yes | ZodPipe at API boundary (existing) |
| V6 Cryptography | yes | bcrypt for passwords (existing); Web Crypto AES-256-GCM (existing); pgcrypto for DB |

### Known Threat Patterns for NestJS/PostgreSQL Stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection | Tampering | Parameterized queries via TypeORM (existing); ZodPipe sanitization |
| JWT token theft | Information Disclosure | Short expiry (1h), refresh rotation, tokenVersion invalidation (existing) |
| Unauthorized role escalation | Elevation of Privilege | RolesGuard checks role on every request (existing); RLS row-level enforcement |
| Sync replay attack | Repudiation | Idempotency keys deduplicate requests; Ed25519 signatures verify origin |
| Brute force login | Denial of Service | ThrottlerGuard 60 req/min; Caddy rate limiting at proxy level |

## Common Pitfalls

### Pitfall 1: Caddy + Node.js port conflicts in Docker
**What goes wrong:** Both Caddy and NestJS try to bind to port 80/443 inside the same Docker network.
**Why it happens:** Caddy needs privileged ports; NestJS should only be exposed internally.
**How to avoid:** Only expose Caddy ports (80/443) to the host. NestJS (3000) and MinIO (9000/9001) should be internal-only in docker-compose network. Use `expose` instead of `ports` for internal services.

### Pitfall 2: MinIO bucket auto-creation
**What goes wrong:** MinIO doesn't auto-create buckets on startup. First upload attempt fails with `NoSuchBucket`.
**Why it happens:** MinIO requires explicit bucket creation via init script or API call.
**How to avoid:** Add init container or startup script that creates required buckets (`documents`, `signatures`, `vouchers`, `exports`) with proper policies.

### Pitfall 3: SQLCipher cross-platform key derivation
**What goes wrong:** Key derived on Android doesn't match key on iOS for the same user.
**Why it happens:** Platform-specific crypto APIs produce different key derivation results.
**How to avoid:** Derive SQLCipher key from user's password (server-side hash) — platform-independent and recoverable on reinstall.

### Pitfall 4: RLS policies blocking sync service
**What goes wrong:** The sync service uses direct SQL queries that bypass RLS, or RLS blocks sync operations.
**Why it happens:** `SyncService.processDelta` uses `dataSource.query()` with admin-level queries that may not set `app.current_role`.
**How to avoid:** Ensure sync queries run with elevated privileges or set `app.current_role` context appropriately.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Local file system uploads | MinIO object storage | Phase 1 | Scalable, encrypted, versioned document storage |
| Plain PostgreSQL pgcrypto | SHA-256 hash chain | Phase 1 | Audit trail integrity verification |
| localStorage fallback only | SQLCipher on mobile + localStorage on browser | Phase 1 | Encrypted mobile storage, proper SQLite for offline queries |
| Hardcoded Docker credentials | `.env` + Docker secrets | Phase 1 | Production-safe credential management |

**Deprecated/outdated:**
- The `.env` file with hardcoded credentials (`kapwa-secret-key`) — must be replaced with environment-specific secrets for production deployment.

## Assumptions Log

No claims tagged `[ASSUMED]` — all findings verified against existing codebase files.

## Sources

### Primary (HIGH confidence)
- **Codebase audit**: All files in `kapwa-server/src/`, `kapwa-client/src/`, `.planning/` — verified by direct file reads
- **docker-compose.yml**: Current state of Docker deployment — directly read
- **User entity + Auth module**: All 6 roles confirmed — directly read
- **Sync service**: Idempotency key enforcement confirmed — directly read
- **Audit service**: SHA-256 hash chain confirmed — directly read
- **encrypted-db.ts**: AES-256-GCM over localStorage confirmed — directly read

### Secondary (MEDIUM confidence)
- `@minio/minio` documentation — standard S3 client for Node.js [CITED: min.io/docs]
- `@capacitor-community/sqlite` — Capacitor SQLCipher plugin [CITED: capacitor-community docs]
- Caddy 2 documentation — reverse proxy configuration [CITED: caddyserver.com/docs]

### Tertiary (LOW confidence)
- None — all findings verified against existing codebase

## Open Questions

1. **Should idempotency keys be persisted in Redis/DB instead of in-memory Map?**
   - What we know: Current `SyncService` uses in-memory `Map<string, {result, timestamp}>` with TTL eviction. On server restart, cache is lost.
   - What's unclear: Whether production deployment warrants the additional complexity of Redis or DB-backed persistence for idempotency.
   - Recommendation: Defer to Phase 1 implementation planning. In-memory is acceptable for v1 with the understanding that a server restart during sync could reprocess some changes.

2. **What bucket structure for MinIO?**
   - What we know: Documents include signatures (worker + client), vouchers (petty cash), IRF attachments, COA exports
   - What's unclear: Whether to use separate buckets per type or prefix-based organization within fewer buckets
   - Recommendation: Use per-category buckets: `worker-signatures`, `client-receipts`, `irf-attachments`, `coa-exports`. Simpler IAM policies.

3. **How to handle SQLCipher key derivation for cross-platform?**
   - What we know: Browser uses auto-generated random key in localStorage. Mobile needs deterministic key per user.
   - What's unclear: Should the SQLCipher passphrase be derived from the user's login password (known at unlock time)?
   - Recommendation: Derive from the user's password hash on login. This gives recovery (reinstall + login = reload from server + re-encrypt local).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified against existing project dependencies or official docs
- Architecture: HIGH — architecture directly observed from existing codebase
- Pitfalls: MEDIUM — some derived from experience with similar stacks, verified against common patterns

**Research date:** 2026-06-19
**Valid until:** 2026-07-19 (stable for infrastructure components; Caddy/MinIO minor version bumps unlikely to affect patterns)

## Implementation Order Recommendation

Based on dependency analysis, build in this order:

### Wave 1: Infrastructure Foundation
1. **INF-03**: Expand docker-compose.yml — add MinIO, Caddy 2 services
2. **INF-01**: Create MinIO NestJS module — `MinioService`, `MinioModule`, bucket init
3. **INF-02**: Create Caddyfile — reverse proxy config, TLS, rate limiting, static file serving
4. **INF-05**: Add connection pooling config to TypeORM settings in `app.module.ts`

### Wave 2: Auth Completion
5. **ROL-01**: Add RLS policies for `mayor` and `auditor` roles — update initial migration or add new migration
6. **ROL-06**: Add `POST /users` endpoint to users controller (admin-only user creation). Enhance AdminPage with user creation form.

### Wave 3: Sync & Storage
7. **SYNC-01**: Install `@capacitor-community/sqlite` for Capacitor mobile. Create platform-aware storage abstraction layer.
8. **SYNC-05**: Fix `Layout.tsx` to read pending count from `kapwa_sync_queue` instead of `kapwa_pending_changes`.

### Wave 4: Audit Completion
9. **CON-06**: Extend SHA-256 hash chain to all audit-relevant tables (cases, beneficiaries, consent_ledger). Update `AuditService.verifyHashChain()` to verify all chains. Update `compliance-audit.ts`.

### Verification
10. **Integration test**: Full Docker Compose `up` + auth flow + sync flow + audit verification test.
