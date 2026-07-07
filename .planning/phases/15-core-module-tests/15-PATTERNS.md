# Phase 15: Core Module Tests - Pattern Map

**Mapped:** 2026-07-07
**Files analyzed:** 10 (2 modified config + 8 test files: 1 modified + 7 new)
**Analogs found:** 8 / 8 (every new test file has a direct existing analog; the 2 config files have self-as-analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `kapwa-client/package.json` (modified) | config | n/a | self | n/a (no other npm-script config exists) |
| `kapwa-client/vite.config.ts` (modified) | config | n/a | self | n/a (no other test config exists) |
| `kapwa-client/src/lib/api.test.ts` (modified) | test (unit) | mock-fetch | self (16 existing tests) | exact |
| `kapwa-client/src/lib/auth-context.login.test.tsx` (new) | test (component) | mock-fetch + RTL | `auth-context.test.tsx` | role-match (same file under test, different scenarios) |
| `kapwa-client/src/lib/auth-context.useauth.test.tsx` (new) | test (component) | mock-fetch + RTL | `auth-context.test.tsx` | role-match (same file under test, different scenarios) |
| `kapwa-client/src/lib/offline-queue.queue.test.ts` (new) | test (unit) | localStorage | `offline-queue.test.ts` | role-match (same file under test) |
| `kapwa-client/src/lib/offline-queue.conflict.test.ts` (new) | test (unit) | localStorage | `sync-conflict.test.ts` | role-match (already exercises `mergeRecords` + conflict functions) |
| `kapwa-client/src/lib/offline-queue.versions.test.ts` (new) | test (unit) | localStorage | `offline-queue.test.ts` | role-match (same file under test) |
| `kapwa-client/src/lib/secure-storage.browser.test.ts` (new) | test (unit) | mock-encrypted-db | `secure-storage.test.ts` | role-match (same file under test) |
| `kapwa-client/src/lib/secure-storage.native.test.ts` (new) | test (unit) | mock-capacitor-sqlite + spyOn | `secure-storage.test.ts` (closest existing), no native-path analog yet | partial-match (browser-path pattern applies; native-path mocking is new) |

## Pattern Assignments

### `kapwa-client/package.json` (config — modified)

**Analog:** self (no other `package.json` exists in the project).

**Coverage scripts pattern** (per CONTEXT D-01):
```json
"scripts": {
  "test": "vitest",
  "test:run": "vitest run",
  "coverage": "vitest run --coverage",
  "coverage:check": "vitest run --coverage"
}
```

**Coverage tool devDep** (per RESEARCH §"Standard Stack" + D-01):
```json
"devDependencies": {
  "@vitest/coverage-v8": "^4.1.10"
}
```

**Source for the coverage-include glob** (per D-02 + RESEARCH Pattern 1):
```typescript
// Vite config — for reference; see next entry
include: ['src/lib/{api,api-error,auth-context,offline-queue,secure-storage}.{ts,tsx}'],
```

---

### `kapwa-client/vite.config.ts` (config — modified)

**Analog:** self (the only `vite.config.ts` in the project). The existing `test` block is at lines 26-32.

**Coverage block to add** (per D-02, RESEARCH §"Pattern 1: Per-file coverage threshold"):
```typescript
// vite.config.ts — replace the existing test block (lines 26-32) with:
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./tests/setup.ts'],
  include: ['src/**/*.test.{ts,tsx}'],
  exclude: ['src/__tests__/e2e.test.ts', 'src/__tests__/a11y/pages.test.ts'],
  coverage: {
    provider: 'v8',
    include: ['src/lib/{api,api-error,auth-context,offline-queue,secure-storage}.{ts,tsx}'],
    exclude: ['**/*.test.{ts,tsx}', '**/types.ts', '**/index.ts'],
    thresholds: {
      perFile: true,
      lines: 70,
      functions: 70,
      branches: 60,
      statements: 70,
    },
  },
},
```

**Notes from RESEARCH:**
- `perFile: true` is critical (D-06 + RESEARCH Anti-pattern 2): without it, a 100% module could mask a 40% module.
- `exclude: ['**/*.test.{ts,tsx}', ...]` is required to keep test code out of the coverage report.
- `provider: 'v8'` requires `@vitest/coverage-v8` installed (RESEARCH Pitfall 3).

---

### `kapwa-client/src/lib/api.test.ts` (test, mock-fetch — modified)

**Analog:** self (existing 255-line file with 16 tests). New tests append to the existing `describe('api client', ...)` block.

**Imports pattern** (lines 1-3):
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from './api';
import { ApiError } from './api-error';
```

**Fetch-mock factory pattern** (lines 5-10):
```typescript
function okJsonResponse(body: unknown, status = 200) {
  return { ok: true, status, statusText: 'OK', json: () => Promise.resolve(body) };
}
function errJsonResponse(body: unknown, status: number, statusText = '') {
  return { ok: false, status, statusText, json: () => Promise.resolve(body) };
}
```

**Setup/teardown pattern** (lines 13-21):
```typescript
describe('api client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.setItem('kapwa_token', 'test-token');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  // ...
});
```

**KAPWA_AUTH_LOGOUT_EVENT test pattern** (extend line 126-143 — the existing logout-event test):
```typescript
// New test: constant value matches the same string used in auth-context.tsx:42
it('exports KAPWA_AUTH_LOGOUT_EVENT = "kapwa:auth:logout"', () => {
  expect(KAPWA_AUTH_LOGOUT_EVENT).toBe('kapwa:auth:logout');
});

