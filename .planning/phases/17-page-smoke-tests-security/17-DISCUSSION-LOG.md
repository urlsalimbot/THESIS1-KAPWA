# Phase 17: Page Smoke Tests + Security - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-07
**Phase:** 17-Page Smoke Tests + Security
**Areas discussed:** CI scope (TST-07 + A11Y-02), Axe on page tests, SEC-01 documentation, Plan structure

---

## CI Scope (TST-07 + A11Y-02)

### Triggers (sub-question)

| Option | Description | Selected |
|--------|-------------|----------|
| push + PR to main | Standard gate. Most projects use this | ✓ |
| push to main only | Lighter CI load but no pre-merge check | |
| push + PR + manual dispatch | Most flexible | |

**User's choice:** push + PR to main
**Notes:** Standard gate. Triggers on push to main and on every PR. Manual dispatch and schedule triggers are out of scope.

### Jobs (sub-question)

| Option | Description | Selected |
|--------|-------------|----------|
| Test + coverage + build (3 jobs) | Standard CI triangle | ✓ |
| Test + coverage + build + lint | More thorough but eslint not currently configured | |
| Single test job | Simpler but no parallelization | |

**User's choice:** Test + coverage + build (3 jobs)
**Notes:** 3 jobs in parallel. coverage depends on test succeeding. Standard CI triangle.

### Environment (sub-question)

| Option | Description | Selected |
|--------|-------------|----------|
| ubuntu-latest + Node 20 + npm cache | Matches Dockerfile (Node 20 Slim). Single OS is faster | |
| Matrix: ubuntu + macOS + Node 20 + Node 22 | Catches cross-platform. Slower (4x CI minutes) | |
| ubuntu + Node 20 only (minimal) | Simplest but slower (no npm cache) | ✓ |

**User's choice:** ubuntu + Node 20 only (minimal)
**Notes:** Single env. No npm cache. ~10 min total CI time.

---

## Axe on Page Tests

| Option | Description | Selected |
|--------|-------------|----------|
| Top 10 most-visited worker pages | Dashboard, Cases, Beneficiaries, Intake, Interventions, etc. | |
| 10 pages across all 6 roles | Distributed coverage (worker/admin/auditor/mayor/coordinator/claimant) | |
| All 28 pages (full sweep) | Add axe to every page smoke test | ✓ |

**User's choice:** All 28 pages (full sweep)
**Notes:** Comprehensive. Catches every a11y regression. Estimated 1-3 violations per page = 28-84 atomic fix commits.

### Violation handling (sub-question)

| Option | Description | Selected |
|--------|-------------|----------|
| Fix all violations (Recommended) | Per Phase 16 D-08 precedent. Each fix is an atomic commit | ✓ |
| Report only, defer fixes | Log but don't fail. Faster but loses the gate | |

**User's choice:** Fix all violations (Recommended)
**Notes:** Same pattern as Phase 16 (3 violations found + fixed in Sidebar/BottomNav/Topbar). If a violation is a known carve-out (e.g., shadcn primitive limitation), document it in the test with a comment.

---

## SEC-01 Documentation

| Option | Description | Selected |
|--------|-------------|----------|
| Comprehensive test plan (Recommended) | SECURITY.md with flow diagram + manual test + integration test coverage + threat model | ✓ |
| Comment in api.ts only | Add inline JSDoc. Skip a separate doc | |
| Phase summary only | Reference existing tests + Phase 14 SUMMARY in Phase 17 SUMMARY | |

**User's choice:** Comprehensive test plan (Recommended)
**Notes:** Write `.planning/SECURITY.md`. Includes ASCII sequence diagram for the 401 single-flight refresh flow. References existing api.test.ts:82-143 integration tests. Cross-references the websocket fail → /login project context.

---

## Plan Structure

| Option | Description | Selected |
|--------|-------------|----------|
| 2 plans: CI, then axe sweep | Plan 17-01 = CI + SECURITY.md. Plan 17-02 = axe on all 28 + fixes | |
| 1 plan: everything together | Single atomic plan. Faster but bigger diff | |
| 3 plans: CI, axe, fixes | Plan 17-01 = CI + SECURITY.md. Plan 17-02 = axe on first 14 + fixes. Plan 17-03 = axe on remaining 14 + fixes | ✓ |

**User's choice:** 3 plans: CI, axe, fixes
**Notes:** Each plan is independently shippable. Plan 17-01 establishes the CI gate so Plans 17-02 + 17-03 can verify locally. The page split (14/14) is the agent's discretion (D-14).

---

## the agent's Discretion

The following are deferred to the agent:

- Exact alphabetical or role-based split of 14 pages per plan
- Number of atomic commits per page (1 page = 1 commit OR 1 page = multiple commits if multiple violations to fix)
- Whether to add a `reporter` (HTML/JSON) for vitest-axe in CI to get nicer failure output
- Exact contents of the SECURITY.md ASCII sequence diagram (textual vs mermaid)
- Whether to add a coverage-badge generator to CI (out of scope, deferred)

## Deferred Ideas

- **Codecov / Coveralls integration** — out of scope (no codecov account)
- **Branch protection rules** — out of scope (requires admin access)
- **Dependabot / Renovate** — out of scope (separate workflow)
- **Lighthouse CI** — out of scope (different tooling, separate phase)
- **Axe on the 3 Phase 13 page snapshot tests** — they use `toMatchSnapshot()` which doesn't support the axe() container pattern. Deferred to follow-up.
- **Secret scanning** — out of scope
- **CodeQL analysis** — out of scope
- **PR template** — out of scope
- **CHANGELOG** — out of scope
- **Per-page axe strict ruleset** — default wcag2a + wcag2aa is sufficient
