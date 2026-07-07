# Phase 16: UI Polish — ErrorBoundary + A11Y + Core UI Tests — Pattern Map

**Mapped:** 2026-07-07
**Files analyzed:** 15 (3 modified + 12 new test files)
**Analogs found:** 12 / 12 (with documented patterns for every file)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/ErrorBoundary.tsx` (modified) | component | event-driven (error fallback) | `src/components/ErrorBoundary.tsx` (current) | exact (self) |
| `src/components/ErrorBoundary.test.tsx` (modified, +1 test) | test | event-driven | `src/components/ErrorBoundary.test.tsx` (current) | exact (self) |
| `tests/setup.ts` (modified, +1 import) | config | n/a | `tests/setup.ts` (current) | exact (self) |
| `src/components/Layout.test.tsx` (NEW) | test | component render | `src/components/PublicLayout.test.tsx` | role-match |
| `src/components/Topbar.test.tsx` (NEW) | test | component render | `src/components/BottomNav.test.tsx` | role-match |
| `src/components/Sidebar.test.tsx` (NEW) | test | component render | `src/components/BottomNav.test.tsx` | role-match |
| `src/components/ProtectedRoute.test.tsx` (NEW) | test | component render (async) | `src/components/SyncQueuePanel.test.tsx` | partial-match (async + mock) |
| `src/pages/AuditorPage.test.tsx` (NEW) | test | page render (useSWR) | `src/pages/CaseTrackerPage.test.tsx` | exact |
| `src/pages/ContactPage.test.tsx` (NEW) | test | page render (no useSWR) | `src/pages/LandingPage.test.tsx` | role-match |
| `src/pages/CoordinatorDashboardPage.test.tsx` (NEW) | test | page render (raw `api.get`) | `src/pages/IntakePage.test.tsx` | role-match |
| `src/pages/MayorReportsPage.test.tsx` (NEW) | test | page render (useSWR) | `src/pages/CaseTrackerPage.test.tsx` | exact |
| `src/pages/MyAccessCardPage.test.tsx` (NEW) | test | page render (useSWR) | `src/pages/AccessCardPage.test.tsx` | exact |
| `src/pages/ProgramsPage.test.tsx` (NEW) | test | page render (useSWR) | `src/pages/AdminPage.test.tsx` | role-match |
| `src/pages/IrfDetailPage.test.tsx` (NEW) | test | page render (useParams + raw `api.get`) | `src/pages/CaseTrackerPage.test.tsx` | role-match |
| `src/pages/AccessCardPrintView.test.tsx` (NEW) | test | page render (useParams + useSWR) | `src/pages/AccessCardPage.test.tsx` | role-match |

## Pattern Assignments

### `src/components/ErrorBoundary.tsx` (component, event-driven fallback) — MODIFIED

**Analog:** Self (Phase 13 D-06/D-07 migration to `react-error-boundary`; Phase 16 re-adds offline branch)

**Current structure** (lines 1-37):
```tsx
import type { ReactNode } from 'react';
import { ErrorBoundary as ReactErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { AriaLiveRegion } from '@/components/a11y/AriaLiveRegion';

function ErrorFallback({ resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <TriangleAlert size={48} className="text-destructive" />
      <AriaLiveRegion role="alert" aria-live="assertive" message="Something went wrong">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
      </AriaLiveRegion>
      <p className="text-sm text-muted-foreground">An unexpected error occurred. Please try again later.</p>
      <div className="flex gap-2">
        <Button onClick={resetErrorBoundary}>Try Again</Button>
        <Button variant="outline" asChild><Link to="/dashboard">Go to Dashboard</Link></Button>
      </div>
    </div>
  );
}

export function ErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, info) => console.error('ErrorBoundary caught:', error, info)}
    >
      {children}
    </ReactErrorBoundary>
  );
}
```

**Proposed modification (Phase 16 D-01/D-02):** Add `isOfflineError` predicate; branch the render of `ErrorFallback` to use `<EmptyState variant="offline" />` when the predicate is true.

**EmptyState offline variant** (`src/components/EmptyState.tsx:30-35, 48-55`):
```tsx
'offline': {
  icon: WifiOff,
  message: 'You appear to be offline',
  cta: 'Retry',
  hint: 'Please check your connection and try again',
},
// ...
const handleAction = () => {
  if (variant === 'no-results' || variant === 'offline') {
    onAction?.();   // <-- onAction wired to resetErrorBoundary in ErrorBoundary
  } else {
    navigate(variant === 'no-data' ? '/intake' : '/dashboard');
  }
};
```

**`isOfflineError` predicate** (D-01 from CONTEXT.md):
```tsx
function isOfflineError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (error instanceof Error) {
    return error.name === 'TypeError' && /fetch|network|failed to fetch/i.test(error.message);
  }
  return false;
}
```

**Branched render in `ErrorFallback`:**
```tsx
function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  if (isOfflineError(error)) {
    return (
      <div className="flex flex-col items-center justify-center py-16" data-testid="error-offline">
        <EmptyState variant="offline" onAction={resetErrorBoundary} />
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      {/* ... existing TriangleAlert + AriaLiveRegion + Try Again + Go to Dashboard */}
    </div>
  );
}
```

**Why this pattern:** The existing TriangleAlert + AriaLiveRegion UI stays for generic errors. The new offline branch is a separate visual treatment using the already-implemented `<EmptyState variant="offline" />` (no new component). `resetErrorBoundary` is the perfect `onAction` target — clicking Retry triggers React's re-mount.

---

### `src/components/ErrorBoundary.test.tsx` (test) — MODIFIED (+1 test)

**Analog:** Self (existing 4 tests, adding 1 for offline branch)

**Imports pattern** (lines 1-4):
```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ErrorBoundary } from './ErrorBoundary';
```

**Bomb component pattern** (lines 6-11) — reuse for the new fetch-bomb variant:
```tsx
function Bomb({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Safe content</div>;
}
```

**Test scaffolding** (lines 13-20):
```tsx
describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
  // ...tests
});
```

**Proposed new test (D-03 — offline branch):**
```tsx
function FetchBomb({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) throw new TypeError('Failed to fetch');
  return <div>Safe content</div>;
}

