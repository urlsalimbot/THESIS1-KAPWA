# KAPWA Code Audit — Bug Report

**93/93 tests passing**, TS clean (server + client). **49 of 50 bugs fixed** (all CRITICAL + HIGH + MEDIUM + all but 1 LOW).

---

## 🔴 CRITICAL (will crash / break at runtime)

| # | File | Bug | Severity | Status |
|---|------|-----|----------|--------|
| 1 | `kapwa-client/src/lib/auth-context.tsx:52` | Login writes `'token'` (line 52) but 17 consumers across 7 files read `'kapwa_token'`. After login, sync/notifications/messages/tracker/admin/intake/claimant dashboard all get `null` → 401 | CRITICAL | ✅ FIXED |
| 2 | `kapwa-server/src/irf/irf.module.ts` | Module is a stub: string token `'IrfService'` but controller injects class token. Provides `{}`. Missing `TypeOrmModule.forFeature([IrfCase])`. **Crashes at startup** | CRITICAL | ✅ FIXED |
| 3 | `kapwa-server/src/database/migrate.ts:33` | `programs` table has `category TEXT` declared twice. **Migration always fails** with `column "category" specified more than once` | CRITICAL | ✅ FIXED |
| 4 | `kapwa-server/src/database/migrate.ts:37` | `version_vectors` migration has `entity_type`, `version` but entity expects `table_name`, `local_version`, `server_version`. **Sync crashes at runtime** | CRITICAL | ✅ FIXED |
| 5 | `kapwa-server/src/programs/programs.controller.ts:5` | No `@UseGuards(JwtAuthGuard)` — all endpoints are **completely public**. Anyone can create programs | CRITICAL | ✅ FIXED |
| 6 | `kapwa-server/src/programs/programs.service.ts` | In-memory `Map` (data lost on restart) + `crypto.randomUUID()` without importing `crypto` (**ReferenceError at runtime**) | CRITICAL | ✅ FIXED |

## 🔴 HIGH (security / data integrity)

| # | File | Bug | Severity | Status |
|---|------|-----|----------|--------|
| 7 | `kapwa-server/src/sync/sync.service.ts:366-368` | Ed25519 signature bypass: if `deviceId` ≠ 32 hex bytes, **any non-empty sig passes** | HIGH | ✅ FIXED |
| 8 | `kapwa-server/src/sync/sync.service.ts:229-230` | SQL injection: column names interpolated from client payload without sanitization | HIGH | ✅ FIXED |
| 9 | `kapwa-server/src/auth/auth.service.ts:24` | Self-registration allows any role. Attacker sends `role: "admin"` | HIGH | ✅ FIXED |
| 10 | `kapwa-server/src/auth/auth.controller.ts:28` | `GET /me` returns full user entity including **bcrypt password hash** | HIGH | ✅ FIXED |
| 11 | `kapwa-server/src/auth/jwt.strategy.ts:17` + `auth.module.ts:16` | Hardcoded JWT secret fallback `'kapwa-secret-key'` — trivially guessable | HIGH | ✅ FIXED |
| 12 | `kapwa-server/src/auth/guards/roles.guard.ts:17` | `if (!user) return true` — no JWT guard → passes. Global APP_GUARD is a no-op | HIGH | ✅ FIXED |
| 13 | `kapwa-server/src/auth/guards/abac.guard.ts:18` | `mayor`/`auditor` bypass all sensitivity checks including restricted resources | HIGH | ✅ FIXED |
| 14 | `kapwa-client/src/components/Layout.tsx:70` | `<a href>` causes **full page reload** on every nav, destroys all React state | HIGH | ✅ FIXED |

## 🟡 MEDIUM (broken features / incorrect behavior)

| # | File | Bug | Severity | Status |
|---|------|-----|----------|--------|
| 15 | `kapwa-server/src/cases/cases.service.ts:73` | No REJECTED/CANCELLED path — case stuck in PENDING forever | MEDIUM | ✅ FIXED |
| 16 | `kapwa-server/src/interventions/dto/interventions.zod.ts:7` | `z.number().positive().default(0)` — 0 violates `.positive()` | MEDIUM | ✅ FIXED |
| 17 | `kapwa-server/src/sync/sync.service.ts:16` | In-memory idempotency cache unbounded (memory leak) | MEDIUM | ✅ FIXED |
| 18 | `kapwa-server/src/sync/sync.controller.ts:15` | Role `'worker'` doesn't exist in `UserRole` enum (should be `'social_worker'`) | MEDIUM | ✅ FIXED |
| 19 | `kapwa-server/src/beneficiaries/beneficiaries.service.ts:55` | Barangay search uses exact match (`address: barangay`) but addresses are full text | MEDIUM | ✅ FIXED |
| 20 | `kapwa-server/src/csr/csr.service.ts:16-17` | Control number race condition — concurrent requests get same count → UNIQUE violation | MEDIUM | ✅ FIXED |
| 21 | `kapwa-server/src/csr/csr.controller.ts:46` | `POST` used for PDF download — should be `GET` | MEDIUM | ✅ FIXED |
| 22 | `kapwa-server/src/audit/audit.service.ts:9-24` | All methods are stubs returning empty/fake data | MEDIUM | ✅ FIXED |
| 23 | `kapwa-client/src/lib/api.ts:1` | `API` hardcoded to `'http://localhost:3000/api'` — ignores `VITE_API_URL` env var | MEDIUM | ✅ FIXED |
| 24 | `kapwa-client/src/pages/BeneficiaryViewPage.tsx` | Uses hardcoded mock "Maria Santos" — never reads `useParams()` or real API | MEDIUM | ✅ FIXED |
| 25 | `kapwa-client/src/pages/CasesPage.tsx:48` | Filter pills toggle state but state **never applied** to dataset | MEDIUM | ✅ FIXED |
| 26 | `kapwa-client/src/components/Layout.tsx:18,20,24` | Sidebar links to `/filing`, `/irf`, `/audit`, `/settings` — none exist → redirect to `/` | MEDIUM | ✅ FIXED |
| 27 | `kapwa-client/src/pages/AdminPage.tsx:42` | Calls `/sync/conflicts/all` which doesn't exist (always 404) | MEDIUM | ✅ FIXED |
| 28 | `kapwa-client/src/lib/chat-socket.ts:41` | Client sends `senderName` — user can spoof identity | MEDIUM | ✅ FIXED |
| 29 | `kapwa-client/src/pages/MessagesPage.tsx:95` | JWT payload uses `atob()` (fails on base64url `-`/`_`). No try/catch — crashes | MEDIUM | ✅ FIXED |

