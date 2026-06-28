---
phase: 09-landing-page-auth-flow
plan: 03
subsystem: ui
tags: [react, shadcn, react-hook-form, zod, login, register, auth, mfa, role-redirect]
requires:
  - phase: 09-01
    provides: PublicLayout shell, restructured routes with /login and /register paths
provides:
  - shadcn-ified LoginPage with RHF + Zod validation, generic error handling, MFA flow, role-based redirect
  - Claimant Registration page with 7-field form, Zod validation, auto-login, /my-dashboard redirect
  - Tests for both pages covering rendering and MFA screen
affects: []
tech-stack:
  added: []
  patterns: [shadcn Form with RHF + Zod validation pattern, MFA challenge screen pattern, role-based post-auth redirect]
key-files:
  created:
    - kapwa-client/src/pages/RegisterPage.tsx
    - kapwa-client/tests/pages/LoginPage.test.tsx
    - kapwa-client/tests/pages/RegisterPage.test.tsx
  modified:
    - kapwa-client/src/pages/LoginPage.tsx (rewritten)
key-decisions:
  - "LoginPage navigates to /dashboard on auth success; ProtectedRoute handles role-based redirect"
  - "Generic error 'Invalid email or password' shown for any login failure (anti-enumeration)"
  - "RegisterPage includes age ≥ 18 validation on dateOfBirth field"
  - "RegisterPage auto-logins via auth-context login() and redirects to /my-dashboard on success"
requirements-completed: [PUB-03, PUB-04]
duration: 15min
completed: 2026-06-28
status: complete
---

# Phase 09 Landing Page Auth Flow Plan 03: Auth Pages Summary

**shadcn-ified LoginPage with RHF + Zod validation, MFA challenge screen, role-unaware redirect (handled downstream), and full claimant registration form with auto-login**

## Performance

- **Duration:** 15min
- **Completed:** 2026-06-28
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- LoginPage fully rewritten from legacy CSS classes to shadcn components (Card, Input, Button, Label, Form, Avatar)
- RHF + Zod validation for email (required, valid format) and password (required)
- MFA challenge screen with 6-digit code input, Verify button disabled until 6 digits, Cancel returns to login
- Generic error message "Invalid email or password. Please try again." (anti-enumeration)
- Loader2 spinner on submit button during async login
- "Register as claimant" link in CardFooter
- RegisterPage with 7 fields (fullName, email, phone, password, confirmPassword, barangay Select, dateOfBirth)
- Zod validation including password confirmation match, age ≥ 18, PH phone format, letters-only name
- Auto-login via auth-context login() + redirect to /my-dashboard on registration success
- 13 tests passing (LoginPage: 5, RegisterPage: 8)
- No legacy CSS classes (form-input, form-label, btn, btn-primary, etc.) — all shadcn + Tailwind

## Task Commits

1. **Task 1: Rewrite LoginPage with shadcn/RHF/Zod + MFA** - `560c3b9` (feat)
2. **Task 2: Create RegisterPage** - `560c3b9` (feat)
3. **Task 3: Create LoginPage + RegisterPage tests** - `25ffd21` (test), `7846b1b` (fix)

**Plan metadata:** Pending

## Files Created/Modified
- `kapwa-client/src/pages/LoginPage.tsx` - 187 lines, complete rewrite: shadcn Card/Input/Button/Form/Avatar, RHF + Zod, MFA flow, role-based redirect
- `kapwa-client/src/pages/RegisterPage.tsx` - 233 lines, full claimant registration with 7 fields, Zod validation, auto-login
- `kapwa-client/tests/pages/LoginPage.test.tsx` - 5 tests: brand, form fields, submit, register link, MFA screen
- `kapwa-client/tests/pages/RegisterPage.test.tsx` - 8 tests: heading, all field labels, submit button, login link

## Decisions Made
- LoginPage navigates to /dashboard after successful auth; ProtectedRoute redirects based on role (decoupling auth from role routing)
- Generic error message does not reveal whether email exists or password is wrong (anti-user-enumeration)
- RegisterPage auto-logins via auth-context login() (not separate token management) for consistency
- Registration API call handles 404/500 gracefully with toast.error
- MFA screen uses text-center tracking-[0.25em] for spaced-out code entry UX

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] LoginPage test used require() for TS module**
- **Found during:** Task 3 (test execution)
- **Issue:** `require('../../src/lib/auth-context')` fails because Node.js can't require TypeScript files
- **Fix:** Changed to mutable variable pattern (`let mockMfaChallenge`) set in mock factory
- **Files modified:** kapwa-client/tests/pages/LoginPage.test.tsx
- **Verification:** All 31 tests pass
- **Committed in:** 7846b1b

---

**Total deviations:** 1 auto-fixed (blocking)
**Impact on plan:** Auto-fix necessary for test to execute.

## Issues Encountered
- vite-tsconfig-paths plugin not loaded by vitest 1.x — required adding inline resolve.alias to vite.config.ts
- Login post-auth role check: React state updates from setUser() inside auth-context login() are batched, so user.role is not immediately available in the onSubmit handler. Workaround: navigate to /dashboard and let ProtectedRoute redirect.

## Next Phase Readiness
- Login and Registration ready for user testing
- MFA flow working (requires backend authenticator setup)
- Registration needs POST /api/auth/register endpoint on backend

---

*Phase: 09-landing-page-auth-flow*
*Completed: 2026-06-28*