it('renders offline UI when TypeError("Failed to fetch") is thrown', () => {
  render(
    <MemoryRouter>
      <ErrorBoundary>
        <FetchBomb />
      </ErrorBoundary>
    </MemoryRouter>
  );
  expect(screen.getByText('You appear to be offline')).toBeTruthy();
  expect(screen.getByText('Please check your connection and try again')).toBeTruthy();
  expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
});
```

**Note:** The `EmptyState` text + Retry button text are verified at `EmptyState.test.tsx:23-28` — the assertion strings are exact.

---

### `tests/setup.ts` (config) — MODIFIED (+1 import)

**Analog:** Self (current setup)

**Current top of file** (lines 1-2):
```typescript
import { vi } from 'vitest';
// Mock localStorage for all environments (Node 26 + jsdom compat)
```

**Proposed addition (D-06 — vitest-axe global setup):**
```typescript
import 'vitest-axe/extend-expect';
import { vi } from 'vitest';
// ... rest of existing setup
```

**Why this pattern:** `vitest-axe/extend-expect` is a side-effect import that augments Vitest's `expect` type with `toHaveNoViolations()`. One global import enables the matcher in every test file (no per-file setup needed). The existing 8 a11y tests in `src/__tests__/a11y/components.test.tsx` use the raw `expect(results.violations).toHaveLength(0)` pattern — that continues to work after the import.

**Why no other changes:** `navigator.onLine` is already stubbed in `tests/setup.ts:52-55` (`{ onLine: true, ... }`), and `localStorage.clear()` is in `afterEach` at line 58-60. The Layout test's offline scenario can be set per-test via `Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })`.

---

### `src/components/Layout.test.tsx` (test, component render) — NEW

**Analog:** `src/components/PublicLayout.test.tsx` (closest in role — same component layer, same MemoryRouter pattern)

**Imports + mocks pattern** (`PublicLayout.test.tsx:1-16`):
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Layout } from './Layout';

vi.mock('../lib/auth-context', () => ({
  useAuth: vi.fn(() => ({ user: null, loading: false })),
}));
```

**Render wrapper** (from `PublicLayout.test.tsx:18-26`):
```tsx
function renderLayout() {
  return render(<MemoryRouter initialEntries={['/dashboard']}><Layout /></MemoryRouter>);
}
```

**Existing axe pattern** (`src/__tests__/a11y/components.test.tsx:78-88` — use `axe(container)`):
```tsx
import { axe } from 'vitest-axe';
// ...
test('PageShell has no a11y violations', async () => {
  const { container } = render(<MemoryRouter><PageShell title="x" description="y"><p>z</p></PageShell></MemoryRouter>);
  const results = await axe(container);
  expect(results.violations).toHaveLength(0);
});
```

**D-04 tests for Layout** (5 tests):
- renders main container (`container.querySelector('main#main-content')`)
- SkipToContent is the first focusable link (uses `screen.getByText('Skip to content')`)
- AriaLiveRegion renders offline message when `navigator.onLine === false` (per-test Object.defineProperty on navigator)
- Sync queue panel mounts (renders `<SyncQueuePanel open={false} />` — verify by querying DOM)
- has no a11y violations (`expect(results).toHaveNoViolations()`)

**Layout dependencies to mock** (from `Layout.tsx:1-20`):
- `useAuth` from `@/lib/auth-context` — line 51 (`const { user } = useAuth();`)
- `loadQueue` from `@/lib/offline-queue` — line 22-25 (`computePendingCount()`)
- Child components: `Sidebar`, `Topbar`, `Sheet`, `Breadcrumb`, `ErrorBoundary`, `BottomNav`, `SyncStatusBanner`, `SyncQueuePanel`, `SkipToContent`, `AriaLiveRegion` — for the smoke test, render the real Layout (no need to mock child components)

