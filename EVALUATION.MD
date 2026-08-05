# KAPWA — System Codebase Evaluation

> **Prepared by**: system documenter/analyst
> **Date**: 2026-08-04
> **Scope**: Full-stack audit of the KAPWA social-welfare information system (MSWDO Norzagaray, Bulacan)
> **Branch evaluated**: `main` (HEAD `53891cc`), 145 commits, post `feat/agency-portal` fast-forward merge

---

## 1. Executive Summary

KAPWA is a thesis-grade, offline-first social welfare management system for the MSWDO of
Norzagaray, Bulacan. It is a two-application monorepo — a **NestJS 10 + TypeORM + PostgreSQL 16**
backend (`kapwa-server`) and a **React 19 + Vite + Capacitor + SWR** frontend (`kapwa-client`) — with
custom offline delta-sync, PII masking, consent-gated access, and a hash-chained audit trail.

The system covers the full beneficiary lifecycle: GIS intake → case FSM → post-disbursement
intervention logging → access-card tracking → IRF (Incident Report Form) → barangay coordinator
referrals → **inter-agency beneficiary tracking** (new) → **agency-facing portal** (new).

**Architecture verdict:** Well-separated server/client, clean NestJS layering (controllers →
services → guards → repositories), high cluster cohesion in the knowledge graph (avg ~0.79, strongest
= validation/messaging at 0.94), a mature offline-first sync subsystem (cohesion 0.89), and centralized
cross-cutting concerns. **Functional, reviewed, and E2E-tested — with a documented pre-existing test
baseline that needs a dedicated hardening pass.**

| Dimension | Status |
|-----------|--------|
| Server test suites | 29 pass / 7 fail (pre-existing baseline) |
| Server tests | 241 pass / 53 fail (pre-existing baseline) |
| Client test files | 60 pass / 12 fail (pre-existing baseline) |
| Client tests | 347 pass / 24 fail (pre-existing baseline) |
| Feature test suites (agency portal / inter-agency / seed) | ALL PASS |
| Full-system E2E (Playwright MCP) | 9 roles × all modules pass; 4 pre-existing issues documented |
| Production builds | `nest build` clean (41 dist entries); `vite build` ok (~2.5 MB) |

---

## 2. Repository Layout

```
/ (repo root) — monorepo
├── KAPWA-PROJECT.md        # Spec: roles, workflows, schema, compliance, sprint plan
├── ARCHITECTURE.md         # Mermaid architecture + sequence diagrams
├── DB-SCHEMA.md            # 34-section schema reference + RLS policies
├── AUDIT-GAPS.md / SPEC-GAP.md / ISO-AUDIT.md / TEST-PLAN.md / LEGACY.md / bugsnow.md
├── EVALUATION.MD           # this file
├── docker-compose.yml      # postgres + minio + server + client
├── deploy.sh / update.sh   # DigitalOcean deployment scripts
├── kapwa-server/           # NestJS backend (227 source files, 28 spec files)
│   ├── src/
│   │   ├── app.module.ts          # root module: 26 feature modules + global guards
│   │   ├── main.ts                # bootstrap, Swagger, helmet, CORS, prod env checks
│   │   └── <domain>/              # one folder per feature module
│   ├── dist/  coverage/  uploads/  scripts/
│   └── Dockerfile, jest.config.ts, nest-cli.json
├── kapwa-client/           # React SPA (190 source files, 77 test files)
│   ├── src/
│   │   ├── main.tsx / App.tsx / routes.tsx
│   │   ├── pages/          # 49 page components
│   │   ├── components/     # ui (shadcn), dashboard, data-table, referrals, a11y, ...
│   │   ├── hooks/  lib/    # api, auth-context, offline-queue, sync, database, secure-storage
│   ├── capacitor.config.ts, vite.config.ts, nginx.conf
├── infra/                  # Caddyfile, backup cron, healthcheck, .env.production
├── .planning/              # GSD planning: PROJECT/ROADMAP/STATE/REQUIREMENTS/SECURITY + phases
├── .superpowers/sdd/       # SDD ledger + task briefs/reports + review diffs
├── docs/                   # E2E reports + screenshots + design/plan docs
└── tests/  test-results/   # root-level integration test suites
```

---

## 3. Technology Stack

