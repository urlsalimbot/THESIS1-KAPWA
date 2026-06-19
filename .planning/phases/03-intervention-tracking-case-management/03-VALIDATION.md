---
phase: 3
slug: intervention-tracking-case-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-19
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29 (server) / Vitest (client) |
| **Config file** | kapwa-server/jest.config.ts / kapwa-client/vitest.config.ts |
| **Quick run command** | `cd kapwa-server && npx jest --passWithNoTests --silent --bail` |
| **Full suite command** | `cd kapwa-server && npx jest --passWithNoTests --silent` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick suite (server + client)
- **After every plan wave:** Run full suite (server + client)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | INT-02 | T-03-01 | N/A | unit | `jest cases.fsm` | ❌ | ⬜ pending |
| 03-01-02 | 01 | 1 | INT-02 | T-03-01 | N/A | unit | `jest cases.fsm` | ❌ | ⬜ pending |
| 03-01-03 | 01 | 1 | INT-02 | T-03-01 | N/A | unit | `jest cases.fsm` | ❌ | ⬜ pending |
| 03-01-04 | 01 | 1 | CON-03 | T-03-02 | N/A | unit | `jest sla.timers` | ❌ | ⬜ pending |
| 03-02-01 | 02 | 2 | INT-01, INT-04 | T-03-03 | N/A | integration | `jest interventions.*` | ❌ | ⬜ pending |
| 03-02-02 | 02 | 2 | INT-03 | T-03-04 | N/A | unit | `jest duplicate.detection` | ❌ | ⬜ pending |
| 03-02-03 | 02 | 2 | INT-05 | T-03-05 | N/A | integration | `jest case.tracker` | ❌ | ⬜ pending |
| 03-02-04 | 02 | 2 | INT-04 | T-03-06 | N/A | integration | `jest signatures` | ❌ | ⬜ pending |
| 03-03-01 | 03 | 3 | INT-08 | T-03-07 | N/A | unit | `jest fund.sources` | ❌ | ⬜ pending |
| 03-03-02 | 03 | 3 | SYNC-03 | T-03-08 | N/A | integration | `jest interventions.sync` | ❌ | ⬜ pending |
| 03-03-03 | 03 | 3 | CON-04 | T-03-09 | N/A | e2e | `jest dswd.exports` | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test framework or fixtures needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| MinIO signature upload/render | INT-04 | Requires running MinIO container | Start Docker Compose, verify signature appears on case view |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
