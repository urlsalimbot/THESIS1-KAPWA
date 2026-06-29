# Codebase Structure

**Analysis Date:** 2026-06-29

## Directory Layout

```
THESIS1-KAPWA/
├── kapwa-client/            # React PWA frontend (Vite + Capacitor)
│   ├── src/
│   │   ├── components/     # Shared UI components
│   │   │   ├── data-table/ # TanStack Table system (DataTable, Pagination, Toolbar, ColumnHeader)
│   │   │   ├── forms/      # Dynamic form renderers
│   │   │   └── *.tsx       # Layout, ErrorBoundary, BottomNav, etc.
│   │   ├── lib/            # Client services (API, auth, sync, storage)
│   │   └── pages/          # Screen-level page components
│   ├── public/             # Static assets (icons, manifest, SW)
│   ├── tests/              # Client test files
│   ├── index.html          # Vite entry HTML
│   └── *.config.ts         # Build configs (vite, vitest, tailwind, capacitor)
├── kapwa-server/            # NestJS API backend
│   ├── src/
│   │   ├── auth/           # Authentication + authorization
│   │   ├── beneficiaries/  # Beneficiary management
│   │   ├── cases/          # Case FSM management
│   │   ├── interventions/  # Post-disbursement intervention logging
│   │   ├── programs/       # Dynamic program configuration
│   │   ├── sync/           # Offline sync protocol
│   │   ├── notifications/  # SMS + in-app notifications
│   │   ├── dashboard/      # Metrics and SLA dashboard
│   │   ├── chat/           # Real-time messaging (WebSocket)
│   │   ├── tracker/        # Daily case tracker
│   │   ├── csr/            # CSR report generation
│   │   ├── irf/            # Incident Report Form
│   │   ├── filing/         # Document vault
│   │   ├── audit/          # Audit trail
│   │   ├── access-cards/   # Access card management
│   │   ├── users/          # User management
│   │   ├── lcr/            # LCR report module
│   │   ├── sla/            # SLA monitoring
│   │   ├── otp/            # OTP module (stub)
│   │   ├── common/         # Shared pipes, filters, constants
│   │   └── database/       # DB config, migrations, seed
│   ├── test/               # Server test files
│   ├── tsconfig.json
│   └── nest-cli.json
├── tests/                    # Top-level/integration tests
├── .planning/                # Project planning artifacts
│   └── codebase/            # Codebase analysis documents
├── KAPWA-PROJECT.md          # Project spec and handoff document
├── ARCHITECTURE.md           # Architecture diagram (existing)
├── AGENTS.md                 # Agent instructions
└── .gitignore
```

## Directory Purposes

### `kapwa-client/`

**Purpose:** React 18 PWA frontend — the offline-first client application

**Key files:**
- `src/main.tsx` — Application entry point
- `src/App.tsx` — Root component with AuthProvider + RouterProvider
- `src/routes.tsx` — All routes defined with createBrowserRouter
- `index.html` — Vite HTML entry point
- `vite.config.ts` — Vite dev server on port 3001
- `vitest.config.ts` — Vitest test configuration
- `tailwind.config.js` — Tailwind CSS configuration
- `capacitor.config.ts` — Capacitor mobile build configuration

**Subdirectories:**

`src/pages/` — 18 screen-level page components:
- `LoginPage.tsx` — Login with email/password + MFA challenge
- `DashboardPage.tsx` — Metrics overview with stat cards and recent cases table
- `IntakePage.tsx` — GIS Intake form (client stub, requirements, family composition)
- `CasesPage.tsx` — Case list and management
- `BeneficiariesPage.tsx` — Beneficiary list with search and filtering
- `BeneficiaryViewPage.tsx` — Single beneficiary detail view
- `InterventionsPage.tsx` — Post-disbursement intervention logging
- `MessagesPage.tsx` — Chat/messaging interface
- `CaseTrackerPage.tsx` — Daily case tracker view
- `CsrPage.tsx` — CSR report generation
- `AdminPage.tsx` — Admin panel
- `ClaimantDashboardPage.tsx` — Beneficiary self-service dashboard
- `FilingPage.tsx` — Digital document filing
- `ApprovalPipelinePage.tsx` — Case approval workflow
- `MfaSetupPage.tsx` — Multi-factor authentication setup
- `IrfPage.tsx` — Incident Report Form
- `AccessCardPage.tsx` — Access card management

