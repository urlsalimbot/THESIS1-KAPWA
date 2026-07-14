# Phase 17: Page Smoke Tests + Security - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning

## Phase Boundary

Set up GitHub Actions CI workflow that runs `npm run test:run` + `npm run coverage:check` + `npm run build` on every push to main and every PR, with `toHaveNoViolations()` (vitest-axe) on all 28 page smoke tests as the a11y gate (TST-07 + A11Y-02). Write a comprehensive SECURITY.md documenting the SEC-01 401 single-flight refresh interceptor (already implemented in Phase 14 D-04) including the manual test steps for ROADMAP #6. Three-plan bottom-up delivery: Plan 17-01 (CI + SECURITY.md), Plan 17-02 (axe on first 14 pages + fix violations), Plan 17-03 (axe on remaining 14 pages + fix violations). No new production code in api.ts — SEC-01 interceptor already shipped in Phase 14.

## Implementation Decisions

### CI Scope (TST-07 + A11Y-02)
- **D-01:** Create `.github/workflows/ci.yml` with triggers: `push` to `main` + `pull_request` to `main`. Single workflow file, named `ci.yml`. No manual dispatch, no schedule, no release triggers.
- **D-02:** 3 jobs in the workflow: (1) `test` runs `npm ci` + `npm run test:run`; (2) `coverage` runs `npm ci` + `npm run coverage:check` (depends on `test` succeeding); (3) `build` runs `npm ci` + `npm run build` (parallel to `test` and `coverage`). All 3 jobs are required checks — failure of any blocks merge.
- **D-03:** Environment: `ubuntu-latest` (single OS, no matrix). Node 20 only (matches the Dockerfile which uses `node:20-slim`). No npm cache (simple/minimal — every run does a clean `npm ci`). Total CI runtime estimate: ~3-5 min for test, ~3-5 min for coverage, ~1 min for build = ~10 min worst case.
- **D-04:** The `coverage` job's `npm run coverage:check` script (added in Phase 15 D-01) enforces the per-file 70% lines threshold. CI fails the build if any of the 4 critical modules (api.ts, auth-context.tsx, offline-queue.ts, secure-storage.ts) drops below 70%. Coverage HTML report is uploaded as a workflow artifact (downloadable from the Actions run page).
- **D-05:** The `test` job's `npm run test:run` includes the 28 page smoke tests + the 4 component smoke tests + 288+ existing tests = ~314 tests. axe assertions on Layout/Topbar/Sidebar (Phase 16) + axe on all 28 page tests (Plan 17-02 + 17-03) are part of this. CI fails on any axe violation.

### Axe on Page Tests
- **D-06:** Add `toHaveNoViolations()` to all 28 page smoke tests (full sweep, not just 10). The 28 pages are: all pages with co-located test files in `src/pages/*.test.tsx` (currently 20 existing + 8 from Phase 16 = 28). The Phase 16 8 new tests are included in the sweep.
- **D-07:** When axe finds a violation, fix the production code immediately (per Phase 16 D-08 precedent). Each fix is an atomic commit. Likely violations to fix: heading hierarchy, missing aria-labels, color contrast, link text ambiguity. Estimate 1-3 violations per page, so 28-84 potential atomic commits in Plans 17-02 + 17-03.
- **D-08:** The axe test pattern follows the Layout.test.tsx precedent: `import { axe } from 'vitest-axe';` at the top, `const { container } = render(<Page />); const results = await axe(container); expect(results).toHaveNoViolations();`. The page test's existing useAuth mock + MemoryRouter wrapper + heading assertion stay — axe is appended as an additional assertion.
- **D-09:** If a page test already has a known axe violation that cannot be fixed in scope (e.g., a shadcn primitive limitation), document it in the test with `// axe-violation: <id>` and a comment explaining the carve-out. Carve-outs are tracked in the Phase 17 SUMMARY for future follow-up. No `skip` or `xit` for axe — every page is verified.