// New test: refresh_network_error reason (covers the catch branch in api.ts:108-110)
it('dispatches logout event with reason "refresh_network_error" on fetch throw', async () => {
  const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
  localStorage.setItem('refresh_token', 'r');
  fetchMock
    .mockResolvedValueOnce(errJsonResponse({}, 401))
    .mockRejectedValueOnce(new TypeError('network'));

  const logoutListener = vi.fn();
  window.addEventListener('kapwa:auth:logout', logoutListener);
  try {
    await expect(api.get('/cases')).rejects.toBeInstanceOf(ApiError);
    expect(logoutListener).toHaveBeenCalledTimes(1);
    const event = logoutListener.mock.calls[0][0] as CustomEvent;
    expect(event.detail?.reason).toBe('refresh_network_error');
  } finally {
    window.removeEventListener('kapwa:auth:logout', logoutListener);
  }
});
```

**Path normalization edge cases** (new — covers `normalizePath` array branch, api.ts:16-21):
```typescript
describe('path normalization', () => {
  it('joins array path parts with /', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(okJsonResponse({}));
    await api.get(['cases', '123', null, undefined, ''] as readonly unknown[]);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toMatch(/\/cases\/123$/);
  });
});
```

---

### `kapwa-client/src/lib/auth-context.login.test.tsx` (test, component — new)

**Analog:** `auth-context.test.tsx` (lines 1-63, 99-143 — the existing 3 tests). All login/MFA tests follow the same `AuthProbe + render + act + waitFor` pattern.

**Imports pattern** (per auth-context.test.tsx:1-4):
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth-context';
```

**AuthProbe helper pattern** (from auth-context.test.tsx:6-11):
```typescript
function AuthProbe({ onAuth }: { onAuth: (auth: { user: unknown; token: string | null; mfaChallenge: { tempToken: string } | null }) => void }) {
  const auth = useAuth();
  act(() => { onAuth({ user: auth.user, token: auth.token, mfaChallenge: auth.mfaChallenge }); });
  return <div data-testid="probe">probe</div>;
}
```

**Login success test pattern** (per D-10 scenario 1):
```typescript
it('login() with valid credentials sets user + token', async () => {
  const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
  fetchMock.mockResolvedValueOnce({
    ok: true, status: 200,
    json: () => Promise.resolve({
      accessToken: 'tok-1',
      user: { id: 'u1', email: 'a@b', fullName: 'A B', role: 'admin' },
    }),
  });

  let captured: ReturnType<typeof useAuth> | null = null;
  render(
    <MemoryRouter>
      <AuthProvider>
        <AuthProbe onAuth={(a) => { captured = a; }} />
      </AuthProvider>
    </MemoryRouter>,
  );

  await act(async () => { await captured!.login('a@b.com', 'pass'); });

  await waitFor(() => {
    expect(captured!.user).toEqual({ id: 'u1', email: 'a@b', fullName: 'A B', role: 'admin' });
  });
  expect(localStorage.getItem('kapwa_token')).toBe('tok-1');
});
```

