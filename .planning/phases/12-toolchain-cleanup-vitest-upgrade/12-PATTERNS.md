# Phase 12: Toolchain Cleanup & Vitest Upgrade - Pattern Map

**Mapped:** 2026-07-05
**Files analyzed:** 4 modified + 1 new directory + 31 test file relocations
**Analogs found:** 4 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `kapwa-client/package.json` | config | dep-graph | (self — modify in place) | exact |
| `kapwa-client/vite.config.ts` | config | test-runner | (self — modify test block) | exact |
| `kapwa-client/tsconfig.json` | config | type-resolution | (self — vitest/globals may need update) | exact |
| `kapwa-client/tests/setup.ts` | test-setup | global-mocks | (self — v1.2 API may need v4 updates) | exact |
| `kapwa-client/src/__tests__/` (new dir) | test-orphan | cross-cutting | `kapwa-client/src/tests/` (existing orphan dir pattern) | exact |
| 28 test files (co-located moves) | test | request-response (render) | existing `src/components/*.test.tsx` files | exact |

**Notes on classification:**
- This phase is **toolchain reconfiguration**, not feature work. No new business logic files.
- The "files" are mostly **relocations** of existing test files. The pattern is preservation, not invention.
- The 4 modified files (package.json, vite.config.ts, tsconfig.json, tests/setup.ts) all already follow the project's patterns — modifications must preserve those patterns.

## Pattern Assignments

### `kapwa-client/package.json` (config, dep-graph)

**Analog:** Self (modify in place)

**Current state** (lines 11-69) — three misplaced production deps in `dependencies`:
```json
"dependencies": {
  // ... other deps ...
  "esbuild": "^0.28.0",        // line 37 — build tool, NOT runtime
  "lucide-react": "^1.14.0",
  "playwright": "^1.59.1",     // line 39 — dev tool, NOT runtime
  "react": "^18.2.0",
  // ...
  "@capacitor/cli": "^6.2.1",  // line 14 — CLI for build, NOT runtime
  // ...
},
"devDependencies": {
  "@axe-core/playwright": "^4.12.1",
  // ...
  "vitest": "^1.2.0",          // line 67 — must upgrade to v4
  "vitest-axe": "^0.1.0"
}
```

**Required changes (D-01, D-02):**
1. Remove `esbuild`, `playwright`, `@capacitor/cli` from `dependencies` (lines 37, 39, 14)
2. Add them to `devDependencies` (alphabetical order: `@capacitor/cli` near top, `esbuild` between deps, `playwright` between deps)
3. Bump versions in single `npm install`:
   - `vitest: ^1.2.0` → `^4.0.0` (or latest)
   - `@testing-library/react: ^16.3.2` → bump to match vitest v4 compat
   - `@testing-library/jest-dom: ^6.9.1` → bump if needed
4. **Do NOT** modify any of the 11 `@capacitor/*` runtime packages — only `@capacitor/cli`
5. **Preserve** alphabetical ordering within each dep block (convention)

**Validation pattern:**
```bash
npm ls --prod       # should NOT list playwright, @capacitor/cli, esbuild
npm ls --dev        # should list them under dev
npm test            # should still run vitest
npm run test:run    # single-run mode still works
```

---

### `kapwa-client/vite.config.ts` (config, test-runner)

**Analog:** Self (modify `test` block only)

**Current state** (lines 23-29):
```typescript
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./tests/setup.ts'],
  include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
  exclude: ['tests/e2e.test.ts', 'src/tests/a11y/pages.test.ts'],
},
```

**Required changes (D-08):**
- Update `include` to: `['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts']`
  - `src/**/*.test.{ts,tsx}` covers BOTH co-located tests (e.g., `src/components/Foo.test.tsx`) AND `src/__tests__/` (the new orphan directory at line 4 of D-07)
  - `tests/**/*.test.ts` retained ONLY if `tests/e2e.test.ts` remains in `tests/` — per D-07, e2e.test.ts moves to `src/__tests__/e2e.test.ts`, so this glob can become empty/removed
- **Remove** the `exclude` array — after migration there are no files needing exclusion:
  - `tests/e2e.test.ts` is moved to `src/__tests__/e2e.test.ts` (now covered by `src/**/*.test.{ts,tsx}`)
  - `src/tests/a11y/pages.test.ts` is moved to `src/__tests__/a11y/pages.test.ts` (now covered by `src/**/*.test.{ts,tsx}`)
