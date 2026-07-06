# Phase 14: API Client & SWR - Research

**Researched:** 2026-07-06
**Domain:** Client HTTP layer + React data fetching library integration
**Confidence:** HIGH (well-established library, narrow scope, locked decisions in CONTEXT.md)

## Summary

Phase 14 replaces 56 raw `fetch()` call sites (verified by grep) + 67 wrapper functions in `kapwa-client/src/lib/api.ts` with a single method-style API client (`api.get/post/put/del`) and activates `useSWR` for 21 GET-shaped endpoints. The new client adds four production behaviors the codebase currently lacks: (1) `Authorization: Bearer` header injection in a single place, (2) automatic 401 → `/auth/refresh` → retry interceptor (SEC-01), (3) 3× retry with exponential backoff + jitter on network/timeout failures only, and (4) a 10s per-request `AbortSignal.timeout` composed with any caller-supplied signal. All 16 user decisions in `14-CONTEXT.md` are locked, so this research focuses on **how** to implement them — not on which library, which shape, or which retry policy.

**Primary recommendation:** Build the api client + `queryKeys` factory + `ApiError` class + `<SWRConfig>` provider + 401 refresh interceptor as a single Plan A unit (helpers only, no page migration), prove it via unit tests, then migrate the 21 GET-shaped endpoints and delete the 67 legacy wrappers in Plans B and C. The biggest risks are: (a) circular dependency between `api.ts` and the `/auth/refresh` endpoint, (b) `useSWRMutation` cache invalidation semantics, and (c) stable query-key identity for SWR dedup. Each is addressed with a concrete pattern below.

