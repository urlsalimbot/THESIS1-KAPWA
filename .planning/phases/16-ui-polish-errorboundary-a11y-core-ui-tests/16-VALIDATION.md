---
phase: 16
slug: ui-polish-errorboundary-a11y-core-ui-tests
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-07
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.9 + @testing-library/react 16.3.2 + vitest-axe (NEW wiring) |
| **Config file** | `kapwa-client/vite.config.ts` (inline vitest config) |
| **Quick run command** | `cd kapwa-client && npx vitest run src/components/{ErrorBoundary,Layout,Topbar,Sidebar,ProtectedRoute}.test.tsx` |
| **Full suite command** | `cd kapwa-client && npm run test:run` |
| **Estimated runtime** | ~15s quick / ~30s full |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run` on the affected test files
- **After every plan wave:** Run `npm run test:run` (full suite) — must stay green
- **Before `/gsd-verify-work`:** Full suite green + 0 axe violations on Layout/Topbar/Sidebar
- **Max feedback latency:** 15s quick / 30s full

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | ERR-01 #2 | unit | `npx vitest run src/components/ErrorBoundary.test.tsx -t "offline"` (new test for offline branch) | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 1 | A11Y-02 | config | `grep "vitest-axe/extend-expect" kapwa-client/tests/setup.ts` | ❌ W0 | ⬜ pending |
| 16-01-03 | 01 | 1 | TST-05 | unit | `npx vitest run src/components/ErrorBoundary.test.tsx` (existing 4 tests pass) | ✅ existing | ⬜ pending |
| 16-02-01 | 02 | 2 | TST-05 | unit + axe | `npx vitest run src/components/Layout.test.tsx` (new file, 4-5 tests) | ❌ W0 | ⬜ pending |
| 16-02-02 | 02 | 2 | TST-05 | unit + axe | `npx vitest run src/components/Topbar.test.tsx` (new file, 3-4 tests) | ❌ W0 | ⬜ pending |
| 16-02-03 | 02 | 2 | TST-05 | unit + axe | `npx vitest run src/components/Sidebar.test.tsx` (new file, 2-3 tests) | ❌ W0 | ⬜ pending |
| 16-02-04 | 02 | 2 | TST-05 | unit | `npx vitest run src/components/ProtectedRoute.test.tsx` (new file, 3-4 tests, no axe) | ❌ W0 | ⬜ pending |
| 16-02-05 | 02 | 2 | A11Y-01 | unit | assert SkipToContent is present in Layout test (Task 16-02-01) | ❌ W0 | ⬜ pending |
| 16-03-01 | 03 | 3 | TST-06 | unit | `npx vitest run src/pages/AuditorPage.test.tsx` (new) | ❌ W0 | ⬜ pending |
| 16-03-02 | 03 | 3 | TST-06 | unit | `npx vitest run src/pages/ContactPage.test.tsx` (new) | ❌ W0 | ⬜ pending |
| 16-03-03 | 03 | 3 | TST-06 | unit | `npx vitest run src/pages/CoordinatorDashboardPage.test.tsx` (new) | ❌ W0 | ⬜ pending |
| 16-03-04 | 03 | 3 | TST-06 | unit | `npx vitest run src/pages/MayorReportsPage.test.tsx` (new) | ❌ W0 | ⬜ pending |
| 16-03-05 | 03 | 3 | TST-06 | unit | `npx vitest run src/pages/MyAccessCardPage.test.tsx` (new) | ❌ W0 | ⬜ pending |
| 16-03-06 | 03 | 3 | TST-06 | unit | `npx vitest run src/pages/ProgramsPage.test.tsx` (new) | ❌ W0 | ⬜ pending |
| 16-03-07 | 03 | 3 | TST-06 | unit | `npx vitest run src/pages/IrfDetailPage.test.tsx` (new) | ❌ W0 | ⬜ pending |
| 16-03-08 | 03 | 3 | TST-06 | unit | `npx vitest run src/pages/AccessCardPrintView.test.tsx` (new) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] vitest 4.1.9 + @testing-library/react 16.3.2 (Phase 12)
- [x] vitest-axe@0.1.0 + axe-core@4.12.1 (already in devDeps; not wired)
- [ ] `import 'vitest-axe/extend-expect'` added to `kapwa-client/tests/setup.ts` (Plan 16-01)
- [ ] `EmptyState variant="offline" onAction` wired to `resetErrorBoundary` in `ErrorBoundary.tsx` (Plan 16-01)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Offline UI appears in real browser when TypeError('Failed to fetch') is thrown | ERR-01 #2 | Requires actual browser network failure to trigger | Open dev console, throttle network to offline, click any link → expect offline fallback UI |
| vitest-axe CI gate | A11Y-02 | CI integration is Phase 17 scope (TST-07) | Phase 17 adds the GitHub Actions workflow that runs `npm run test:run` and fails on axe violation |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