`src/components/` — Shared UI components:
- `Layout.tsx` — Main app shell with sidebar navigation, header, and BottomNav
- `BottomNav.tsx` — Mobile bottom tab navigation (5 tabs + center Quick Action)
- `ProtectedRoute.tsx` — Auth guard + role check wrapper
- `ErrorBoundary.tsx` — React error boundary with fallback UI (network-aware)
- `NotificationsDropdown.tsx` — Notification bell dropdown
- `ChainViewer.tsx` — Hash-chain integrity viewer
- `data-table/` — TanStack Table system:
  - `DataTable.tsx` — Controlled table wrapper with server-side sort/search/paginate
  - `DataTablePagination.tsx` — shadcn Pagination prev/next + page numbers
  - `DataTableToolbar.tsx` — Single search bar with Search icon
  - `DataTableColumnHeader.tsx` — Sortable column header with direction indicator
  - `index.ts` — Barrel re-export
- `forms/JsonSchemaForm.tsx` — Dynamic form renderer from JSON Schema
- `forms/SignaturePad.tsx` — Signature capture component

`src/lib/` — Client-side services:
- `api.ts` — HTTP client with JWT header injection (18 endpoint functions)
- `auth-context.tsx` — React Context for auth state (login, logout, MFA, user)
- `auth.ts` — Additional auth utilities
- `sync.ts` — Delta sync protocol with Ed25519 signing + batch processing
- `offline-queue.ts` — Sync queue with version vectors (pending/synced/conflict/failed)
- `encrypted-db.ts` — AES-256-GCM encrypted localStorage via Web Crypto API
- `database.ts` — Simple in-memory/localStorage database abstraction
- `chat-socket.ts` — Socket.IO client for real-time messaging
- `constants.ts` — Domain constants (barangays, age ranges, categories, service types)

`public/` — Static assets:
- `sw.js` — Service worker for PWA
- `manifest.json` — PWA manifest
- `favicon.svg`, `icon-192.svg`, `icon-512.svg` — App icons

`tests/` — Test files:
- `sync-conflict.test.ts` — Sync conflict resolution tests
- `e2e.test.ts` — End-to-end tests
- `setup.ts` — Test setup

### `kapwa-server/`

**Purpose:** NestJS 10 API server — the backend with modular architecture

**Key files:**
- `src/main.ts` — Bootstrap NestJS, configure CORS, Swagger, global prefix
- `src/app.module.ts` — Root module importing all 19 feature modules
- `src/app.controller.ts` — Root controller (`GET /` and `GET /health`)
- `tsconfig.json` — TypeScript config (ES2021, decorators, strictNullChecks)
- `nest-cli.json` — NestJS CLI config

**Feature Modules (19 total, each at `src/{module}/`):**

All modules follow the same structure:
- `{module}.module.ts` — NestJS @Module definition
- `{module}.controller.ts` — HTTP route handlers
- `{module}.service.ts` — Business logic
- `{module}.entity.ts` — TypeORM entity (in most modules)
- `dto/{module}.zod.ts` — Zod validation schemas (in modules with POST/PATCH)
- `guards/` — Module-specific guards (auth module only)
- `decorators/` — Custom decorators (auth module only)
- `services/` — Sub-services (auth module: abac.service.ts)