**Layout's `navigator.onLine` check** (`Layout.tsx:53`): `useState(!navigator.onLine)` — tests/setup stubs `navigator.onLine: true` by default, so the offline state must be triggered per-test:
```tsx
it('AriaLiveRegion shows offline message when navigator.onLine is false', () => {
  Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
  renderLayout();
  expect(screen.getByText(/You are offline/i)).toBeTruthy();
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });  // restore
});
```

**Layout's `main#main-content` landmark** (`Layout.tsx:112`): the smoke test asserts this exists.

---

### `src/components/Topbar.test.tsx` (test, component render) — NEW

**Analog:** `src/components/BottomNav.test.tsx` (closest in role — same role-gated component, same `useMediaQuery` mock pattern)

**Imports + auth-mock pattern** (from `BottomNav.test.tsx:1-15`):
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Topbar } from './Topbar';

vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'a@b.com', fullName: 'A B', role: 'social_worker' },
    token: 'test-tok',
    loading: false,
    login: vi.fn(), logout: vi.fn(),
  }),
}));
```

**Render wrapper** (from `BottomNav.test.tsx:13-15`):
```tsx
function renderWithRouter(ui: React.ReactElement, { initialEntries = ['/'] } = {}) {
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
}
```

**Topbar uses two contexts** (`Topbar.tsx:3-4`): `useAuth` and `useTheme`. **Theme mock is required**:
```tsx
vi.mock('@/lib/theme-context', () => ({
  useTheme: () => ({ theme: 'light', resolvedTheme: 'light', setTheme: vi.fn() }),
}));
```

**Topbar dependencies to mock:**
- `useAuth` from `@/lib/auth-context` — line 27 (`const { user, logout } = useAuth();`)
- `useTheme` from `@/lib/theme-context` — line 28 (`const { theme, setTheme, resolvedTheme } = useTheme();`)
- `NotificationsDropdown` and `MessagesPopover` (used as components in Topbar lines 115-116) — these are present in the DOM, but their internal data fetching is acceptable for smoke tests. If they break, mock them.

**D-04 tests for Topbar** (4 tests):
- renders without crashing (asserts the `<header>` is present)
- menu toggle button works (click + assert callback called via `vi.fn()`)
- user dropdown / logout works (open the `<DropdownMenu>` via fireEvent, then assert the Logout item exists; the existing `BottomNav.test.tsx:42-46` precedent shows `document.querySelector('a[href="/intake"]')` for active link checks)
- sync queue button (role-gated — verify it appears for `social_worker` role and NOT for a non-worker role)
- has no a11y violations (axe on `<header>`)

**Role-gated pattern** (from `Topbar.tsx:38-42`):
- `isAdmin = user?.role === 'admin'`
- `isSocialWorker = user?.role === 'social_worker'`
- `canIntake = isAdmin || isSocialWorker || isCoordinator` → renders the "New Intake" button (line 83)
- `canApprove = isAdmin || isSocialWorker` → renders the "Approvals Queue" button (line 98)

For a `social_worker` mock: both New Intake and Approvals Queue should render. For a `claimant` mock: neither should render.

---

### `src/components/Sidebar.test.tsx` (test, component render) — NEW

**Analog:** `src/components/BottomNav.test.tsx` (closest in role — same role-gated navigation component, same `active link highlight` assertion pattern)

**Render + auth-mock pattern** (from `BottomNav.test.tsx:6-15, 17-40`):
```tsx
vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'a@b.com', fullName: 'A B', role: 'social_worker' },
    token: 'test-tok', loading: false, login: vi.fn(), logout: vi.fn(),
  }),
}));

function renderWithRouter(ui, { initialEntries = ['/'] } = {}) {
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
}
```

**Active link highlight pattern** (from `BottomNav.test.tsx:29-40`):
```tsx
it('shows active tab with bg-muted class', () => {
  renderWithRouter(<BottomNav />, { initialEntries: ['/'] });
  const links = document.querySelectorAll('a');
  let activeLink = null;
  links.forEach(link => {
    if (link.classList.contains('bg-muted')) activeLink = link;
  });
  expect(activeLink).toBeTruthy();
});
```

**Sidebar's role-gating** (`Sidebar.tsx:11-19`):
```tsx
const visibleItems = group.items.filter(item => item.roles.includes(user?.role ?? ''));
```
For a `social_worker` mock: visible nav groups should appear (e.g., Dashboard, Cases, Beneficiaries, etc. — defined in `src/lib/nav-config.tsx`).

**D-04 tests for Sidebar** (3 tests):
- renders without crashing (asserts `<aside>` is present)
- role-gated nav items appear for `social_worker` role (asserts specific group labels from NAV_GROUPS are present)
- active link highlight reflects current path (use `initialEntries: ['/cases']` then assert the Cases link has the `bg-muted` class)

**Sidebar's `location.pathname.startsWith` logic** (`Sidebar.tsx:27-29`): when `item.path === '/'`, active only on exact match. Otherwise, `startsWith`.

---

### `src/components/ProtectedRoute.test.tsx` (test, async component render) — NEW

**Analog:** `src/components/SyncQueuePanel.test.tsx` (closest in role — async useEffect-driven state, mock at module level)

**Mock at module level pattern** (from `SyncQueuePanel.test.tsx:1-9`):
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockLoadQueue = vi.fn();
vi.mock('@/lib/offline-queue', () => ({
  loadQueue: (...args: unknown[]) => mockLoadQueue(...args),
}));
```

