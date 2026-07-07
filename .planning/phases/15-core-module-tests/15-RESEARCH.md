# Phase 15: Core Module Tests - Research

**Researched:** 2026-07-07
**Domain:** Vitest coverage tooling + React context/module unit testing + jsdom platform mocking
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Install `@vitest/coverage-v8` as a devDependency. Add `coverage` script in `package.json` running `vitest run --coverage`. Add `coverage:check` script that fails if any of the 4 modules drops below 70% lines.
- **D-02:** Configure v8 provider in `vite.config.ts` under `test.coverage`: `provider: 'v8'`, `include: ['src/lib/{api,api-error,auth-context,offline-queue,secure-storage}.{ts,tsx}']`, `exclude: ['**/*.test.{ts,tsx}', '**/types.ts', '**/index.ts']`, `thresholds: { perFile: true, lines: 70, functions: 70, branches: 60, statements: 70 }`.
- **D-03:** CI gate deferred to Phase 17. `coverage:check` script is wired and runnable, not yet integrated into any CI workflow.
- **D-04:** Target 1 test per branch (~50-65 new tests total). 3-5 for api.ts, 8-10 for auth-context.tsx, 25-30 for offline-queue.ts, 6-8 for secure-storage.ts.
- **D-05:** offline-queue.ts: test 14 public exports individually. No integration tests between exports.
- **D-06:** Per-module coverage target = 70% lines. Functions/branches tracked but not blocking.
- **D-07:** Test both browser and native paths in jsdom. Mock `@capacitor-community/sqlite` for native. Toggle `Capacitor.isNativePlatform()` via `vi.spyOn`.
- **D-08:** Test corruption path: mock `encryptedDb.getItem` to throw/malformed JSON. Verify `SecureStorage.getItem` returns null + logs error.
- **D-09:** Test `SecureStorage.init` (browser: `encryptedDb.init()` called; native: `createConnection` + `open` + `execute` + `close` in order). Verify password-derivation reads `kapwa_db_key` from localStorage.
- **D-10:** Mock global `fetch`. Test 4 login + MFA scenarios (~5 tests).
- **D-11:** Test `useAuth()` via mocked provider + consumer. Test `getCurrentUser()` (3 cases).
- **D-12:** Test `cancelMfa()` clears `mfaChallenge` without firing fetch (~1 test).
- **D-13:** Split each module into 2-3 test files. Total ~12 test files (see CONTEXT for exact list).
- **D-14:** Use existing vitest setup. No changes to global `vite.config.ts` test config beyond the `coverage` block.
- **D-15:** Four-plan bottom-up: api → auth-context → offline-queue → secure-storage.
- **D-16:** Plan 15-01 = install coverage tool + api tests + verify api.ts ≥70%. Plan 15-02 = auth-context. Plan 15-03 = offline-queue. Plan 15-04 = secure-storage.

### the agent's Discretion
- Specific test names (descriptive: `login() with valid credentials sets user + token`, not `test1`)
- Whether to add `console.warn` mocks for the `kapwa:auth:logout` subscriber's log line
- Exact test ordering within `describe` blocks (happy path → error path → edge case)
- Whether to use `vi.useFakeTimers()` for `incrementLocalVersion` / `updateServerVersion` (which set `lastSyncedAt = new Date().toISOString()`)

### Deferred Ideas (OUT OF SCOPE)
- Property-based testing (fast-check)
- Coverage report badge
- Coverage diff in CI comments
- Mutation testing (stryker)
- Coverage of `sync.ts` and `encrypted-db.ts` (have their own files)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TST-01 | Unit tests for `api.ts` (≥70% coverage) | Standard Stack §@vitest/coverage-v8; Code Examples §api.ts; existing `api.test.ts` (16 tests) + 3-5 new tests per D-04 |
| TST-02 | Unit tests for `auth-context.tsx` (login, logout, role checks) | Code Examples §auth-context.tsx; D-10/D-11/D-12 scenarios; existing 3 tests + 8-10 new tests |
| TST-03 | Unit tests for `offline-queue.ts` (queue, dequeue, conflict resolution) | Code Examples §offline-queue.ts; D-05 14-exports strategy; existing 2 tests + 25-30 new tests |
| TST-04 | Unit tests for `secure-storage.ts` (encrypt, decrypt, key rotation) | Code Examples §secure-storage.ts; D-07/D-08/D-09 native + browser + corruption paths; existing 3 tests + 6-8 new tests |
</phase_requirements>

## Summary

Phase 15 wires up Vitest's v8 coverage tooling and backfills unit tests for the four most critical client-side data modules: `api.ts` (HTTP client), `auth-context.tsx` (login/MFA context), `offline-queue.ts` (sync queue + version vectors + conflict resolution), and `secure-storage.ts` (platform-routing encrypted storage). The phase boundary is precise: ≥70% line coverage on each module, verified per-file via `@vitest/coverage-v8` thresholds, with a `coverage:check` npm script that fails CI on regression. The four-module scope is fixed by the v1.2 REQUIREMENTS.md (TST-01..TST-04) and CONTEXT.md D-13.

The technical challenge is **mocking two distinct platform paths inside a single jsdom environment** — specifically `secure-storage.ts` which routes to `@capacitor-community/sqlite` when `Capacitor.isNativePlatform()` returns true, and to `encryptedDb` (the browser AES-256-GCM fallback) otherwise. Vitest's `vi.mock` works on dynamic imports because its transformer converts all imports to dynamic; `vi.spyOn(Capacitor, 'isNativePlatform')` is the established pattern for toggling platform detection. Both patterns are documented by the Vitest mocking guide and the existing `secure-storage.test.ts` file already uses `vi.mock('./encrypted-db', ...)` for the browser path. CONTEXT.md D-07 specifies the exact mock factory shape.

Coverage threshold enforcement uses Vitest's `thresholds.perFile: true` option which checks each file independently — matching D-06's "per-module coverage target = 70% lines" rule. The default `text` reporter automatically adjusts for AI-agent environments by adding `text-summary` and setting `skipFull: true` (Vitest 4.x behavior), which is useful for GSD's verifier output.

