# Phase 09: Landing Page & Auth Flow - Context

**Gathered:** 2026-06-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Public-facing pages for Kapwa: a landing page with hero, services overview, and application steps; an about page with MSWDO mission, team, and programs; a contact page with a simple form; a polished shadcn login page with role-aware redirect; and a claimant self-registration flow. These pages share a public layout shell with LGU branding and are accessible without authentication.

</domain>

<decisions>
## Implementation Decisions

### Page Structure
- **D-01:** Multi-page approach — Landing page (hero, services, steps), About page (mission, team, programs), Contact page (form)
- **D-02:** Services are displayed as a card grid using shadcn Card components
- **D-03:** Application steps shown as a numbered timeline/step indicators
- **D-04:** About page team section uses generic officer position listings (placeholder profiles)
- **D-05:** Contact page includes a simple form (name, email, message)

### Public Layout
- **D-06:** All public pages share a PublicLayout shell component with:
  - Header: LGU logo/brand + nav links (Home, About, Contact) + Login button
  - Footer: Standard gov footer (LGU Norzagaray branding, quick links, contact info, copyright)
- **D-07:** Login page uses the same public layout shell
- **D-08:** Navigation between public pages uses a minimal top nav with Login CTA
- **D-09:** Landing page uses placeholder "MSWDO Norzagaray" logo/branding

### Role-Aware Redirect
- **D-10:** After login, redirect based on user.role: social_worker → `/`, admin → `/admin`, coordinator → `/coordinator`, claimant → `/my-dashboard`, mayor → `/reports`, auditor → `/audit-logs`
- **D-11:** Logged-in users visiting the landing page see the Login button replaced with a "Go to Dashboard" link
- **D-12:** Unauthorized role access redirects to user's own dashboard (not /unauthorized)

### Claimant Self-Registration
- **D-13:** Entry point: "Register as claimant" link below the login form
- **D-14:** Registration fields: full name, email, phone, password, confirm password, barangay, date of birth
- **D-15:** On success: auto-login + redirect to /my-dashboard

### Branding & Content
- **D-16:** Public pages use the same design tokens (--color-*) from Phase 7 — consistent brand identity
- **D-17:** Content copy uses professional placeholder text about MSWDO services (replaceable later)

### the agent's Discretion
- Exact hero/mission wording for the landing page (professional placeholder)
- Contact form implementation (simple API endpoint or client-side only)
- Visual design details within token constraints
- Registration form validation rules
- Login page shadcn migration specifics (replacing legacy classes with shadcn Input, Button, Card)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §PUB-01–PUB-04 — Landing page, about page, login, self-registration requirements

### Design System
- `kapwa-client/src/index.css` — Design tokens (--color-*, --spacing-*)
- `kapwa-client/tailwind.config.js` — Tailwind theme mapped to CSS vars

### Existing Auth & Routes
- `kapwa-client/src/pages/LoginPage.tsx` — Current login implementation (needs shadcn migration)
- `kapwa-client/src/lib/auth-context.tsx` — Auth provider with login, MFA, role info
- `kapwa-client/src/routes.tsx` — Route configuration
- `kapwa-client/src/components/ProtectedRoute.tsx` — Role-based route guard

### Existing UI Components
- `kapwa-client/src/components/ui/` — shadcn UI components (button, card, input, etc.)

### Phase Artifacts
- `.planning/phases/07-foundation-design-system/07-CONTEXT.md` — Design system decisions and token strategy

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `LoginPage.tsx` — Existing login component with email/password + MFA flow to be migrated to shadcn
- `auth-context.tsx` — Auth provider with login(), MFA resolution, user.role, logout
- `auth-context.tsx` `getCurrentUser()` — For checking auth state on public pages
- `routes.tsx` — Existing route definitions to extend with public routes
- `kapwa-client/src/components/ui/` — 7 shadcn components (avatar, badge, button, card, input, popover, separator) from Phase 7

### Established Patterns
- Named exports for all components
- Function components with hooks (no class components)
- CSS variables imported from index.css
- swr for data fetching (useful for contact form API)
- next-themes ThemeProvider wrapping root (already in routes.tsx)

### Integration Points
- Public routes added to `routes.tsx` outside the Private/ProtectedRoute wrapper
- Public pages use PublicLayout instead of Layout (which has sidebar/topbar)
- Login flow in auth-context.tsx's login() returns user with role for redirect
- Registration needs a new API endpoint or reuses existing auth infrastructure

</code_context>

<specifics>
## Specific Ideas

- Header shows nav links (Home, About, Contact) and a Login button — minimal navigation
- Footer includes full LGU branding, quick links, contact info, copyright
- Hero section driven by MSWDO mission statement with call-to-action button
- Logged-in users see "Go to Dashboard" instead of "Login" in the public header
- The login page should use shadcn components (Input, Button, Card) replacing legacy classes

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-landing-page-auth-flow*
*Context gathered: 2026-06-28*