### Backend (`kapwa-server`)
| Area | Tech |
|------|------|
| Framework | NestJS 10/11 (`@nestjs/core ^11`) |
| ORM / DB | TypeORM 0.4 alpha + `pg` (PostgreSQL 16), snake_case naming strategy |
| Validation | Zod (`zod ^3`) via custom `ZodPipe` + class-validator DTOs |
| Auth | Passport JWT + Local, bcrypt, TOTP MFA (`thirty-two`), device binding |
| Real-time | `socket.io` (chat + notifications gateways) |
| Files | MinIO (S3), `pdfkit`/`pdfmake` (PDF), `exceljs` + `csv-stringify` (exports) |
| SMS/Email | Twilio (`sms-gateway.service`), Nodemailer, circuit breaker via `cockatiel` |
| Security | `helmet`, throttler (60/min), CSRF guard, cookie-parser |
| Docs | `@nestjs/swagger` at `/api/docs` |

### Frontend (`kapwa-client`)
| Area | Tech |
|------|------|
| Framework | React 19, Vite 8, TypeScript 5.7 |
| Routing | React Router v6 (`createBrowserRouter`) |
| Data fetching | SWR 2 (global fetcher = `api.get`, 2 s dedup) |
| Styling | Tailwind CSS 4 + shadcn/ui (Radix primitives) |
| Forms | react-hook-form + `@hookform/resolvers` (Zod) |
| Charts/Graphs | recharts, @xyflow/react, react-grid-layout |
| Editor | Tiptap (rich text for announcements) |
| Offline | Capacitor 8 (sqlite), IndexedDB-style local DB, secure-storage |
| Testing | Vitest 4 + Testing Library + vitest-axe + Playwright (E2E) |

### Infra
Docker Compose (postgres:16-alpine, minio, server, client), Caddy reverse proxy with auto-TLS,
Podman-based local dev (see `docs/podman-postgres-dev.md`), `deploy.sh` for DigitalOcean droplets.

---

## 4. Server Architecture

### 4.1 Root module wiring (`app.module.ts`)
Global prefix `api`, URI versioning `v1`, 26 feature modules:

```
auth sync cases programs beneficiaries notifications irf dashboard chat csr audit export filing
users access-cards case-interventions lcr sla otp minio intake referrals announcements
agencies inter-agency-referrals agency-portal        ← last 4 are the inter-agency feature
```

**Global providers:**
- `APP_GUARD` → `ThrottlerGuard` (rate limit 60/min) + `CsrfGuard`
- `APP_FILTER` → `AllExceptionsFilter` (never leaks internal IDs/stack traces)
- `APP_INTERCEPTOR` → `PiiMaskingInterceptor` (server-side PII masking)

### 4.2 Security & access control
- **JWT auth** (`jwt-auth.guard`, `jwt.strategy`) with refresh-token rotation, token_version
  invalidation, email verification, TOTP MFA, device binding (`device_id`).
- **RBAC** — `@Roles()` decorator + `roles.guard`. Seven roles (`auth/user.entity.ts`):
  `social_worker`, `admin`, `coordinator`, `claimant`, `mayor`, `auditor`, `agency_staff`.
- **ABAC** (`auth/services/abac.service.ts`) — `evaluate()` chains barangay-scope → consent →
  resource-sensitivity checks. Resource sensitivity derived from URL path
  (interventions/financial=sensitive, irf=restricted, beneficiaries/family=sensitive,
  cases=internal, programs/tracker/dashboard=public, sync/audit=restricted).
- **Consent gating** (`consent.guard`, `consent_ledger` table) — revoked consent = immediate mask/null.
- **PII masking** — `PiiMaskingInterceptor` (server) + `MaskedField`/`usePiiMasking` (client).
- **IRF confidentiality** — AES-256 narration encryption (`IRF_ENCRYPTION_KEY` enforced in prod),
  names masked by default, secure export requires `legal_basis_code` + audit log entry.
- **NOTE (RLS):** Row-Level Security policies are defined in migrations but **dormant** — the app
  connects as table owner `kapwa` and never sets `app.current_role`. Data scoping is enforced at the
  **service layer** instead (a deliberate, reviewed convention).

