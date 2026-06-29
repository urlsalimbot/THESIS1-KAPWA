---
phase: 10
slug: shared-components-responsive
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-28
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (kapwa-client) + @playwright/test |
| **Quick run command** | `npm run test --prefix kapwa-client` |
| **Full suite command** | `npm run test --prefix kapwa-client && npx playwright test` |
| **Estimated runtime** | ~60 seconds |

> **Note:** Phase 10 components are primarily UI rendering + interaction. Core validation is visual inspection + Playwright for component-level assertions.

---

## Sampling Rate

- **After every task commit:** Run `npm run test --prefix kapwa-client` (if vitest suite exists)
- **After every plan wave:** Run full suite
- **Before `/gsd-verify-work`:** Full suite must be green (or manual sign-off for visual-only components)
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Test Type | Automated Command | Status |
|---------|------|------|-------------|------------|-----------|-------------------|--------|
| 10-01-01 | 01 | 1 | STT-01 | — | visual + unit | `npm run test --prefix kapwa-client` | ⬜ pending |
| 10-01-02 | 01 | 1 | STT-02 | — | visual | manual | ⬜ pending |
| 10-01-03 | 01 | 1 | STT-05 | — | visual | manual (toast render) | ⬜ pending |
| 10-02-01 | 02 | 1 | RES-01 | — | visual + Playwright | `npx playwright test` | ⬜ pending |
| 10-02-02 | 02 | 1 | RES-02 | — | visual | manual | ⬜ pending |
| 10-02-03 | 02 | 1 | RES-03 | — | Playwright | `npx playwright test` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Verify vitest is configured in `kapwa-client/`
- [ ] Verify Playwright can launch against dev server
- [ ] Component-level test stubs for PageShell, EmptyState, ErrorBoundary

*If existing infrastructure covers all requirements: mark Wave 0 complete.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Skeleton dimensions match content | STT-02 | Visual alignment — automated snapshots fragile across viewports | Open each data page, verify skeleton shape matches content layout |
| Toast positioning + dismissal | STT-05 | Animation timing, multi-toast stacking | Trigger 3 rapid toasts, verify no overlap, manual dismiss |
| Error boundary fallback UI | STT-04 | Rendering edge case (async errors) | Simulate network failure on data page, verify retry button works |
| Bottom tab nav rendering | RES-01 | Viewport-specific (mobile only) | Resize to <768px, verify 5 tabs visible + pill highlight |
| Touch target sizes | RES-03 | Physical measurement | Inspect computed CSS on all interactive elements, verify min 44x44px |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or manual inspection instructions
- [ ] Sampling continuity: no 3 consecutive tasks without some verify mechanism
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
