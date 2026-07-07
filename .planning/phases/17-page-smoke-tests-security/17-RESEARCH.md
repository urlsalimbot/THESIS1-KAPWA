# Phase 17: Page Smoke Tests + Security — Research

**Researched:** 2026-07-08
**Domain:** CI/CD pipeline (GitHub Actions) + Accessibility (axe-core on all pages) + Security documentation (SECURITY.md)
**Confidence:** HIGH (all stack components verified on disk and via official sources)

## Summary

Phase 17 closes the v1.2 milestone with three remaining requirements: **TST-07** (axe-core CI gate), **SEC-01** (security documentation + verification), and the completion of **TST-06** scope (axe on page tests, already fold-extended from Phase 16). Three plans deliver:

- **Plan 17-01** creates `.github/workflows/ci.yml` with 3 jobs (test → coverage, build in parallel) using `actions/checkout@v4` + `actions/setup-node@v4` + `npm ci`, plus writes `SECURITY.md` documenting the existing 401 single-flight refresh interceptor (SEC-01), JWT bearer auth, ABAC, threat model, and manual test steps.
- **Plans 17-02/17-03** add `import { axe } from 'vitest-axe'` + `expect(await axe(container)).toHaveNoViolations()` assertions to all 28 page tests (14 per plan, alphabetically split), and fix any a11y violations surfaced.

**Key realisation — SEC-01 is already implemented in code.** The `api.ts` onUnauthorized interceptor (lines 80-117) has a single-flight refresh with loop-breaking (clears tokens + dispatches `kapwa:auth:logout` event on refresh failure). Phase 17 only needs to **document** it in SECURITY.md — no code changes for SEC-01.

**Primary recommendation:** Create the CI workflow targeting `kapwa-client/` working directory with Node 20, `npm ci` (no cache per D-03), 3 parallel-safe jobs, and upload the coverage HTML report as an artifact. Add axe assertions to pages in two equal batches to keep each plan <100 lines net new. Write SECURITY.md with architecture overview, token flow diagram, and manual test steps.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CI pipeline (GitHub Actions) | Infrastructure (CI) | — | Runs on GitHub-hosted runners; no server-side code changes. The workflow config is in `.github/workflows/ci.yml`. |
| axe a11y assertions on page tests | Test infrastructure | — | Addition of `vitest-axe` assertions to existing test files in `src/pages/*.test.tsx`. Production code is only touched if a11y violations are found. |
| a11y violation fixes | Client (React components) | — | If axe finds violations, fix is in `src/pages/*.tsx` production code (ARIA labels, heading hierarchy, color contrast). |
| SECURITY.md documentation | Documentation | Client (security architecture) | Documents existing security mechanisms (JWT, 401 refresh, ABAC). No code changes. |
| Token rotation verification | Manual test | — | SEC-01 is already implemented in `api.ts:80-117`. Phase 17 only adds manual test steps to SECURITY.md. |

## Standard Stack

### Core — GitHub Actions

