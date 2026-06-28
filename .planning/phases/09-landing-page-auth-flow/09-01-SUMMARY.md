---
phase: 09-landing-page-auth-flow
plan: 01
subsystem: ui
tags: [react, shadcn, react-hook-form, zod, tailwind, public-layout]
requires: []
provides:
  - Public layout shell with header, footer, and routing infrastructure
  - Auth-aware header with Login/Dashboard toggle
  - Reusable display components (ServicesGrid, ApplicationSteps, TeamSection, ContactInfo)
  - shadcn form component (RHF + Zod foundation)
  - Restructured routes with public wrapper and role-based dashboard redirect
affects: [09-02, 09-03]
tech-stack:
  added: [react-hook-form, zod, @hookform/resolvers]
  patterns: [shadcn form with RHF + Zod, auth-aware public layout, role-based route redirects]
key-files:
  created:
    - kapwa-client/src/components/PublicLayout.tsx
    - kapwa-client/src/components/PublicHeader.tsx
    - kapwa-client/src/components/PublicFooter.tsx
    - kapwa-client/src/components/ServicesGrid.tsx
    - kapwa-client/src/components/ApplicationSteps.tsx
    - kapwa-client/src/components/TeamSection.tsx
    - kapwa-client/src/components/ContactInfo.tsx
    - kapwa-client/src/components/ui/form.tsx
    - kapwa-client/tests/components/PublicHeader.test.tsx
    - kapwa-client/tests/layouts/PublicLayout.test.tsx
  modified:
    - kapwa-client/package.json
    - kapwa-client/src/routes.tsx
    - kapwa-client/src/components/ProtectedRoute.tsx
    - kapwa-client/vite.config.ts
key-decisions:
  - "PublicLayout receives user/loading as props from route component useAuth() call, preventing flash of wrong auth state"
  - "Login button changes to Go to Dashboard link when authenticated, using roleRedirectMap"
  - "Unauthorized role access redirects to role-specific dashboard via ProtectedRoute roleRedirectMap"
  - "PublicHeader shows empty header bar during loading state to prevent auth-state flash"
  - "vitest configured via vite.config.ts plain object format for compatibility with vitest 1.x + Vite 6"
patterns-established:
  - "PublicShell pattern: skip-to-content link → header → main(Outlet) → footer"
  - "Component composition for landing page sections (ServicesGrid, ApplicationSteps, TeamSection, ContactInfo)"
requirements-completed: [PUB-01, PUB-02, PUB-03, PUB-04]
duration: 20min (remaining work)
completed: 2026-06-28
status: complete
---

# Phase 09 Landing Page Auth Flow Plan 01: Public Shell Infrastructure Summary

**Public layout shell with auth-aware header, footer, restructured routes with role-based dashboard redirects, and reusable display components**

## Performance

- **Duration:** 20min (remaining test/scaffold work)
- **Completed:** 2026-06-28
- **Tasks:** 3 (1 checkpoint + 2 auto)
- **Files modified:** 13

## Accomplishments
- PublicLayout shell with skip-to-content, PublicHeader (auth-aware Login/Dashboard toggle), main Outlet, and PublicFooter created
- Routes restructured: public routes in PublicLayout wrapper, dashboard at /dashboard, LandingPageRedirect at /
- ProtectedRoute updated with role-based redirect map (social_worker → /dashboard, admin → /admin, etc.)
- Reusable components created: ServicesGrid (6 service cards), ApplicationSteps (4-step timeline), TeamSection (6 officer profiles with Avatar), ContactInfo (address/phone/email)
- Packages installed: react-hook-form, zod, @hookform/resolvers
- shadcn Form component installed
- Test files created: PublicHeader (4 tests), PublicLayout (3 tests)

## Task Commits

1. **Task 1: Verify package legitimacy (checkpoint)** - Checkpoint passed (prior executor)
2. **Task 2: Install packages + layout/route creation** - `b79dc27` (feat, prior executor)
3. **Task 3: Reusable components + test scaffolds** - `b79dc27` (components, prior executor), `25ffd21` (tests), `7846b1b` (config fix)

