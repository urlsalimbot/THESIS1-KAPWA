---
phase: 09
slug: landing-page-auth-flow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-28
---

# Phase 09 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | kapwa-client/vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --changed --reporter=dot`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 1 | PUB-01 | — | N/A | unit | `npx vitest run` | ⬜ W0 | ⬜ pending |
| TBD | 01 | 1 | PUB-02 | — | N/A | unit | `npx vitest run` | ⬜ W0 | ⬜ pending |
| TBD | 01 | 1 | PUB-03 | — | N/A | unit | `npx vitest run` | ⬜ W0 | ⬜ pending |
| TBD | 01 | 1 | PUB-04 | — | N/A | unit | `npx vitest run` | ⬜ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `kapwa-client/tests/components/PublicHeader.test.tsx` — header toggle between Login / Go to Dashboard
- [ ] `kapwa-client/tests/pages/LandingPage.test.tsx` — hero, services, steps render
- [ ] `kapwa-client/tests/pages/LoginPage.test.tsx` — shadcn form, validation, submit
- [ ] `kapwa-client/tests/pages/RegistrationPage.test.tsx` — registration form flow
- [ ] `kapwa-client/tests/layouts/PublicLayout.test.tsx` — layout shell renders header/footer with Outlet

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Role-aware redirect after login | PUB-03 | Requires auth backend | Log in as each role; confirm correct dashboard route |
| Claimant auto-login after registration | PUB-04 | Requires auth backend | Register as claimant; confirm redirect to /my-dashboard |
| Offline caching of public pages | PUB-01 | Requires service worker integration | Load landing page; go offline; verify content still visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending 2026-06-28