| Action | Version | Purpose | Why Standard | Confidence |
|--------|---------|---------|--------------|------------|
| `actions/checkout` | `v4` | Checkout repository | Most widely used checkout action; v4 is current stable. Commit SHA pin recommended. | [CITED: github.com/actions/checkout](https://github.com/actions/checkout) |
| `actions/setup-node` | `v4` | Install Node.js with version matrix | Standard for Node.js CI. v4 supports Node 20+. | [CITED: github.com/actions/setup-node](https://github.com/actions/setup-node) |
| `actions/upload-artifact` | `v4` | Upload coverage HTML report | v4 is current stable (v3 deprecated Nov 2024). Uploads `coverage/` directory. | [CITED: github.com/actions/upload-artifact](https://github.com/actions/upload-artifact) |

### Core — Test Infrastructure (already installed)

| Library | Version | Purpose | Why Standard | Confidence |
|---------|---------|---------|--------------|------------|
| `vitest` | `4.1.10` (lockfile) | Test runner | Phase 12 upgrade; v4 parallelization. | [VERIFIED: npm registry] |
| `vitest-axe` | `0.1.0` | `toHaveNoViolations()` matcher + `axe()` runner | Phase 16 install; globally wired via `tests/setup.ts`. | [VERIFIED: npm registry] |
| `@vitest/coverage-v8` | `4.1.10` | Coverage with perFile: true | Phase 15 install; v8 provider. | [VERIFIED: npm registry] |
| `@testing-library/react` | `16.3.2` | DOM render + queries | React 19-compatible; standard for vitest. | [VERIFIED: npm registry] |
| `jsdom` | `24.0.0` | Browser environment for vitest | Required for axe assertions in vitest. | [VERIFIED: npm registry] |

### Supporting

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| `react-router-dom` | `^6.21.1` | `<MemoryRouter>` for tests | All page tests wrap in MemoryRouter. | [VERIFIED: npm registry] |
| `swr` | `^2.2.4` | `SWRConfig` with mock fetcher | Page tests using `useSWR` need SWRConfig wrapper. | [VERIFIED: npm registry] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `actions/upload-artifact@v4` | `vitest-coverage-report` action | The dedicated action adds markdown comment on PRs, but requires `dorny/test-reporter` and adds complexity. Plain upload-artifact is simpler and sufficient for this project (no PR review workflow expected). |
| `npm ci` | `npm install` | `npm ci` is stricter (fails if `package-lock.json` is missing) and faster (skips resolution). Standard CI practice. D-03 says no npm cache, so `npm ci --prefer-offline` is not needed. |

## Package Legitimacy Audit

> Phase 17 does NOT install new external packages. Every tool referenced is already in `package.json` and verified in `node_modules/`.

| Package | Verdict | Disposition |
|---------|---------|-------------|
| `vitest-axe` | OK | Already installed; used by Layout/Topbar/Sidebar tests. |
| `vitest` | OK | Already installed and configured. |
| `@vitest/coverage-v8` | OK | Already installed; coverage runs in CI. |
| `@testing-library/react` | OK | Already installed. |

**Packages removed due to SLOP verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
                          (Developer pushes to main or opens PR)
                                    |
                                    v
                      GitHub Actions Runner (ubuntu-latest)
                                    |
                    +---------------+---------------+
                    |               |               |
                    v               v               v
              Job: test       Job: coverage     Job: build
          (npm run test:run)  (npm run coverage) (npm run build)
                    |               |               |
                    |        (depends on test)   (parallel)
                    |               |               |
                    v               v               v
             All 314+ tests    Coverage >70%    Vite build
                pass         per-file on 5      succeeds
                                modules
                                    |
                                    v
                         Upload coverage/ as
                         artifact (HTML report)
```

### Page Test + axe Flow

```
        Each page test file (src/pages/SomePage.test.tsx)
                    |
        +-----------+-----------+
        |                       |
        v                       v
  Existing render           ADD: axe(container)
  + heading assertion       assertion
  (already exists)               |
        |                       v
        |               expect(results)
        |               .toHaveNoViolations()
        |                       |
        +----------+------------+
                   |
                   v
         Both pass: test ✅
         axe fails: fix production code
         in the page .tsx, re-run, commit
```

### Recommended Project Structure

```
project-root/
├── .github/
│   └── workflows/
│       └── ci.yml                        <-- NEW (Plan 17-01)
├── SECURITY.md                           <-- NEW (Plan 17-01) — in project root
├── kapwa-client/
│   ├── src/
│   │   └── pages/
│   │       ├── AboutPage.test.tsx        <-- MODIFIED (Plan 17-02): +axe assertion
│   │       ├── AccessCardPage.test.tsx   <-- MODIFIED (Plan 17-02): +axe assertion
│   │       ├── ...
│   │       ├── DashboardPage.test.tsx    <-- MODIFIED (Plan 17-03): +axe assertion
│   │       └── ...
│   └── ...
```

### Pattern 1: GitHub Actions CI Workflow

**What:** Three-job CI pipeline running from `kapwa-client/` working directory. Jobs: `test` (vitest run), `coverage` (vitest --coverage, depends on test), `build` (vite build, parallel with coverage).

**When to use:** For any branch or PR push. Currently triggers on push to main and PRs to main.

**Example workflow:**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

defaults:
  run:
    working-directory: kapwa-client

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run test:run

  coverage:
    needs: test
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run coverage:check
      - name: Upload coverage report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-report
          path: kapwa-client/coverage/
          retention-days: 30

  build:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
```

**Key notes:**
- No `cache` key on `actions/setup-node` — matches decision D-03 (Phase 16); the project explicitly opted out of npm caching.
- `coverage` uses `needs: test` so coverage results are only relevant if tests pass first.
- `build` runs in parallel with `coverage` (both independent of each other, `coverage` depends on `test`).
- `actions/upload-artifact@v4` requires path relative to the repository root, so `kapwa-client/coverage/` is correct (not `coverage/`).
- `if: always()` on the upload ensures coverage artifacts are saved even if the threshold check fails.

**Source:** [CITED: vitejs/vite CI workflow reference](https://github.com/vitejs/vite/blob/HEAD/.github/workflows/ci.yml), [CITED: actions/upload-artifact docs](https://github.com/actions/upload-artifact)

### Pattern 2: SECURITY.md Structure

**What:** Standard GitHub SECURITY.md covering supported versions, security architecture, authentication, token refresh, threat model, and vulnerability reporting.

**When to use:** Root of the repository (standard GitHub convention for community health files).

**Sections to include:**

1. **Supported Versions** — Table of currently supported release lines
2. **Security Architecture** — Overview of JWT bearer auth, 1h access + 7d refresh token rotation, ABAC role enforcement
3. **Authentication Flow** — Description of the 401 single-flight refresh interceptor
4. **Threat Model** — Documented threats: replay attack, CSRF, XSS via token theft, MITM on refresh endpoint
5. **Manual Verification** — Step-by-step SEC-01 verification test
6. **Reporting a Vulnerability** — Private reporting channel (GitHub PVR or email)

**Example ASCII sequence diagram for token refresh:**
```
Client                          API Server
  |                                |
  |--- GET /api/resource --------->|  (with expired Bearer token)
  |<-- 401 Unauthorized -----------|
  |                                |
  |--- POST /api/auth/refresh ---->|  (with refresh token)
  |<-- { accessToken, ... } -------|
  |                                |
  |--- GET /api/resource --------->|  (with new Bearer token)
  |<-- 200 OK ---------------------|
```

### Pattern 3: Adding axe Assertion to an Existing Page Test

**What:** Add `import { axe } from 'vitest-axe'` + a new `it('has no a11y violations')` test to each page test file.

**When to use:** Every page test that currently only checks rendering/heading/content assertions. The axe assertion is additive — it does not replace existing tests.

**Example (adding to DashboardPage.test.tsx):**

```tsx
// ADD at the top:
import { axe } from 'vitest-axe';

// ADD new test:
it('has no a11y violations', async () => {
  const { container } = render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter><DashboardPage /></MemoryRouter>
    </SWRConfig>
  );
  await screen.findByRole('heading', { name: 'Dashboard' }); // wait for render
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

**Key notes:**
- Some page tests use a helper like `renderWithSWR`. That helper returns `render()` directly, so the axe test can either re-render inline (as above) or refactor the helper to return the `render()` result.
- Pages that don't use SWR can just `render(<MemoryRouter><Page /></MemoryRouter>)`.
- The `await screen.findByRole(...)` is needed for async pages (useSWR) to wait for data to resolve before testing a11y.
- For pages where `container` is needed but the existing render function doesn't return it, a simple inline render is preferred over refactoring the helper.

### Anti-Patterns to Avoid

- **Anti-pattern: Adding the axe import without checking existing imports.** Some page tests already import from vitest-axe (none currently do for pages, but Layout/Topbar/Sidebar do in `src/components/`). Ensure the import is added consistently.
- **Anti-pattern: Running `axe()` before the page has rendered async data.** Pages with `useSWR` render a loading skeleton first, then the real content. The axe assertion must wait for the data to resolve (`await screen.findByRole(...)` or `await waitFor(...)`).
- **Anti-pattern: Disabling axe rules for real violations.** If a violation is found, fix the production code. Only disable rules for legitimate false positives (e.g., Radix UI portals in jsdom). Follow Phase 16 precedent: fix violations, don't suppress.
- **Anti-pattern: Using `navigator.onLine` mock that interferes with axe.** Pages testing offline mode may set `navigator.onLine = false`. The axe test must restore the original value or run in a separate `it()` block.
- **Anti-pattern: `npm ci` on the monorepo root.** The CI workflow uses `working-directory: kapwa-client` for all steps. `npm ci` runs inside `kapwa-client/` where `package.json` and `package-lock.json` live.
- **Anti-pattern: Pinning actions to `@v4` without a commit SHA in production repos.** For this project, `@v4` is acceptable (per the project's existing pragmatism). But the pinned tag `@v4` is recommended for reproducibility.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CI pipeline | Custom shell script runner | `actions/checkout@v4` + `actions/setup-node@v4` + `npm ci` + `vitest run` | Standard GitHub Actions patterns; edge cases (parallel matrix, artifact upload, timeout) are handled by the Actions runtime. |
| WCAG violation detection | Custom ARIA lint rules | `axe(container)` from `vitest-axe` | axe-core implements 80+ WCAG rules with edge-case handling. Already wired in Phase 16. |
| Token rotation loop-breaking | Custom state machine in the auth refresh | Already implemented in `api.ts:80-117` (single-flight `refreshInFlight` Promise, clears tokens + dispatch `kapwa:auth:logout` on failure) | SEC-01 is already done in code. Phase 17 documents it. |
| Coverage HTML report hosting | Custom HTML viewer | `actions/upload-artifact@v4` | Artifacts are downloadable from the Actions run page. No external service needed. |

**Key insight:** SEC-01 is already fully implemented and verified (api.ts lines 80-117). Phase 17 only needs to document it in SECURITY.md and add manual test steps. Do NOT modify api.ts.

## Common Pitfalls

### Pitfall 1: `coverage:check` script is identical to `coverage`

**What goes wrong:** `npm run coverage:check` currently runs `vitest run --coverage`, which is the same as `npm run coverage`. Both run coverage and check the threshold. If the threshold is not met, vitest exits with non-zero.

**Why it happens:** Both scripts in `package.json` have the same value (`vitest run --coverage`). This works for CI because vitest enforces the threshold and exits non-zero on failure.

**How to avoid:** The CI pipeline's `coverage` job runs `npm run coverage:check`. If the threshold is met (70% perFile on 5 lib modules), the job passes and the artifact is uploaded. If not, the job fails. This is correct behavior.

**Warning signs:** If coverage dips below 70% on any of the 5 modules (api, api-error, auth-context, offline-queue, secure-storage), CI fails. The page tests do NOT affect coverage thresholds (pages are not in the coverage include glob).

### Pitfall 2: axe in jsdom misses some real-browser violations

**What goes wrong:** `axe(container)` in jsdom may report false positives for Radix UI/Dialog components (CSS-dependent rules like color contrast) or miss violations that require a real rendering engine.

**Why it happens:** jsdom doesn't render CSS. Axe rules that depend on computed styles (color-contrast, target-size) may not trigger or may give incorrect results.

**How to avoid:** If a violation seems suspicious (e.g., color-contrast in jsdom), verify by running the page in a real browser with axe DevTools or `@axe-core/playwright` (already in devDeps). Phase 16 handled this with Radix Sheet dialog — same approach applies.

**Warning signs:** An axe rule about `color-contrast`, `target-size`, or `css-text` in jsdom should be verified in a real browser before treating as a real violation.

### Pitfall 3: `actions/upload-artifact@v4` path is relative to repository root

**What goes wrong:** The `path` in `upload-artifact@v4` is relative to the repository root, NOT to `working-directory`. If the workflow sets `working-directory: kapwa-client`, the coverage output is at `kapwa-client/coverage/`, not `coverage/`.

**Why it happens:** GitHub Actions `run` steps use `working-directory` for shell execution, but action inputs like `path` are always relative to the repository root.

**How to avoid:** Use `path: kapwa-client/coverage/` in the upload-artifact step, not `path: coverage/`.

**Warning signs:** If the artifact upload step shows "No files found", check the path prefix.

### Pitfall 4: Pages with different render patterns need different axe integration approaches

**What goes wrong:** Some page tests have a `renderWithSWR()` helper that doesn't return the container; some use `screen.findByRole()` exclusively.

**Why it happens:** Tests were written by different authors or for different scenarios. Not all return `container`.

**How to avoid:** The simplest approach is to add a new `it('has no a11y violations')` test that renders inline (returning `container`). For pages that already use `container` in snapshot tests, reuse the existing render call. Do NOT refactor existing tests to return container — axe is additive.

**Warning signs:** If refactoring the render helper breaks an existing test, the axe test should not be entangled with it.

### Pitfall 5: Tailwind v4 CSS layer means coverage HTML may have unstyled output

**What goes wrong:** The coverage HTML report is generated by `@vitest/coverage-v8` which uses `c8`/`v8` and produces a static HTML report. This report is NOT styled by Tailwind (it uses its own CSS). This is fine — no Tailwind dependency issue.

**Why it happens:** The coverage report is a separate concern. V8's `coverage/` directory contains `index.html` and JS files that render the coverage table. It's self-contained.

**How to avoid:** No action needed. The uploaded `coverage/` artifact is already self-contained HTML.

## Code Examples

All examples follow patterns verified in the existing codebase.

### Example 1: Complete CI Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

defaults:
  run:
    working-directory: kapwa-client

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run test:run

  coverage:
    needs: test
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run coverage:check
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-report
          path: kapwa-client/coverage/
          retention-days: 30

  build:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
```

### Example 2: SECURITY.md Structure

```markdown
# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | ✅ |

## Security Architecture

### Authentication
Kapwa uses JWT bearer tokens with the following characteristics:
- **Access token:** 1 hour expiry, stored in `localStorage` as `kapwa_token`
- **Refresh token:** 7 day expiry, stored in `localStorage` as `refresh_token`
- **Token refresh:** Automatic single-flight refresh via the API client interceptor

### Authorization (ABAC)
Attribute-Based Access Control (ABAC) is enforced on every protected endpoint.
Roles: `admin`, `social_worker`, `intake_officer`, `auditor`, `barangay_coordinator`, `claimant`.

### 401 Single-Flight Refresh Flow
```
Client                          API Server
  |                                |
  |--- GET /api/resource --------->|  (with expired Bearer token)
  |<-- 401 Unauthorized -----------|
  |                                |
  |--- POST /api/auth/refresh ---->|  (deduplicated: single-flight)
  |<-- { accessToken, ... } -------|
  |                                |
  |--- GET /api/resource (retry) ->|  (with new Bearer token)
  |<-- 200 OK ---------------------|
```

If the refresh endpoint itself returns 401, the interceptor:
1. Clears `kapwa_token` and `refresh_token` from `localStorage`
2. Dispatches a `kapwa:auth:logout` CustomEvent
3. The auth context listener redirects to `/login`

### Threat Model

| Threat | Mitigation |
|--------|------------|
| Replay attack | Short-lived access token (1h), HTTPS-only |
| CSRF | SPA with SameSite cookies not used; Bearer tokens in Authorization header (not cookies) |
| XSS via token theft | Tokens in `localStorage` (no httpOnly option in SPA); mitigate via CSP + input sanitization |
| MITM on refresh endpoint | HTTPS enforced; no certificate pinning (defer to Phase 18) |

## Manual Verification (SEC-01)

1. Log in to the application with valid credentials
2. Wait 61 minutes (or manipulate system clock) for the access token to expire
3. Navigate to any protected page
4. Observe the page loads without showing a login prompt — the refresh flow fires
5. Open DevTools → Network tab: verify `POST /api/auth/refresh` was called automatically
6. Verify all subsequent requests use the new access token

## Integration Test Coverage

The 401 refresh flow is covered in `kapwa-client/src/lib/__tests__/api.test.ts:82-143`.
Tests verify: single-flight deduplication, successful refresh retries original request,
failed refresh clears tokens and dispatches logout event.

## Reporting a Vulnerability

Please report security vulnerabilities through GitHub Private Vulnerability Reporting
for this repository. Do not open public GitHub issues for security concerns.

When reporting, include:
- The affected version, tag, or commit SHA
- A description of the issue and why you believe it is security-sensitive
- Steps to reproduce or a proof of concept
- The potential impact

You can expect an acknowledgment within 5 business days.
```

### Example 3: Adding axe Assertion to a Page Test (DashboardPage)

```tsx
// File: src/pages/DashboardPage.test.tsx (ADDITIONS shown)

// ADD import at top:
import { axe } from 'vitest-axe';

// ADD new test inside describe('DashboardPage'):
it('has no a11y violations', async () => {
  mockApiGet.mockResolvedValue(mockDashboardData);
  const { container } = render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter><DashboardPage /></MemoryRouter>
    </SWRConfig>
  );
  await screen.findByRole('heading', { name: 'Dashboard' });
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Example 4: axe Assertion for Simple Pages (no useSWR)

```tsx
// File: src/pages/ContactPage.test.tsx (ADDITIONS shown)

// ADD import:
import { axe } from 'vitest-axe';

// ADD new test:
it('has no a11y violations', async () => {
  const { container } = render(
    <MemoryRouter><ContactPage /></MemoryRouter>
  );
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Example 5: Fixing axe Violations (follow Phase 16 precedent)

Phase 16 fixed 3 violations in Sidebar.tsx, BottomNav.tsx, Topbar.tsx. The same pattern applies to page-level violations:

```tsx
// Common fixes:
// 1. Add ARIA labels to icon buttons:
<button aria-label="Close dialog" onClick={...}>
  <X size={20} />
</button>

// 2. Fix heading hierarchy (h1→h2→h3, no skipping):
<h2 className="text-lg font-semibold">Section Title</h2>

// 3. Add `aria-hidden` to decorative icons:
<X size={20} aria-hidden="true" />

// 4. Ensure form inputs have associated labels:
<label htmlFor="search-input">Search</label>
<input id="search-input" type="search" />
```

**Process:** Run axe on a page test → identify the violation rule + CSS selector → fix the production .tsx file → re-run the test → commit.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No CI pipeline | `.github/workflows/ci.yml` with 3 jobs | Phase 17 (17-01) | Automated testing, coverage, and build on every push/PR. |
| No SECURITY.md | `SECURITY.md` documenting auth, threat model, reporting | Phase 17 (17-01) | Standard GitHub security policy; enables Private Vulnerability Reporting. |
| axe-only-on-components | axe on all 28 page tests | Phase 17 (17-02/17-03) | TST-07: a11y CI gate on every page. |
| SEC-01 implemented but undocumented | SEC-01 documented with diagram, manual test steps, test coverage reference | Phase 17 (17-01) | Security architecture is discoverable and verifiable. |

**Deprecated/outdated:**
- **SEC-01 being "new code":** The 401 single-flight refresh interceptor was implemented in Phase 14 (`api.ts:80-117`). Phase 17 only adds documentation, not code.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Page test files are alphabetically ordered such that a 14/14 split is clean and each plan touches reasonably different pages. | Plan 17-02/17-03 split | If the split puts two pages with the same complex axe-violation pattern in one plan, the plan's effort estimate could be off. Mitigation: Verify the split at the start of each plan. |
| A2 | All 28 page tests currently pass (66 files, 314 tests) and adding axe assertions does not break existing assertions. | Pattern 3 | If a page test is already borderline (flaky timeout, unstable SWR mock), adding axe may surface a pre-existing issue. Mitigation: Each plan tests its batch sequentially — fix page issues first, then add axe. |
| A3 | `actions/upload-artifact@v4` can accept `path: kapwa-client/coverage/` with the relative-to-root convention. | Pattern 1 | If the path is wrong, the artifact won't upload. Mitigation: Verify in a PR before merging to main. |
| A4 | The existing `npm run coverage:check` script exits non-zero when thresholds fail, which is correct for CI. | Pitfall 1 | If vitest --coverage always exits 0 regardless of thresholds (unexpected behavior), CI passes even with insufficient coverage. Mitigation: Test the CI workflow with a deliberate threshold violation before finalizing. |
| A5 | No `.github/` directory existed before this phase (confirmed by `ls -la`). | Structure | If another branch or tool created `.github/`, the CI workflow file placement conflicts. Mitigation: Create `.github/workflows/` directory fresh. |

## Open Questions

1. **Should the coverage job fail the pipeline if threshold isn't met?**
   - What we know: vitest --coverage exits non-zero when thresholds are breached. The `coverage` job depends on `test` passing.
   - What's unclear: Should the coverage job block the build job? Currently `build` runs in parallel with `coverage` (not dependent), so coverage failure does not block build success. This is intentional — you still get a build artifact even if coverage dips.
   - Recommendation: Keep the current design (coverage depends on test, build is parallel). Coverage failure is informational via the artifact.

2. **Should the CI pipeline run on push to any branch, or only main?**
   - What we know: Workflow triggers on `push: [main]` and `pull_request: [main]`.
   - What's unclear: Whether feature branches need CI feedback before creating a PR.
   - Recommendation: The `pull_request: [main]` trigger covers the common case. `push: [main]` protects the main branch. This is standard.

3. **Should axe violation fixes be identified per-page before splitting into 17-02/17-03?**
   - What we know: Phase 16 found violations in Layout/Topbar/Sidebar and fixed them. Pages likely have fewer Radix interactions (most are form pages or data tables).
   - What's unclear: How many page-level violations exist. Some pages use `JsonSchemaForm` (ProgramsPage), `Shadcn DataTable` (AdminPage), or custom styling that may trigger axe rules.
   - Recommendation: 17-02 should document any violations found in its 14 pages as a guide for 17-03. If 17-02 finds zero violations, 17-03 is likely zero too.

4. **Should SECURITY.md be placed in the project root or in kapwa-client/?**
   - What we know: GitHub looks for `SECURITY.md` in the root of the repository, `.github/`, or `docs/`.
   - Recommendation: Place in the root (`/home/typwtypw/Documents/NC/THESIS1-KAPWA/SECURITY.md`) — this is the standard location GitHub detects for the community health file.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | CI pipeline | ✓ (local) | v26.4.0 | CI uses Node 20 LTS |
| npm | CI pipeline | ✓ | 11.16.0 | CI uses npm from setup-node |
| Git | CI pipeline | ✓ | (system) | — |
| GitHub Actions | CI pipeline | ✓ (GitHub) | — | No local fallback needed |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

> Required — `workflow.nyquist_validation` is `true` in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.10 |
| Config file | Inline in `kapwa-client/vite.config.ts` (test section) |
| Quick run command | `npm run test:run` (from kapwa-client/) |
| Full suite command | `npm run coverage:check` (from kapwa-client/) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TST-07 | CI pipeline fails on a11y violations | CI/infrastructure | CI workflow: `npm run test:run` inside GitHub Actions | ✅ (workflow created in 17-01) |
| TST-07 | axe-core runs on page tests (TST-06 pages) | Unit (a11y) | `npx vitest run src/pages/DashboardPage.test.tsx -t "no a11y violations"` | ✅ (test files modified in 17-02/17-03) |
| SEC-01 | 401 single-flight refresh documented | Documentation | Manual test steps in SECURITY.md | ✅ (SECURITY.md created in 17-01) |
| SEC-01 | Token refresh 401 breaks the loop | Unit (existing) | `npx vitest run src/lib/__tests__/api.test.ts -t "refresh"` | ✅ (Phase 15 tests, api.test.ts:82-143) |
| TST-06 | All 28 pages smoke-test | Unit (existing) | `npx vitest run src/pages/` | ✅ (Phase 16 test files) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/pages/<affected-page>.test.tsx -t "no a11y violations"`
- **Per wave merge:** `npx vitest run src/pages/` (all page smoke tests)
- **Phase gate:** Full suite green (`npm run test:run`), CI workflow runs successfully on GitHub

### Wave 0 Gaps
- [ ] `.github/workflows/ci.yml` — CI pipeline workflow file (Plan 17-01)
- [ ] `SECURITY.md` — Security documentation (Plan 17-01)
- [ ] `src/pages/` modified test files — 28 files get +axe assertion (Plans 17-02/17-03)

*(All gaps are NEW files or test additions — no pre-existing gaps to fill)*

## Security Domain

> Required — `security_enforcement` is `true` in `.planning/config.json`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | JWT bearer tokens (1h access + 7d refresh), single-flight refresh interceptor |
| V3 Session Management | Yes | Token rotation on refresh, localStorage storage, logout event clears tokens |
| V4 Access Control | Yes | ABAC role-based enforcement on API endpoints |
| V5 Input Validation | Minimal | Zod schemas validated server-side; client uses Zod v4 |
| V6 Cryptography | No | Server-side bcrypt; client only handles token management (no crypto operations in Phase 17 scope) |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Replay attack via stolen access token | Spoofing | 1h short-lived window; token refresh required after expiry |
| CSRF via API call from another origin | Tampering | Bearer token in Authorization header (not cookie-based auth) — CSRF not applicable |
| XSS extracting token from localStorage | Information Disclosure | Content-Security-Policy headers; input sanitization via React's auto-escaping |
| MITM on /auth/refresh endpoint | Tampering | HTTPS-only; refresh failure clears all tokens and redirects to /login (loop-breaking) |

**Security notes for Phase 17:**
- SEC-01 is already implemented in `api.ts:80-117`. Phase 17 only documents it.
- All CI pipeline tokens and secrets: None needed. The pipeline only runs tests and builds — no deployment, no API keys, no token management.
- SECURITY.md documents the existing security architecture, not new code.

## Sources

### Primary (HIGH confidence)
- **Project codebase** — All package versions, test patterns, auth flow verified on disk at `kapwa-client/`
- **actions/checkout@v4** — [CITED: github.com/actions/checkout](https://github.com/actions/checkout)
- **actions/setup-node@v4** — [CITED: github.com/actions/setup-node](https://github.com/actions/setup-node)
- **actions/upload-artifact@v4** — [CITED: github.com/actions/upload-artifact](https://github.com/actions/upload-artifact)
- **GitHub SECURITY.md conventions** — [CITED: docs.github.com](https://docs.github.com/code-security/getting-started/adding-a-security-policy-to-your-repository)
- **vitejs/vite CI workflow reference** — [CITED: github.com/vitejs/vite](https://github.com/vitejs/vite/blob/HEAD/.github/workflows/ci.yml)
- **vitest-axe 0.1.0** — [VERIFIED: npm registry] via `node_modules/vitest-axe/` + `package.json`

### Secondary (MEDIUM confidence)
- **Phase 16 RESEARCH.md** — Quoted extensively for context (axe patterns, D-03 no-cache decision, project constraints)
- **artifact.ci vitest coverage upload pattern** — [CITED: artifact.ci/recipes/testing/vitest](https://artifact.ci/recipes/testing/vitest)

### Tertiary (LOW confidence)
- None — all critical claims are either verified from the codebase, official docs, or previously-researched phase artifacts.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All packages verified on disk, all CI actions from official sources
- Architecture: HIGH — All patterns derived from existing codebase state (verified 66 passing files)
- Pitfalls: HIGH — Based on direct observation of existing test patterns and project-specific edge cases
- Security: HIGH — SEC-01 verified on disk; SECURITY.md follows GitHub standard template

**Research date:** 2026-07-08
**Valid until:** 2026-08-08 (30 days — stable for CI + documentation content; faster-moving for vitest-axe if new version released)