- **Vitest v4 API changes to verify** (research the v4 release notes if behavior differs):
  - `globals: true` is still supported
  - `setupFiles` path syntax is still relative-to-cwd
  - `environment: 'jsdom'` is still supported
  - Default include/exclude behavior may have changed in v4 — confirm via `npm test` output

**Pattern to preserve — resolver aliases (lines 12-19):**
```typescript
resolve: {
  alias: {
    '@': path.resolve(import.meta.dirname, './src'),
    react: path.resolve(import.meta.dirname, 'node_modules/react'),
    'react-dom': path.resolve(import.meta.dirname, 'node_modules/react-dom'),
  },
  dedupe: ['react', 'react-dom'],
},
```
The `@/*` alias is critical for test imports like `vi.mock('@/lib/offline-queue', ...)` (see SyncQueuePanel.test.tsx line 7). Do NOT remove.

---

### `kapwa-client/tsconfig.json` (config, type-resolution)

**Analog:** Self (no required changes; verify vitest v4 types)

**Current state** (line 20):
```json
"types": ["vitest/globals"]
```

**Required changes:**
- Vitest v4 may require `"types": ["vitest/globals", "@testing-library/jest-dom"]` if `jest-dom` matchers are used without explicit imports
- Verify by running `npm run test:run` after upgrade
- If no test files use `@testing-library/jest-dom` matchers (`toBeInTheDocument`, etc.), no change needed — current code uses only Vitest's built-in `expect`

**Pattern to preserve — path alias (line 19):**
```json
"paths": { "@/*": ["./src/*"] }
```
Required for the `@/lib/...` mock pattern used in component tests.

---

### `kapwa-client/tests/setup.ts` (test-setup, global-mocks)

**Analog:** Self (v1.2 setup → v4 setup; pattern unchanged)

**Current state** (lines 1-61) — the full file is the analog. Key patterns:

**Import pattern** (line 1):
```typescript
import { vi } from 'vitest';
```

**localStorage mock pattern** (lines 4-26) — explicit in-memory store:
```typescript
const store: Record<string, string> = {};
const mockStorage: Storage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  // ... full Storage interface stub
};
Object.defineProperty(globalThis, 'localStorage', {
  value: mockStorage,
  writable: true,
  configurable: true,
});
// Same for window.localStorage
```

**crypto mock pattern** (lines 29-48) — guarded with `typeof crypto === 'undefined'`:
```typescript
if (typeof crypto === 'undefined' || !crypto.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      randomUUID: () => 'test-uuid-' + Math.random().toString(36).slice(2),
      // ... subtle.importKey, sign, etc. all vi.fn()
    },
  });
}
```

**Lifecycle hook pattern** (lines 50-61):
```typescript
beforeAll(() => {
  vi.stubGlobal('navigator', {
    onLine: true,
    geolocation: { getCurrentPosition: vi.fn() },
  });
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
```

**Vitest v4 changes to verify:**
- `vi.stubGlobal` still supported (was in v1.2)
- `vi.restoreAllMocks` still supported
- `Object.defineProperty` for `globalThis` may be stricter in v4 (Node 22+ behavior) — verify setup runs without error
- File path may need to change if `tests/` directory is fully eliminated (e2e.test.ts moves out, but `setup.ts` could stay OR move to `src/__tests__/setup.ts`)

**Recommendation:** Keep `tests/setup.ts` location AND the Vite config's `setupFiles: ['./tests/setup.ts']` reference unchanged — only modify API calls if v4 breaks them. This minimizes diff and keeps the file discoverable.

---

### `kapwa-client/src/__tests__/` (new directory, test-orphan)

**Analog:** `kapwa-client/src/tests/` (existing orphan directory pattern)

**Current state:** `src/tests/` already exists as a home for orphan tests (a11y, pii, sla, search, bulk-actions). The pattern is well-established.

**Required changes (D-07):**
- Create NEW directory `src/__tests__/` (note double underscore — Next.js/Vitest convention, distinct from `src/tests/`)
- Move these files to `src/__tests__/`:
  - `tests/e2e.test.ts` → `src/__tests__/e2e.test.ts`
  - `src/tests/a11y/pages.test.ts` → `src/__tests__/a11y/pages.test.ts`
  - `src/tests/a11y/components.test.tsx` → `src/__tests__/a11y/components.test.tsx` (if it lacks 1:1 source mapping — it does, it tests 8 components)
  - `src/tests/pii/masking.test.ts` → `src/__tests__/pii/masking.test.ts`
  - `src/tests/sla/timer.test.ts` → `src/__tests__/sla/timer.test.ts`
  - `src/tests/search/global.test.ts` → `src/__tests__/search/global.test.ts`
  - `src/tests/bulk-actions/selection.test.tsx` → `src/__tests__/bulk-actions/selection.test.tsx`

