# Team Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Google-Calendar-shaped team workspace where MSWDO staff share schedules, office events, live whereabouts, and derived per-staff achievements.

**Architecture:** New `team` NestJS domain (3 tables, REST CRUD, read-only aggregates) + a client `/team` page with Week/Month/Agenda views, status quick-set, and a Staff view. Realtime status reuses the existing notifications WebSocket. Deploys through the existing self-hosted/AWS pipelines.

**Tech Stack:** NestJS 11 + TypeORM + Postgres, React 19 + Vite + Tailwind + SWR, existing socket.io gateway, Vitest/Jest.

**Spec:** `docs/superpowers/specs/2026-09-29-team-workspace-design.md`

## Global Constraints

- Roles: admin full CRUD (incl. others' blocks); social_worker CRUD own blocks, own events, view all; coordinator read-only, staff_coordinators events only; claimant no access (route returns 404 for them, never data).
- Schema changes land in BOTH a TypeORM migration (`…0000000000067` or next free key) AND idempotent `migrate.ts` bootstrap.
- All timestamps UTC, rendered Asia/Manila client-side; dates inclusive server-side; weeks start Monday.
- Block types: `in_office | home_visit | field_day | on_leave | remote`; status adds `offline`.
- New UI strings ship en+fil (`fil` never equals `en` outside the parity allowlist).
- Column/table names snake_case via the repo's snake-naming strategy; enums stored as varchar with TS enum + validation (matches `CaseStatus` pattern).
- Deletes are hard deletes + audit entries via existing audit logger (`team.block.delete`, `team.event.delete`).
- Hard deletes only; no soft-delete columns.

## Review Focus

- Coordinator schedule payload excludes staff-only events (server filter, not client).
- Worker editing another staff's block → 403; admin creating a block for another staff → 201.
- Status upsert with an invalid enum value → 400.
- Achievements: inclusive range boundaries; a staff with zero activity returns zeros, not an error.
- Status PUT emits `team.status.updated` over the notifications socket exactly once.
- Repeat expansion renders an event on each day of a week-spanning series.
- Claimant hitting `/team` → not-found redirect, no API call.
- Block/event delete writes an audit row.

---

### Task 1: Schema — migration + bootstrap

**Files:**
- Create: `kapwa-server/src/database/migrations/ZAddTeamWorkspace0000000000067.ts`
- Modify: `kapwa-server/src/database/migrate.ts` (append three CREATE TABLE IF NOT EXISTS + indexes next to other history-created tables)

**Interfaces:**
- Produces: tables `team_schedule_blocks`, `office_events`, `team_status` (spec field lists, camelCase columns snake_cased; enums as varchar).

- [ ] **Step 1: Write the migration file**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

// Team workspace: staff day blocks, internal office events, whereabouts status.
export class ZAddTeamWorkspace0000000000067 implements MigrationInterface {
  name = 'ZAddTeamWorkspace0000000000067';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS team_schedule_blocks (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        user_id uuid NOT NULL REFERENCES users(id),
        block_date date NOT NULL,
        block_type varchar(32) NOT NULL,
        start_time time NULL,
        end_time time NULL,
        note text NULL,
        created_by uuid NULL REFERENCES users(id),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_team_blocks_user_date ON team_schedule_blocks (user_id, block_date)`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS office_events (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        title text NOT NULL,
        starts_at timestamptz NOT NULL,
        ends_at timestamptz NOT NULL,
        repeat_rule jsonb NULL,
        visible_to varchar(32) NOT NULL DEFAULT 'staff',
        location text NULL,
        owner_id uuid NOT NULL REFERENCES users(id),
        notes text NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_office_events_start ON office_events (starts_at)`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS team_status (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        user_id uuid NOT NULL UNIQUE REFERENCES users(id),
        status varchar(32) NOT NULL,
        note text NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS team_status`);
    await queryRunner.query(`DROP TABLE IF EXISTS office_events`);
    await queryRunner.query(`DROP TABLE IF EXISTS team_schedule_blocks`);
  }
}
```

- [ ] **Step 2: Append the same DDL to `migrate.ts`** (outside the migrations-marking logic, where the other `CREATE TABLE IF NOT EXISTS` statements live), wrapped so a re-run is a no-op. Use identical statements.
- [ ] **Step 3: Verify both paths green**

Run: `npm run typecheck` (kapwa-server) — PASS, and `npx jest src/database/normalization-schema.spec.ts --silent` — PASS (schema invariants).

- [ ] **Step 4: Commit**

```bash
git add kapwa-server/src/database/migrations/ZAddTeamWorkspace0000000000067.ts kapwa-server/src/database/migrate.ts
git commit -m "feat(team): team workspace schema — blocks, events, status"
```

### Task 2: Entities + module wiring

**Files:**
- Create: `kapwa-server/src/team/team-schedule-block.entity.ts`, `office-event.entity.ts`, `team-status.entity.ts`, `team.module.ts`
- Modify: `kapwa-server/src/app.module.ts` (import TeamModule)

**Interfaces:**
- Produces: `TeamScheduleBlock`, `OfficeEvent`, `TeamStatus` TypeORM entities (snake_case columns, uuid v7 default like sibling entities), `TeamModule` exporting nothing yet.

- [ ] **Step 1: Write the three entities** mirroring a sibling entity (e.g. `CaseFollowUpVisit`): `@Entity('team_schedule_blocks')`, `@PrimaryColumn('uuid', { default: () => 'uuid_generate_v7()' }) id`, string enums as `@Column({ type: 'varchar', length: 32 })`, timestamps with `default: () => 'now()'`. `OfficeEvent.repeatRule` as `@Column({ type: 'jsonb', nullable: true }) repeatRule?: Record<string, unknown> | null`.
- [ ] **Step 2: Write `team.module.ts`** (`TypeOrmModule.forFeature([TeamScheduleBlock, OfficeEvent, TeamStatus])`, controllers/providers empty list for now) and import `TeamModule` into `app.module.ts`.
- [ ] **Step 3: Verify** `npm run typecheck` PASS.
- [ ] **Step 4: Commit** `git commit -m "feat(team): entities and module wiring"`.

### Task 3: Schedule blocks service+controller

**Files:**
- Create: `kapwa-server/src/team/team-schedule.service.ts`, `team-schedule.controller.ts`, `team-schedule.service.spec.ts`
- Modify: `kapwa-server/src/team/team.module.ts` (register controller + provider)

**Interfaces:**
- Produces: `TeamScheduleService.listBlocks(from: Date, to: Date, staffId?: string, requesterRole?: string, requesterBarangay?: string): Promise<TeamScheduleBlock[]>`; `createBlock(dto, requester): Promise<TeamScheduleBlock>` (403 unless admin or self); `updateBlock(id, dto, requester)` (403 unless admin or owner); `deleteBlock(id, requester, actorId)` (403 unless admin or owner; calls `audit.log('team.block.delete', id, actorId)`).
- Consumes: `TeamScheduleBlock` repo (inject via `@InjectRepository`).

- [ ] **Step 1: Failing tests** (spec file, mocked repo):

```ts
describe('TeamScheduleService', () => {
  it('403 when a worker creates a block for another staff', async () => {
    // requester { role:'social_worker', id:'w1' }, dto.userId 'w2'
    await expect(service.createBlock({ userId: 'w2', blockDate: '2026-10-01', blockType: 'in_office' } as any, workerReq) as any)
      .rejects.toThrow(/Forbidden|403/);
  });
  it('201 path: admin creates a block for another staff', async () => {
    // repo.create+save mocked; expected saved row returned with createdBy admin id
    const row = await service.createBlock({ userId: 'w2', blockDate: '2026-10-01', blockType: 'home_visit' } as any, adminReq);
    expect(repo.save).toHaveBeenCalled();
  });
  it('deleteBlock logs an audit entry', async () => {
    // owner deletes own block; assert audit.log called with ['team.block.delete', blockId, req.id]
  });
});
```

- [ ] **Step 2: Run → expect FAIL** (`npx jest team-schedule --silent`).
- [ ] **Step 3: Implement service** (enum validation via a `BLOCK_TYPES` const set against `dto.blockType`, `UnauthorizedException`/`ForbiddenException`, delete → `repo.delete` + audit).
- [ ] **Step 4: Controller** (`@Controller('team/blocks')`, `@Roles('admin','social_worker')` on unsafe verbs via the repo's RolesGuard, `@Get()` adds `@Roles('admin','social_worker','coordinator')`; for coordinators filter blocks to their office staff: resolve office staff ids the same way `access-cards.controller` resolves `sourceBarangay` (via `req.user.assignedBarangay`), selecting `user_id IN (SELECT id FROM users WHERE ...assignedBarangay = $barangay)` through the same relation the dashboard exists-filter uses; when `assignedBarangay` is null the coordinator gets an empty list (never all). Document the resolution in a code comment).
- [ ] **Step 5: Run tests → PASS**; `npm run typecheck`.
- [ ] **Step 6: Commit** `feat(team): schedule blocks CRUD with role guards`.

### Task 4: Events service+controller

**Files:**
- Create: `kapwa-server/src/team/office-events.service.ts`, `office-events.controller.ts`, `office-events.service.spec.ts`
- Modify: `kapwa-server/src/team/team.module.ts`

**Interfaces:**
- Produces: `OfficeEventsService.listEvents(from, to, requesterRole, requesterBarangay)` — coordinators only see `visible_to = 'staff_coordinators'`; `createEvent(dto, requester)` (admin/worker; owner=requester), `updateEvent(id, dto, requester)` (admin or owner), `deleteEvent(id, requester, actorId)` (admin or owner; audit `team.event.delete`).

- [ ] **Step 1: Failing tests**: coordinator list excludes staff-only event; updateEvent by non-owner worker → 403; createEvent persists repeatRule jsonb.
- [ ] **Step 2: Run → FAIL.** **Step 3: Implement** (varchar enum `visible_to` validated against `['staff','staff_coordinators']`; `starts_at <= ends_at` → 400 otherwise).
- [ ] **Step 4: Controller** (`@Controller('team/events')`, same role matrix as blocks; coordinator GET only).
- [ ] **Step 5: Tests PASS + typecheck.** **Step 6: Commit** `feat(team): office events CRUD with visibility gating`.

### Task 5: Status service+controller + WS emit

**Files:**
- Create: `kapwa-server/src/team/team-status.service.ts`, `team-status.controller.ts`, `team-status.service.spec.ts`
- Modify: `kapwa-server/src/team/team.module.ts`; `kapwa-server/src/notifications/notifications.gateway.ts` (add a public `broadcastTeamStatus(status)` method that emits to room `team`; keep the existing emit pattern)

**Interfaces:**
- Produces: `TeamStatusService.getMyStatus(userId)`, `setStatus(userId, { status, note? })` (validate enum incl. `offline`; upsert on unique user_id — `repo.upsert`), `listStatuses()`. After successful upsert the service calls Task 6's gateway `broadcastTeamStatus` (inject the notifications gateway directly if it is already exported by NotificationsModule, else add a tiny `TeamStatusGatewayBridge` provider in this task).
- Consumes: Task 7 gateway method.

- [ ] **Step 1: Failing tests**: invalid status value → 400/validation error; setStatus upserts (repo.upsert with conflict on user_id); listStatuses returns rows.
- [ ] **Step 2: FAIL → Step 3 implement → Step 4 controller** (`GET /team/status` self, `PUT /team/status`, `GET /team/statuses` roles staff+coordinator).
- [ ] **Step 5: Tests PASS; typecheck.** **Step 6: Commit** `feat(team): whereabouts status upsert + controller`.

### Task 6: Notifications gateway broadcast

**Files:**
- Modify: `kapwa-server/src/notifications/notifications.gateway.ts` (+ its spec if present)

**Interfaces:**
- Produces: `broadcastTeamStatus(payload: { userId: string; status: string; note?: string | null; updatedAt: string })` — emits `team.status.updated` to room `'team'`.

- [ ] **Step 1: Failing test** (mock server emit; subscribe a fake socket to room team; assert emit payload).
- [ ] **Step 2: FAIL → Step 3 implement** (mirror the gateway's existing room/emit helpers).
- [ ] **Step 4: PASS + typecheck → Step 5 commit** `feat(team): broadcast whereabouts over notifications socket` (squash with Task 5 if review prefers—keep separate for now).

### Task 7: Achievements service+controller

**Files:**
- Create: `kapwa-server/src/team/team-achievements.service.ts`, `team-achievements.controller.ts`, `team-achievements.service.spec.ts`
- Modify: `kapwa-server/src/team/team.module.ts`

**Interfaces:**
- Produces: `TeamAchievementsService.rollup(from: Date, to: Date): Promise<{ perStaff: Array<{ userId; name; cases; interventions; referrals; docs; trackerDays }>; range }>` — counts via raw SQL like `case_history` actor, `case_interventions.created_by`, `case_referrals.created_by`, `document_vault.uploaded_by` (categories `approval_document` + `requirement`), trackerDays = distinct dates with `case_history` rows; zero-filled per staff returned by `users` list query (staff roles only). Range inclusive (`created_at >= from AND created_at < to + 1 day`).

- [ ] **Step 1: Failing tests** (mock `dataSource.query`): range inclusive boundaries; zero-activity staff → zeros; counts per metric.
- [ ] **Step 2: FAIL → Step 3 implement** raw queries with `$1..$n` params (follow `getTrackerEntries` style, aliases snake_case in SQL).
- [ ] **Step 4: Controller** (`GET /team/achievements` roles staff+coordinator; coordinator read-only).
- [ ] **Step 5: PASS + typecheck → Step 6 commit** `feat(team): derived achievements rollup`.

### Task 8: Server integration gate

- [ ] **Step 1:** `npx jest --silent` full server suite PASS (expect ~99 → 104 suites), `npm run typecheck` PASS, `npx eslint` on `src/team/*` clean.
- [ ] **Step 2: Commit** `chore(team): server integration pass`.

### Task 9: Client API client + query keys + route + nav

**Files:**
- Modify: `kapwa-client/src/lib/query-keys.ts` (add `team: { schedule, events, status, statuses, achievements }` memoized keys), `kapwa-client/src/lib/nav-config.tsx` (add "Team Workspace" under Core group, roles `['admin','social_worker','coordinator']`, icon `CalendarDays`), `kapwa-client/src/routes.tsx` (lazy route `/team`, `Private roles=['admin','social_worker','coordinator']`)
- Create: `kapwa-client/src/lib/team-api.ts` — typed fns: `getSchedule(from,to)`, `createBlock`, `updateBlock`, `deleteBlock`, `createEvent`, `updateEvent`, `deleteEvent`, `getMyStatus`, `putStatus`, `getStatuses`, `getAchievements(from,to)` (thin `api.get/post/patch/del` wrappers)

**Interfaces:**
- Produces: named exports used by later tasks:
  `TeamBlock { id, userId, blockDate, blockType, startTime, endTime, note }`, `TeamEvent { id, title, startsAt, endsAt, repeatRule?, visibleTo, location?, notes? }`, `TeamStatus { userId, status, note, updatedAt }`, `AchievementsRollup { perStaff, range }`.

- [ ] **Step 1: Unit test team-api** (mock `@/lib/api`, assert paths + params for 4 fns).
- [ ] **Step 2: FAIL → Step 3 implement → PASS → Step 4: nav/route test** (render nav-config items for each role; routes config includes `/team` guarded).
- [ ] **Step 5: typecheck + commit** `feat(team): client api, query keys, route, nav`.

### Task 10: Page shell + views scaffolding

**Files:**
- Create: `kapwa-client/src/pages/TeamWorkspacePage.tsx`, `kapwa-client/src/components/team/WeekView.tsx`, `MonthView.tsx`, `AgendaView.tsx`, `TeamStatusBar.tsx`, `BlockEditorDialog.tsx`, `EventEditorDialog.tsx`, `StaffView.tsx`, `team-utils.ts` (week math: `weekStart(date)` Monday, `expandRepeat(event, from, to)`, `BLOCK_COLORS`)
- Modify: `kapwa-client/src/pages/TeamWorkspacePage.test.tsx` (new)

**Interfaces:**
- Produces: page owns `from/to` week state + SWR `getSchedule` + statuses; passes props: `WeekView({ blocks, events, from, staff, onSlotClick, onBlockClick })`, `MonthView({ events, blocks, from })`, `AgendaView({ blocks, events, staff })`, `TeamStatusBar({ statuses, myUserId, onSetStatus })`, editor dialogs with `onSave/onDelete` callbacks.

- [ ] **Step 1: team-utils tests** (weekStart Monday incl. Sunday input; expandRepeat weekly series across a 14-day window).
- [ ] **Step 2: FAIL → implement utils.**
- [ ] **Step 3: Page test**: renders switcher, week label, Today button, "New" disabled without selection; staff bar renders names.
- [ ] **Step 4: FAIL → implement** page shell + status bar (status dropdown calls `putStatus`, mutates `team.status` + `team.statuses` keys).
- [ ] **Step 5: PASS + typecheck → commit** `feat(team): page shell, week math, status bar`.

### Task 11: Week view (resource grid)

**Files:**
- Modify: `kapwa-client/src/components/team/WeekView.tsx`, `BlockEditorDialog.tsx`; test `WeekView.test.tsx`

- [ ] **Step 1: Tests**: renders staff rows + day columns; block bar with type color class; empty slot click → `onSlotClick(staffId, date)`; block click → `onBlockClick(block)`.
- [ ] **Step 2: FAIL → implement** (CSS grid: left staff column + 7 day columns; bars absolutely positioned by start/end time when set, else full-height; all-day event strip above grid; continuation chip for events spanning >1 day).
- [ ] **Step 3: editor test**: create dialog prefills staff+date; save calls `createBlock` then revalidates.
- [ ] **Step 4: implement dialog.** **Step 5: PASS + typecheck → commit** `feat(team): week resource grid with block editor`.

### Task 12: Month + Agenda views

**Files:**
- Modify: `MonthView.tsx`, `AgendaView.tsx`; tests `MonthView.test.tsx`, `AgendaView.test.tsx`

- [ ] **Step 1: Tests**: month cell shows event chip + staff block dots (legend maps type → dot color); agenda groups by day with type labels.
- [ ] **Step 2: FAIL → implement** (month: 6-week grid, dots = `BLOCK_COLORS[type]`; agenda: flat list sorted).
- [ ] **Step 3: PASS + typecheck → commit** `feat(team): month and agenda views`.

### Task 13: Events CRUD + visibility in UI

**Files:**
- Modify: `EventEditorDialog.tsx`, page wiring; test `EventEditorDialog.test.tsx`

- [ ] **Step 1: Tests**: edit dialog saves repeat rule (weekly) + visibility radio values; coordinator page hides "New event"/edit affordances (page prop `canEdit=false` for coordinators).
- [ ] **Step 2: FAIL → implement** (dialog fields per spec; page passes `canEdit = role !== 'coordinator'`).
- [ ] **Step 3: PASS + typecheck → commit** `feat(team): event editor with repeat + visibility`.

### Task 14: Realtime status + Staff view (achievements)

**Files:**
- Create: `kapwa-client/src/hooks/useTeamStatus.ts` (mirrors existing notification-socket hook pattern: connect namespace, listen `team.status.updated`, mutate `team.statuses`), modify `StaffView.tsx`, page; test `useTeamStatus.test.tsx`, `StaffView.test.tsx`

- [ ] **Step 1: Tests**: hook updates statuses cache on socket event; StaffView renders per-staff card (status chip + note) and achievements panel for selected staff with range picker (defaults current week), zero-count renders.
- [ ] **Step 2: FAIL → implement** (hook subscribes once; StaffView uses `getAchievements` SWR keyed by range+staff; range picker = week/month select shared with page).
- [ ] **Step 3: coordinator sees read-only StaffView (no status setter).**
- [ ] **Step 4: PASS + typecheck → commit** `feat(team): live status hook + staff achievements view`.

### Task 15: i18n + mobile + polish

**Files:**
- Modify: `kapwa-client/src/i18n/locales/en/index.ts`, `fil/index.ts` (team.* keys: view labels, block type labels, event fields, status labels, achievements labels, empty states, editor titles, `auth/nav` untouched), `kapwa-client/src/i18n/__tests__/fil-parity.test.ts` only if a legitimate identical key (proper noun) needs allowlisting; week view mobile branch (single-day staff agenda under `md:`)

- [ ] **Step 1: i18n test additions** (parity passes; new keys resolve in en).
- [ ] **Step 2: Add keys en+fil; wire components to `t()` (replace inline strings introduced in Tasks 10–14).**
- [ ] **Step 3: Mobile test** (week view renders agenda variant at width < 640 via matchMedia mock — use the setup's matchMedia stub).
- [ ] **Step 4: Full client suite** `npm run test:run` PASS + typecheck.
- [ ] **Step 5: Commit** `feat(team): i18n, fil parity, mobile agenda`.

### Task 16: Whole-branch verification + docs

- [ ] **Step 1:** Full server suite `npx jest --silent` PASS; full client suite PASS; both typechecks PASS; eslint clean on touched files.
- [ ] **Step 2:** Manual smoke script instructions appended (or executed): login admin → /team → create block + event + status → confirm list/achievements render; verify a coordinator session sees coordinator-only events and no edit UI. (If a live prod smoke is desired, run AFTER merge via the existing deploy pipeline.)
- [ ] **Step 3: Commit** `chore(team): integration verification pass`.