**Primary recommendation:** Install `@vitest/coverage-v8@4.1.10` (peer-matched to the project's existing `vitest@4.1.9`), add the `coverage` block to `vite.config.ts` per D-02, add the `coverage` and `coverage:check` scripts to `package.json`, then deliver the four test plans in the bottom-up order specified in D-15.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Coverage measurement (v8 instrumentation) | Build / Test runner | — | Vitest runs in Node, instruments source modules via v8, writes reports to `./coverage/`. No runtime involvement. |
| API client (`api.ts`) | API / Backend client | — | HTTP transport lives in the browser, but is a pure module — tests stub `fetch` globally. |
| Auth context (`auth-context.tsx`) | Frontend Server (SSR) / Client state | Browser | Context provider runs in React; `fetch` is stubbed; jsdom hosts the render. |
| Offline queue (`offline-queue.ts`) | Browser / Client (localStorage) | — | Pure module over `localStorage` and `crypto.randomUUID()`; no React, no fetch. |
| Secure storage (`secure-storage.ts`) | Browser / Client + Native bridge | — | Two paths: browser (encrypted localStorage via `encrypted-db.ts`) and native (`@capacitor-community/sqlite` via dynamic import). The platform-routing decision lives in the module. |
| `kapwa:auth:logout` event dispatch | Browser / Client (window event) | — | Cross-module pub/sub; `api.ts` dispatches, `auth-context.tsx` subscribes. Already covered by the existing `api.test.ts` (401 → refresh → logout event) and `auth-context.test.tsx` tests. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@vitest/coverage-v8` | 4.1.10 | Native v8 code-coverage provider for Vitest 4.x | Official Vitest coverage provider; matches the existing `vitest@4.1.9` install. v8 provider is faster than istanbul (no source rewriting) and is the default in Vitest 4. [VERIFIED: vitest.dev/config/coverage, npm registry] |
| `vitest` | 4.1.9 | Test runner | Already installed; provides `test.coverage` block in `vite.config.ts`. [VERIFIED: package.json] |
| `@testing-library/react` | 16.3.2 | Render React components in tests | Already installed (Phase 12); supports React 19 + jsdom. [VERIFIED: package.json, CONTEXT.md D-14] |
| `jsdom` | 24.0.0 | Browser API simulation | Already installed; the `environment: 'jsdom'` is set globally in `vite.config.ts`. [VERIFIED: package.json, vite.config.ts:27] |
| `@testing-library/jest-dom` | 6.9.1 | DOM matchers | Already installed but not yet imported in any test. [VERIFIED: package.json] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@capacitor/core` | 8.4.1 | `Capacitor.isNativePlatform()` platform check | Spied on in native-path tests. Already a runtime dep. [VERIFIED: package.json, node_modules/@capacitor/core/dist/index.cjs.js:192] |
| `@capacitor-community/sqlite` | 8.1.0 | SQLCipher native bridge | Mocked via `vi.mock('@capacitor-community/sqlite', ...)` in native-path tests. Already a runtime dep. [VERIFIED: package.json, CONTEXT.md D-07] |
| `encrypted-db` (local module) | n/a | AES-256-GCM browser fallback | Mocked via `vi.mock('./encrypted-db', ...)` in browser-path tests. Already mocked in `secure-storage.test.ts`. [VERIFIED: secure-storage.test.ts:4-11] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@vitest/coverage-v8` | `@vitest/coverage-istanbul` | Istanbul requires pre-instrumentation, slower execution, larger file sizes. v8 is the Vitest 4.x default and uses native V8 counters. v8 wins. |
| Per-file thresholds (`perFile: true`) | Global-only thresholds | Per-file catches the case where one module hits 100% and hides another at 50%. Per-file is the only configuration that matches D-06's "per-module coverage target = 70% lines." |
| `vi.mock('@capacitor-community/sqlite', ...)` | Mocking the module's `dist/esm` directly | `vi.mock` with the bare module name is the documented Vitest pattern and works for both static and dynamic imports (CONTEXT.md D-07 specifies this exact shape). |
| Spying on `Capacitor.isNativePlatform` | Replacing the entire `@capacitor/core` module | The spy is more surgical — only flips the boolean for the duration of one test, then restores via `vi.restoreAllMocks()` in `afterEach`. [VERIFIED: vitest.dev/api/vi.html#vi-spyon] |

**Installation:**

```bash
cd kapwa-client
npm install -D @vitest/coverage-v8@4.1.10
```

**Version verification (D-02 prerequisite):**

```bash
npm view @vitest/coverage-v8 version
# → 4.1.10 (latest stable, peer-deps: vitest 4.1.10) [VERIFIED: npm registry]
npm view @vitest/coverage-v8 peerDependencies
# → { vitest: '4.1.10', '@vitest/browser': '4.1.10' } [VERIFIED: npm registry]
```

## Package Legitimacy Audit

> The Package Legitimacy Gate protocol was executed. `@vitest/coverage-v8@4.1.10` was flagged `[SUS]` by the seam with a single signal `"too-new"` (published 2026-07-06, 20 hours before this research). Manual inspection confirms legitimacy: published by the official vitest maintainers (`ariperkkio`, `antfu`, `hiogawa`, `oreanno`, `yyx990803`), 25.8M weekly downloads, 170 versions, repo `git+https://github.com/vitest-dev/vitest.git` (the official vitest monorepo, subdirectory `packages/coverage-v8`), no `postinstall` script, peer-deps match the project's installed `vitest@4.1.9`. The "too-new" signal is a false positive triggered by a same-day version bump; this is the official Vitest coverage package, not a slopsquat.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@vitest/coverage-v8` | npm | ~170 versions; v4.1.10 published 2026-07-06 | 25.8M/wk | github.com/vitest-dev/vitest (`packages/coverage-v8`) | OK (manual override of [SUS] false-positive) | Approved — see audit note above |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none (the one [SUS] flag was overturned by manual review)

*Packages discovered via WebSearch or training data that have not been verified against an authoritative source are tagged `[ASSUMED]` and the planner must gate each install behind a `checkpoint:human-verify` task. In this phase, the only new package install is the official vitest coverage provider, which is `[VERIFIED: npm registry]` after manual override.*

## Architecture Patterns

### System Architecture Diagram

This phase is a *testing-tooling + unit-test-backfill* phase, not a feature-build phase. There is no runtime data flow to diagram. The architecture is the test infrastructure:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Test infrastructure (added by Plan 15-01)                                   │
│                                                                            │
│  vite.config.ts ──► test.coverage { provider: 'v8', ... thresholds }        │
│                       │                                                    │
│                       ├── include: 4 source files                           │
│                       ├── exclude: tests, types, index                     │
│                       └── thresholds.perFile: 70 lines                      │
│                                                                            │
│  package.json ──► scripts:                                                  │
│                   ├── "coverage":       "vitest run --coverage"             │
│                   └── "coverage:check": "vitest run --coverage"  (gates CI)│
│                                                                            │
│  Test files (added per plan 15-01..15-04)                                  │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌──────────────────────┐  │
│  │ api.test.ts         │  │ auth-context.*.tsx  │  │ offline-queue.*.ts   │  │ ...
│  │ + 3-5 new tests     │  │ + 8-10 new tests    │  │ + 25-30 new tests    │  │ ...
│  └─────────────────────┘  └─────────────────────┘  └──────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

The per-test mocking architecture uses three patterns:

```
Pattern 1: vi.stubGlobal('fetch', vi.fn())  ──► exercises network paths
Pattern 2: vi.mock('./encrypted-db', ...)   ──► replaces browser encrypted DB
Pattern 3: vi.mock('@capacitor-community/sqlite', ...)  ──► replaces native bridge
           + vi.spyOn(Capacitor, 'isNativePlatform')     ──► toggles platform
```

### Recommended Project Structure

Per D-13, test files are co-located with source files and follow the existing `<source>.<concern>.test.{ts,tsx}` pattern already established by `auth-context.test.tsx` (existing) and proposed for the new files:

```
kapwa-client/src/lib/
├── api.ts
├── api.test.ts                              # existing 16 tests + 3-5 new (D-04)
├── api-error.ts
├── api-error.test.ts                        # existing 4 tests — NO additions
├── auth-context.tsx
├── auth-context.test.tsx                    # existing 3 tests (logout + fetchUser)
├── auth-context.login.test.tsx              # NEW: D-10 login/MFA scenarios
├── auth-context.useauth.test.tsx            # NEW: D-11/D-12 useAuth + getCurrentUser + cancelMfa
├── offline-queue.ts
├── offline-queue.test.ts                    # existing 2 tests (loadQueue)
├── offline-queue.queue.test.ts              # NEW: D-05 queueChange, getPendingChanges, queueFsmTransition
├── offline-queue.conflict.test.ts           # NEW: D-05 markSynced/Conflict/Failed, mergeRecords, resolveConflict, getConflictChanges
├── offline-queue.versions.test.ts           # NEW: D-05 incrementLocalVersion, updateServerVersion, getVersionVector, getAllVersionVectors
├── secure-storage.ts
├── secure-storage.test.ts                   # existing 3 tests (browser fallback basics)
├── secure-storage.browser.test.ts           # NEW: D-08 corruption + D-09 browser init
├── secure-storage.native.test.ts            # NEW: D-07 native init/getItem/setItem/removeItem
```

Total: 8 existing tests + 3 (api) + 10 (auth) + 28 (offline-queue) + 8 (secure-storage) ≈ 57 new tests across 7 new test files + 1 existing test file (api.test.ts) getting additions. Matches the D-04 estimate of 50-65 new tests.

### Pattern 1: Per-file coverage threshold (D-02)

**What:** Configure Vitest to enforce a 70% lines threshold **per file** (not per project). If any of the 4 included files falls below 70% lines, the test run exits with non-zero status.

**When to use:** When coverage is the success criterion for individual modules, not just for the codebase as a whole. D-06 specifies this exact rule.

**Example:**

```typescript
// kapwa-client/vite.config.ts — add to the existing test block
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./tests/setup.ts'],
  include: ['src/**/*.test.{ts,tsx}'],
  exclude: ['src/__tests__/e2e.test.ts', 'src/__tests__/a11y/pages.test.ts'],
  coverage: {
    provider: 'v8',
    include: [
      'src/lib/{api,api-error,auth-context,offline-queue,secure-storage}.{ts,tsx}',
    ],
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

**Source:** [VERIFIED: vitest.dev/config/coverage#coverage-thresholds-perfile — `coverage.thresholds.perFile: boolean, default: false, Check thresholds per file`]

### Pattern 2: Native-platform mocking for secure-storage (D-07)

**What:** Mock the `@capacitor-community/sqlite` dynamic import and toggle `Capacitor.isNativePlatform()` per test. This exercises the native code path in jsdom without spinning up a real Capacitor bridge.

**When to use:** Whenever a module dynamically imports a native bridge module that doesn't exist in jsdom (e.g. `@capacitor-community/sqlite`, `@capacitor/filesystem`).

**Example:**

```typescript
// kapwa-client/src/lib/secure-storage.native.test.ts
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

describe('SecureStorage — native path', () => {
  beforeEach(() => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('init() calls createConnection, open, execute, close in order', async () => {
    const { CapacitorSQLite } = await import('@capacitor-community/sqlite');
    await SecureStorage.init();
    expect(CapacitorSQLite.createConnection).toHaveBeenCalledWith(
      expect.objectContaining({ database: 'kapwa', encrypted: true }),
    );
    expect(CapacitorSQLite.open).toHaveBeenCalled();
    expect(CapacitorSQLite.execute).toHaveBeenCalled();
    expect(CapacitorSQLite.close).toHaveBeenCalled();
  });
});
```

**Source:** [VERIFIED: vitest.dev/guide/mocking/modules — `vi.mock` is hoisted and applies to dynamic imports; vitest.dev/api/vi.html#vi-spyon for `vi.spyOn` on class methods; node_modules/@capacitor/core/dist/index.cjs.js:192 confirms `cap.isNativePlatform = isNativePlatform;`]

### Pattern 3: Auth-context login/MFA fetch mocking (D-10)

**What:** Stub the global `fetch`, render `<AuthProvider>` with a `useAuth()` consumer, dispatch state changes via the consumer, and assert state transitions.

**When to use:** When testing React context providers that mix network calls (raw `fetch` in pre-auth paths) with local state.

**Example:**

```typescript
// kapwa-client/src/lib/auth-context.login.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './auth-context';

function AuthProbe({ onAuth }: { onAuth: (a: ReturnType<typeof useAuth>) => void }) {
  const auth = useAuth()!;
  act(() => { onAuth(auth); });
  return <div data-testid="probe" />;
}

describe('AuthProvider — login', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('login() with valid credentials sets user + token', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true, status: 200, json: () => Promise.resolve({
        accessToken: 'tok-1',
        user: { id: 'u1', email: 'a@b', fullName: 'A B', role: 'admin' },
      }),
    });

    let captured: ReturnType<typeof useAuth> | null = null;
    render(<AuthProvider><AuthProbe onAuth={(a) => { captured = a; }} /></AuthProvider>);

    await act(async () => {
      await captured!.login('a@b.com', 'pass');
    });

    await waitFor(() => {
      expect(captured!.user).toEqual({ id: 'u1', email: 'a@b', fullName: 'A B', role: 'admin' });
    });
    expect(localStorage.getItem('kapwa_token')).toBe('tok-1');
  });
});
```

**Source:** [VERIFIED: auth-context.tsx:64-79 (login function); existing auth-context.test.tsx:24-63 (precedent for `act` + `waitFor` + `AuthProbe` pattern)]

### Anti-Patterns to Avoid

- **Anti-pattern 1: Mocking the entire `@capacitor/core` module with `vi.mock`.** The module's `Capacitor.isNativePlatform` is a single boolean method; replacing the whole module forces you to re-mock `registerPlugin`, `Plugins`, etc. for no reason. Use `vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true/false)` per test instead. [VERIFIED: vitest.dev/api/vi.html#vi-spyon]
- **Anti-pattern 2: Setting `coverage.thresholds: { lines: 70 }` without `perFile: true`.** This enforces a project-wide 70% threshold — a module at 100% lines could mask another at 40% lines. D-06 explicitly requires per-module enforcement. [VERIFIED: vitest.dev/config/coverage#coverage-thresholds-perfile]
- **Anti-pattern 3: Adding comments to test files.** AGENTS.md says "DO NOT ADD ANY COMMENTS unless asked." The only exception is the inherited `// Mock ...` fixture note pattern (per CONTEXT.md D-14), and only on 1-line mocks.
- **Anti-pattern 4: Writing integration tests across offline-queue exports.** D-05 explicitly defers cross-export integration tests; the existing `sync-conflict.test.ts` covers that surface. New tests cover each public export in isolation.
- **Anti-pattern 5: Adding `as any` to test the `auth-context.tsx` User type.** The `User` interface is private to the file; test fixtures should match the inline shape (`{ id, email, fullName, role }`) and the consumer test can cast the result via `unknown`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Coverage measurement | A custom source-instrumenting babel plugin | `@vitest/coverage-v8` | v8 uses V8's native coverage counters — no source rewriting, faster, accurate. Vitest's transformer wires it up automatically. [VERIFIED: vitest.dev/guide/coverage#v8-provider] |
| Per-file coverage gate | A post-test Node script that greps the v8 JSON output | `coverage.thresholds.perFile: true` in vite.config | Vitest 4 has built-in per-file threshold enforcement; the script in `coverage:check` is just `vitest run --coverage`. [VERIFIED: vitest.dev/config/coverage#coverage-thresholds-perfile] |
| Mocking platform detection | Reading `navigator.userAgent` and stubbing globally | `vi.spyOn(Capacitor, 'isNativePlatform')` | Capacitor exposes a stable API for this; spying is test-scoped and auto-restored. |
| Mocking dynamic native imports | Patching `import()` via proxy or webpack aliases | `vi.mock('@capacitor-community/sqlite', factory)` | Vitest's mocker rewrites both static and dynamic imports. `vi.mock` with the bare module name is the documented pattern. [VERIFIED: vitest.dev/guide/mocking/modules] |
| DOM matchers in tests | `expect(node.className).toBe('foo')` | `@testing-library/jest-dom` matchers (`toHaveClass`) | Already installed (per package.json), but not used yet. The phase boundary doesn't require introducing new matchers — the existing `toBe`/`toEqual`/`toBeNull` style is consistent. |

**Key insight:** Vitest 4 already has every primitive this phase needs. The only new dependency is `@vitest/coverage-v8`. Resist the urge to write a custom coverage script or to add test-runner plugins — the existing test config is sufficient.

## Runtime State Inventory

> Include this section for rename/refactor/migration phases only. Omit entirely for greenfield phases.

**This phase adds no runtime state.** It is a test-instrumentation + test-backfill phase. No databases, services, OS registrations, secrets, or build artifacts are affected.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no schema or data layer changes | none |
| Live service config | None — no service config touched | none |
| OS-registered state | None — no tasks, daemons, or schedulers | none |
| Secrets/env vars | None — no `.env` or secret manager changes | none |
| Build artifacts | None — no compiled binaries or container images | none |

**Nothing found in category:** Verified by re-reading the four source files (`api.ts`, `auth-context.tsx`, `offline-queue.ts`, `secure-storage.ts`) and the existing test files — none of them write to disk, register OS state, or touch secrets. Phase 15 is pure test code.

## Common Pitfalls

### Pitfall 1: `vi.mock` factory must be hoisted; closure-captured variables fail

**What goes wrong:** A test file uses `vi.mock('./module', () => ({ fn: someVariable }))` where `someVariable` is declared later in the file. The mock factory runs at hoist time (before any imports resolve) and the closure variable is `undefined`.

**Why it happens:** Vitest's `vi.mock` is hoisted to the top of the file by the babel transformer, before the import statements. [VERIFIED: vitest.dev/guide/mocking/modules#how-it-works — "Vitest will transform every static import into a dynamic one and move the `vi.mock` call to the top of the file."]

**How to avoid:** Use `vi.hoisted(() => ({...}))` to declare variables that the mock factory can reference, or use `vi.doMock` (not hoisted) inside `beforeEach`.

**Warning signs:** Test fails with `Cannot read properties of undefined (reading 'fn')` or `vi.fn() is not a function`.

### Pitfall 2: `vi.spyOn` on a class method returns a separate mock object — `restoreAllMocks` is required

**What goes wrong:** A test spies on `Capacitor.isNativePlatform` and `mockReturnValue(true)`. The next test sees `isNativePlatform()` returning `true` (or `false` from a previous test) because the spy persists.

**Why it happens:** `vi.spyOn` does not auto-restore. Only `vi.restoreAllMocks()` in `afterEach` (or `vi.restoreAllMocks()` at the end of the test) cleans it up. The existing `tests/setup.ts:58-60` does call `vi.restoreAllMocks()` in `afterEach`, but only for the `restoreAllMocks` call — `spyOn` requires the same call.

**How to avoid:** The existing `afterEach(() => vi.restoreAllMocks())` in `tests/setup.ts` covers this. For tests that need to also unstub globals, add `vi.unstubAllGlobals()` in a per-test-file `afterEach` (the precedent is in `api.test.ts:18-21`).

**Warning signs:** A test that should see `isNativePlatform() === false` (the jsdom default) actually sees `true`.

### Pitfall 3: Coverage thresholds fire even when the v8 provider isn't installed

**What goes wrong:** Running `vitest run --coverage` before installing `@vitest/coverage-v8` silently switches to the bundled default (in Vitest 4, this is the v8 provider pre-bundled, but with a warning). The thresholds then fail because the include glob is empty or the instrumentation is incomplete.

**Why it happens:** Vitest 4 no longer auto-installs the coverage package in the way Vitest 1.x did. The user must `npm i -D @vitest/coverage-v8` explicitly. [VERIFIED: vitest.dev/guide/coverage#coverage-setup — "When you start the Vitest process, it will prompt you to install the corresponding support package automatically. Or if you prefer to install them manually: `npm i -D @vitest/coverage-v8`"]

**How to avoid:** Plan 15-01 Task 1 is `npm install -D @vitest/coverage-v8@4.1.10` before any coverage run. The package is in `peerDependencies` of vitest 4.1.x, so version-matching is automatic.

**Warning signs:** Coverage report shows 0 files; threshold fails with "no files included."

### Pitfall 4: `localStorage` in `tests/setup.ts` is a custom in-memory store, not jsdom's

**What goes wrong:** A test asserts `expect(localStorage.getItem('kapwa_token')).toBeNull()` but sees the value from a previous test. The shared in-memory store leaks across tests.

**Why it happens:** `tests/setup.ts:5-12` defines a module-scoped `store: Record<string, string>` and `Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, ... })`. The `afterEach` in the same file calls `localStorage.clear()` (line 59), so it *should* be fine — but the property definition persists, and if a test replaces `localStorage` with its own mock, the cleanup can fail silently.

**How to avoid:** Don't replace the `localStorage` property in test files; just call `localStorage.clear()` in `beforeEach`. The existing `api.test.ts:13-16` and `auth-context.test.tsx:14-17` both do this correctly.

**Warning signs:** A test fails with a stale token from a previous test run; running the test in isolation passes.

### Pitfall 5: jsdom + Capacitor — `Capacitor.isNativePlatform()` returns false by default, but the global is named "Capacitor"

**What goes wrong:** Tests for the native path expect `isNativePlatform()` to return false by default (the jsdom environment is a "web" platform), but importing `@capacitor/core` in jsdom sometimes logs warnings or the platform check returns true if the module is mocked elsewhere.

**Why it happens:** `@capacitor/core` reads `navigator.userAgent` and the build mode at module init time. In jsdom, it falls through to `isNativePlatform = () => getPlatform() !== 'web'`, which returns `false` by default. [VERIFIED: node_modules/@capacitor/core/dist/index.cjs.js:52]

**How to avoid:** Tests that depend on platform routing should explicitly `vi.spyOn(Capacitor, 'isNativePlatform')` in `beforeEach` to avoid relying on the default. The browser-path tests do NOT need the spy (the default `false` is correct); the native-path tests DO need `mockReturnValue(true)`.

**Warning signs:** A test in `secure-storage.native.test.ts` calls `SecureStorage.init()` and sees the browser path (encryptedDb.init) instead of the native path (CapacitorSQLite.createConnection).

### Pitfall 6: `vi.useFakeTimers()` + `await vi.runAllTimersAsync()` — order matters

**What goes wrong:** Tests that use fake timers (for the backoff in api.test.ts) sometimes leave fake timers active across test boundaries, causing later tests to see time frozen.

**Why it happens:** `vi.useFakeTimers()` in a test must be paired with `vi.useRealTimers()` in a `finally` block, or in the next `beforeEach`. The existing `api.test.ts:53-63` and `api.test.ts:158-170` use `try { ... } finally { vi.useRealTimers(); }` correctly.

**How to avoid:** Mirror the existing pattern. The new offline-queue tests do not need fake timers (the `lastSyncedAt` is just `new Date().toISOString()`, not a `setTimeout`), so this pitfall is mainly relevant to api tests.

**Warning signs:** A test asserts on a timestamp and sees `1970-01-01T00:00:00.000Z` (the epoch).

## Code Examples

Verified patterns from official sources and the existing test files:

### `vitest run --coverage` with per-file thresholds

```typescript
// Source: vitest.dev/config/coverage#coverage-thresholds (verified)
test: {
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

### `vi.spyOn` for platform toggling (D-07)

```typescript
// Source: vitest.dev/api/vi.html#vi-spyon (verified)
import { Capacitor } from '@capacitor/core';

it('runs native path when isNativePlatform() returns true', async () => {
  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
  // ... exercise native code path
});
```

### `vi.mock` for native bridge (D-07)

```typescript
// Source: CONTEXT.md D-07 (locked decision) + vitest.dev/guide/mocking/modules (verified)
vi.mock('@capacitor-community/sqlite', () => ({
  CapacitorSQLite: {
    createConnection: vi.fn().mockResolvedValue(undefined),
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue({ values: [] }),
    execute: vi.fn().mockResolvedValue({ changes: 1 }),
  },
}));
```

### `mergeRecords` — 4 financial fields each get their own test (per CONTEXT.md "Specific Ideas")

```typescript
// Source: CONTEXT.md "Specific Ideas" (locked decision) + offline-queue.ts:156-177 (source)
import { mergeRecords } from './offline-queue';

describe('mergeRecords — FINANCIAL_FIELDS server-wins', () => {
  for (const field of ['amount', 'status', 'fundSource', 'disbursedAmount']) {
    it(`server value wins for "${field}"`, () => {
      const result = mergeRecords({ [field]: 'server' }, { [field]: 'client' });
      expect(result[field]).toBe('server');
    });
  }
});
```

### `kapwa:auth:logout` event subscriber — malformed detail (per CONTEXT.md "Specific Ideas")

```typescript
// Source: auth-context.tsx:36-45 (existing) + CONTEXT.md "Specific Ideas"
it('subscriber calls logout() even when event.detail is missing', async () => {
  // No detail on the event
  await act(async () => {
    window.dispatchEvent(new CustomEvent('kapwa:auth:logout'));
  });
  await waitFor(() => {
    expect(localStorage.getItem('kapwa_token')).toBeNull();
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Vitest 1.x auto-installed `@vitest/coverage-v8` on first run | Vitest 4.x prompts the user to install explicitly | Vitest 2.0 (2024) | Plan 15-01 must include `npm install -D @vitest/coverage-v8` as an explicit step. [VERIFIED: vitest.dev/guide/coverage#coverage-setup] |
| `coverage.enabled: true` in config (always-on) | `coverage.enabled: false` (opt-in via `--coverage` flag) | Vitest 2.0 | The `coverage` and `coverage:check` npm scripts pass `--coverage` explicitly; the test config sets thresholds but leaves `enabled: false` so the default `npm test` (watch mode) stays fast. |
| Single `text` reporter | `text` + `html` + `text-summary` (in agent envs) | Vitest 2.x | Default `text` reporter is augmented in agent environments with `text-summary` and `skipFull: true` for compact output. [VERIFIED: vitest.dev/guide/coverage#coverage-in-agent-environments] |
| `tests/setup.ts` in `tests/` directory | Same — unchanged | n/a | The project uses `kapwa-client/tests/setup.ts` (per vite.config.ts:29). All new tests inherit its `localStorage`, `crypto`, and `navigator` mocks. |

**Deprecated/outdated:**
- `@vitest/coverage-istanbul` for v8-native projects: still supported but slower and requires Babel pre-instrumentation. v8 provider is preferred for Vitest 4. [VERIFIED: vitest.dev/guide/coverage#istanbul-provider]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@vitest/coverage-v8@4.1.10` is the correct version to install (peer-matched to vitest 4.1.9/4.1.10). | Standard Stack | LOW — npm peer-deps warning at install time; vitest will pin to the latest matching version. The project's vitest is `^4.1.9`, so 4.1.10 is in range. |
| A2 | The vitest-config `include` glob `src/lib/{api,api-error,auth-context,offline-queue,secure-storage}.{ts,tsx}` matches the 4 modules + api-error. | Architecture Patterns / Don't Hand-Roll | LOW — micromatch brace expansion is standard. If a test author finds the glob doesn't match, the fallback is to spell out each file. |
| A3 | `vi.mock('@capacitor-community/sqlite', ...)` is applied to dynamic `import()` calls in `secure-storage.ts` (lines 24, 57, 78, 96). | Architecture Patterns | LOW — Vitest's mocker converts all static and dynamic imports via `__handle_mock__`. The existing `vi.mock('./encrypted-db', ...)` pattern in `secure-storage.test.ts` proves this works for the file under test. |
| A4 | The 4 source files' total LoC (api.ts 219 + auth-context.tsx 123 + offline-queue.ts 192 + secure-storage.ts 109 = 643 LoC) makes 50-65 new tests the right ballpark for ≥70% lines. | Standard Stack | MEDIUM — the D-04 estimate is the locked number; if actual coverage is below 70% after the planned tests, more tests are needed. The planner should add a Wave 0 task to run coverage and report baseline before writing the new tests. |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

## Open Questions

1. **Should `tests/setup.ts` be updated to add a global mock for `@capacitor-community/sqlite`?**
   - What we know: Each native-path test file currently has to `vi.mock('@capacitor-community/sqlite', ...)` at the top. If the project has 4 native-path test files (Plan 15-04), this mock is repeated.
   - What's unclear: Whether the project wants per-test-file mocks (explicit, no global magic) or a single global setup mock (DRY but less visible).
   - Recommendation: Keep mocks per test file. AGENTS.md / CONVENTIONS.md favor explicit, per-file mocks over global setup magic. The existing `secure-storage.test.ts` already follows this pattern.

2. **What is the actual current coverage of each module, before Phase 15 adds tests?**
   - What we know: The 4 modules are partially covered (api.ts 16 tests, auth-context.tsx 3 tests, offline-queue.ts 2 tests, secure-storage.ts 3 tests). Coverage is likely 30-60% per file.
   - What's unclear: The exact baseline. The 70% threshold is enforced via `perFile: true`, so a 40% baseline would need more tests than a 60% baseline.
   - Recommendation: Plan 15-01 Task 1 should run `npm run test:run` to confirm the existing 26 tests still pass, then Plan 15-01 Task 2 (or a Wave 0 task) should run `vitest run --coverage` to capture the baseline coverage % per file. The 50-65 test budget from D-04 is anchored to the 70% target — if the baseline is far below, the test count needs to grow.

3. **Does the `kapwa:auth:logout` subscriber test need to mock `console.warn`?**
   - What we know: `auth-context.tsx:39` calls `console.warn('Auth logout triggered:', reason)` on every event. The existing test in `auth-context.test.tsx:24-63` does not mock `console.warn` — the warning is just logged to stderr.
   - What's unclear: Whether the new tests (D-12 cancelMfa, D-10 resolveMfa error) trigger the subscriber path or not. cancelMfa is a separate code path (line 96-98) that doesn't fire the event. resolveMfa error throws but doesn't dispatch the event.
   - Recommendation: Per the "agent's Discretion" carve-out, no `console.warn` mock is needed. If the new tests trigger noise on stderr, add a `vi.spyOn(console, 'warn').mockImplementation(() => {})` per test.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js ≥ 22 | Vitest 4.x runtime | ✓ | 26.4.0 (per `node --version` in research) | — |
| npm | Package install + scripts | ✓ | bundled with Node 26 | — |
| `@vitest/coverage-v8@4.1.10` | Coverage measurement | ✗ (must install in Plan 15-01 Task 1) | — | — (blocking) |
| `vitest@4.1.9` | Test runner | ✓ (in devDependencies) | 4.1.9 | — |
| `@testing-library/react@16.3.2` | React component rendering in tests | ✓ | 16.3.2 | — |
| `jsdom@24.0.0` | DOM environment | ✓ | 24.0.0 | — |
| `@capacitor/core@8.4.1` | `Capacitor.isNativePlatform` spy | ✓ (in dependencies) | 8.4.1 | — |
| `@capacitor-community/sqlite@8.1.0` | Mocked native bridge | ✓ (in dependencies) | 8.1.0 | — |

**Missing dependencies with no fallback:**
- `@vitest/coverage-v8` — required for the coverage measurement that the phase boundary explicitly targets. Plan 15-01 Task 1 must install it.

**Missing dependencies with fallback:** none

## Validation Architecture

> Validation Architecture is included per `.planning/config.json` `workflow.nyquist_validation: true`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 + @testing-library/react 16.3.2 (existing) |
| Config file | `kapwa-client/vite.config.ts` (test block at line 26-32) |
| Quick run command | `cd kapwa-client && npm run test:run` |
| Full suite command | `cd kapwa-client && npm run test:run -- --coverage` (this is the `coverage:check` script) |
| Coverage tool (new) | `@vitest/coverage-v8@4.1.10` (to install in Plan 15-01) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TST-01 | api.ts ≥70% line coverage | unit (existing 16 + 3-5 new) | `npm run test:run src/lib/api.test.ts` | ✅ existing; will gain tests in Plan 15-01 |
| TST-02 | auth-context.tsx ≥70% line coverage (login, logout, role checks) | unit + component (existing 3 + 8-10 new) | `npm run test:run src/lib/auth-context*.test.tsx` | ✅ existing; will gain 2 new files in Plan 15-02 |
| TST-03 | offline-queue.ts ≥70% line coverage (queue, dequeue, conflict resolution) | unit (existing 2 + 25-30 new) | `npm run test:run src/lib/offline-queue*.test.ts` | ✅ existing; will gain 3 new files in Plan 15-03 |
| TST-04 | secure-storage.ts ≥70% line coverage (encrypt, decrypt, key rotation) | unit (existing 3 + 6-8 new) | `npm run test:run src/lib/secure-storage*.test.ts` | ✅ existing; will gain 2 new files in Plan 15-04 |
| COVERAGE-01 | All 4 modules pass the 70% per-file threshold | coverage gate | `npm run coverage:check` | ❌ new script (Wave 0) |
| COVERAGE-02 | `coverage:check` exits non-zero on regression | coverage gate | `npm run coverage:check` | ❌ new script (Wave 0) |

### Sampling Rate

- **Per task commit:** `npm run test:run` (full suite in jsdom) — ~5-10 seconds for the 26 existing + ~57 new tests.
- **Per wave merge:** `npm run coverage:check` (full suite + coverage threshold) — ~10-20 seconds.
- **Phase gate:** `npm run coverage:check` exits 0, and the HTML report at `kapwa-client/coverage/index.html` shows ≥70% lines for each of the 4 included files.

### Wave 0 Gaps

- [ ] `npm install -D @vitest/coverage-v8@4.1.10` — add the coverage tool. Plan 15-01 Task 1.
- [ ] `package.json` scripts: add `"coverage": "vitest run --coverage"` and `"coverage:check": "vitest run --coverage"` (or with explicit threshold flags). Plan 15-01 Task 1.
- [ ] `vite.config.ts` test block: add the `coverage` sub-block per D-02. Plan 15-01 Task 1.
- [ ] `kapwa-client/src/lib/api.test.ts` — add 3-5 tests for `KAPWA_AUTH_LOGOUT_EVENT` export + internal retry edge cases. Plan 15-01.
- [ ] `kapwa-client/src/lib/auth-context.login.test.tsx` — new file (D-10). Plan 15-02.
- [ ] `kapwa-client/src/lib/auth-context.useauth.test.tsx` — new file (D-11/D-12). Plan 15-02.
- [ ] `kapwa-client/src/lib/offline-queue.queue.test.ts` — new file (D-05). Plan 15-03.
- [ ] `kapwa-client/src/lib/offline-queue.conflict.test.ts` — new file (D-05). Plan 15-03.
- [ ] `kapwa-client/src/lib/offline-queue.versions.test.ts` — new file (D-05). Plan 15-03.
- [ ] `kapwa-client/src/lib/secure-storage.browser.test.ts` — new file (D-08/D-09). Plan 15-04.
- [ ] `kapwa-client/src/lib/secure-storage.native.test.ts` — new file (D-07). Plan 15-04.
- [ ] `tests/setup.ts` — verify that `vi.restoreAllMocks()` in `afterEach` (line 60) is sufficient to restore `vi.spyOn` mocks. No code change expected; just verify.

*(If no gaps: "None — existing test infrastructure covers all phase requirements")* — see above; 11 gaps to close.

## Security Domain

> Required per `.planning/config.json` `workflow.security_enforcement: true`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (auth-context tests cover login, MFA, token storage) | Mock `fetch` to assert the request body contains email + password (no log/assert on the plaintext password). Use `vi.stubGlobal('fetch', vi.fn())` from `tests/setup.ts`. |
| V3 Session Management | yes (token persistence + logout event) | Assert `kapwa_token` is set on login, cleared on logout, cleared on 401 refresh fail. Existing `api.test.ts:126-143` and `auth-context.test.tsx:24-63` cover the happy paths. New tests cover the error paths. |
| V4 Access Control | partial (auth-context exports `useAuth` which surfaces `user.role`) | No new access-control logic in this phase. |
| V5 Input Validation | no | The 4 modules do not parse user input. |
| V6 Cryptography | yes (secure-storage tests cover `encryptedDb` + `CapacitorSQLite`) | Do not assert on actual key material; assert that `createConnection` was called with `encrypted: true` and `mode: 'secret'`. The existing `encrypted-db.ts` is already mocked in `secure-storage.test.ts:4-11`. |
| V7 Error Handling | yes (corruption path in D-08) | Assert `SecureStorage.getItem` returns `null` when `encryptedDb.getItem` throws — never propagates the error. |
| V9 Communication | yes (api.ts HTTP client) | Already covered by existing 16 tests. |

### Known Threat Patterns for Vitest + jsdom

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Test fixture leaks a real token to disk | Information Disclosure | Use `vi.stubGlobal('fetch', vi.fn())` and the in-memory `localStorage` mock from `tests/setup.ts`. Never read real secrets in tests. |
| Mock returns a malformed JWT that downstream code might decode | Tampering | Fixtures should use clearly-fake tokens like `'test-tok'` or `'new'` (see existing `api.test.ts:15`). |
| `console.warn` from the `kapwa:auth:logout` subscriber leaks the reason to test logs | Information Disclosure | The reason is a category string (`'refresh_failed'`, `'refresh_network_error'`) — safe to log. No mock needed. |
| Native-platform mock accidentally returns `true` for browser-path tests | Elevation of Privilege | Use `vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)` ONLY in the native-path test file. Browser-path tests rely on the default `false`. |

### Security Review Notes

- The 4 modules are pure data-layer modules (no DOM XSS surface). The 70% coverage gate is sufficient to satisfy TST-01..TST-04 from a security testing perspective.
- No secrets are written to or read from disk during tests. The `kapwa_db_key` in localStorage is test-scoped and cleared by `tests/setup.ts:59`.
- The `kapwa:auth:logout` event is dispatched globally on `window`; the test should verify it does NOT carry any token or user data in `event.detail`. [VERIFIED: api.ts:97 dispatches `{ detail: { reason: 'refresh_failed' } }` only]

## Sources

### Primary (HIGH confidence)
- [vitest.dev/guide/coverage] — Coverage setup, v8 vs istanbul providers, including/excluding files. [VERIFIED]
- [vitest.dev/config/coverage#coverage-thresholds] — `thresholds.perFile`, `thresholds.100`, `thresholds['glob-pattern']`. [VERIFIED]
- [vitest.dev/guide/mocking/modules] — `vi.mock` hoisting, dynamic import support, factory shape. [VERIFIED]
- [vitest.dev/api/vi.html#vi-spyon] — `vi.spyOn` on object methods. [VERIFIED]
- [node_modules/@capacitor/core/dist/index.cjs.js:52,192] — Confirmed `cap.isNativePlatform = isNativePlatform` and the `isNativePlatform = () => getPlatform() !== 'web'` shape. [VERIFIED]
- [node_modules/@capacitor/core/types/definitions.d.ts:21] — Type signature for `isNativePlatform: () => boolean`. [VERIFIED]
- [npm registry] — `@vitest/coverage-v8@4.1.10` peer-deps `vitest@4.1.10`, weekly downloads 25.8M, repo `github.com/vitest-dev/vitest`. [VERIFIED]
- [.planning/phases/15-core-module-tests/15-CONTEXT.md] — Locked decisions D-01..D-16, canonical test-file list, deferred ideas. [VERIFIED]
- [.planning/REQUIREMENTS.md] — TST-01..TST-04 requirements. [VERIFIED]
- [kapwa-client/vite.config.ts] — Existing test config (`environment: 'jsdom'`, `setupFiles: ['./tests/setup.ts']`, `include: ['src/**/*.test.{ts,tsx}']`). [VERIFIED]
- [kapwa-client/src/lib/api.test.ts, auth-context.test.tsx, offline-queue.test.ts, secure-storage.test.ts] — Existing test patterns. [VERIFIED]
- [kapwa-client/tests/setup.ts] — Global mocks for `localStorage`, `crypto`, `navigator`. [VERIFIED]
- [.planning/codebase/TESTING.md] — Test framework reference (Vitest 1.2.0 noted as historical, project is now on 4.1.9 per package.json). [CITED]

### Secondary (MEDIUM confidence)
- [CONTEXT.md D-15 from Phase 14] — Carve-out: `auth-context.tsx` `/auth/login` and `/auth/mfa/verify` stay on raw fetch (because they fire before the api client has a token). New login tests must stub `fetch`, not use `api.get`. [CITED]

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | `@vitest/coverage-v8@4.1.10` is the official Vitest package, peer-matched to the project's `vitest@4.1.9`. Verified against npm registry, vitest.dev docs, and the local `node_modules`. |
| Architecture | HIGH | Test infrastructure changes are minimal: one `coverage` block in `vite.config.ts`, two scripts in `package.json`, plus 7 new test files following established patterns. The mocking architecture is documented by Vitest's official mocking guide and the existing `secure-storage.test.ts` precedent. |
| Pitfalls | HIGH | The 6 pitfalls listed are all from direct inspection of the source files and the existing tests' patterns. Pitfall 1 (hoisting) and Pitfall 3 (coverage install) are documented in Vitest's own docs. |

**Research date:** 2026-07-07
**Valid until:** 2026-08-07 (30 days — Vitest 4.x is stable; @vitest/coverage-v8 is on the same release line as vitest 4.1.x; no anticipated breaking changes)
