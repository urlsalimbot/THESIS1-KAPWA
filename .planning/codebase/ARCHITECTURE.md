# Architecture

**Analysis Date:** 2026-06-19

## Pattern Overview

**Overall:** Full-stack Offline-First PWA with Modular NestJS Backend (Monorepo)

**Key Characteristics:**
- Two-package monorepo: `kapwa-client/` (React PWA) + `kapwa-server/` (NestJS API server)
- Modular NestJS architecture with 19 domain modules, each following Controller → Service → Entity pattern
- Offline-first by design: client uses localStorage with encrypted cache, custom delta sync protocol with Ed25519 signatures and version vectors
- Layered authorization pipeline: JWT authentication → RBAC role guard → ABAC consent-gated access control → optional ConsentGuard
- Finite State Machine for case lifecycle: `pending_assessment → in_review → approved → disbursed → closed`
- Event-driven real-time messaging via WebSocket (Socket.IO) for chat
- Zod validation at API boundary via custom NestJS pipe
- Custom snake_case naming strategy for TypeORM → PostgreSQL mapping

## Layers

### Client Layer (React PWA)

**Routing Layer:**
- Purpose: Define application routes, protect pages by role, wrap with shared layout
- Location: `kapwa-client/src/routes.tsx`
- Contains: Route definitions, `ProtectedRoute` wrapper, `Private` helper
- Depends on: Auth context for token validation, role checking
- Used by: Entry point `App.tsx`

**Page Layer:**
- Purpose: Screen-level components that compose UI for each route
- Location: `kapwa-client/src/pages/*.tsx`
- Contains: 18 page components (Dashboard, Intake, Cases, Beneficiaries, Interventions, Messages, etc.)
- Depends on: API client library, Auth context, shared components
- Used by: Router

**Shared Component Layer:**
- Purpose: Reusable UI components used across pages
- Location: `kapwa-client/src/components/`
- Contains: `Layout.tsx` (sidebar + header shell), `ProtectedRoute.tsx`, `ErrorBoundary.tsx`, `NotificationsDropdown.tsx`, `ChainViewer.tsx`, `forms/JsonSchemaForm.tsx`, `forms/SignaturePad.tsx`
- Depends on: Auth context, lucide-react icons, Tailwind CSS
- Used by: Page components

**Library/Service Layer:**
- Purpose: Business logic, API communication, state management, offline storage
- Location: `kapwa-client/src/lib/`
- Contains: `api.ts` (HTTP client), `auth-context.tsx` (auth state), `auth.ts`, `sync.ts` (delta sync), `offline-queue.ts` (sync queue), `encrypted-db.ts` (AES-256-GCM), `database.ts` (localStorage DB), `chat-socket.ts` (WebSocket), `constants.ts`
- Depends on: Fetch API, Web Crypto API, socket.io-client, localStorage
- Used by: Page components

### Server Layer (NestJS API)

**Controller Layer:**
- Purpose: Handle HTTP requests, apply guards, delegate to services
- Location: `kapwa-server/src/*/*.controller.ts`
- Contains: 19 controllers (Auth, Cases, Interventions, Beneficiaries, Programs, Dashboard, Sync, etc.)
- Depends on: Service layer, Guard layer, ZodPipe for validation
- Used by: NestJS router, consumer apps

**Guard Layer:**
- Purpose: Authentication and authorization enforcement
- Location: `kapwa-server/src/auth/guards/` and `kapwa-server/src/auth/jwt-auth.guard.ts`
- Contains: `JwtAuthGuard` (passport JWT), `RolesGuard` (RBAC), `AbacGuard` (ABAC + consent), `ConsentGuard` (standalone consent check)
- Pipeline order: `JwtAuthGuard → RolesGuard → AbacGuard`
- Used by: Controllers via `@UseGuards()`

**Service Layer:**
- Purpose: Business logic, FSM transitions, validation, orchestration
- Location: `kapwa-server/src/*/*.service.ts`
- Contains: 20+ services (Auth, Cases, Interventions, Beneficiaries, Programs, Sync, Dashboard, ABAC, etc.)
- Depends on: TypeORM repositories (entities), other services
- Used by: Controllers, other services

**Entity/Repository Layer:**
- Purpose: TypeORM entity definitions and database mapping
- Location: `kapwa-server/src/*/*.entity.ts`
- Contains: 20+ entities (User, Case, CaseHistory, Intervention, Beneficiary, Household, FamilyMember, Program, IRF, Notification, SyncQueue, VersionVector, ConsentLedger, etc.)
- Pattern: TypeORM decorators (Entity, Column, ManyToOne, OneToMany), snake_case naming strategy
- Used by: Services via `@InjectRepository`

**Database Layer:**
- Purpose: PostgreSQL schema, migrations, configuration
- Location: `kapwa-server/src/database/`
- Contains: `data-source.ts` (DataSource config), `migrate.ts` (schema bootstrap), `snake-naming.strategy.ts`, `seed.ts`, 4 migration files, `compliance-audit.ts`
- Configuration: PostgreSQL 16 with extensions `pgcrypto`, `pg_trgm`, `pgAudit`, Row-Level Security enabled on 5 tables

