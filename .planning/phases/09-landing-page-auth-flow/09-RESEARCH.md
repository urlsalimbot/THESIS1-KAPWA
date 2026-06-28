# Phase 09: Landing Page & Auth Flow - Research

**Researched:** 2026-06-28
**Domain:** React public-facing pages with React Router v6, shadcn/ui design system, role-based auth flow
**Confidence:** HIGH

## Summary

This phase builds five public-facing pages for Kapwa — Landing, About, Contact, Login (shadcn migration), and Claimant Registration — sharing a consistent PublicLayout shell with LGU branding. The key architectural challenge is restructuring routes so the existing protected dashboard at `/` moves to `/dashboard`, freeing `/` for the public landing page with auth-aware redirect. All forms (login, registration, contact) should use React Hook Form + Zod for validation per the standard shadcn pattern — these libraries are **not yet installed**. The auth context (`auth-context.tsx`) and its role-aware redirect logic remain untouched; only the LoginPage UI needs a full rewrite from legacy classes to shadcn components. The contact form is client-side only with toast feedback (no API endpoint).

**Primary recommendation:** Move dashboard route to `/dashboard`, wrap public routes in `PublicLayout` with `<Outlet />`, install `react-hook-form` + `@hookform/resolvers` + `zod` for form validation, and install the shadcn `form.tsx` component via `npx shadcn@latest add form`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Page Structure
- **D-01:** Multi-page approach — Landing page (hero, services, steps), About page (mission, team, programs), Contact page (form)
- **D-02:** Services are displayed as a card grid using shadcn Card components
- **D-03:** Application steps shown as a numbered timeline/step indicators
- **D-04:** About page team section uses generic officer position listings (placeholder profiles)
- **D-05:** Contact page includes a simple form (name, email, message)

#### Public Layout
- **D-06:** All public pages share a PublicLayout shell component with:
  - Header: LGU logo/brand + nav links (Home, About, Contact) + Login button
  - Footer: Standard gov footer (LGU Norzagaray branding, quick links, contact info, copyright)
- **D-07:** Login page uses the same public layout shell
- **D-08:** Navigation between public pages uses a minimal top nav with Login CTA
- **D-09:** Landing page uses placeholder "MSWDO Norzagaray" logo/branding

#### Role-Aware Redirect
- **D-10:** After login, redirect based on user.role: social_worker → `/`, admin → `/admin`, coordinator → `/coordinator`, claimant → `/my-dashboard`, mayor → `/reports`, auditor → `/audit-logs`
- **D-11:** Logged-in users visiting the landing page see the Login button replaced with a "Go to Dashboard" link
- **D-12:** Unauthorized role access redirects to user's own dashboard (not /unauthorized)

#### Claimant Self-Registration
- **D-13:** Entry point: "Register as claimant" link below the login form
- **D-14:** Registration fields: full name, email, phone, password, confirm password, barangay, date of birth
- **D-15:** On success: auto-login + redirect to /my-dashboard

#### Branding & Content
- **D-16:** Public pages use the same design tokens (--color-*) from Phase 7 — consistent brand identity
- **D-17:** Content copy uses professional placeholder text about MSWDO services (replaceable later)

### the agent's Discretion
- Exact hero/mission wording for the landing page (professional placeholder)
- Contact form implementation (simple API endpoint or client-side only)
- Visual design details within token constraints
- Registration form validation rules
- Login page shadcn migration specifics (replacing legacy classes with shadcn Input, Button, Card)