### 4.3 Feature modules (29 directories under `src/`)
- **Beneficiaries/cases**: unified `persons` model, households, beneficiary roles/claimants,
  case FSM (`enrolled → assessed → in_review → active → transitioning → closed` in sync service;
  legacy `pending_assessment → ... → disbursed` in cases service), case-history audit,
  case-interventions (post-disbursement only), duplicate detection (PSN exact-match + sliding window).
- **Programs**: dynamic program config with versioned JSON-Schema form templates
  (`form_version_history`), request-review flow, SLA timers.
- **IRF**: incident-report forms, blotter # sequencing, encrypted narration, disposition FSM,
  WCPD/PNP export with audit.
- **Access cards**: serial-number sequence, per-card service ledger, agency-tagged services
  (`agency_id` added to `access_card_services`), print view, coordinator module.
- **Inter-agency (NEW)**: `agencies` (MSWDO/RHU/WCPD/PESO/DILG/DSWD/DepEd), `inter_agency_referrals`
  (status FSM `referred → received → actioned → closed/declined`), referral-scoped beneficiary
  search endpoint, IRF export agency lookup, agency normalization on access cards.
- **Agency portal (NEW)**: `agency-portal` module exposing dashboard/profile; referral-scoped
  queries; `agency_staff` role persisted via `users.agency_id`.
- **Cross-cutting**: audit (hash-chained), export (Excel/CSV/PDF), filing (CSR), lcr (PhilSys LCR
  import), otp, notifications (real-time + SMS templates + preferences), chat, minio,
  physical-files (document vault), announcements (public + managed, rich text), admin-wipe,
  email verification.
- **Sync**: offline-first delta sync — `sync_queue`, `version_vectors` (CRDT), `idempotency_keys`,
  domain-aware `conflict-resolver` (server-wins for financial/status, chronological append for notes,
  queue for unclear), FSM-control-field stripping, strict allow-list of syncable columns,
  Ed25519-style signing.

### 4.4 Seed & migrations
- **38 migrations** covering schema evolution end-to-end (uuid v7 function, initial schema through
  inter-agency tables `20260803*`). `migrationsRun: true` in the TypeORM config; `npm run
  migration:run` as an alternative.
- **Seed** (`database/seed-accounts.ts`): idempotent, no deterministic UUIDs (DB `uuid_generate_v7()`),
  `ON CONFLICT (email) DO NOTHING`, **26 accounts**:
  - 7 base (admin, 2 social workers, 2 claimants, mayor, auditor) — MSWDO trio linked to agency MSWDO
  - 13 barangay coordinators — `coordinator.<slug>@mswdo.test` / `coordinator123`, 1 per barangay
  - 6 non-MSWDO agency staff — `rhu|wcpd|peso|dilg|dswd|deped.staff@norzagaray.test`, per-agency pw

---

## 5. Client Architecture

### 5.1 Routing (`routes.tsx`)
Public routes (landing, about, contact, announcements) + auth pages (login/register/verify/reset) +
~40 protected routes grouped by role. `ProtectedRoute` checks token → `getCurrentUser` → role
allow-list, and on denial redirects via `roleRedirectMap` (now includes `agency_staff → /agency/dashboard`).
Catch-all `*` → `/`.

### 5.2 Data & auth layers
- **`lib/api.ts`** — typed fetch client: `kapwa_token` in localStorage, CSRF cookie header,
  10 s timeout, 3 retries with jittered exponential backoff, token-refresh interceptor, dispatches
  `kapwa:auth:logout` on 401.
- **`lib/auth-context.tsx`** — `AuthProvider` + `useAuth()`; login/MFA challenge flow; `getCurrentUser`;
  logout event wiring.
- **`lib/offline-queue.ts`** — IndexedDB-backed change queue (`INSERT/UPDATE/DELETE` + FSM
  transitions), version vectors, `mergeRecords`/`resolveConflict` (server-wins/client-wins).
- **`lib/sync.ts`** — `processDeltaSync`, `pullFromServer`, `resolveConflictRemotely`,
  `syncOnReconnect` with online detection.
- **`lib/database.ts`** — SQLite/IndexedDB CRUD facade for offline tables.
- **`lib/secure-storage.ts`** — encrypted local storage (browser/native variants).

