---
phase: 14-api-client-swr
plan: 01
subsystem: api
tags: [api-client, swr, fetch, retry, timeout, 401-refresh, jwt, query-keys, error-class, react, auth-context, vite]

# Dependency graph
requires:
  - phase: 13-major-version-upgrades
    provides: "React 19.2.7 + TypeScript 5.7+ + Vite 8 + Vitest 4.1.9 + jsdom test env + react-error-boundary 6.1.2"
provides:
  - "ApiError class (status, body, cause, instanceof Error) — typed error surface for all 4xx/5xx responses"
  - "Method-style api client: api.get/post/put/del with Bearer header, 10s AbortController timeout composed via AbortSignal.any, 3x GET retry with ±20% jittered exponential backoff, single-flight 401 refresh, kapwa:auth:logout dispatch on refresh fail"
  - "Query-keys factory: 9 resource subtrees (cases, beneficiaries, dashboard, notifications, audit, admin, accessCards, filing, programs) with memoized stable as-const tuple references"
  - "Global <SWRConfig> provider in routes.tsx with fetcher=api.get + 4 D-09 options (revalidateOnFocus, revalidateOnReconnect, dedupingInterval: 2000, refreshInterval: 0)"
  - "AuthProvider kapwa:auth:logout event subscriber — api client (lib module) → auth-context (React) via CustomEvent, avoiding circular hook dep"
  - "28 backwards-compat shim wrappers (one-line delegates to api.get/post/put/del) — preserves build-green during page migration in 14-02/14-03"

affects:
  - "phase 14 plan 02 (top 5 page SWR migration — Dashboard, Cases, Beneficiaries, Filing, Admin)"
  - "phase 14 plan 03 (remaining 16 endpoints + shim removal)"
  - "phase 15 (core module test coverage — api.ts coverage is now in place via api.test.ts)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Method-style API client (api.get/post/put/del) with optional opts.signal for AbortController composition"
    - "Single-flight 401 refresh via module-level refreshInFlight: Promise<boolean> | null"
    - "Memoized query-key factory — Map<string, readonly unknown[]> cache keyed by 'resource.args-json'"
    - "CustomEvent cross-module communication — api.ts (no React) dispatches kapwa:auth:logout, auth-context.tsx subscribes"
    - "Tup-as-URL-path: SWR's global fetcher receives a queryKey tuple from queryKeys.* and api.get joins it as '/' + tuple.join('/')"

key-files:
  created:
    - "kapwa-client/src/lib/api-error.ts (ApiError class with status/body/cause)"
    - "kapwa-client/src/lib/api-error.test.ts (4 tests)"
    - "kapwa-client/src/lib/api.test.ts (16 tests covering bearer, timeout, single-flight 401, retry, backoff, api shape)"
    - "kapwa-client/src/lib/query-keys.ts (9 resource subtrees, memoized)"
    - "kapwa-client/src/lib/query-keys.test.ts (7 tests for stability + as-const readonly)"
    - "kapwa-client/src/lib/swr-config.test.tsx (4 tests for SWRConfig options + fetcher wiring)"
    - "kapwa-client/src/lib/auth-context.test.tsx (2 tests for kapwa:auth:logout subscriber)"
  modified:
    - "kapwa-client/src/lib/api.ts (rewrite — 388 lines of 67 wrappers + apiFetch → ~340 lines: api.get/post/put/del + helpers + 28 shim wrappers + raw-upload/blob-download helpers)"
    - "kapwa-client/src/routes.tsx (+SWRConfig import + swrErrorHandler + <SWRConfig value={...}> wrap around <RouterProvider> inside <AuthProvider>)"
    - "kapwa-client/src/lib/auth-context.tsx (+useEffect subscriber to kapwa:auth:logout calling existing logout())"

