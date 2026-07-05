---
phase: 13
slug: major-version-upgrades
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-05
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v4.1.9 (Phase 12 baseline) + jsdom |
| **Config file** | `kapwa-client/vite.config.ts` (vitest test block) |
| **Quick run command** | `cd kapwa-client && npx vitest run` |
| **Full suite command** | `cd kapwa-client && npx vitest run` + `npm run build` |
| **Estimated runtime** | ~30 seconds (vitest) + ~20 seconds (build) = ~50s total |

---

## Sampling Rate

- **After every task commit:** Run `cd kapwa-client && npx vitest run` (full suite — small enough)
- **After every plan wave:** Run `cd kapwa-client && npm run build` + `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green AND build exit 0
- **Max feedback latency:** ~50 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | UPG-01 (React 19) | T-13-RT-01 | React 19 types resolve, no class dep warning | unit | `npx vitest run` | ❌ (W0) | ⬜ pending |
| 13-01-02 | 01 | 1 | UPG-02 (Capacitor 8) | T-13-CP-01 | bundledWebRuntime removed, sync succeeds | unit | `npx vitest run` | ❌ (W0) | ⬜ pending |
| 13-01-03 | 01 | 1 | UPG-03 (Tailwind v4) | T-13-TW-01 | design tokens preserved, shadcn classes render | unit | `npx vitest run` + `npm run build` | ❌ (W0) | ⬜ pending |
| 13-01-04 | 01 | 1 | D-06 (ErrorBoundary) | T-13-EB-01 | No class component, lib replaces it | unit | `npx vitest run` (ErrorBoundary.test) | ❌ (W0) | ⬜ pending |
| 13-02-01 | 02 | 2 | D-12..D-14 (3 page snapshots) | — | N/A | snapshot | `npx vitest run` | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `kapwa-client/src/components/ErrorBoundary.test.tsx` — rewrite existing class-based test to use `react-error-boundary` API (the existing 2 offline-detection tests in this file are deleted per D-07)
- [ ] `kapwa-client/src/pages/DashboardPage.test.tsx` — new snapshot test (D-12)
- [ ] `kapwa-client/src/pages/CasesPage.test.tsx` — new snapshot test (D-13)
- [ ] `kapwa-client/src/pages/BeneficiariesPage.test.tsx` — new snapshot test (D-14)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mobile (Capacitor 8) build on Android | UPG-02 | Requires Android SDK + Mac/Linux env with emulator | Run `npx cap sync android && npx cap open android` then build APK in Android Studio |
| Mobile (Capacitor 8) build on iOS | UPG-02 | Requires macOS + Xcode | Run `npx cap sync ios && npx cap open ios` then build in Xcode |
| Tailwind v4 visual regression on all 28 pages | UPG-03 | Snapshot tests cover 3 pages; full visual sweep is out of scope | Manual: open dev server, navigate each route, compare to design tokens |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 50s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