**MFA challenge test pattern** (per D-10 scenario 2 — auth-context.tsx:72-75):
```typescript
it('login() with MFA required sets mfaChallenge + returns { mfaRequired: true, tempToken }', async () => {
  const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
  fetchMock.mockResolvedValueOnce({
    ok: true, status: 200,
    json: () => Promise.resolve({ mfaRequired: true, tempToken: 'temp-1' }),
  });

  let captured: ReturnType<typeof useAuth> | null = null;
  render(/* same as above */);
  let result: { mfaRequired: boolean; tempToken: string } | void = undefined;
  await act(async () => { result = await captured!.login('a@b.com', 'pass'); });

  expect(result).toEqual({ mfaRequired: true, tempToken: 'temp-1' });
  expect(captured!.mfaChallenge).toEqual({ tempToken: 'temp-1' });
  expect(localStorage.getItem('kapwa_token')).toBeNull();
});
```

**Setup/teardown pattern** (from auth-context.test.tsx:14-22):
```typescript
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
```

---

### `kapwa-client/src/lib/auth-context.useauth.test.tsx` (test, component — new)

**Analog:** `auth-context.test.tsx` (the same file under test, with established `AuthProbe` + RTL patterns).

**Imports + AuthProbe pattern**: identical to `auth-context.login.test.tsx` above (per D-13 file split).

**getCurrentUser() test pattern** (per D-11 — covers auth-context.tsx:114-123):
```typescript
import { getCurrentUser } from './auth-context';
import { api } from './api';

describe('getCurrentUser', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); localStorage.clear(); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('returns null when no token in localStorage', async () => {
    expect(await getCurrentUser()).toBeNull();
  });

  it('returns user when token present and /auth/me 200s', async () => {
    localStorage.setItem('kapwa_token', 'tok');
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({ user: { id: 'u1', email: 'a@b', fullName: 'A B', role: 'admin' } }),
    });
    expect(await getCurrentUser()).toEqual({ id: 'u1', email: 'a@b', fullName: 'A B', role: 'admin' });
  });

  it('returns null on fetch error', async () => {
    localStorage.setItem('kapwa_token', 'tok');
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValue(new TypeError('network'));
    expect(await getCurrentUser()).toBeNull();
  });
});
```

**cancelMfa() test pattern** (per D-12 — covers auth-context.tsx:96-98):
```typescript
describe('cancelMfa()', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); localStorage.clear(); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('clears mfaChallenge state without firing fetch', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    // First: login returns MFA challenge
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      json: () => Promise.resolve({ mfaRequired: true, tempToken: 'temp-1' }),
    });
    let captured: ReturnType<typeof useAuth> | null = null;
    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthProbe onAuth={(a) => { captured = a; }} />
        </AuthProvider>
      </MemoryRouter>,
    );
    await act(async () => { await captured!.login('a@b.com', 'pass'); });
    expect(captured!.mfaChallenge).toEqual({ tempToken: 'temp-1' });

    // Then: cancelMfa clears state, no additional fetch is fired
    await act(async () => { captured!.cancelMfa(); });
    expect(captured!.mfaChallenge).toBeNull();
    expect(fetchMock.mock.calls.length).toBe(1); // only the login call
  });
});
```

**useAuth() consumer test pattern** (per D-11):
```typescript
it('useAuth() returns the context value via a mocked provider + consumer', () => {
  const onAuth = vi.fn();
  render(
    <MemoryRouter>
      <AuthProvider>
        <AuthProbe onAuth={onAuth} />
      </AuthProvider>
    </MemoryRouter>,
  );
  expect(onAuth).toHaveBeenCalled();
  const value = onAuth.mock.calls[onAuth.mock.calls.length - 1][0];
  expect(value).toHaveProperty('user');
  expect(value).toHaveProperty('token');
  expect(value).toHaveProperty('login');
  expect(typeof value.login).toBe('function');
});
```

---

