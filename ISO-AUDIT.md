# ISO/IEC 25010:2023 — Quality Audit & Improvement Tracker

**Audited:** 2026-09-22  
**Standard:** ISO/IEC 25010:2023 product quality model (9 characteristics, including the new *Safety* characteristic)  
**Overall score:** 8.1 / 10  
**Scope:** `kapwa-server` + `kapwa-client`  
**Method:** source review, CI/CD configuration, test-suite execution, dependency and migration inspection, and infrastructure checks. Supersedes the 2026-07-20 audit (6.9 / 10).

---

## Quality Scores

| Characteristic | Score | Evidence | Key Weakness |
|---|---|---|---|
| Functional Suitability | ⚡ 9/10 | 35 domain modules, 34 controllers; complete intake → assessment → approval → disbursement → closure flow; COE, PCV, GIS, IRF, CSR and access-card generation; 73 server suites / 601 tests plus 115 client test files | No duplicate-assistance detection within a configurable window; `SPEC-GAP.md` is stale and overstates several failures (e.g. physical files exist with QR fields) |
| Performance Efficiency | ⚠️ 7/10 | In-memory TTL `CacheService`; 200+ indexes including GIN trigram search and case status/worker indexes; shared `paginate()` helper; 60 client lazy-loaded routes | Cache is per-instance (no Redis); no APM/tracing (OpenTelemetry); no load-test evidence |
| Compatibility | ⚠️ 7/10 | URI API versioning (`/api/v1`), OpenAPI at `/api/docs`, PWA manifest, English/Filipino parity (2,216 keys each), CSV/PDF/XLSX exports | No contract tests; manifest without a service worker (offline is a UI queue, not cached assets); CORS origins hardcoded to localhost |
| Interaction Capability | 8/10 | Full en/fil i18n with parity test; Radix UI primitives; axe accessibility assertions in 31 client test files plus `@axe-core/playwright`; toast feedback and keyboard support | No formal WCAG 2.2 AA audit; dark mode applied inconsistently (6 files) |
| Reliability | ⚡ 9/10 | `CircuitBreakerService` + 3-attempt exponential retry (cockatiel); `/health`, `/health/live`, `/health/ready`; graceful shutdown; 69 transactional paths; hash-chained audit; idempotent, fresh-boot-safe migration chain | Single-node assumptions (SLA cron, cache); no load or chaos testing |
| Security | 🛡️ 9/10 | helmet; global CSRF double-submit guard; throttler (60/min, env-tunable); JWT 1h/7d with `token_version`; TOTP + email-OTP MFA; bcrypt cost 12; Zod validation on every route; Postgres RLS + ABAC; consent ledger; PII masking gated behind an audited justification; production boot guards fail fast | Uploaded files are stored unencrypted on local disk (MinIO module exists but filing does not use it); no dependency scanning in CI; CORS allow-list cannot be configured for production |
| Maintainability | ⚡ 9/10 | 601 server tests, 115 client test files, client coverage gate (70% lines, 70% functions, 60% branches, 70% statements); CI runs lint + typecheck + build + tests; 57-migration chain with documented conventions; architecture, schema, role-matrix and functionality docs | No ADRs; schema docs drift from the code; legacy flattened getters accumulate on normalized entities |
| Flexibility | ⚠️ 7/10 | Multi-stage Dockerfiles and compose; three CI/CD workflows (ci, deploy, deploy-aws); Caddy, healthcheck and backup infrastructure; env-driven configuration; seed scripts; agencies/programs are data-driven | No feature flags; no horizontal-scaling or job-queue strategy |
| Safety | ⚠️ 8/10 | Case FSM rejects invalid transitions; RLS/ABAC and consent restrict scope; hash chain makes tampering detectable; production misconfiguration aborts boot; rotating backups (7 daily / 4 weekly / 3 monthly); confirmation dialogs on destructive actions | No documented risk register or incident runbook; no remote wipe for lost/stolen devices |

**Overall:** average of the nine characteristics = **8.1 / 10** (up from 6.9).

### Movement vs. previous audit

- **Interaction Capability** 6 → 8: i18n shipped (en + fil) and accessibility assertions expanded.
- **Compatibility** 6 → 7: versioning, OpenAPI and exports are in place; contract tests and offline caching remain.
- **Flexibility** 6 → 7: deployment pipeline and infra matured; feature flags still absent.
- **Reliability** 8 → 9: retry policy is now formal (exponential backoff) rather than ad-hoc.
- **Safety** is newly scored under the 2023 revision (8/10).

---

## Improvement Backlog

### Critical — production stability and data protection