### 5.3 Pages (49) grouped by audience
- **Public/auth**: Landing, About, Contact, Login, Register, VerifyEmail, Forgot/ResetPassword
- **Admin/SW**: Dashboard, Intake, IntakeReview, Cases, CaseView, Beneficiaries, BeneficiaryView,
  CaseTracker, ApprovalPipeline, Admin, Programs, ProgramDetail, CreateProgram, Settings, MFA,
  AuditLogs (Auditor), IRF suite (List/Detail/Create), AccessCardView/Print, PhysicalFiles,
  Announcements (Manage/Edit), InterAgencyReferrals
- **Coordinator**: CoordinatorDashboard, ReferralForm, ReferralList, AccessCards
- **Agency (NEW)**: AgencyDashboard, AgencyReferrals, AgencyCardActivities, AgencyProfile
- **Claimant**: ClaimantDashboard (`/my-dashboard`), Messages
- **Mayor**: MayorReports
- Shared: SearchResults, Notifications, ReferralReview, Referrals

### 5.4 Notable component architecture
- **shadcn/ui** primitives (Radix) in `components/ui/*`; dashboard engine + role-specific widget
  sets; reusable `DataTable` (TanStack table); `CaseStepper` (9 FSM step components); consent
  manager; family graph (xyflow); bulk-action bar; PII `MaskedField`; a11y kit (FocusTrap,
  AriaLiveRegion, SkipToContent, axe tests).
- **Inter-agency (NEW)**: shared `ReferralCard`, `CreateReferralForm`, `referral-utils`;
  `useDebouncedSearch` gained an optional `fetcher` param so agency_staff can use the scoped
  beneficiary-search endpoint; `UsersPanel` gained an agency select (required for `agency_staff`);
  `Topbar` labels agency users.

---

## 6. Data Model (PostgreSQL)

34-section `DB-SCHEMA.md`; core active tables: `persons` (unified identity), `users`, `beneficiaries`
(thin wrapper over persons), `households` + `household_memberships`, `beneficiary_claimants`,
`beneficiary_roles`, `cases`, `case_history`, `case_interventions`, `programs`,
`form_version_history`, `referrals`, `irf_cases`, `access_card_services`, `csr_reports`,
`document_vault`, `chat_messages`, `notifications`, `notification_preferences`, `consent_ledger`,
`otp_codes`, `sync_queue`, `version_vectors`, `idempotency_keys`, `audit_log`, `intervention_types`,
`access_card_seq`, `irf_blotter_seq`, **`agencies`**, **`inter_agency_referrals`**,
**`physical_files`**.

Key identity decisions: UUIDv7 keys, snake_case columns, `persons` as the unified model after
the "UnifiedPersonModel" migration, access-card sequence generator, version-vector table for sync.

---

## 7. Testing & Quality State

### 7.1 Automated tests
| Suite | Result | Notes |
|-------|--------|-------|
| Server — feature suites (agency-portal, agencies, inter-agency-referrals, users, access-cards) | **61 pass / 0 fail** | re-verified post-merge |
| Server — all suites | **29 pass / 7 fail** (241/294 tests) | 7 failing = documented pre-existing baseline |
| Client — feature files (4 agency pages, UsersPanel, ProtectedRoute, Login, AccessCardView, InterAgency) | **29 pass / 0 fail** | re-verified post-merge |
| Client — all files | **60 pass / 12 fail** (347/371 tests) | 12 failing = documented pre-existing baseline |
| Builds | `nest build` clean; `vite build` OK | |
| Full-system E2E (Playwright MCP) | **9 roles × all modules pass** | 4 pre-existing findings documented |

### 7.2 Pre-existing server failures (baseline — NOT caused by inter-agency work)
`src/cases`, `src/auth`, `src/dashboard`, `src/chat`, `src/filing`, `src/notifications`,
`src/sync/conflict-resolver` — 53 tests fail. Example: `CasesService.validateTransition` FSM
rules reject `transitioning → closed` for `admin` (test expects admin closure allowed; rule set
only permits it for other roles), and closure-requirement expectations mismatch current FSM.

### 7.3 Pre-existing client failures (baseline)
12 files, e.g. `ErrorBoundary`, `PageShell`, `SyncQueuePanel`, `auth-context.useauth`, `AdminPage`,
`ApprovalPipelinePage`, `BeneficiariesPage`, `CasesPage`, `CaseTrackerPage`,
`CoordinatorDashboardPage`, `DashboardPage`, `SettingsPage`. Predominantly stale snapshots,
timing/debounce assertions, and role-query expectations — none touched by the inter-agency/portal work.