## Data Flow

### HTTP API Request Lifecycle

1. **Client makes request**: Page component calls a function from `kapwa-client/src/lib/api.ts` (e.g., `getCases()`) with JWT token from `localStorage`
2. **Request travels**: Fetch API → CORS preflight (if needed) → NestJS `/api` prefix
3. **Global filters**: `AllExceptionsFilter` catches any thrown exception, returns sanitized JSON response
4. **Rate limiter**: `ThrottlerGuard` (60 req/min) blocks abuse
5. **Authentication**: `JwtAuthGuard` validates Bearer token via Passport JWT strategy (`kapwa-server/src/auth/jwt.strategy.ts`)
6. **Authorization**: `RolesGuard` checks user role against `@Roles()` decorator; `AbacGuard` evaluates barangay scope + consent status + resource sensitivity
7. **Controller**: Route handler receives validated request params, calls appropriate service method
8. **Validation (body)**: `ZodPipe` validates request body against Zod schema before it reaches controller
9. **Service**: Executes business logic, queries/updates database via TypeORM repository
10. **Database**: PostgreSQL with RLS enforces row-level security policies
11. **Response**: JSON response flows back through the filter pipeline

### Offline Sync Flow

1. Client creates/updates data while offline → change is queued in `localStorage` via `offline-queue.ts`
2. `offline-queue.ts` stores `QueuedChange` with id, tableName, operation, payload, timestamp, version vector
3. When online, `sync.ts` batches pending changes (up to 50 per batch)
4. Each batch is signed with Ed25519 private key (stored in localStorage)
5. POST to `/api/sync/v1` with idempotency key, device ID, signature, version vectors
6. Server processes delta → resolves conflicts per rule (server wins for financial, append for notes, queue for unclear)
7. Client marks changes as synced/conflict/failed
8. Client then pulls server changes via `/api/sync/pull`

### Case FSM Flow

1. GIS Intake form creates case → `status = 'pending_assessment'` (`POST /api/cases`)
2. Social Worker assesses → `PATCH /api/cases/:id/status` → `in_review`
3. MSWDO Head reviews → `/approve` → `approved`
4. Disbursement → `/disburse` → `disbursed`
5. Post-disbursement interventions can now be logged (`POST /api/interventions`)
6. Case closed → `closed`

**State Management:**
- Server: PostgreSQL is single source of truth; stateful via database transactions
- Client: localStorage-based cache with version vectors for conflict detection
- Auth: JWT in localStorage, validated on each request
- Real-time: Socket.IO for chat messages (no persistent state)

## Key Abstractions

**NestJS Module:**
- Purpose: Domain-scoped encapsulation of controller, service, entities, and exports
- Examples: `AuthModule`, `CasesModule`, `SyncModule`, `InterventionsModule`, `BeneficiariesModule`
- Pattern: `@Module({ imports, controllers, providers, exports })` — 19 modules registered in `AppModule`
- File: `kapwa-server/src/*/*.module.ts`

**Controller:**
- Purpose: HTTP route handler with guard protection and Zod validation
- Examples: `AuthController`, `CasesController`, `SyncController`
- Pattern: `@Controller('prefix')` + constructor-injected service + `@UseGuards()` + `@Roles()` decorator
- File: `kapwa-server/src/*/*.controller.ts`

**Service:**
- Purpose: Business logic encapsulation for a domain
- Examples: `AuthService`, `CasesService`, `AbacService`
- Pattern: `@Injectable()` class with injected repositories, exported for cross-module use
- File: `kapwa-server/src/*/*.service.ts`

**NestJS Guard:**
- Purpose: Request-level authorization check in the NestJS pipeline
- Examples: `JwtAuthGuard`, `RolesGuard`, `AbacGuard`, `ConsentGuard`
- Pattern: `CanActivate` interface, `@Injectable()`, returns boolean/throws
- File: `kapwa-server/src/auth/guards/*.ts`, `kapwa-server/src/auth/jwt-auth.guard.ts`

**Zod Validation Pipe:**
- Purpose: Validates request body against a Zod schema before controller processes it
- Location: `kapwa-server/src/common/pipes/zod.pipe.ts`
- Pattern: Custom `PipeTransform` that runs `schema.safeParse()` and throws `BadRequestException` on failure
- Usage: Applied per-method via `@Body(new ZodPipe(Schema))` in controllers

**Global Exception Filter:**
- Purpose: Catch-all error handler that sanitizes responses (never exposes internals)
- Location: `kapwa-server/src/common/filters/http-exception.filter.ts`
- Pattern: `@Catch()` decorator, returns `{ statusCode, message, timestamp, path }` — user-facing message: "Service temporarily unavailable. Contact MSWDO."

**React Page Component:**
- Purpose: Screen-level UI for a route
- Examples: `DashboardPage`, `IntakePage`, `CasesPage`, `LoginPage`
- Pattern: Named export `export function PageName()` — loads data in `useEffect`, renders with Tailwind CSS classes, uses lucide-react icons
- File: `kapwa-client/src/pages/*.tsx`