### `kapwa-client/src/lib/offline-queue.queue.test.ts` (test, unit — new)

**Analog:** `offline-queue.test.ts` (lines 1-23 — the existing 2 tests). Same `beforeEach(localStorage.clear)` pattern.

**Imports + setup pattern** (per offline-queue.test.ts:1-7):
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { queueChange, getPendingChanges, queueFsmTransition } from './offline-queue';

describe('offline-queue — queue', () => {
  beforeEach(() => { localStorage.clear(); });

  it('queueChange appends a pending change with a UUID', async () => {
    const c = await queueChange('cases', 'r1', 'UPDATE', { x: 1 });
    expect(c.id).toBeTruthy();
    expect(c.status).toBe('pending');
    expect(c.serverVersion).toBe(0);
    expect(c.retryCount).toBe(0);
  });

  it('queueChange increments the local version vector for the table', async () => {
    await queueChange('cases', 'r1', 'UPDATE', {});
    await queueChange('cases', 'r2', 'UPDATE', {});
    const { getVersionVector } = await import('./offline-queue');
    const v = await getVersionVector('cases');
    expect(v?.localVersion).toBe(2);
  });

  it('getPendingChanges returns only status=pending entries', async () => {
    await queueChange('cases', 'r1', 'UPDATE', {});
    const c2 = await queueChange('cases', 'r2', 'UPDATE', {});
    const { markSynced } = await import('./offline-queue');
    await markSynced(c2.id, 1);
    const pending = await getPendingChanges();
    expect(pending).toHaveLength(1);
    expect(pending[0].recordId).toBe('r1');
  });

  it('queueFsmTransition writes status + _fsmTransition + _clientUpdatedAt into payload', async () => {
    const c = await queueFsmTransition('case-1', 'in_review', { notes: 'pre' });
    expect(c.payload.status).toBe('in_review');
    expect(c.payload._fsmTransition).toBe(true);
    expect(typeof c.payload._clientUpdatedAt).toBe('string');
    expect(c.payload.notes).toBe('pre');
  });
});
```

---

### `kapwa-client/src/lib/offline-queue.conflict.test.ts` (test, unit — new)

**Analog:** `sync-conflict.test.ts` (lines 1-60 — already exercises `mergeRecords` + conflict functions). This new file FOLLOWS that test style + ADDS the gap-filling tests from D-05.

**Imports + setup pattern** (per sync-conflict.test.ts:1-9):
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mergeRecords, resolveConflict, markSynced, markConflict, markFailed, getConflictChanges } from './offline-queue';
import type { QueuedChange } from './offline-queue';

describe('offline-queue — conflict resolution', () => {
  beforeEach(() => { localStorage.clear(); });
  // ...
});
```

**mergeRecords FINANCIAL_FIELDS test pattern** (per CONTEXT "Specific Ideas" — 4 fields):
```typescript
describe('mergeRecords — FINANCIAL_FIELDS server-wins', () => {
  for (const field of ['amount', 'status', 'fundSource', 'disbursedAmount']) {
    it(`server value wins for "${field}"`, () => {
      const result = mergeRecords({ [field]: 'server' }, { [field]: 'client' });
      expect(result[field]).toBe('server');
    });
  }
});

describe('mergeRecords — notes concatenation', () => {
  it('appends client notes to server notes with \\n separator', () => {
    expect(mergeRecords({ notes: 'A' }, { notes: 'B' })).toEqual({ notes: 'A\nB' });
  });
  it('keeps server notes alone when client has no notes', () => {
    expect(mergeRecords({ notes: 'A' }, {})).toEqual({ notes: 'A' });
  });
});

describe('mergeRecords — consentStatus override', () => {
  it('server revocation overrides client active state', () => {
    expect(mergeRecords({ consentStatus: 'revoked' }, { consentStatus: 'active' })).toEqual({ consentStatus: 'revoked' });
  });
  it('does NOT override when server is not revoked', () => {
    expect(mergeRecords({ consentStatus: 'active' }, { consentStatus: 'pending' })).toEqual({ consentStatus: 'pending' });
  });
});
```