**ProtectedRoute's `getCurrentUser` import** (`ProtectedRoute.tsx:3`):
```tsx
import { getCurrentUser } from '../lib/auth-context';
```
This is the only import that needs mocking for ProtectedRoute's async behavior.

**ProtectedRoute's auth logic** (`ProtectedRoute.tsx:22-48`):
```tsx
async function checkAuth() {
  const token = localStorage.getItem('kapwa_token');
  if (!token) {
    navigate('/login', { replace: true });
    return;
  }
  try {
    const user = await getCurrentUser();
    if (!user) { ... navigate('/login', { replace: true }); return; }
    if (roles && roles.length > 0 && !roles.includes(user.role)) {
      navigate(roleRedirectMap[user.role] || '/dashboard', { replace: true });
      return;
    }
    setAuthorized(true);
  } catch {
    setAuthorized(true);
  }
}
```

**Mock pattern for ProtectedRoute test:**
```tsx
import { getCurrentUser } from '../lib/auth-context';
vi.mock('../lib/auth-context', async () => {
  const actual = await vi.importActual<typeof import('../lib/auth-context')>('../lib/auth-context');
  return {
    ...actual,
    getCurrentUser: vi.fn(),
  };
});
```

**Or simpler — full mock (since ProtectedRoute only uses `getCurrentUser`):**
```tsx
vi.mock('../lib/auth-context', () => ({
  getCurrentUser: vi.fn(),
}));
```

**Test patterns** (4 tests per D-04):
- redirects to `/login` when unauthenticated: `localStorage.removeItem('kapwa_token')` + `vi.mocked(getCurrentUser).mockResolvedValue(null)` + assert `navigate('/login')` called (use a MemoryRouter spy via `useNavigate`)
- renders children when authenticated: set `localStorage.setItem('kapwa_token', 'test')` + mock `getCurrentUser` to return user + assert children render
- returns nothing/spinner during loading: assert `screen.getByText(/Verifying access/i)` is present before the async resolves (use `screen.findByText` is not needed; the initial render shows "Verifying access...")
- redirects/forbids when role mismatch: mock user with wrong role + assert `navigate('/dashboard')` called (or the roleRedirectMap target)

**Async testing pattern** (use `waitFor` from `@testing-library/react`):
```tsx
import { waitFor } from '@testing-library/react';
it('redirects to /login when no token', async () => {
  localStorage.removeItem('kapwa_token');
  render(<MemoryRouter><ProtectedRoute><div>Protected</div></ProtectedRoute></MemoryRouter>);
  await waitFor(() => {
    expect(screen.queryByText('Protected')).toBeNull();
  });
});
```

**roleRedirectMap** (`ProtectedRoute.tsx:5-12`) for role-mismatch test:
- `social_worker → /dashboard`
- `admin → /admin`
- `coordinator → /coordinator`
- `claimant → /my-dashboard`
- `mayor → /reports`
- `auditor → /audit-logs`

**Why this pattern:** ProtectedRoute is fundamentally async — `authorized` starts as `null` and updates after `useEffect` fires. The `await waitFor(() => ...)` pattern is required to handle the state transition. No precedent in the codebase — this is new for Phase 16.

---

### `src/pages/AuditorPage.test.tsx` (test, page render + useSWR) — NEW

**Analog:** `src/pages/CaseTrackerPage.test.tsx` (exact match — same SWRConfig + MemoryRouter + vi.hoisted mockApiGet pattern)

**Imports + mock setup** (from `CaseTrackerPage.test.tsx:1-49`):
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { AuditorPage } from './AuditorPage';

const { mockApiGet, mockApiPost } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: vi.fn(),
    del: vi.fn(),
  },
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}
```

**AuditorPage heading assertion** (per D-09 + research D-09):
```tsx
describe('AuditorPage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('hashChains')) return Promise.resolve({ cases: { valid: true }, beneficiaries: { valid: true } });
      if (k.includes('consentLedger')) return Promise.resolve([]);
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders PageShell heading', async () => {
    renderWithSWR(<AuditorPage />);
    expect(await screen.findByRole('heading', { name: 'Audit Logs' })).toBeTruthy();
  });
});
```

**AuditorPage's render gate** (`AuditorPage.tsx:26`): `if (loading) return <div>Loading audit data...</div>` — so the test must mock the SWR fetcher to resolve the hash chain to bypass the loading state. The D-09 "useSWR returns undefined, page renders loading skeleton" path is acceptable but less useful — preferring to mock with valid data so the heading renders.

**Query key for AuditorPage** (`AuditorPage.tsx:11-15`):
- `queryKeys.audit.hashChains()` — returns the hash chain object
- `queryKeys.audit.consentLedger(filter)` — returns the consent ledger array

---

### `src/pages/ContactPage.test.tsx` (test, page render no useSWR) — NEW

**Analog:** `src/pages/LandingPage.test.tsx` (closest in role — no useSWR, no auth, no api mock; pure render-only smoke)

**Imports + render pattern** (from `LandingPage.test.tsx:1-14`):
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ContactPage } from './ContactPage';

describe('ContactPage', () => {
  it('renders hero heading', () => {
    render(<BrowserRouter><ContactPage /></BrowserRouter>);
    expect(screen.getByText('Get in Touch')).toBeTruthy();
  });
});
```