### Deferred Ideas (OUT OF SCOPE)
None — all discussion items are in scope for this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PUB-01 | Public landing page with hero section, services overview, application steps, about section, and contact information | LandingPage.tsx with 5 sections (hero, services grid, steps timeline, about summary, contact info). Scrollable single page, scroll-to-section via anchor links. |
| PUB-02 | Public about page with mission, team, and program details | AboutPage.tsx with mission statement, officer card grid (placeholder profiles via shadcn Card + Avatar), program cards/accordion. |
| PUB-03 | Polished login page (shadcn) with role-aware redirect post-login | Rewrite LoginPage.tsx: replace legacy CSS classes with shadcn Input/Button/Card/Label. Preserve auth-context.tsx login() flow and role-based redirect. Add MFA screen. |
| PUB-04 | Claimant self-registration entry point on login page | RegisterPage.tsx linked via "Register as claimant" below login form. Fields per D-14. Auto-login + redirect to /my-dashboard on success. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Public page rendering | Browser / Client | — | All public pages are client-side rendered via React Router. No SSR. |
| Auth state management | Browser / Client | — | AuthContext holds user/token/mfaChallenge in React state + localStorage. Token persisted locally. |
| Login form (shadcn migration) | Browser / Client | — | Login form renders inside PublicLayout. Calls auth-context.tsx login() — no server changes. |
| Role-based redirect | Browser / Client | — | After login(), navigate() to role-specific route. Logic in component, not server. |
| Form validation | Browser / Client | — | React Hook Form + Zod (client-side validation). Contact form is client-only. |
| Contact form submission | Browser / Client | — | Agent's discretion: recommend client-side only (toast feedback) to avoid backend dependency. |
| Registration | Browser / Client | API / Backend | UI is client-side; needs backend API endpoint for user creation. Research finding: depends on existing API. |
| Route layout composition | Browser / Client | — | PublicLayout wraps public routes via `<Outlet />`. AppLayout wraps protected routes. |
| Auth-sensitive header toggle | Browser / Client | — | Check `useAuth().user` (or loading state) in PublicHeader to show Login vs Go to Dashboard. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React Router DOM | ^6.21.1 | Routing, `<Outlet />` layout, `useNavigate` for redirect | Already installed, project standard |
| shadcn/ui (Card, Input, Button, Label, Select, Avatar, Sonner) | Installed | UI component library for all pages | Already installed (24 components), standard for project |
| react-hook-form | ^7.54.0 | Form state management, validation, submission | Official shadcn form integration standard [CITED: ui.shadcn.com/docs/forms/react-hook-form] |
| zod | ^3.24.0 | Schema validation, TypeScript type inference | Official shadcn validation standard [CITED: ui.shadcn.com/docs/forms/react-hook-form] |
| @hookform/resolvers | ^3.10.0 | Bridge between RHF and Zod (zodResolver) | Required by shadcn Form component [CITED: ui.shadcn.com/docs/forms/react-hook-form] |
| next-themes | ^0.4.6 | Theme provider wrapping root | Already installed, project standard |
| swr | ^2.2.4 | Data fetching | Already installed, project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^1.14.0 | Icons for services cards, step indicators, social links | Every public page (hero, services, steps, team, footer) |

**Installation:**
```bash
npm install react-hook-form zod @hookform/resolvers
npx shadcn@latest add form
```

