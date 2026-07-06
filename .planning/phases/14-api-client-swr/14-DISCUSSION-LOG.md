# Phase 14: API Client & SWR - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-06
**Phase:** 14-API Client & SWR
**Areas discussed:** API client shape, SWR activation scope, Auth & error contract, Retry & timeout policy, Migration order

---

## API Client Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Keep wrappers, add methods | Keep all 67 wrappers as thin calls to api.get/post internally (preserves all imports, zero refactor of call sites) | |
| Migrate call sites, delete wrappers | Delete the 67 wrappers, refactor all 74 raw fetch call sites to use api.get/post directly (cleanest end state, biggest diff) | ✓ |
| Hybrid: delete redundant, keep domain | Keep only the most-called domain wrappers (e.g., getCases, getBeneficiaries) for typed query keys, delete the rest; new pages use api.get | |

**User's choice:** Migrate call sites, delete wrappers
**Notes:** User committed to the biggest refactor for the cleanest end state. 74 raw fetch sites + 67 wrapper functions all migrate to api.get/post/put/delete.

### Query keys (sub-question)

| Option | Description | Selected |
|--------|-------------|----------|
| Path string keys | `useSWR('/cases', api.get)` — simple, dedupes by URL, breaks when params differ | |
| Tuple keys with params | `useSWR(['cases', { status }], api.get)` — params become part of the cache key | |
| Centralized keys factory | `useSWR(keys.cases.list({status}), api.get)` — typed, no string typos | |

**User's choice:** "best practice" — interpreted as **tuple keys with params + centralized keys factory** (the canonical SWR pattern). `queryKeys` factory returns `as const` tuples; enables `mutate(queryKeys.cases.all)` to revalidate all case queries.

### Mutation pattern (sub-question)

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-revalidate on POST/PUT/DELETE | Every mutation calls mutate() on the right list/detail keys | |
| Per-page caller decides | Caller explicitly calls mutate() after each mutation | |
| useSWRMutation hook | Returns { trigger, isMutating, error } + per-call optimistic update + automatic revalidation on success | |

**User's choice:** "best practice" — **useSWRMutation hook**. Official SWR 2.x pattern with built-in loading/error state, optimistic update support, and on-demand revalidation via global `mutate()`.

---

## SWR Activation Scope

| Option | Description | Selected |
|--------|-------------|----------|
| All 21 GET endpoints | Convert all 21 GET-shaped endpoints across 9 pages + 3 widget components | ✓ |
| Top 5 most-visited | Convert only the top 5 most-visited pages (Dashboard, Cases, Beneficiaries, my access card, my interventions) | |
| Library + 3 example pages | Build the api client + query keys + SWR infrastructure, but only convert 3 representative pages (Dashboard, Cases, Beneficiaries) as examples | |

**User's choice:** All 21 GET endpoints
**Notes:** User wants the full dedup / stale-while-revalidate win, not a pilot. Migration is bottom-up: helpers first, then pages.

---

## Auth & Error Contract

### Token source (sub-question)

| Option | Description | Selected |
|--------|-------------|----------|
| localStorage read (current pattern) | Read localStorage.getItem('kapwa_token') at request time | ✓ |
| Token provider function | Accept a `getToken()` function injected at client construction time | |
| Both: provider + localStorage fallback | Take a token parameter on each call: `api.get('/cases', { token })` | |

**User's choice:** localStorage read (current pattern)
**Notes:** Preserves current pattern, no React coupling, works in event handlers and outside components.

### Error class (sub-question)

| Option | Description | Selected |
|--------|-------------|----------|
| ApiError class with status + body | Custom ApiError class with .status, .body, .message | ✓ |
| Result discriminated union | `{ ok: true, data } | { ok: false, error }` — no try/catch | |
| Plain Error + status field | Plain Error with .status attached | |

**User's choice:** ApiError class with status + body
**Notes:** Preserves `instanceof Error` so existing try/catch still works.

### 401 handling (sub-question)

| Option | Description | Selected |
|--------|-------------|----------|
| Global 401 listener + manual clear | On 401: emit event → clear localStorage → navigate to /login | |
| Token refresh interceptor (SEC-01) | Try /auth/refresh once → retry original → if refresh 401s, log out | |
| Throw 401, let pages handle | Defer global handling to a later phase | |

**User's choice:** "best practice" — **Global 401 listener + token refresh interceptor (SEC-01)**. Concurrent 401s share the same in-flight refresh promise (single-flight pattern). Matches existing project preference (websocket fail → /login). SEC-01 is implemented in this phase as part of D-04.

---

## Retry & Timeout Policy

### Retry trigger (sub-question)

| Option | Description | Selected |
|--------|-------------|----------|
| Network failure + 5xx + timeout (broad) | Retry on network failure + 5xx + timeout. Skip 4xx | |
| Network failure + timeout only (narrow) | Retry only on network failure + timeout. Skip 5xx | ✓ |
| Network failure only (minimal) | Retry only on network failure. Most conservative | |

**User's choice:** Network failure + timeout only (narrow)
**Notes:** 5xx means server is broken; retry won't help. User prefers narrow semantics.

