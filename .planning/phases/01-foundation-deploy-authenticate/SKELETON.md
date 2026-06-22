# Walking Skeleton — Kapwa (MSWDO Norzagaray)

**Phase:** 1
**Generated:** 2026-06-19

## Capability Proven End-to-End

> A staff member can deploy the full system stack via Docker Compose (PostgreSQL, MinIO, Caddy, NestJS API), log in with role-appropriate credentials, and see the dashboard — proving infrastructure, auth, encrypted storage, and sync readiness work together.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | NestJS 11 (server) + React 18 (client) | Existing codebase brownfield — already using this stack. Modular NestJS architecture with 19 domain modules provides separation of concerns |
| Data layer | PostgreSQL 16 + TypeORM 0.4 alpha | Existing ORM; pgcrypto, pg_trgm, pgAudit extensions available. Connection pool max 25 (configured in Plan 1) |
| Object storage | MinIO (self-hosted S3-compatible) | Self-hosted, encryption at rest, versioning, presigned URLs. No recurring API costs. Follows offline-first philosophy |
| Reverse proxy | Caddy 2 | Auto-TLS via Let's Encrypt, built-in rate limiting, simple Caddyfile (single file vs Nginx complex config). WAF and security headers included |
| Auth | JWT + passport + bcrypt + TOTP MFA | Existing implementation. Role-based access (RBAC) with 6 roles + ABAC consent layer |
| Deployment | Docker Compose (Ubuntu host) | Single host deployment for MSWDO. 4 services: db, api, minio, caddy. Backup via cron script |
| Mobile storage | SQLCipher (native) + AES-256-GCM (browser fallback) | Platform-aware abstraction: `SecureStorage` delegates to Capacitor SQLCipher plugin on native, existing encrypted-db on browser |
| Sync protocol | Ed25519-signed delta sync with version vectors | Existing implementation. Idempotency keys enforced with DB-backed persistence (survives restarts) |
| Audit | SHA-256 hash chain on all audit tables | Existing on interventions; extended to cases, beneficiaries, consent_ledger in Plan 4 |
| Directory layout | Feature modules `src/{module}/` with Controller → Service → Entity pattern | Existing NestJS convention. Infrastructure configs in `infra/` at repo root |

## Stack Touched in Phase 1

- [x] Project scaffold — existing codebase used as-is (NestJS 11, React 18, Vite, Capacitor 6)
- [x] Routing — existing routes: login, dashboard, admin, cases, etc.
- [x] Database — PostgreSQL 16 with RLS for all 6 roles; connection pooling configured
- [x] Object storage — MinIO running in Docker with 6 auto-created buckets; NestJS MinioService for S3 operations
- [x] Reverse proxy — Caddy 2 with rate limiting, security headers, auto-TLS (production domain configurable)
- [x] Auth — JWT login with MFA; admin can create users of all 6 role types
- [x] Sync infrastructure — SQLCipher encrypted mobile storage + AES-256-GCM browser fallback; offline queue count displayed in UI
- [x] Audit — SHA-256 hash chaining on cases, beneficiaries, consent_ledger, interventions; `/api/audit/verify-all` endpoint
- [x] Idempotency — DB-backed idempotency key store in sync endpoint
- [x] Deployment — `docker compose up` boots all 4 services; backup cron script included

## Out of Scope (Deferred to Later Slices)

- Mobile SQLCipher initialization tied to user login password derivation (Phase 2 sync wiring)
- Full GIS intake workflow (Phase 2)
- Case management FSM beyond basic auth (Phase 3)
- Intervention logging (Phase 3)
- Access Card system (Phase 4)
- Dynamic programs / IRF module (Phase 5)
- Role-specific dashboards and notifications (Phase 6)
- Twilio SMS integration for alerts (Phase 6)
- Redis-backed idempotency cache (in-memory + DB is sufficient for v1)

## Subsequent Slice Plan

- **Phase 2**: GIS Intake & Beneficiary Registration — Dual-mode GIS intake with consent management, search, family graph
- **Phase 3**: Intervention Tracking & Case Management — Full case FSM, post-disbursement logging, ABAC enforcement
- **Phase 4**: Access Card System — Code# generation, 18-row service log, loss/replacement
- **Phase 5**: Dynamic Programs & IRF Module — Program config, encrypted IRF submission, WCPD/PNP export
- **Phase 6**: Dashboards, Notifications & Role Completion — Role-specific UIs, SMS + in-app notifications, compliance exports