**Path imports to fix in moved files** (e.g., `src/tests/a11y/components.test.tsx` line 5-12):
```typescript
// CURRENT (uses @ alias which still works after move)
import { SkipToContent } from '@/components/a11y/SkipToContent';
import { AriaLiveRegion } from '@/components/a11y/AriaLiveRegion';
import { PageShell } from '@/components/PageShell';
import { EmptyState } from '@/components/EmptyState';

// These imports continue to work because @/ maps to src/ via vite.config.ts + tsconfig.json
// NO path rewrite needed for @/ imports
```

But `tests/e2e.test.ts` uses RELATIVE imports — these MUST be rewritten:
```typescript
// CURRENT (e2e.test.ts line 6-15):
vi.mock('../src/lib/offline-queue', () => ({ ... }));
vi.mock('../src/lib/sync', () => ({ ... }));
vi.mock('../src/lib/auth', () => ({ ... }));
// and inside describe blocks (lines 285, 291, 300, 309, 333, 348):
const { initDatabase } = await import('../src/lib/database');
const { queueChange } = await import('../src/lib/offline-queue');

// AFTER MOVE to src/__tests__/e2e.test.ts:
// '../src/lib/offline-queue' → '../lib/offline-queue' (one fewer '..' level)
vi.mock('../lib/offline-queue', () => ({ ... }));
const { initDatabase } = await import('../lib/database');
```

**Same rewrite applies** to all 6 test files currently in `tests/`:
- `tests/sync-conflict.test.ts` — `../src/lib/offline-queue` → `../lib/offline-queue`
- `tests/secure-storage.test.ts` — same pattern
- `tests/offline-queue.test.ts` — same pattern
- `tests/intake-page.test.ts` — same pattern
- `tests/beneficiaries-search.test.ts` — same pattern
- `tests/family-graph.test.ts` — same pattern
- `tests/consent-manager.test.ts` — same pattern

---

### Co-located test file relocations (28 files)

**Analog:** `kapwa-client/src/components/BottomNav.test.tsx` (canonical co-located pattern)

**Current co-located exemplars (no move needed, but pattern reference):**
- `src/components/BottomNav.test.tsx` (59 lines)
- `src/components/PageShell.test.tsx` (83 lines)
- `src/components/EmptyState.test.tsx` (55 lines)
- `src/components/ErrorBoundary.test.tsx` (118 lines)
- `src/components/SyncQueuePanel.test.tsx` (108 lines)
- `src/components/ConflictResolutionDialog.test.tsx` (66 lines)
- `src/components/cards/AccessCard.test.tsx` (79 lines)
- `src/components/skeletons/*.test.tsx` (3 files)
- `src/components/data-table/DataTable.test.tsx`

**Test file moves (D-05, D-06):**

| Current path | New path |
|--------------|----------|
| `tests/pages/AboutPage.test.tsx` | `src/pages/AboutPage.test.tsx` |
| `tests/pages/LandingPage.test.tsx` | `src/pages/LandingPage.test.tsx` |
| `tests/pages/LoginPage.test.tsx` | `src/pages/LoginPage.test.tsx` |
| `tests/pages/RegisterPage.test.tsx` | `src/pages/RegisterPage.test.tsx` |
| `tests/components/PublicHeader.test.tsx` | `src/components/PublicHeader.test.tsx` |
| `tests/layouts/PublicLayout.test.tsx` | `src/components/PublicLayout.test.tsx` (note: dir rename) |
| `tests/sync-conflict.test.ts` | `src/lib/offline-queue.test.ts` (or `src/__tests__/offline-queue.test.ts` — verify) |
| `tests/secure-storage.test.ts` | `src/lib/secure-storage.test.ts` |
| `tests/offline-queue.test.ts` | (duplicate with above — needs disambiguation) |
| `tests/intake-page.test.ts` | `src/pages/IntakePage.test.tsx` |
| `tests/beneficiaries-search.test.ts` | (orphan — no 1:1 source file) → `src/__tests__/beneficiaries-search.test.ts` |
| `tests/family-graph.test.ts` | (orphan) → `src/__tests__/family-graph.test.ts` |
| `tests/consent-manager.test.ts` | (orphan) → `src/__tests__/consent-manager.test.ts` |
| `src/pages/__tests__/AccessCardPage.test.tsx` | `src/pages/AccessCardPage.test.tsx` (already co-located via __tests__ subdir, flatten) |
| ... 14 more `src/pages/__tests__/*.test.tsx` | flatten to `src/pages/*.test.tsx` |
| 3 `src/components/skeletons/*.test.tsx` | already co-located (no move) |