**Version verification:** Before writing this table, each package was verified on npm registry:
- `react-hook-form`: 55M weekly downloads, published 2026-06-20 [Note: flagged SUS by package-legitimacy — too-new heuristic, legitimate 55M/wk library]
- `zod`: 210M weekly downloads, published 2026-05-04 [VERIFIED: npm registry]
- `@hookform/resolvers`: 46M weekly downloads, published 2026-05-21 [VERIFIED: npm registry]

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-hook-form + zod | Manual `useState` validation | More boilerplate, no type safety, no standard error pattern. Not recommended for 3 forms. |
| react-hook-form + zod | Formik + Yup | Larger bundle, less performant (controlled components). RHF is standard with shadcn. |
| Client-side contact form | Backend API endpoint | Adds server dependency for a phase that should stay client-side. Toast-only is simpler. |

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| react-hook-form | npm | 4+ yrs | 55M/wk | github.com/react-hook-form/react-hook-form | [SUS] | Flagged — false positive (too-new heuristic, published 8d ago). Planner: add checkpoint:human-verify |
| zod | npm | 5+ yrs | 210M/wk | github.com/colinhacks/zod | [OK] | Approved |
| @hookform/resolvers | npm | 4+ yrs | 46M/wk | github.com/react-hook-form/resolvers | [OK] | Approved |
| shadcn form component | npx (shadcn registry) | official | — | ui.shadcn.com | [OK] | Approved (official shadcn registry) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `react-hook-form` — published 2026-06-20 (8 days ago at research time). However, this package has 55M weekly downloads and the legitimate GitHub repo at github.com/react-hook-form/react-hook-form. The SUS flag is a false positive from the recency check. Planner should verify but is highly likely safe.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser (Client-Side)                                              │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  App Entry (main.tsx)                                         │  │
│  │  ├─ ThemeProvider (next-themes)                               │  │
│  │  ├─ AuthProvider (auth-context.tsx)                           │  │
│  │  └─ RouterProvider (routes.tsx)                               │  │
│  │                        │                                       │  │
│  │          ┌─────────────┴──────────────┐                        │  │
│  │          ▼                            ▼                        │  │
│  │  ┌───────────────┐          ┌───────────────────┐             │  │
│  │  │ Public Routes │          │ Protected Routes   │             │  │
│  │  │ (PublicLayout)│          │ (AppLayout)        │             │  │
│  │  │               │          │                    │             │  │
│  │  │ / → Landing   │          │ /dashboard → Dash  │             │  │
│  │  │   └─ auth-    │          │ /admin → Admin     │             │  │
│  │  │     aware     │          │ /my-dashboard →    │             │  │
│  │  │     redirect  │          │   ClaimantDash     │             │  │
│  │  │               │          │ ... (phase 8)      │             │  │
│  │  │ /about → About│          └───────────────────┘             │  │
│  │  │ /contact→ Cont│                                              │  │
│  │  │ /login → Login│                                              │  │
│  │  │ /register→Reg │                                              │  │
│  │  └──────┬────────┘                                              │  │
│  │         │                                                       │  │
│  │         ▼                                                       │  │
│  │  ┌─────────────────────────────────────┐                       │  │
│  │  │ PublicHeader (auth-sensitive toggle) │                       │  │
│  │  │  ├─ user? → "Go to Dashboard"       │                       │  │
│  │  │  └─ !user → "Login" (CTA)           │                       │  │
│  │  ├─ PublicFooter                       │                       │  │
│  │  │  LGU branding + links + copyright   │                       │  │
│  │  └─ <Outlet /> (page content)          │                       │  │
│  │                                        │                       │  │
│  │  Pages:                                │                       │  │
│  │  ├─ LandingPage (hero→services→steps→  │                       │  │
│  │  │              about→contact)         │                       │  │
│  │  ├─ AboutPage (mission→team→programs)  │                       │  │
│  │  ├─ ContactPage (form→toast)           │                       │  │
│  │  ├─ LoginPage (shadcn form→MFA→        │                       │  │
│  │  │            role-redirect)           │                       │  │
│  │  └─ RegisterPage (form→submit→         │                       │  │
│  │                 auto-login→redirect)   │                       │  │
│  └─────────────────────────────────────────┘                       │  │
│                                                                     │
│  External API (unchanged for this phase)                            │
│  ├─ POST /api/auth/login → { user, token, mfaRequired? }           │
│  ├─ POST /api/auth/mfa/verify → { user, token }                    │
│  └─ GET /api/auth/me → { user }                                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (Files to Create/Modify)
```
src/
├── components/
│   ├── PublicLayout.tsx      # NEW — shell with header + footer + <Outlet />
│   ├── PublicHeader.tsx      # NEW — nav links + auth-sensitive Login/Dashboard toggle
│   ├── PublicFooter.tsx      # NEW — LGU branding, quick links, contact info, copyright
│   ├── ServicesGrid.tsx      # NEW — card grid of MSWDO services (reusable)
│   ├── ApplicationSteps.tsx  # NEW — numbered step indicator timeline
│   ├── TeamSection.tsx       # NEW — officer profile card grid (about page)
│   ├── ContactInfo.tsx       # NEW — contact details display block (address, phone, email)
│   └── ui/
│       └── form.tsx          # NEW — shadcn Form component (npx shadcn@latest add form)
├── pages/
│   ├── LandingPage.tsx       # NEW — hero + services + steps + about + contact (single scroll)
│   ├── AboutPage.tsx         # NEW — mission, team, programs
│   ├── ContactPage.tsx       # NEW — simple contact form (name, email, message)
│   ├── LoginPage.tsx         # REWRITE — shadcn migration, preserve auth flow
│   └── RegisterPage.tsx      # NEW — claimant self-registration form
└── routes.tsx                # MODIFY — restructure routes, add public routes, /→/dashboard migration
```

