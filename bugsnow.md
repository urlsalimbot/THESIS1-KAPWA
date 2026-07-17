🐛 BUG#1 — CRITICAL: Service Worker crashes React (hard refresh = blank page)

kapwa-client/src/main.tsx:6-9 — SW serves stale Vite deps → duplicate React instances → useState null crash.
🐛 BUG#2 — MEDIUM: Login form handleSubmit not triggered by automation

kapwa-client/src/pages/LoginPage.tsx:34-44 — React Hook Form doesn't register programmatic .fill(). Requires manual dispatchEvent(new Event('input'/'change'/'blur')) workaround.
🐛 BUG#3 — HIGH: API 429 rate limiter destroys auth session

kapwa-client/src/components/ProtectedRoute.tsx:29-35 — /api/auth/me 429 → getCurrentUser() returns null → token cleared → redirect to login. A transient rate limit should not wipe the session.
🐛 BUG#4 — MEDIUM: "Mark Disbursed" shown on already-disbursed cases

Approval pipeline shows disbursal actions on disbursed items.
🐛 BUG#5 — LOW: Seed data "Last sync: 463d ago"

kapwa-server/src/database/seed-comprehensive.ts — stale timestamp.
🐛 BUG#6 — LOW: WebSocket "Invalid token" errors on every page

chat-socket.ts:12, notification-socket.ts:13 — WS connects before token is ready.
🐛 BUG#7 — MEDIUM: Wrong role-specific homepage after login

kapwa-client/src/pages/LoginPage.tsx:39 — Hardcodes navigate('/dashboard') for ALL users. Should use roleRedirectMap:

    claimants → /my-dashboard
    mayor → /reports
    auditor → /audit-logs
    admin → /admin
    coordinator → /coordinator

🐛 BUG#8 — CRITICAL: Coordinator OTP login completely broken

kapwa-server/src/auth/auth.service.ts:59 returns { otpRequired: true, ... } but kapwa-client/src/lib/auth-context.tsx:71 checks data.mfaRequired (which is undefined). The coordinator never sees the OTP challenge screen — login silently fails with no error shown. This is a field name mismatch between server and client.
🐛 BUG#9 — LOW: Auth state leaks between test sessions

Sequential logins in the same SPA session fail because AuthProvider retains stale React state after localStorage.clear().
🐛 BUG#10 — LOW: User name not displayed anywhere in UI

Dashboard header shows role label ("MSWDO Social Worker") but never the logged-in user's name. The user.fullName from AuthContext is available but not rendered in the header/sidebar.
🐛 BUG#11 — MEDIUM: 429 rate limiter hit during normal app operation

/api/auth/me called on every ProtectedRoute mount and fetchUser() re-run, easily hitting 60 req/min limit during development with rapid navigation.