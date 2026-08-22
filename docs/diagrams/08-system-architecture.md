# System Architecture

This document describes the KAPWA (MSWDO Norzagaray Social Welfare System) runtime architecture: a three-tier client–API–data deployment with cross-cutting security, observability, and offline-sync concerns that span all tiers.

## 1. Purpose

Documents the three-tier architecture — browser client, NestJS API, and Postgres/Minio data tier — together with the cross-cutting concerns (auth, authorization, rate limiting, PII masking, audit, logging, graceful shutdown, and offline sync) that cut across every tier.

## 2. Functional Specification

| ID | Requirement |
|----|-------------|
| FR-01 | The client speaks to the API only through the `/api/v1` versioned prefix (`api` global prefix + URI versioning `defaultVersion: '1'`) and authenticates every request with a `Bearer` token in the `Authorization` header (main.ts, lib/api.ts). |
| FR-02 | The api layer single-flights the 401 refresh flow — concurrent 401s share one in-flight `/auth/refresh` promise — and dispatches the `kapwa:auth:logout` CustomEvent when refresh fails or the network errors (lib/api.ts). |
| FR-03 | SWR provides server-state caching (fetcher = `api.get`, `dedupingInterval` 2000 ms), revalidation on window focus and network reconnect, per-page `keepPreviousData`, and integrates with the offline queue for queued mutations (routes.tsx SWRConfig, pages). |
| FR-04 | The API enforces throttling, the CSRF guard, helmet headers, and cookie parsing in the bootstrap (main.ts: `helmet()`, `cookieParser()`, CORS with credentials, global filters). |
| FR-05 | Role guards (`RolesGuard` with `@Roles`) plus the ABAC guard fallback (abac.guard.ts / abac.service.ts) enforce module access on every protected controller. |
| FR-06 | The shared case FSM (case-fsm.ts) is the single source of truth for case transitions — used by the cases module and re-validated by the sync service's `handleFsmTransition` pre-check (sync.service.ts imports `isValidTransition`). |
| FR-07 | The sync service accepts device deltas with an Ed25519 signature and idempotency checks, rejects unknown underscore-prefixed meta fields (`assertNoUnknownMetaFields`), whitelists payload columns, and resolves conflicts server-wins for financial tables (`ConflictResolver.FINANCIAL_TABLES`). |
| FR-08 | The notifications gateway pushes realtime messages over WebSocket (namespace `/notifications`, per-user `user:{id}` room); the notifications module provides a REST fallback for clients without a socket. |
| FR-09 | Minio stores documents (presigned upload/GET URLs, bucket init on boot); the export module generates PDF (PDFKit), XLSX, and CSV artifacts. |
| FR-10 | Health endpoints `/health`, `/health/live`, `/health/ready` reflect Postgres connectivity (`SELECT 1`) and return 503 when the DB is unreachable (app.controller.ts). |
| FR-11 | JSON structured logging is enabled globally via `app.useLogger` (level, ISO timestamp, message, meta) in main.ts. |
| FR-12 | Graceful shutdown hooks are enabled via `app.enableShutdownHooks()`; the sync service implements `OnApplicationShutdown` to log the signal and rely on transactional queue entries for retry-safe shutdown. |
| FR-13 | The PII masking interceptor (pii.interceptor.ts) nulls out PII fields (surname, firstName, middleName, address, phone, dob, philsysNumber) on responses when the beneficiary's consent is revoked, with an admin bypass. |
| FR-14 | The global `AllExceptionsFilter` (common/filters/http-exception.filter.ts) normalizes all errors into `{ statusCode, message, timestamp, path }`, mapping throttler exceptions to 429 and WebSocket exceptions to 400. |
| FR-15 | Rate limiting is enforced app-wide by `ThrottlerGuard` registered as a global guard (`ThrottlerModule` 60 requests per 60,000 ms). |
| FR-16 | Postgres audit: the `pgaudit` extension is enabled during migration bootstrap (migrate.ts) and the `audit_log` table records IRF dispositions; the audit module exposes hash-chain verification and log queries (`/audit/verify-all`, `/audit/logs`). |
| FR-17 | Sync idempotency: duplicate deltas are answered from a 24 h idempotency window (`IDEMPOTENCY_TTL_MS = 86_400_000`) backed by an in-memory cache plus the `idempotency_keys` table, with stale-entry eviction. |

