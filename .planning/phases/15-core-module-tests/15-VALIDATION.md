---
phase: 15
slug: core-module-tests
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-06
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.9 + @testing-library/react 16.3.2 + @vitest/coverage-v8 (NEW) |
| **Config file** | `kapwa-client/vite.config.ts` (inline vitest config + NEW `test.coverage` block) |
| **Quick run command** | `cd kapwa-client && npx vitest run src/lib/{api,api-error,auth-context*,offline-queue*,secure-storage*}.test.{ts,tsx}` |
| **Full suite command** | `cd kapwa-client && npm run test:run` |
| **Coverage run command** | `cd kapwa-client && npm run coverage` (NEW) |
| **Coverage gate command** | `cd kapwa-client && npm run coverage:check` (NEW) |
| **Estimated runtime** | ~10s quick / ~30s full / ~35s coverage |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run` on the affected test files (quick)
- **After every plan wave:** Run `npm run test:run` (full suite) + `npm run coverage:check` (per-file threshold gate)
- **Before `/gsd-verify-work`:** Full suite green + coverage gate green
- **Max feedback latency:** 10s quick / 30s full / 35s coverage

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | TST-01 | install + config | `npm ls @vitest/coverage-v8` | ❌ W0 | ⬜ pending |
| 15-01-02 | 01 | 1 | TST-01 | unit | `npx vitest run src/lib/api.test.ts` | ✅ existing | ⬜ pending |
| 15-01-03 | 01 | 1 | TST-01 | unit | `npx vitest run src/lib/api.test.ts` (add KAPWA_AUTH_LOGOUT_EVENT test) | ✅ existing | ⬜ pending |
| 15-01-04 | 01 | 1 | TST-01 | coverage | `npm run coverage:check` (api.ts ≥70% lines) | ❌ W0 | ⬜ pending |
| 15-02-01 | 02 | 2 | TST-02 | unit | `npx vitest run src/lib/auth-context.login.test.tsx` | ❌ W0 | ⬜ pending |
| 15-02-02 | 02 | 2 | TST-02 | unit | `npx vitest run src/lib/auth-context.useauth.test.tsx` | ❌ W0 | ⬜ pending |
| 15-02-03 | 02 | 2 | TST-02 | unit | `npx vitest run src/lib/auth-context.test.tsx` (existing, no regression) | ✅ existing | ⬜ pending |
| 15-02-04 | 02 | 2 | TST-02 | coverage | `npm run coverage:check` (auth-context.tsx ≥70% lines) | ❌ W0 | ⬜ pending |
| 15-03-01 | 03 | 3 | TST-03 | unit | `npx vitest run src/lib/offline-queue.test.ts` (existing, no regression) | ✅ existing | ⬜ pending |
| 15-03-02 | 03 | 3 | TST-03 | unit | `npx vitest run src/lib/offline-queue.queue.test.ts` | ❌ W0 | ⬜ pending |
| 15-03-03 | 03 | 3 | TST-03 | unit | `npx vitest run src/lib/offline-queue.conflict.test.ts` | ❌ W0 | ⬜ pending |
| 15-03-04 | 03 | 3 | TST-03 | unit | `npx vitest run src/lib/offline-queue.versions.test.ts` | ❌ W0 | ⬜ pending |
| 15-03-05 | 03 | 3 | TST-03 | coverage | `npm run coverage:check` (offline-queue.ts ≥70% lines) | ❌ W0 | ⬜ pending |
| 15-04-01 | 04 | 4 | TST-04 | unit | `npx vitest run src/lib/secure-storage.test.ts` (existing, no regression) | ✅ existing | ⬜ pending |
| 15-04-02 | 04 | 4 | TST-04 | unit | `npx vitest run src/lib/secure-storage.browser.test.ts` | ❌ W0 | ⬜ pending |
| 15-04-03 | 04 | 4 | TST-04 | unit | `npx vitest run src/lib/secure-storage.native.test.ts` | ❌ W0 | ⬜ pending |
| 15-04-04 | 04 | 4 | TST-04 | coverage | `npm run coverage:check` (secure-storage.ts ≥70% lines) | ❌ W0 | ⬜ pending |
| 15-04-05 | 04 | 4 | TST-01..04 | coverage | `npm run coverage` (full report, all 4 modules + api-error ≥70%) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] vitest 4.1.9 installed (Phase 12) — coverage provider TBD in 15-01
- [x] @testing-library/react 16.3.2 installed (Phase 12)
- [x] `vi.stubGlobal('fetch', vi.fn())` pattern established (Phase 12-14)
- [x] `vi.mock('./encrypted-db', ...)` pattern established (Phase 14)
- [ ] `@vitest/coverage-v8` — install in 15-01 Task 1
- [ ] `test.coverage` block in `vite.config.ts` — add in 15-01 Task 1
- [ ] `coverage` + `coverage:check` scripts in `package.json` — add in 15-01 Task 1

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Coverage badge generation in README | — | Cosmetic, out of Phase 15 scope | Run `npm run coverage` and inspect the HTML report in `coverage/index.html` |
| CI integration of coverage:check | TST-07 | CI pipeline is Phase 17 scope | Phase 17 will add GitHub Actions that runs `npm run coverage:check` on push |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 35s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