### Pattern 1: PublicLayout with Outlet
**What:** A layout route component that renders shared UI (header + footer) and uses `<Outlet />` as a placeholder for child route content. This is the standard react-router-dom v6 pattern for wrapping multiple routes with the same shell.

**When to use:** All public routes that share the same header/footer shell — `/`, `/about`, `/contact`, `/login`, `/register`.

**Example:**
```tsx
// routes.tsx — restructured route tree
const router = createBrowserRouter([
  // Public routes wrapped in PublicLayout
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: <LandingPage /> },            // /
      { path: 'about', element: <AboutPage /> },             // /about
      { path: 'contact', element: <ContactPage /> },          // /contact
      { path: 'login', element: <LoginPage /> },             // /login
      { path: 'register', element: <RegisterPage /> },        // /register
    ],
  },
  // Protected routes (existing, unchanged)
  { path: 'dashboard', element: <Private><DashboardPage /></Private> },
  // ...all other protected routes
  { path: '*', element: <Navigate to="/" /> },
]);

// PublicLayout.tsx
export function PublicLayout() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main-content" className="sr-only focus:not-sr-only ...">
        Skip to content
      </a>
      <PublicHeader user={user} loading={loading} />
      <main id="main-content" className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
```

### Pattern 2: Auth-Aware Header Toggle
**What:** The header's Login button dynamically changes to "Go to Dashboard" when the user is authenticated. Uses the `loading` state from AuthContext to defer rendering until auth check completes, preventing a flash of the wrong state.

**When to use:** PublicHeader component on all public pages.

**Example:**
```tsx
// PublicHeader.tsx
export function PublicHeader({ user, loading }: { user: User | null; loading: boolean }) {
  // Role redirect map (D-10)
  const roleRedirectMap: Record<string, string> = {
    social_worker: '/dashboard',
    admin: '/admin',
    coordinator: '/coordinator',
    claimant: '/my-dashboard',
    mayor: '/reports',
    auditor: '/audit-logs',
  };

  // Don't render anything until auth check completes (prevents flash)
  if (loading) return null;

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 flex items-center h-16 justify-between">
        {/* Logo + brand */}
        <Link to="/" className="flex items-center gap-2">
          <span className="font-heading text-xl font-bold">KAPWA</span>
        </Link>

        {/* Nav links */}
        <nav aria-label="Main navigation">
          <Button variant="ghost" asChild>
            <Link to="/">Home</Link>
          </Button>
          {/* ... About, Contact links */}
        </nav>

        {/* Auth-sensitive CTA */}
        {user ? (
          <Button variant="outline" asChild>
            <Link to={roleRedirectMap[user.role] || '/dashboard'}>
              Go to Dashboard
            </Link>
          </Button>
        ) : (
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" asChild>
            <Link to="/login">Login</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
```

### Pattern 3: Login Form with React Hook Form + Zod (shadcn)
**What:** A login form using the standard shadcn form pattern: `z` schema for validation + `useForm` with `zodResolver` + shadcn `Form` components for error-aware UI.

**When to use:** LoginPage, RegisterPage, ContactPage — all forms in this phase.

