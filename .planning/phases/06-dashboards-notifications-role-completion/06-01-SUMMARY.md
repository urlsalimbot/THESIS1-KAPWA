---
phase: 06-dashboards-notifications-role-completion
plan: 01
status: complete
completed_at: '2026-06-26'
commits:
  - 4b352c6 feat(06-01): add consent-gating service, preference endpoints, and tests
  - 5861446 feat(06-01): add notification preference toggle UI to claimant dashboard
task_count: 3
tasks_completed: 3
test_results:
  suites: 1
  tests: 16
  passed: 16
  failed: 0
---

## Plan 06-01: Notification Consent Gating — Complete

### What was built

1. **Task 1 (pre-existing):** `NotificationPreference` entity, `consentSkipped` column on `Notification`, DB migration `20260624000001-NotificationPreferences.ts`
2. **Task 2 — Backend:** Consent-gating methods (`checkConsent`, `sendWithConsent`, `getPreferences`, `setPreference`) on `NotificationsService`, GET/PUT `/notifications/preferences` endpoints on `NotificationsController`, `UpdatePreferenceSchema` DTO, module registration, and 6 new tests (16 total, all passing)
3. **Task 3 — Frontend:** Notification preference toggle grid on `ClaimantDashboardPage` with per-channel (SMS, In-App) × per-category (case_update, approval, disbursement, sync_conflict, system) toggles, system category locked with lock icon, save button with dirty-state tracking and success/loading feedback

### Key design decisions honored
- D-04: Per-channel + per-category consent toggles
- D-05: Notification preferences in existing consent hub
- D-06: Notification record always created; consentSkipped=true when blocked
- D-07: System category always bypasses consent checks

### Test results
- 16/16 tests passing (all notification tests)
- Server build: OK

### Files created
- `kapwa-server/src/notifications/notification-preference.entity.ts` (pre-existing)
- `kapwa-server/src/notifications/dto/notifications.zod.ts`

### Files modified
- `kapwa-server/src/notifications/notifications.service.ts` — added consent methods
- `kapwa-server/src/notifications/notifications.controller.ts` — added preference endpoints
- `kapwa-server/src/notifications/notifications.module.ts` — registered NotificationPreference
- `kapwa-server/src/notifications/notifications.service.spec.ts` — added consent tests
- `kapwa-client/src/lib/api.ts` — added notification preference API functions
- `kapwa-client/src/pages/ClaimantDashboardPage.tsx` — added toggle grid

### Human verification needed
1. Run migration: `cd kapwa-server && npx typeorm-ts-node-commonjs migration:run -d src/database/data-source.ts`
2. Start server/client, login as claimant, verify toggle grid appears and save works
3. Trigger a notification → verify system alerts always deliver, others respect consent