**ContactPage's heading** (`ContactPage.tsx:67-68`):
```tsx
<h1 className="font-heading text-4xl md:text-5xl font-bold tracking-tight text-balance mb-4">
  Get in Touch
</h1>
```

**Why this pattern:** ContactPage has no useSWR, no auth, no API calls — it's a public form. The test is the simplest possible: render + assert heading. No `vi.mock('@/lib/api', ...)`, no `vi.mock('@/lib/auth-context', ...)` (per research.md D-09 note: "For those, the test is even simpler"). Use `BrowserRouter` (or `MemoryRouter`) — both work for a render-only test.

---

### `src/pages/CoordinatorDashboardPage.test.tsx` (test, raw `api.get`) — NEW

**Analog:** `src/pages/IntakePage.test.tsx` (closest in role — uses raw `api.get` from `'../lib/api'`, not SWR; similar mock setup)

**Imports + mock pattern** (from `IntakePage.test.tsx:1-35`):
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CoordinatorDashboardPage } from './CoordinatorDashboardPage';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
  },
}));
```

**CoordinatorDashboardPage's `loadData` flow** (`CoordinatorDashboardPage.tsx:17-40`): calls `api.get('/dashboard')` then `setLoading(false)`. The mock must resolve to avoid unhandled promise rejection.

**Smoke test pattern:**
```tsx
describe('CoordinatorDashboardPage', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockResolvedValue({ servedToday: 5, pendingReview: 2, recentCases: [], unreadMessages: 1 });
  });

  it('renders PageShell heading', async () => {
    render(<MemoryRouter><CoordinatorDashboardPage /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Coordinator Dashboard' })).toBeTruthy();
  });
});
```

**CoordinatorDashboardPage heading** (`CoordinatorDashboardPage.tsx:60-62`): `<PageShell title="Coordinator Dashboard" description="...">`.

**Page's loading state** (`CoordinatorDashboardPage.tsx:57`): `if (loading) return <div>Loading dashboard...</div>` — the test must mock the api.get to resolve so the page transitions past the loading state to render the heading.

---

### `src/pages/MayorReportsPage.test.tsx` (test, useSWR) — NEW

**Analog:** `src/pages/CaseTrackerPage.test.tsx` (exact match — useSWR + MemoryRouter + vi.hoisted mockApiGet)

**Same import + mock setup as AuditorPage** (above).

**MayorReportsPage's SWR calls:** need to inspect the page to know the query keys. Use the same `mockApiGet.mockImplementation` pattern that returns based on `key.includes(...)`.

**Smoke test pattern:**
```tsx
beforeEach(async () => {
  mockApiGet.mockReset();
  mockApiGet.mockImplementation((key: unknown) => {
    const k = JSON.stringify(key);
    if (k.includes('reports')) return Promise.resolve({ summary: 'Test summary' });
    return Promise.resolve([]);
  });
  await mutate(() => true, undefined, { revalidate: false });
});

it('renders page heading', async () => {
  renderWithSWR(<MayorReportsPage />);
  expect(await screen.findByRole('heading', { name: /Reports|Mayor/i })).toBeTruthy();
});
```

**Page heading:** Read `MayorReportsPage.tsx` at execution time to determine the exact `<PageShell title="...">` value (RESEARCH.md did not include this file's content).

---

### `src/pages/MyAccessCardPage.test.tsx` (test, useSWR) — NEW

**Analog:** `src/pages/AccessCardPage.test.tsx` (closest in role — same domain — claimant's access card view, similar SWR pattern with `accessCards` keys)

**Same import + mock setup as CaseTrackerPage** (with `accessCards` key handling).

**Mock pattern from `AccessCardPage.test.tsx:42-51`:**
```tsx
beforeEach(async () => {
  mockApiGet.mockReset();
  mockApiGet.mockImplementation((key: unknown) => {
    const k = JSON.stringify(key);
    if (k.includes('accessCards') && k.includes('list')) return Promise.resolve(mockServices);
    return Promise.resolve(null);
  });
  await mutate(() => true, undefined, { revalidate: false });
});
```

**Smoke test:**
```tsx
it('renders page heading', async () => {
  renderWithSWR(<MyAccessCardPage />);
  expect(await screen.findByRole('heading', { name: /Access Card|My Card/i })).toBeTruthy();
});
```

**Page heading:** Read `MyAccessCardPage.tsx` at execution time for the exact `<PageShell title="...">` value.

---

### `src/pages/ProgramsPage.test.tsx` (test, useSWR + `getCurrentUser`) — NEW

**Analog:** `src/pages/AdminPage.test.tsx` (closest in role — admin program config, similar SWR pattern, plus `getCurrentUser` from auth-context)

**Same import + mock setup as AdminPage** (from `AdminPage.test.tsx:1-44`):
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { ProgramsPage } from './ProgramsPage';

const { mockApiGet, mockApiPost, mockApiPut, mockApiDel } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPut: vi.fn(),
  mockApiDel: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
    del: (...args: unknown[]) => mockApiDel(...args),
  },
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}
```

