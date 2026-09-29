# Team Workspace — Shared Schedule, Events, Whereabouts & Achievements

Date: 2026-09-29 · Status: **approved design** · Branch: `feat/team-workspace`

A central space for the MSWDO Norzagaray office: social workers and the
admin share a Google-Calendar-style schedule, the office schedules internal
events, staff broadcast their current whereabouts as self-set status
markers, and every staff member can see the past achieved work of the whole
team, derived automatically from the system's own data.

## Goals

- One place to answer: "where is everyone, what is happening this week,
  and what did the team accomplish?"
- Zero extra data-entry burden for achievements — they are computed from
  existing case, intervention, referral, and filing records.
- Internal by default: nothing here is public. Optional per-event
  visibility to Barangay Coordinators.
- Offline-capable and self-hosted like the rest of the app (no external
  calendar services).

## Roles & Permissions

| Role | Schedule blocks | Events | Status | Achievements |
|---|---|---|---|---|
| admin | full CRUD, including blocks for other staff | full CRUD (all) | set own | read all |
| social_worker | CRUD own rows | CRUD own; view all | set own | read all |
| coordinator | read-only | read-only (visible_to = staff_coordinators only) | view | read all |
| claimant | no access | no access | no access | no access |

Enforced server-side in the controller; the client hides edit affordances
for roles that cannot use them.

## Data Model

Three tables in a new `team` domain module. Schema changes ship in BOTH a
TypeORM migration and the idempotent `migrate.ts` bootstrap, per repo
convention (next sequential migration key `…0000000000067`).

### `team_schedule_blocks`

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid fk users | staff the block belongs to |
| block_date | date | single-day blocks (multi-day = multiple rows in v1) |
| block_type | enum | `in_office` `home_visit` `field_day` `on_leave` `remote` |
| start_time / end_time | time nullable | optional bounds (08:00–12:00) |
| note | text nullable | |
| created_by | uuid fk users | admin may create for others |
| updated_at | timestamptz | |

### `office_events`

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| title | text | |
| starts_at / ends_at | timestamptz | supports multi-day events |
| repeat_rule | jsonb nullable | `{ freq: 'weekly', interval: 1, until }` — expanded client-side |
| visible_to | enum | `staff` (default) \| `staff_coordinators` |
| location | text nullable | |
| owner_id | uuid fk users | scheduler |
| notes | text nullable | |
| updated_at | timestamptz | |

### `team_status`

One active whereabouts marker per staff member; last-write-wins upsert.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid fk users | unique |
| status | enum | `in_office` `home_visit` `field_day` `on_leave` `remote` `offline` |
| note | text nullable | e.g. "Barangay Bigte — FDS session" |
| updated_at | timestamptz | |

## API (`/api/v1/team/*`)

- `GET /team/schedule?from=&to=` — merged week payload: blocks + events.
- `POST /team/blocks` · `PATCH /team/blocks/:id` · `DELETE /team/blocks/:id`
- `POST /team/events` · `PATCH /team/events/:id` · `DELETE /team/events/:id`
- `GET /team/status` (own) · `PUT /team/status` · `GET /team/statuses` (team)
- `GET /team/achievements?from=&to=` — per-staff derived rollup.

Coordinator payloads are filtered server-side: only events with
`visible_to = staff_coordinators`; blocks for their office team.

## Achievements Aggregation

`GET /team/achievements` returns `{ perStaff: [{ userId, name, cases,
interventions, referrals, docs, trackerDays }], range }`, counted from
existing tables within the inclusive range:

- **cases served**: `case_history` rows where actor = staff in range
  (authoritative). Fallback when an entry lacks an actor: count it under the
  case's `assigned_worker_id` (the entry itself must still fall within range).
- **interventions**: `case_interventions.created_by` in range.
- **referrals**: `case_referrals.created_by` in range.
- **documents issued**: `document_vault.uploaded_by` in range
  (approval_document + requirement categories).
- **tracker days**: distinct dates within range on which the staff has
  `case_history` entries (same actor rule as cases served).

## Realtime Whereabouts

Status changes broadcast over the existing notifications WebSocket
(`team.status.updated` on room `team`). Staff and coordinators subscribe;
status chips update live. Schedule/events CRUD uses plain SWR
revalidation — no push needed.

## Client UX (Google-Calendar-shaped)

New top-level nav item **Team Workspace** (`/team`, roles:
admin/social_worker/coordinator). View switcher **Week / Month / Agenda**,
Today button, prev/next, filter-by-staff, new-entry button; left sidebar
mini-month + upcoming agenda.

- **Week view**: staff = resource rows down the left; hour-grid per day;
  blocks render as color-coded time bars; office events on a shared
  all-day strip + timed chips (distinct stroke). Click empty slot →
  create with prefilled staff/time; click bar → edit popover;
  v1 has no drag-and-drop (follow-up).
- **Month view**: compact cells with event chips + per-staff block dots;
  legend.
- **Agenda view**: chronological block + event list, groupable by day.
- **My status** quick-set in the header; status chips shown across views.
- **Staff view**: per-staff cards (avatar, name, live status, note) and the
  selected staff's achievements card with range picker (default current
  week).
- Mobile: week collapses to a single-day staff agenda.

Block colors: in-office blue/primary, home-visit green, field amber,
leave gray, remote violet. Strings i18n en+fil, parity-clean.

## Edge Cases

1. Multi-day blocks = multiple single-day rows (v1); drag/resize follow-up.
2. `on_leave` block does NOT auto-set status; status is always manual.
3. Multi-day events render with a continuation chip across days.
4. Repeat events stored once; editing an instance edits the series (v1).
5. Deletes are hard deletes + audit log entry (`team.block.delete`,
   `team.event.delete`) via the existing audit logger.
6. Weeks start Monday; `from`/`to` ISO dates, inclusive server-side.
7. All timestamps UTC, rendered Asia/Manila.
8. Concurrent status writes: last-write-wins upsert on unique `user_id`.
9. Role guards in the controller; client mirrors affordances only.
10. Claimant route guard returns 404/redirect, never data.

## Out of Scope (v1)

Public events (announcements module remains the public surface), calendar
drag/resize, single-instance repeat overrides, approval flows for leave,
GPS tracking, external calendar sync.

## Key Files (target)

- Server: `src/team/team.module.ts`, `team.controller.ts`,
  `team.service.ts`, entities `*.entity.ts`, migration
  `…0000000000067`, `migrate.ts` bootstrap.
- Reuse: notifications gateway for status push; audit logger.
- Client: `src/pages/TeamWorkspacePage.tsx`, `src/components/team/*`,
  nav-config entry, routes, i18n en/fil.