### 7.4 Known latent issue
The client build script is `vite build` **without `tsc`**, so ~21 TypeScript type errors never
surface in CI builds (latent, non-blocking). Server typecheck is clean.

---

## 8. Findings & Recommendations

### Strengths
1. **Clean modular layering** — NestJS feature modules with controllers/services/guards separated;
   knowledge-graph clusters map cleanly to real modules with high cohesion.
2. **Mature offline sync** — queue + version vectors + idempotency keys + conflict resolver is a
   genuinely production-shaped design (3 server sync suites + integration tests pass).
3. **Defense-in-depth auth** — JWT + refresh rotation + MFA + device binding + CSRF + throttling +
   consent gating + ABAC + PII masking.
4. **Compliance-conscious** — consent ledger, hash-chained audit, IRF encryption, legal-basis-gated
   exports, "No Card = No Voucher" guard.
5. **Reviewed + E2E-tested feature** — inter-agency tracking and agency portal passed spec-gap
   review waves and a 9-role full-system E2E before merge.

### Gaps / risks (prioritized)
1. **HIGH — pre-existing test baseline (7 server / 12 client failing suites).** The FSM rule set
   (`cases.service.ts` + `sync.service.ts`) appears to have drifted from its tests — the FSM is
   implemented in *two* places with different transition tables (legacy `pending_*` vs KilosUnlad
   `enrolled_*`), which is a maintainability hazard. Needs a dedicated reconcile pass.
2. **HIGH — dormant RLS.** RLS policies exist in migrations but the app runs as the table owner,
   so they are inert. Single-connection service-layer scoping is the effective control; this is
   deliberate, but any future direct-DB access bypasses all authorization. Recommend documenting or
   completing the RLS wiring.
3. **MEDIUM — duplicate FSM implementations** (`cases` vs `sync` transition tables) risk divergence;
   unify behind one source of truth.
4. **MEDIUM — client type errors not gated** — add `tsc --noEmit` (or `vue-tsc`-equivalent) to the
   build/CI pipeline.
5. **LOW — dev-DB leftovers** (3 pre-overhaul rows: `coordinator@mswdo.test`, `mfa-admin@mswdo.test`,
   `rhu1@norzagaray.test`) — recommend a cleanup migration or documented wipe step.
6. **LOW — known UI baselines** (documented in `docs/e2e-full-system.md`): claimant `/my-access-card`
   dead link (no route; catch-all swallows it), shell 403s on `/notifications/my|unread` and
   `/chat/conversations|unread` for mayor/auditor/agency_staff, `BottomNav` mobile tabs not
   role-filtered.
7. **LOW — seed**: `indexOf`-in-loop candidate scan is O(n²) but works by construction; seed logs
   counts candidates rather than inserted rows.

---

## 9. Key Artifacts Map

| Artifact | Path |
|----------|------|
| Project spec | `KAPWA-PROJECT.md` |
| Architecture | `ARCHITECTURE.md`, `DB-SCHEMA.md` |
| Compliance audit | `AUDIT-GAPS.md`, `ISO-AUDIT.md`, `SPEC-GAP.md` |
| Test plan | `TEST-PLAN.md` |
| Inter-agency design/plan | `docs/superpowers/specs/2026-08-03-inter-agency-tracking-design.md`, `docs/superpowers/plans/2026-08-03-inter-agency-tracking.md` |
| Agency portal design/plan | `docs/superpowers/specs/2026-08-03-agency-portal-design.md`, `docs/superpowers/plans/2026-08-03-agency-portal.md` |
| Seed + E2E design/plan | `docs/superpowers/specs/2026-08-03-seed-overhaul-e2e-design.md`, `docs/superpowers/plans/2026-08-03-seed-overhaul-e2e.md` |
| E2E reports | `docs/e2e-inter-agency-tracking.md`, `docs/e2e-full-system.md` (+ `docs/e2e-screenshots/`) |
| SDD ledger | `.superpowers/sdd/progress.md` |
| GSD planning | `.planning/` (PROJECT, ROADMAP, STATE, REQUIREMENTS, SECURITY, phases) |
| Dev DB setup | `docs/podman-postgres-dev.md` |
