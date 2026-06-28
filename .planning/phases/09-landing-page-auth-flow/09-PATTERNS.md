# Phase 09: Landing Page & Auth Flow - Pattern Map

**Mapped:** 2026-06-28
**Files analyzed:** 18 (11 new, 1 rewrite, 1 modify, 1 install, 4 tests)
**Analogs found:** 16 / 18

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/PublicLayout.tsx` | component (layout) | request-response | `src/components/Layout.tsx` | role-match |
| `src/components/PublicHeader.tsx` | component (UI) | request-response | `src/components/Topbar.tsx` | role-match |
| `src/components/PublicFooter.tsx` | component (UI) | request-response | `src/components/Topbar.tsx` | partial |
| `src/components/ServicesGrid.tsx` | component (UI) | request-response | `src/components/Layout.tsx` | partial |
| `src/components/ApplicationSteps.tsx` | component (UI) | request-response | `src/components/Sidebar.tsx` | partial |
| `src/components/TeamSection.tsx` | component (UI) | request-response | `src/components/Sidebar.tsx` | partial |
| `src/components/ContactInfo.tsx` | component (UI) | request-response | `src/components/ReportsExportButton.tsx` | partial |
| `src/pages/LandingPage.tsx` | page | request-response | `src/pages/DashboardPage.tsx` | partial |
| `src/pages/AboutPage.tsx` | page | request-response | `src/pages/DashboardPage.tsx` | partial |
| `src/pages/ContactPage.tsx` | page (form) | request-response | `src/pages/LoginPage.tsx` | partial |
| `src/pages/RegisterPage.tsx` | page (form) | request-response | `src/pages/LoginPage.tsx` | role-match |
| `src/pages/LoginPage.tsx` (REWRITE) | page (form+auth) | request-response | `src/pages/LoginPage.tsx` (current) | exact |
| `src/routes.tsx` (MODIFY) | route config | config | `src/routes.tsx` (current) | exact |
| `src/components/ui/form.tsx` | shadcn component | request-response | `src/components/ui/input.tsx` | partial |
| `src/pages/LandingPage.test.tsx` | test | request-response | `src/components/cards/AccessCard.test.tsx` | role-match |
| `src/pages/AboutPage.test.tsx` | test | request-response | `src/components/cards/AccessCard.test.tsx` | role-match |
| `src/pages/LoginPage.test.tsx` | test | request-response | `tests/intake-page.test.ts` | role-match |
| `src/pages/RegisterPage.test.tsx` | test | request-response | `tests/intake-page.test.ts` | role-match |
| `src/components/PublicHeader.test.tsx` | test | request-response | `src/components/cards/AccessCard.test.tsx` | role-match |
| `src/components/PublicLayout.test.tsx` | test | request-response | `src/components/cards/AccessCard.test.tsx` | role-match |

---

## Pattern Assignments

### `src/components/PublicLayout.tsx` (component, request-response)

**Analog:** `src/components/Layout.tsx`

**Imports pattern** (lines 1-14):
```typescript
import { useState, useEffect } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
```

**Skip-to-content pattern** (lines 74-79):
```typescript
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-accent focus:text-accent-foreground focus:rounded-md"
>
  Skip to content