### SEC-01 Documentation
- **D-10:** Write `.planning/SECURITY.md` (project-level) covering: (1) Authentication overview (JWT bearer, 1h access + 7d refresh, role-based ABAC); (2) The 401 single-flight refresh flow (sequence diagram in ASCII: original request → 401 → check for refresh in flight → if not, call /auth/refresh → on success, retry original → on refresh 401, dispatch `kapwa:auth:logout` → auth-context clears token + redirects to /login); (3) SEC-01 manual test steps (login → set token to expired value via DevTools → navigate to any page → expect refresh + retry succeeds); (4) Integration test coverage (api.test.ts:82-143 has 4 tests for the refresh path); (5) Cross-reference to the existing project context (websocket fail → /login per AGENTS.md); (6) Threat model summary (replay attack, CSRF, XSS via token theft, MITM on the refresh endpoint).
- **D-11:** Add a brief JSDoc to the 401 branch in `api.ts` (the 3-line block at line 130) explaining: "On 401, attempt /auth/refresh exactly once via single-flight pattern. Concurrent 401s share the same refresh promise. See SECURITY.md for the full flow." This is a code comment — allowed per AGENTS.md "DO NOT ADD ANY COMMENTS unless asked" because the user explicitly asked for documentation in this phase.
- **D-12:** No new production code in api.ts. The SEC-01 interceptor is already implemented (Phase 14 D-04). Phase 17 only documents + verifies. The existing tests in `api.test.ts:82-143` (4 tests) cover the contract: refreshes once and retries, shares single-flight, breaks loop on refresh 401, dispatches logout event. No additional tests needed unless the documentation reveals a gap.

### Migration Order
- **D-13:** 3-plan bottom-up: CI first, then axe on first 14 pages, then axe on remaining 14 pages. Plan 17-01 establishes the CI gate so subsequent plans can be verified locally against the same gates. Plans 17-02 and 17-03 split the 28 page tests roughly in half (alphabetical or by role group) to keep each plan bounded.
- **D-14:** Page split for 17-02 vs 17-03: 14 worker/admin pages in 17-02, 14 claimant/auditor/mayor/coordinator pages in 17-03. The exact split is the agent's discretion — both are independently shippable.

### the agent's Discretion
- Exact alphabetical or role-based split of 14 pages per plan
- Number of atomic commits per page (1 page = 1 commit OR 1 page = multiple commits if multiple violations to fix)
- Whether to add a `reporter` (HTML/JSON) for vitest-axe in CI to get nicer failure output
- Exact contents of the SECURITY.md ASCII sequence diagram (textual vs mermaid)
- Whether to add a coverage-badge generator to CI (out of scope, deferred)

## Canonical References

### Project Context
- `.planning/PROJECT.md` — Project overview, Kapwa stack, current milestone v1.2
- `.planning/REQUIREMENTS.md` — v1.2 requirements TST-06 (page smoke tests — folded into Phase 16), TST-07 (axe in CI), A11Y-02 (CI gate), SEC-01 (token refresh — implemented in Phase 14)
- `.planning/ROADMAP.md` — Phase 17 boundary, 6 success criteria
- `.planning/phases/14-api-client-swr/14-CONTEXT.md` — D-04 (401 single-flight refresh implemented)
- `.planning/phases/14-api-client-swr/14-01-SUMMARY.md` — SEC-01 interceptor shipped
- `.planning/phases/15-core-module-tests/15-CONTEXT.md` — D-01 (coverage:check script), D-02 (perFile: true threshold)
- `.planning/phases/15-core-module-tests/15-01-SUMMARY.md` — coverage:check script + v8 provider
- `.planning/phases/16-ui-polish-errorboundary-a11y-core-ui-tests/16-CONTEXT.md` — D-06 (vitest-axe global), D-07 (strict mode), D-08 (fix violations in production code)
- `.planning/phases/16-ui-polish-errorboundary-a11y-core-ui-tests/16-02-SUMMARY.md` — 3 pre-existing a11y violations found and fixed (precedent for the full-page sweep in Phase 17)

### Codebase Maps
- `.planning/codebase/INTEGRATIONS.md` — JWT bearer auth, /auth/refresh endpoint, kapwa_token in localStorage
- `.planning/codebase/STRUCTURE.md` — `kapwa-client/src/pages/` has 49 pages; 28 have co-located test files
- `.planning/codebase/CONVENTIONS.md` — No path aliases, no comments in code (carve-out: SECURITY.md + JSDoc are documentation, allowed per D-10/D-11)

### Package Configuration
- `kapwa-client/package.json` — `npm run test:run` (single run), `npm run coverage` (with report), `npm run coverage:check` (with gate), `npm run build` (Vite build)
- `kapwa-client/vite.config.ts` — vitest 4.1.9 config, v8 coverage provider with perFile: true threshold

