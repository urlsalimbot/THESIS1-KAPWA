# KAPWA Client — Settings Page Design

## Status: Approved

## Problem

The kapwa-client has no unified settings page. MFA configuration lives at `/settings/mfa` as a standalone page, there is no UI for changing password or email, and notification preferences (though supported server-side) have no configuration interface.

## Design

A single tabbed `/settings` page accessible to all authenticated roles.

### Tabs

#### 1. Profile
- Display current email, role, full name (read-only fields)
- **Change email**: form with new email + current password
- **Change password**: form with current password + new password + confirm new password
- Toast feedback on success/error

#### 2. Security
- Reuses the full MFA/TOTP flow from the existing `MfaSetupPage.tsx`
- States: idle (not enabled → "Set Up MFA" button), setup (show secret + verify code), enabled (show status + disable with password)

#### 3. Notifications
- Matrix of toggle switches: channel columns (`in_app`, `sms`) × category rows (`case_update`, `approval`, `disbursement`, `chat`, `sync_conflict`, `system`)
- Load current preferences on mount via `GET /notifications/preferences`
- Each toggle calls `PUT /notifications/preferences` (individual update) or bulk save via new bulk endpoint
- Show/hide `sms` toggles based on whether user has a phone number on their profile

### Server-Side Changes

| Endpoint | Method | Purpose | Auth | Body |
|---|---|---|---|---|
| `/auth/change-password` | POST | Change own password | JWT | `{ currentPassword, newPassword }` |
| `/auth/change-email` | POST | Change own email | JWT | `{ newEmail, currentPassword }` |
| `/notifications/preferences` (bulk) | PUT | Bulk update preferences | JWT | `[{ channel, category, optedIn }]` |

### Client-Side Changes

| File | Change |
|---|---|
| `src/pages/SettingsPage.tsx` | New — tabbed page with Profile / Security / Notifications tabs |
| `src/pages/MfaSetupPage.tsx` | Unchanged — kept for backward compat; Security tab in SettingsPage inlines the same flow |
| `src/routes.tsx` | Add `/settings` route; redirect `/settings/mfa` → `/settings` |
| `src/lib/nav-config.tsx` | Replace `/settings/mfa` with `/settings` in sidebar nav |
| `src/components/Topbar.tsx` | Change "MFA Settings" dropdown item to "Settings" |
| `src/lib/query-keys.ts` | Add `notifications.preferences` key |
| `kapwa-server/src/auth/auth.controller.ts` | Add `changePassword`, `changeEmail` endpoints |
| `kapwa-server/src/auth/auth.service.ts` | Implement `changePassword`, `changeEmail` |
| `kapwa-server/src/auth/dto/auth.zod.ts` | Add `ChangePasswordSchema`, `ChangeEmailSchema` |
| `kapwa-server/src/notifications/notifications.controller.ts` | Add bulk preferences endpoint |

### Data Flow

- **Profile tab**: direct `api.post` calls to `/auth/change-password` / `/auth/change-email` with `useSWRMutation`
- **Security tab**: mirrors existing MfaSetupPage flow (3-step: setup → verify → done)
- **Notifications tab**: `useSWR` fetches preferences on mount, individual toggles use `useSWRMutation` for optimistic updates

### Error Handling

- Server returns 400 with descriptive message on validation failures (wrong password, duplicate email, weak password)
- Client shows inline error messages per field + toast for unexpected errors
- Password/email changes re-authenticate the user (token stays valid — no re-login needed)

## Non-Goals

- Profile photo upload (no server endpoint exists)
- Two-factor recovery codes (not in current TOTP implementation)
- Notification template customization
- Audit log of settings changes

## Out of Scope for v1

- SMS phone number management (no self-service endpoint yet)
- Language/locale preferences
- Session management (view active sessions, force logout)