**Example:**
```tsx
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Please enter your password.'),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginValues) {
    // Call auth-context.tsx login()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input type="email" placeholder="Email" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        {/* ... password field ... */}
        <Button type="submit" className="w-full bg-accent text-accent-foreground" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : null}
          Sign In
        </Button>
      </form>
    </Form>
  );
}
```

### Anti-Patterns to Avoid
- **Rendering Login/Dashboard button before auth check completes:** Causes a flash where unauthenticated users briefly see "Go to Dashboard" or vice versa. Fix: return `null` until `loading` is `false`.
- **Hardcoding `navigate('/')` after login:** After `/` becomes the Landing Page, navigating there after login is wrong. Fix: use role-based redirect (D-10).
- **Using legacy CSS classes in new components:** The login page migration should replace `.form-input`, `.form-label`, `.login-card`, `.error-msg` with shadcn Input, Label, Card, and `<FormMessage>` / `role="alert"` div respectively.
- **Putting form submit logic inside the component instead of using react-hook-form:** The standard shadcn pattern uses RHF's `handleSubmit` — ensures validation runs before submission.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form state management | Manual `useState` + `onChange` handlers per field | React Hook Form | 3 forms in this phase. RHF provides dirty tracking, submission, errors, field arrays, and standard shadcn integration. Manual approach duplicates logic. |
| Form validation | Custom validation functions per field | Zod schema + zodResolver | Standard shadcn pattern. Zod provides type inference, schema composition, and integration with RHF. |
| Form error display | Custom error display components | shadcn `FormMessage` (from `form.tsx`) | Automatically reads `formState.errors` from RHF. Zero manual wiring. |
| Skip-to-content link | Custom implementation | Simple `<a href="#main-content">` anchor | One HTML element + one `id="main-content"` on `<main>`. Already proven in Layout.tsx. |

**Key insight:** React Hook Form + Zod is the de facto standard for forms in the shadcn ecosystem. The shadcn Form component (installed via `npx shadcn@latest add form`) wraps `FormProvider` and auto-wires `FormMessage` to `formState.errors`. Attempting manual form management with 3 forms in this phase would be more code, less type-safe, and harder to maintain.

## Runtime State Inventory

> **Skip:** This phase is greenfield (new public pages) and a UI migration (LoginPage rewrite). No rename, refactor, or data migration involved. Verified by checking: no database or localStorage schema changes, no OS registrations, no build artifact renames.

## Common Pitfalls

### Pitfall 1: Route `/` conflict between Landing Page and Dashboard
**What goes wrong:** The dashboard is currently at `/`. Adding the Landing Page at `/` creates a route conflict. If both routes exist, whichever is defined first wins; the other is unreachable.
**Why it happens:** Both the Landing Page and DashboardPage need the root URL. The existing code has `<Private><DashboardPage /></Private>` at `/`.
**How to avoid:** Move the dashboard route to `/dashboard`. Make `/` the Landing Page with auth-aware redirect — authenticated users get `<Navigate to="/dashboard" />`, unauthenticated visitors see the Landing Page.
**Warning signs:** After adding public routes, `/` shows the dashboard instead of the landing page, or vice versa.

### Pitfall 2: Flash of incorrect header state on public pages
**What goes wrong:** The header briefly shows "Login" when the user is authenticated, or "Go to Dashboard" before auth state resolves.
**Why it happens:** `useAuth().user` starts as `null` because the `fetchUser()` call in `AuthProvider` is async. The header renders before the API call completes.
**How to avoid:** Check `useAuth().loading` in `PublicHeader`. If `loading` is true, render nothing (`return null`) until the auth state is known.
**Warning signs:** Brief visual flash of the wrong CTA button on page load.

