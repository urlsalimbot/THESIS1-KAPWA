# Phase 14: API Client & SWR - Pattern Map

**Mapped:** 2026-07-06
**Files analyzed:** 30
**Analogs found:** 18 / 30 (12 new files have no exact analog — patterns come from RESEARCH.md)

## File Classification

### New Files

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `kapwa-client/src/lib/api-error.ts` | utility (error class) | error-handling | `kapwa-client/src/lib/api.ts:11` (existing `throw new Error('API error: ${status}')`) | role-match |
| `kapwa-client/src/lib/query-keys.ts` | utility (cache key factory) | n/a (pure data) | none — new pattern | none |
| `kapwa-client/tests/swr-test-helper.tsx` | test-helper | test-render | `kapwa-client/src/pages/CaseTrackerPage.test.tsx` (test render pattern) | role-match |
| `kapwa-client/src/lib/api-error.test.ts` | test | n/a | `kapwa-client/src/lib/sync-conflict.test.ts` | role-match |
| `kapwa-client/src/lib/query-keys.test.ts` | test | n/a | `kapwa-client/src/lib/offline-queue.test.ts` | role-match |
| `kapwa-client/src/lib/api.test.ts` | test | unit | `kapwa-client/src/lib/sync-conflict.test.ts` | role-match |

### Modified Files

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `kapwa-client/src/lib/api.ts` | service (HTTP client) | request-response (CRUD) | itself (existing `apiFetch` + 67 wrappers) | exact (same file) |
| `kapwa-client/src/routes.tsx` | config (provider) | n/a | itself (existing `MainRoutes` structure) | exact (same file) |
| `kapwa-client/src/lib/auth-context.tsx` | middleware/context | request-response (auth) | itself + `sync.ts:217-220` (online/offline event subscription) | exact (same file) |
| `kapwa-client/src/lib/sync.ts` | service (sync) | request-response (POST mutations) | itself (existing `sendBatch`, `pullFromServer`, `resolveConflictRemotely`) | exact (same file) |
| `kapwa-client/src/hooks/useDebouncedSearch.ts` | hook | request-response (GET, debounced) | itself (existing `useEffect` + debounce + fetch) | exact (same file) |
| `kapwa-client/src/hooks/usePiiMasking.ts` | hook | request-response (POST mutation) | itself (existing `fetch('/api/...')` in `revealField`) | exact (same file) |
| `kapwa-client/src/components/NotificationsDropdown.tsx` | component | request-response (GET + 2 POSTs) | itself (existing `useEffect` + `fetchNotifications`/`markAsRead`) | exact (same file) |
| `kapwa-client/src/components/dashboard/widgets/ClaimantWidgets.tsx` | component | request-response (GET) | itself (existing `useEffect` + `fetch`) | exact (same file) |
| `kapwa-client/src/components/dashboard/widgets/AuditorWidgets.tsx` | component | request-response (GET) | itself (existing `useEffect` + `Promise.all(fetch, fetch)`) | exact (same file) |
| `kapwa-client/src/components/dashboard/widgets/CoordinatorWidgets.tsx` | component | request-response (GET) | itself (existing `useEffect` + `getDashboard()`) | exact (same file) |
| `kapwa-client/src/pages/DashboardPage.tsx` | page | request-response (GET) | itself (existing `useEffect` + `getDashboard()`) | exact (same file) |
| `kapwa-client/src/pages/CasesPage.tsx` | page | request-response (GET + PATCH) | itself (existing `useEffect` + `getCases()`) | exact (same file) |
| `kapwa-client/src/pages/BeneficiariesPage.tsx` | page | request-response (GET) | itself (existing debounced `useEffect` + `getBeneficiaries`) | exact (same file) |
| `kapwa-client/src/pages/AdminPage.tsx` | page | request-response (4 GETs) | itself (existing `useEffect[activeTab]` + 4 fetch fns) | exact (same file) |
| `kapwa-client/src/pages/FilingPage.tsx` | page | request-response (GET + POST + DELETE) | itself (existing `useEffect` + fetch; **note: blob download stays raw**) | exact (same file) |
| 16 Plan C pages | page | request-response | pattern from `DashboardPage.tsx` (useState+useEffect+fetch) | role-match |

### Test Files To Update

| Test File | Role | Data Flow | Current Pattern | New Pattern |
|-----------|------|-----------|-----------------|-------------|
| `src/pages/CaseTrackerPage.test.tsx` | test | `vi.stubGlobal('fetch')` | raw fetch spy | SWRConfig wrapper with mock fetcher |
| `src/pages/CasesPage.test.tsx` | test | `vi.mock('../lib/api')` | mock the api module | mock the api module (unchanged approach) |
| `src/pages/BeneficiariesPage.test.tsx` | test | `vi.mock('../lib/api')` | mock the api module | mock the api module (unchanged approach) |
| `src/pages/DashboardPage.test.tsx` | test | `vi.mock('../lib/api')` | mock the api module | mock the api module (unchanged approach) |

## Pattern Assignments

### `kapwa-client/src/lib/api.ts` (REWRITE — service, request-response)

**Analog:** itself (existing `apiFetch` + 67 wrappers, lines 1-13)

The new `api.ts` keeps the existing skeleton and adds: method-style exports, retry-with-jitter, timeout via `AbortSignal.timeout`, single-flight 401 refresh, and a custom `ApiError` class.

**Existing skeleton to preserve** (lines 1-13):
```typescript
const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export async function apiFetch(path: string, options: RequestInit & { signal?: AbortSignal } = {}) {
  const token = localStorage.getItem('kapwa_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
```

**Existing token-read pattern** (also at `sync.ts:8-10`, `NotificationsDropdown.tsx:31,41,51,61`, `useDebouncedSearch.ts:27`, `usePiiMasking.ts` implicit):
```typescript
const token = localStorage.getItem('kapwa_token');
headers['Authorization'] = `Bearer ${token}`;
```