### Backoff (sub-question)

| Option | Description | Selected |
|--------|-------------|----------|
| Exponential with jitter (best practice) | 500ms, 1500ms, 4500ms with ±20% jitter | ✓ |
| Fixed 1s intervals | Fixed 1s delays between retries | |
| No delay, fail-fast | Retry immediately, fail fast | |

**User's choice:** Exponential with jitter (best practice)
**Notes:** Standard distributed-systems pattern. ±20% jitter avoids thundering herd on a recovering server.

### Timeout (sub-question)

| Option | Description | Selected |
|--------|-------------|----------|
| 10s timeout (default) | AbortSignal.timeout(10s) for all GETs | ✓ |
| 15s timeout (long) | Generous for slow mobile networks, longer perceived wait on failure | |
| 5s timeout (short) | Fail fast on slow networks, more spurious failures on slow 3G | |

**User's choice:** 10s timeout (default)
**Notes:** Slightly more than the 7s SWR default focus revalidation, gives the server reasonable time to respond.

### AbortSignal (sub-question)

| Option | Description | Selected |
|--------|-------------|----------|
| AbortController.timeout() | Internal AbortController.timeout(10s) + caller signal composed via AbortSignal.any | ✓ |
| Caller-provided signal only | Caller provides signal: `api.get('/cases', { signal })`. SWR supplies its own | |
| No AbortSignal support | Simpler client, but page navigation cancels nothing | |

**User's choice:** "best practice" — **Internal AbortController.timeout(10s) composed with caller signal via AbortSignal.any**. SWR's auto-unmount signal + user signal + timeout all work together.

---

## Migration Order

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom-up (helpers first) | Build api client + query keys + SWR provider first, prove it works in isolation, then convert pages | ✓ |
| Top-down (Dashboard first) | Convert Dashboard end-to-end first, then extract the patterns into helpers | |
| Vertical slice (representative page) | Build api client + SWR provider + convert one complete page as a vertical slice, then migrate the rest | |

**User's choice:** Bottom-up (helpers first)
**Notes:** Each step is shippable. Plan A proves helpers work via unit tests before any page migration.

### Plan structure (sub-question)

| Option | Description | Selected |
|--------|-------------|----------|
| 2 plans: helpers, then 21 endpoints | Plan A: api client + query keys + SWR provider + 1-2 pilot pages. Plan B: migrate remaining 19 GET endpoints + write new tests | |
| 3 plans: client, then pages, then tests | Plan A: api client + query keys + error contract. Plan B: SWR provider + convert top 5 pages. Plan C: convert remaining 16 pages + dedup remaining raw fetch + final tests | ✓ |
| 1 plan (single atomic migration) | Single plan: api client + SWR + all 21 endpoints + tests in one atomic commit | |

**User's choice:** 3 plans
**Notes:** Three plans balance the work: ~30-40% per plan, each independently shippable.

### Top 5 pages in plan B (sub-question)

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard, Cases, Beneficiaries, MyAccessCard, my interventions | Most-visited worker flow | |
| Dashboard, Cases, Beneficiaries, Filing, Admin | Widest role coverage (worker + admin + auditor) | ✓ |
| Worker pages only (5) | All worker-only pages first: Dashboard, Cases, Beneficiaries, Intake, AccessCard | |

**User's choice:** Dashboard, Cases, Beneficiaries, Filing, Admin
**Notes:** Widest role coverage ensures all 6 roles are exercised in the first batch of migrated pages.

---

## the agent's Discretion

The following are deferred to the agent:

- Specifics of `ApiError.toJSON()` shape (used by SWR's error display)
- The exact jitter algorithm (full random vs decorrelated jitter) — both are acceptable
- Internal `retryDelay` calculation function name and signature
- Whether to add `dedupingInterval` per-query or rely on the global default

## Deferred Ideas

- **Coverage threshold enforcement** — `vitest coverage --thresholds.lines=70` etc. — not in this phase; Phase 15 (Core Module Tests) is the right place.
- **MSW (Mock Service Worker) for tests** — Currently tests use `vi.spyOn(fetch)`. MSW is the modern standard for fetch mocking but is a larger refactor of test setup. Defer to a test infrastructure phase.
- **React Query as a SWR alternative** — Considered but rejected. SWR is smaller, fits the project's "no Redux/Zustand" stance in REQUIREMENTS.md ("SWR + React Context sufficient for current scale"). Sticking with SWR per project constraints.
- **GraphQL migration** — Not in scope; the backend is REST/NestJS.
- **Per-page SWR config presets** — Could create `useCases()` and `useBeneficiaries()` hook wrappers around `useSWR` for ergonomics. Defer to a "hook convenience layer" phase if pages get too repetitive.
- **WebSocket reconnection backoff** — Unrelated; the WS client lives in `chat-socket.ts`. Defer to a chat infra phase.
- **CSRF protection for state-changing requests** — Bearer tokens don't need CSRF (CSRF is for cookies). Not applicable to JWT-in-localStorage model. Defer indefinitely.
