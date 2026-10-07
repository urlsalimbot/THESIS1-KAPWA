# System Architecture

This document describes the KAPWA (MSWDO Norzagaray Social Welfare System) runtime architecture from two complementary viewpoints: the **layered architecture** (the internal organization of the software into horizontal layers) and the **client–server architecture** (the physical and logical separation between client and server components). Both views share the same cross-cutting concerns: security, observability, and offline sync.

## 1. Purpose

Documents the KAPWA architecture from two viewpoints: (1) the layered architecture — presentation, application (API), business/service, data-access, and data layers with the cross-cutting concerns that span them — and (2) the client–server architecture — the browser/field clients reached through CloudFront, the S3-hosted SPA, the NestJS API running on EC2, and the Amazon RDS (Postgres) + S3 data services, connected by HTTP/HTTPS and WebSocket. All functional requirements (FR-01..FR-17) are mapped onto both views. The deployed topology itself is documented in `09-deployment-diagram.md`.

### 1.1 Diagram notation

Both views follow the same visual grammar, stated here once and repeated as a key inside each diagram, so any diagram can be read on its own:

| Convention | Meaning |
|------------|---------|
| Rectangular box | A **layer band** (a subgraph) or an **element** inside one — a component, service, or gateway |
| Cylinder | A **managed data store** (Amazon RDS, Amazon S3) |
| Solid arrow | A **synchronous** dependency or request path |
| Dotted arrow | An **asynchronous** or out-of-band channel (WebSocket push, presigned URL) |
| Numbered band title | The layer's **position** in the stack (`LAYER 1` … `LAYER 5`, top to bottom) |
| Label on every arrow | The **protocol or intent**, with the governing **FR id** |
| Dashed border | A **cross-cutting concern** — applied at the API boundary rather than owning a layer |

Colour is a secondary cue only. Layers are distinguished primarily by their numbered band, their element titles, and stroke weight, so the diagrams remain readable in greyscale — the palette deliberately reuses the print-safe classes already established in `10-dfd-level-0.md` and `11-dfd-level-1.md` (dark text on light fills, heavy stroke for stores).

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
| FR-09 | Documents are stored in **Amazon S3** — the app talks to it through the MinIO-compatible client (`MINIO_ENDPOINT=s3.ap-southeast-1.amazonaws.com`, `MINIO_BUCKET_PREFIX=kapwa-prod`, SigV4 signing): server-side uploads, presigned GET URLs only, bucket init on boot; the export module generates PDF (PDFKit), XLSX, and CSV artifacts. |
| FR-10 | Health endpoints `/health`, `/health/live`, `/health/ready` reflect Postgres connectivity (`SELECT 1`) and return 503 when the DB is unreachable (app.controller.ts). |
| FR-11 | JSON structured logging is enabled globally via `app.useLogger` (level, ISO timestamp, message, meta) in main.ts. |
| FR-12 | Graceful shutdown hooks are enabled via `app.enableShutdownHooks()`; the sync service implements `OnApplicationShutdown` to log the signal and rely on transactional queue entries for retry-safe shutdown. |
| FR-13 | The PII masking interceptor (pii.interceptor.ts) nulls out PII fields (surname, firstName, middleName, address, phone, dob, philsysNumber) on responses when the beneficiary's consent is revoked, with an admin bypass. |
| FR-14 | The global `AllExceptionsFilter` (common/filters/http-exception.filter.ts) normalizes all errors into `{ statusCode, message, timestamp, path }`, mapping throttler exceptions to 429 and WebSocket exceptions to 400. |
| FR-15 | Rate limiting is enforced app-wide by `ThrottlerGuard` registered as a global guard (`ThrottlerModule` 60 requests per 60,000 ms). |
| FR-16 | Postgres audit: the `pgaudit` extension is created during migration bootstrap (migrate.ts) and the `audit_log` table records IRF dispositions; the audit module exposes hash-chain verification and log queries (`/audit/verify-all`, `/audit/logs`). On RDS the extension needs the instance parameter group (`shared_preload_libraries=pgaudit`), so production auditing relies on `audit_log` plus CloudWatch/RDS logs. |
| FR-17 | Sync idempotency: duplicate deltas are answered from a 24 h idempotency window (`IDEMPOTENCY_TTL_MS = 86_400_000`) backed by an in-memory cache plus the `idempotency_keys` table, with stale-entry eviction. |

## 3. Architecture Diagrams (Mermaid)

