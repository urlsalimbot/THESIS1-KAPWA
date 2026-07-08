---
phase: 17
slug: page-smoke-tests-security
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-08
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.9 + jsdom + @testing-library/react |
| **Config file** | `kapwa-client/vite.config.ts` |
| **Quick run command** | `npm run test:run` |
| **Full suite command** | `npm run coverage:check` |
| **Estimated runtime** | ~30-45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:run` (314+ tests, ~15-20s)
- **After every plan wave:** Run `npm run coverage:check` (full suite with gate)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | TST-07 | — | N/A | CI config | `npm run build` | ⬜ pending |
| 17-01-02 | 01 | 1 | TST-07 | — | N/A | CI config | `npm run test:run` | ⬜ pending |
| 17-01-03 | 01 | 1 | SEC-01 | — | Token refresh documented | manual | N/A | ⬜ pending |
| 17-02-01 | 02 | 1 | A11Y-02 | — | N/A | a11y axe | `npx vitest run src/pages/` | ⬜ pending |
| 17-03-01 | 03 | 1 | A11Y-02 | — | N/A | a11y axe | `npx vitest run src/pages/` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements:
- vitest-axe already wired globally (`tests/setup.ts` via Phase 16)
- Coverage gate already configured (`npm run coverage:check` via Phase 15)
- Build already passing (`npm run build` exits 0 via Phase 12)
- 28 page tests already exist (via Phase 16)

No new test infrastructure needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SECURITY.md accuracy | SEC-01 | Documents existing code behavior — tests already exist in api.test.ts:82-143 | Manual review of SECURITY.md against api.ts:80-117 |
| CI workflow syntax | TST-07 | Actual CI run requires GitHub push | Push to branch, verify Actions run |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
