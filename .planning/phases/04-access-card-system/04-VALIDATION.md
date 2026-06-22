---
phase: 04
slug: access-card-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-22
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (server) + vitest (client) |
| **Config file** | `kapwa-server/package.json` / `kapwa-client/package.json` |
| **Quick run command** | `cd kapwa-server && npx jest --bail` |
| **Full suite command** | `cd kapwa-server && npx jest --coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --bail --testPathPattern=access-cards`
- **After every plan wave:** Run `npx jest --coverage`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | AC-01 | T-04-01 / — | Code generation uses seq ID, cannot collide | unit | `npx jest --bail --testPathPattern=access-cards` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | AC-01 | T-04-02 / — | Assign links code to beneficiary in one transaction | unit | `npx jest --bail --testPathPattern=access-cards` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | AC-02 | T-04-03 / — | Service log correctly stores intervention data | unit | `npx jest --bail --testPathPattern=access-cards` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 3 | AC-03 | T-04-04 / — | Reprint verification checks identity before allowing | unit | `npx jest --bail --testPathPattern=access-cards` | ❌ W0 | ⬜ pending |
| 04-04-01 | 04 | 3 | AC-04 | T-04-05 / — | Soft warning returned when beneficiary has no card | unit | `npx jest --bail --testPathPattern=interventions` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `kapwa-server/src/access-cards/access-cards.service.spec.ts` — expand existing stubs for assign, reprint, No Card guard
- [ ] `kapwa-server/src/interventions/interventions.service.spec.ts` — add No Card soft warning test

*Existing infrastructure covers most phase requirements; Wave 0 adds missing test cases.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Print card via browser | AC-02 | Print dialog is browser-native, cannot automate | Open card view, Ctrl+P, verify layout matches UI-SPEC |
| Identity verification for reprint | AC-03 | Requires human identity check | Verify UI shows beneficiary details before allowing reprint |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
