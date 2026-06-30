# Phase 12: Toolchain Cleanup & Vitest Upgrade - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning

## Phase Boundary

Clean 3 misplaced production dependencies (playwright, @capacitor/cli, esbuild → devDependencies) and upgrade vitest from v1.2.0 to v4 alongside @testing-library/react and @testing-library/jest-dom. Restructure test files from separate `tests/` directory to co-located `*.test.tsx` alongside source files (vitest v4 convention).

## Implementation Decisions

### Upgrade Scope
- **D-01:** Co-upgrade to latest versions: `vitest`, `@testing-library/react`, `@testing-library/jest-dom` — single `npm install` command
- **D-02:** Move `playwright`, `@capacitor/cli`, `esbuild` from `dependencies` to `devDependencies` in the same commit as the vitest upgrade
- **D-03:** If existing tests break after upgrade, fix forward — adapt to v4 APIs, do not roll back
- **D-04:** RTL v16.3.2 already installed and supports React 18 || 19 — no peer dep conflict with Phase 13 React upgrade

### Test File Layout
- **D-05:** Co-locate test files next to source: `src/pages/LoginPage.test.tsx` beside `src/pages/LoginPage.tsx`
- **D-06:** Move all 31 existing test files to co-located positions now — one migration pass
- **D-07:** Orphan tests (e2e.test.ts, a11y integration tests without 1:1 source file mapping) → `src/__tests__/` directory
- **D-08:** Update vitest include patterns to `src/**/*.test.{ts,tsx}` for co-located + `tests/**/*.test.ts` for e2e

## Canonical References

### Project Context
- `.planning/PROJECT.md` — Project overview, stack constraints, current milestone v1.2
- `.planning/REQUIREMENTS.md` — v1.2 requirements DEP-01 (dep cleanup) and DEP-02 (vitest upgrade)
- `.planning/ROADMAP.md` — Phase 12 boundary and success criteria

### Codebase Maps
- `.planning/codebase/TESTING.md` — Current test framework (Vitest v1.2.0), test file conventions
- `.planning/codebase/CONVENTIONS.md` — Naming patterns, import organization, path aliases
- `.planning/codebase/STRUCTURE.md` — Directory layout, build config locations

### Package Configuration
- `kapwa-client/package.json` — Current dependencies and devDependencies to modify
- `kapwa-client/vite.config.ts` — Vite config (likely contains vitest config inline)

## Existing Code Insights

### Reusable Assets
- **vitest-axe** (`^0.1.0` in devDeps) — accessibility assertions available for test suite (not activated yet)
- **@axe-core/playwright** (`^4.12.1` in devDeps) — E2E a11y testing infrastructure exists

### Established Patterns
- Test runner: Vitest (already configured in vite.config.ts or config file)
- Test environment: jsdom (DOM simulation)
- Test commands: `npm test` (vitest watch), `npm run test:run` (single run)
- Import organization: external frameworks → project-specific → CSS

### Integration Points
- **vite.config.ts** — Contains or references vitest configuration; may need format update for v4
- **tsconfig.json** — Path aliases for `@/*` imports in test files
- **package.json** `scripts.test` and `scripts.test:run` — must continue working after migration
- No CI/CD pipeline currently configured — Phase 12 output is the foundation for CI in later phases

## Specific Ideas

No specific visual or behavioral requirements beyond the functional definition above. The outcome is a clean `npm ls --prod` tree and `npm test` passing under vitest v4 with co-located tests.

## Deferred Ideas

- **CI integration (GitHub Actions)** — Setting up test-on-push in CI was discussed but not in Phase 12 scope. Can be addressed in a later infrastructure phase.
- **Coverage threshold enforcement** — `vitest coverage` with thresholds deferred to Phase 14-15 when core module tests exist.
- **Dependency audit of all 37 deps** — Only the 3 known misplaced deps are in scope. Full audit deferred.

---

*Phase: 12-Toolchain Cleanup & Vitest Upgrade*
*Context gathered: 2026-07-05*