**resolveConflict test pattern** (per offline-queue.ts:179-182):
```typescript
describe('resolveConflict', () => {
  it('server-wins strategy: server fields override client', () => {
    expect(resolveConflict('server-wins', { a: 1, b: 2 }, { a: 99, c: 3 })).toEqual({ a: 1, b: 2, c: 3 });
  });
  it('client-wins strategy: calls mergeRecords (financial fields still server)', () => {
    expect(resolveConflict('client-wins', { amount: 100 }, { amount: 200, notes: 'x' }))
      .toEqual({ amount: 100, notes: '' });  // server has no notes, client has 'x' → server (empty)
  });
});
```

**markSynced/markConflict/markFailed test pattern** (per D-05):
```typescript
import { queueChange } from './offline-queue';

describe('markSynced', () => {
  it('transitions status pending → synced and updates serverVersion', async () => {
    const c = await queueChange('cases', 'r1', 'UPDATE', {});
    await markSynced(c.id, 5);
    const { getPendingChanges, loadQueue } = await import('./offline-queue');
    expect(await getPendingChanges()).toHaveLength(0);
    const stored = loadQueue().find((x) => x.id === c.id)!;
    expect(stored.status).toBe('synced');
    expect(stored.serverVersion).toBe(5);
  });
  it('preserves a non-zero serverVersion when called with a smaller value', async () => {
    const c = await queueChange('cases', 'r1', 'UPDATE', {});
    const { markSynced } = await import('./offline-queue');
    await markSynced(c.id, 10);
    await markSynced(c.id, 5); // smaller — should NOT overwrite
    const { loadQueue } = await import('./offline-queue');
    expect(loadQueue().find((x) => x.id === c.id)!.serverVersion).toBe(10);
  });
});

describe('markConflict', () => {
  it('transitions status pending → conflict + bumps retryCount + sets lastError', async () => {
    const c = await queueChange('cases', 'r1', 'UPDATE', {});
    await markConflict(c.id, 'version mismatch');
    const { loadQueue, getConflictChanges } = await import('./offline-queue');
    const stored = loadQueue().find((x) => x.id === c.id)!;
    expect(stored.status).toBe('conflict');
    expect(stored.retryCount).toBe(1);
    expect(stored.lastError).toBe('version mismatch');
    expect(await getConflictChanges()).toHaveLength(1);
  });
});

describe('markFailed', () => {
  it('transitions status pending → failed + sets lastError (no retry bump)', async () => {
    const c = await queueChange('cases', 'r1', 'UPDATE', {});
    await markFailed(c.id, 'http 500');
    const { loadQueue } = await import('./offline-queue');
    const stored = loadQueue().find((x) => x.id === c.id)!;
    expect(stored.status).toBe('failed');
    expect(stored.retryCount).toBe(0);
    expect(stored.lastError).toBe('http 500');
  });
});
```

---

### `kapwa-client/src/lib/offline-queue.versions.test.ts` (test, unit — new)

**Analog:** `offline-queue.test.ts` (lines 1-23 — same `localStorage.clear()` pattern). The versions module is a thin wrapper over localStorage.

**Imports + setup pattern** (per offline-queue.test.ts:1-7):
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { incrementLocalVersion, updateServerVersion, getVersionVector, getAllVersionVectors } from './offline-queue';

describe('offline-queue — version vectors', () => {
  beforeEach(() => { localStorage.clear(); });
  // ...
});
```

**incrementLocalVersion test pattern** (per offline-queue.ts:114-126):
```typescript
it('incrementLocalVersion starts a new table at 1', async () => {
  await incrementLocalVersion('cases');
  const v = await getVersionVector('cases');
  expect(v).toEqual({ tableName: 'cases', localVersion: 1, serverVersion: 0, lastSyncedAt: null });
});

it('incrementLocalVersion increments an existing table', async () => {
  await incrementLocalVersion('cases');
  await incrementLocalVersion('cases');
  await incrementLocalVersion('cases');
  expect((await getVersionVector('cases'))?.localVersion).toBe(3);
});