**Existing raw-fetch-with-auth pattern** (e.g., `auth.ts:43-46` — used for the refresh endpoint itself; **must NOT migrate** per CONTEXT D-15):
```typescript
const apiUrl = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000/api';
const res = await fetch(`${apiUrl}/auth/refresh`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${refresh}` }
});
```

**Existing FormData + Bearer pattern** (lines 203-229 — `uploadSignature`/`uploadReceipt`; **keep raw fetch** since they send multipart bodies):
```typescript
const token = localStorage.getItem('kapwa_token');
const formData = new FormData();
formData.append('file', file, fileName);
const res = await fetch(`${API}/interventions/upload-signature`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: formData,
});
```

**Existing blob-download pattern** (lines 127-140, `downloadCsrPdf`; **keep raw fetch** since the client must call `URL.createObjectURL` on the response):
```typescript
const res = await fetch(`${API}/csr/${controlNo}/pdf`, {
  headers: token ? { Authorization: `Bearer ${token}` } : {},
});
if (!res.ok) throw new Error('PDF download failed');
const blob = await res.blob();
const url = URL.createObjectURL(blob);
```

**Test pattern to delete+replace:** the `apiFetch` + wrapper exports are mocked in many tests via:
```typescript
vi.mock('../lib/api', () => ({
  getCases: () => Promise.resolve(mockCases),
  // ...
}));
```
This pattern (`CasesPage.test.tsx:27-33`) **still works** for Plan B/C page tests if we keep the wrapper function names. Plan A rewrites `api.ts` to method-style and **deletes all wrappers** — existing page tests will need to migrate to mocking `api.get/post/put/del` directly OR use the SWRConfig-with-mock-fetcher pattern (see `tests/swr-test-helper.tsx`).

---

### `kapwa-client/src/lib/api-error.ts` (NEW — utility, error class)

**Analog:** `api.ts:11` (`throw new Error('API error: ${status}')`) — the existing pattern throws a generic `Error` with status embedded in the message. The new `ApiError` class preserves `instanceof Error` and adds structured access to `status`, `body`, and `cause`.

**Class to implement (per CONTEXT D-03 + RESEARCH Pattern 1):**
```typescript
export class ApiError extends Error {
  status: number;
  body: unknown;
  cause?: unknown;