**Smoke test:**
```tsx
describe('ProgramsPage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue([]);
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders page heading', async () => {
    renderWithSWR(<ProgramsPage />);
    expect(await screen.findByRole('heading', { name: /Programs/i })).toBeTruthy();
  });
});
```

**`ProgramsPage` may also use `getCurrentUser`** (per RESEARCH.md "uses `JsonSchemaForm` + `getCurrentUser`") — may need to mock `'../lib/auth-context'` if the page calls `getCurrentUser` directly (instead of `useAuth`).

---

### `src/pages/IrfDetailPage.test.tsx` (test, useParams + raw `api.get`) — NEW

**Analog:** `src/pages/CaseTrackerPage.test.tsx` (closest in role — uses raw `api.get` for initial load, with similar mock + MemoryRouter pattern; `useParams` requires MemoryRouter with `initialEntries`)

**Imports + mock pattern** (from `CaseTrackerPage.test.tsx:1-49`):
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { IrfDetailPage } from './IrfDetailPage';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('../lib/api', () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args), post: vi.fn(), put: vi.fn(), del: vi.fn() },
}));
```

**`useParams` requires MemoryRouter with the route param:**
```tsx
function renderWithRouter(initialEntries: string[]) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/irf/:id" element={<IrfDetailPage />} />
        </MemoryRouter>
      </MemoryRouter>
    </SWRConfig>,
  );
}
```

**Alternative (simpler — IrfDetailPage.tsx already extracts `id` via `useParams`):**
```tsx
it('renders page for an IRF id', async () => {
  render(
    <MemoryRouter initialEntries={['/irf/IRF-001']}>
      <IrfDetailPage />
    </MemoryRouter>,
  );
  // IrfDetailPage calls api.get(`/irf/${id}`) and renders based on response
  expect(screen.getByText(/IRF-001|loading|Loading/i)).toBeTruthy();
});
```

**IrfDetailPage's `load` flow** (`IrfDetailPage.tsx:22-36`): calls `api.get(\`/irf/${id}\`)` — the test must mock this to resolve (or the page will stay in `loading: true` and render "Loading...").

**Note:** `IrfDetailPage` uses raw `api.get`, not SWR. So the mock is direct, no `<SWRConfig>` needed. Use the `IntakePage.test.tsx` pattern (which also uses raw `api.get`):
```tsx
vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() },
}));

it('renders page shell', async () => {
  vi.mocked(api.get).mockResolvedValue({ id: 'IRF-001', status: 'Under Investigation' });
  render(<MemoryRouter initialEntries={['/irf/IRF-001']}><IrfDetailPage /></MemoryRouter>);
  expect(await screen.findByText(/IRF-001|Investigation|Disposition/i)).toBeTruthy();
});
```

---

### `src/pages/AccessCardPrintView.test.tsx` (test, useParams + useSWR) — NEW

**Analog:** `src/pages/AccessCardPage.test.tsx` (closest in role — same domain — access card view, similar SWR pattern with `accessCards` keys; useParams adds MemoryRouter-with-route)

**Same import + mock setup as AccessCardPage** (with route param).

**Render with route param:**
```tsx
function renderWithRouter(initialEntries: string[]) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter initialEntries={initialEntries}>
        <AccessCardPrintView />
      </MemoryRouter>
    </SWRConfig>,
  );
}
```

**Mock for the access card:**
```tsx
beforeEach(async () => {
  mockApiGet.mockReset();
  mockApiGet.mockImplementation((key: unknown) => {
    const k = JSON.stringify(key);
    if (k.includes('accessCards') && k.includes('list')) return Promise.resolve(mockServices);
    return Promise.resolve(null);
  });
  await mutate(() => true, undefined, { revalidate: false });
});
```

**Smoke test:**
```tsx
it('renders print view for an access card', async () => {
  renderWithRouter(['/access-cards/print/NORZ-AC-2026-0001']);
  expect(await screen.findByText(/NORZ-AC-2026-0001|Access Card/i)).toBeTruthy();
});
```

**Page behavior:** The `useParams` extracts the `code` from the URL; the page then calls `api.get` to fetch the card details. The smoke test asserts that the print view mounts (heading or the card code is in the DOM).

---

## Shared Patterns

### Mocking `useAuth` from `'@/lib/auth-context'`

**Source:** `src/__tests__/a11y/components.test.tsx:22-29` (hoisted mock) + `src/components/PublicHeader.test.tsx:6-11` (vi.fn mock) + `src/components/PageShell.test.tsx:5-10` (module-level mock).

**Apply to:** All 4 new component tests (Layout, Topbar, Sidebar, ProtectedRoute) + all 8 new page tests.

**Standard pattern (hoisted):**
```tsx
const mockUseAuth = vi.hoisted(() => () => ({
  user: { id: '1', email: 'a@b.com', fullName: 'A B', role: 'social_worker' },
  token: null,
  loading: false,
}));
vi.mock('@/lib/auth-context', () => ({
  useAuth: mockUseAuth,
}));
```

**Standard pattern (inline):**
```tsx
vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'a@b.com', fullName: 'A B', role: 'social_worker' },
    token: 'test-tok',
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));
```

**Role selection per page** (per RESEARCH.md Open Question 4):
- `AuditorPage` → `auditor`
- `CoordinatorDashboardPage` → `coordinator`
- `MyAccessCardPage` → `claimant`
- `MayorReportsPage` → `mayor`
- Generic component tests (Layout, Topbar, Sidebar) → `social_worker`
- `ContactPage` → no auth needed (public)

### Mocking `'../lib/api'` for pages with `api.get` / `useSWR`

**Source:** `src/pages/CaseTrackerPage.test.tsx:7-35` (hoisted) + `src/pages/IntakePage.test.tsx:23-30` (inline).

**Apply to:** AuditorPage, MayorReportsPage, MyAccessCardPage, ProgramsPage (use SWR), IrfDetailPage + AccessCardPrintView (use `useParams` + raw `api.get`), CoordinatorDashboardPage (raw `api.get`).

**Hoisted pattern (preferred for SWR pages):**
```tsx
const { mockApiGet, mockApiPost } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
}));
vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: vi.fn(),
    del: vi.fn(),
  },
}));
```

**SWRCconfig + MemoryRouter wrapper:**
```tsx
function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}
```

### `<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>` for render-only page tests

**Source:** `16-RESEARCH.md Pattern 4` (proposed for the 8 page smoke tests).

**Apply to:** Pages where the goal is to confirm the page shell mounts without exercising the data layer. This is a simpler alternative to the `mockApiGet` pattern — SWR returns `undefined`, the page renders the loading skeleton or empty state, and the test asserts the page shell is in the DOM (e.g., via `PageShell` heading).

```tsx
import { SWRConfig } from 'swr';
// ...
render(
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    <MemoryRouter>
      <AuditorPage />
    </MemoryRouter>
  </SWRConfig>
);
expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
```

**Tradeoff:** The no-fetcher approach is simpler but may not bypass the page's loading state. The `mockApiGet` approach is more reliable for asserting the page's final UI. **Recommendation:** Use `mockApiGet` for consistency with the 20 existing page tests.

### `axe(container)` with `toHaveNoViolations()` for a11y

**Source:** `src/__tests__/a11y/components.test.tsx:1-167` (existing pattern using raw `expect(results.violations).toHaveLength(0)`) + RESEARCH.md Pattern 2 (proposed matcher pattern).

**Apply to:** Layout, Topbar, Sidebar smoke tests (per D-06).

**With matcher (Phase 16 preferred):**
```tsx
import 'vitest-axe/extend-expect';  // already in tests/setup.ts
import { axe } from 'vitest-axe';

it('has no a11y violations', async () => {
  const { container } = render(<MemoryRouter><Layout /></MemoryRouter>);
  const results = await axe(container);
  expect(results).toHaveNoViolations();  // vitest-axe matcher
});
```

**Without matcher (existing pattern, still works):**
```tsx
const results = await axe(container);
expect(results.violations).toHaveLength(0);
```

**WCAG ruleset:** vitest-axe default (`wcag2a` + `wcag2aa`) is sufficient per D-07. If a specific test needs additional rules, pass `await axe(container, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })`.

### Skipping the `axe` test for ProtectedRoute and 3 page snapshot tests

**Source:** D-06 + RESEARCH.md Pattern 2 "Do NOT add axe to ProtectedRoute (it has no DOM output of its own — it just decides what to render)".

**Apply to:** ProtectedRoute test, the 3 existing page snapshot tests (Phase 13 D-12/D-13/D-14), and the 8 new page smoke tests (no axe on pages per D-06).

### Mocking `'@/lib/theme-context'` for Topbar

**Source:** `src/lib/theme-context.tsx:58-61` (the actual hook).

**Apply to:** Topbar.test.tsx only.

```tsx
vi.mock('@/lib/theme-context', () => ({
  useTheme: () => ({ theme: 'light', resolvedTheme: 'light', setTheme: vi.fn() }),
}));
```

### Mocking `'@/lib/offline-queue'` for Layout

**Source:** `src/lib/offline-queue.ts:26-29` (the `loadQueue` function that reads `localStorage`).

**Apply to:** Layout.test.tsx only (per RESEARCH.md Pitfall 3).

```tsx
vi.mock('@/lib/offline-queue', () => ({
  loadQueue: () => [],
}));
```

This prevents `computePendingCount()` from returning a stale value from `localStorage` and making the `SyncStatusBanner` visible in an unexpected state.

### `vi.spyOn(console, 'error').mockImplementation(() => {})` in `beforeEach`

**Source:** `src/components/ErrorBoundary.test.tsx:14-16`.

**Apply to:** All ErrorBoundary tests (existing + new offline branch test).

```tsx
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});
```

This prevents `react-error-boundary` from logging the caught error to the test output.

### Test file naming + co-location

**Source:** All existing tests (e.g., `CaseTrackerPage.test.tsx` next to `CaseTrackerPage.tsx`; `ErrorBoundary.test.tsx` next to `ErrorBoundary.tsx`).

**Apply to:** All 12 new test files. Co-locate `<ComponentName>.test.tsx` next to `<ComponentName>.tsx`.

### No comments in test files (per AGENTS.md)

**Source:** `AGENTS.md` "DO NOT ADD ANY COMMENTS unless asked" + Phase 10-12 precedent (one-line `// Mock ...` notes are allowed inherited from `CaseTrackerPage.test.tsx:6`).

**Apply to:** All 12 new test files. Omit `// ...` comments. The `// Mock useMediaQuery` style 1-line fixture notes from `BottomNav.test.tsx:6` are acceptable.

### Relative imports only (no `@/*` aliases)

**Source:** `.planning/codebase/CONVENTIONS.md` + existing pattern (e.g., `vi.mock('../lib/api', ...)` in `CaseTrackerPage.test.tsx:28`).

**Apply to:** All 12 new test files. Use `vi.mock('../lib/...', ...)` not `vi.mock('@/lib/...', ...)`. Production code imports in test files may use `@/` for components (e.g., `import { PageShell } from '@/components/PageShell'`) but mock module paths use relative.

---

## No Analog Found

None. All 12 new test files have a clear analog in the existing codebase (20 existing page tests + 4 component tests + 1 a11y test). The only "new ground" is the `ProtectedRoute.test.tsx` async test pattern (the only component test that uses `await waitFor`); the closest analog is `SyncQueuePanel.test.tsx` for the module-level mock approach, but the async state machine is new for Phase 16.

---

## Metadata

**Analog search scope:**
- `src/components/*.test.tsx` (12 existing component tests)
- `src/pages/*.test.tsx` (20 existing page tests)
- `src/__tests__/a11y/components.test.tsx` (existing a11y test)
- `tests/setup.ts` (current setup)
- `src/components/{ErrorBoundary,EmptyState,Layout,Topbar,Sidebar,ProtectedRoute,PageShell,PublicHeader,BottomNav,SyncQueuePanel}.tsx` (production code to be modified or tested)
- `src/lib/{auth-context,theme-context,offline-queue}.ts(x)` (shared modules used in mocks)

**Files scanned:** 28 (12 component tests + 20 page tests + 1 a11y test + 5 production components + 3 lib modules)

**Pattern extraction date:** 2026-07-07

**Note on the 8 untested pages:** The exact `<PageShell title="...">` heading for each of the 8 pages (`AuditorPage`, `ContactPage`, `CoordinatorDashboardPage`, `MayorReportsPage`, `MyAccessCardPage`, `ProgramsPage`, `IrfDetailPage`, `AccessCardPrintView`) must be verified at execution time by reading the source files. The patterns above are based on the verified analogs — the planner should `Read` each page's first 30-50 lines to extract the exact heading text and SWR query keys.

**Verified at extraction time:**
- `AuditorPage.tsx:32` — `<PageShell title="Audit Logs" description="Hash-chain verified records and consent ledger" ...>`
- `ContactPage.tsx:67-68` — `<h1>Get in Touch</h1>`
- `CoordinatorDashboardPage.tsx:60-62` — `<PageShell title="Coordinator Dashboard" description="...">`
- `ErrorBoundary.tsx:1-37` (current; needs `isOfflineError` + branched render)
- `EmptyState.tsx:30-35` (offline variant already exists)
- `Layout.tsx:1-130` (SkipToContent at line 83, ErrorBoundary at line 113, AriaLiveRegion at line 85)
- `Topbar.tsx:1-170` (uses `useAuth` + `useTheme`; role-based gating for canIntake/canApprove)
- `Sidebar.tsx:1-72` (role-gated via `NAV_GROUPS`)
- `ProtectedRoute.tsx:1-55` (async via `useEffect` + `getCurrentUser`)

**To be verified at execution time:**
- MayorReportsPage.tsx heading
- MyAccessCardPage.tsx heading + useSWR query key
- ProgramsPage.tsx heading + `getCurrentUser` usage
- IrfDetailPage.tsx full content (useParams + AES-256 decrypt form)
- AccessCardPrintView.tsx heading + useParams + useSWR query key