**Printing:** every diagram below is rendered to its own PDF by `docs/diagrams/print-diagrams.mjs` (output in `docs/diagrams/print/`, one file per diagram) — run `PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable node docs/diagrams/print-diagrams.mjs` after editing. The helper picks the smallest page that keeps label text at 5 pt or larger: the two client–server diagrams print on US Letter, while the layered diagram (3.1) prints on A3 portrait — it is taller than the rest because it carries five layer bands plus the cross-cutting band and the key, and forcing it onto Letter would drop the labels below the legibility floor. Colours and stroke weights are declared with `classDef` inside each diagram, so the styling travels with the source and does not depend on an external Mermaid theme.

### 3.1 Layered Architecture

*Scope: the internal organization of the KAPWA software into five horizontal layers. Each layer depends only on layers below it; the cross-cutting concerns are enforced at the API boundary and span all five.*

```mermaid
flowchart TB
    classDef title fill:#ffffff,stroke:#ffffff,color:#111111,font-size:16px
    classDef present fill:#eef4fb,stroke:#1f4e79,stroke-width:2px,color:#111111
    classDef app fill:#dfeaf7,stroke:#1f4e79,stroke-width:2px,color:#111111
    classDef svc fill:#eaf3ea,stroke:#2e6b34,stroke-width:2px,color:#111111
    classDef dal fill:#fdf3e3,stroke:#8a5a00,stroke-width:2px,color:#111111
    classDef store fill:#f5f5f5,stroke:#333333,stroke-width:5px,color:#111111
    classDef xcut fill:#ffffff,stroke:#8a1c1c,stroke-width:1px,stroke-dasharray:4 3,color:#111111

    T["Layered Architecture — KAPWA<br/>five layers, each depending only on the layer below"]:::title

    subgraph XC["CROSS-CUTTING CONCERNS — enforced at the API boundary, span every layer"]
        direction LR
        X1["Auth and session<br/>Bearer token · 401 refresh · FR-01/02"]:::xcut
        X2["Request guards<br/>Throttler · CSRF · Roles · ABAC · FR-04/05/15"]:::xcut
        X3["PII masking<br/>consent-revoked fields nulled · FR-13"]:::xcut
        X4["Observability<br/>JSON logs · normalised errors · FR-11/12/14"]:::xcut
    end

    subgraph L1["LAYER 1 · PRESENTATION — React 19 SPA in the browser"]
        direction LR
        P1["App shell<br/>router · auth context · theme"]:::present
        P2["Feature pages<br/>SWR hooks over api.get · FR-03"]:::present
        P3["Role-filtered chrome<br/>Topbar · Sidebar · BottomNav"]:::present
    end

    subgraph L2["LAYER 2 · APPLICATION — NestJS 11 HTTP API on Node.js"]
        direction LR
        A1["Feature controllers<br/>REST under /api/v1 · FR-01"]:::app
        A2["Global pipeline<br/>guards · interceptors · exception filter"]:::app
    end

    subgraph L3["LAYER 3 · BUSINESS / SERVICE — NestJS providers"]
        direction LR
        B1["Feature services<br/>domain rules"]:::svc
        B2["Case FSM<br/>single source of truth · FR-06"]:::svc
        B3["Sync service<br/>signed deltas · conflicts · FR-07/17"]:::svc
        B4["Notifications gateway<br/>WebSocket push · FR-08"]:::svc
    end

    subgraph L4["LAYER 4 · DATA-ACCESS — TypeORM and Zod"]
        direction LR
        D1["Repositories<br/>parameterised SQL"]:::dal
        D2["Validation pipes<br/>Zod schemas at the boundary"]:::dal
    end

    subgraph L5["LAYER 5 · DATA — managed AWS services"]
        direction LR
        DB[("Amazon RDS for PostgreSQL<br/>state · audit_log · idempotency_keys")]:::store
        OBJ[("Amazon S3<br/>documents · PDF/XLSX/CSV exports")]:::store
    end

    subgraph KEY["KEY"]
        direction LR
        K1["Rectangle = layer or component"]:::present
        K2[("Cylinder = data store")]:::store
        K3["Dashed = cross-cutting"]:::xcut
        K4["Arrow = dependency, labelled with protocol and FR id"]:::app
    end

    %% Layout only — invisible links, no dependency implied. Without them the
    %% unconnected bands (title, cross-cutting, key) drift sideways beside Layer 1
    %% instead of stacking in reading order.
    T ~~~ XC
    XC ~~~ L1
    L5 ~~~ KEY

    %% FR-01, FR-03: the SPA reaches the API only through the versioned REST surface
    L1 -->|"HTTPS · REST over /api/v1 · FR-01"| L2
    %% Open layering: controllers validate inbound payloads at the boundary, so
    %% Layer 2 reaches Layer 4 directly. Every other dependency points strictly down.
    L2 -->|"inbound payload validation · Zod"| L4
    L2 -->|"in-process service calls"| L3
    L3 -->|"repository calls"| L4
    %% FR-09, FR-10: relational reads/writes and object storage both leave through Layer 4
    L4 -->|"SQL over TLS · FR-10     S3 API SigV4 · FR-09"| L5
```