**Pattern to copy from `src/components/BottomNav.test.tsx` lines 1-14** — the canonical co-located test structure:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BottomNav } from './BottomNav';  // ← relative import from same dir

// Mock @/ aliases
vi.mock('@/hooks/use-media-query', () => ({
  useMediaQuery: vi.fn(() => true),
}));

// After mock, import the mocked module to access the vi.fn()
import { useMediaQuery } from '@/hooks/use-media-query';

// Helper for tests that need a router
function renderWithRouter(ui: React.ReactElement, { initialEntries = ['/'] } = {}) {
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
}

describe('BottomNav', () => {
  it('renders 5 tab items including Dashboard, Cases, Beneficiaries, Profile, and Quick Action', () => {
    renderWithRouter(<BottomNav />);
    expect(screen.getByText('Dashboard')).toBeTruthy();
    // ...
  });
});
```

**Key pattern rules when moving files:**
1. Change `import { Foo } from '../../src/components/Foo';` → `import { Foo } from './Foo';` (relative depth shrinks)
2. Keep `@/...` alias imports unchanged (alias still resolves to `src/`)
3. Keep the same `describe`/`it` structure and `vi.mock` calls
4. Keep `vi.hoisted` for shared mock factories (pattern from `src/tests/a11y/components.test.tsx` lines 14-40)

**Mock factory pattern (vi.hoisted)** — for shared mutable mocks across tests:
```typescript
// From src/tests/a11y/components.test.tsx lines 14-17
const mockUseCacheStaleness = vi.hoisted(() => () => ({
  isStale: false,
  ageDisplay: '',
}));
vi.mock('@/hooks/use-cache-staleness', () => ({
  useCacheStaleness: mockUseCacheStaleness,
}));
```

**Mock factory pattern (top-level mutable mock)** — from `tests/intake-page.test.ts` lines 4-14:
```typescript
const queueCalls: unknown[][] = [];
const mockQueueChange = vi.fn((...args: unknown[]) => {
  queueCalls.push(args);
  return Promise.resolve({ id: 'mock-id', tableName: args[0], status: 'pending' });
});

vi.mock('../src/lib/offline-queue', () => ({
  queueChange: (...args: unknown[]) => mockQueueChange(...args),
  loadQueue: vi.fn(() => []),
  getPendingChanges: vi.fn(() => Promise.resolve([])),
}));
```

---

## Shared Patterns

### Test file imports (universal across all co-located test files)

**Source:** `src/components/BottomNav.test.tsx` (line 1-4), `src/components/PageShell.test.tsx` (line 1-3), `src/components/EmptyState.test.tsx` (line 1-4)

**Apply to:** All 28 moved test files + new co-located test files

```typescript
// Vitest imports (always first)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Only include what you use — empty imports not required

// RTL imports
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Router (use MemoryRouter for unit tests, BrowserRouter for integration)
import { MemoryRouter, BrowserRouter } from 'react-router-dom';