| Module | Controller | Service | Entity |
|--------|-----------|---------|--------|
| `auth/` | `auth.controller.ts` | `auth.service.ts` | `user.entity.ts` |
| `cases/` | `cases.controller.ts` | `cases.service.ts` | `case.entity.ts`, `case-history.entity.ts` |
| `interventions/` | `interventions.controller.ts` | `interventions.service.ts` | `intervention.entity.ts` |
| `beneficiaries/` | `beneficiaries.controller.ts` | `beneficiaries.service.ts` | `beneficiary.entity.ts`, `household.entity.ts`, `family-member.entity.ts`, `consent-ledger.entity.ts` |
| `programs/` | `programs.controller.ts` | `programs.service.ts` | `program.entity.ts`, `form-version-history.entity.ts` |
| `sync/` | `sync.controller.ts` | `sync.service.ts` | `sync-queue.entity.ts`, `version-vector.entity.ts` |
| `notifications/` | `notifications.controller.ts` | `notifications.service.ts` | `notification.entity.ts` |
| `dashboard/` | `dashboard.controller.ts` | `dashboard.service.ts` | — (uses Case, Intervention, Beneficiary) |
| `chat/` | `chat.controller.ts` + `chat.gateway.ts` | `chat.service.ts` | `chat.entity.ts` |
| `tracker/` | `tracker.controller.ts` | `tracker.service.ts` | `tracker.entity.ts` |
| `csr/` | `csr.controller.ts` | `csr.service.ts` | `csr.entity.ts` |
| `irf/` | `irf.controller.ts` | `irf.service.ts` | `irf-case.entity.ts` |
| `filing/` | `filing.controller.ts` | `filing.service.ts` | `filing.entity.ts` |
| `audit/` | `audit.controller.ts` | `audit.service.ts` | — (uses Intervention) |
| `access-cards/` | `access-cards.controller.ts` | `access-cards.service.ts` | `access-card-service.entity.ts` |
| `users/` | `users.controller.ts` | `users.service.ts` | — (uses auth User entity) |
| `lcr/` | `lcr.controller.ts` | `lcr.service.ts` | — (uses Beneficiary) |
| `sla/` | `sla.controller.ts` | `sla.service.ts` | — (uses Case, Notification) |
| `otp/` | — | — | — (empty module) |

**Shared Utilities (`src/common/`):**
- `pipes/zod.pipe.ts` — Zod validation pipe
- `filters/http-exception.filter.ts` — Global exception filter
- `constants.ts` — Default list limit, intervention types, paginate helper

**Database (`src/database/`):**
- `data-source.ts` — TypeORM DataSource config (PostgreSQL, snake_case, entities, migrations)
- `migrate.ts` — Schema bootstrap script (creates tables, indexes, RLS policies, sequences)
- `snake-naming.strategy.ts` — Custom snake_case naming strategy
- `seed.ts` — Seed data script
- `compliance-audit.ts` — RA 10173 compliance audit script
- `migrations/` — TypeORM migration files (4 migrations)

### Top-level files

- `KAPWA-PROJECT.md` — Full project specification (tech stack, schema, API contract, workflows, compliance requirements)
- `ARCHITECTURE.md` — Existing architecture diagram (Mermaid) with component details, deployment, sequence diagrams
- `AGENTS.md` — Agentic coding guidelines for this repo
- `AUDIT-BUGS.md`, `AUDIT-FULL.md`, `audit-2026-06-17.md` — Audit reports
- `Project KAPWA.fig` — Figma design file

## Naming Conventions

**Files (Server):**
- `kebab-case.module.ts` — NestJS module files
- `kebab-case.controller.ts` — Controller files
- `kebab-case.service.ts` — Service files
- `kebab-case.entity.ts` — Entity files
- `{module}.zod.ts` — Zod schema files (inside `dto/` directory)
- `kebab-case.guard.ts` — Guard files
- `kebab-case.strategy.ts` — Passport strategy files
- `kebab-case.decorator.ts` — Decorator files
- `*.spec.ts` — Unit test files (co-located with source)

**Files (Client):**
- `PascalCase.tsx` — Page and component React files (e.g., `DashboardPage.tsx`, `BottomNav.tsx`)
- `kebab-case.ts` — Library/service files (e.g., `auth-context.tsx`, `offline-queue.ts`)
- `kebab-case` — Test helper directories
- `*.test.tsx` / `*.test.ts` — Co-located test files in `src/` or `tests/` directory