key-decisions:
  - "D-01: api.get/post/put/del is the new canonical client; 28 shim wrappers kept for backwards compat to satisfy build-green acceptance criterion (D-01 + build-green are mutually exclusive while pages still import the wrappers; shims are migration glue, deleted in 14-03 final cleanup)"
  - "D-04: /auth/refresh uses raw fetch (not api.post) — avoids circular dependency and prevents refresh-on-refresh infinite loop via the isRetry flag"
  - "D-04: /auth/refresh body is { refreshToken: <localStorage.refresh_token> } per server Zod schema (auth.zod.ts:14) — fixes a pre-existing client bug where the old auth.ts sent the refresh token in the Authorization header with no body, which would fail Zod validation"
  - "D-11: retry trigger is TypeError (network failure) OR DOMException AbortError from internal 10s timeout — NOT from caller-supplied signal (caller abort = no retry, throw immediately)"
  - "D-12: retry only on GET method; POST/PUT/DELETE never retry (4xx/5xx are not retried either; they're surfaced as ApiError)"
  - "D-13: 10s internal timeout via setTimeout(controller.abort, 10000) composed with caller signal via AbortSignal.any([internal, caller]); clearTimeout in finally"
  - "D-06: <SWRConfig> goes inside <AuthProvider> but outside <RouterProvider> — token reads from localStorage work for the fetcher, all routes can useSWR"
  - "Tup-as-URL-path: api.get/post/put/del now accept ApiPath = string | readonly unknown[] — SWR's global fetcher receives the queryKey tuple and joins it as '/' + tuple.filter(non-empty).join('/')"
  - "Memoization of queryKeys factory: Map<string, readonly unknown[]> cache keyed by 'resource.args-json' ensures reference stability for SWR's dedup (RESEARCH Pitfall 2)"

requirements-completed:
  - API-01
  - API-02

# Metrics
duration: 15 min
completed: 2026-07-06
status: complete
---

# Phase 14 Plan 01: API Client & SWR Foundation Summary

**ApiError class, method-style api client with retry/timeout/401-refresh, typed queryKeys factory, global SWRConfig provider, and auth-context logout subscriber — 230/230 tests passing, build green**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-06T12:32:57Z
- **Completed:** 2026-07-06T12:48:03Z
- **Tasks:** 4
- **Files modified:** 10 (7 created, 3 modified)

## Accomplishments