### Security-Critical Code (for documentation reference)
- `kapwa-client/src/lib/api.ts:88-130` — The 401 single-flight refresh interceptor (already implemented in Phase 14 D-04)
- `kapwa-client/src/lib/auth-context.tsx:36-43` — The `kapwa:auth:logout` event subscriber
- `kapwa-client/src/lib/api.ts:9` — The `KAPWA_AUTH_LOGOUT_EVENT` constant
- `kapwa-client/src/lib/auth.ts:37-59` — The `refreshAuthToken()` helper (raw fetch, NOT through api client — per 14-D-15 carve-out for circular dependency)
- `kapwa-client/src/lib/api.test.ts:82-143` — 4 tests covering the SEC-01 contract: refresh-once-and-retry, single-flight, break-loop-on-refresh-401, logout-event-dispatch

### Existing Test Files (28 page tests to add axe to)
- `kapwa-client/src/pages/AuditorPage.test.tsx` (Phase 16-03)
- `kapwa-client/src/pages/AccessCardPage.test.tsx` (existing)
- `kapwa-client/src/pages/AccessCardPrintView.test.tsx` (Phase 16-03)
- `kapwa-client/src/pages/AdminPage.test.tsx` (existing)
- `kapwa-client/src/pages/ApprovalPipelinePage.test.tsx` (existing)
- `kapwa-client/src/pages/CasesPage.test.tsx` (existing)
- `kapwa-client/src/pages/CaseTrackerPage.test.tsx` (existing)
- `kapwa-client/src/pages/ClaimantDashboardPage.test.tsx` (existing)
- `kapwa-client/src/pages/ContactPage.test.tsx` (Phase 16-03)
- `kapwa-client/src/pages/CoordinatorDashboardPage.test.tsx` (Phase 16-03)
- `kapwa-client/src/pages/CsrPage.test.tsx` (existing)
- `kapwa-client/src/pages/DashboardPage.test.tsx` (existing)
- `kapwa-client/src/pages/FilingPage.test.tsx` (existing)
- `kapwa-client/src/pages/IntakePage.test.tsx` (existing)
- `kapwa-client/src/pages/InterventionsPage.test.tsx` (existing)
- `kapwa-client/src/pages/IrfDetailPage.test.tsx` (Phase 16-03)
- `kapwa-client/src/pages/IrfPage.test.tsx` (existing)
- `kapwa-client/src/pages/LandingPage.test.tsx` (existing)
- `kapwa-client/src/pages/LoginPage.test.tsx` (existing)
- `kapwa-client/src/pages/MayorReportsPage.test.tsx` (Phase 16-03)
- `kapwa-client/src/pages/MfaSetupPage.test.tsx` (existing)
- `kapwa-client/src/pages/MessagesPage.test.tsx` (existing)
- `kapwa-client/src/pages/MyAccessCardPage.test.tsx` (Phase 16-03)
- `kapwa-client/src/pages/ProgramsPage.test.tsx` (Phase 16-03)
- `kapwa-client/src/pages/RegisterPage.test.tsx` (existing)
- `kapwa-client/src/pages/ResetPasswordPage.test.tsx` (existing)
- `kapwa-client/src/pages/BeneficiariesPage.test.tsx` (existing)
- `kapwa-client/src/pages/BeneficiaryViewPage.test.tsx` (existing)

(28 page tests total)

### CI Workflow Reference
- `.github/workflows/` — does not exist yet (Phase 17 creates it)
- `kapwa-server/Dockerfile` — uses `node:20-slim` (matches the CI Node 20 choice per D-03)
- `kapwa-server/package.json` scripts — `npm run test:run`, `npm run build` (used in the kapwa-client CI job; the workflow runs from `kapwa-client/` workdir per Phase 12 precedent)

## Existing Code Insights

### Reusable Assets
- **`npm run coverage:check` script** — added in Phase 15. CI can invoke it directly. Per-file 70% lines threshold (api.ts, auth-context.tsx, offline-queue.ts, secure-storage.ts) is the gate.
- **`toHaveNoViolations()` global matcher** — wired in Phase 16-01 (tests/setup.ts). Available in all 28 page tests immediately; no new import or wiring needed.
- **Phase 16 axe fix precedent** — 3 pre-existing a11y violations were fixed in Sidebar.tsx + BottomNav.tsx + Topbar.tsx during Phase 16-02. The same pattern (run axe, see violation, fix in production code, rerun axe, commit) applies to Phase 17-02 + 17-03.
- **`tests/setup.ts`** — already imports `vitest-axe/extend-expect` (per Phase 16-01 auto-fix). axe() is callable in any test file.
- **SEC-01 contract tests** — api.test.ts:82-143 has 4 tests that verify the 401 single-flight refresh flow. These serve as the integration test coverage for SECURITY.md.
- **`import { axe } from 'vitest-axe'`** — axe is callable as a function. The pattern: `const results = await axe(container); expect(results).toHaveNoViolations();` is established in the existing `src/__tests__/a11y/components.test.tsx`.