## ⚠️ LOW (quality / code smell)

| # | File | Bug | Severity | Status |
|---|------|-----|----------|--------|
| 30 | `kapwa-server/src/app.module.ts:32` | `SnakeNamingStrategy` defined but never wired to TypeORM | LOW | ✅ FIXED |
| 31 | `kapwa-server/src/main.ts:11-14` | Global `ValidationPipe` dead code (codebase uses Zod) | LOW | ✅ FIXED |
| 32 | `kapwa-server/src/chat/chat.gateway.ts:39` | `userId` can be `undefined` if JWT lacks `sub`/`id` | LOW | ✅ FIXED |
| 33 | `kapwa-server/src/chat/chat.gateway.ts:63-82` | No rate limiting on WebSocket messages | LOW | ✅ FIXED |
| 34 | `kapwa-server/src/cases/cases.controller.ts:40` | `@Get('disbursed/pending-intervention')` after `@Get(':id')` — fragile ordering | LOW | ✅ FIXED |
| 35 | `kapwa-server/src/database/seed.ts:18` | `TRUNCATE` missing `sync_queue`, `chat_messages`, `csr_reports` etc. | LOW | ✅ FIXED |
| 36 | `kapwa-server/src/database/migrate.ts:31` | `access_card_services` table has no entity — orphaned | LOW | ❌ |
| 37 | `kapwa-client/src/pages/LoginPage.tsx:20` | Every failed login shows "Try admin@mswdo.test / admin123" — leaks credentials | LOW | ✅ FIXED |
| 38 | `kapwa-client/src/pages/IntakePage.tsx:184` | `resetForm` clears state but `<SignaturePad>` canvas still shows old drawing | LOW | ✅ FIXED |
| 39 | `kapwa-client/src/pages/DashboardPage.tsx:112` | "View All Cases" button has no `onClick` | LOW | ✅ FIXED |
| 40 | `kapwa-client/src/pages/BeneficiariesPage.tsx:61` | Only 5 of 10 barangays in dropdown | LOW | ✅ FIXED |
| 41 | `kapwa-client/src/pages/InterventionsPage.tsx:39` | Hardcoded signature URL `'sig-placeholder.png'` | LOW | ✅ FIXED |
| 42 | `kapwa-client/src/pages/CaseTrackerPage.tsx:99` | `computeAgeRange()` defined but never called | LOW | ✅ FIXED |
| 43 | `kapwa-client/src/lib/sync.ts:17` | `payload` variable computed but never used | LOW | ✅ FIXED |
| 44 | `kapwa-client/src/lib/database.ts:42` | `execute()` is a silent no-op returning `[]` | LOW | ✅ FIXED |
| 45 | `kapwa-client/src/lib/sync.ts:109-111` | Caches to `kapwa_cache_*` keys but never reads — localStorage bloat | LOW | ✅ FIXED |
| 46 | `kapwa-client/src/App.tsx:3-8` | `AppProvider` and `useConfig` exported but never imported | LOW | ✅ FIXED |
| 47 | `kapwa-client/src/lib/auth.ts` | Functions `async` but only do sync `localStorage` | LOW | ✅ FIXED |
| 48 | `kapwa-client/src/components/forms/SignaturePad.tsx:14-15` | `hasContent` and `isEmpty` track same condition (always inverses) | LOW | ✅ FIXED |
| 49 | `kapwa-client/src/pages/MessagesPage.tsx:33-36` | No dedup on socket reconnection — duplicate messages | LOW | ✅ FIXED |
| 50 | `kapwa-client/src/pages/CsrPage.tsx:117` | Search input has no state binding — cosmetic only | LOW | ✅ FIXED |

---

## Summary

| Severity | Count | Fixed | Remaining |
|----------|-------|-------|-----------|
| 🔴 CRITICAL | 6 | 6 | 0 |
| 🔴 HIGH | 8 | 8 | 0 |
| 🟡 MEDIUM | 15 | 15 | 0 |
| ⚠️ LOW | 21 | 20 | 1 |
| **Total** | **50** | **49** | **1** |

**Tests: 93/93 passing | Server TS: clean | Client TS: clean**