### 3.2 Client–Server Architecture

*Scope: which components talk to which, over what protocol. Clients reach the system through CloudFront, which serves the SPA from S3 and proxies API and WebSocket traffic to the API on EC2; the API talks to RDS and S3 over TLS. The view is split into two diagrams — the request path and the asynchronous channels.*

#### 3.2a Request path

*Scope: the synchronous request path from client to data store.*

```mermaid
flowchart LR
    classDef actor fill:#ffffff,stroke:#333333,stroke-width:1px,color:#111111
    classDef cdn fill:#eef4fb,stroke:#1f4e79,stroke-width:2px,color:#111111
    classDef compute fill:#dfeaf7,stroke:#1f4e79,stroke-width:3px,color:#111111
    classDef store fill:#f5f5f5,stroke:#333333,stroke-width:5px,color:#111111
    classDef title fill:#ffffff,stroke:#ffffff,color:#111111,font-size:16px

    T["Client–Server Architecture — KAPWA<br/>request path: synchronous, HTTPS end to end"]:::title

    U["Case worker / claimant<br/>browser SPA · field devices<br/>offline-capable PWA"]:::actor
    CF["Amazon CloudFront<br/>kapwa.software · ACM TLS<br/>default to SPA · /api/* and /socket.io/* to origin"]:::cdn
    SPAB[("Amazon S3<br/>kapwa-software-frontend<br/>SPA bundle, private via OAC")]:::store
    API["Amazon EC2<br/>NestJS API on :3000<br/>docker compose service kapwa-api"]:::compute
    PG[("Amazon RDS for PostgreSQL<br/>private subnet · TLS")]:::store
    DOC[("Amazon S3<br/>kapwa-prod-* documents<br/>SigV4 signing")]:::store

    U -->|"HTTPS · browser request"| CF
    %% FR-01: the bundle is served from the private bucket through OAC
    CF -->|"default /* · serves bundle via OAC"| SPAB
    %% FR-01: API and socket traffic keep the same origin
    CF -->|"/api/v1/* and /socket.io/* · origin :3000 · FR-01"| API
    %% FR-10, FR-16, FR-17: relational state, audit trail, idempotency keys
    API -->|"TCP 5432 · TLS · parameterised SQL · FR-16"| PG
    %% FR-09: server-side uploads and exports, documents held in S3
    API -->|"S3 API · SigV4 · uploads and exports · FR-09"| DOC
    %% FR-09: documents are read back with time-limited presigned GETs
    U -.->|"presigned GET · time-limited · FR-09"| DOC
```

#### 3.2b Async channels

*Scope: the two channels that are not request/response — realtime push and offline synchronisation.*

```mermaid
flowchart LR
    classDef actor fill:#ffffff,stroke:#333333,stroke-width:1px,color:#111111
    classDef svc fill:#eaf3ea,stroke:#2e6b34,stroke-width:2px,color:#111111
    classDef store fill:#f5f5f5,stroke:#333333,stroke-width:5px,color:#111111
    classDef title fill:#ffffff,stroke:#ffffff,color:#111111,font-size:16px

    T["Client–Server Architecture — KAPWA<br/>asynchronous channels: WebSocket push and offline sync"]:::title

    U["Clients<br/>SPA and offline field devices<br/>queue held in localStorage"]:::actor
    GW["Notifications gateway<br/>namespace /notifications<br/>per-user room user:{id}"]:::svc
    SY["Sync service<br/>Ed25519-signed deltas<br/>24 h idempotency window"]:::svc
    PG[("Amazon RDS for PostgreSQL<br/>idempotency_keys · audit_log")]:::store

    U -->|"WebSocket connect · JWT in handshake"| GW
    %% FR-08: server-initiated push into the per-user room
    GW -.->|"realtime push · FR-08"| U
    %% FR-07: the device replays queued mutations as a signed batch
    U -->|"POST /sync/v1 · signed delta batch · FR-07"| SY
    %% FR-17: duplicates answered from the idempotency window
    SY -->|"dedupe, conflict resolution · FR-17"| PG
    %% FR-07: server changes returned to the device for local replay
    SY -.->|"server changes for local replay · FR-07"| U
```

## 4. Diagram Narrative

