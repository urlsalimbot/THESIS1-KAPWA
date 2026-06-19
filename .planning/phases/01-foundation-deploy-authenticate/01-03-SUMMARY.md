---
phase: 01-foundation-deploy-authenticate
plan: 03
subsystem: sync, storage, ui
tags: sqlcipher, aes-256-gcm, capacitor, secure-storage, offline-queue, localStorage, vitest

requires:
  - phase: 01-01
    provides: Full stack infrastructure (Docker, MinIO, Caddy)
  - phase: 01-02
    provides: Admin user management API + UI

provides:
  - Platform-aware encrypted storage (SQLCipher native, AES-256-GCM browser)
  - SecureStorage abstraction with init/getItem/setItem/removeItem
  - Correct offline queue pending count in Layout header
  - Test coverage for secure storage and offline queue

affects:
  - Phase 02 GIS Intake (will use SecureStorage for offline data)
  - Phase 01-04 Audit (continues with fixed queue infrastructure)

tech-stack:
  added:
    - "@capacitor-community/sqlite@6.0.2" — SQLCipher encrypted SQLite for Capacitor mobile
  patterns:
    - Platform-aware storage abstraction (Capacitor native vs browser)
    - Key derivation from user password for cross-platform recovery

key-files:
  created:
    - kapwa-client/src/lib/secure-storage.ts: Platform-aware SecureStorage (init, getItem, setItem, removeItem)
    - kapwa-client/tests/secure-storage.test.ts: Browser fallback tests with mock encrypted-db
    - kapwa-client/tests/offline-queue.test.ts: Load queue and pending count tests
  modified:
    - kapwa-client/src/lib/offline-queue.ts: Export loadQueue (was private function)
    - kapwa-client/src/components/Layout.tsx: Fix pending count from kapwa_sync_queue with storage listener
    - kapwa-client/tests/setup.ts: Comprehensive localStorage and crypto mocks for Node 26
    - kapwa-client/vitest.config.ts: fix jsdom URL for localStorage
    - kapwa-client/package.json: add @capacitor-community/sqlite dependency
    - kapwa-client/package-lock.json: dep lock update

key-decisions:
  - "Use mockImplementation over mockResolvedValue for vitest 1.6.1 compat (mockResolvedValue(null) returned undefined)"
  - "Install @capacitor-community/sqlite@6.0.2 (Capacitor 6 compatible) instead of latest 8.x"
  - "Mock encrypted-db as in-memory store in tests (jsdom lacks crypto.subtle for real AES-GCM)"

patterns-established:
  - "Platform-aware abstraction: Same interface across Capacitor native (SQLCipher) and browser (AES-256-GCM)"
  - "Offline queue state: Layout reads from loadQueue() not raw localStorage"

requirements-completed:
  - SYNC-01
  - SYNC-05

duration: 7min
completed: 2026-06-19
status: complete
---

# Phase 01 Plan 03: Sync Client Foundation Summary

**SQLCipher integration with Capacitor, platform-aware SecureStorage abstraction (native SQLCipher + browser AES-256-GCM fallback), and Layout offline queue indicator fix**

## Performance

- **Duration:** 7 min
- **Started:** 2026-06-19T04:01:45Z
- **Completed:** 2026-06-19T04:09:23Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Created `SecureStorage` abstraction with `init`, `getItem`, `setItem`, `removeItem` — auto-detects Capacitor native vs browser platform
- Native path uses `@capacitor-community/sqlite` for SQLCipher AES-256 encrypted SQLite with key derivation from user password (cross-platform recovery)
- Browser path delegates to existing `encrypted-db.ts` (AES-256-GCM over localStorage)
- Installed `@capacitor-community/sqlite@6.0.2` compatible with Capacitor 6
- Fixed Layout.tsx offline queue indicator: reads from `kapwa_sync_queue` via `loadQueue()` with `status === 'pending'` filtering
- Added cross-tab StorageEvent listener for real-time pending count updates
- Fixed vitest test infrastructure for Node.js 26 (localStorage mock, crypto mocks)
- 5 tests passing (2 offline-queue, 3 secure-storage), zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Tests for secure storage + offline queue** — `89ac19a` (test)
2. **Task 2: SQLCipher integration + platform-aware storage** — `31786fe` (feat)
3. **Task 3: Fix Layout offline queue indicator** — `c4b3685` (fix)

**Plan metadata:** (committed after SUMMARY)

## Files Created/Modified