## 3. System Architecture (Mermaid)

```mermaid
flowchart LR
  subgraph Client["Client Tier"]
    App["App shell"]
    Pages["Pages"]
    SWR["SWR"]
    API["api.ts"]
    Queue["Offline queue"]
  end

  subgraph APITier["API Tier (api/v1)"]
    Throttle["ThrottlerGuard"]
    Csrf["CsrfGuard"]
    RolesG["RolesGuard"]
    AbacG["AbacGuard"]
    Filter["AllExceptionsFilter"]
    Pii["PiiMaskingInterceptor"]
    NotifGW["Notifications Gateway"]

    subgraph Modules["Module groups"]
      Auth["Auth"]
      SyncS["Sync"]
      CasesM["Cases"]
      Benef["Beneficiaries"]
      Prog["Programs"]
      Ref["Referrals"]
      Ag["Agencies"]
      Exp["Export"]
      Notif["Notifications"]
      Ann["Announcements"]
      Audit["Audit"]
    end
  end

  subgraph Data["Data Tier"]
    PG[("Postgres")]
    Minio[("Minio")]
  end

  App --> Pages
  Pages --> SWR
  SWR -->|"FR-03 SWR fetcher + caching"| API
  API -->|"FR-01 Bearer token on /api/v1"| Throttle
  API -.->|"FR-02 single-flight 401 refresh"| Auth
  API -.->|"FR-02 kapwa:auth:logout on failure"| App
  API -->|"FR-07 queue while offline"| Queue
  Queue -.->|"FR-07 signed delta loop"| SyncS
  Throttle -->|"FR-04/FR-15"| Csrf
  Csrf -->|"FR-04"| RolesG
  RolesG -->|"FR-05"| AbacG
  AbacG -->|"FR-05 module access"| Modules
  Filter -.->|"FR-14 normalized errors"| Modules
  Pii -.->|"FR-13 mask revoked PII"| Modules
  SyncS -->|"FR-06 shared case FSM"| CasesM
  SyncS -->|"FR-17 idempotency_keys 24h TTL"| PG
  Modules --> PG
  Notif -->|"FR-08 REST fallback"| NotifGW
  NotifGW -.->|"FR-08 WS push user:{id}"| App
  Exp -->|"FR-09 PDF/XLSX/CSV"| Minio
  Audit -->|"FR-16 pgaudit + audit_log"| PG
```

## 4. Diagram Narrative

**Tiers.** The client tier is a React SPA: the app shell holds routing/auth providers, pages render feature screens through SWR hooks, `api.ts` is the single HTTP facade, and the offline queue persists mutations in localStorage with version vectors. The API tier is the NestJS backend: a root pipeline of guards/filters/interceptors wraps eleven module groups (Auth, Sync, Cases, Beneficiaries, Programs, Referrals, Agencies, Export, Notifications, Announcements, Audit). The data tier is Postgres (relational state, idempotency keys, audit_log) plus Minio (documents/blobs).

**Request lifecycle.** A page-level SWR hook calls `api.get` (FR-03), which attaches the Bearer token and hits `/api/v1` (FR-01). The request crosses the global guard pipeline — ThrottlerGuard (FR-15), CsrfGuard (FR-04), RolesGuard + AbacGuard (FR-05) — then enters the module's controller/service/repository and lands in Postgres (FR-10). Responses pass through PiiMaskingInterceptor (FR-13) and any error is normalized by AllExceptionsFilter (FR-14); every log line is JSON (FR-11). If the API answers 401, `api.ts` single-flights a refresh (FR-02) and, on failure, dispatches `kapwa:auth:logout`.