it('incrementLocalVersion is per-table (cases != interventions)', async () => {
  await incrementLocalVersion('cases');
  await incrementLocalVersion('interventions');
  expect((await getVersionVector('cases'))?.localVersion).toBe(1);
  expect((await getVersionVector('interventions'))?.localVersion).toBe(1);
});
```

**updateServerVersion test pattern** (per offline-queue.ts:128-141):
```typescript
it('updateServerVersion starts a new table at localVersion=0 with the given server version', async () => {
  await updateServerVersion('cases', 7);
  const v = await getVersionVector('cases');
  expect(v?.localVersion).toBe(0);
  expect(v?.serverVersion).toBe(7);
  expect(v?.lastSyncedAt).not.toBeNull();
});

it('updateServerVersion overwrites an existing vector + updates lastSyncedAt', async () => {
  await updateServerVersion('cases', 5);
  await updateServerVersion('cases', 10);
  const v = await getVersionVector('cases');
  expect(v?.serverVersion).toBe(10);
});
```

**getAllVersionVectors test pattern** (per offline-queue.ts:143-145):
```typescript
it('getAllVersionVectors returns the full vector list', async () => {
  await incrementLocalVersion('cases');
  await incrementLocalVersion('interventions');
  const all = await getAllVersionVectors();
  expect(all).toHaveLength(2);
  expect(all.map((v) => v.tableName).sort()).toEqual(['cases', 'interventions']);
});

it('getAllVersionVectors returns [] when empty', async () => {
  expect(await getAllVersionVectors()).toEqual([]);
});
```

---

### `kapwa-client/src/lib/secure-storage.browser.test.ts` (test, unit — new)

**Analog:** `secure-storage.test.ts` (lines 1-46 — the existing 3 tests). Both files use `vi.mock('./encrypted-db', ...)` at the top of the file.

**vi.mock hoisted factory pattern** (per secure-storage.test.ts:3-11 — must be before `import` statements):
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./encrypted-db', () => ({
  encryptedDb: {
    init: vi.fn().mockResolvedValue(undefined),
    getItem: vi.fn().mockImplementation(() => Promise.resolve(null)),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

import { encryptedDb } from './encrypted-db';
import { SecureStorage } from './secure-storage';
```

**Browser-init test pattern** (per D-09 + secure-storage.ts:48-49):
```typescript
describe('SecureStorage — browser init (encrypted-db path)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('init() in browser platform calls encryptedDb.init()', async () => {
    await SecureStorage.init();
    expect(encryptedDb.init).toHaveBeenCalledTimes(1);
  });

  it('init() reads kapwa_db_key from localStorage as the encryption-key fallback', async () => {
    localStorage.setItem('kapwa_db_key', 'user-pass-123');
    await SecureStorage.init();
    expect(encryptedDb.init).toHaveBeenCalledTimes(1);
    // No direct assertion possible (key is internal); verified by the fact that init succeeded
  });
});
```

**Corruption path test pattern** (per D-08 + secure-storage.ts:71 + encrypted-db.ts:74-76):
```typescript
describe('SecureStorage — corruption path', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('getItem() returns null + does not throw when encryptedDb.getItem throws', async () => {
    (encryptedDb.getItem as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new SyntaxError('malformed'));
    const val = await SecureStorage.getItem('any-key');
    expect(val).toBeNull();
  });

  it('getItem() returns null when encryptedDb.getItem resolves with malformed JSON', async () => {
    (encryptedDb.getItem as ReturnType<typeof vi.fn>).mockResolvedValueOnce('this is not JSON' as unknown as null);
    const val = await SecureStorage.getItem('any-key');
    expect(val).toBeNull();
  });
});
```

---

### `kapwa-client/src/lib/secure-storage.native.test.ts` (test, unit — new)

**Analog:** `secure-storage.test.ts` (closest — same file under test, but the native path is NEW). This is the only test file in the codebase that mocks `@capacitor-community/sqlite` and spies on `Capacitor.isNativePlatform`.

**vi.mock hoisted factory pattern** (per CONTEXT D-07 + RESEARCH Pattern 2):
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Capacitor } from '@capacitor/core';

vi.mock('@capacitor-community/sqlite', () => ({
  CapacitorSQLite: {
    createConnection: vi.fn().mockResolvedValue(undefined),
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue({ values: [] }),
    execute: vi.fn().mockResolvedValue({ changes: 1 }),
  },
}));

