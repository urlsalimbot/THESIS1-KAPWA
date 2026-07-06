---
phase: 14
slug: api-client-swr
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-06
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.9 + @testing-library/react 16.3.2 |
| **Config file** | `kapwa-client/vite.config.ts` (inline vitest config) |
| **Quick run command** | `cd kapwa-client && npx vitest run src/lib/api.test.ts src/lib/query-keys.test.ts` |
| **Full suite command** | `cd kapwa-client && npm run test:run` |
| **Estimated runtime** | ~25s quick / ~60s full |

---

## Sampling Rate

- **After every task commit:** Run `{quick run command}`
- **After every plan wave:** Run `{full suite command}`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 25s quick / 60s full

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | API-01 | T-01: refresh loop | Bearer header from localStorage, never URL | unit | `npx vitest run src/lib/api.test.ts -t "bearer"` | ❌ W0 | ⬜ pending |
| 14-01-02 | 01 | 1 | API-01 | T-02: timeout leak | AbortSignal cleared in finally | unit | `npx vitest run src/lib/api.test.ts -t "timeout"` (use vi.useFakeTimers) | ❌ W0 | ⬜ pending |
| 14-01-03 | 01 | 1 | API-01 | T-03: 401 in body | Throws ApiError with status, never silent | unit | `npx vitest run src/lib/api-error.test.ts` | ❌ W0 | ⬜ pending |
| 14-01-04 | 01 | 1 | API-01 | T-04: refresh loop | Single-flight refresh; second 401 → logout, not retry | unit | `npx vitest run src/lib/api.test.ts -t "401"` | ❌ W0 | ⬜ pending |
| 14-01-05 | 01 | 1 | API-01 | T-05: retry storm | 3 attempts max; exponential + jitter | unit | `npx vitest run src/lib/api.test.ts -t "retry"` | ❌ W0 | ⬜ pending |
| 14-01-06 | 01 | 1 | API-02 | — | queryKeys returns stable tuples | unit | `npx vitest run src/lib/query-keys.test.ts` | ❌ W0 | ⬜ pending |
| 14-01-07 | 01 | 1 | API-02 | — | SWRConfig installed in routes.tsx | unit | `npx vitest run src/lib/swr-config.test.tsx` | ❌ W0 | ⬜ pending |
| 14-02-01 | 02 | 2 | API-02 | — | DashboardPage SWR-fetched | component | `npx vitest run src/pages/DashboardPage.test.tsx` (migrated) | ✅ (update needed) | ⬜ pending |
| 14-02-02 | 02 | 2 | API-02 | — | CasesPage SWR + mutation revalidates | component | `npx vitest run src/pages/CasesPage.test.tsx` | ✅ (update needed) | ⬜ pending |
| 14-02-03 | 02 | 2 | API-02 | — | BeneficiariesPage debounced search via SWR | component | `npx vitest run src/pages/BeneficiariesPage.test.tsx` | ✅ (update needed) | ⬜ pending |
| 14-02-04 | 02 | 2 | API-02 | — | FilingPage useSWRMutation upload | component | `npx vitest run src/pages/FilingPage.test.tsx` | ✅ (update needed) | ⬜ pending |
| 14-02-05 | 02 | 2 | API-02 | — | AdminPage SWR + role guard | component | `npx vitest run src/pages/AdminPage.test.tsx` | ✅ (update needed) | ⬜ pending |
| 14-03-01 | 03 | 3 | API-02 | — | Remaining 16 GET endpoints migrated | per-page | `npx vitest run src/pages/` | mixed | ⬜ pending |
| 14-03-02 | 03 | 3 | API-01 | — | Legacy wrappers deleted; no fetch sites outside api.ts | grep | `! grep -r "fetch(" src/ --exclude-dir=__tests__ --include="*.ts" --include="*.tsx" \| grep -v "src/lib/api.ts" \| grep -v "src/lib/auth.ts"` | ❌ W0 | ⬜ pending |
| 14-03-03 | 03 | 3 | API-02 | — | e2e tests still pass | e2e | `npx vitest run src/__tests__/e2e.test.ts` | ✅ | ⬜ pending |
| 14-03-04 | 03 | 3 | API-01 | — | useSWRMutation optimistic + revalidate | unit | `npx vitest run src/lib/swr-mutation.test.tsx -t "optimistic"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `kapwa-client/src/lib/api.test.ts` — stubs for API-01 client + retry + timeout + 401 + ApiError
- [ ] `kapwa-client/src/lib/api-error.test.ts` — ApiError class tests
- [ ] `kapwa-client/src/lib/query-keys.test.ts` — queryKeys factory stability tests
- [ ] `kapwa-client/src/lib/swr-config.test.tsx` — SWRConfig provider tests
- [ ] `kapwa-client/src/lib/swr-mutation.test.tsx` — useSWRMutation + optimistic + revalidate

*Note: Existing tests in `src/pages/*` and `src/__tests__/e2e.test.ts` will need updates when raw fetch mocks migrate to SWRConfig mocks.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 401 → automatic redirect to /login in real browser | API-01 | Requires actual browser navigation + localStorage state | Login → manually expire token via DevTools (delete kapwa_token) → make any GET → expect /login redirect |
| Token refresh on stale token in real browser | SEC-01 | Requires actual network roundtrip with expired token | Login → wait 1h+ OR set token to expired value → make any GET → expect refresh + retry succeeds |
| AbortSignal cleanup on component unmount | API-01 | jsdom doesn't simulate real AbortController behavior fully | Use React DevTools to unmount page mid-fetch → check no pending fetch in Network tab |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