**Plan metadata:** Not yet committed

## Files Created/Modified
- `kapwa-client/src/components/PublicLayout.tsx` - Layout shell with header, skip-to-content, main, footer
- `kapwa-client/src/components/PublicHeader.tsx` - Auth-aware header with nav links and Login/Dashboard toggle
- `kapwa-client/src/components/PublicFooter.tsx` - 3-column footer with branding, links, contact info
- `kapwa-client/src/components/ServicesGrid.tsx` - 6-card responsive service grid
- `kapwa-client/src/components/ApplicationSteps.tsx` - 4-step timeline with numbered indicators
- `kapwa-client/src/components/TeamSection.tsx` - Officer profile cards with Avatar initials
- `kapwa-client/src/components/ContactInfo.tsx` - Address/phone/email contact details
- `kapwa-client/src/routes.tsx` - PublicLayout wrapper, LandingPageRedirect at /, dashboard at /dashboard
- `kapwa-client/src/components/ProtectedRoute.tsx` - Role-based redirect map for unauthorized access
- `kapwa-client/src/components/ui/form.tsx` - shadcn Form component for RHF integration
- `kapwa-client/tests/components/PublicHeader.test.tsx` - 4 tests: unauthenticated, authenticated, loading, nav links
- `kapwa-client/tests/layouts/PublicLayout.test.tsx` - 3 tests: header/footer, skip-to-content, main
- `kapwa-client/vite.config.ts` - Fixed for vitest compatibility with @ path alias

## Decisions Made
- PublicHeader receives user/loading as props instead of calling useAuth() internally, avoiding duplicate auth calls in PublicLayout
- Role redirect map defined in both PublicHeader and ProtectedRoute for consistent dashboard routing
- Test files placed in kapwa-client/tests/ directory to match vitest's include pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest config not resolving @ path alias**
- **Found during:** Task 3 (test validation)
- **Issue:** Tests using `@/` imports failed because vite-tsconfig-paths plugin wasn't being loaded by vitest 1.x
- **Fix:** Added resolve.alias to vite.config.ts and fixed config file format (plain object instead of defineConfig import)
- **Files modified:** kapwa-client/vite.config.ts
- **Verification:** All 31 tests pass
- **Committed in:** 7846b1b

**2. [Rule 3 - Blocking] Test files in wrong directory**
- **Found during:** Task 3 (test execution)
- **Issue:** vitest include pattern `tests/**/*.test.{ts,tsx}` looks inside kapwa-client/, not at project root
- **Fix:** Moved test files from tests/ to kapwa-client/tests/
- **Files modified:** 6 test files moved
- **Verification:** Tests discovered and run
- **Committed in:** 25ffd21

**3. [Rule 1 - Bug] LoginPage MFA test used require() which can't resolve TS files**
- **Found during:** Test execution
- **Issue:** `require('../../src/lib/auth-context')` fails because Node.js can't require TS files
- **Fix:** Replaced with mutable variable pattern for mock state
- **Files modified:** kapwa-client/tests/pages/LoginPage.test.tsx
- **Verification:** All 31 tests pass
- **Committed in:** 7846b1b

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug)
**Impact on plan:** All auto-fixes necessary for tests to run. No scope creep.

## Issues Encountered
- vitest 1.2.0's bundled esbuild can't load ESM-only vite.config.ts imports (vite-tsconfig-paths, defineConfig) — workaround: plain object config with inline resolve.alias
- Test files originally created at project root but vitest looks inside kapwa-client/

## Next Phase Readiness
- All public layout infrastructure complete and tested
- Routes restructured for public pages
- Reusable components ready for LandingPage and AboutPage
- Login and Register routes wired into PublicLayout

---

*Phase: 09-landing-page-auth-flow*
*Completed: 2026-06-28*

## Self-Check: PASSED

All required files created, committed, and verified.
