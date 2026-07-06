# Phase 14: API Client & SWR - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

## Phase Boundary

Centralize the 74 scattered raw `fetch()` calls across 9 pages, 3 widget components, 2 hooks, and 4 lib modules into a single method-style API client (`api.get/post/put/delete`) with Bearer token + 401-refresh + retry+timeout built in. Activate SWR for the 21 GET-shaped endpoints with a typed query-key factory, dedup, and stale-while-revalidate. Delete the 67 legacy wrapper functions in `src/lib/api.ts` and refactor all call sites to use the new method-style client. Three-plan bottom-up delivery: helpers → top 5 pages → remaining 16 pages + tests. SEC-01 token refresh is implemented in this phase as part of the 401 interceptor.

## Implementation Decisions

### API Client Shape
- **D-01:** Refactor `src/lib/api.ts` to method-style: `api.get<T>(path, opts)`, `api.post<T>(path, body, opts)`, `api.put<T>(path, body, opts)`, `api.del<T>(path, opts)`. Delete all 67 legacy wrapper functions (`getCases`, `createCase`, etc.). All 74 raw fetch call sites migrate to the new method style.
- **D-02:** Token source: read `localStorage.getItem('kapwa_token')` at request time (preserves current pattern, no React coupling, works in event handlers and outside components).
- **D-03:** Errors thrown as a custom `ApiError` class: `class ApiError extends Error { status: number; body: unknown; cause?: unknown }`. Call sites: `if (e instanceof ApiError && e.status === 401) …`. Preserves `instanceof Error` so existing `try/catch` patterns still work.
- **D-04:** 401 handling: full SEC-01 token refresh interceptor. On 401, attempt `/auth/refresh` exactly once → retry original request transparently. Concurrent 401s share the same in-flight refresh promise (single-flight). If refresh itself 401s: clear token, navigate to `/login`. Matches existing project preference (websocket fail → /login).
- **D-05:** 4xx (other than 401) and 5xx are NOT retried — surfaced as `ApiError` with status, caller decides. Network failure and timeout are the only retry triggers (see Retry Policy).

### SWR Activation
- **D-06:** Install `swr` as a runtime dependency. Add a single `<SWRConfig>` provider at the app root (in `App.tsx` or `routes.tsx`) configuring the global `fetcher` to `api.get`. All 21 GET-shaped endpoints migrate to `useSWR(key, …)` pattern. No per-page fetcher prop.
- **D-07:** Query keys: tuple-of-strings with params, exposed via a centralized typed factory `queryKeys` in `src/lib/query-keys.ts`. Pattern: `['resource', 'verb', paramsObject]` with `as const` for literal-typed tuples. Enables `mutate(queryKeys.cases.all)` to revalidate all case-related queries.
- **D-08:** Mutations use `useSWRMutation` hook (SWR 2.x official pattern). Returns `{ trigger, isMutating, error, data }`. `onSuccess` callback calls `mutate(queryKeys.<resource>.all, undefined, { revalidate: true })` to revalidate the relevant list/detail keys. Optimistic updates supported via the `optimisticData` option.
- **D-09:** Default SWR config: `revalidateOnFocus: true`, `revalidateOnReconnect: true`, `dedupingInterval: 2000`, `refreshInterval: 0` (no polling). Per-page overrides allowed via second arg to `useSWR`.
- **D-10:** Scope: convert ALL 21 GET-shaped endpoints (9 pages + 3 widget components + 2 hooks). This is the full dedup / stale-while-revalidate win, not a pilot.