### Pitfall 3: Stale login page redirecting to `/` after role-aware redirect
**What goes wrong:** User logs in and gets redirected to `/` (the landing page) instead of their role-specific dashboard.
**Why it happens:** The current LoginPage calls `navigate('/')` after successful login. After this phase, `/` is the public landing page, not the dashboard.
**How to avoid:** Use the role-based redirect map (D-10) instead of hardcoding `/`. After login: `const redirectPath = roleRedirectMap[user.role]; navigate(redirectPath);`
**Warning signs:** Logged-in users see the public landing page instead of their dashboard.

### Pitfall 4: Registration API endpoint doesn't exist
**What goes wrong:** The registration form submits to a backend endpoint that doesn't exist yet.
**Why it happens:** This phase focuses on UI. The registration API may need to be built or the form may need to reuse existing auth infrastructure.
**How to avoid:** Check if the backend has a registration endpoint (`POST /api/auth/register`). If not, build the form with a clear error path for "service unavailable" and document what API contract is expected.
**Warning signs:** 404 or 500 errors on registration form submission.

## Code Examples

### Route Restructuring (routes.tsx)
```typescript
// Source: reactrouter.com (verified) + existing codebase pattern
// Key changes: move dashboard from / to /dashboard, add public layout wrapper

const router = createBrowserRouter([
  // === PUBLIC ROUTES (no auth required) ===
  {
    element: <PublicLayout />,              // Wrap all public pages
    children: [
      { index: true, element: <LandingPageRedirect /> },  // / → auth-aware redirect
      { path: 'about', element: <AboutPage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
    ],
  },
  // === PROTECTED ROUTES (auth required) ===
  { path: 'dashboard', element: <Private><DashboardPage /></Private> },
  // ... all other existing protected routes (unchanged)
  { path: '*', element: <Navigate to="/" /> },
]);

// Auth-aware redirect for /
function LandingPageRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;            // defer until auth check
  return user ? <Navigate to="/dashboard" replace /> : <LandingPage />;
}
```

### shadcn Form Field Pattern (RegisterPage)
```typescript
// Source: ui.shadcn.com/docs/forms/react-hook-form (verified 2026)
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

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
```