**Directories:**
- `kebab-case` — All directories (e.g., `access-cards/`, `data-table/`)
- Domain names for feature modules (e.g., `auth/`, `cases/`, `beneficiaries/`)
- Plural for collection directories (`pages/`, `components/`, `lib/`, `tests/`)

**Code:**
- PascalCase: React components, TypeScript types/interfaces/enums, classes, entity classes
- camelCase: Functions, methods, variables, properties
- UPPER_SNAKE_CASE: Constants (`BCRYPT_SALT_ROUNDS`, `DEFAULT_LIST_LIMIT`)
- snake_case: PostgreSQL columns, TypeORM column names (via custom naming strategy)

**API Routes:**
- Plural nouns: `/api/cases`, `/api/beneficiaries`, `/api/interventions`
- Nested for sub-resources: `/api/cases/:id/status`, `/api/beneficiaries/:id/family-graph`
- Versioned for sync: `/api/sync/v1`

## Where to Add New Code

**New Feature/Module (Server):**
- Module definition: `kapwa-server/src/{name}/{name}.module.ts`
- Controller: `kapwa-server/src/{name}/{name}.controller.ts`
- Service: `kapwa-server/src/{name}/{name}.service.ts`
- Entity: `kapwa-server/src/{name}/{name}.entity.ts`
- Zod DTOs: `kapwa-server/src/{name}/dto/{name}.zod.ts`
- Unit tests: `kapwa-server/src/{name}/{name}.service.spec.ts`
- Register in: `kapwa-server/src/app.module.ts` imports array
- Add to root: `kapwa-server/src/main.ts` Swagger tag (optional)

**New Page (Client):**
- Page component: `kapwa-client/src/pages/{Name}Page.tsx`
- Route registration: `kapwa-client/src/routes.tsx` (import page + add to router array)
- API functions: `kapwa-client/src/lib/api.ts` (add fetch wrapper)
- Navigation link: `kapwa-client/src/components/Layout.tsx` (add NAV_ITEMS entry)

**New Component (Client):**
- Implementation: `kapwa-client/src/components/{Name}.tsx`
- Dynamic form field: `kapwa-client/src/components/forms/{Name}.tsx`
- Component subsystem: `kapwa-client/src/components/{subsystem}/index.ts` barrel export

**New Client Service:**
- Implementation: `kapwa-client/src/lib/{name}.ts`
- Tests: `kapwa-client/tests/{name}.test.ts`

**New Database Migration (Server):**
- Migration file: `kapwa-server/src/database/migrations/{timestamp}-{Name}.ts`
- Or add DDL to: `kapwa-server/src/database/migrate.ts`
- Declaration in data-source: `kapwa-server/src/database/data-source.ts`

**New Entity (Server):**
- Entity file: `kapwa-server/src/{module}/{name}.entity.ts`
- Register in module: `TypeOrmModule.forFeature([EntityName])` in the module imports
- Register in data-source: `kapwa-server/src/database/data-source.ts` entities array (auto-scanned via glob)

**New Environment Variable:**
- Server: Document in `kapwa-server/src/main.ts` and `.env` (if exists)
- Client: Reference via `import.meta.env.VITE_*` in Vite config

## Special Directories

**`.planning/`:**
- Purpose: Project planning and analysis artifacts
- Contains: ROADMAP, phase plans, codebase analysis, specs
- Generated: Manual creation via GSD workflow
- Committed: Yes

**`kapwa-client/dist/`:**
- Purpose: Vite build output
- Source: Auto-generated by `npm run build`
- Committed: No (in .gitignore)

**`kapwa-server/dist/`:**
- Purpose: TypeScript compilation output
- Source: Auto-generated by `npm run build`
- Committed: No (in .gitignore)

**`kapwa-client/node_modules/`, `kapwa-server/node_modules/`:**
- Purpose: NPM package dependencies
- Source: `npm install`
- Committed: No (in .gitignore)

**`.playwright-mcp/`:**
- Purpose: Playwright MCP test artifacts
- Generated: By Playwright testing
- Committed: No

---

*Structure analysis: 2026-06-29 (updated for Phase 10-02: BottomNav, data-table subsystem)*
*Update when directory structure changes*
