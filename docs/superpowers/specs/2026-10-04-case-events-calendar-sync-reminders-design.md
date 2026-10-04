# Case Events, Calendar Sync, and Reminders — Design

Date: 2026-10-04
Status: approved design (brainstormed section by section) — not yet implemented

## 1. Goal and scope

Give the team workspace and the case file one shared calendar of **upcoming case events**,
and remind the assigned worker before each one:

1. **Court hearings** (legal cases only) are recorded on the case and **synced to the team
   workspace calendar** as `court_hearing` blocks for the assigned worker.
2. **Planned home visits** (any case) are scheduled on the case and **synced to the team
   workspace calendar** as `home_visit` blocks for the assigned worker.
3. **Reminders** (in-app + email) are sent before each hearing/visit, with **configurable
   lead times**: system defaults set by the MSWDO Head (admin), overridable per worker.
4. Both features live **inside the existing CaseStepper architecture** — a new injected
   `court_hearings` step for legal categories; scheduled home visits live in the Evaluate
   step where the visit history already sits.

### Non-goals (later phases)

- **SMS reminders** — in-app + email only; SMS stays on the existing OTP/notification gateway.
- **Per-event reminder override** — lead times come from system defaults + worker overrides,
  never from the event form.
- **External court-calendar integration** — hearings are entered by workers, not imported.
- **Statutory deadlines** (the `court_hearings` step records actual hearings; the
  deadline engine stays Phase C of the case-architecture plan).

## 2. Recorded decisions (from the brainstorm)

| Question | Decision |
|---|---|
| Where hearings live | **New `case_events` child table** (event_type `court_hearing` \| `home_visit`); follow-up *history* stays in `case_follow_up_visits` |
| Court hearing storage | Full records on the case: date, time, venue, notes, attended flag |
| Legal categories | Hearings allowed on **CICL, VAWC, CNSP, Adoption & Foster Care Case, Indigency / Court-Ordered Social Case Study** |
| Attending semantics | `attended` is **nullable**; `NULL`/`false` = the office is **not attending** that hearing (no block, no reminders); `true` = attending (block + reminders) |
| Home-visit scheduling | "Schedule a home visit" on any case → future `home_visit` event; history ledger stays separate |
| Calendar sync | `team_schedule_blocks` gains `source` (`manual` \| `case_event`) + `source_ref`; **system-managed** synced blocks (API stays owner-only for manual blocks) |
| New block type | `BLOCK_TYPES` gains `court_hearing` (own color/icon in WeekView) |
| Reassignment | Case worker change **moves** synced blocks to the new worker |
| Reminder config | **System defaults per event type (admin) + optional worker overrides**; chained offsets (ordered list, e.g. 3d/1d/3h) |
| Reminder dedupe | `case_event_reminders(event_id, offset_minutes, channel)` unique row as the claim; failed email does not retry |
| Channels | In-app **always**; email **default-on** for the two new categories (absent pref row = opted in), opt-out via Settings |
| Stepper integration | New injected step key `court_hearings` in the legal-category templates; scheduled visits live in the Evaluate step UI |
| Notification categories | New `court_hearing` + `home_visit` values — **no DB enum DDL** (`notifications.category` is TEXT in the canonical bootstrap) |

## 3. Data model

All DDL ships twice: TypeORM migration `…0000000000083` **and** the idempotent mirror in
`src/database/migrate.ts` (per repo convention). No enum DDL needed.

### 3.1 `case_events` (new)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK (uuid_generate_v7()) | |
| `case_id` | uuid NOT NULL | FK → `cases(id)` ON DELETE CASCADE |
| `event_type` | varchar(32) NOT NULL | `court_hearing` \| `home_visit` (service-validated) |
| `attended` | boolean NULL | NULL/false = not attending (no sync/reminders); true = attending |
| `title` | text NULL | e.g. "Hearing — MSWD-2026-0012" default, editable |
| `venue` | text NULL | court/venue/barangay |
| `event_date` | date NOT NULL | |
| `start_time` | time NULL | |
| `end_time` | time NULL | |
| `notes` | text NULL | |
| `status` | varchar(32) NOT NULL DEFAULT 'planned' | `planned` \| `done` \| `cancelled` (service-validated) |
| `created_by` | uuid NULL | FK → `users(id)` |
| `created_at` / `updated_at` | timestamp | |

Indexes: `(case_id)`, `(event_date)`, `(status, event_date)`.

### 3.2 `team_schedule_blocks` extensions

- `source` varchar(32) NOT NULL DEFAULT `'manual'` — `manual` \| `case_event` (service-validated).
- `source_ref` uuid NULL — the `case_events.id` when `source='case_event'`; FK → `case_events(id)`
  ON DELETE SET NULL as a backstop (the service removes the block before deleting an event).
- `BLOCK_TYPES` gains `court_hearing` (varchar column — no DDL).

### 3.3 `case_event_reminders` (new, dedupe ledger)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `event_id` | uuid NOT NULL | FK → `case_events(id)` ON DELETE CASCADE |
| `offset_minutes` | int NOT NULL | which lead-time fired |
| `channel` | varchar(16) NOT NULL | `in_app` \| `email` |
| `sent_at` | timestamp NULL | NULL = claimed but delivery failed/not attempted |
| `created_at` | timestamp | |

