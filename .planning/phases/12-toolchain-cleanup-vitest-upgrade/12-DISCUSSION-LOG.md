# Phase 12: Toolchain Cleanup & Vitest Upgrade - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-05
**Phase:** 12-toolchain-cleanup-vitest-upgrade
**Areas discussed:** Upgrade scope, Test file layout

---

## Upgrade Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Vitest only | Just vitest v1.2→v4, minimum risk | |
| Vitest + Testing Libs | vitest v4 + @testing-library/react + @testing-library/jest-dom | ✓ |

**User's choice:** Vitest + Testing Libs
**Notes:** Co-upgrade avoids double-testing. RTL v16 already installed and supports React 18||19 — no Phase 13 conflict.

---

### Version Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Latest versions | npm install vitest@latest @testing-library/react@latest @testing-library/jest-dom@latest | ✓ |
| Pinned versions | Pin to specific known-good versions | |
| You decide | Agent chooses optimal combo | |

**User's choice:** Latest versions
**Notes:** Track latest released versions, trusting that v4 is stable.

---

### Breakage Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Fix forward | Debug and adapt to v4 APIs, stay on latest | ✓ |
| Roll back | Revert entire upgrade block if any test fails | |
| Downgrade breaker | Suppress only the breaking package | |
| You decide | Agent decides based on what breaks | |

**User's choice:** Fix forward
**Notes:** Don't roll back — adapt tests to v4 APIs.

---

### Commit Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Same commit | Deps move + upgrade + npm install — atomic | ✓ |
| Separate commits | Dep move first, then upgrade | |

**User's choice:** Same commit
**Notes:** Atomic commit for clean rollback if needed.

---

## Test File Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Co-locate with source | src/pages/LoginPage.test.tsx beside LoginPage.tsx | ✓ |
| Keep separate tests/ | Keep current convention | |
| Hybrid — no migration | Keep existing tests/, add new co-located tests | |

**User's choice:** Co-locate with source
**Notes:** Follow vitest v4 recommended convention.

---

### Migration Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Move all now | All 31 existing test files co-located now | ✓ |
| New tests only | Only new tests go co-located | |
| Gradual migration | Move when files are touched in later phases | |

**User's choice:** Move all now
**Notes:** One migration pass for clean break.

---

### Orphan Test Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Keep e2e in tests/ | e2e and integration tests stay in tests/ dir | |
| Move everything | All tests moved to src/ | |
| Create __tests__/ dir | Orphan tests go to src/__tests__/ | ✓ |

**User's choice:** Create __tests__/ dir
**Notes:** e2e.test.ts and a11y tests that don't map 1:1 to source files.

---

### Include Patterns

| Option | Description | Selected |
|--------|-------------|----------|
| Update include patterns | src/**/*.test.{ts,tsx} + tests/**/*.test.ts | ✓ |
| Vitest auto-discover | Keep current patterns, let vitest discover | |
| You decide | Agent configures optimal pattern | |

**User's choice:** Update include patterns
**Notes:** Explicit patterns cover both co-located and e2e tests.

---

## Deferred Ideas

- **CI integration (GitHub Actions)** — Not in Phase 12 scope
- **Coverage thresholds** — Deferred to Phase 14-15
- **Full dependency audit** — Only 3 known misplaced deps in scope

---

*Discussion logged: 2026-07-05*