// Subject under test — RELATIVE import from same directory
import { ComponentName } from './ComponentName';
```

**Path alias (`@/`) usage:**
- Use `@/lib/...` for mocks of lib utilities
- Use `@/hooks/...` for mocks of hooks
- Use `@/components/...` for cross-component imports (only when needed)
- Source: `src/components/BottomNav.test.tsx` line 7, `src/components/PageShell.test.tsx` line 6

---

### Mock organization

**Source:** `src/components/ConflictResolutionDialog.test.tsx` lines 5-8, `src/components/SyncQueuePanel.test.tsx` lines 6-9

**Apply to:** All test files that mock dependencies

**Pattern A — Simple module mock:**
```typescript
vi.mock('@/lib/offline-queue', () => ({
  loadQueue: vi.fn(() => []),
}));
```

**Pattern B — Mock with captured calls:**
```typescript
const mockLoadQueue = vi.fn();
vi.mock('@/lib/offline-queue', () => ({
  loadQueue: (...args: unknown[]) => mockLoadQueue(...args),
}));
```

**Pattern C — vi.hoisted for hoisting-safe shared state:**
```typescript
const mockUseCacheStaleness = vi.hoisted(() => () => ({
  isStale: false,
  ageDisplay: '',
}));
vi.mock('@/hooks/use-cache-staleness', () => ({
  useCacheStaleness: mockUseCacheStaleness,
}));
```

**Mock placement rule:** All `vi.mock(...)` calls must come BEFORE any `import` that uses the mocked module (Vitest hoists them, but the convention is clear ordering). See `src/components/PageShell.test.tsx` lines 5-10.

---

### `vi.mocked()` for typed mock access

**Source:** `src/components/PageShell.test.tsx` line 14, `src/components/BottomNav.test.tsx` line 55

**Apply to:** Tests that need to call `.mockReturnValue()` or `.mockReturnValueOnce()` on a mocked function

```typescript
import { useCacheStaleness } from '@/hooks/use-cache-staleness';

// In test:
vi.mocked(useCacheStaleness).mockReturnValue({ isStale: true, ageDisplay: '12 min' });
vi.mocked(useMediaQuery).mockReturnValueOnce(false);
```

**Avoid** the old `useCacheStaleness as jest.Mock` cast — use `vi.mocked()` instead (already established in the codebase).

---

### Assertion style

**Source:** `src/components/EmptyState.test.tsx` (entire file), `src/components/BottomNav.test.tsx` lines 18-58

**Apply to:** All moved test files

```typescript
// Truthy check for elements
expect(screen.getByText('Dashboard')).toBeTruthy();

// Absence check
expect(screen.queryByText('Cached data')).toBeNull();

// Click trigger
screen.getByText('Try Again').click();

// Async state change
expect(onAction).toHaveBeenCalledTimes(1);

// Class check
expect(link?.classList.contains('rounded-full')).toBe(true);

// Role-based query
const retryBtn = screen.getByRole('button', { name: /Retry Sync/i });
```

**Do NOT migrate to `toBeInTheDocument()`** — current pattern uses `toBeTruthy()`/`toBeNull()`. Consistency with existing code is more important than matching new @testing-library/jest-dom matchers. D-04 confirms `jest-dom` is installed but its matchers are NOT yet in use.

---

### Router wrapper for component tests

**Source:** `src/components/BottomNav.test.tsx` lines 13-15, `src/components/EmptyState.test.tsx` lines 6-8

**Apply to:** All component test files that render a component using `<Link>`, `useNavigate`, or `useLocation`

```typescript
// MemoryRouter (preferred for unit tests — controlled initial location)
function renderWithRouter(ui: React.ReactElement, { initialEntries = ['/'] } = {}) {
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
}

// BrowserRouter (use for tests that depend on real URL behavior)
function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}
```

---

### ErrorBoundary test pattern (concrete error simulation)

**Source:** `src/components/ErrorBoundary.test.tsx` lines 7-30

**Apply to:** Any test of a class-component error boundary

```typescript
function Bomb({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Safe content</div>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});  // suppress React error logs
    setupOnline();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});
```

**Required:** Always `vi.spyOn(console, 'error')` when testing error boundaries to suppress noisy React error logs in test output.

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md / Vitest v4 docs instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Vitest v4 release notes / migration guide | docs | n/a | External reference — Phase 12 must consult https://vitest.dev/guide/migration.html for breaking changes |

**Specific v4 changes to research in plan:**
- New `test.workspace` config (if multi-project)
- Default `pool` changed from `threads` to `forks` in v3+ (verify v4)
- `vi.mock` hoisting changes
- `expect` assertion API changes (none expected, but verify)
- New `test.browser` mode (if relevant)

---

## Metadata

**Analog search scope:** `kapwa-client/src/`, `kapwa-client/tests/`, `kapwa-client/package.json`, `kapwa-client/vite.config.ts`, `.planning/codebase/TESTING.md`, `.planning/codebase/CONVENTIONS.md`
**Files scanned:** 46 test files + 4 config files + 2 codebase docs
**Pattern extraction date:** 2026-07-05