### Retry & Timeout
- **D-11:** Retry trigger: network failure (TypeError 'fetch failed' / 'Failed to fetch') and timeout ONLY. 4xx and 5xx are NOT retried — server is broken or the request is invalid; retry won't help. Matches user preference for "narrow" retry semantics.
- **D-12:** Retry policy: 3 attempts max, exponential backoff with ±20% jitter: 500ms, 1500ms, 4500ms (base delays; jitter shifts each by ±20%). Applied only to GET. POST/PUT/DELETE never retry.
- **D-13:** Timeout: 10 seconds per request via internal `AbortController.timeout(10_000)`. Caller-supplied `signal` (e.g., from SWR's auto-unmount signal) is composed with the internal timeout signal via `AbortSignal.any([internal, caller])`. Both can cancel.

### Migration Order
- **D-14:** Bottom-up: helpers first, pages second, tests third. Plan A builds `api` client + `queryKeys` + `ApiError` + `<SWRConfig>` provider + 401 refresh interceptor. Plan B converts the top 5 most-trafficked pages to `useSWR`. Plan C converts the remaining 16 GET endpoints + writes new tests + deletes remaining raw fetch sites outside `api.ts`.
- **D-15:** Plan A pilot pages: `src/lib/auth-context.tsx` is left on raw fetch for `/auth/login` and `/auth/mfa/verify` (avoids circular dependency between auth and the api client during 401 refresh). Pilot migration in Plan A: none — proves the helpers work in isolation via unit tests. Top 5 pages in Plan B: **Dashboard, Cases, Beneficiaries, Filing, Admin** (widest role coverage: worker + admin + auditor).
- **D-16:** Plan structure: 3 plans. Plan 14-01 = client + keys + provider + tests (~30-40% effort). Plan 14-02 = top 5 page migration + tests (~30%). Plan 14-03 = remaining 16 endpoints + dedup remaining raw fetch + final tests (~30%).

### the agent's Discretion
- Specifics of the `ApiError.toJSON()` shape (used by SWR's error display)
- The exact jitter algorithm (full random vs decorrelated jitter) — both are acceptable
- Internal `retryDelay` calculation function name and signature
- Whether to add a `dedupingInterval` per-query or rely on the global default

## Canonical References

### Project Context
- `.planning/PROJECT.md` — Project overview, Kapwa stack, current milestone v1.2
- `.planning/REQUIREMENTS.md` — v1.2 requirements API-01 (centralized client + retry + timeout + bearer interceptor), API-02 (SWR for data fetching), SEC-01 (token refresh interceptor — implemented in this phase via D-04)
- `.planning/ROADMAP.md` — Phase 14 boundary, success criteria #1-5
- `.planning/phases/12-toolchain-cleanup-vitest-upgrade/12-CONTEXT.md` — D-03 (fix forward on test breaks), D-08 (vitest include pattern `src/**/*.test.{ts,tsx}`)
- `.planning/phases/13-major-version-upgrades/13-CONTEXT.md` — D-09 (codemod-then-verify precedent), D-06 (clean migration pattern)

### Codebase Maps
- `.planning/codebase/INTEGRATIONS.md` — Auth: custom JWT bearer (Passport JWT), tokens via `localStorage.getItem('kapwa_token')`, refresh endpoint at `/auth/refresh`, RLS scoped by role+barangay
- `.planning/codebase/STRUCTURE.md` — `kapwa-client/src/lib/` is the service-layer home; `kapwa-client/src/pages/` has 28+ pages
- `.planning/codebase/CONVENTIONS.md` — Relative imports only (no `@/*` aliases), external frameworks → project → CSS order

### Package Configuration
- `kapwa-client/package.json` — Currently no `swr` dep; React 19 just installed in Phase 13
- `kapwa-client/vite.config.ts` — Vite 8.0.10 + vitest 4.1.9 (jsdom); test environment compatible with SWR
- `kapwa-client/src/App.tsx` — Root component; install `<SWRConfig>` here (or in `routes.tsx`)
- `kapwa-client/src/routes.tsx` — Alternate install point for `<SWRConfig>`

### Current API Surface (to be deleted)
- `kapwa-client/src/lib/api.ts` — 388 lines, 67 wrapper functions, central `apiFetch()` helper. Read by D-01 to plan deletion and rewrite.
- `kapwa-client/src/lib/auth-context.tsx` — 4 raw fetch calls (`/auth/login`, `/auth/me`, `/auth/mfa/verify`, `/auth/me` again) using its own `API` constant. Per D-15, login/MFA stay on raw fetch; `/auth/me` migrates to api.get.
- `kapwa-client/src/lib/auth.ts` — Uses raw fetch for `/auth/refresh`. This is the endpoint the 401 interceptor calls — circular dependency, must NOT use `api.get`.
- `kapwa-client/src/lib/sync.ts` — 3 raw fetch calls (`/sync/v1`, `/sync/pull`, `/sync/conflicts/.../resolve`). Migrate to api.post.
- `kapwa-client/src/lib/encrypted-db.ts`, `database.ts`, `offline-queue.ts` — No fetch calls (local storage only).

### Pages & Components to Migrate
- `kapwa-client/src/pages/` — 9+ pages with raw fetch: `FilingPage`, `AdminPage`, `AuditorPage`, `AccessCardPage`, `MessagesPage`, `CaseTrackerPage`, `ClaimantDashboardPage`, `ApprovalPipelinePage`, `RegisterPage`, `MyAccessCardPage`
- `kapwa-client/src/components/dashboard/widgets/AuditorWidgets.tsx`, `ClaimantWidgets.tsx` — Widget components with raw fetch
- `kapwa-client/src/components/NotificationsDropdown.tsx` — 4 raw fetch calls
- `kapwa-client/src/hooks/useDebouncedSearch.ts`, `usePiiMasking.ts` — Hooks with raw fetch
- `kapwa-client/src/components/ReportsExportButton.tsx` — 1 raw fetch (download URL)

### Test Fixtures
- `kapwa-client/src/pages/CaseTrackerPage.test.tsx` — Existing test mocks `fetch` directly (line 6 comment: "Mock fetch since this page uses raw fetch() calls"). Pattern reusable for SWR component tests: `vi.spyOn(global, 'fetch').mockResolvedValue(...)` or `vi.mock('swr')`.
- `kapwa-client/src/__tests__/e2e.test.ts` — E2E tests already exercise the real API. Will be re-validated by Plan 14-03 (must still pass after migration).

## Existing Code Insights

### Reusable Assets
- **`apiFetch()` in `kapwa-client/src/lib/api.ts:3`** — Existing 11-line helper. Pattern: read token → set Authorization header → fetch → throw on !ok → return json. New `api.get/post/put/del` will preserve this body, just expose it as methods + add retry/timeout/refresh.
- **`localStorage.getItem('kapwa_token')` in 4+ files** — Already the token source everywhere. Centralizing in `api.ts` removes this duplication.
- **`useDebouncedSearch` hook** — Used in 1 page currently (`useDebouncedSearch.ts`). Plan B can wire it through the api client + useSWR for the BeneficiariesPage search.
- **`usePiiMasking` hook** — Has its own audit-unmask fetch. Migrate to `api.post` since it's a mutation.
- **`@testing-library/react` v16.3.2 + `vitest` v4.1.9** — Installed in Phase 12/13, ready for SWR component tests.
- **Page test pattern from `CaseTrackerPage.test.tsx`** — `vi.spyOn(global, 'fetch')` for unit tests. For SWR tests, also need `SWRConfig` wrapper with a mock fetcher.

### Established Patterns
- **No path aliases** — relative imports only (`./lib/api`, `../lib/auth-context`). New files follow this.
- **Test commands** — `npm test` (vitest watch), `npm run test:run` (single run). Tests must continue passing.
- **Vitest include pattern** — `src/**/*.test.{ts,tsx}` for co-located + `tests/**/*.test.ts` for e2e.
- **Bearer token header** — `Authorization: Bearer <token>` convention. New client uses this.
- **`VITE_API_URL` env var** — Defaults to `http://localhost:3000/api`. New client reads this the same way (keep the existing `import.meta.env.VITE_API_URL || '…'` pattern).
- **API base constant** — Currently declared in 3+ files (`api.ts:1`, `auth-context.tsx:13`, `sync.ts`). New client centralizes this; the others import from `api.ts`.

### Integration Points
- **`App.tsx` or `routes.tsx`** — Wrap children in `<SWRConfig value={{ fetcher: api.get, ... }}>`. Provider must be inside `AuthProvider` so token reads work, but outside routes so all pages can use SWR.
- **`auth-context.tsx` `logout()` function** — Called by the 401 interceptor's refresh-failure branch. Need to import `useAuth` logout OR publish a custom event the auth-context listens for (event is cleaner — avoids hook-in-module coupling).
- **`auth.ts` `/auth/refresh` endpoint** — Imported by the 401 interceptor. Must use raw fetch (circular dependency on api.ts).
- **`/api` base URL** — From `import.meta.env.VITE_API_URL`. Single source of truth in new `api.ts`.
- **TypeScript types for API responses** — Currently untyped (return `Record<string, unknown>`). New client uses generics: `api.get<Case>(path)`. Plan 14-01 introduces `ApiResponse<T>` type wrappers; existing call sites can be migrated to typed form gradually.

## Specific Ideas

- **401 listener pattern from existing websocket code** — Project context says "When websocket fails, redirect to /login." The 401 interceptor follows the same pattern: detect failure → clear local + navigate to /login. Should reuse the same logout helper if one exists.
- **Optimistic updates for case status transitions** — Approve/disburse/close case buttons are high-frequency worker actions. The `useSWRMutation` `optimisticData` option can show the new status in the case list immediately while the request flies.
- **SWR `mutate` for cross-page invalidation** — When a case is updated on the Cases page, the Dashboard's "recent cases" widget should reflect the change. `mutate(queryKeys.cases.all)` triggers a revalidation of all case-related queries across all components, no prop-drilling.

## Deferred Ideas

- **Coverage threshold enforcement** — `vitest coverage --thresholds.lines=70` etc. — not in this phase; Phase 15 (Core Module Tests) is the right place.
- **MSW (Mock Service Worker) for tests** — Currently tests use `vi.spyOn(fetch)`. MSW is the modern standard for fetch mocking but is a larger refactor of test setup. Defer to a test infrastructure phase.
- **React Query as a SWR alternative** — Considered but rejected. SWR is smaller, fits the project's "no Redux/Zustand" stance in REQUIREMENTS.md ("SWR + React Context sufficient for current scale"). Sticking with SWR per project constraints.
- **GraphQL migration** — Not in scope; the backend is REST/NestJS.
- **Per-page SWR config presets** — Could create `useCases()` and `useBeneficiaries()` hook wrappers around `useSWR` for ergonomics. Defer to a "hook convenience layer" phase if pages get too repetitive.
- **WebSocket reconnection backoff** — Unrelated; the WS client lives in `chat-socket.ts`. Defer to a chat infra phase.
- **CSRF protection for state-changing requests** — Bearer tokens don't need CSRF (CSRF is for cookies). Not applicable to JWT-in-localStorage model. Defer indefinitely.

---

*Phase: 14-API Client & SWR*
*Context gathered: 2026-07-06*