</a>
```

**Layout shell with Outlet** (lines 72-104):
```typescript
export function Layout({ children }: { children?: React.ReactNode }) {
  const { user } = useAuth();
  // ...
  return (
    <>
      {/* skip-to-content */}
      <Topbar onMenuToggle={() => setSheetOpen(s => !s)} />
      <div className="flex min-h-[calc(100vh-4rem)]">
        <Sidebar />
        <main id="main-content" className="flex-1 p-6 bg-background min-h-[calc(100vh-4rem)] overflow-auto">
          {children || <Outlet />}
        </main>
      </div>
    </>
  );
}
```

**PublicLayout adaptation pattern** — PublicLayout should be simpler, using `flex flex-col min-h-screen` with `<main className="flex-1"><Outlet /></main>` and skip-to-content.

---

### `src/components/PublicHeader.tsx` (component, UI)

**Analog:** `src/components/Topbar.tsx`

**Imports pattern** (lines 1-21):
```typescript
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
// icons as needed: import { Menu, X, LogIn, LayoutDashboard } from 'lucide-react';
```

**Auth-aware pattern** — use `useAuth()` to get `user` and `loading` (lines 28, 35-37):
```typescript
export function Topbar({ onMenuToggle }: TopbarProps) {
  const { user, logout } = useAuth();
  // ...
  const initials = user
    ? user.fullName.split(' ').map((s: string) => s[0]).join('').slice(0, 2).toUpperCase()
    : 'U';
```

**Loading guard pattern** — do not render until auth check completes (from RESEARCH.md line 477):
```typescript
if (loading) return <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border h-16" />;
```

**Button as child Link pattern** (lines 46, 56, 116):
```typescript
<Button variant="ghost" asChild>
  <Link to="/">Home</Link>
</Button>
```

**Key differences from Topbar:** PublicHeader is simpler — no DropdownMenu, no Avatar, no Notifications/Messages, no Search, no theme toggle. Uses accent-colored CTA button for Login.

---

### `src/components/PublicFooter.tsx` (component, UI)

**No direct analog** — the existing app doesn't have a footer component. Use patterns from `Topbar.tsx` (`Card` from UI, `Button variant="ghost" asChild` for links, `Separator`, lucide icons).

**Import pattern** (use Topbar.tsx conventions):
```typescript
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
// import { Phone, Mail, MapPin } from 'lucide-react';
```

**Layout structure:** `footer` with `bg-card border-t border-border mt-auto`, three-column grid on desktop (`grid-cols-1 md:grid-cols-3`), copyright bar at bottom.

---

### `src/pages/LandingPage.tsx` (page, static content)

**Analog:** `src/pages/DashboardPage.tsx`

**Named export pattern** (DashboardPage.tsx line 38):
```typescript
export function DashboardPage() {
```

**Section-based layout pattern** (DashboardPage.tsx lines 79-127):
```typescript
export function DashboardPage() {
  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Dashboard</h2>
        <p className="page-desc">Overview of social welfare operations and metrics.</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {stats.map(s => <StatCard key={s.label} stat={s} />)}
      </div>
      {/* ...more sections */}
    </div>
  );
}
```

**Pattern adaptation:** LandingPage will have 5 sections (hero, services, steps, about, contact) stacked vertically. Each as a `<section>` element with `id="..."` for anchor scrolling. Use `py-16 md:py-24` for section spacing.

**Hero CTA Button pattern** (from UI-SPEC):
```typescript
<Button className="bg-accent text-accent-foreground hover:bg-accent/90 h-11 px-8 text-base font-semibold rounded-md">
  Access Services
</Button>
```

---

### `src/pages/AboutPage.tsx` (page, static content)

**Analog:** `src/pages/DashboardPage.tsx`

Same pattern as LandingPage — named export, section-based layout.

**Team card grid pattern** (using shadcn Card + Avatar):
```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
```

**Fallback Avatar pattern** (from Topbar.tsx lines 93-97):
```typescript
<Avatar className="cursor-pointer">
  <AvatarFallback className="text-xs font-medium bg-muted text-foreground">
    {initials}
  </AvatarFallback>
</Avatar>
```

---

### `src/pages/ContactPage.tsx` (page, form)

**No direct form page analog** — forms in the codebase use legacy classes. This component should follow the shadcn form pattern from RESEARCH.md.

**Contact form uses client-only submission with Sonner toast** (from RESEARCH.md line 117):
```typescript
import { toast } from 'sonner';

// Success
toast.success('Message sent! We\'ll respond within 1-2 business days.');

// Error
toast.error('Message failed to send. Please try again or call us directly.');
```

**Form state approach** — simple useState for contact form (client-only, no persistence):
```typescript
const [name, setName] = useState('');
const [email, setEmail] = useState('');
const [message, setMessage] = useState('');
const [submitting, setSubmitting] = useState(false);
```

---

### `src/pages/LoginPage.tsx` (REWRITE — page, form+auth)

**Analog:** Current `src/pages/LoginPage.tsx` (existing)

**Current auth flow to preserve** (lines 15-24):
```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setError('');
  try {
    const result = await login(email, password);
    if (!result?.mfaRequired) navigate('/');
  } catch (err) {
    setError('Invalid email or password');
  }
}
```

**CRITICAL CHANGE:** Replace `navigate('/')` with role-based redirect (D-10):
```typescript
const roleRedirectMap: Record<string, string> = {
  social_worker: '/dashboard',
  admin: '/admin',
  coordinator: '/coordinator',
  claimant: '/my-dashboard',
  mayor: '/reports',
  auditor: '/audit-logs',
};