Unique: `(event_id, offset_minutes, channel)` — the claim row.

### 3.4 `reminder_settings` (new)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `scope` | varchar(16) NOT NULL | `system` \| `worker` |
| `user_id` | uuid NULL | FK → `users(id)`; NULL when scope=system |
| `event_type` | varchar(32) NOT NULL | `court_hearing` \| `home_visit` |
| `offsets` | jsonb NOT NULL | ordered minutes array, strictly descending positive, e.g. `[4320, 1440, 180]` |
| `updated_by` | uuid NULL | |
| `created_at` / `updated_at` | timestamp | |

Uniqueness via partial indexes (system rows have NULL `user_id`, which a plain UNIQUE would
treat as distinct): unique on `(event_type)` WHERE `scope='system'` (one default per event
type), unique on `(user_id, event_type)` WHERE `scope='worker'`, plus a CHECK that
`user_id IS NULL` when `scope='system'` (and NOT NULL when `scope='worker'`).
Seeded in the migration: system defaults `court_hearing [4320, 1440, 180]`, `home_visit [1440, 180]`.

### 3.5 Notification vocabulary

- `NotificationCategory` enum += `COURT_HEARING = 'court_hearing'`, `HOME_VISIT = 'home_visit'`
  (TS-side only — no `ALTER TYPE`; the bootstrap creates `notifications.category` as TEXT).
- Client mirrors the enum + labels in both `en` and `fil` i18n.

## 4. Legal gating and attending semantics

- **Hearings** (`POST` with `event_type=court_hearing`) are rejected (`BadRequest`) unless
  `cases.case_category` ∈ `LEGAL_CATEGORIES`:
  `Children in Conflict with the Law (CICL)`, `Violence Against Women and Their Children (VAWC)`,
  `Children in Need of Special Protection (CNSP)`, `Adoption & Foster Care Case`,
  `Indigency / Court-Ordered Social Case Study`. Single source of truth in the server
  (`case-events.constants.ts`), mirrored in the client to hide/disable the section.
- **Attending:** `attended=true` → the office is going: block + reminders. `attended` `NULL`/`false`
  → not attending: **recorded in the case file only** (no calendar block, no reminders).
- Home visits have no `attended` gate — every planned `home_visit` syncs and reminds.

## 5. Stepper integration (client architecture preserved)

### 5.1 New injected step: `court_hearings`

- `case-step-labels.ts`: label `'Court Hearings'`, member of `KNOWN_STEP_KEYS`.
- `CATEGORY_STEP_TEMPLATES`: inject `court_hearings` between `assessment` and `enrollments` for
  the five legal categories. CNSP and Court-Ordered SCS currently fall back to `COMMON_STEPS` →
  they gain explicit template entries (`assessment, court_hearings, enrollments, interventions,
  referrals, evaluate, closure`).
- Step UI: new `StepCourtHearings.tsx` (list + add/edit/complete/cancel hearings; seals render
  exactly like the other category steps; gate on `attended`).
- Done predicate (in the lock service): ≥ 1 hearing row with `status != 'cancelled'`.
- Sealing works via the existing generic step-lock endpoint.

### 5.2 Scheduled home visits: Evaluate step

- `StepEvaluate` gains a **Scheduled home visits** area beside the existing visit history:
  list planned `home_visit` events; add; complete (marks `done`); cancel.
- History ledger (`case_follow_up_visits`) stays untouched — completion does **not** copy rows
  into the history (separate ledgers, no double-recording).

## 6. Sync engine

`TeamScheduleSyncService` (new, in `team/`): internal methods only — no controller routes.
Consumed by `CaseEventsService` (in `case-events/`).

- `upsertForEvent(event)` — creates/updates the block for the case's `assigned_worker_id`:
  `block_date=event_date`, `start_time/end_time` mapped, `block_type` = `court_hearing` | `home_visit`,
  `note` = `Case <controlNo> — <title> (<venue>)`, `source='case_event'`, `source_ref=event.id`,
  `visibleTo='team'`, `createdBy` = the event's `created_by`. No assigned worker → no block.
- `removeForEvent(eventId)` — delete by `(source='case_event', source_ref=eventId)`.
- **Owner-only rule:** the public team-schedule API continues to reject writes to blocks with
  `source='case_event'` (and stays owner-only for manual blocks); only the internal sync path
  writes synced blocks.
- **Reassignment:** when `cases.assigned_worker_id` changes, `CasesService` calls
  `moveForCase(caseId, oldWorkerId, newWorkerId)` — delete old worker's synced blocks, create
  for the new one.
- Idempotent: block looked up by `source_ref` before insert; every event mutation re-applies.

Lifecycle matrix (unit-tested): create → block appears (assigned worker); update → block
follows; cancel/delete → block removed; unassigned → no block; reassign → block moves;
hearing with `attended != true` → no block; direct API write to a synced block → 403/400.

## 7. Reminder engine