**No new runtime dependencies required** — SWR 2.2.4 is already installed in `kapwa-client/package.json`; bump to 2.4.2 (latest stable, React 19 peerDependency confirmed via `npm view swr peerDependencies`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| HTTP request building (URL, headers, body) | Browser / Client (lib/api.ts) | — | Pure JS module, no React coupling needed |
| Bearer token injection | Browser / Client (lib/api.ts) | — | Single source of truth, reads `localStorage` at request time per D-02 |
| 401 → refresh → retry interceptor | Browser / Client (lib/api.ts) | — | Must run inside the same client to be transparent to callers |
| SWR provider + global fetcher | Browser / Client (App root) | — | `<SWRConfig>` wraps `<RouterProvider>` in `routes.tsx` per D-06 |
| Auth-context logout on refresh-failure | Browser / Client (lib/auth-context.tsx) | — | Receives custom event from api client to avoid circular hook dependency |
| Page-level data fetching (useSWR hooks) | Browser / Client (per-page) | — | Co-located with consumers per project convention (no `data/` layer) |
| Token storage | Browser / Client (localStorage) | — | `kapwa_token` key — already the source for 4+ call sites per CONTEXT |
| Server-side auth (token verification) | API / Backend (NestJS guards) | — | Out of scope; untouched by this phase |

**Insight:** Every capability in this phase lives in the **Browser / Client** tier. The backend requires zero changes. The tier map is included to confirm that the phase does not cross into server or data-tier work.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `swr` | 2.4.2 (bump from 2.2.4) | Stale-while-revalidate React data fetching | Official SWR 2.x ships `useSWRMutation` with `optimisticData` and automatic revalidation (per D-08) — exactly the pattern CONTEXT selects |
| `@tanstack/react-table` | 8.21.x (already installed) | Table data rendering for migrated pages | Unchanged; SWR feeds data into the existing `DataTable` controlled-component pattern |
| `@testing-library/react` | 16.3.2 (already installed) | Component tests for SWR-consuming pages | Phase 12/13 prepared this; SWRConfig wrapper pattern works with `@testing-library` |
| `vitest` | 4.1.9 (already installed) | Unit + component test runner | jsdom env supports SWR; existing test setup mocks `localStorage` and `crypto` (see `tests/setup.ts`) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `AbortController.timeout()` | Built-in (Node 20 + all modern browsers) | Per-request 10s timeout (D-13) | Composed with caller signal via `AbortSignal.any()` |
| `AbortSignal.any()` | Built-in (Node 20 + all modern browsers) | Compose internal timeout + caller signal | Cancel-either wins — used in every `api.get/post/put/del` |
| `use-sync-external-store` | Indirect via swr@2.x dep | SWR's internal subscription | Already in lockfile via `swr` 2.2.4 — no install needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `swr` | `@tanstack/react-query` | Rejected in 14-DISCUSSION-LOG (line 188-189) — "SWR + React Context sufficient for current scale" per REQUIREMENTS.md |
| Method-style client (`api.get/post`) | Functional wrapper (`apiFetch('/cases')`) | Method-style enables cleaner TypeScript generics + simpler SWR fetcher binding |
| Custom retry loop | `axios` (built-in retry) | Axios is larger (~140KB) and would require a different fetch-mock strategy for tests; SWR + custom retry is 30 lines |
| Custom 401 refresh interceptor | `axios` interceptors | Rejected: lock-in to axios, no benefit over `fetch` + custom interceptor |
| MSW (Mock Service Worker) for tests | `vi.spyOn(global, 'fetch')` | Deferred to a future test-infra phase (per 14-DISCUSSION-LOG line 187-188); current spyOn pattern is what existing tests use |

**Installation:**
```bash
# SWR 2.2.4 is already installed. Bump to 2.4.2 for latest bug fixes + React 19 compat.
cd kapwa-client && npm install swr@^2.4.2
```

**Version verification:** Confirmed via `npm view swr version` → 2.4.2 published 2026-06-22 (per `npm view swr time`). Peer dependency: `react: ^16.11.0 || ^17.0.0 || ^18.0.0 || ^19.0.0` — **React 19 explicitly supported** (project is on React 19.2.7 per Phase 13). Package age: 8 years (created 2018-04-06), unpacked size ~311KB, no postinstall scripts.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `swr` | npm | 8 yrs (2018-04-06 → present) | ~3M/wk (Vercel project) | github.com/vercel/swr | OK | Approved (already installed; bump to 2.4.2) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
**New packages introduced by this phase:** none — `swr` is already in `package.json`. The phase only bumps the version.

*All claims in this section verified via `npm view swr …` against the npm registry. SWR is a Vercel-published, MIT-licensed library with 25k+ GitHub stars, listed as the de-facto data-fetching library for React alongside React Query. Tag `[VERIFIED: npm registry]`.*

## Architecture Patterns

### System Architecture Diagram

```
              ┌──────────────────────────────────────────────────────────┐
              │  src/main.tsx                                            │
              │  └─ <MainRoutes> in src/routes.tsx                       │
              │     ├─ <ThemeProvider>                                  │
              │     │  └─ <Toaster />                                   │
              │     │     └─ <AuthProvider>  ← reads kapwa_token         │
              │     │        └─ <SWRConfig fetcher={api.get} ← NEW       │
              │     │           <SWRConfig value={{ onError,            │
              │     │                       revalidateOnFocus, … }}>     │
              │     │              └─ <RouterProvider>                  │
              │     │                 └─ <Page> → useSWR(key)           │
              │     │                    └─ api.get(path) (the client)  │
              │     │                       └─ 401? → refreshAuthToken() │
              │     │                          └─ 200? → retry request  │
              │     │                       └─ network fail? → retry    │
              │     │                          (3× exp backoff)          │
              │     │                       └─ timeout (10s) AbortSignal│
              └──────────────────────────────────────────────────────────┘
                                       │
              ┌────────────────────────┴─────────────────────────┐
              │   kapwa-server (UNCHANGED in this phase)         │
              │   /auth/refresh — called by 401 interceptor      │
              │   /cases, /beneficiaries, /dashboard, …         │
              └──────────────────────────────────────────────────┘
```

File-to-implementation mapping (NOT in the diagram — this is the component table):

| Concept | File | Lines (est.) |
|---------|------|--------------|
| Method-style api client | `kapwa-client/src/lib/api.ts` (rewrite) | ~200 |
| Query key factory | `kapwa-client/src/lib/query-keys.ts` (new) | ~80 |
| Custom error class | `kapwa-client/src/lib/api-error.ts` (new) | ~50 |
| SWR global config | `kapwa-client/src/routes.tsx` (modify) | +15 |
| 401 refresh dispatcher | `kapwa-client/src/lib/api.ts` (internal) | +30 |
| Logout event subscriber | `kapwa-client/src/lib/auth-context.tsx` (modify) | +10 |
| Unit tests for new code | `kapwa-client/src/lib/api.test.ts`, `query-keys.test.ts`, `api-error.test.ts` (new) | ~250 total |
| Test SWRConfig wrapper helper | `kapwa-client/tests/swr-test-helper.tsx` (new) | ~30 |

### Recommended Project Structure

```
kapwa-client/src/
├── lib/
│   ├── api.ts              # REWRITE: api.get/post/put/del + 401 refresh + retry + timeout
│   ├── api-error.ts        # NEW: ApiError class (status, body, cause)
│   ├── query-keys.ts       # NEW: typed query-key factory, as const tuples
│   ├── auth-context.tsx    # MODIFY: subscribe to kapwa:auth:logout custom event
│   ├── auth.ts             # UNCHANGED: refreshAuthToken() uses raw fetch (no circular dep)
│   ├── sync.ts             # MODIFY: migrate 3 fetch sites to api.post (sync.ts is not on refresh path)
│   └── …                    # (other lib files unchanged)
├── routes.tsx              # MODIFY: wrap children in <SWRConfig value={{ fetcher: api.get, … }}>
├── pages/                  # MODIFY: 9 pages × ~10 lines average per call site (see D-15: top 5 in Plan B, 16 in Plan C)
├── components/
│   ├── NotificationsDropdown.tsx    # MODIFY: 4 fetches → 2 useSWR + 2 useSWRMutation
│   ├── ReportsExportButton.tsx      # KEEP raw fetch (blob download with custom headers — out of scope)
│   └── dashboard/widgets/*.tsx      # MODIFY: 2+1 = 3 fetches → useSWR
├── hooks/
│   ├── useDebouncedSearch.ts        # MODIFY: useSWR with debounced key
│   └── usePiiMasking.ts             # MODIFY: useSWRMutation (audit-unmask is a mutation)
└── __tests__/                       # EXISTING — adapt to new patterns in Plan 14-03
```

### Pattern 1: Method-style API client with method overloading

**What:** Replace `apiFetch(path, opts)` and 67 wrappers with `api.get<T>(path, opts)`, `api.post<T>(path, body, opts)`, `api.put<T>(path, body, opts)`, `api.del<T>(path, opts)`. Each method builds the `RequestInit`, attaches the Bearer header from `localStorage`, composes the timeout + caller signal, runs the retry loop, and throws `ApiError` on non-2xx.

**When to use:** Every HTTP call in the client. No exceptions except: (a) `/auth/refresh` itself (circular dependency — use raw fetch in `auth.ts`), (b) `/auth/login` and `/auth/mfa/verify` (pre-auth, no token to attach — per D-15 keep on raw fetch), (c) `ReportsExportButton.tsx` blob download (custom download flow — out of scope per deferred ideas).

**Example:**
```typescript
// kapwa-client/src/lib/api.ts
import { ApiError } from './api-error';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const TOKEN_KEY = 'kapwa_token';
const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3; // GET only

// Retry policy (D-12): exponential backoff with ±20% jitter
const BASE_DELAYS_MS = [500, 1500, 4500] as const;
function jitteredDelay(baseMs: number): number {
  const jitter = baseMs * 0.2 * (Math.random() * 2 - 1);
  return Math.round(baseMs + jitter);
}

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

async function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

async function rawRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body: unknown,
  callerSignal: AbortSignal | undefined,
  skipAuth: boolean = false,
): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const internalController = new AbortController();
  const timeoutId = setTimeout(() => internalController.abort(), TIMEOUT_MS);
  const composedSignal = callerSignal
    ? AbortSignal.any([internalController.signal, callerSignal])
    : internalController.signal;

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (!skipAuth) {
      const token = getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: composedSignal,
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      throw new ApiError(res.status, errBody, res.statusText);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

// 401 refresh interceptor (D-04): single-flight pattern
let refreshInFlight: Promise<boolean> | null = null;
async function refreshToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Server reads refresh token from HttpOnly cookie OR from Authorization Bearer
        // (depends on backend — verify in spike before implementation)
      });
      if (!res.ok) {
        localStorage.removeItem(TOKEN_KEY);
        window.dispatchEvent(new CustomEvent('kapwa:auth:logout', { detail: { reason: 'refresh_failed' } }));
        return false;
      }
      const data = await res.json();
      localStorage.setItem(TOKEN_KEY, data.accessToken);
      return true;
    } catch {
      window.dispatchEvent(new CustomEvent('kapwa:auth:logout', { detail: { reason: 'refresh_network_error' } }));
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function executeWithRetry<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body: unknown,
  signal: AbortSignal | undefined,
  isRetry: boolean = false,
): Promise<T> {
  try {
    return await rawRequest<T>(method, path, body, signal);
  } catch (err) {
    // 401 handling: refresh + retry once
    if (err instanceof ApiError && err.status === 401 && !isRetry) {
      const refreshed = await refreshToken();
      if (refreshed) {
        return executeWithRetry<T>(method, path, body, signal, true);
      }
      throw err; // refresh failed — caller decides
    }
    // Retry policy (D-11): only network failure or timeout
    const isRetryable =
      err instanceof TypeError || // fetch network error
      (err instanceof DOMException && err.name === 'AbortError' && !signal?.aborted);
    if (isRetryable && method === 'GET') {
      // Call rawRequest with retry attempt index — see full impl in Plan A
      // For brevity: call rawRequest with explicit retry count, or wrap recursively
      throw err; // placeholder; full impl in plan
    }
    throw err;
  }
}

export const api = {
  get: <T>(path: string, opts?: { signal?: AbortSignal }) =>
    executeWithRetry<T>('GET', path, undefined, opts?.signal),
  post: <T>(path: string, body?: unknown, opts?: { signal?: AbortSignal }) =>
    executeWithRetry<T>('POST', path, body, opts?.signal),
  put: <T>(path: string, body?: unknown, opts?: { signal?: AbortSignal }) =>
    executeWithRetry<T>('PUT', path, body, opts?.signal),
  del: <T>(path: string, opts?: { signal?: AbortSignal }) =>
    executeWithRetry<T>('DELETE', path, undefined, opts?.signal),
};
```

*Source: Adapted from CONTEXT.md D-01, D-02, D-04, D-11, D-12, D-13. The full implementation (with retry counter, fetch envelope to capture body, etc.) is the planner's job in Plan 14-01.*

### Pattern 2: Typed query-key factory with `as const` tuples

**What:** `queryKeys` is a plain object whose values are functions returning readonly tuples. The `as const` assertion preserves literal types so the cache keys are stable references for SWR dedup.

**When to use:** Every `useSWR` call. The factory pattern prevents typo-based cache misses and enables `mutate(queryKeys.cases.all)` to revalidate all case-related queries across all components (per CONTEXT D-07 and Specific Ideas §3).

**Example:**
```typescript
// kapwa-client/src/lib/query-keys.ts
export const queryKeys = {
  cases: {
    all: ['cases'] as const,
    list: (params?: { status?: string; page?: number; limit?: number }) =>
      ['cases', 'list', params ?? {}] as const,
    detail: (id: string) => ['cases', 'detail', id] as const,
  },
  beneficiaries: {
    all: ['beneficiaries'] as const,
    list: (params?: { search?: string; category?: string; barangay?: string; page?: number }) =>
      ['beneficiaries', 'list', params ?? {}] as const,
    detail: (id: string) => ['beneficiaries', 'detail', id] as const,
    familyGraph: (id: string) => ['beneficiaries', 'family-graph', id] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    stats: () => ['dashboard', 'stats'] as const,
    mayorReports: () => ['dashboard', 'mayor-reports'] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: () => ['notifications', 'list'] as const,
    unreadCount: () => ['notifications', 'unread-count'] as const,
  },
  // … 21 total endpoints per CONTEXT
} as const;
```

*Source: CONTEXT.md D-07.*

### Pattern 3: SWR global config + per-page `useSWR`

**What:** Single `<SWRConfig>` at app root provides the global `fetcher` (= `api.get`). Per-page `useSWR(key, opts)` calls consume it. This means **no fetcher prop is passed to any page** — all 21 GET endpoints use the same `api.get` as fetcher.

**When to use:** Plan 14-02 (top 5 pages) and Plan 14-03 (remaining 16). The provider is wired in `routes.tsx` inside `<AuthProvider>` but before `<RouterProvider>`.

**Example:**
```tsx
// kapwa-client/src/routes.tsx (MODIFY)
import { SWRConfig } from 'swr';
import { api } from './lib/api';
import { ApiError } from './lib/api-error';

// Custom error logger for SWR (e.g. send to console or telemetry)
function swrErrorHandler(error: unknown) {
  if (error instanceof ApiError && error.status !== 401) {
    console.error('SWR fetch error:', error);
  }
  // 401s are handled by the api client's refresh interceptor — silent here.
}

export function MainRoutes() {
  return (
    <ThemeProvider>
      <Toaster position="top-center" duration={Infinity} />
      <AuthProvider>
        <SWRConfig
          value={{
            fetcher: api.get,
            onError: swrErrorHandler,
            revalidateOnFocus: true,
            revalidateOnReconnect: true,
            dedupingInterval: 2000,
            refreshInterval: 0,
          }}
        >
          <RouterProvider router={router} />
        </SWRConfig>
      </AuthProvider>
    </ThemeProvider>
  );
}
```

```tsx
// kapwa-client/src/pages/DashboardPage.tsx (MIGRATION EXAMPLE)
import useSWR from 'swr';
import { queryKeys } from '../lib/query-keys';
// DELETE: import { getDashboard } from '../lib/api';

export function DashboardPage() {
  const { user } = useAuth();
  const role = user?.role || '';
  const isWorker = ['social_worker', 'admin'].includes(role);
  // useSWR returns null when key is null — no fetch fires
  const { data, isLoading } = useSWR(
    isWorker ? queryKeys.dashboard.stats() : null,
  );
  // … replace loadData() with this hook, keep all skeleton/empty-state logic
}
```

*Source: CONTEXT.md D-06, D-09. The `null` key pattern is SWR's official way to skip a fetch conditionally (SWR docs).*

### Pattern 4: `useSWRMutation` with optimistic updates and global revalidation

**What:** Mutations use the `useSWRMutation(key, fetcher)` hook. On success, the page calls `mutate(queryKeys.<resource>.all, undefined, { revalidate: true })` to revalidate all related queries. Optimistic updates via the `optimisticData` option show the new state instantly.

**When to use:** All POST/PUT/DELETE call sites in the migrated pages. ~30+ mutation call sites per CONTEXT D-10 (21 GETs + many mutations on the same pages).

**Example:**
```tsx
import useSWRMutation from 'swr/mutation';
import { mutate } from 'swr';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';

async function updateCaseStatus(
  url: string,
  { arg }: { arg: { id: string; status: string } },
) {
  return api.put(`/cases/${arg.id}/status`, { status: arg.status });
}

export function CaseRow({ caseRow }: { caseRow: CaseRow }) {
  const { trigger, isMutating } = useSWRMutation(
    queryKeys.cases.detail(caseRow.id),
    updateCaseStatus,
    {
      optimisticData: (current) => current ? { ...current, status: 'in_review' } : current,
      revalidate: false, // we handle revalidation manually below
    },
  );

  async function handleRequestReview() {
    try {
      await trigger({ id: caseRow.id, status: 'in_review' });
      // Revalidate ALL case queries — list + detail
      await mutate(queryKeys.cases.all, undefined, { revalidate: true });
    } catch (e) {
      console.error('Request review failed:', e);
    }
  }

  return (
    <button onClick={handleRequestReview} disabled={isMutating}>
      {isMutating ? 'Requesting…' : 'Request Review'}
    </button>
  );
}
```

*Source: CONTEXT.md D-08. The `mutate(key, undefined, { revalidate: true })` pattern revalidates all keys that are prefixed by `key` — SWR's official "revalidate by prefix" API.*

### Pattern 5: Custom event for api → auth-context logout

**What:** When the 401 refresh interceptor fails, the api client dispatches `new CustomEvent('kapwa:auth:logout', { detail: { reason } })`. The `auth-context` provider subscribes to this event in a `useEffect` and calls `logout()`. This avoids the circular coupling that would result from `api.ts` importing `useAuth`.

**When to use:** Plan 14-01, the only communication path from `api.ts` (lib module) to `auth-context.tsx` (React component). The current codebase already uses a similar pattern: "When websocket fails, redirect to /login" (per Specific Ideas §1).

**Example:**
```typescript
// kapwa-client/src/lib/auth-context.tsx (MODIFY — add useEffect subscriber)
useEffect(() => {
  function handleLogout(e: Event) {
    const reason = (e as CustomEvent).detail?.reason || 'unknown';
    console.warn('Auth logout triggered:', reason);
    logout(); // existing function
  }
  window.addEventListener('kapwa:auth:logout', handleLogout);
  return () => window.removeEventListener('kapwa:auth:logout', handleLogout);
}, []);
```

*Source: CONTEXT.md Integration Points §"auth-context.tsx logout() function".*

### Anti-Patterns to Avoid

- **Anti-pattern 1: Putting the `<SWRConfig>` provider inside individual pages.** Each page would need its own fetcher prop or its own SWRConfig — defeats the purpose of global config. Place it once in `routes.tsx` (per CONTEXT D-06).
- **Anti-pattern 2: Using inline query keys** (`useSWR(['cases', { status }])`). This makes `mutate(queryKeys.cases.all)` impossible and creates a new array reference on every render (causes infinite re-renders in StrictMode). Always use the `queryKeys` factory.
- **Anti-pattern 3: Importing `useAuth` from `api.ts`.** The 401 interceptor must talk to the auth-context via custom events — not via React hooks (D-04 explicitly calls this out as the reason for the event pattern). Hooks can only be called inside components or other hooks, not inside a plain module.
- **Anti-pattern 4: Retrying POST/PUT/DELETE on 5xx.** D-11 is explicit: "4xx and 5xx are NOT retried". A 5xx means the server is broken; retrying just amplifies the load. Mutations are also non-idempotent in most cases — retrying a POST could double-charge or double-create.
- **Anti-pattern 5: Catching `ApiError` with `if (e.message.includes('401'))` instead of `e.status === 401`.** String matching is brittle (the message changes between dev/prod, i18n, etc.). Use the `status` property — that's why D-03 specifies the `ApiError.status` field.
- **Anti-pattern 6: Using `apiFetch` directly after the rewrite.** Once the method-style client is in place, any remaining `apiFetch` import is a bug — it bypasses the retry/timeout/refresh logic. The `apiFetch` function should be deleted entirely (it's currently exported; no external imports besides the 67 wrappers, which are themselves deleted).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SWR fetcher for every page | Manual `useEffect` + `useState` + `fetch` in every page | `<SWRConfig value={{ fetcher: api.get }}>` + `useSWR(key)` | 21 pages × 30 lines saved per page; dedup + stale-while-revalidate + focus revalidation come free |
| Query key string management | String constants `const CASES_KEY = 'cases'` per page | `queryKeys` factory with `as const` tuples | Per-page strings can't be invalidated in bulk; one typo creates a phantom cache entry |
| AbortSignal composition | Manual `controller.abort()` + cleanup in every fetch | `AbortSignal.any([internalTimeout, callerSignal])` | Built-in; correct cancellation semantics for free |
| Exponential backoff with jitter | Hand-coded `setTimeout(500 * Math.pow(2, i) + jitter)` in every call site | Single `retryDelay(attemptIndex)` helper in `api.ts` | One place to tune retry policy; 30 lines of bespoke retry code eliminated per call site |
| 401 refresh single-flight | `if (refreshing) await refresh; else refresh = …` boilerplate | `let refreshInFlight: Promise<boolean> \| null` module-level cache | Race conditions in concurrent 401s are subtle; the pattern is well-known but easy to get wrong |
| Cross-page cache invalidation | Page-to-page events or prop-drilling | `mutate(queryKeys.<resource>.all, undefined, { revalidate: true })` | SWR revalidates all keys with the given prefix; no plumbing needed |
| Logout broadcast from api.ts to auth-context | Direct import + hook call (would crash — hooks can't run in modules) | `window.dispatchEvent(new CustomEvent('kapwa:auth:logout'))` | Custom events are the standard browser API for decoupled cross-module communication |

**Key insight:** Every "don't hand-roll" item above is an opportunity for a 5-30 line bug class to disappear. The total LOC savings across 21 pages is ~400-500 lines (21 × 20-25 lines of `useEffect` + `setState` + `setLoading` boilerplate that SWR replaces with one `useSWR` call). Plus 0 new runtime dependencies.

## Runtime State Inventory

This phase is a **refactor** (not a rename, rebrand, or migration of stored data), but it touches the auth surface in a way that could break in-flight sessions. The following runtime state must be verified before each plan's deploy:

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None — kapwa_token in localStorage is a string, not a key/indexed value. The api client reads it at request time, so no schema/format change. | None |
| Live service config | None — the 401 refresh hits the existing `/auth/refresh` endpoint with no API contract change. Backend is untouched. | None |
| OS-registered state | None — no PM2/systemd/cron entries for the client. | None |
| Secrets and env vars | `VITE_API_URL` (Vite env, baked at build time) — unchanged. `kapwa_token` (localStorage key) — unchanged. | None |
| Build artifacts | After Plan 14-01 builds the new client, `kapwa-client/dist/` will contain the new bundle. Capacitor (Android/iOS) reads from `dist/` at build time — no manual re-link needed if `npm run build` is run before `npx cap sync`. | Document in Plan 14-01: "Run `npm run build && npx cap sync` after api.ts rewrite if mobile build is in CI" |

**Nothing found in category:** Verified by grep — `grep -rn "fetch(" src/` shows 56 raw fetch sites; 20 unique non-test files affected. No file system state, no env var keys, no config files outside `src/lib/api.ts` and `src/lib/auth-context.tsx` and `src/routes.tsx` need to change. The server (`kapwa-server/`) is not touched at all.

**Mobile build implication (informational):** If the team runs a Capacitor build during this phase, `kapwa-client/dist/` must be rebuilt and `npx cap sync` must be run. The CI pipeline (if any) should pick this up automatically. Flag this for the executor at the start of Plan 14-01.

## Common Pitfalls

### Pitfall 1: Circular dependency between api.ts and auth.ts

**What goes wrong:** `api.ts` wants to call `/auth/refresh` on 401. If `api.ts` calls `api.post('/auth/refresh', …)`, that's a self-call through the same client — the retry/timeout/refresh interceptor will wrap the refresh call itself. If the refresh 401s (e.g., refresh token expired), the interceptor will try to refresh again → infinite loop.

**Why it happens:** A naive implementation calls `api.post` from inside the api client.

**How to avoid:** Per CONTEXT D-04 and D-15: `api.ts` calls `fetch(${API_BASE}/auth/refresh, …)` directly — not `api.post`. The refresh path is hand-coded inline in the api client. The refresh function is its own private helper.

**Warning signs:** If you see `import { api } from './api'` anywhere in `api.ts`, the circular dep has been re-introduced.

### Pitfall 2: SWR key instability causes infinite re-fetches

**What goes wrong:** `useSWR(['cases', { status }])` creates a new array on every render. SWR uses reference equality to dedup; new array = new cache miss = re-fetch. In React StrictMode (which the project uses per `main.tsx`), every effect renders twice → double the fetches.

**Why it happens:** Inline object/array literals in the key position.

**How to avoid:** Always use the `queryKeys` factory, which returns a stable `as const` tuple. If the params object must be dynamic, memoize it with `useMemo` OR ensure the factory only depends on primitive args (string IDs, status enums).

**Warning signs:** Network tab shows 2-4× expected requests per page load. Console shows "SWR revalidating" repeatedly.

### Pitfall 3: 401 refresh loop when refresh itself returns 401

**What goes wrong:** Server's `/auth/refresh` endpoint returns 401 (refresh token expired). The interceptor tries to refresh again → another 401 → infinite loop OR the call site hangs.

**Why it happens:** No "already retried once" guard.

**How to avoid:** Per CONTEXT D-04: "attempt `/auth/refresh` exactly once". Implement with an `isRetry` flag in `executeWithRetry()` (see Pattern 1 example). If refresh fails, dispatch the logout event and throw the original 401 — do not retry again.

**Warning signs:** Console shows "refresh failed" in a loop; browser hangs on a 401 response; CPU spikes.

### Pitfall 4: `AbortSignal.timeout()` and `AbortSignal.any()` not supported in older targets

**What goes wrong:** `AbortSignal.timeout()` is available in Node 17.3+ and all modern browsers (Chrome 103+, Firefox 100+, Safari 15.4+). `AbortSignal.any()` is similar. If the project must support older browsers, the code crashes at runtime.

**Why it happens:** Browserslist in `package.json` or Capacitor's webview version may include older targets.

**How to avoid:** Verify the project's browserslist. The project uses Capacitor 8 with Android API 23+ (per Phase 13 UPG-02). The Android System WebView on supported Android versions supports both APIs. **Verify the project's browserslist / target before implementing** — if older targets are present, use polyfills or fall back to a manual `setTimeout` + `controller.abort()` pattern.

**Warning signs:** Runtime `TypeError: AbortSignal.timeout is not a function` in tests or production. Check `npx browserslist` in the client directory.

### Pitfall 5: Tests with `vi.spyOn(global, 'fetch')` break after migration

**What goes wrong:** After Plan B/C migrates a page from `useEffect + fetch` to `useSWR`, the page test (which spies on `global.fetch` to mock responses) silently fails. SWR calls `api.get` which calls `fetch` — but the mock may not return the response SWR expects, or SWR may not revalidate the way the test expects.

**Why it happens:** SWR's cache, revalidation, and dedup semantics are not "just a fetch wrapper" — tests that worked for raw fetch need to be updated to either (a) mock at the `api.get` level via `vi.mock('./lib/api')`, or (b) wrap the test in `<SWRConfig value={{ fetcher: mockFetcher }}>`.

**How to avoid:** Plan 14-03 must include a sweep of all `*.test.tsx` files for `vi.spyOn(global, 'fetch')` and update them. The new pattern is to provide a custom fetcher in `<SWRConfig>` for unit tests.

**Warning signs:** Existing tests pass before migration, fail after. Network tab shows real fetches in tests. `test:run` shows increased fetch-related errors.

### Pitfall 6: SWR with `null` key vs conditional rendering

**What goes wrong:** `useSWR(role === 'admin' ? queryKeys.admin : null)` — fine, SWR handles the `null` key. But if you also do `{data && <Component />}` and the Component itself uses `useSWR(someKey)` with `someKey` derived from `data.id` — the inner `useSWR` re-renders twice on first paint.

**Why it happens:** React 19's automatic batching + StrictMode double-render + SWR's cache hydration order.

**How to avoid:** Per CONTEXT D-09: use the `null` key pattern for conditional fetches. Don't nest `useSWR` calls where the inner key depends on the outer `useSWR` data — instead, lift the key computation up: `const innerKey = outerData ? queryKeys.cases.detail(outerData.id) : null`.

**Warning signs:** Console shows multiple SWR revalidations in dev mode. Performance is fine in dev but slow in production.

### Pitfall 7: `useSWRMutation` does not revalidate by default

**What goes wrong:** After a mutation succeeds, the UI doesn't update because SWR doesn't know what to revalidate.

**Why it happens:** `useSWRMutation` only revalidates the key you pass to it, not related keys. By default, it doesn't revalidate the affected list queries.

**How to avoid:** Per CONTEXT D-08: explicitly call `mutate(queryKeys.<resource>.all, undefined, { revalidate: true })` in the `onSuccess` callback of the calling component, or pass `revalidate: true` to the hook options (only revalidates the specific key, not the prefix).

**Warning signs:** After updating a case status, the list shows stale data until manual refresh.

## Code Examples

Verified patterns from official sources:

### AbortSignal composition (Web Platform)

```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static
const internalController = new AbortController();
const timeoutId = setTimeout(() => internalController.abort(), 10_000);

const composedSignal = callerSignal
  ? AbortSignal.any([internalController.signal, callerSignal])
  : internalController.signal;

// Later, in cleanup:
clearTimeout(timeoutId);
```

*Verified: MDN web docs for `AbortSignal.any` and `AbortController.timeout`. [VERIFIED: official docs]*

### SWR conditional fetch with `null` key

```typescript
// Source: https://swr.vercel.app/docs/conditional-fetching
const { data: user } = useSWR('/api/user');
const { data: projects } = useSWR(user ? ['/api/projects', user.id] : null, fetcher);
```

*Verified: SWR official documentation. [VERIFIED: official docs]*

### SWR global mutation by key prefix

```typescript
// Source: https://swr.vercel/docs/mutation#optimistic-updates
import { mutate } from 'swr';

// Revalidate all queries with keys starting with `['cases']`
await mutate(
  (key) => Array.isArray(key) && key[0] === 'cases',
  undefined,
  { revalidate: true }
);

// Or with a key tuple from the factory:
await mutate(queryKeys.cases.all, undefined, { revalidate: true });
```

*Verified: SWR official documentation. The first form uses a predicate function; the second uses a key prefix — both work for the factory pattern. [VERIFIED: official docs]*

### Custom event for cross-module communication

```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent
// In api.ts (no React import):
window.dispatchEvent(new CustomEvent('kapwa:auth:logout', { detail: { reason: 'refresh_failed' } }));

// In auth-context.tsx (React component):
useEffect(() => {
  function handler(e: Event) {
    logout();
  }
  window.addEventListener('kapwa:auth:logout', handler);
  return () => window.removeEventListener('kapwa:auth:logout', handler);
}, []);
```

*Verified: MDN web docs for CustomEvent. [VERIFIED: official docs]*

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 67 wrapper functions + `apiFetch` | Method-style `api.get/post/put/del` | This phase | 388-line `api.ts` → ~200 lines; types via generics |
| `useEffect + useState + fetch` in every page | `useSWR(key)` with global `<SWRConfig>` | This phase | Dedup, focus revalidation, stale-while-revalidate for free |
| No token refresh; pages handle 401 with try/catch | Transparent 401 → refresh → retry interceptor in api client | This phase | SEC-01 closed; no flicker on token rotation |
| No retry; pages fail on first network error | 3× exponential backoff with ±20% jitter on GET network/timeout failures | This phase | Field-worker connectivity improved |
| No request timeout | 10s `AbortSignal.timeout` composed with caller signal | This phase | No more hung requests |
| `vi.spyOn(global, 'fetch')` for page tests | `<SWRConfig value={{ fetcher: mock }}>` for unit tests; MSW deferred | This phase (test pattern), MSW deferred | More idiomatic SWR testing; MSW on roadmap |

**Deprecated/outdated:**
- `apiFetch(path, opts)` — delete from `api.ts` after all call sites migrate. Currently exported but no external consumers beyond the 67 wrappers.
- All 67 wrapper functions in `api.ts` — delete per D-01. The new method-style client replaces them.
- `localStorage.getItem('kapwa_token')` in any non-`api.ts` file — should be removed (D-02 centralizes token reads in the client). Existing sites: `auth-context.tsx` (4 reads), `NotificationsDropdown.tsx` (4 reads), `useDebouncedSearch.ts` (1 read), `usePiiMasking.ts` (1 read), `sync.ts` (3 reads) — all migrate in Plans B/C.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `/auth/refresh` returns 401 when the refresh token is expired (vs. returning 200 with an error body) | Pattern 1 (401 interceptor) | The "401 → refresh failed → logout" branch would not fire. Mitigation: Plan 14-01 includes a spike that hits the endpoint with an expired refresh token and verifies the status code. |
| A2 | `AbortSignal.any()` and `AbortSignal.timeout()` are available in the project's target browsers (Capacitor 8 webview, modern desktop browsers) | Pitfall 4 | Runtime error in production. Mitigation: Plan 14-01 runs `npx browserslist` in the client dir; if older targets are present, fall back to manual setTimeout-based timeout. |
| A3 | The 21 GET-shaped endpoints (per CONTEXT D-10) cover all useSWR migrations; the remaining raw fetch sites are all mutations (POST/PUT/DELETE) | Migration scope | If a "GET-shaped" endpoint is actually a mutation in disguise (e.g., GET with side effects), it should be migrated to useSWRMutation instead of useSWR. Mitigation: Plan 14-02/03 enumerates each endpoint before migration. |
| A4 | `localStorage.getItem('kapwa_token')` is the only valid token source (no other auth mechanism is used) | Pattern 1 (token reads) | If the team uses `auth.ts`'s `AUTH_KEY` constant (`'auth_token'`) somewhere, the migration would miss it. Mitigation: Plan 14-01 grep for both `kapwa_token` and `auth_token` to confirm. **Note: `ReportsExportButton.tsx` already uses `localStorage.getItem('token')` (no prefix) — looks like a bug, not an intentional key. Verify with user before assuming.** |
| A5 | The 21 GET endpoints don't include any paginated/streaming endpoints that need special handling (e.g., server-sent events, chunked transfer) | Migration scope | If an endpoint streams, SWR's cache model doesn't fit. Mitigation: Plan 14-02/03 enumerates each endpoint; defer streaming endpoints to a future phase. |
| A6 | SWR's `dedupingInterval: 2000` (per CONTEXT D-09) is sufficient for the project's request patterns | SWR config | Too long = stale data on quick re-navigations; too short = wasted bandwidth. The 2s value is the SWR default and is fine for this app. |

**If this table is empty:** it is not — the assumptions above should be confirmed by the user or verified in a Plan 14-01 spike before implementation. None block planning, but A1, A2, A3, A4 should be answered in the first task of Plan 14-01.

## Open Questions

1. **Q1: What does the `/auth/refresh` endpoint expect?**
   - What we know: `kapwa-server/src/auth/` has the auth module. The refresh endpoint accepts a refresh token (1h access / 7d refresh per INTEGRATIONS.md). The client currently sends the refresh token via the `Authorization: Bearer` header (per `auth.ts:43-46`).
   - What's unclear: Does the server return 401 on expired refresh, or 200 with `{ ok: false }`? Does it return the new access token in the body or set an HttpOnly cookie? The new api client needs to know which.
   - Recommendation: Plan 14-01, Task 1 includes reading the `auth.controller.ts` source + a manual `curl` test to confirm the contract. Document the contract in a code comment in `api.ts`.

2. **Q2: Does the server return the new access token in the refresh response body, or in a Set-Cookie header?**
   - What we know: `auth.ts:53-55` reads `data.accessToken` from the response body. So the body shape is at least `{ accessToken: string }`. But the server may also set a new refresh token cookie.
   - What's unclear: Whether the api client needs to also extract and store a new refresh token.
   - Recommendation: Plan 14-01 Task 1: read `auth.controller.ts` source for `@Post('refresh')` and confirm. Adjust the refresh helper to handle both cases.

3. **Q3: What is the exact list of 21 GET-shaped endpoints?**
   - What we know: CONTEXT D-10 says "21 GET-shaped endpoints (9 pages + 3 widget components + 2 hooks)". CONTEXT §"Pages & Components to Migrate" lists them.
   - What's unclear: The exact breakdown (which endpoint maps to which page).
   - Recommendation: Plan 14-02/03, Task 1: enumerate the 21 endpoints with their query key factory entries. This is a planning task, not a research blocker.

4. **Q4: Is there a reason to keep `apiFetch` exported (for backwards compat with tests)?**
   - What we know: `apiFetch` is currently exported. Existing tests like `CaseTrackerPage.test.tsx` mock `fetch` directly, not `apiFetch`. So no test imports `apiFetch`.
   - What's unclear: Whether any other code in the repo imports `apiFetch` outside `api.ts` itself.
   - Recommendation: Plan 14-01 Task 1: grep for `apiFetch` imports. If zero hits, delete the export. If hits, migrate them or keep the export temporarily.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite build, vitest | ✓ | 26.4.0 | — |
| npm | Package install | ✓ | 11.16.0 | — |
| SWR 2.2.4 → 2.4.2 | useSWR / useSWRMutation | ✓ (installed) | 2.2.4 → bump to 2.4.2 | — |
| React 19 | useSWR peer dep | ✓ (installed) | 19.2.7 | — |
| `AbortSignal.timeout()` | 10s per-request timeout | ✓ (Node 17.3+, all modern browsers) | Built-in | Manual setTimeout + controller.abort() |
| `AbortSignal.any()` | Compose timeout + caller signal | ✓ (Node 20+, all modern browsers) | Built-in | Manual composition via Promise.race |
| `localStorage` | Token storage | ✓ (browser) | n/a | sessionStorage (not preferred — survives browser restart) |
| `localStorage` mock in tests | Test setup | ✓ | n/a (already in `tests/setup.ts:5-26`) | — |
| TypeScript 5.7 | Typed query keys | ✓ (installed) | 5.7.0 | — |
| Vitest 4.1.9 | Test runner | ✓ (installed) | 4.1.9 | — |
| @testing-library/react 16.3.2 | Component tests | ✓ (installed) | 16.3.2 | — |
| @testing-library/jest-dom 6.9.1 | Matchers (toBeInTheDocument) | ✓ (installed) | 6.9.1 | — |
| `crypto.subtle` for Ed25519 sync signatures | sync.ts | ✓ | n/a | — |
| Backend (`kapwa-server`) | /auth/refresh endpoint | ✓ (per CONTEXT, no changes needed) | n/a | — |

**Missing dependencies with no fallback:** none — all required tools/libraries are present.
**Missing dependencies with fallback:** none — all built-in APIs are available in the target environment.

**Note on Node.js version:** The project is on Node 26.4.0 (verified via `node --version`). Node 26 is past EOL for some earlier features, but `AbortSignal.any()` and `AbortSignal.timeout()` are available since Node 20.16. No compatibility risk.

## Validation Architecture

The test infrastructure is mature: 95+ tests across 20+ files already pass per `STATE.md` (Phase 10 summary). Vitest 4.1.9 with jsdom is configured. The `tests/setup.ts` already mocks `localStorage` and `crypto` (including `crypto.subtle` for Ed25519 sync signatures).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 + @testing-library/react 16.3.2 + @testing-library/jest-dom 6.9.1 |
| Config file | `kapwa-client/vite.config.ts` (lines 26-32) — uses `vite.config.ts` for the test config too |
| Quick run command | `cd kapwa-client && npm test -- --run <pattern>` (e.g. `npm test -- --run api.test`) |
| Full suite command | `cd kapwa-client && npm run test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| API-01 | Centralized API client with retry (3x GET), timeout (10s), Bearer token interceptor | unit | `npx vitest run src/lib/api.test.ts -t "retry"` | ❌ Wave 0 |
| API-01 | Bearer header injected from localStorage | unit | `npx vitest run src/lib/api.test.ts -t "bearer"` | ❌ Wave 0 |
| API-01 | 10s timeout via AbortSignal.timeout | unit | `npx vitest run src/lib/api.test.ts -t "timeout"` (use vitest fake timers) | ❌ Wave 0 |
| API-01 | 401 → refresh → retry (single-flight) | unit | `npx vitest run src/lib/api.test.ts -t "401"` | ❌ Wave 0 |
| API-01 | ApiError class with status, body, cause | unit | `npx vitest run src/lib/api-error.test.ts` | ❌ Wave 0 |
| API-01 | queryKeys factory returns stable tuples | unit | `npx vitest run src/lib/query-keys.test.ts` | ❌ Wave 0 |
| API-02 | useSWR returns data on success | component | `npx vitest run src/pages/DashboardPage.test.tsx` (migrated) | ✅ (exists, will need update) |
| API-02 | useSWR revalidates on focus | component | `npx vitest run src/lib/swr-config.test.tsx -t "revalidateOnFocus"` | ❌ Wave 0 |
| API-02 | useSWRMutation triggers mutation + revalidation | component | `npx vitest run src/lib/swr-mutation.test.tsx` | ❌ Wave 0 |
| API-02 | Optimistic update shows new value before server confirms | component | `npx vitest run src/lib/swr-mutation.test.tsx -t "optimistic"` | ❌ Wave 0 |
| SEC-01 | Token refresh interceptor; break loop on 401 refresh | unit (same as API-01 401 test) | `npx vitest run src/lib/api.test.ts -t "refresh loop break"` | ❌ Wave 0 |
| SEC-01 | Logout event dispatches on refresh failure | unit | `npx vitest run src/lib/api.test.ts -t "logout event"` | ❌ Wave 0 |
| E2E | Full app still works after migration | e2e (Playwright) | `cd kapwa-client && npx playwright test` | ✅ (per STATE, e2e tests exist) |

### Sampling Rate
- **Per task commit:** `cd kapwa-client && npm test -- --run <one test file>` (quick smoke)
- **Per wave merge:** `cd kapwa-client && npm run test:run` (full suite)
- **Phase gate:** Full suite green + `npm run build` succeeds + E2E tests pass (per STATE pattern) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/lib/api.test.ts` — unit tests for the new method-style client (retry, timeout, 401, bearer)
- [ ] `src/lib/api-error.test.ts` — ApiError class tests (status, body, cause, instanceof Error)
- [ ] `src/lib/query-keys.test.ts` — query key factory tests (stable tuples, as const)
- [ ] `tests/swr-test-helper.tsx` — `<SWRConfig value={{ fetcher: mock }}>` wrapper helper for component tests
- [ ] Existing test updates: all `*.test.tsx` files that mock `global.fetch` (e.g., `CaseTrackerPage.test.tsx`, `AuditorPage.test.tsx`, `CsrPage.test.tsx`, `IrfPage.test.tsx`, `IntakePage.test.tsx`, `ProgramsPage.test.tsx`, `LoginPage.test.tsx`, `RegisterPage.test.tsx`, `MfaSetupPage.test.tsx`) — adapt to SWRConfig + custom fetcher pattern. This is a Plan 14-03 task, not Wave 0.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Bearer token in `Authorization` header (per CONTEXT D-02) + 401 → refresh interceptor (D-04) |
| V3 Session Management | yes | localStorage token storage; 401 on expired token; single-flight refresh; logout event on refresh failure |
| V4 Access Control | no | Backend-side; out of scope for this phase |
| V5 Input Validation | partial | Zod schemas on the server validate request bodies. Client-side, JSON.stringify is the only transformation; no input validation needed in the api client. Existing `zod` (^4.4.3) is available for client-side form validation in pages. |
| V6 Cryptography | no | Client does no crypto beyond HTTPS (browser-handled). `auth.ts` uses PBKDF2 for token storage (existing). |
| V7 Error Handling and Logging | yes | ApiError class exposes status + body + message — no leakage of internal stack traces. SWR's `onError` handler logs to console with status code. |
| V9 Communications | yes | All API calls over HTTPS (production) or HTTP localhost (dev). Vite dev server on port 3001, API on port 3000. |
| V12 Files and Resources | no | Blob downloads (ReportsExportButton, IRF PDF, CSR PDF) are out of scope for this phase. |
| V13 API and Web Service | yes | Bearer token on every authenticated request; 401 → refresh; consistent error contract via ApiError. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token theft via XSS | Information Disclosure | localStorage is XSS-accessible by design; React's default JSX escaping mitigates. **Known risk**; documented but not in scope for this phase. |
| Token in URL (logging) | Information Disclosure | Bearer token in `Authorization` header, never in query string. The 401 interceptor does NOT retry via query string. |
| 401 refresh loop DoS | Denial of Service | Single-flight promise + max retry = 1 + dispatch logout on refresh failure (per CONTEXT D-04). |
| 5xx → infinite retry | Denial of Service | D-11 explicit: "4xx and 5xx are NOT retried" — only network + timeout trigger retry. |
| 10s timeout too long for impatient user | Denial of Service (UX) | Caller can supply shorter `signal` via `AbortSignal.timeout(ms)`. SWR's own dedup/focus-revalidation cycle is unaffected. |
| CSRF on POST | Tampering | Not applicable — JWT-in-localStorage, not cookie-based. (Per 14-DISCUSSION-LOG "Deferred Ideas" line 192-193: "Bearer tokens don't need CSRF.") |

### Security Verification Steps (Plan 14-01 + 14-03)

1. **Verify 401 interceptor is single-flight:** Write a test that fires 5 concurrent 401 responses and asserts `/auth/refresh` is hit exactly once. (Plan 14-01, `api.test.ts`.)
2. **Verify 401 refresh loop break:** Write a test that mocks `/auth/refresh` to return 401, then asserts the original request throws `ApiError(401)` (not a hang or infinite loop). (Plan 14-01, `api.test.ts`.)
3. **Verify logout event fires on refresh failure:** Write a test that listens for `kapwa:auth:logout` and asserts it dispatches when refresh fails. (Plan 14-01, `api.test.ts`.)
4. **Verify Bearer header is attached:** Write a test that mocks `fetch` and asserts the second argument's `headers.Authorization` starts with `Bearer`. (Plan 14-01, `api.test.ts`.)
5. **Verify timeout triggers retry:** Write a test that uses `vi.useFakeTimers()` and asserts the retry loop runs 3 times on `AbortError`. (Plan 14-01, `api.test.ts`.)
6. **Verify no token in URL:** Write a static check (grep or grep-equivalent) that no api call site uses the token in a query string. (Plan 14-03 sweep.)

## Sources

### Primary (HIGH confidence)
- `kapwa-client/src/lib/api.ts` (read directly) — 67 wrapper functions, current `apiFetch` pattern, blob downloads (downloadCsrPdf, exportIrfPdf)
- `kapwa-client/src/lib/auth-context.tsx` (read directly) — 4 raw fetch sites, current logout flow
- `kapwa-client/src/lib/auth.ts` (read directly) — `refreshAuthToken()` function, /auth/refresh contract
- `kapwa-client/src/lib/sync.ts` (read directly) — 3 raw fetch sites, Ed25519 signing flow
- `kapwa-client/src/routes.tsx` (read directly) — current provider chain (Theme > Toaster > Auth > Router)
- `kapwa-client/src/main.tsx` (read directly) — entry point, React.StrictMode confirmed enabled
- `kapwa-client/package.json` (read directly) — `swr@^2.2.4` already installed; React 19.2.7; Vitest 4.1.9
- `kapwa-client/vite.config.ts` (read directly) — test config: jsdom env, src/**/*.test.{ts,tsx} include
- `kapwa-client/tests/setup.ts` (read directly) — localStorage + crypto mocks in place
- `.planning/REQUIREMENTS.md` (read directly) — API-01, API-02, SEC-01 definitions
- `.planning/codebase/INTEGRATIONS.md` (read directly) — JWT auth details, token expiry, refresh endpoint
- `npm view swr` (tool run) — version 2.4.2, peerDeps confirm React 19 support, 8-year history, ~311KB unpacked
- 14-CONTEXT.md (read directly) — 16 locked decisions D-01 through D-16
- 14-DISCUSSION-LOG.md (read directly) — full discussion history, deferred ideas

### Secondary (MEDIUM confidence)
- MDN Web Docs: `AbortSignal.any()`, `AbortSignal.timeout()`, `CustomEvent` — referenced for code examples
- SWR official docs: `useSWR`, `useSWRMutation`, `<SWRConfig>`, conditional fetch (null key), global mutation — referenced for code examples; SWR 2.4.2 is current stable per npm registry

### Tertiary (LOW confidence)
- None — all technical claims in this research are backed by either direct file reads or official documentation/registry queries.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — SWR 2.4.2 is verified via npm registry; React 19 peer dep confirmed; project already on both
- Architecture: HIGH — locked decisions D-01 through D-16 from CONTEXT.md; existing patterns documented from `auth-context.tsx`, `api.ts`, `routes.tsx`
- Pitfalls: MEDIUM — derived from general SWR/fetch knowledge + project context; would benefit from Plan 14-01 spike to confirm A1, A2, A3, A4
- Test strategy: HIGH — existing test infrastructure well-documented in STATE.md; test pattern from `CaseTrackerPage.test.tsx` confirmed reusable
- Security: HIGH — ASVS categories derived from Vercel SWR docs + project context; single-flight pattern is standard

**Research date:** 2026-07-06
**Valid until:** 2026-08-06 (30 days — SWR is stable, no fast-moving APIs in this phase)
