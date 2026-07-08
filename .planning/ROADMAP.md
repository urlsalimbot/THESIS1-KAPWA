# Roadmap — Kapwa (v1.2: Quality & Resilience Hardening)

**Created:** 2026-07-05
**Milestone:** v1.2
**Phase numbering:** Continuing from v1.1 (last: Phase 11)

---

## Phase 12: Toolchain Cleanup & Vitest Upgrade

**Goal:** Clean dependency tree and upgrade test runner to v4 for 30-50% faster parallel execution.

**Requirements:** DEP-01, DEP-02

**Success criteria:**
1. `npm ls --prod` no longer lists playwright, @capacitor/cli, or esbuild
2. `npx vitest run` executes under vitest v4 with all 196 existing tests passing
3. `npm run build` produces identical output (no regressions from dep moves)
4. Dev server starts without warnings from deprecated vitest APIs

**Plans:** 2 plans

Plans:
- [ ] 12-01-PLAN.md — Move 3 misplaced deps (playwright, @capacitor/cli, esbuild) from `dependencies` to `devDependencies` and upgrade vitest 1.2.0 → 4.1.9 in a single atomic commit
- [ ] 12-02-PLAN.md — Co-locate 24 test files with their sources and move 10 orphan tests to new `src/__tests__/` directory per vitest v4 convention; update vite.config.ts include pattern

---

## Phase 13: Major Version Upgrades

**Goal:** Upgrade React, Capacitor, and Tailwind CSS to latest major versions early so all subsequent phases test against the new platform.

**Requirements:** UPG-01, UPG-02, UPG-03

**Success criteria:**
1. `react` and `react-dom` at ^19.0.0, all React 18 deprecated APIs resolved
2. `@capacitor/core`, `@capacitor/android`, `@capacitor/ios` at ^8.0.0
3. `npx cap sync android` and `npx cap sync ios` succeed without errors
4. `tailwindcss` at ^4.0.0, `postcss.config.mjs` uses `@tailwindcss/postcss` plugin
5. Full visual regression: all 28 pages render identically to v1.1 screenshots
6. Production Android APK and iOS IPA build successfully

---

## Phase 14: API Client & SWR

**Goal:** Replace scattered raw `fetch()` calls with a centralized API client and activate SWR for automatic data fetching.

**Requirements:** API-01, API-02

**Success criteria:**
1. `src/lib/api-client.ts` exports `api.get()`, `api.post()`, `api.put()`, `api.delete()` with Bearer token interceptor
2. All 10 data-fetching pages use `useSWR(key, api.get)` pattern
3. GET requests automatically retry 3× on network failure; PUT/POST/DELETE do not retry
4. SWR deduplicates concurrent identical requests (DevTools shows single network call)
5. Stale data shows cached content while revalidating (no flash of loading skeleton on revisit)

---

## Phase 15: Core Module Tests

**Goal:** Achieve ≥70% unit test coverage on the most critical data modules.

**Requirements:** TST-01, TST-02, TST-03, TST-04

**Success criteria:**
1. `api.ts` has tests covering: CRUD operations, auth header injection, error responses, timeout handling
2. `auth-context.tsx` has tests covering: login flow, logout flow, role-based guards, token persistence
3. `offline-queue.ts` has tests covering: queue push, dequeue, conflict detection, version vector updates
4. `secure-storage.ts` has tests covering: encrypt, decrypt, key rotation, corrupted data handling
5. Combined coverage report shows ≥70% lines covered across all 4 modules

---

## Phase 16: UI Polish — ErrorBoundary + A11Y + Core UI Tests

**Goal:** Error resilience, accessibility infrastructure, and smoke tests for core layout components.

**Requirements:** ERR-01, TST-05, A11Y-01, A11Y-02

**Success criteria:**
1. All 28 pages import and render within `<ErrorBoundary>` — render errors show fallback UI
2. Throwing a `TypeError('Failed to fetch')` inside any page shows the offline UI
3. Layout, Topbar, Sidebar, ProtectedRoute each have a smoke test (renders without crash)
4. `SkipToContent` link is visible on keyboard focus in `<Layout>`
5. `vitest-axe` integrated and runs on Layout/Topbar/Sidebar smoke tests
6. ErrorBoundary test suite (6 existing tests) continues to pass

---

## Phase 17: Page Smoke Tests + Security

**Goal:** Smoke-test every page, enable a11y CI gate, and add token rotation for production security.

**Requirements:** TST-06, TST-07, SEC-01

**Success criteria:**
1. All 28 pages have at least 1 smoke test (renders without crash)
2. `vitest-axe` runs on at least 10 page smoke tests in CI
3. CI pipeline fails on a11y violations (vitest `expect().toHaveNoViolations()`)
4. API client `onUnauthorized` interceptor refreshes token automatically
5. Token refresh 401 breaks the loop (clears token + redirects to /login)
6. Manual test: login → wait for token expiry → navigate → automatic refresh → page loads

**Plans:** 3 plans

Plans:
- [x] 17-01-PLAN.md — CI pipeline (3 jobs) + SECURITY.md + api.ts JSDoc
- [x] 17-02-PLAN.md — axe assertions on 14 Worker/Admin pages + a11y fixes
- [x] 17-03-PLAN.md — axe assertions on 14 Claimant/Auditor/Mayor/Coordinator pages + a11y fixes

---

## Progress

| Phase | Status | Requirements | Plans |
|-------|--------|--------------|-------|
| 12 | ⊙ | DEP-01, DEP-02 | 2/0 |
| 13 | ⊙ | UPG-01, UPG-02, UPG-03 | 2/0 |
| 14 | ⊙ | API-01, API-02 | 3/0 |
| 15 | ⊙ | TST-01, TST-02, TST-03, TST-04 | 4/0 |
| 16 | ⊙ | ERR-01, TST-05, A11Y-01, A11Y-02, TST-06 (folded from 17) | 3/0 |
| 17 | ✅ | TST-06, TST-07, SEC-01 | 3/3 |

**6 phases | 18 requirements | Ready to plan ✓**

---
*Roadmap created: 2026-07-05*