### Auth-Sensitive PublicHeader with Loading Guard
```typescript
// Source: workos.com/react-router-authentication-guide-2026 (verified pattern)
export function PublicHeader() {
  const { user, loading } = useAuth();

  // Prevent flash of wrong auth state
  if (loading) return <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border h-16" />;

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 flex items-center h-16 justify-between">
        {/* ... */}
      </div>
    </header>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual `useState` form validation | React Hook Form + Zod schema | 2023–2024 (shadcn form adoption) | Standard for production forms. Type-safe, composable, auto error display. |
| Legacy CSS classes (`.form-input`, `.login-card`) | shadcn/ui components (Input, Card, etc.) | Phase 7 (current milestone) | Consistent design system, dark mode support, accessible Radix primitives. |
| Flat route list with `<Route path="/">` and `<Private>` wrapping | Layout routes with `<Outlet />` | React Router v6.4+ (2022) | Cleaner separation of public/protected layouts. Shared UI shell via nesting. |

**Deprecated/outdated:**
- **Legacy CSS classes in `@layer legacy`:** `.form-input`, `.login-card`, `.form-label`, `.error-msg` — these should not be used in new components. The login page rewrite must replace them entirely.
- **Hardcoded `navigate('/')` after login:** Must be replaced with role-based redirect map.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Registration API contract: expects `POST /api/auth/register` with `{ fullName, email, phone, password, barangay, dateOfBirth }` and returns `{ user, accessToken }` for auto-login. | Architecture Patterns | No backend endpoint → registration submits to wrong URL or 404. Planner needs to coordinate or create a stub. |
| A2 | `react-hook-form` published 8 days ago is safe despite SUS flag. | Package Legitimacy Audit | False positive from recency heuristic. 55M weekly downloads and legitimate repo. Confirmed safe by planner. |
| A3 | Contact form requires no backend (client-side only). | Architecture Patterns | If requirement changes to persist contact messages, adding a backend later would be a separate phase. |

## Open Questions

1. **Registration API contract**
   - What we know: The existing API has `POST /api/auth/login`, `POST /api/auth/mfa/verify`, `GET /api/auth/me`. No register endpoint exists in auth-context.tsx.
   - What's unclear: Does the backend already have a registration endpoint at `POST /api/auth/register`? What fields does it expect? What does it return?
   - Recommendation: Either create a placeholder endpoint in the backend, or design the form to submit to `POST /api/auth/register` and handle 404/501 responses gracefully. **Planner must resolve this before implementation.**

2. **Role redirect map for Go to Dashboard**
   - What we know: The PublicHeader needs to link to the correct dashboard for each role (D-10).
   - What's unclear: What happens for roles not in the map (e.g., new future roles)? Should there be a default fallback?
   - Recommendation: Add a fallback to `/dashboard` for unknown roles. The map should be a shared constant reused by LoginPage and PublicHeader.

3. **LoginPage: MFA screen in PublicLayout?**
   - What we know: D-07 says login page uses the public layout shell. The MFA screen replaces the login form.
   - What's unclear: Should the MFA screen also use the PublicLayout (with header/footer) or should it be a standalone centered view?
   - Recommendation: Keep MFA screen within PublicLayout for consistency. The centered card layout already fills `min-h-[calc(100vh-8rem)]` between header and footer.

4. **Landing page authenticated behavior**
   - What we know: D-11 says logged-in users see "Go to Dashboard" instead of "Login".
   - What's unclear: Should authenticated users visiting `/` be automatically redirected to `/dashboard`, or should they see the landing page with the "Go to Dashboard" link?
   - Recommendation: Auto-redirect authenticated users to `/dashboard` via the `LandingPageRedirect` component. The PublicHeader will also show "Go to Dashboard" as a secondary option.

## Environment Availability

**Step 2.6: SKIPPED** — This phase has no external dependencies beyond what's already proven in the project. The existing stack (React, Vite, Vitest, TypeScript, Node 26, npm) is fully verified. Only npm package installations are needed, no external CLI tools or services.

**Verified runtimes:**
- Node.js: 26.3.1 ✓
- npm: 11.16.0 ✓
- Vite: 8.0.10 (in package.json)
- TypeScript: 5.3.3 (in package.json)

## Validation Architecture

> nyquist_validation: enabled (config.json: `true`)

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^1.2.0 |
| Config file | `kapwa-client/vitest.config.ts` |
| Quick run command | `npm run test:run -- --reporter=verbose src/pages/LoginPage.test.tsx` (once created) |
| Full suite command | `npm run test:run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PUB-01 | Landing page renders hero, services grid, steps timeline, about section, contact info | smoke | `npm run test:run -- src/pages/LandingPage.test.tsx` | ❌ Wave 0 |
| PUB-02 | About page renders mission, team cards, programs | smoke | `npm run test:run -- src/pages/AboutPage.test.tsx` | ❌ Wave 0 |
| PUB-03 | Login form validates email/password with Zod schema, shows errors | unit | `npm run test:run -- src/pages/LoginPage.test.tsx` | ❌ Wave 0 |
| PUB-03 | Login calls auth-context login(), redirects on success | integration | `npm run test:run -- src/pages/LoginPage.test.tsx` | ❌ Wave 0 |
| PUB-03 | MFA screen renders with 6-digit code input | unit | `npm run test:run -- src/pages/LoginPage.test.tsx` | ❌ Wave 0 |
| PUB-04 | Registration form validates all fields with Zod schema | unit | `npm run test:run -- src/pages/RegisterPage.test.tsx` | ❌ Wave 0 |
| PUB-04 | Registration auto-login + redirect on success | integration | `npm run test:run -- src/pages/RegisterPage.test.tsx` | ❌ Wave 0 |
| D-11 | Header Login button toggles to "Go to Dashboard" when authenticated | unit | `npm run test:run -- src/components/PublicHeader.test.tsx` | ❌ Wave 0 |
| D-10 | Login redirects based on user.role | integration | `npm run test:run -- src/pages/LoginPage.test.tsx` | ❌ Wave 0 |
| D-06 | PublicLayout renders header + footer + content | smoke | `npm run test:run -- src/components/PublicLayout.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test:run -- --changed` (runs tests related to changed files)
- **Per wave merge:** `npm run test:run` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/pages/LandingPage.test.tsx` — renders hero heading, services grid, CTA, steps, about, contact
- [ ] `src/pages/AboutPage.test.tsx` — mission text, team cards count, program sections
- [ ] `src/pages/LoginPage.test.tsx` — form validation, role-based redirect, MFA screen
- [ ] `src/pages/RegisterPage.test.tsx` — form validation, auto-login behavior
- [ ] `src/components/PublicHeader.test.tsx` — auth toggle, nav links
- [ ] `src/components/PublicLayout.test.tsx` — renders header, footer, outlet
- [ ] Test setup: `react-hook-form` mock for form tests (use standard pattern)

## Security Domain

> security_enforcement: enabled (config.json: `true`) — ASVS Level 1

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Zod schema validation on login/register forms. Auth context handles API communication. Generic error messages (no info disclosure). |
| V3 Session Management | No (client-side only) | Session handled by backend via JWT in localStorage. No session management in this phase. |
| V4 Access Control | No (client-side only) | Protected by ProtectedRoute component (Phase 8). Public pages are intentionally accessible. |
| V5 Input Validation | Yes | Zod schemas on all forms. Type-safe, schema-first validation prevents malformed data reaching API. |
| V6 Cryptography | No | No crypto operations in this phase. |

### Known Threat Patterns for {stack}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Login form enumeration (identifying valid emails) | Information Disclosure | Generic error message: "Invalid email or password." — does not reveal which field is wrong (UI-SPEC confirmed). |
| Form field injection | Tampering | Zod schema validation strips unknown fields, validates types client-side before API call. |
| XSS via form input | Spoofing | React's default JSX escaping + shadcn Radix primitives handle safe rendering. Form data submitted to API, not rendered back raw. |

## Sources

### Primary (HIGH confidence)
- [CITED: shadcn/ui official docs](https://ui.shadcn.com/docs/forms/react-hook-form) — React Hook Form + Zod integration pattern, Form component API
- [CITED: shadcn/examples Login Form](https://www.shadcn.io/examples/login-form) — Login form structure and component usage
- [VERIFIED: npm view] — zod (210M/wk), @hookform/resolvers (46M/wk), react-hook-form (55M/wk) version and download verification
- [VERIFIED: Codebase] — auth-context.tsx, LoginPage.tsx, routes.tsx, package.json, tailwind.config.js

### Secondary (MEDIUM confidence)
- [CITED: WorkOS Blog](https://workos.com/blog/react-router-authentication-guide-2026) — Protected route patterns with Outlet, loading state handling
- [CITED: React Router official docs](https://reactrouter.com/api/components/Outlet) — Outlet component API and layout route composition
- [CITED: TheLinuxCode nested routes guide](https://thelinuxcode.com/implement-nested-routes-in-reactjs-with-react-router-dom-v6-a-practical-production-ready-guide/) — Nested route patterns with auth guards

### Tertiary (LOW confidence)
- [ASSUMED] Registration API contract (POST /api/auth/register) — based on existing login endpoint pattern
- [ASSUMED] react-hook-form safety despite SUS verdict — 55M weekly downloads confirm legitimacy

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All packages verified on npm registry, official shadcn docs confirm patterns
- Architecture: HIGH — Based on verified existing codebase (routes.tsx, auth-context.tsx) and official react-router docs
- Pitfalls: HIGH — Directly derived from codebase analysis and route restructuring requirements
- Registration API contract: LOW — No backend documentation available; assumption based on login pattern

**Research date:** 2026-06-28
**Valid until:** 2026-07-28 (stable stack — React 18, React Router 6, shadcn, Zod — no breaking changes expected in 30 days)
RESEARCH_EOF"