**Client Library Module:**
- Purpose: Encapsulated client-side logic (API, auth, sync, storage)
- Examples: `api.ts`, `auth-context.tsx`, `sync.ts`, `offline-queue.ts`, `encrypted-db.ts`
- Pattern: Module-level functions with localStorage-backed persistence, exported for page components
- File: `kapwa-client/src/lib/*.ts` / `kapwa-client/src/lib/*.tsx`

**Entity:**
- Purpose: TypeORM model mapping to PostgreSQL table
- Examples: `User`, `Case`, `Intervention`, `Beneficiary`, `ConsentLedger`
- Pattern: `@Entity()` class with `@PrimaryGeneratedColumn()`, `@Column()`, `@ManyToOne()`, `@OneToMany()` decorators
- File: `kapwa-server/src/*/*.entity.ts`

## Entry Points

**Server Entry:**
- Location: `kapwa-server/src/main.ts`
- Triggers: `node dist/main.js` or `npm run start`
- Responsibilities: Create NestJS app instance, set global prefix `/api`, enable CORS (4 origins), configure Swagger at `/api/docs`, start listening on port 3000

**Server Module Registration:**
- Location: `kapwa-server/src/app.module.ts`
- Responsibilities: Register all 19 domain modules, configure TypeORM (async, PostgreSQL, SnakeNamingStrategy), register global providers (RolesGuard, ThrottlerGuard, AllExceptionsFilter), import ConfigModule and ThrottlerModule

**Client Entry:**
- Location: `kapwa-client/src/main.tsx`
- Triggers: Vite dev server or production build
- Responsibilities: Render `<App />` component with `<ErrorBoundary>` wrapper

**Client App Component:**
- Location: `kapwa-client/src/App.tsx`
- Responsibilities: Render `<AuthProvider>` context with `<RouterProvider>` for `createBrowserRouter`, pass `ErrorBoundary` wrapper

**Client Routes:**
- Location: `kapwa-client/src/routes.tsx`
- Responsibilities: Define all application routes (18 pages), wrap protected routes in `Private` helper (ProtectedRoute + Layout), provide `Navigate` fallback for root path

## Error Handling

**Strategy:** Global exception filter catches all errors, sanitizes response, logs internally

**Patterns:**
- `AllExceptionsFilter` (`kapwa-server/src/common/filters/http-exception.filter.ts`) catches `HttpException`, `ThrottlerException`, `WsException`, and generic `Error` — never exposes stack traces or internal IDs
- Controllers throw NestJS `HttpException` subclasses (UnauthorizedException, BadRequestException, ForbiddenException)
- Zod validation pipe throws `BadRequestException` with formatted errors on schema mismatch
- Client-side: `api.ts` throws generic `"API error: {status}"`; page components catch and show fallback UI

## Cross-Cutting Concerns

**Logging:**
- NestJS `Logger` in `AllExceptionsFilter` for error logging
- Console.log in `main.ts` bootstrap
- Client: console.error for debug errors, no structured logging

**Validation:**
- Zod schemas at every controller API boundary via `ZodPipe` (`kapwa-server/src/common/pipes/zod.pipe.ts`)
- Schemas stored per-module in `dto/*.zod.ts` files (e.g., `auth/dto/auth.zod.ts`, `cases/dto/cases.zod.ts`)
- Dynamic JSON Schema form validation on client via `JsonSchemaForm.tsx`

**Authentication:**
- JWT strategy via `@nestjs/jwt` + `@nestjs/passport` (`JwtStrategy` in `kapwa-server/src/auth/jwt.strategy.ts`)
- JWT stored in `localStorage` as `kapwa_token`
- Multi-factor authentication (TOTP) available via `totp.ts`, MFA endpoints in auth controller
- `JwtAuthGuard` at controller level via `@UseGuards()`

**Authorization:**
- Three-layer guard pipeline: `RolesGuard` (role check) → `AbacGuard` (barangay scoping + consent + resource sensitivity) → optional `ConsentGuard` (explicit consent verification)
- Role-based: `@Roles('admin', 'social_worker')` decorator on each route
- ABAC: `AbacService` evaluates `(role, resourceSensitivity, consentStatus, legalBasis, barangay)` with 4 sensitivity levels: `public`, `internal`, `sensitive`, `restricted`
- Consent: `consent_ledger` table with `active/revoked` status; ABAC guard checks before returning beneficiary data
- RLS: PostgreSQL Row-Level Security policies on 5 tables (`beneficiaries`, `cases`, `interventions`, `consent_ledger`, `irf_cases`)

**Offline/Storage:**
- Offline-first: All writes queue to `localStorage`, sync on reconnect
- Encrypted storage: `encrypted-db.ts` provides AES-256-GCM encryption via Web Crypto API (PBKDF2 key derivation, 600K iterations)
- Sync protocol: Ed25519-signed delta payloads with version vectors, idempotency keys, batch size 50
- Conflict resolution: Server-wins for financial/amount/status, chronological-append for case notes, queue for ambiguous

---

*Architecture analysis: 2026-06-19*
*Update when major patterns change*