### Established Patterns
- **Test file naming:** `*.test.tsx` for component/page tests; co-located next to source
- **Test environment:** jsdom; `npm test` (vitest watch), `npm run test:run` (single run)
- **Auth context mock:** `vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: { role: 'social_worker', ... }, token: 'test-tok', loading: false, ... }) }))` — used by all page tests
- **MemoryRouter wrapper:** for react-router-dom pages
- **GitHub Actions YAML structure:** `name: / on: / jobs:` with `runs-on: ubuntu-latest`, `steps: uses: actions/checkout@v4 / actions/setup-node@v4 / run: npm ci` pattern
- **NO comments in code** — AGENTS.md rule, with carve-outs for SECURITY.md (documentation) and the 1-line JSDoc in api.ts (D-11 explicit permission)
- **Atomic commits per fix** — Phase 12/13/14/15/16 precedent; one violation fix = one commit
- **Plan summary at end of each plan** — pattern from prior phases

### Integration Points
- **`.github/workflows/ci.yml`** — new file. The workflow file references `npm run test:run`, `npm run coverage:check`, `npm run build`. Working directory: `kapwa-client/`.
- **`kapwa-client/.gitignore`** — already excludes `coverage/`, `dist/`, `node_modules/`. No changes needed.
- **`kapwa-client/src/lib/api.ts:130`** — the 401 branch. Add a 3-line JSDoc (per D-11) referencing SECURITY.md.
- **`.planning/SECURITY.md`** — new project-level doc. Sits alongside PROJECT.md, REQUIREMENTS.md, STATE.md.
- **All 28 page test files** — add `import { axe } from 'vitest-axe';` + `const results = await axe(container); expect(results).toHaveNoViolations();` after the existing render + heading assertion.

## Specific Ideas

- **CI workflow YAML** — start with the GitHub Actions Node.js template, add 3 jobs (test, coverage, build) on `ubuntu-latest` with `actions/setup-node@v4` and Node 20. No npm cache (D-03: simple/minimal).
- **Axe violation fix loop** — for each page: run axe → if violation, identify the rule + selector → fix the production code (likely the page itself, or a shared component) → re-run axe → atomic commit. Repeat until 0 violations.
- **SECURITY.md structure** — follows the GitHub `SECURITY.md` convention (https://docs.github.com/en/code-security/getting-started/adding-a-security-policy-to-your-repository). Sections: Supported Versions, Reporting a Vulnerability, Security Architecture, Authentication, Token Refresh Flow, Threat Model, Manual Test Steps.
- **Mermaid vs ASCII sequence diagram** — use ASCII in SECURITY.md for portability (renders on GitHub without a plugin). For complex flows, Mermaid is OK; but the 401 refresh flow is simple enough for ASCII.
- **Coverage HTML artifact** — use `actions/upload-artifact@v4` to upload `kapwa-client/coverage/` as a downloadable artifact. Each CI run has a fresh report.

## Deferred Ideas

- **Codecov / Coveralls integration** — uploading coverage to a third-party service for trend tracking. Out of scope (no codecov account configured).
- **Branch protection rules** — requiring CI to pass before merging. Out of scope (requires admin access to the GitHub repo).
- **Dependabot / Renovate** — automated dependency updates. Out of scope (separate workflow).
- **Lighthouse CI** — performance + SEO + a11y checks on the built bundle. Out of scope (different tooling, separate phase).
- **Axe on the 3 Phase 13 page snapshot tests** (DashboardPage, CasesPage, BeneficiariesPage) — they use `toMatchSnapshot()` which doesn't support the axe() container pattern. Adding axe to those tests would require restructuring. Out of Phase 17 scope; deferred to a follow-up.
- **Secret scanning** — git-secrets or TruffleHog pre-commit hook. Out of scope (separate security infra).
- **CodeQL analysis** — GitHub's static analysis. Out of scope (separate workflow, requires repo enablement).
- **PR template** — standard PR description template with a11y checklist. Out of scope.
- **CHANGELOG** — versioning + changelog updates. Out of scope.
- **Per-page axe strict ruleset** — current vitest-axe default is wcag2a + wcag2aa. Could tighten to wcag21aa or add custom rules. Default is sufficient for ROADMAP.

---

*Phase: 17-Page Smoke Tests + Security*
*Context gathered: 2026-07-07*