  constructor(status: number, body: unknown, message?: string, cause?: unknown) {
    super(message ?? `API error: ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.cause = cause;
  }
}
```

**No existing analog in the codebase** for a typed error class. The pattern is novel for this project; shape follows JavaScript `Error` subclass convention (per MDN, `Error` subclassing is standard).

---

### `kapwa-client/src/lib/query-keys.ts` (NEW — utility, pure data)

**Analog:** none — the factory pattern is new. Closest mental analog is the constants file at `kapwa-client/src/lib/constants.ts` (a `Record<string, …>` of static values), but `queryKeys` is a tree of functions returning `as const` tuples.

**Shape to implement (per CONTEXT D-07):**
```typescript
export const queryKeys = {
  cases: {
    all: ['cases'] as const,
    list: (params?: { status?: string; page?: number }) =>
      ['cases', 'list', params ?? {}] as const,
    detail: (id: string) => ['cases', 'detail', id] as const,
  },
  beneficiaries: {
    all: ['beneficiaries'] as const,
    list: (params?: { search?: string; category?: string; barangay?: string; page?: number }) =>
      ['beneficiaries', 'list', params ?? {}] as const,
    detail: (id: string) => ['beneficiaries', 'detail', id] as const,
  },
  // ... 21 endpoints total per CONTEXT D-10
} as const;
```

**Why `as const` tuples matter:** SWR uses **reference equality** to dedup cache entries. An inline `['cases', 'list', { status }]` creates a new array on every render, causing re-fetches. The `as const` factory returns a stable reference per (resource, params) combination. This is captured in RESEARCH.md Pitfall 2.

---

### `kapwa-client/src/routes.tsx` (MODIFY — add `<SWRConfig>` provider)

**Analog:** itself (current `MainRoutes` lines 88-97). The pattern to copy is the **provider nesting order**: `ThemeProvider` → `Toaster` → `AuthProvider` → `<SWRConfig>` (NEW) → `RouterProvider`. The `<SWRConfig>` must be **inside** `AuthProvider` (so `api.get` reads the token) but **outside** `RouterProvider` (so all routes can call `useSWR`).

**Current shape (lines 88-97):**
```tsx
export function MainRoutes() {
  return (
    <ThemeProvider>
      <Toaster position="top-center" duration={Infinity} />
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  );
}
```

**Modified shape (per CONTEXT D-06 + RESEARCH Pattern 3):**
```tsx
import { SWRConfig } from 'swr';
import { api } from './lib/api';
import { ApiError } from './lib/api-error';

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

**Why this nesting:** `AuthProvider` must be above `<SWRConfig>` so the auth-context's logout-on-401-refresh-failure subscriber is registered before any `useSWR` call fires. `RouterProvider` must be inside `<SWRConfig>` so all pages can consume the fetcher.

---

### `kapwa-client/src/lib/auth-context.tsx` (MODIFY — add logout-event subscriber)

**Analog for the subscriber pattern:** the existing `useEffect`+`addEventListener` pattern in `sync.ts:217-220` and `Layout.tsx:65-67` (online/offline events). The new pattern adds a `kapwa:auth:logout` custom event subscriber that calls the existing `logout()` function (lines 84-88).

**Existing `logout()` to reuse** (lines 84-88):
```typescript
function logout() {
  localStorage.removeItem('kapwa_token');
  setToken(null);
  setUser(null);
}
```

**Subscriber to add inside `AuthProvider` (per CONTEXT Integration Points + RESEARCH Pattern 5):**
```typescript
useEffect(() => {
  function handleLogout(e: Event) {
    const reason = (e as CustomEvent).detail?.reason || 'unknown';
    console.warn('Auth logout triggered:', reason);
    logout();
  }
  window.addEventListener('kapwa:auth:logout', handleLogout);
  return () => window.removeEventListener('kapwa:auth:logout', handleLogout);
}, []);
```

**Why custom event instead of `useAuth` import in `api.ts`:** the api client is a plain JS module (no React). Hooks can only run inside components. The existing project pattern for module→React communication is `window.addEventListener` (see `Layout.tsx:67` for the `storage` event, `sync.ts:218` for the `online` event).

**What to leave raw-fetch per CONTEXT D-15:**
- `/auth/login` (line 49) — pre-auth, no token to attach
- `/auth/mfa/verify` (line 67) — uses tempToken, not Bearer
- `/auth/me` in `getCurrentUser` (line 101) — **MIGRATE to `api.get`** (it has a token)

---

### `kapwa-client/src/lib/sync.ts` (MODIFY — migrate 3 fetch calls to `api.post`)

**Analog:** itself (lines 88-101 `sendBatch`, 167-174 `pullFromServer`, 193-200 `resolveConflictRemotely`).

**Existing pattern** (lines 88-101, `sendBatch`):
```typescript
const res = await fetch(`${API_URL}/sync/v1`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({ deviceId, changes, versionVectors, idempotencyKey, signature }),
});
if (!res.ok) {
  const errText = await res.text();
  throw new Error(`Sync failed (${res.status}): ${errText}`);
}
return res.json();
```

**Migration target:**
```typescript
return api.post<{ status: string; results: any[]; serverVersionVectors: ...; serverChanges: ... }>(
  '/sync/v1',
  { deviceId, changes: changesPayload, versionVectors, idempotencyKey, signature }
);
```

**Apply to all 3 sites** — `sendBatch` (line 88), `pullFromServer` (line 167), `resolveConflictRemotely` (line 193). The local `getToken()` helper (lines 8-10) can be deleted; the new `api.post` reads the token itself.

**Keep raw fetch for:** none — sync.ts is not on the refresh path (per CONTEXT D-15, sync.ts can fully migrate).

**Important:** `sync.ts` is consumed by the offline-queue path. Tests that mock `fetch` for sync behavior will need to update to mock `api.post` (see `sync-conflict.test.ts` and `offline-queue.test.ts` for the existing test approach).

---

### `kapwa-client/src/hooks/useDebouncedSearch.ts` (MODIFY — migrate to `useSWR`)

**Analog:** itself (lines 16-46 — `useEffect` + `setTimeout` + `fetch` + `setLoading`).

**Existing pattern** (lines 16-46):
```typescript
useEffect(() => {
  if (!query.trim()) {
    setResults([]);
    setLoading(false);
    return;
  }
  const timer = setTimeout(async () => {
    setLoading(true);
    const controller = new AbortController();
    try {
      const token = localStorage.getItem('kapwa_token');
      const q = encodeURIComponent(query.trim());
      const res = await fetch(`${API_URL}/beneficiaries?search=${q}&limit=${limit}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.data ?? data ?? []);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setResults([]);
    } finally {
      setLoading(false);
    }
    return () => controller.abort();
  }, delay);
  return () => clearTimeout(timer);
}, [query, delay, limit]);
```

**Migration target** (using `useSWR` with a debounced key):
```typescript
import useSWR from 'swr';
import { queryKeys } from '@/lib/query-keys';
// DELETE: local API_URL constant, localStorage token read, AbortController

export function useDebouncedSearch(query: string, delay = 300, limit = 10) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), delay);
    return () => clearTimeout(t);
  }, [query, delay]);

  const swrKey = debouncedQuery.trim()
    ? queryKeys.beneficiaries.list({ search: debouncedQuery.trim(), limit })
    : null;

  const { data, isLoading } = useSWR<unknown[]>(swrKey, {
    keepPreviousData: true,
  });

  return { results: data ?? [], loading: isLoading };
}
```

**Pitfall:** if the search key is constructed inline, SWR re-fetches on every render. Always use the `queryKeys` factory — the tuple it returns is reference-stable per input.

---

### `kapwa-client/src/hooks/usePiiMasking.ts` (MODIFY — migrate `revealField` to `api.post`)

**Analog:** itself (lines 32-50 — the `revealField` function uses raw `fetch`).

**Existing pattern** (lines 37-41):
```typescript
await fetch(`/api/beneficiaries/${beneficiaryId}/audit/unmask`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ field, reason }),
});
```

**Migration target:**
```typescript
await api.post(`/beneficiaries/${beneficiaryId}/audit/unmask`, { field, reason });
```

This is a mutation, NOT a cache-invalidation target. Per RESEARCH Pattern 4, mutations use `useSWRMutation`, but for fire-and-forget operations (like a side-effect audit log), calling `api.post` directly is sufficient. The `useSWRMutation` pattern applies only when the mutation result needs to feed into the SWR cache.

**Note on URL prefix:** the existing code uses `/api/...` (relative), but the api client appends to `VITE_API_URL` which already includes `/api`. Plan A's rewrite should normalize this — either keep `/api/...` and update the client base, or strip the `/api` prefix when calling `api.post`.

---

### `kapwa-client/src/components/NotificationsDropdown.tsx` (MODIFY — 2 GETs + 2 POSTs)

**Analog:** itself (lines 17-69 — `useState` for `notifications` + `unreadCount`, `useEffect` for initial fetch + 30s interval, 4 raw fetch calls).

**Existing pattern** (lines 22-46):
```typescript
const [notifications, setNotifications] = useState<Notification[]>([]);
const [unreadCount, setUnreadCount] = useState(0);

useEffect(() => {
  fetchNotifications();
  fetchUnreadCount();
  const interval = setInterval(fetchUnreadCount, 30000);
  return () => clearInterval(interval);
}, []);

async function fetchNotifications() {
  const token = localStorage.getItem('kapwa_token');
  const res = await fetch(`${API_URL}/notifications/my`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok) setNotifications(await res.json());
}

async function fetchUnreadCount() {
  const token = localStorage.getItem('kapwa_token');
  const res = await fetch(`${API_URL}/notifications/unread`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok) { const data = await res.json(); setUnreadCount(data.count); }
}
```

**Migration target** (per CONTEXT D-08 + RESEARCH Pattern 3/4):
```typescript
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { mutate } from 'swr';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

const { data: notifications, isLoading: notifsLoading } = useSWR<Notification[]>(
  queryKeys.notifications.list()
);
const { data: unreadData } = useSWR<{ count: number }>(
  queryKeys.notifications.unreadCount(),
  { refreshInterval: 30000 }  // poll every 30s — replaces the setInterval
);
const unreadCount = unreadData?.count ?? 0;

const { trigger: markRead } = useSWRMutation(
  queryKeys.notifications.list(),
  async (url, { arg }: { arg: { id: string } }) => {
    await api.post(`/notifications/${arg.id}/read`);
    return { id: arg.id };
  },
  {
    optimisticData: (current) =>
      current?.map(n => n.id === arg.id ? { ...n, isRead: true } : n),
    revalidate: false,
    onSuccess: () => {
      mutate(queryKeys.notifications.unreadCount(), undefined, { revalidate: true });
    },
  }
);
```

**Pattern to copy:** the `optimisticData` + manual `mutate` pattern from RESEARCH Pattern 4.

---

### `kapwa-client/src/components/dashboard/widgets/ClaimantWidgets.tsx` (MODIFY — 1 GET)

**Analog:** itself (lines 22-52 — `useEffect` + `fetch` + `setData`).

**Existing pattern** (lines 22-52):
```typescript
const [data, setData] = useState<ClaimantData | null>(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const controller = new AbortController();
  loadData(controller.signal);
  return () => controller.abort();
}, []);

async function loadData(signal?: AbortSignal) {
  try {
    const token = localStorage.getItem('kapwa_token');
    const res = await fetch(`${API_URL}/beneficiaries/me/services`, {
      signal,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const d = await res.json();
      setData({ caseStatus: d.caseStatus || 'No active case', services: d.services || [] });
    }
  } catch {} finally { setLoading(false); }
}
```

**Migration target:**
```typescript
import useSWR from 'swr';
import { queryKeys } from '@/lib/query-keys';

const { data, isLoading } = useSWR<{ caseStatus?: string; services?: ServiceRecord[] }>(
  queryKeys.beneficiaries.myServices()  // NEW key — add to factory in Plan A
);
const mapped = data ? { caseStatus: data.caseStatus || 'No active case', services: data.services || [] } : null;
```

---

### `kapwa-client/src/components/dashboard/widgets/AuditorWidgets.tsx` (MODIFY — 2 GETs + 1 GET mutation)

**Analog:** itself (lines 9-53 — two `useEffect`+`fetch` blocks, one for `loadAll` Promise.all, one for `handleReVerify`).

**Existing pattern** (lines 19-41 — `loadAll` uses `Promise.all([fetch, fetch])`):
```typescript
const [hashChain, setHashChain] = useState(...);
const [consentCount, setConsentCount] = useState<number | null>(null);
const [loading, setLoading] = useState(true);
const [verifying, setVerifying] = useState(false);

useEffect(() => { loadAll(); }, []);

async function loadAll() {
  setLoading(true);
  try {
    const token = localStorage.getItem('kapwa_token');
    const [hashRes, ledgerRes] = await Promise.all([
      fetch(`${API_URL}/audit/verify-all`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_URL}/audit/consent-ledger`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    if (hashRes.ok) setHashChain(await hashRes.json());
    if (ledgerRes.ok) {
      const ledger = await ledgerRes.json();
      setConsentCount(Array.isArray(ledger) ? ledger.length : 0);
    }
  } catch {} finally { setLoading(false); }
}

async function handleReVerify() {
  setVerifying(true);
  try {
    const data = await verifyHashChains();
    setHashChain(data);
  } catch {} finally { setVerifying(false); }
}
```

**Migration target** (per CONTEXT D-10, AuditorPage and widgets are 2 of the 3 widget migrations):
```typescript
import useSWR from 'swr';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

const { data: hashChain, isLoading: loading, mutate: revalidateHash } = useSWR(
  queryKeys.audit.hashChains()  // NEW key
);
const { data: ledger } = useSWR(
  queryKeys.audit.consentLedger(),  // NEW key
  { refreshInterval: 0 }  // no polling; re-verified on demand
);
const consentCount = Array.isArray(ledger) ? ledger.length : 0;

async function handleReVerify() {
  setVerifying(true);
  try {
    await revalidateHash();  // SWR's mutate refetches the key
  } finally { setVerifying(false); }
}
```

**Pattern to copy:** when a `useSWR` mutation simply refetches the same key, destructure `mutate` from the hook itself (don't need `useSWRMutation`). This is the SWR idiomatic revalidation pattern.

---

### `kapwa-client/src/components/dashboard/widgets/CoordinatorWidgets.tsx` (MODIFY — 1 GET)

**Analog:** itself (lines 21-37 — `useEffect` + `getDashboard()`). Note: CoordinatorWidgets already uses the `getDashboard` wrapper from `api.ts`. The migration just changes the import to `api.get` and adds the SWR hook.

**Existing pattern** (lines 21-37):
```typescript
useEffect(() => { loadData(); }, []);

async function loadData() {
  try {
    const data = await getDashboard();
    setCaseCount(data.pendingReview || 0);
    setServedToday(data.servedToday || 0);
    // ...
  } catch {} finally { setLoading(false); }
}
```

**Migration target:**
```typescript
import useSWR from 'swr';
import { queryKeys } from '@/lib/query-keys';

const { data, isLoading } = useSWR(queryKeys.dashboard.stats());
const caseCount = data?.pendingReview ?? 0;
const servedToday = data?.servedToday ?? 0;
// ...
```

**Pattern to copy:** the **destructured fallbacks** (`data?.field ?? 0`) replace the `setX(data.field || 0)` pattern. SWR's `data` is `undefined` while loading — this is the idiomatic shape.

---

### `kapwa-client/src/pages/DashboardPage.tsx` (MODIFY — 1 GET) — Plan B Top 5

**Analog:** itself (lines 90-129 — `useState` × 4 + `useEffect` + `loadData` + 3 error-state `setStats(...)` calls).

**Existing pattern** (lines 99-129):
```typescript
const [stats, setStats] = useState<Stat[]>([]);
const [cases, setCases] = useState<CaseRow[]>([]);
const [loading, setLoading] = useState(true);
const [lastSync, setLastSync] = useState<number | null>(null);

useEffect(() => {
  const controller = new AbortController();
  if (WORKER_ROLES.includes(role)) loadData();
  else setLoading(false);
  return () => controller.abort();
}, [role]);

async function loadData(signal?: AbortSignal) {
  try {
    const data = await getDashboard();
    setStats([ /* map data fields to 4 stat cards */ ]);
    setCases(data.recentCases || []);
    setLastSync(Date.now());
  } catch {
    setStats([ /* fallback offline values */ ]);
  }
  setLoading(false);
}
```

**Migration target** (per RESEARCH Pattern 3):
```typescript
import useSWR from 'swr';
import { queryKeys } from '@/lib/query-keys';

const swrKey = WORKER_ROLES.includes(role) ? queryKeys.dashboard.stats() : null;
const { data, isLoading } = useSWR<DashboardData>(swrKey);
const loading = isLoading;
const stats = useMemo(() => data ? mapStats(data) : offlineStats, [data]);
const cases = data?.recentCases ?? [];
const lastSync = data ? Date.now() : null;
```

**Pattern to copy:**
1. **Conditional fetch with `null` key** — `useSWR(null)` skips the fetch. The existing `WORKER_ROLES.includes(role)` gate becomes the conditional in the key.
2. **Memoize the mapped result** — wrap `mapStats(data)` in `useMemo` to keep the reference stable. Without memoization, the stats array is a new reference on every render and downstream `React.memo` (e.g., `StatCard`) loses its optimization.
3. **Keep the offline-fallback stat set** — it's a `useMemo` with empty deps, same as before.

**Files used as reference for this pattern:** RESEARCH Pattern 3 example, `useDebouncedSearch.ts` (also conditional fetch).

---

### `kapwa-client/src/pages/CasesPage.tsx` (MODIFY — 1 GET + 4 PATCH mutations) — Plan B Top 5

**Analog:** itself (lines 48-131 — `useState` × 5 + `useEffect` + `loadCases` + `handleAction` switch over `requestReview`/`disburseCase`/`closeCase`/`overrideCaseStatus`).

**Existing pattern** (lines 58-94, 96-131):
```typescript
const [cases, setCases] = useState<CaseRow[]>([]);
const [search, setSearch] = useState('');
const [loading, setLoading] = useState(true);
const [actionLoading, setActionLoading] = useState<string | null>(null);
const [lastSync, setLastSync] = useState<number | null>(null);

useEffect(() => {
  const controller = new AbortController();
  loadCases();
  return () => controller.abort();
}, []);

async function loadCases() {
  try {
    const data = await getCases();
    const mapped = (data || []).map(/* complex mapping */);
    setCases(mapped);
    setLastSync(Date.now());
  } catch { setCases([]); }
  setLoading(false);
}

async function handleAction(action: string, caseId: string) {
  setActionLoading(caseId);
  try {
    switch (action) {
      case 'request-review': /* ... */ await requestReview(caseId); break;
      case 'disburse': /* ... */ await disburseCase(caseId); break;
      case 'close': /* ... */ await closeCase(caseId); break;
    }
    await loadCases();  // refetch the list after mutation
  } catch (err) { /* ... */ }
  setActionLoading(null);
}
```

**Migration target** (per RESEARCH Pattern 4):
```typescript
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { mutate } from 'swr';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

const { data, isLoading } = useSWR<RawCase[]>(queryKeys.cases.list());
const cases = useMemo(() => (data || []).map(/* same mapping */), [data]);
const loading = isLoading;

const { trigger: requestReview, isMutating: isRequesting } = useSWRMutation(
  queryKeys.cases.all,
  (url, { arg }: { arg: { id: string } }) => api.patch(`/cases/${arg.id}/request-review`)
);
// ... similar for disburse, close, override

async function handleAction(action: string, caseId: string) {
  try {
    switch (action) {
      case 'request-review':
        if (!isOnline()) { await queueFsmTransition(caseId, 'in_review'); return; }
        await requestReview({ id: caseId });
        break;
      // ...
    }
    // Pattern: revalidate all case queries (list + detail)
    await mutate(queryKeys.cases.all, undefined, { revalidate: true });
  } catch (err) { /* ... */ }
}
```

**Pattern to copy:**
1. **The mapping function stays the same** — it was working; SWR just feeds it different data.
2. **Mutations use the `queryKeys.cases.all` key** — this lets the page's own `useSWRMutation` work AND lets `mutate(queryKeys.cases.all, ...)` revalidate the list query (SWR's prefix-matching revalidation per RESEARCH Pitfall 7).
3. **Drop the local `actionLoading` state** — `useSWRMutation` returns `isMutating` per-hook. If multiple actions are in flight, use a `Map` or just disable all buttons while any is mutating.
4. **Keep the `isOnline()` check** — the offline-queue path (line 101) is independent of SWR; don't touch it.

---

### `kapwa-client/src/pages/BeneficiariesPage.tsx` (MODIFY — 1 GET with debounced params) — Plan B Top 5

**Analog:** itself (lines 61-130 — `useState` × 7 + manual debounce `useEffect` lines 73-78 + `load` function lines 81-100).

**Existing pattern** (lines 72-100):
```typescript
const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
const [searchInput, setSearchInput] = useState('');
const [debouncedSearch, setDebouncedSearch] = useState('');
const [categoryFilter, setCategoryFilter] = useState('');
const [barangayFilter, setBarangayFilter] = useState('all');
const [loading, setLoading] = useState(true);
const [fetching, setFetching] = useState(false);
const [lastSync, setLastSync] = useState<number | null>(null);

// Manual debounce
useEffect(() => {
  const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
  return () => clearTimeout(timer);
}, [searchInput]);

// Refetch on debounced changes
useEffect(() => {
  let cancelled = false;
  async function load() {
    setFetching(true);
    try {
      const params: Record<string, string> = {};
      // ... build params
      const data = await getBeneficiaries(hasParams ? params : undefined);
      if (cancelled) return;
      // ... map data to Beneficiary[]
      setBeneficiaries(mapped);
      setLastSync(Date.now());
    } catch { /* ... */ }
    setFetching(false);
  }
  load();
  return () => { cancelled = true; };
}, [debouncedSearch, categoryFilter, barangayFilter]);
```

**Migration target** (per RESEARCH Pattern 3 + `useDebouncedSearch` migration):
```typescript
import useSWR from 'swr';
import { queryKeys } from '@/lib/query-keys';

const swrKey = (debouncedSearch || categoryFilter || barangayFilter !== 'all')
  ? queryKeys.beneficiaries.list({ search: debouncedSearch, category: categoryFilter, barangay: barangayFilter === 'all' ? undefined : barangayFilter })
  : queryKeys.beneficiaries.list();

const { data, isLoading } = useSWR<RawBeneficiary[]>(swrKey, { keepPreviousData: true });
const beneficiaries = useMemo(() => (data || []).map(/* same mapping */), [data]);
const loading = isLoading;
```

**Pattern to copy:**
1. **`keepPreviousData: true`** — when the user types in the search box, the previous results stay visible until the new ones arrive. This is a SWR 2.x feature and replaces the `useState` for `lastSync` and the local `cancelled` flag.
2. **The manual debounce `useEffect` stays** — SWR doesn't debounce; you debounce the key, not the request. Keep lines 72-78 as-is.
3. **The `fetching` and `loading` distinction collapses** — SWR's `isLoading` covers both. If you need to show a small spinner during filter changes but keep the table visible, use `isValidating` (true during background revalidation).

---

### `kapwa-client/src/pages/AdminPage.tsx` (MODIFY — 4 GETs based on `activeTab`) — Plan B Top 5

**Analog:** itself (lines 69-76 — `useEffect[activeTab]` triggering `fetchPrograms`/`fetchUsers`/`fetchSyncEntries`/`fetchAuditLogs`).

**Existing pattern** (lines 69-76):
```typescript
const [activeTab, setActiveTab] = useState<string>('programs');
const [programs, setPrograms] = useState<Program[]>([]);
const [syncEntries, setSyncEntries] = useState<SyncEntry[]>([]);
const [users, setUsers] = useState<AppUser[]>([]);
const [loading, setLoading] = useState(true);
// ... auditLogs, editUser, form state ...

useEffect(() => {
  const controller = new AbortController();
  if (activeTab === 'programs') fetchPrograms();
  if (activeTab === 'users') fetchUsers();
  if (activeTab === 'sync') fetchSyncEntries();
  if (activeTab === 'audit') fetchAuditLogs();
  return () => controller.abort();
}, [activeTab]);
```

**Migration target:**
```typescript
import useSWR from 'swr';
import { queryKeys } from '@/lib/query-keys';

// Per-tab SWR hooks — `null` key when tab is inactive
const { data: programs, isLoading: loadingPrograms } = useSWR(
  activeTab === 'programs' ? queryKeys.admin.programs() : null
);
const { data: users, isLoading: loadingUsers } = useSWR(
  activeTab === 'users' ? queryKeys.admin.users() : null
);
const { data: syncEntries, isLoading: loadingSync } = useSWR(
  activeTab === 'sync' ? queryKeys.admin.syncEntries() : null
);
const { data: auditLogs, isLoading: loadingAudit } = useSWR(
  activeTab === 'audit' ? queryKeys.admin.auditLogs() : null
);
const loading = activeTab === 'programs' ? loadingPrograms
              : activeTab === 'users' ? loadingUsers
              : activeTab === 'sync' ? loadingSync
              : loadingAudit;
```

**Pattern to copy:**
1. **One `useSWR` per tab** — separate keys, separate cache slots. Switching tabs back to a previously-visited one returns cached data instantly (SWR's `dedupingInterval`).
2. **The `activeTab === 'X' ? key : null` pattern** — SWR's official conditional fetch (RESEARCH Pattern 3).
3. **The form state stays** — `formEmail`, `formPassword`, `formSubmitting`, etc. are not data-fetching concerns.

---

### `kapwa-client/src/pages/FilingPage.tsx` (MODIFY — 1 GET + 1 POST + 1 DELETE) — Plan B Top 5

**Analog:** itself (lines 18-84 — `useState` × 5 + `useEffect` + `loadDocs` + `handleUpload` + `handleDelete` + `handleDownload`).

**Special case:** the upload (`handleUpload`, lines 42-58), download (`handleDownload`, lines 69-84), and possibly `loadDocs` (with `FormData` body) all use `FormData`/blob bodies. Per RESEARCH Anti-pattern 4 and CONTEXT deferred-ideas, **blob downloads must stay on raw fetch** (different headers, different response handling).

**What to migrate:**
- `loadDocs` GET (line 36) → `api.get`
- `handleDelete` (line 64) → `api.del`

**What to keep raw:**
- `handleUpload` (line 51) — `FormData` body; new `api.post` only takes JSON
- `handleDownload` (line 72) — blob download; needs custom response handling

**Migration target for `loadDocs`:**
```typescript
const { data: docs, isLoading: loading } = useSWR<Document[]>(
  category ? queryKeys.filing.byCategory(category) : queryKeys.filing.all()
);
const lastSync = data ? Date.now() : null;
```

**Migration target for `handleDelete`:**
```typescript
async function handleDelete(id: string) {
  if (!confirm('Delete this document?')) return;
  try {
    await api.del(`/filing/${id}`);
    mutate(queryKeys.filing.all(), undefined, { revalidate: true });
  } catch (e) { console.error("FilingPage:", e); }
}
```

**Pattern to copy:** when an endpoint mixes JSON and non-JSON flows, **only migrate the JSON ones**. The non-JSON ones can be wrapped in a helper later (deferred per CONTEXT deferred-ideas).

---

### 16 Plan C pages (MODIFY — various GETs + mutations)

**Pattern source:** `DashboardPage.tsx`, `CasesPage.tsx`, `BeneficiariesPage.tsx`, `AdminPage.tsx`, `FilingPage.tsx` (the Plan B top 5). All 16 Plan C pages use the same `useState`+`useEffect`+`fetch` boilerplate and migrate to the same `useSWR(key)` pattern.

**Per-page mapping (from CONTEXT §"Pages & Components to Migrate"):**

| Page | Current fetch | New useSWR key | New useSWRMutation |
|------|---------------|----------------|---------------------|
| `IntakePage` | 1 GET | `queryKeys.intake.recent()` | `submitIntake` (POST) |
| `AuditorPage` | 2 GETs | `queryKeys.audit.hashChains()`, `queryKeys.audit.consentLedger()` | — |
| `AccessCardPage` | 1 GET + 1 POST | `queryKeys.accessCards.list()` | `assignCard` |
| `MessagesPage` | 1 GET | `queryKeys.messages.list()` | `sendMessage` |
| `CaseTrackerPage` | 2 GETs | `queryKeys.tracker.daily()`, `queryKeys.tracker.stats()` | — |
| `ClaimantDashboardPage` | 1 GET | `queryKeys.claimant.dashboard()` | — |
| `ApprovalPipelinePage` | 1 GET + 3 PATCHes | `queryKeys.cases.list()` (reuse from `CasesPage`) | `approveCase`, `requestReview`, `updateCaseDocuments` |
| `RegisterPage` | 1 POST (form submit) | — | `registerUser` (no useSWR — direct `api.post`) |
| `MyAccessCardPage` | 1 GET | `queryKeys.beneficiaries.myAccessCard()` | — |
| `IrfPage` | 1 GET | `queryKeys.irf.list()` | `createIrf`, `referToPnp`, etc. |
| `IrfDetailPage` | 1 GET + 3 POSTs | `queryKeys.irf.detail(id)` | `decryptNarration`, `unmaskIrfNames`, `closeIrf` |
| `MayorReportsPage` | 1 GET | `queryKeys.dashboard.mayorReports()` | — |
| `MfaSetupPage` | 1 GET (`/auth/me`) + 3 POSTs | `queryKeys.auth.me()` (uses `api.get`) | `setupMfa`, `enableMfa`, `disableMfa` |
| `AccessCardPrintView` | 1 GET | `queryKeys.accessCards.print(id)` | — |
| `ProgramsPage` | 1 GET + 3 mutations | `queryKeys.programs.list()` | `createProgram`, `updateProgram`, `deleteProgram` |
| `CoordinatorDashboardPage` | 1 GET (same as `DashboardPage`) | `queryKeys.dashboard.stats()` (reuse) | `getCase` (search) |

**Cross-page revalidation pattern:** when one page mutates a resource, another page showing the same resource should revalidate. For example, if `CasesPage` approves a case, `DashboardPage`'s "Recent Cases" widget should refresh. Per RESEARCH Specific Ideas §3, this is achieved via:
```typescript
// In CasesPage after a mutation:
await mutate(queryKeys.cases.all, undefined, { revalidate: true });
// This revalidates ALL keys starting with `['cases']` — covers dashboard's recent-cases list too.
```

**Plan C plan must define the exact `queryKeys` factory entries for all 16 endpoints** (RESEARCH Open Question Q3). The mapping table above is the initial enumeration; refine during Plan 14-03.

---

### `kapwa-client/src/lib/api.test.ts` (NEW — unit test)

**Analog:** `kapwa-client/src/lib/sync-conflict.test.ts` (lines 1-60 — `vi.mock('./database', () => ({...}))` + `describe`/`it` structure with `vi.fn()` for SQLite calls).

**Pattern to copy** (from `sync-conflict.test.ts:5-9`):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from './api';
import { ApiError } from './api-error';

describe('api client', () => {
  beforeEach(() => {
    // mock fetch via vi.stubGlobal
    vi.stubGlobal('fetch', vi.fn());
    localStorage.setItem('kapwa_token', 'test-token');
  });
  
  afterEach(() => vi.unstubAllGlobals());

  describe('bearer header', () => {
    it('attaches Authorization: Bearer <token>', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });
      await api.get('/cases');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/cases'),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
        })
      );
    });
  });

  describe('timeout', () => {
    it('aborts after 10s via AbortSignal.timeout', async () => {
      // Use vitest fake timers: vi.useFakeTimers()
      // ...
    });
  });

  describe('401 refresh', () => {
    it('retries once after successful /auth/refresh', async () => {
      // First call 401, refresh succeeds, second call 200
      // ...
    });

    it('does not retry /auth/refresh when refresh itself 401s', async () => {
      // Both calls 401, fires kapwa:auth:logout event
      // ...
    });

    it('shares single in-flight refresh promise across concurrent 401s', async () => {
      // Two parallel api.get calls, both 401; only one /auth/refresh request fires
      // ...
    });
  });

  describe('retry', () => {
    it('retries 3 times on TypeError network failure', async () => { /* ... */ });
    it('does not retry 4xx or 5xx', async () => { /* ... */ });
    it('does not retry POST/PUT/DELETE', async () => { /* ... */ });
    it('uses exponential backoff with ±20% jitter', async () => { /* ... */ });
  });
});
```

**Test setup pattern from `tests/setup.ts`:** `localStorage` and `crypto` are already mocked globally. No additional setup needed for `api.test.ts`.

---

### `kapwa-client/src/lib/api-error.test.ts` (NEW — unit test)

**Analog:** `offline-queue.test.ts` (lines 1-23 — pure-data test, no async, no fetch mocks).

**Pattern to copy:**
```typescript
import { describe, it, expect } from 'vitest';
import { ApiError } from './api-error';

describe('ApiError', () => {
  it('extends Error so instanceof Error is true', () => {
    const e = new ApiError(401, { msg: 'no' });
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(ApiError);
  });
  
  it('exposes status, body, cause', () => {
    const cause = new Error('original');
    const e = new ApiError(500, { reason: 'oops' }, 'Server error', cause);
    expect(e.status).toBe(500);
    expect(e.body).toEqual({ reason: 'oops' });
    expect(e.cause).toBe(cause);
    expect(e.message).toBe('Server error');
  });
  
  it('defaults message to "API error: <status>"', () => {
    const e = new ApiError(404, null);
    expect(e.message).toBe('API error: 404');
  });
});
```

---

### `kapwa-client/src/lib/query-keys.test.ts` (NEW — unit test)

**Analog:** `offline-queue.test.ts` (lines 1-23).

**Pattern to copy:**
```typescript
import { describe, it, expect } from 'vitest';
import { queryKeys } from './query-keys';

describe('queryKeys factory', () => {
  it('returns stable tuple references for the same input', () => {
    expect(queryKeys.cases.detail('c1')).toBe(queryKeys.cases.detail('c1'));
  });
  
  it('returns different tuple references for different inputs', () => {
    expect(queryKeys.cases.detail('c1')).not.toBe(queryKeys.cases.detail('c2'));
  });
  
  it('uses as const so the array is readonly', () => {
    // @ts-expect-error - tuple should be readonly
    queryKeys.cases.list({}).push('mutate');
  });
  
  it('.all returns the resource prefix for mutate() revalidation', () => {
    expect(queryKeys.cases.all).toEqual(['cases']);
  });
  
  it('list keys include params for SWR dedup', () => {
    expect(queryKeys.cases.list({ status: 'pending' })).toEqual(['cases', 'list', { status: 'pending' }]);
  });
});
```

---

### `kapwa-client/tests/swr-test-helper.tsx` (NEW — test helper)

**Analog:** the `MemoryRouter` wrapper pattern in `CaseTrackerPage.test.tsx:51` (`<MemoryRouter><CaseTrackerPage /></MemoryRouter>`). The new helper adds an `SWRConfig` with a mock fetcher.

**Pattern to copy:**
```typescript
import { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { MemoryRouter } from 'react-router-dom';

export function SwrTestProvider({
  children,
  fetcher = vi.fn().mockResolvedValue(undefined),
}: {
  children: ReactNode;
  fetcher?: (key: any) => Promise<any>;
}) {
  return (
    <SWRConfig value={{ fetcher, dedupingInterval: 0 }}>
      <MemoryRouter>{children}</MemoryRouter>
    </SWRConfig>
  );
}
```

**Use in tests** (replaces the raw `vi.stubGlobal('fetch', ...)` pattern in `CaseTrackerPage.test.tsx:34-43`):
```typescript
import { SwrTestProvider } from '../../../tests/swr-test-helper';

const mockFetch = vi.fn().mockResolvedValue({ /* test data */ });
render(<SwrTestProvider fetcher={mockFetch}><CaseTrackerPage /></SwrTestProvider>);
expect(mockFetch).toHaveBeenCalledWith(['cases', 'list', {}]);
```

---

## Shared Patterns

### 1. Bearer Token Injection (single source of truth)

**Source:** `kapwa-client/src/lib/api.ts:4-9` (existing `apiFetch`) and `sync.ts:8-10` (`getToken`).
**Apply to:** the new `api.ts` (centralized in `rawRequest`); delete from `sync.ts:8-10`, `NotificationsDropdown.tsx:31,41,51,61`, `useDebouncedSearch.ts:27`, `usePiiMasking.ts` (implicit).

```typescript
// New api.ts (inside rawRequest, called by api.get/post/put/del)
const token = localStorage.getItem('kapwa_token');
if (token) headers['Authorization'] = `Bearer ${token}`;
```

---

### 2. Custom Event for Cross-Module Communication

**Source:** `kapwa-client/src/lib/sync.ts:217-220` (online/offline listener), `kapwa-client/src/components/Layout.tsx:65-67` (online/offline/storage listener).
**Apply to:** `api.ts` (dispatch `kapwa:auth:logout`) and `auth-context.tsx` (subscribe to `kapwa:auth:logout`).

```typescript
// api.ts (no React — plain module)
window.dispatchEvent(new CustomEvent('kapwa:auth:logout', { detail: { reason: 'refresh_failed' } }));

// auth-context.tsx (React component)
useEffect(() => {
  function handleLogout(e: Event) {
    logout();  // existing function in lines 84-88
  }
  window.addEventListener('kapwa:auth:logout', handleLogout);
  return () => window.removeEventListener('kapwa:auth:logout', handleLogout);
}, []);
```

---

### 3. AbortController + Cleanup on Unmount

**Source:** the project-wide pattern in `DashboardPage.tsx:99-107`, `FilingPage.tsx:25-29`, `BeneficiariesPage.tsx` (the existing debounced effect), `useDebouncedSearch.ts:25,43`, `ClaimantWidgets.tsx:27-31`.
**Apply to:** all migrated components — when `useSWR` is used, SWR handles the abort internally (via the `signal` it passes to the fetcher). For pages that also have non-SWR effects (e.g., form submits), keep the manual `AbortController`.

```typescript
// Existing pattern (DashboardPage.tsx:99-107)
useEffect(() => {
  const controller = new AbortController();
  if (WORKER_ROLES.includes(role)) loadData();
  else setLoading(false);
  return () => controller.abort();
}, [role]);

// New pattern: useSWR handles its own abort; just consume the hook
const { data, isLoading } = useSWR(condition ? key : null);
```

---

### 4. Vitest Test Mocking Patterns

**Source:** `CasesPage.test.tsx:27-33` (`vi.mock('../lib/api', () => ({...}))`), `CaseTrackerPage.test.tsx:34-43` (`vi.stubGlobal('fetch', vi.fn())`), `tests/setup.ts` (localStorage + crypto mocks).
**Apply to:** all updated page tests. Two options:

**Option A — Mock the api module** (works for `api.get/post/put/del` exports):
```typescript
vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue(mockData),
    post: vi.fn().mockResolvedValue({ ok: true }),
    put: vi.fn(),
    del: vi.fn(),
  },
}));
```

**Option B — Use `<SWRConfig>` with a mock fetcher** (per the new `SwrTestProvider` helper):
```typescript
import { SwrTestProvider } from '../../../tests/swr-test-helper';
const mockFetcher = vi.fn().mockResolvedValue(mockData);
render(<SwrTestProvider fetcher={mockFetcher}><Component /></SwrTestProvider>);
```

**Recommendation:** use Option A for tests that exercise mutations (the mock is more granular). Use Option B for tests that exercise SWR's data-loading behavior (the mock fetcher is more visible).

---

### 5. Error Boundary / SWR Error Display

**Source:** `react-error-boundary` v6.1.2 is already in `package.json:39`. The existing app uses it (per Phase 12/13) for top-level error catching.
**Apply to:** SWR's `onError` handler in `<SWRConfig>` logs non-401 `ApiError`s to the console (per RESEARCH Pattern 3). The error display in pages is `data && !error ? <Table/> : <EmptyState/>` — same as before migration.

```typescript
function swrErrorHandler(error: unknown) {
  if (error instanceof ApiError && error.status !== 401) {
    console.error('SWR fetch error:', error);
  }
}
```

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `kapwa-client/src/lib/api-error.ts` | utility | error-handling | No existing custom Error subclass in the codebase; new pattern |
| `kapwa-client/src/lib/query-keys.ts` | utility | pure data | No existing query-key factory; factory pattern is novel |
| `kapwa-client/src/lib/api.ts` (401 refresh interceptor) | service | event-driven | No existing single-flight refresh pattern in the codebase; new |
| `kapwa-client/src/routes.tsx` (SWRConfig) | config | n/a | No existing SWR integration; new |
| `kapwa-client/tests/swr-test-helper.tsx` | test helper | n/a | No existing SWRConfig wrapper helper; new |

## Metadata

**Analog search scope:**
- `kapwa-client/src/lib/**` (all utility/service modules)
- `kapwa-client/src/pages/**` (all page modules)
- `kapwa-client/src/components/**` (all components, esp. dashboard widgets)
- `kapwa-client/src/hooks/**` (all custom hooks)
- `kapwa-client/src/routes.tsx` (root provider)
- `kapwa-client/tests/setup.ts` (test infrastructure)
- `kapwa-client/vite.config.ts` (test config)

**Files scanned:** 18 source files + 6 test files
- Direct analogs read in full: `api.ts`, `auth-context.tsx`, `auth.ts`, `sync.ts`, `routes.tsx`, `package.json`, `vite.config.ts`, `tests/setup.ts`
- Pattern reference: `DashboardPage.tsx`, `CasesPage.tsx`, `BeneficiariesPage.tsx`, `AdminPage.tsx`, `FilingPage.tsx`, `AuditorPage.tsx`, `CoordinatorWidgets.tsx`, `ClaimantWidgets.tsx`, `AuditorWidgets.tsx`, `NotificationsDropdown.tsx`, `useDebouncedSearch.ts`, `usePiiMasking.ts`, `ReportsExportButton.tsx`, `auth.controller.ts`
- Test references: `CaseTrackerPage.test.tsx`, `CasesPage.test.tsx`, `BeneficiariesPage.test.tsx`, `sync-conflict.test.ts`, `offline-queue.test.ts`

**Pattern extraction date:** 2026-07-06

**Notes for the planner:**
- 12 of the 16 Plan C pages have the same `useState`+`useEffect`+`fetch` skeleton. Use `DashboardPage.tsx` as the canonical template for all of them.
- `ApprovalPipelinePage` reuses `getCases` (the same data as `CasesPage`). Share the `queryKeys.cases.list` key between both pages so mutations from one page invalidate the other.
- `MayorReportsPage` and `CoordinatorDashboardPage` both fetch from `/dashboard` with role-specific fields. They may use different keys (`queryKeys.dashboard.mayorReports` vs `queryKeys.dashboard.stats`) or share one key with a role-aware fetcher — defer to Plan 14-02/03 to decide.
- The 4 existing test files (`CaseTrackerPage.test.tsx`, `AuditorPage.test.tsx`, `CsrPage.test.tsx`, `IrfPage.test.tsx`, `IntakePage.test.tsx`, `ProgramsPage.test.tsx`, `LoginPage.test.tsx`, `RegisterPage.test.tsx`, `MfaSetupPage.test.tsx`) using `vi.spyOn(global, 'fetch')` or `vi.stubGlobal('fetch', ...)` need a sweep in Plan 14-03 to migrate to the new `SwrTestProvider` pattern (or to `vi.mock('./lib/api', ...)`).