// After login:
const result = await login(email, password);
if (!result?.mfaRequired) {
  const redirectPath = roleRedirectMap[user.role] || '/dashboard';
  navigate(redirectPath);
}
```

**MFA flow to preserve** (lines 37-61): The MFA screen should stay within PublicLayout.

**Error display with shadcn Alert pattern** (from UI-SPEC line 233):
```typescript
{error && (
  <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md" role="alert">
    {error}
  </div>
)}
```

**Form submit button loading state** (from UI-SPEC line 232):
```typescript
<Button type="submit" className="w-full bg-accent text-accent-foreground" disabled={submitting}>
  {submitting ? <Loader2 className="animate-spin" /> : null}
  Sign In
</Button>
```

---

### `src/pages/RegisterPage.tsx` (page, form)

**Analog:** `src/pages/LoginPage.tsx` (current — same auth flow pattern)

This is a new form page. Key patterns:

**Registration schema** (from RESEARCH.md lines 452-467):
```typescript
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const registerSchema = z.object({
  fullName: z.string().min(2, 'Please enter your full name.')
    .regex(/^[A-Za-z\s]+$/, 'Letters and spaces only.'),
  email: z.string().email('Please enter a valid email address.'),
  phone: z.string().regex(/^09\d{2}\s?\d{3}\s?\d{4}$/, 'Please enter a valid phone number.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  confirmPassword: z.string(),
  barangay: z.string().min(1, 'Please select your barangay.'),
  dateOfBirth: z.string().refine((val) => {
    const age = Math.floor((Date.now() - new Date(val).getTime()) / 31557600000);
    return age >= 18;
  }, 'You must be at least 18 years old.'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
});

type RegisterValues = z.infer<typeof registerSchema>;
```

**RHF form submission pattern** (from RESEARCH.md lines 333-361):
```typescript
export function RegisterForm() {
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '', email: '', phone: '', password: '',
      confirmPassword: '', barangay: '', dateOfBirth: '',
    },
  });

  async function onSubmit(values: RegisterValues) {
    // POST to API, auto-login on success, redirect to /my-dashboard
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="fullName" render={({ field }) => (
          <FormItem>
            <FormLabel>Full Name</FormLabel>
            <FormControl>
              <Input placeholder="Full Name" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        {/* ... more fields ... */}
        <Button type="submit" className="w-full bg-accent text-accent-foreground"
          disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : null}
          Create Account
        </Button>
      </form>
    </Form>
  );
}
```

**Auto-login redirect** — on successful registration, call `login()` from auth-context and redirect to `/my-dashboard`.

---

### `src/routes.tsx` (MODIFY — route config)

**Analog:** Current `src/routes.tsx`

**Current route structure** (lines 37-63): Wrap all authenticated routes with `Private` component, add login and catch-all.

**Modified route structure** (from RESEARCH.md lines 419-442):
```typescript
import { PublicLayout } from './components/PublicLayout';
import { LandingPage } from './pages/LandingPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { RegisterPage } from './pages/RegisterPage';

const router = createBrowserRouter([
  // === PUBLIC ROUTES (no auth required) ===
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: <LandingPageRedirect /> },   // / → auth-aware
      { path: 'about', element: <AboutPage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
    ],
  },
  // === PROTECTED ROUTES (auth required) ===
  // Move dashboard from / to /dashboard
  { path: 'dashboard', element: <Private><DashboardPage /></Private> },
  // ... all other existing protected routes (unchanged at their current paths)
  { path: '*', element: <Navigate to="/" /> },
]);

// Auth-aware redirect for /
function LandingPageRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : <LandingPage />;
}
```

**Current Provider wrapper pattern** (lines 65-74):
```typescript
export function MainRoutes() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <ErrorBoundary>
          <RouterProvider router={router} />
        </ErrorBoundary>
      </AuthProvider>
    </ThemeProvider>
  );
}
```

---

### `src/pages/LandingPage.test.tsx` (test)

**Analog:** `src/components/cards/AccessCard.test.tsx`

**Test pattern** (lines 1-5, 32-38):
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('LandingPage', () => {
  it('renders hero heading', () => {
    render(<LandingPage />);
    expect(screen.getByText('MSWDO Norzagaray')).toBeTruthy();
  });
});
```

