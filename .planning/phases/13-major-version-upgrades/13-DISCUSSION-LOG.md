# Phase 13: Major Version Upgrades - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-05
**Phase:** 13-major-version-upgrades
**Areas discussed:** Upgrade order, ErrorBoundary, Tailwind v4

---

## Upgrade Scope (8 questions)

| # | Question | Selected |
|---|----------|----------|
| 1 | Upgrade order (atomic vs split) | One atomic commit |
| 2 | Breakage policy | Fix forward |
| 3 | Mobile build verification | Web build only |
| 4 | React 19 deprecation strategy | Add follow-up phases (ROADMAP backlog) |
| 5 | TypeScript version | Bump TypeScript to ^5.7 |
| 6 | Deprecation list capture | ROADMAP backlog |
| 7 | Test scope | 196/196 + 3 page renders |
| 8 | Visual regression page selection | Dashboard + Cases + Beneficiaries |

---

### Q1: Upgrade Order

| Option | Description | Selected |
|--------|-------------|----------|
| One atomic commit | Single commit, all 3 version bumps + npm install | ✓ |
| 3 separate plans | Plan 13-01 React 19, 13-02 Capacitor 8, 13-03 Tailwind v4 | |
| You decide | Agent picks optimal order | |

**User's choice:** One atomic commit

---

### Q2: Breakage Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Fix forward | Debug and adapt to v19/v8/v4 APIs, stay on latest | ✓ |
| Roll back | Revert the entire commit if any test fails | |
| Split on failure | Split atomic commit into 3 per-package commits | |
| You decide | Agent decides | |

**User's choice:** Fix forward

---

### Q3: Mobile Build Verification

| Option | Description | Selected |
|--------|-------------|----------|
| Required: Android + iOS | Both must build successfully before commit | |
| Required: Android only | Android only — iOS deferred (Mac gating) | |
| Web build only | Skip mobile build verification | ✓ |

**User's choice:** Web build only

---

### Q4: React 19 Deprecation Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-fix minor deprecations | Same commit, document in SUMMARY | |
| Add follow-up phases | Stop commit, file follow-up phases per deprecation | ✓ |
| You decide | Agent judges minor vs major | |

**User's choice:** Add follow-up phases (ROADMAP backlog)

---

### Q5: TypeScript Version

| Option | Description | Selected |
|--------|-------------|----------|
| Bump TypeScript to ^5.7 | Ensure JSX types and Tailwind v4 plugin types are correct | ✓ |
| Keep TS 5.3 (follow-up) | Defer to follow-up phase | |

**User's choice:** Bump TypeScript to ^5.7

---

### Q6: Deprecation List Capture

| Option | Description | Selected |
|--------|-------------|----------|
| SUMMARY.md follow-ups | Captured in 13-SUMMARY.md "Follow-ups" | |
| ROADMAP backlog | Captured in ROADMAP.md "Backlog" | ✓ |
| Both | SUMMARY immediate notes + ROADMAP persistent | |

**User's choice:** ROADMAP backlog

---

### Q7: Test Scope

| Option | Description | Selected |
|--------|-------------|----------|
| 196/196 unit tests pass | Same as Phase 12 bar | |
| 196/196 + ErrorBoundary test | Add a smoke test for the only class component | |
| 196/196 + 3 page renders | Add snapshot tests for top 3 pages | ✓ |

**User's choice:** 196/196 + 3 page renders

---

### Q8: Visual Regression Page Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Landing + Login + Intake | Different Tailwind patterns (public/centered/form) | |
| Dashboard + Cases + Beneficiaries | Top 3 most-visited pages (core worker flow) | ✓ |
| Layout stress test | Grid/centered/no-layout variety | |

**User's choice:** Dashboard + Cases + Beneficiaries

---

## ErrorBoundary (3 questions)

### Q9: ErrorBoundary Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Migrate to react-error-boundary | Modern hooks-based, custom fallback render prop | ✓ |
| Keep class component | React 19 supports it, lowest risk | |
| Add new ErrorBoundary instances | Wrap existing with new library for offline detect | |

**User's choice:** Migrate to react-error-boundary

---

### Q10: Offline Detection Preservation

| Option | Description | Selected |
|--------|-------------|----------|
| Wrap with custom offline detector | Custom component that detects offline and renders fallback | |
| Drop offline detection | Use react-error-boundary default; offline in fetch hooks later | ✓ |
| Use onError callback | react-error-boundary's onError to set state | |

**User's choice:** Drop offline detection

---

### Q11: Try Again / Reset Wiring

| Option | Description | Selected |
|--------|-------------|----------|
| resetKeys with key bump | Change a key (e.g., timestamp) to force re-render | ✓ |
| resetErrorBoundary function | Passed to fallback, re-renders on click | |

**User's choice:** resetKeys with key bump

---

## Tailwind v4 (3 questions)

### Q12: Migration Tool

| Option | Description | Selected |
|--------|-------------|----------|
| Run codemod + review | `@tailwindcss/upgrade` codemod then manual review | ✓ |
| Manual only | Full control, no surprises | |
| Codemod + keep JS config | Run codemod but keep tailwind.config.js with @config | |

**User's choice:** Run codemod + review

---

### Q13: @layer base Preservation

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve @layer base | Copy shadcn design tokens as-is into new CSS | ✓ |
| Move to @theme inline | v4-native syntax | |
| Delete @layer base | Risk losing shadcn tokens | |

**User's choice:** Preserve @layer base

---

### Q14: Vite Plugin vs Postcss

| Option | Description | Selected |
|--------|-------------|----------|
| Use @tailwindcss/vite plugin | Faster, no postcss step, drop postcss.config.mjs | ✓ |
| Keep postcss | Less invasive | |

**User's choice:** Use @tailwindcss/vite plugin

---

## Deferred Ideas

- React 19 native hooks (`useFormStatus`, `useOptimistic`, `useActionState`) — ROADMAP backlog
- Mobile (Capacitor) build verification on Android/iOS devices — out of scope per D-03
- Offline detection — moved out of ErrorBoundary per D-07; belongs in Phase 15 (SWR + fetch hooks)
- Full dependency audit — out of scope for this phase
- Service worker for offline asset caching — deferred since v1.0

---

*Discussion logged: 2026-07-05*