**Async channels.** Two channels bypass the request/response path. (1) WebSocket push: the notifications gateway authenticates the JWT at connect, joins `user:{id}`, and pushes realtime events (FR-08) with REST fallback. (2) Sync delta loop: offline mutations are queued client-side (FR-07), then replayed to the sync module as signed batches — verified via Ed25519, deduplicated via the 24 h idempotency window (FR-17), sanitized against unknown meta fields, and applied with server-wins conflict resolution for financial tables; case-status changes are re-validated against the shared FSM (FR-06). Sync shutdown is graceful and retry-safe (FR-12).

**Mapping.** Every edge in the diagram carries the FR id that governs it; the functional table in Section 2 is the contract the diagram renders.

## 5. Cross-References

| Item | Location |
|------|----------|
| app.module.ts — ThrottlerModule (60 req/min), TypeOrmModule (`migrationsRun: false`), 26 feature modules, global guard/filter/interceptor registration | `kapwa-server/src/app.module.ts` |
| main.ts — `enableShutdownHooks`, JSON logger (`app.useLogger`), global prefix `api` + URI versioning v1, helmet, cookieParser, CORS, AllExceptionsFilter, Swagger at `/api/docs` | `kapwa-server/src/main.ts` |
| lib/api.ts — `API_BASE` (`/api/v1`), Bearer header, single-flight refresh, `kapwa:auth:logout` dispatch | `kapwa-client/src/lib/api.ts` |
| SWR configuration — `SWRConfig` with fetcher `api.get`, `revalidateOnFocus`/`revalidateOnReconnect`, `dedupingInterval`; `keepPreviousData` used per page | `kapwa-client/src/routes.tsx` (pages: e.g. `SearchResultsPage.tsx`) |
| sync.service.ts — Ed25519 signature, idempotency TTL 86,400,000 ms, `assertNoUnknownMetaFields`, `applyChange`, server-wins conflict resolution | `kapwa-server/src/sync/sync.service.ts` |
| Conflict resolution policy (financial tables server-wins, notes append) | `kapwa-server/src/sync/conflict-resolver.ts` |
| case-fsm.ts — `CASE_FSM`, `isValidTransition`, `canTransition`; shared by cases + sync | `kapwa-server/src/cases/case-fsm.ts` |
| notifications.gateway.ts — namespace `/notifications`, `user:{id}` room, JWT at connect | `kapwa-server/src/notifications/notifications.gateway.ts` |
| Minio module — presigned upload/GET URLs, bucket init on boot | `kapwa-server/src/minio/minio.service.ts` |
| pii-masking interceptor — PII fields nulled when consent revoked, admin bypass | `kapwa-server/src/beneficiaries/pii.interceptor.ts` |
| all-exceptions filter — 429 for throttler, 400 for WS, normalized `{statusCode, message, timestamp, path}` | `kapwa-server/src/common/filters/http-exception.filter.ts` |
| Role + ABAC guards — `@Roles` enforcement with ABAC fallback | `kapwa-server/src/auth/guards/roles.guard.ts`, `kapwa-server/src/auth/guards/abac.guard.ts` |
| Health endpoints — `/health`, `/health/live`, `/health/ready` (DB `SELECT 1`) | `kapwa-server/src/app.controller.ts` |
| Offline queue — localStorage queue, version vectors, conflict states | `kapwa-client/src/lib/offline-queue.ts` |
| Export module — PDF (PDFKit), XLSX, CSV; certificates, monthly funds, audit logs | `kapwa-server/src/export/export.service.ts`, `kapwa-server/src/export/export.controller.ts` |
| Audit — hash-chain verification, audit logs, `pgaudit` extension + `audit_log` table | `kapwa-server/src/audit/audit.controller.ts`, `kapwa-server/src/database/migrate.ts`, `kapwa-server/src/database/migrations/20260622000005-IRFDispositionEncryption.ts` |