---

### `src/pages/LoginPage.test.tsx` (test — integration)

**Analog:** `tests/intake-page.test.ts` (for mocking pattern)

**Mock pattern** (lines 10-24):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/lib/auth-context', () => ({
  useAuth: vi.fn(() => ({
    user: null,
    token: null,
    login: vi.fn(),
    logout: vi.fn(),
    loading: false,
    mfaChallenge: null,
    resolveMfa: vi.fn(),
    cancelMfa: vi.fn(),
  })),
}));
```

---

## Shared Patterns

### Authentication — `useAuth()` hook
**Source:** `src/lib/auth-context.tsx`
**Apply to:** PublicLayout, PublicHeader, LoginPage, RegisterPage

```typescript
// auth-context.tsx lines 4-14, 97
interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<{ mfaRequired: boolean; tempToken: string } | void>;
  logout: () => void;
  loading: boolean;
  mfaChallenge: { tempToken: string } | null;
  resolveMfa: (code: string) => Promise<void>;
  cancelMfa: () => void;
}

export function useAuth() { return useContext(AuthContext); }
```

### shadcn Component Usage
**Source:** `src/components/ui/` (button.tsx, card.tsx, input.tsx, select.tsx, avatar.tsx, sonner.tsx)
**Apply to:** All pages and components

**Button variants** (button.tsx lines 10-27):
```typescript
// Default (primary bg): <Button>Sign In</Button>
// Outline: <Button variant="outline">Learn More</Button>
// Ghost: <Button variant="ghost" asChild><Link to="/">Home</Link></Button>
// Link: <Button variant="link">Register as claimant</Button>
// Accent CTA: <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
```

**Card structure** (card.tsx lines 8-65):
```typescript
<Card className="w-full max-w-md">
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description text</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
  <CardFooter>
    {/* Footer */}
  </CardFooter>
</Card>
```

**Sonner toast** (RESEARCH.md + sonner.tsx):
```typescript
import { toast } from 'sonner';
toast.success('Message sent!');
toast.error('Failed to send.');
```

### Route Redirection Pattern
**Source:** `src/components/ProtectedRoute.tsx`
**Apply to:** routes.tsx (LandingPageRedirect)

```typescript
// ProtectedRoute.tsx lines 18-43
async function checkAuth() {
  const token = localStorage.getItem('kapwa_token');
  if (!token) {
    navigate('/login');
    return;
  }
  // ...
  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    navigate('/');
    return;
  }
}
```

### `cn()` Utility
**Source:** `src/lib/utils.ts`
**Apply to:** Every component (for className merging)

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Usage pattern (from Topbar.tsx, Sidebar.tsx):
```typescript
className={cn(
  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium',
  isActive
    ? 'bg-muted text-foreground'
    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
)}
```

### Test Patterns
**Source:** `src/components/cards/AccessCard.test.tsx` + `tests/setup.ts`

**Simple component test** (AccessCard.test.tsx lines 1-3, 32-38):
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('ComponentName', () => {
  it('renders expected text', () => {
    render(<Component />);
    expect(screen.getByText('expected text')).toBeTruthy();
  });
});
```

**Mock pattern** (intake-page.test.ts lines 10-14):
```typescript
vi.mock('../src/lib/auth-context', () => ({
  useAuth: vi.fn(() => ({ user: null, loading: false, login: vi.fn() })),
}));
```

**Global setup** (tests/setup.ts): localStorage mock already available for all tests.

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/components/PublicFooter.tsx` | component | request-response | No footer component exists in the codebase |
| `src/components/ApplicationSteps.tsx` | component | request-response | No timeline/step component exists |
| `src/pages/ContactPage.tsx` | page (form) | request-response | No form-based pages using shadcn patterns exist |
| `src/pages/RegisterPage.tsx` | page (form) | request-response | No registration form exists |
| `src/components/ui/form.tsx` | shadcn component | request-response | New shadcn component (via npx) |

These files should use patterns from RESEARCH.md which contains shadcn form examples and layout patterns from official docs.

---

## Metadata

**Analog search scope:** kapwa-client/src/ (pages/, components/, components/ui/, lib/, routes/)
**Files scanned:** ~50 source files, 10 test files
**Pattern extraction date:** 2026-06-28
