# Project Research Summary — Kapwa v1.2 Quality & Resilience Hardening

## Key Findings

### Stack Additions (nothing new to install, activate existing)
- **SWR** is already in `package.json` — activate via `useSWR` hooks in pages, replace raw `fetch()`
- **Vitest v4** upgrade: `npm install vitest@^4 @vitest/ui vitest-axe` — v4 has 30-50% faster parallel execution
- **@axe-core/react** already listed as `@axe-core/playwright` in devDeps — add `vitest-axe` for unit-level a11y
- **React ErrorBoundary** already implemented in `src/components/ErrorBoundary.tsx` — just needs wiring

### Feature Patterns
- **SWR pattern**: Replace `useState + useEffect + fetch` with `useSWR(key, fetcher)` — automatic stale-while-revalidate, deduplication, error retry
- **API client**: Create `src/lib/api-client.ts` with `fetch` wrapper: timeout (10s), retry (3x for GET), interceptor for Bearer token, error transform
- **ErrorBoundary wrapping**: Add `<ErrorBoundary>` as peer component within each page's `<PageShell>`, catching render errors above the page content
- **Smoke tests**: `it('renders without crashing', () => { render(<Page />); })` pattern for every page
- **Vitest v4 migration**: `create-vitest@latest` codemod, replace `vi.fn()` → `vi.fn()` (backward compatible), parallel file execution

### Architecture Integration
- API client injects into existing pages with minimal diffs — replace `fetch('${API_URL}/...')` with `api.get('/...')`  
- SWR keys follow REST semantics: `/api/cases`, `/api/beneficiaries`, etc.
- ErrorBoundary sits inside PageShell pattern — no route-level changes needed
- Token rotation: add `onUnauthorized` interceptor to API client, refresh token via `/api/auth/refresh` endpoint
- SkipToContent: add to `<Layout>` component before main content, 1-line import

### Pitfalls to Watch
1. **SWR key collision**: Multiple pages fetching `/api/cases` with different filters share the SWR cache — use distinct keys with query params
2. **ErrorBoundary placement**: Must be INSIDE `<Router>` but OUTSIDE page content — placing it above `<Routes>` catches navigation errors too
3. **Vitest v4 breaking changes**: `vi.mock()` hoisting behavior changed, `vitest.config.ts` format changed — use `create-vitest` codemod
4. **Token rotation loop**: If `/api/auth/refresh` also returns 401, break the loop — clear token and redirect to `/login`
5. **axe-core false positives**: Radix UI components generate contrast ratio warnings — suppress known false positives with `rules: { 'color-contrast': {...} }`
6. **SMOKE tests rendering real pages**: Pages with `fetch()` in `useEffect` will fire during tests — mock `globalThis.fetch` or wrap in `act()`

## Implications for Roadmap

### Phase ordering
1. **Phase 1: Toolchain Upgrade** — vitest v4, dependency cleanup (playwright/capacitor/esbuild → devDeps). Unblocks remaining work.
2. **Phase 2: Error Resilience** — ErrorBoundary wrapping for all 28 pages. Smallest files, highest impact.
3. **Phase 3: Core Test Suite** — Tests for api.ts, auth-context, offline-queue, secure-storage. Foundation for confidence.
4. **Phase 4: API Client** — Centralized client + SWR activation. Changes fetch calls site-by-site.
5. **Phase 5: UI Tests** — Smoke tests for Layout, Topbar, Sidebar, ProtectedRoute, + a11y integration.
6. **Phase 6: Page Smoke Tests** — 1 test per page (28 pages) + SkipToContent + token rotation.

### Dependencies
- Phase 3 depends on Phase 1 (vitest needed)
- Phase 4 depends on Phase 1 (toolchain clean)
- Phase 5 depends on Phase 3 (core tests first)
- Phase 6 depends on Phase 4 (API client needed for pages to render stably)

## Sources
- SWR docs (swr.vercel.app)
- Vitest v4 migration guide (vitest.dev)
- @axe-core/react npm docs
- React ErrorBoundary API reference
