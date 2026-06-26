# 06-03-SUMMARY: Coordinator Role (SMS OTP 2FA + Dashboard + Route)

## What Was Built

1. **SMS OTP 2FA for Coordinator login** — `AuthService.login()` now detects `coordinator` role and sends SMS OTP via `OtpService.requestOtp()`. Returns `{ otpRequired: true, tempToken, phone }`. New `verifySmsOtp()` endpoint at `POST /auth/login/otp-verify`.

2. **CoordinatorDashboardPage** — Stats cards (served today, pending cases, tracker entries, messages), quick case search by ID, today's tracker entries table.

3. **Coordinator route + nav** — `/coordinator` route gated by `coordinator` role. Nav item "Coordinator" visible only to coordinators.

## Files Changed

| File | Change |
|------|--------|
| `kapwa-server/src/otp/otp.module.ts` | Register OtpService + SmsGatewayService as providers, export for AuthModule |
| `kapwa-server/src/auth/auth.module.ts` | Import OtpModule |
| `kapwa-server/src/auth/auth.service.ts` | Inject OtpService; modify `login()` for coordinator OTP flow; add `verifySmsOtp()` |
| `kapwa-server/src/auth/auth.controller.ts` | Add POST `/auth/login/otp-verify` |
| `kapwa-server/src/auth/dto/auth.zod.ts` | Add OtpVerifySchema |
| `kapwa-server/src/auth/auth.service.spec.ts` | Add 6 SMS OTP tests (13 total) |
| `kapwa-client/src/pages/CoordinatorDashboardPage.tsx` | NEW: coordinator dashboard with stats, case search, tracker |
| `kapwa-client/src/routes.tsx` | Add `/coordinator` route |
| `kapwa-client/src/components/Layout.tsx` | Add Coordinator nav item |

## Tests

All 13 auth service tests pass, 229 total server tests pass. Client builds clean.