`CaseEventReminderService` (new, in `case-events/`) with `@Cron(CronExpression.EVERY_15_MINUTES)`
(mirrors the SLA cron pattern).

- Each tick: load `case_events` where `status='planned'` and (for hearings) `attended=true`;
  resolve lead times = worker override (`reminder_settings` scope=worker, user = assigned
  worker) else system default (scope=system); for each offset: `remind_at = event_datetime −
  offset`; dispatch when `remind_at <= now < event_datetime` and no `case_event_reminders` row
  for `(event_id, offset_minutes, channel)`.
- **Dedupe/claim:** insert the `case_event_reminders` row per channel BEFORE sending; set
  `sent_at` on success. Insert conflict on the unique key = already claimed, skip. A failed
  email leaves `sent_at` NULL and is **not retried** (documented; in-app is authoritative).
- **In-app (always):** `notificationsService.create` — category `court_hearing`/`home_visit`,
  `reference_id` = event id, recipient = assigned worker, message = control no + event type +
  date/time + venue.
- **Email (default-on):** preference resolution for these two categories: **absent row = 
  opted in**; explicit row = authoritative (`optedIn`). Email skipped when `EMAIL_HOST` not
  configured or the worker has no `users.email`. Delivery via `EmailService.sendNotificationEmail`
  (existing branded template).
- `now >= event_datetime` → no retroactive reminders; events whose `status` becomes `done` or
  `cancelled` stop generating new reminders.

## 8. API surface

| Route | Method | Role | Purpose |
|---|---|---|---|
| `/cases/:id/events` | GET | sw/coordinator/admin | List events (ordered by date) |
| `/cases/:id/events` | POST | sw/admin (+coordinator on assigned cases) | Create event; validates legal gate + zod |
| `/cases/:id/events/:eventId` | PATCH | sw/admin (+coordinator on assigned cases) | Edit fields / set status done/cancelled |
| `/cases/:id/events/:eventId` | DELETE | sw/admin (+coordinator on assigned cases) | Delete (removes block) |
| `/reminder-settings/system` | GET/PUT | admin only | System defaults per event type |
| `/reminder-settings/me` | GET/PUT | any staff | Worker overrides |

- Zod DTOs: dates YYYY-MM-DD, times HH:MM, offsets strictly descending positive ints,
  `event_type`/`status`/`scope` from closed vocabularies, `attended` nullable boolean.
- Write permissions mirror `cases.service` rules (assigned worker, coordinators for their
  barangay, admins); events created by anyone eligible on the case are still attached to the
  case's assigned worker for sync/reminders.

## 9. Client UI

- **`StepCourtHearings.tsx`** — hearings list + form (date, time, venue, attended toggle,
  notes) + complete/cancel; step seals; added to the stepper for legal categories only.
- **`StepEvaluate.tsx`** — "Scheduled home visits" area (add/complete/cancel); history section
  unchanged.
- **`WeekView.tsx`** — renders `court_hearing` blocks (own color/icon, distinct from
  `home_visit`); synced blocks display control no from the note; no editing affordances for
  synced blocks in the block editor.
- **`SettingsPage.tsx`** — "Reminder settings" card: admins edit system defaults per event
  type; workers edit their own overrides; offset chips (3 days / 1 day / 3 hours / custom);
  the existing notification-preferences grid gains the two new categories.
- i18n: every new string in `en` + `fil` (parity-enforced pattern).

## 10. Testing

- **Server:** case-events service (gating, CRUD, attended semantics), sync lifecycle matrix
  (§6), reminder service (offset resolution incl. worker override, dedupe idempotency via
  unique claim, done/cancelled/past skipped, in-app+email dispatch, email skipped without
  config/email), controller specs (roles, zod), prefs resolution (absent = opted-in for the
  two categories), migration apply (fresh boot + existing chain). Full `npx jest --silent` +
  `npm run typecheck`.
- **Client:** `StepCourtHearings`, `StepEvaluate` scheduled-visits area, `WeekView` new block
  type, `SettingsPage` reminder card, i18n parity. Full `npm run typecheck` + `npm run test:run`.
- **CI:** server build + jest, client vitest + coverage (existing pipeline untouched).

## 11. Delivery notes

- Migration `…0083` + `migrate.ts` mirror committed together; key-tie check before writing
  (max key today is `…0082`; never renumber).
- **Drive-by fix (included):** `sla.service.ts` still queries `p.waiting_period_days` (dropped
  by migration `…0081`) for ACTIVE cases — the raw SQL would throw on the 30-min tick once an
  ACTIVE case exists. Reworked to use the `APPROVED_*` constants fallback the comment already
  promises (and the program waiting period no longer exists).
- **ERD follow-up:** regenerate `docs/diagrams/06-erd.md` after the schema lands
  (case_events, team_schedule_blocks.source/source_ref, case_event_reminders, reminder_settings).
- Files: new `src/case-events/*` (entity, service, controller, module, dto, constants, specs),
  `src/team/team-schedule-sync.*`, team-schedule service/entity changes, notifications enum +
  prefs resolution, sla fix, client `StepCourtHearings`, `StepEvaluate`, `WeekView`, `SettingsPage`,
  i18n, case-catalog mirrors.