**Layered view (3.1).** The presentation layer holds the React SPA: the app shell (routing, auth context, theme), feature pages that consume data through SWR hooks (FR-03), and the role-filtered chrome (Topbar, Sidebar, BottomNav). The application layer is the NestJS API: controllers receive HTTP requests and pass them through the global pipeline of guards (ThrottlerGuard FR-15, CsrfGuard FR-04, RolesGuard + AbacGuard FR-05), the AllExceptionsFilter (FR-14), and the PiiMaskingInterceptor (FR-13). The business/service layer implements the rules — feature services, the shared case FSM (FR-06), the sync service (FR-07, FR-17), and notifications (FR-08). The data-access layer is TypeORM repositories plus Zod validation pipes; the data layer is Amazon RDS (Postgres) and Amazon S3 object storage (FR-09, FR-10).

The layering is *open* in one direction: Layer 2 reaches Layer 4 directly for boundary validation (controllers validate inbound payloads with Zod pipes), while every other dependency points strictly downward. This is deliberate — validation belongs at the boundary, and routing it through the service layer would add a pass-through hop without adding a rule.

The cross-cutting concerns (auth FR-01/02, guards FR-04/05/15, PII masking FR-13, JSON logging FR-11, normalized errors FR-14, graceful shutdown FR-12) are drawn as their own band rather than as edges, because they do not own a layer: each is applied at the API boundary and applies to requests crossing every layer. They are specified in Section 2 rather than repeated as diagram edges.

**Client–server view (3.2).** Two diagrams. (3.2a) **Request path**: clients — the browser SPA and offline-capable field devices — reach the system only through CloudFront (`kapwa.software`), which serves the SPA bundle from the private S3 frontend bucket (origin access control) and proxies `/api/*` and `/socket.io/*` to the NestJS API on EC2 (`origin.kapwa.software:3000`, FR-01); the API queries Amazon RDS Postgres (relational state, idempotency keys, audit_log — FR-16, FR-17) and stores objects in S3 (FR-09). Document reads are the one exception to the API's monopoly on data access: they use time-limited presigned GET URLs, drawn as a dotted edge because the request leaves the API path. (3.2b) **Async channels**: the WebSocket gateway pushes realtime notifications into per-user `user:{id}` rooms (FR-08), and the sync service receives offline queue replays as Ed25519-signed delta batches, deduplicates them through the 24 h idempotency window, and resolves conflicts against RDS Postgres (FR-07, FR-17).

**Mapping.** Every edge in both diagrams carries the FR id that governs it; the functional table in Section 2 is the contract the diagrams render. The two views are complementary: the layered view answers "how is the software organized inside?", the client–server view answers "which components talk to which, over what protocol?".

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
| Object storage module — MinIO-compatible client; in production it signs against Amazon S3 (`MINIO_ENDPOINT=s3.ap-southeast-1.amazonaws.com`, `MINIO_BUCKET_PREFIX=kapwa-prod`); server-side uploads; presigned GET URLs only, bucket init on boot | `kapwa-server/src/minio/minio.service.ts` |
| pii-masking interceptor — PII fields nulled when consent revoked, admin bypass | `kapwa-server/src/beneficiaries/pii.interceptor.ts` |
| all-exceptions filter — 429 for throttler, 400 for WS, normalized `{statusCode, message, timestamp, path}` | `kapwa-server/src/common/filters/http-exception.filter.ts` |
| Role + ABAC guards — `@Roles` enforcement with ABAC fallback | `kapwa-server/src/auth/guards/roles.guard.ts`, `kapwa-server/src/auth/guards/abac.guard.ts` |
| Health endpoints — `/health`, `/health/live`, `/health/ready` (DB `SELECT 1`) | `kapwa-server/src/app.controller.ts` |
| Offline queue — localStorage queue, version vectors, conflict states | `kapwa-client/src/lib/offline-queue.ts` |
| Export module — PDF (PDFKit), XLSX, CSV; certificates, monthly funds, audit logs | `kapwa-server/src/export/export.service.ts`, `kapwa-server/src/export/export.controller.ts` |
| Audit — hash-chain verification, audit logs, `pgaudit` extension + `audit_log` table | `kapwa-server/src/audit/audit.controller.ts`, `kapwa-server/src/database/migrate.ts`, `kapwa-server/src/database/migrations/20260622000005-IRFDispositionEncryption.ts` |
| Production topology — CloudFront → S3 SPA + EC2 API container → RDS/S3; deploy workflow + `deploy-aws.sh` | `09-deployment-diagram.md`, `docs/DEPLOYMENT-AWS.md`, `.github/workflows/deploy-aws.yml` |
| API host compose — single `kapwa-api` service (no db/minio/caddy containers) | `kapwa-server/docker-compose.aws.yml` |