| # | Item | Characteristic | Status | Notes |
|---|---|---|---|---|
| 1 | Add `helmet` middleware for HTTP security headers | Security | ✅ Done | Applied in `main.ts` |
| 2 | Add circuit breakers + retry for external services (MinIO, Twilio, SMTP) | Reliability | ✅ Done | `CircuitBreakerService` with cockatiel; 3 attempts, exponential backoff |
| 3 | Add server-side cache layer (Redis / in-memory with TTL) | Performance Efficiency | ⚠️ Partial | In-memory TTL `CacheService` shipped; Redis still pending for multi-instance |
| 4 | Create deployment pipeline (Dockerfile + CI/CD) | Flexibility | ✅ Done | Multi-stage Dockerfiles, `ci.yml`, `deploy.yml`, `deploy-aws.yml` |
| 5 | Encrypt uploaded documents at rest | Security / Safety | ⬜ Open | Filing writes plaintext buffers to `uploads/` on local disk; move to MinIO with server-side encryption or encrypt the blob before writing. IRF narrations are already AES-encrypted |

### Important — operational quality

| # | Item | Characteristic | Status | Notes |
|---|---|---|---|---|
| 6 | Add CSRF protection | Security | ✅ Done | `CsrfGuard` (double-submit cookie), global guard, client `X-CSRF-Token` header |
| 7 | Introduce API versioning scheme | Compatibility | ✅ Done | URI versioning (`/api/v1`) + OpenAPI at `/api/docs` |
| 8 | Reduce cyclomatic complexity in frontend | Maintainability | ✅ Done | Extracted hooks: `useCaseFilters`, `useCaseActions`, `useAssignmentModals`, `useIrfOperations` |
| 9 | Fix unguarded recursion in `encrypted-db.ts` | Reliability | ✅ Done | `try/catch`, `safeLocalStorage()`, `canUseCrypto()`, `MAX_ENCRYPTION_RETRIES` |
| 10 | Add ARIA labels + keyboard navigation audit beyond vitest-axe | Interaction Capability | ⚠️ Partial | axe assertions now run across 31 client test files and Playwright; a formal WCAG 2.2 AA audit is still outstanding |
| 11 | Add i18n infrastructure (en + fil) | Interaction Capability | ✅ Done | `react-i18next` with 2,216 keys per locale and a parity test |
| 12 | Add performance monitoring (health probes + OpenTelemetry tracing) | Performance Efficiency | ⚠️ Partial | `/health`, `/health/live`, `/health/ready` shipped; no tracing or metrics pipeline |
| 13 | Make CORS origins environment-driven | Security / Flexibility | ⬜ Open | `main.ts` allows only localhost origins; wire `APP_URL` / `ALLOWED_ORIGINS` so production works without a code change |
| 14 | Add dependency vulnerability scanning to CI | Security | ⬜ Open | No `npm audit`, Dependabot or Renovate configuration |
| 15 | Document a risk register and incident runbook | Safety | ⬜ Open | Fail-safe behaviour exists in code; hazards and response steps are undocumented |

### Good — quality of life

| # | Item | Characteristic | Status | Notes |
|---|---|---|---|---|
| 16 | Write Architecture Decision Records | Maintainability | ⬜ Open | Use `manage_adr`; decisions currently live in commit history and specs |
| 17 | OpenAPI contract testing (`jest-openapi`) | Compatibility | ⬜ Open | Validate responses against the generated spec |
| 18 | Lazy loading for heavy pages (`React.lazy` + `Suspense`) | Performance Efficiency | ✅ Done | 60 lazy route imports across the client |
| 19 | Redis-backed cache and distributed rate limiting | Reliability / Performance | ⬜ Open | Required before horizontal scaling |
| 20 | Feature flags for staged rollout | Flexibility | ⬜ Open | No `FEATURE_*` mechanism found |
| 21 | Service worker for true offline support (Workbox) | Compatibility / Reliability | ⬜ Open | PWA manifest exists, but assets are not cached and background sync is absent |
| 22 | Remote wipe / device revocation for lost devices | Security / Safety | ⬜ Open | `device_id` column exists but is never enforced |
| 23 | Duplicate-assistance detection window | Functional Suitability | ⬜ Open | Prevents double disbursement within a configurable period |
| 24 | WCAG 2.2 AA remediation and complete dark mode | Interaction Capability | ⬜ Open | Follow-up to item 10 |
| 25 | Refresh `SPEC-GAP.md` and `DB-SCHEMA.md` against the current code | Maintainability | ⬜ Open | Physical files, QR fields and many modules post-date the documents |

---

**Legend:** ⬜ Open | ⚠️ Partial | ✅ Done

**Scoring note:** each characteristic is scored 1–10 on implemented, verifiable evidence only. Items marked *Partial* cap the characteristic below 9. The overall score is the unweighted mean of the nine characteristic scores.
