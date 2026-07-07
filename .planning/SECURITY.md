# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.x     | ✅ Active support  |

## Reporting a Vulnerability

Use **GitHub Private Vulnerability Reporting** on the repository. Include:

1. **Version** — the release tag or commit SHA where the issue was found
2. **Description** — brief summary of the vulnerability
3. **Reproduction steps** — minimal steps, payload, or proof-of-concept
4. **Impact** — what an attacker could achieve
5. **Suggested fix** (optional)

Maintainers aim to acknowledge receipt within **5 business days** and provide an initial assessment within **10 business days**.

---

## Security Architecture

Kapwa uses **JWT bearer authentication** with short-lived access tokens (1 hour) and long-lived refresh tokens (7 days) with rotation. Every protected endpoint enforces **Attribute-Based Access Control (ABAC)** with these roles:

- `admin` — Full system access, user management, program configuration
- `social_worker` — Case management, intake, interventions, IRF submission
- `intake_officer` — Beneficiary intake and initial assessment
- `auditor` — Read-only audit logs, hash-chain verification, consent ledger
- `mayor` — Aggregate data views only (no PII)
- `barangay_coordinator` — Single-barangay scope, SMS OTP auth + mobile PWA
- `claimant` — Self-service dashboard, status tracker, service history

Tokens are stored in `localStorage` and attached as `Authorization: Bearer <token>` on every API request.

---

## Authentication Flow

```
Client                          Server
  |                                |
  |--- POST /api/auth/login ------>|
  |<---- { accessToken,           |
  |        refreshToken,          |
  |        user }                 |
  |                                |
  |  Store tokens in localStorage  |
  |  (kapwa_token, refresh_token)  |
  |                                |
  |--- GET /api/protected ---------|
  |    Authorization: Bearer ...   |
  |<---- 200 OK / resource -------|
```

---

## Token Refresh Flow (SEC-01)

The 401 single-flight refresh interceptor is implemented in `kapwa-client/src/lib/api.ts:80-134`. It deduplicates concurrent 401 responses so only one `/auth/refresh` call is in-flight at any time.

```
Client                          Server
  |                                |
  |--- GET /api/resource --------->|
  |<---- 401 Unauthorized ---------|
  |                                |
  |  Check refreshInFlight         |
  |  (single-flight guard)         |
  |                                |
  |--- POST /api/auth/refresh ---->|  (raw fetch — NOT through api client)
  |    { refreshToken }            |
  |<---- { accessToken,           |
  |        refreshToken }          |
  |                                |
  |  Store new tokens              |
  |  Retry original request        |
  |                                |
  |--- GET /api/resource --------->|  (retry with new access token)
  |<---- 200 OK / resource --------|

  --- Failure path ---

  |<---- 401 on /auth/refresh -----|
  |                                |
  |  Clear both tokens from        |
  |  localStorage                  |
  |  Dispatch kapwa:auth:logout    |
  |  CustomEvent                   |
  |                                |
  |  auth-context.tsx:36-43        |
  |  subscriber catches event      |
  |  → clears user state          |
  |  → redirects to /login        |
```

**Key implementation details:**

- `refreshToken()` at api.ts:80-117 uses a `refreshInFlight` module-level variable (`Promise<boolean> | null`) for single-flight dedup
- When a 401 arrives on the original request, `executeWithRetry` (api.ts:119-146) calls `refreshToken()` exactly once via the `isRetry` flag
- The refresh call uses raw `fetch()` — NOT the api client — to avoid the circular dependency of calling a protected endpoint to refresh the auth token
- On network error during refresh, both tokens are cleared and the logout event fires with reason `refresh_network_error`
- The `auth-context.tsx:36-43` subscriber logs the reason and calls `logout()` which clears token + user state
- WebSocket connection failure also triggers the `/login` redirect via AGENTS.md contract

---

## Threat Model

| Threat | Description | Mitigation |
|--------|-------------|------------|
| **Replay attack** | Attacker captures a JWT and replays it before expiry | 1h short-lived access tokens limit the window; HTTPS prevents capture in transit |
| **CSRF** | Cross-site request forgery via cookies | N/A — Kapwa uses Bearer tokens in headers, not cookies; no cookie-based auth |
| **XSS via token theft** | Attacker extracts tokens from localStorage via XSS | CSP headers configured; React auto-escaping prevents injection; no `dangerouslySetInnerHTML` in production code |
| **MITM on refresh endpoint** | Attacker intercepts `/auth/refresh` response | HTTPS enforced for all API endpoints; VITE_API_URL must use HTTPS in production |
| **Token rotation bypass** | Stolen refresh token reused after rotation | Server tracks `tokenVersion` on User entity; old refresh tokens are invalidated on rotation |

---

## Manual Verification (SEC-01)

Follow these steps to verify the 401 single-flight refresh interceptor is working:

1. **Login** as any user (e.g., `social_worker`)
2. **Open DevTools** → Application → Local Storage → find `kapwa_token`
3. **Replace** `kapwa_token` value with an expired JWT (paste any expired token or set to `eyJhbGciOiJIUzI1NiJ9.e30.ZXJyb3I`)
4. **Navigate** to any protected page (e.g., Dashboard, Cases)
5. **Verify in DevTools** → Network tab:
   - One `POST /api/auth/refresh` request fires
   - The original request retries with the new access token
   - Page loads successfully (no redirect to /login)
6. **For the failure path:** Set both `kapwa_token` and `refresh_token` to expired values → navigate to any protected page → verify:
   - Refresh returns 401
   - Both tokens are cleared from localStorage
   - Page redirects to `/login`
   - Console shows: `Auth logout triggered: refresh_failed`

Reference: ROADMAP #6 success criterion.

---

## Integration Test Coverage

The SEC-01 contract is covered by 4 tests in `kapwa-client/src/lib/api.test.ts:82-143`:

1. **refreshes once and retries the original on 401 then 200** (line 83) — Verifies that a single 401 triggers a refresh call and the original request is retried successfully with the new access token.
2. **shares a single in-flight refresh across concurrent 401s** (line 99) — Three concurrent requests all receive 401; exactly one `/auth/refresh` call is made (single-flight dedup verified).
3. **does not loop — when refresh itself 401s, throws ApiError(401) and dispatches logout event** (line 126) — Verifies loop-breaking: when the refresh endpoint itself returns 401, the original error is thrown and `kapwa:auth:logout` event is dispatched.
4. **logout event dispatching** (implied by test 3) — Verifies the `CustomEvent` payload and that both tokens are cleared from localStorage.

To run these tests in isolation:

```bash
npx vitest run src/lib/api.test.ts
```