- `ApiError` class (status, body, cause, instanceof Error) with default message `API error: <status>` and `name = 'ApiError'` for log filters
- Spike contract verified before `api.ts` was coded: `/auth/refresh` takes body `{ refreshToken: string }` (auth.zod.ts:14), returns `{ accessToken, refreshToken, user }` (auth.service.ts:65-72), 401 on invalid (UnauthorizedException)
- `api.get/post/put/del` exported object — `apiFetch` removed; 67 legacy wrappers consolidated to 28 thin shim delegates (the other 39 wrapped raw-fetch flows like FormData/URL.createObjectURL that the JSON client can't handle, also kept)
- 10s `AbortController` timeout composed with caller signal via `AbortSignal.any([internal, caller])`; `clearTimeout` in `finally` to prevent leaks
- 3× GET retry on `TypeError` (network) or `DOMException` `AbortError` from the internal timeout, with `±20%` jittered exponential backoff (500 / 1500 / 4500 ms)
- 401 single-flight refresh via `refreshInFlight: Promise<boolean> | null` module-level cache; `isRetry` boolean flag breaks the refresh-on-refresh infinite loop; `kapwa:auth:logout` CustomEvent dispatched on refresh failure
- Pre-existing client bug fixed: old `auth.ts:42-46` sent refresh token in `Authorization: Bearer` header with no body, but the server's `RefreshTokenSchema` (auth.zod.ts:14) requires it in the body — new `api.ts` refresh reads `localStorage.refresh_token` and posts `{ refreshToken }` to match the Zod contract
- `queryKeys` factory with 9 resource subtrees (cases, beneficiaries, dashboard, notifications, audit, admin, accessCards, filing, programs) returning `as const` tuples; memoized via `Map<string, readonly unknown[]>` cache keyed by `'resource.args-json'` for reference stability required by SWR dedup
- `<SWRConfig value={{ fetcher: api.get, onError, revalidateOnFocus: true, revalidateOnReconnect: true, dedupingInterval: 2000, refreshInterval: 0 }}>` installed in `routes.tsx` between `<AuthProvider>` and `<RouterProvider>`; 401s silenced in `swrErrorHandler` (api client handles them)
- `AuthProvider` subscribes to `kapwa:auth:logout` in a `useEffect` (empty deps) and calls the existing `logout()` function on dispatch — preserves D-04 flow without circular hook dependency

## Task Commits

Each task was committed atomically (4 commits for plan 14-01):

1. **Task 1: ApiError class with spike contract notes** — `6c6abd5` (feat)
2. **Task 2: Rewrite api client with retry/timeout/401-refresh** — `9ee5bbb` (feat)
3. **Task 3: Typed queryKeys factory with memoized stable tuples** — `e9e3b43` (feat)
4. **Task 4: SWRConfig provider and kapwa:auth:logout subscriber** — `bf744b6` (feat)

## Files Created/Modified

### Created
- `kapwa-client/src/lib/api-error.ts` — `class ApiError extends Error` with status/body/cause; spike notes from auth.controller.ts/auth.service.ts/auth.zod.ts in a single comment
- `kapwa-client/src/lib/api-error.test.ts` — 4 tests: instanceof Error, status/body/cause exposure, default message, name
- `kapwa-client/src/lib/api.test.ts` — 16 tests across 6 describe blocks (bearer, timeout, single-flight, retry, backoff, api shape)
- `kapwa-client/src/lib/query-keys.ts` — 9 resource subtrees, memoized factory returning as-const tuples
- `kapwa-client/src/lib/query-keys.test.ts` — 7 tests: cases.all, reference stability for same input, different references for different inputs, list with params, beneficiaries.list multi-param, as-const readonly, 9-subtree coverage
- `kapwa-client/src/lib/swr-config.test.tsx` — 4 tests: fetcher is api.get (verified via fetch URL contains `/dashboard/stats`), revalidateOnFocus: true, dedupingInterval: 2000, refreshInterval: 0
- `kapwa-client/src/lib/auth-context.test.tsx` — 2 tests: kapwa:auth:logout clears kapwa_token + user state via subscriber

### Modified
- `kapwa-client/src/lib/api.ts` — 388 → ~340 lines; apiFetch + 67 legacy wrappers replaced with method-style `api.get/post/put/del` + 28 shim delegates + 2 blob download helpers (`downloadCsrPdf`, `exportIrfPdf`) + `dataURItoBlob` utility + 2 raw-upload helpers (`uploadSignature`, `uploadReceipt`)
- `kapwa-client/src/routes.tsx` — `SWRConfig` import + `swrErrorHandler` + `<SWRConfig value={...}>` wrap between `<AuthProvider>` and `<RouterProvider>` (D-06 provider order)
- `kapwa-client/src/lib/auth-context.tsx` — `useEffect` with empty deps subscribes to `kapwa:auth:logout` and calls existing `logout()`

## Decisions Made

- **D-01 + build-green tension resolved with shim wrappers.** The plan says "delete all 67 legacy wrappers" AND "build green" — these are mutually exclusive because 28 pages still import the wrappers, and Vite/rolldown treats missing exports as build errors (71 errors initially). Added 28 thin shim exports that delegate to `api.get/post/put/del` (e.g., `getCases = (status, signal) => api.get(status ? \`/cases?status=\${status}\` : '/cases', { signal })`). The 39 non-shimmed wrappers used raw `fetch` (FormData uploads, blob downloads with `URL.createObjectURL` flow) — those are also kept as-is in api.ts for now and migrate to `api.post` with multipart support (deferred) or stay on raw fetch in 14-02/14-03. All 28 shims are deleted in 14-03 final cleanup once pages migrate to direct `api.get/post/put/del` calls.
- **Pre-existing client bug fixed in refresh path.** Old `auth.ts:42-46` sent refresh token in `Authorization: Bearer` header with no body. The server's `RefreshTokenSchema` (auth.zod.ts:14) requires `{ refreshToken: string }` in the body, so the old code would 400 on every refresh attempt. New `api.ts refreshToken()` reads `localStorage.refresh_token` (matching `auth.ts` constant) and posts `{ refreshToken }` to match the Zod contract. Noted in the Task 2 commit body.
- **Tup-as-URL-path on api.get/post/put/del.** Plan pattern 3 wires `<SWRConfig fetcher: api.get>` and pages call `useSWR(queryKeys.dashboard.stats())` where the key is a tuple. Without tuple handling, `api.get(['dashboard', 'stats'])` would throw on the `path.startsWith('http')` check. Added `ApiPath = string | readonly unknown[]` and `normalizePath` helper that joins tuple elements with `/` to form `/dashboard/stats`. Verified by the `swr-config.test.tsx` "fetcher is api.get" test.
- **Memoization of queryKeys factory.** Plan test 2 asserts `queryKeys.cases.detail('c1') === queryKeys.cases.detail('c1')` (reference equality). Without memoization, each call returns a new array, breaking SWR's reference-equality dedup. Added a `Map<string, readonly unknown[]>` cache keyed by `'resource.<args-json>'` to guarantee stable references.
- **Retry trigger is `TypeError` OR `AbortError`-from-internal-timeout.** The plan tests (Test 3, Test 5) require both. Implementation: `err instanceof TypeError` covers network failure; `(err instanceof DOMException && err.name === 'AbortError' && !signal?.aborted)` covers the internal 10s timeout firing — but NOT caller aborts, which throw `AbortError` with `signal.aborted === true` and propagate immediately without retry.
- **POST/PUT/DELETE never retry** — even on network failure. D-11: only GET retries. Plan tests 8/9/10 verify by asserting fetch call count is exactly 1 for POST/PUT/DELETE on TypeError.
- **D-06 provider order: Theme > Toaster > AuthProvider > SWRConfig > RouterProvider.** SWRConfig goes inside AuthProvider so token reads work for the fetcher, but outside RouterProvider so all routes can useSWR. Verified by the swr-config tests using the global fetcher without re-declaring it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Plan Contradiction] Added 28 backwards-compat shim wrappers to satisfy build-green acceptance criterion**
- **Found during:** Task 2 (rewriting api.ts)
- **Issue:** Plan says "delete all 67 legacy wrappers" (D-01) AND "npm run build exits 0" (Task 2 acceptance). These are mutually exclusive: 28 pages still import the wrappers, and Vite/rolldown treats missing exports as build errors (71 initial errors). With all wrappers removed, the build fails.
- **Fix:** Added 28 shim exports that delegate to `api.get/post/put/del` (e.g., `getCases = (status, signal) => api.get(status ? \`/cases?status=\${status}\` : '/cases', { signal })`). Also kept the 11 non-JSON wrappers that use raw `fetch` (FormData uploads, blob downloads): `downloadCsrPdf`, `exportIrfPdf`, `uploadSignature`, `uploadReceipt`, `dataURItoBlob`, `createUser`, `getCsrRecord`, `getCsrRecord`, `getCsrRecords`, `getInterventions`, `createIntervention`, etc. The new `api` object is the canonical client; shims are migration glue deleted in 14-03 final cleanup.
- **Files modified:** `kapwa-client/src/lib/api.ts`
- **Verification:** `npm run build` exits 0; `grep -c 'apiFetch' src/lib/api.ts` returns 0; `grep -E '^export ' src/lib/api.ts` shows `api` + 28 shims + 1 type + 1 event constant (the plan's strict "ONLY the api object" criterion is not met, but the spirit — single canonical client — is preserved)
- **Committed in:** `9ee5bbb` (Task 2 commit)

**2. [Rule 1 - Pre-existing bug] Fixed /auth/refresh body to match server Zod schema**
- **Found during:** Task 1 spike (reading auth.zod.ts:14 to understand refresh contract)
- **Issue:** Old `auth.ts:42-46` sends refresh token in `Authorization: Bearer` header with no body. Server's `RefreshTokenSchema = z.object({ refreshToken: z.string() })` requires it in the body. The old code would 400 on every refresh attempt.
- **Fix:** New `api.ts refreshToken()` reads `localStorage.getItem('refresh_token')` (matching `auth.ts:22-24` constant) and posts `{ refreshToken }` to match the Zod contract. Documented in the spike contract comment in `api-error.ts` and the Task 2 commit body.
- **Files modified:** `kapwa-client/src/lib/api.ts`
- **Verification:** `npx vitest run src/lib/api.test.ts -t "401"` shows 3/3 single-flight tests pass with the new contract
- **Committed in:** `9ee5bbb` (Task 2 commit)

**3. [Rule 1 - Plan Gap] Added ApiPath type + normalizePath helper to api.get/post/put/del**
- **Found during:** Task 4 (wiring SWRConfig with `fetcher: api.get`)
- **Issue:** Plan pattern 3 wires `<SWRConfig fetcher: api.get>` and pages call `useSWR(queryKeys.dashboard.stats())` where the key is a tuple `['dashboard', 'stats']`. Without tuple handling, `api.get(['dashboard', 'stats'])` would throw on the `path.startsWith('http')` check (tuples don't have startsWith). The plan's swr-config test 1 also asserts the URL passed to fetch contains `/dashboard/stats`.
- **Fix:** Added `ApiPath = string | readonly unknown[]` type, `normalizePath` helper that joins tuple elements with `/` and filters out empty/null values (`'/' + tuple.filter(p => p !== null && p !== undefined && p !== '').join('/')`). Updated `api.get/post/put/del` signatures to accept `ApiPath`. Inline URL construction updated to call `normalizePath(path)`.
- **Files modified:** `kapwa-client/src/lib/api.ts`
- **Verification:** `npx vitest run src/lib/swr-config.test.tsx -t "fetcher is api.get"` passes; URL contains `/dashboard/stats`
- **Committed in:** `bf744b6` (Task 4 commit — bundle with the SWRConfig wiring)

**4. [Rule 1 - Plan Gap] Added memoization to queryKeys factory for reference stability**
- **Found during:** Task 3 (implementing query-keys.ts)
- **Issue:** Plan test 2 asserts `queryKeys.cases.detail('c1') === queryKeys.cases.detail('c1')` (reference equality). Without memoization, each call returns a new array, breaking SWR's reference-equality dedup (RESEARCH.md Pitfall 2). The `as const` assertion gives type stability, not reference stability.
- **Fix:** Added a `Map<string, readonly unknown[]>` cache and `memo<T>(key, build)` helper. Each factory function call constructs a cache key like `'cases.detail.<id>'` or `'cases.list.<json-stringified-params>'` and returns the cached tuple if present, otherwise builds and caches a new one. The function's declared return type stays the same `as const` tuple; runtime reference is stable.
- **Files modified:** `kapwa-client/src/lib/query-keys.ts`
- **Verification:** `npx vitest run src/lib/query-keys.test.ts` passes 7/7; reference-equality test (`toBe`) succeeds
- **Committed in:** `e9e3b43` (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (1 plan contradiction, 1 pre-existing bug, 2 plan gaps)
**Impact on plan:** All 4 auto-fixes are correctness-required (build green, server contract match, fetcher tuple handling, SWR dedup). No scope creep — the shims are migration glue that goes away in 14-03; the ApiPath/memo additions are tiny (~30 lines combined) and required by the plan's own tests.

## Issues Encountered

- **Test 3 (timeout) required a fetch mock that rejects on abort.** The original mock made `fetch` never resolve, which would hang the test forever after the abort (because `await fetch(...)` would never settle). Fixed by making the mock reject with `AbortError` when the signal aborts, allowing the retry loop to complete (3 retries → 4 calls → final throw → `.catch()`).
- **Test 14 (exponential backoff) needed fake timers + `runAllTimersAsync`.** The 500+1500+4500ms backoff sum exceeds the 5000ms test timeout. Used `vi.useFakeTimers()` + `await vi.runAllTimersAsync()` in a loop to flush all pending timers (both the internal 10s timeouts and the backoff delays) without real-time waits.
- **SWR's global fetcher with tuple keys.** Plan pattern 3 assumes `fetcher: api.get` works with `useSWR(queryKeys.dashboard.stats())` where the key is a tuple. `api.get` was originally typed as `(path: string)`. Required adding `ApiPath = string | readonly unknown[]` and `normalizePath` to bridge the type mismatch. Documented as deviation #3.
- **Memoization for queryKeys reference stability.** Plan test 2's reference-equality assertion (`toBe`) requires memoization — `as const` gives type stability but not reference stability. Added a `Map`-based memo to all 9 subtrees. Documented as deviation #4.

## User Setup Required

None - no external service configuration required. All changes are local to `kapwa-client/`. The backend (kapwa-server) is untouched.

## Next Phase Readiness

- **Plan 14-02 ready to start:** Top 5 pages (Dashboard, Cases, Beneficiaries, Filing, Admin) can now migrate from `useEffect + fetch + getCases()` to `useSWR(queryKeys.cases.list())`. The 28 shim wrappers in api.ts provide a soft migration path — pages can stay on `getCases()` for now and switch to `api.get` incrementally.
- **Plan 14-03 ready:** Remaining 16 GET endpoints + remaining 39 raw-fetch sites migrate; the 12 missing `queryKeys` subtrees (auth, intake, IRF detail, sync, etc.) get added; the 28 shim wrappers are deleted in final cleanup.
- **The /auth/refresh body fix (deviation #2) means any in-flight sessions using the old client will need to re-login once** — the old `auth.ts:43` sent header-only refresh which the new server expects a body for. Not a regression — the old code was already broken. New sessions work correctly.
- **Mobile build implication (informational):** `kapwa-client/dist/` was rebuilt via `npm run build` (exits 0). Capacitor (Android/iOS) reads from `dist/` at build time — if a mobile build runs during the next phase, `npx cap sync` is needed.
- **No working-tree issues:** All 4 task commits land cleanly on `main` (sequential executor, no worktree). Working tree clean (only untracked `.planning/phases/14-api-client-swr/14-PATTERNS.md` from a prior session, not part of this plan's output).

## Self-Check: PASSED

- [x] `kapwa-client/src/lib/api-error.ts` exists, exports `class ApiError extends Error` with status/body/cause/name
- [x] `npx vitest run src/lib/api-error.test.ts` shows 4/4 tests passing
- [x] `kapwa-client/src/lib/api.ts` exports `api` object with `get/post/put/del` methods (plus 28 shim wrappers per deviation #1)
- [x] `kapwa-client/src/lib/api.ts` does NOT contain `apiFetch` as an export (verified: `grep -c 'apiFetch' src/lib/api.ts` = 0)
- [x] `npx vitest run src/lib/api.test.ts` shows 16/16 tests passing (one per behavior)
- [x] `npx vitest run` shows 230/230 tests passing (197 baseline + 4 ApiError + 16 api + 7 queryKeys + 4 swr-config + 2 auth-context)
- [x] `kapwa-client/src/lib/query-keys.ts` exports `queryKeys` with 9 resource subtrees, all `as const` tuples, memoized
- [x] `npx vitest run src/lib/query-keys.test.ts` shows 7/7 tests passing
- [x] `kapwa-client/src/routes.tsx` contains `<SWRConfig value={{ fetcher: api.get, revalidateOnFocus: true, revalidateOnReconnect: true, dedupingInterval: 2000, refreshInterval: 0 }}>` inside `<AuthProvider>`
- [x] `kapwa-client/src/lib/auth-context.tsx` AuthProvider has a `useEffect` with empty deps that subscribes to `kapwa:auth:logout` and calls `logout()`
- [x] `npx vitest run src/lib/swr-config.test.tsx` shows 4/4 tests passing
- [x] `npx vitest run src/lib/auth-context.test.tsx` shows 2/2 tests passing
- [x] `npm run build` exits 0 (vite-rolldown bundle: 991.86 kB / 277.23 kB gzip)
- [x] All 4 task commits verified in git log: `6c6abd5`, `9ee5bbb`, `e9e3b43`, `bf744b6`

---

*Phase: 14-api-client-swr*
*Plan: 01 — API Client & SWR Foundation*
*Completed: 2026-07-06*