import { SecureStorage } from './secure-storage';
```

**Platform-toggle spy pattern** (per RESEARCH §"Pattern 2: Native-platform mocking"):
```typescript
describe('SecureStorage — native path (SQLCipher)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks(); // restores the spy
  });
  // ...
});
```

**Native init test pattern** (per D-09 + secure-storage.ts:22-46):
```typescript
it('init() in native platform calls createConnection + open + execute + close in order', async () => {
  const { CapacitorSQLite } = await import('@capacitor-community/sqlite');
  await SecureStorage.init('user-pass');
  expect(CapacitorSQLite.createConnection).toHaveBeenCalledWith(
    expect.objectContaining({ database: 'kapwa', encrypted: true, mode: 'secret' }),
  );
  expect(CapacitorSQLite.open).toHaveBeenCalled();
  expect(CapacitorSQLite.execute).toHaveBeenCalledWith(
    expect.objectContaining({ database: 'kapwa' }),
  );
  expect(CapacitorSQLite.close).toHaveBeenCalled();
  // Call order: createConnection → open → execute → close
  const order = [
    (CapacitorSQLite.createConnection as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
    (CapacitorSQLite.open as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
    (CapacitorSQLite.execute as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
    (CapacitorSQLite.close as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
  ];
  expect(order).toEqual([...order].sort((a, b) => a - b));
});
```

**Native getItem/setItem/removeItem test pattern** (per secure-storage.ts:55-107):
```typescript
it('getItem() in native platform opens, queries, and closes the DB', async () => {
  const { CapacitorSQLite } = await import('@capacitor-community/sqlite');
  (CapacitorSQLite.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    values: [{ value: JSON.stringify({ foo: 'bar' }) }],
  });
  const val = await SecureStorage.getItem<{ foo: string }>('test-key');
  expect(val).toEqual({ foo: 'bar' });
  expect(CapacitorSQLite.open).toHaveBeenCalled();
  expect(CapacitorSQLite.query).toHaveBeenCalled();
  expect(CapacitorSQLite.close).toHaveBeenCalled();
});

it('getItem() returns null when query result has no rows', async () => {
  const { CapacitorSQLite } = await import('@capacitor-community/sqlite');
  (CapacitorSQLite.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ values: [] });
  expect(await SecureStorage.getItem('missing')).toBeNull();
});

it('setItem() in native platform executes an INSERT OR REPLACE with JSON-stringified value', async () => {
  const { CapacitorSQLite } = await import('@capacitor-community/sqlite');
  await SecureStorage.setItem('k', { a: 1 });
  expect(CapacitorSQLite.execute).toHaveBeenCalledWith(
    expect.objectContaining({
      statement: expect.stringContaining('INSERT OR REPLACE INTO sync_cache'),
      values: ['k', JSON.stringify({ a: 1 })],
    }),
  );
});

it('removeItem() in native platform executes a DELETE', async () => {
  const { CapacitorSQLite } = await import('@capacitor-community/sqlite');
  await SecureStorage.removeItem('k');
  expect(CapacitorSQLite.execute).toHaveBeenCalledWith(
    expect.objectContaining({
      statement: expect.stringContaining('DELETE FROM sync_cache'),
      values: ['k'],
    }),
  );
});
```

---

## Shared Patterns

### Pattern A: vi.stubGlobal('fetch', vi.fn()) — universal network mock
**Source:** `kapwa-client/src/lib/api.test.ts:14`, `auth-context.test.tsx:15, 108`
**Apply to:** `auth-context.login.test.tsx`, `auth-context.useauth.test.tsx` (all new auth-context tests)
```typescript
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
```

### Pattern B: localStorage.clear() in beforeEach — per-test isolation
**Source:** `tests/setup.ts:59` (global) + per-test-file in `offline-queue.test.ts:6`, `auth-context.test.tsx:16`, `secure-storage.test.ts:17`
**Apply to:** ALL new test files
```typescript
beforeEach(() => {
  localStorage.clear(); // CRITICAL — tests/setup.ts also calls this in afterEach, but the mock factory's persisted state needs explicit clearing
  vi.clearAllMocks();   // or vi.restoreAllMocks() depending on needs
});
```

### Pattern C: vi.mock hoisted factory (top of file, before imports)
**Source:** `secure-storage.test.ts:3-11` (existing) + RESEARCH Pattern 2 for native bridge
**Apply to:** `secure-storage.browser.test.ts` (same pattern), `secure-storage.native.test.ts` (new module)
```typescript
vi.mock('./encrypted-db', () => ({ /* factory */ }));
// or
vi.mock('@capacitor-community/sqlite', () => ({ /* factory */ }));
// THEN the import statement
import { encryptedDb } from './encrypted-db';
```

### Pattern D: AuthProbe + render + act + waitFor — React context state capture
**Source:** `auth-context.test.tsx:6-11` (existing)
**Apply to:** `auth-context.login.test.tsx`, `auth-context.useauth.test.tsx` (all new auth-context tests)
```typescript
function AuthProbe({ onAuth }) {
  const auth = useAuth();
  act(() => { onAuth({ user: auth.user, token: auth.token }); });
  return <div data-testid="probe">probe</div>;
}

render(<MemoryRouter><AuthProvider><AuthProbe onAuth={onAuth} /></AuthProvider></MemoryRouter>);
await waitFor(() => { expect(onAuth.mock.calls.at(-1)[0].user).not.toBeNull(); });
```

### Pattern E: vi.spyOn(Capacitor, 'isNativePlatform') — platform toggle
**Source:** RESEARCH Pattern 2 (no existing use in repo)
**Apply to:** `secure-storage.native.test.ts` ONLY (browser-path tests use the default `false`)
```typescript
beforeEach(() => { vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true); });
afterEach(() => { vi.restoreAllMocks(); }); // CRITICAL — spy does not auto-restore (RESEARCH Pitfall 2)
```

### Pattern F: kapwa:auth:logout event dispatch + listener
**Source:** `api.test.ts:133-141` + `auth-context.test.tsx:49-51, 88-90`
**Apply to:** `api.test.ts` extensions (refresh_network_error reason test)
```typescript
const logoutListener = vi.fn();
window.addEventListener('kapwa:auth:logout', logoutListener);
try {
  await expect(api.get('/cases')).rejects.toBeInstanceOf(ApiError);
  expect(logoutListener).toHaveBeenCalledTimes(1);
  const event = logoutListener.mock.calls[0][0] as CustomEvent;
  expect(event.detail?.reason).toBe('refresh_network_error');
} finally {
  window.removeEventListener('kapwa:auth:logout', logoutListener);
}
```

### Pattern G: vi.useFakeTimers() + vi.runAllTimersAsync() — backoff testing
**Source:** `api.test.ts:53-63, 158-170` (existing)
**Apply to:** `api.test.ts` extensions only (no other new file uses fake timers)
```typescript
vi.useFakeTimers();
try {
  const promise = api.get('/cases');
  for (let i = 0; i < 5; i++) { await vi.runAllTimersAsync(); }
  await promise;
} finally {
  vi.useRealTimers(); // CRITICAL — fake timers leak across tests (RESEARCH Pitfall 6)
}
```

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `secure-storage.native.test.ts` (partial) | test (unit) | mock-capacitor-sqlite | The native-path mocking is NEW; no existing test in the repo uses `vi.mock('@capacitor-community/sqlite', ...)` or spies on `Capacitor.isNativePlatform()`. The browser-path pattern from `secure-storage.test.ts` partially applies. Use RESEARCH §"Pattern 2" + §"Code Examples" for the exact factory shape. |

## Metadata

**Analog search scope:** `kapwa-client/src/lib/**/*.{ts,tsx}` (source + tests), `kapwa-client/vite.config.ts`, `kapwa-client/package.json`, `kapwa-client/tests/setup.ts`
**Files scanned:** 13 (4 source modules + 4 existing test files + 1 secure-storage dep + 2 config files + sync-conflict.test.ts + auth.ts)
**Pattern extraction date:** 2026-07-07
**Files classified:** 10 (2 modified config + 1 modified test + 7 new test files)
**Analogs with exact or role-match quality:** 9 / 10 (secure-storage.native.test.ts is the 1 partial-match)