- `kapwa-client/src/lib/secure-storage.ts` — Platform-aware encrypted storage abstraction (NEW)
- `kapwa-client/tests/secure-storage.test.ts` — Browser fallback round-trip, null, platform tests (NEW)
- `kapwa-client/tests/offline-queue.test.ts` — Empty queue, loaded queue with pending status tests (NEW)
- `kapwa-client/src/lib/offline-queue.ts` — Export `loadQueue` for Layout and tests
- `kapwa-client/src/components/Layout.tsx` — Correct pending count from `kapwa_sync_queue` with `loadQueue()`, storage event listener
- `kapwa-client/tests/setup.ts` — localStorage mock, crypto mock for Node 26 + jsdom compat
- `kapwa-client/vitest.config.ts` — jsdom URL config for localStorage access
- `kapwa-client/package.json` — Added `@capacitor-community/sqlite@6.0.2`
- `kapwa-client/package-lock.json` — Lock file update

## Decisions Made

- **@capacitor-community/sqlite@6.0.2** — Installed Capacitor 6 compatible version (latest 8.x requires Capacitor 8+). When upgrading Capacitor, update this plugin to match.
- **Mock encrypted-db in tests** — jsdom lacks `crypto.subtle` for real AES-256-GCM. Used in-memory mock store instead, which tests the SecureStorage abstraction layer correctly.
- **Use `mockImplementation` over `mockResolvedValue`** — vitest 1.6.1 has a bug where `mockResolvedValue(null)` returns `undefined`. Using `mockImplementation(() => Promise.resolve(null))` works correctly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Exported loadQueue from offline-queue.ts**
- **Found during:** Task 1 (test creation)
- **Issue:** Plan tests import `loadQueue` from `offline-queue.ts`, but it was a private function (not exported)
- **Fix:** Added `export` keyword to `loadQueue` function definition
- **Files modified:** `kapwa-client/src/lib/offline-queue.ts`
- **Verification:** Offline queue tests pass
- **Committed in:** `89ac19a` (Task 1)

**2. [Rule 3 - Blocking] localStorage undefined in jsdom test environment**
- **Found during:** Task 1 (test creation)
- **Issue:** Node.js 26 + jsdom results in opaque origin → `localStorage` throws `SecurityError`. Both `localStorage` and `window.localStorage` are unavailable.
- **Fix:** Added comprehensive localStorage mock in `tests/setup.ts` using `Object.defineProperty(globalThis, 'localStorage', ...)`. Also updated `vitest.config.ts` with jsdom URL config.
- **Files modified:** `kapwa-client/tests/setup.ts`, `kapwa-client/vitest.config.ts`
- **Verification:** All 5 tests pass in jsdom environment
- **Committed in:** `89ac19a` (Task 1)

**3. [Rule 2 - Missing Critical] mockResolvedValue(null) returns undefined in vitest 1.6.1**
- **Found during:** Task 2 (implementation tests)
- **Issue:** `vi.fn().mockResolvedValue(null)` in mock factory returns `undefined` instead of `null` in vitest 1.6.1
- **Fix:** Used `mockImplementation(() => Promise.resolve(null))` instead
- **Files modified:** `kapwa-client/tests/secure-storage.test.ts`
- **Verification:** "returns null for missing key" test passes
- **Committed in:** `31786fe` (Task 2)

**4. [Rule 2 - Missing Critical] @capacitor-community/sqlite version conflict**
- **Found during:** Task 2 (SQLCipher installation)
- **Issue:** Latest `@capacitor-community/sqlite@8.1.0` requires `@capacitor/core >= 8.0.0`, but project uses `@capacitor/core@^6.2.1`
- **Fix:** Installed `@capacitor-community/sqlite@6.0.2` — last version compatible with Capacitor 6
- **Files modified:** `kapwa-client/package.json`, `kapwa-client/package-lock.json`
- **Verification:** `npm install` succeeds, build passes
- **Committed in:** `31786fe` (Task 2)

---

**Total deviations:** 4 auto-fixed (2 Rule 3 blocking, 2 Rule 2 missing critical)
**Impact on plan:** All auto-fixes essential for correctness and test environment compatibility. No scope creep.

## Issues Encountered

- **Node.js 26 + jsdom compatibility:** localStorage requires non-opaque origin in jsdom. Fixed via global mock in setup.ts.
- **vitest 1.6.1 mock value resolution:** `mockResolvedValue(null)` resolves to `undefined` in some cases. Used `mockImplementation` as workaround.

## Authentication Gates

None — no external service auth required for this plan.

## Known Stubs

None. All created files are fully functional with proper tests.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Next Phase Readiness

- Sync client foundation complete — encrypted local storage with platform awareness
- Offline queue indicator shows correct pending count in Layout header
- Ready for 01-04 (Audit Integrity & Idempotency)
- Tests form a solid baseline for future client-side testing

## Self-Check: PASSED

All created files exist on disk. All 3 task commits verified. All 5 tests pass. Build succeeds.
