# Case Events, Calendar Sync & Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record court hearings (legal cases) and scheduled home visits on case files, sync them into the team-workspace calendar for the assigned worker, and send chained in-app + email reminders at configurable lead times (system defaults with per-worker overrides), all inside the existing CaseStepper architecture.

**Architecture:** A new `case-events` domain owns `case_events` (hearings + planned visits), a sync service in `team/` mirrors planned events into `team_schedule_blocks` (`source='case_event'`, `source_ref`, new `court_hearing` block type; system-managed, API stays owner-only), and a `@nestjs/schedule` cron (every 15 min, DiscoveryService already global via the SLA module's `ScheduleModule.forRoot()`) dispatches chained reminders with a unique-row dedupe ledger. `reminder_settings` holds system defaults + worker overrides; notification categories `court_hearing`/`home_visit` are default-on for email when no preference row exists.

**Tech Stack:** NestJS 11 + TypeORM + Postgres (server), React 19 + Vite + SWR + Tailwind (client), zod DTOs, `@nestjs/schedule` cron, nodemailer (existing EmailService), vitest + jest suites.

**Spec:** `docs/superpowers/specs/2026-10-04-case-events-calendar-sync-reminders-design.md` — the plan argues from the spec; executors read both.

## Global Constraints

- Every DB change ships **both** the TypeORM migration (class name ending `…0000000000083`) **and** an idempotent mirror in `kapwa-server/src/database/migrate.ts`. Commit both together.
- Migration key ties at `…62 / …63 / …68` must never gain a 4th entry. Before writing the migration run the tie check from AGENTS.md (`grep -ho "export class [A-Za-z0-9_]*" *.ts | sed 's/export class //' | grep -oE '[0-9]{13}$' | sort -n | uniq -d` — must print exactly the three known ties) and confirm `…0082` is the current max (one past: `…0083`).
- PostgreSQL 18 on the dev/scratch DB lacks `uuid_generate_v7()`: `migrate.ts` self-defines it; any manual test SQL must use explicit UUIDs.
- Server verification: `npm run typecheck` then `npx jest --silent` (NEVER `npm test` — it adds `--coverage`). Client: `npm run typecheck` + `npm run test:run`.
- To restart the dev API: `setsid nohup node dist/main.js … & disown` after `pkill -f "dist/main.js"` (the pkill also kills the calling shell when chained with `&`).
- i18n parity: every new client string goes in `kapwa-client/src/i18n/locales/en/index.ts` AND `fil/index.ts`.
- Commit style: conventional commits; stage explicit paths (never `git add -A`); never commit secrets.
- `notifications.category` and `notification_preferences.category` are **TEXT columns** — new enum values require NO DB DDL, only TS enums + client mirrors.

## Review Focus

1. **Legal gate:** creating a `court_hearing` on a non-legal category → 400, nothing written (test in Task 4).
2. **Stale calendar entries:** a `done`/`cancelled` event must remove its block immediately and must never send further reminders (Tasks 3–4, 8).
3. **Empty worker override:** an explicit override row with `[]` disables that worker's reminders for the type (zero offsets), while absent override falls back to the system default (Task 8/9).
4. **Past events:** creating/backfilling an event dated in the past is allowed (it is a recorded fact), but never dispatches retroactive reminders (`now >= event_datetime` guard) (Task 8).
5. **Reassignment:** changing `cases.assigned_worker_id` moves synced blocks to the new worker; already-sent reminders stay sent (dedupe ledger keyed by event+offset+channel), new worker receives future ones (Tasks 3–4).
6. **Not-attending hearings:** `attended` NULL/false → no block, no reminders, but the row still counts for the step done-predicate (Tasks 4, 5, 8).
7. **Email disabled:** `EMAIL_HOST` unset or worker without `users.email` → in-app only, no throw (Task 8).
8. **Synced blocks are not manual blocks:** direct API create/update/delete of a `source='case_event'` block → 403; manual blocks keep today's owner-only behavior (Task 3).
9. **Missing config:** no system default row for an event type → zero offsets (no reminders), never a crash; invalid `offsets` jsonb rejected at PUT (Task 9).
10. **Cron double-fire:** two overlapping ticks must not double-send — the dedupe row is inserted (claimed) *before* any delivery (Task 8).

---

### Task 1: Migration `…0083` + migrate.ts mirror + seed

**Files:**
- Create: `kapwa-server/src/database/migrations/CaseEventsAndReminders0000000000083.ts`
- Modify: `kapwa-server/src/database/migrate.ts` (add `case_events`, `case_event_reminders`, `reminder_settings` CREATE TABLE blocks + `team_schedule_blocks` ADD COLUMN statements + indexes + seed INSERT; place the new CREATE TABLE blocks next to the notifications section and the ADD COLUMN pair next to the other `ALTER TABLE … ADD COLUMN IF NOT EXISTS` statements)

**Interfaces:**
- Produces: physical schema consumed by Tasks 2 (entities), 3 (sync), 8 (ledger), 9 (config): `case_events(id uuid PK, case_id uuid NOT NULL FK→cases ON DELETE CASCADE, event_type varchar(32), attended boolean NULL, title text, venue text, event_date date NOT NULL, start_time time, end_time time, notes text, status varchar(32) DEFAULT 'planned', created_by uuid FK→users, created_at, updated_at)`; `case_event_reminders(id, event_id uuid FK→case_events ON DELETE CASCADE, offset_minutes int, channel varchar(16), sent_at timestamp NULL, created_at)` with unique `(event_id, offset_minutes, channel)`; `reminder_settings(id, scope varchar(16), user_id uuid NULL FK→users, event_type varchar(32), offsets jsonb, updated_by uuid NULL FK→users, created_at, updated_at)` with CHECKS + partial unique indexes; `team_schedule_blocks` gains `source varchar(32) NOT NULL DEFAULT 'manual'`, `source_ref uuid NULL` (+ FK backstop ON DELETE SET NULL via DO-block, + index on `source_ref`).

- [ ] **Step 1: Run the key-tie check and confirm the next key**

Run (from `kapwa-server/src/database/migrations`): `grep -ho "export class [A-Za-z0-9_]*" *.ts | sed 's/export class //' | grep -oE '[0-9]{13}$' | sort -n | uniq -d` and `grep -hoE '[0-9]{13}$' *.ts | sort -n | tail -1`
Expected: the dups command prints exactly `0000000000062`/`0000000000063`/`0000000000068`; the tail command prints `0000000000082`. If either differs, STOP and report — do not renumber.

- [ ] **Step 2: Write the migration**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

// Case events (court hearings + scheduled home visits), the reminder-dedupe
// ledger, reminder lead-time settings, and the team-schedule sync columns.
// Mirrored by idempotent statements in migrate.ts.
export class CaseEventsAndReminders0000000000083 implements MigrationInterface {
  name = 'CaseEventsAndReminders0000000000083';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE case_events (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
      case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      event_type VARCHAR(32) NOT NULL,
      attended BOOLEAN,
      title TEXT,
      venue TEXT,
      event_date DATE NOT NULL,
      start_time TIME,
      end_time TIME,
      notes TEXT,
      status VARCHAR(32) NOT NULL DEFAULT 'planned',
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`);
    await queryRunner.query(`CREATE INDEX idx_case_events_case ON case_events(case_id)`);
    await queryRunner.query(`CREATE INDEX idx_case_events_date ON case_events(event_date)`);
    await queryRunner.query(`CREATE INDEX idx_case_events_status_date ON case_events(status, event_date)`);

    await queryRunner.query(`ALTER TABLE team_schedule_blocks ADD COLUMN source VARCHAR(32) NOT NULL DEFAULT 'manual'`);
    await queryRunner.query(`ALTER TABLE team_schedule_blocks ADD COLUMN source_ref UUID`);
    await queryRunner.query(`ALTER TABLE team_schedule_blocks ADD CONSTRAINT fk_blocks_source_ref FOREIGN KEY (source_ref) REFERENCES case_events(id) ON DELETE SET NULL`);
    await queryRunner.query(`CREATE INDEX idx_blocks_source_ref ON team_schedule_blocks(source_ref)`);

    await queryRunner.query(`CREATE TABLE case_event_reminders (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
      event_id UUID NOT NULL REFERENCES case_events(id) ON DELETE CASCADE,
      offset_minutes INTEGER NOT NULL,
      channel VARCHAR(16) NOT NULL,
      sent_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_case_event_reminders ON case_event_reminders(event_id, offset_minutes, channel)`);

    await queryRunner.query(`CREATE TABLE reminder_settings (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
      scope VARCHAR(16) NOT NULL,
      user_id UUID REFERENCES users(id),
      event_type VARCHAR(32) NOT NULL,
      offsets JSONB NOT NULL,
      updated_by UUID REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      CHECK (scope IN ('system','worker')),
      CHECK ((scope = 'system' AND user_id IS NULL) OR (scope = 'worker' AND user_id IS NOT NULL))
    )`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_reminder_system_type ON reminder_settings(event_type) WHERE scope = 'system'`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_reminder_worker_type ON reminder_settings(user_id, event_type) WHERE scope = 'worker'`);

    await queryRunner.query(`INSERT INTO reminder_settings (id, scope, event_type, offsets) VALUES
      (uuid_generate_v7(), 'system', 'court_hearing', '[4320,1440,180]'),
      (uuid_generate_v7(), 'system', 'home_visit', '[1440,180]')`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS reminder_settings`);
    await queryRunner.query(`DROP TABLE IF EXISTS case_event_reminders`);
    await queryRunner.query(`ALTER TABLE team_schedule_blocks DROP COLUMN IF EXISTS source`);
    await queryRunner.query(`ALTER TABLE team_schedule_blocks DROP COLUMN IF EXISTS source_ref`);
    await queryRunner.query(`DROP TABLE IF EXISTS case_events`);
  }
}
```

- [ ] **Step 3: Mirror idempotently in migrate.ts**

Add to `migrate.ts` (near the notifications/other history tables, same `CREATE TABLE IF NOT EXISTS … uuid_generate_v7()` and `CREATE INDEX IF NOT EXISTS` style as the surrounding blocks, and column pairs next to the other `ALTER TABLE … ADD COLUMN IF NOT EXISTS` statements):

```sql
CREATE TABLE IF NOT EXISTS case_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  event_type VARCHAR(32) NOT NULL,
  attended BOOLEAN,
  title TEXT,
  venue TEXT,
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  notes TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'planned',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)
```
plus `CREATE INDEX IF NOT EXISTS idx_case_events_case/case_events_date/case_events_status_date`; the two `ALTER TABLE team_schedule_blocks ADD COLUMN IF NOT EXISTS source/source_ref`; the FK via a DO block (PG has no `ADD CONSTRAINT IF NOT EXISTS`):

```sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_blocks_source_ref') THEN
    ALTER TABLE team_schedule_blocks ADD CONSTRAINT fk_blocks_source_ref FOREIGN KEY (source_ref) REFERENCES case_events(id) ON DELETE SET NULL;
  END IF;
END $$;
```
then `CREATE INDEX IF NOT EXISTS idx_blocks_source_ref …`; the `case_event_reminders` table + `CREATE UNIQUE INDEX IF NOT EXISTS uq_case_event_reminders …`; the `reminder_settings` table + both partial unique indexes (with `IF NOT EXISTS`) + the seed:

```sql
INSERT INTO reminder_settings (id, scope, event_type, offsets)
SELECT uuid_generate_v7(), 'system', 'court_hearing', '[4320,1440,180]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM reminder_settings WHERE scope='system' AND event_type='court_hearing');
INSERT INTO reminder_settings (id, scope, event_type, offsets)
SELECT uuid_generate_v7(), 'system', 'home_visit', '[1440,180]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM reminder_settings WHERE scope='system' AND event_type='home_visit');
```

- [ ] **Step 4: Build and verify on a disposable PG**

```bash
cd kapwa-server && npm run build
dropdb -h /tmp/opencode/kapwa-pg -p 5433 -U kapwa erdgen 2>/dev/null; createdb -h /tmp/opencode/kapwa-pg -p 5433 -U kapwa erdgen
DB_HOST=/tmp/opencode/kapwa-pg DB_PORT=5433 DB_USER=kapwa DB_PASSWORD=kapwa DB_NAME=erdgen node dist/database/migrate.js
psql -h /tmp/opencode/kapwa-pg -p 5433 -U kapwa -d erdgen -At -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"
psql -h /tmp/opencode/kapwa-pg -p 5433 -U kapwa -d erdgen -At -c "SELECT event_type, offsets FROM reminder_settings ORDER BY event_type"
psql -h /tmp/opencode/kapwa-pg -p 5433 -U kapwa -d erdgen -At -c "SELECT column_name FROM information_schema.columns WHERE table_name='team_schedule_blocks' AND column_name IN ('source','source_ref') ORDER BY column_name"
```
Expected: bootstrap prints "Marked 86 TypeORM migrations as applied"; table count = previous count + 3 (60); the settings rows show `court_hearing`/`home_visit` with the seeded arrays; the two columns exist. Then `dropdb -h /tmp/opencode/kapwa-pg -p 5433 -U kapwa erdgen`.

- [ ] **Step 5: Confirm the existing suites still pass**

Run: `cd kapwa-server && npm run typecheck && npx jest --silent 2>&1 | tail -3`
Expected: typecheck clean; jest summary PASS (suites count may stay 114).

- [ ] **Step 6: Commit**

```bash
cd /home/typwtypw/Documents/NC/THESIS1-KAPWA
git add kapwa-server/src/database/migrations/CaseEventsAndReminders0000000000083.ts kapwa-server/src/database/migrate.ts
git commit -m "feat(schema): case events, reminder settings, schedule sync columns
case_events (court hearings + scheduled home visits), case_event_reminders
dedupe ledger, reminder_settings (system defaults + worker overrides) with
partial unique indexes and seeds, team_schedule_blocks.source/source_ref
with FK backstop. Mirrored in migrate.ts (bootstrap now marks 86 applied)."
```

---

### Task 2: Entities + module wiring (server)

**Files:**
- Create: `kapwa-server/src/case-events/case-event.entity.ts`
- Create: `kapwa-server/src/case-events/case-event-reminder.entity.ts`
- Create: `kapwa-server/src/case-events/reminder-setting.entity.ts`
- Create: `kapwa-server/src/case-events/case-events.module.ts`
- Modify: `kapwa-server/src/team/team-schedule-block.entity.ts` (add `source`, `sourceRef`)
- Modify: `kapwa-server/src/app.module.ts` (import `CaseEventsModule`)
- Modify: `kapwa-server/src/cases/cases.module.ts` (add `CaseEvent` to `TypeOrmModule.forFeature`, add `TeamModule` to imports)

**Interfaces:**
- Produces (consumed by Tasks 3–9):
  - `CaseEvent` entity: columns mapped to Task 1 DDL (property names `caseId`, `eventType`, `attended`, `title`, `venue`, `eventDate`, `startTime`, `endTime`, `notes`, `status`, `createdBy`), relations `case: Case` (`ManyToOne` CASCADE), `created_by` user relation optional.
  - `CaseEventReminder` entity: `eventId`, `offsetMinutes`, `channel`, `sentAt`.
  - `ReminderSetting` entity: `scope`, `userId`, `eventType`, `offsets: number[]` (jsonb), `updatedBy`.
  - `CaseEventsModule` exports `CaseEventsService`, `CaseEventReminderService`, `ReminderSettingsService`; imports `TypeOrmModule.forFeature([CaseEvent, CaseEventReminder, ReminderSetting, Case, User])`, `AuthModule`, `NotificationsModule`, `AuditModule`, `TeamModule`.
  - `TeamScheduleBlock` accumulates `source: string` (default `'manual'`), `sourceRef?: string | null`, `sourceRef` FK relation optional.

- [ ] **Step 1: Write the entities**

`case-event.entity.ts`:

```ts
import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Case } from '../cases/case.entity';
import { User } from '../auth/user.entity';

export const CASE_EVENT_TYPES = ['court_hearing', 'home_visit'] as const;
export type CaseEventType = (typeof CASE_EVENT_TYPES)[number];
export const CASE_EVENT_STATUSES = ['planned', 'done', 'cancelled'] as const;
export type CaseEventStatus = (typeof CASE_EVENT_STATUSES)[number];

// Court hearings (legal categories) and scheduled home visits (any case).
// `attended` is tri-state: true = the office attends (calendar + reminders),
// NULL/false = not attending (recorded in the case file only).
@Entity('case_events')
export class CaseEvent extends BaseEntity {
  @Column({ name: 'case_id' })
  caseId!: string;

  @ManyToOne(() => Case, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'case_id' })
  case!: Case;

  @Column({ name: 'event_type', type: 'varchar', length: 32 })
  eventType!: string;

  @Column({ type: 'boolean', nullable: true })
  attended?: boolean | null;

  @Column({ type: 'text', nullable: true })
  title?: string | null;

  @Column({ type: 'text', nullable: true })
  venue?: string | null;

  @Column({ name: 'event_date', type: 'date' })
  eventDate!: string;

  @Column({ name: 'start_time', type: 'time', nullable: true })
  startTime?: string | null;

  @Column({ name: 'end_time', type: 'time', nullable: true })
  endTime?: string | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({ type: 'varchar', length: 32, default: 'planned' })
  status!: string;

  @Column({ name: 'created_by', nullable: true })
  createdBy?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
```

`case-event-reminder.entity.ts`:

```ts
import { Entity, Column, CreateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

// Dedupe ledger: one row per (event, offset, channel), inserted BEFORE any
// delivery so two overlapping cron ticks cannot double-send. `sentAt` NULL
// means claimed but delivery failed — deliberately not retried.
@Entity('case_event_reminders')
export class CaseEventReminder extends BaseEntity {
  @Column({ name: 'event_id' })
  eventId!: string;

  @Column({ name: 'offset_minutes' })
  offsetMinutes!: number;

  @Column({ type: 'varchar', length: 16 })
  channel!: string;

  @Column({ name: 'sent_at', nullable: true })
  sentAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
```

`reminder-setting.entity.ts`:

```ts
import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export const REMINDER_SCOPES = ['system', 'worker'] as const;
export type ReminderScope = (typeof REMINDER_SCOPES)[number];

// Lead-time configuration: `system` rows are the MSWDO Head's defaults
// (user_id NULL, one per event type), `worker` rows override per user
// (user_id NOT NULL). offsets = ordered minutes-before, strictly descending.
// An explicit empty array disables reminders for that scope+type.
@Entity('reminder_settings')
export class ReminderSetting extends BaseEntity {
  @Column({ type: 'varchar', length: 16 })
  scope!: string;

  @Column({ name: 'user_id', nullable: true })
  userId?: string | null;

  @Column({ name: 'event_type', type: 'varchar', length: 32 })
  eventType!: string;

  @Column({ type: 'jsonb' })
  offsets!: number[];

  @Column({ name: 'updated_by', nullable: true })
  updatedBy?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
```

- [ ] **Step 2: Extend TeamScheduleBlock**

Add to `team-schedule-block.entity.ts` (after `visibleTo`):

```ts
  // Sync origin: `manual` blocks are staff-created and owner-editable;
  // `case_event` blocks are system-managed mirrors of case_events rows
  // (source_ref = the event id) and are rejected by the write API.
  @Column({ type: 'varchar', length: 32, default: 'manual' })
  source!: string;

  @Column({ name: 'source_ref', type: 'uuid', nullable: true })
  sourceRef?: string | null;
```

- [ ] **Step 3: Wire the module**

`case-events.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaseEvent } from './case-event.entity';
import { CaseEventReminder } from './case-event-reminder.entity';
import { ReminderSetting } from './reminder-setting.entity';
import { Case } from '../cases/case.entity';
import { User } from '../auth/user.entity';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';
import { TeamModule } from '../team/team.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CaseEvent, CaseEventReminder, ReminderSetting, Case, User]),
    AuthModule, NotificationsModule, AuditModule, TeamModule,
  ],
  providers: [],
  controllers: [],
  exports: [],
})
export class CaseEventsModule {}
```

Register `CaseEventsModule` in `app.module.ts` imports; add `CaseEvent` to `cases.module.ts` `TypeOrmModule.forFeature([…])` and `TeamModule` to its imports (for the Task 4 reassignment hook; safe — TeamModule imports Auth/Audit/Notifications only, no cycle).

- [ ] **Step 4: Typecheck + suite**

Run: `cd kapwa-server && npm run typecheck && npx jest --silent 2>&1 | tail -3`
Expected: clean; PASS.

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/src/case-events kapwa-server/src/team/team-schedule-block.entity.ts kapwa-server/src/app.module.ts kapwa-server/src/cases/cases.module.ts
git commit -m "feat(case-events): entities + module wiring
CaseEvent / CaseEventReminder / ReminderSetting entities, TeamScheduleBlock
source + source_ref columns, CaseEventsModule registered, CaseEvent repo +
TeamModule wired into CasesModule for the reassignment hook."
```

---

### Task 3: Team schedule sync service + synced-block guard

**Files:**
- Create: `kapwa-server/src/team/team-schedule-sync.service.ts`
- Create: `kapwa-server/src/team/team-schedule-sync.service.spec.ts`
- Modify: `kapwa-server/src/team/team-schedule.service.ts` (BLOCK_TYPES += `court_hearing`; reject writes to `source='case_event'` blocks in `updateBlock`/`deleteBlock`/`createBlock`)
- Modify: `kapwa-server/src/team/team.module.ts` (providers + exports `TeamScheduleSyncService`; `TypeOrmModule.forFeature` += `Case`, `CaseEvent`)

**Interfaces:**
- Produces (consumed by Tasks 4, 8):
  - `class TeamScheduleSyncService` with:
    - `upsertForEvent(event: { id: string; eventType: string; eventDate: string; startTime?: string | null; endTime?: string | null; title?: string | null; venue?: string | null; status: string }, workerId: string | null | undefined, controlNo: string): Promise<void>` — creates/updates the assigned worker's block via the sync path (bypasses owner-only for synced blocks), no-op when workerId absent.
    - `removeForEvent(eventId: string): Promise<void>` — deletes by `(source='case_event', sourceRef=eventId)`.
    - `moveForCase(caseId: string, newWorkerId: string | null): Promise<void>` — deletes the old worker's synced blocks for the case's events and re-upserts them for the new worker (no-op when newWorkerId null).
- Consumes: `TeamScheduleBlock` repo, `Case` repo (for controlNo when upserting from an event whose case fetch is cheaper than passing), `CaseEvent` repo (moveForCase lists events by caseId).
- Deadline: `BLOCK_TYPES` now includes `court_hearing`.

- [ ] **Step 1: Write the failing tests**

`team-schedule-sync.service.spec.ts` (hand-built with a mocked repo — follow `team-schedule.service.spec.ts`'s existing hand-construction style):

```ts
import { TeamScheduleSyncService } from './team-schedule-sync.service';

describe('TeamScheduleSyncService', () => {
  const blockRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn(), delete: jest.fn() };
  const caseRepo = { findOne: jest.fn() };
  const eventRepo = { find: jest.fn() };
  const svc = new TeamScheduleSyncService(blockRepo as any, caseRepo as any, eventRepo as any);

  const event = {
    id: 'evt-1', eventType: 'court_hearing', eventDate: '2026-10-20',
    startTime: '09:00', endTime: '10:00', title: 'Hearing', venue: 'RTC Bulacan',
    status: 'planned',
  };

  beforeEach(() => jest.clearAllMocks());

  it('creates a synced block for the assigned worker', async () => {
    blockRepo.findOne.mockResolvedValue(null);
    blockRepo.create.mockImplementation((x) => x);
    blockRepo.save.mockResolvedValue({ id: 'block-1' });
    await svc.upsertForEvent(event as any, 'worker-1', 'MSWD-2026-0012');
    expect(blockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'worker-1', blockDate: '2026-10-20', blockType: 'court_hearing',
      source: 'case_event', sourceRef: 'evt-1',
    }));
    const note = (blockRepo.create as jest.Mock).mock.calls[0][0].note as string;
    expect(note).toContain('MSWD-2026-0012');
  });

  it('updates the existing block instead of duplicating', async () => {
    blockRepo.findOne.mockResolvedValue({ id: 'block-1', userId: 'worker-1' });
    blockRepo.save.mockResolvedValue({ id: 'block-1' });
    await svc.upsertForEvent({ ...event, eventDate: '2026-10-21' } as any, 'worker-1', 'MSWD-2026-0012');
    expect(blockRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({ sourceRef: 'evt-1' }));
    expect(blockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('no-ops when the case has no assigned worker', async () => {
    await svc.upsertForEvent(event as any, null, 'MSWD-2026-0012');
    expect(blockRepo.save).not.toHaveBeenCalled();
    expect(blockRepo.create).not.toHaveBeenCalled();
  });

  it('removes the block for a cancelled event', async () => {
    await svc.removeForEvent('evt-1');
    expect(blockRepo.delete).toHaveBeenCalledWith(expect.objectContaining({ source: 'case_event', sourceRef: 'evt-1' }));
  });

  it('moves all synced blocks to the new worker on reassignment', async () => {
    eventRepo.find.mockResolvedValue([event]);
    blockRepo.findOne.mockResolvedValue(null);
    blockRepo.create.mockImplementation((x) => x);
    blockRepo.save.mockResolvedValue({});
    await svc.moveForCase('case-9', 'worker-2');
    expect(eventRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ caseId: 'case-9' }) }));
    expect(blockRepo.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'worker-2' }));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd kapwa-server && npx jest team-schedule-sync --silent`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the sync service**

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeamScheduleBlock } from './team-schedule-block.entity';
import { Case } from '../cases/case.entity';
import { CaseEvent } from '../case-events/case-event.entity';

// System-managed mirror of case_events into team_schedule_blocks. This is the
// ONLY writer of `source='case_event'` blocks: the public team-schedule API
// rejects synced blocks (see TeamScheduleService), so the owner-only rule
// holds for every human caller while this internal path stays the exempt one.
@Injectable()
export class TeamScheduleSyncService {
  constructor(
    @InjectRepository(TeamScheduleBlock) private blocks: Repository<TeamScheduleBlock>,
    @InjectRepository(Case) private cases: Repository<Case>,
    @InjectRepository(CaseEvent) private events: Repository<CaseEvent>,
  ) {}

  private async blockForEvent(eventId: string): Promise<TeamScheduleBlock | null> {
    return this.blocks.findOne({ where: { source: 'case_event', sourceRef: eventId } });
  }

  async upsertForEvent(
    event: { id: string; eventType: string; eventDate: string; startTime?: string | null; endTime?: string | null; title?: string | null; venue?: string | null; status: string },
    workerId: string | null | undefined,
    controlNo: string,
  ): Promise<void> {
    if (!workerId) return;
    const existing = await this.blockForEvent(event.id);
    const note = `Case ${controlNo} — ${event.title ?? event.eventType}${event.venue ? ` (${event.venue})` : ''}`;
    const patch = {
      userId: workerId,
      blockDate: event.eventDate,
      blockType: event.eventType,
      startTime: event.startTime ?? null,
      endTime: event.endTime ?? null,
      note,
      source: 'case_event' as const,
      sourceRef: event.id,
    };
    if (existing) {
      await this.blocks.save(this.blocks.merge(existing, patch));
    } else {
      await this.blocks.save(this.blocks.create(patch as Partial<TeamScheduleBlock>));
    }
  }

  async removeForEvent(eventId: string): Promise<void> {
    await this.blocks.delete({ source: 'case_event', sourceRef: eventId });
  }

  async moveForCase(caseId: string, newWorkerId: string | null | undefined): Promise<void> {
    const events = await this.events.find({ where: { caseId } });
    if (!newWorkerId) {
      for (const e of events) await this.removeForEvent(e.id);
      return;
    }
    const c = await this.cases.findOne({ where: { id: caseId } });
    const controlNo = c?.controlNo ?? '';
    for (const e of events) {
      await this.removeForEvent(e.id);
      await this.upsertForEvent(e, newWorkerId, controlNo);
    }
  }
}
```

- [ ] **Step 4: Guard + vocabulary in team-schedule.service.ts**

1. Add `'court_hearing'` to `BLOCK_TYPES`.
2. In `updateBlock`, after the ownership check, add:
```ts
    if (block.source === 'case_event') {
      throw new ForbiddenException('Synced blocks are managed by the case file — edit the hearing or visit on the case instead.');
    }
```
3. In `deleteBlock`, same guard before `repo.delete`.
4. `createBlock` needs no guard (creation can never create a synced block — `source` is not in `TeamBlockInput`; note the entity default `'manual'` covers it).

- [ ] **Step 5: Existing spec for the guard**

Add to `team-schedule.service.spec.ts` (matching its existing patterns — find the update/delete describe blocks):

```ts
  it('rejects edits to a synced (case_event) block', async () => {
    repo.findOne.mockResolvedValue({ id: 'b1', userId: 'u1', source: 'case_event' });
    await expect(svc.updateBlock('b1', { note: 'x' }, { id: 'u1', role: 'social_worker' } as any))
      .rejects.toThrow(/managed by the case file/);
  });
```

- [ ] **Step 6: Module wiring**

`team.module.ts`: add `TeamScheduleSyncService` to providers AND exports; add `Case` and `CaseEvent` to `TypeOrmModule.forFeature`. (CaseEvent entity lives in case-events; forFeature is a registration without an import edge — same pattern as `CaseIntervention` in `cases.module.ts`.)

- [ ] **Step 7: Run the suites**

Run: `cd kapwa-server && npm run typecheck && npx jest team-schedule --silent`
Expected: PASS (new + existing).

- [ ] **Step 8: Commit**

```bash
git add kapwa-server/src/team/team-schedule-sync.service.ts kapwa-server/src/team/team-schedule-sync.service.spec.ts kapwa-server/src/team/team-schedule.service.ts kapwa-server/src/team/team.module.ts
git commit -m "feat(team): sync case events into schedule blocks, guard synced blocks
TeamScheduleSyncService (upsert/remove/move) as the only writer of
source='case_event' blocks; BLOCK_TYPES gains court_hearing; API rejects
edits/deletes of synced blocks (owner-only preserved for manual blocks)."
```

---

### Task 4: CaseEventsService + controller (lifecycle, legal gate, sync orchestration)

**Files:**
- Create: `kapwa-server/src/case-events/case-events.constants.ts` (LEGAL_CATEGORIES)
- Create: `kapwa-server/src/case-events/case-events.service.ts`
- Create: `kapwa-server/src/case-events/case-events.controller.ts`
- Create: `kapwa-server/src/case-events/dto/case-events.zod.ts`
- Create: `kapwa-server/src/case-events/case-events.service.spec.ts` + `case-events.controller.spec.ts`
- Modify: `kapwa-server/src/case-events/case-events.module.ts` (providers/controllers/exports)
- Modify: `kapwa-server/src/cases/cases.service.ts` (reassignment hook in `update`)

**Interfaces:**
- Produces (consumed by Task 5 seal predicate, Task 8 reminders):
  - `LEGAL_CATEGORIES: ReadonlySet<string>` in `case-events.constants.ts` = `{'Children in Conflict with the Law (CICL)', 'Violence Against Women and Their Children (VAWC)', 'Children in Need of Special Protection (CNSP)', 'Adoption & Foster Care Case', 'Indigency / Court-Ordered Social Case Study'}`.
  - `CaseEventsService`:
    - `listForCase(caseId): Promise<CaseEvent[]>`
    - `create(caseId, dto: CreateCaseEventDto, actor: { id: string }): Promise<CaseEvent>` (throws BadRequestException on the legal gate; syncs when `shouldSync`)
    - `update(caseId, eventId, dto: UpdateCaseEventDto, actor): Promise<CaseEvent>` (sync on field change; `status` → done/cancelled removes block)
    - `remove(caseId, eventId, actor): Promise<{ deleted: boolean }>` (removes block, then row)
    - `countForCase(caseId): Promise<number>` — non-cancelled events (Task 5 done-predicate)
    - `shouldSync(event): boolean` — `status === 'planned' && (eventType === 'home_visit' || attended === true)`
- Consumes: `CaseEvent` repo, `Case` repo, `TeamScheduleSyncService`, `AuditLogService` (optional).

- [ ] **Step 1: Write the failing service tests**

`case-events.service.spec.ts` (hand-built; mock `TeamScheduleSyncService`):

```ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CaseEventsService, LEGAL_CATEGORIES } from './case-events.service';

describe('CaseEventsService', () => {
  const eventRepo = { create: jest.fn(), save: jest.fn(), find: jest.fn(), findOne: jest.fn(), delete: jest.fn(), count: jest.fn() };
  const caseRepo = { findOne: jest.fn() };
  const sync = { upsertForEvent: jest.fn(), removeForEvent: jest.fn(), moveForCase: jest.fn() };
  const svc = new CaseEventsService(eventRepo as any, caseRepo as any, sync as any, undefined);

  const legalCase = { id: 'c1', controlNo: 'MSWD-2026-0012', caseCategory: 'Children in Conflict with the Law (CICL)', assignedWorkerId: 'w1' };

  beforeEach(() => { jest.clearAllMocks(); caseRepo.findOne.mockResolvedValue(legalCase); });

  it('rejects a court hearing on a non-legal category', async () => {
    caseRepo.findOne.mockResolvedValue({ ...legalCase, caseCategory: 'Solo Parent' });
    await expect(svc.create('c1', { eventType: 'court_hearing', eventDate: '2026-10-20' } as any, { id: 'u1' }))
      .rejects.toThrow(BadRequestException);
    expect(eventRepo.save).not.toHaveBeenCalled();
  });

  it('creates a home visit on any category and syncs it', async () => {
    eventRepo.create.mockImplementation((x) => x);
    eventRepo.save.mockImplementation((x) => Promise.resolve({ ...x, id: 'e1' }));
    const out = await svc.create('c1', { eventType: 'home_visit', eventDate: '2026-10-21' }, { id: 'u1' });
    expect(out.id).toBe('e1');
    expect(sync.upsertForEvent).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }), 'w1', 'MSWD-2026-0012');
  });

  it('does not sync a hearing the office is not attending', async () => {
    eventRepo.create.mockImplementation((x) => x);
    eventRepo.save.mockImplementation((x) => Promise.resolve({ ...x, id: 'e1' }));
    await svc.create('c1', { eventType: 'court_hearing', eventDate: '2026-10-20', attended: null }, { id: 'u1' });
    expect(sync.upsertForEvent).not.toHaveBeenCalled();
  });

  it('removes the block when an event is cancelled', async () => {
    eventRepo.findOne.mockResolvedValue({ id: 'e1', caseId: 'c1', eventType: 'home_visit', status: 'planned' });
    eventRepo.save.mockImplementation((x) => Promise.resolve(x));
    await svc.update('c1', 'e1', { status: 'cancelled' }, { id: 'u1' });
    expect(sync.removeForEvent).toHaveBeenCalledWith('e1');
    expect(sync.upsertForEvent).not.toHaveBeenCalled();
  });

  it('counts only non-cancelled events for the step predicate', async () => {
    eventRepo.count.mockResolvedValue(2);
    await expect(svc.countForCase('c1')).resolves.toBe(2);
    expect(eventRepo.count).toHaveBeenCalledWith(expect.objectContaining({ where: { caseId: 'c1', status: expect.not.stringMatching('cancelled') } }));
  });

  it('404s on an event that belongs to another case', async () => {
    eventRepo.findOne.mockResolvedValue({ id: 'e1', caseId: 'OTHER' });
    await expect(svc.update('c1', 'e1', { status: 'done' }, { id: 'u1' })).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd kapwa-server && npx jest case-events --silent`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement constants, DTOs, service**

`case-events.constants.ts`:
```ts
// The only case categories on which court hearings may be recorded. Mirrored
// in the client (StepCourtHearings visibility). Home visits know no gate.
export const LEGAL_CATEGORIES: ReadonlySet<string> = new Set([
  'Children in Conflict with the Law (CICL)',
  'Violence Against Women and Their Children (VAWC)',
  'Children in Need of Special Protection (CNSP)',
  'Adoption & Foster Care Case',
  'Indigency / Court-Ordered Social Case Study',
]);
```

`dto/case-events.zod.ts`:
```ts
import { z } from 'zod';
import { CASE_EVENT_TYPES, CASE_EVENT_STATUSES } from '../case-event.entity';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, 'Expected HH:MM').optional().nullable();

export const CreateCaseEventSchema = z.object({
  eventType: z.enum(CASE_EVENT_TYPES),
  attended: z.boolean().nullable().optional(),
  title: z.string().trim().optional().nullable(),
  venue: z.string().trim().optional().nullable(),
  eventDate: dateSchema,
  startTime: timeSchema,
  endTime: timeSchema,
  notes: z.string().trim().optional().nullable(),
}).strict();
export type CreateCaseEventInput = z.infer<typeof CreateCaseEventSchema>;

export const UpdateCaseEventSchema = CreateCaseEventSchema.partial().extend({
  status: z.enum(CASE_EVENT_STATUSES).optional(),
}).strict();
export type UpdateCaseEventInput = z.infer<typeof UpdateCaseEventSchema>;
```

`case-events.service.ts` (core — validate with the zod schemas inside the service the way `intake` does, or via a Nest `ValidationPipe`; the repo's convention is zod-in-service, so parse in the service):
```ts
import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { CaseEvent } from './case-event.entity';
import { Case } from '../cases/case.entity';
import { TeamScheduleSyncService } from '../team/team-schedule-sync.service';
import { AuditLogService } from '../audit/audit-log.service';
import { CreateCaseEventInput, UpdateCaseEventInput } from './dto/case-events.zod';

export { LEGAL_CATEGORIES } from './case-events.constants';

@Injectable()
export class CaseEventsService {
  private readonly logger = new Logger(CaseEventsService.name);

  constructor(
    @InjectRepository(CaseEvent) private readonly events: Repository<CaseEvent>,
    @InjectRepository(Case) private readonly cases: Repository<Case>,
    private readonly sync: TeamScheduleSyncService,
    @Optional() private readonly auditLog?: AuditLogService,
  ) {}

  listForCase(caseId: string): Promise<CaseEvent[]> {
    return this.events.find({ where: { caseId }, order: { eventDate: 'ASC', startTime: 'ASC' } });
  }

  // True when the event belongs on the shared calendar: planned,
  // home visits unconditionally, hearings only when the office attends.
  shouldSync(event: Pick<CaseEvent, 'status' | 'eventType' | 'attended'>): boolean {
    return event.status === 'planned'
      && (event.eventType === 'home_visit' || event.attended === true);
  }

  private async loadCase(caseId: string): Promise<Case> {
    const c = await this.cases.findOne({ where: { id: caseId } });
    if (!c) throw new NotFoundException('Case not found');
    return c;
  }

  private async loadOwnedEvent(caseId: string, eventId: string): Promise<CaseEvent> {
    const e = await this.events.findOne({ where: { id: eventId } });
    if (!e || e.caseId !== caseId) throw new NotFoundException('Case event not found');
    return e;
  }

  private assertLegalGate(eventType: string, caseCategory: string | null | undefined): void {
    if (eventType === 'court_hearing' && !LEGAL_CATEGORIES.has(caseCategory ?? '')) {
      throw new BadRequestException(
        `Court hearings can only be recorded on legal categories (one of: ${[...LEGAL_CATEGORIES].join(', ')}).`,
      );
    }
  }

  async create(caseId: string, input: CreateCaseEventInput, actor: { id: string }): Promise<CaseEvent> {
    const c = await this.loadCase(caseId);
    this.assertLegalGate(input.eventType, c.caseCategory);
    const row = this.events.create({
      ...input,
      caseId,
      status: 'planned',
      createdBy: actor.id,
    });
    const saved = await this.events.save(row);
    if (this.shouldSync(saved)) {
      await this.sync.upsertForEvent(saved, c.assignedWorkerId, c.controlNo);
    }
    await this.auditLog?.log('case.event.create', caseId, actor.id, { eventId: saved.id, eventType: saved.eventType });
    return saved;
  }

  async update(caseId: string, eventId: string, input: UpdateCaseEventInput, actor: { id: string }): Promise<CaseEvent> {
    const event = await this.loadOwnedEvent(caseId, eventId);
    Object.assign(event, input);
    const saved = await this.events.save(event);
    if (saved.status !== 'planned') {
      await this.sync.removeForEvent(saved.id);
    } else if (this.shouldSync(saved)) {
      const c = await this.loadCase(caseId);
      await this.sync.upsertForEvent(saved, c.assignedWorkerId, c.controlNo);
    } else {
      await this.sync.removeForEvent(saved.id);
    }
    await this.auditLog?.log('case.event.update', caseId, actor.id, { eventId: saved.id, status: saved.status });
    return saved;
  }

  async remove(caseId: string, eventId: string, actor: { id: string }): Promise<{ deleted: boolean }> {
    await this.loadOwnedEvent(caseId, eventId);
    await this.sync.removeForEvent(eventId);
    await this.events.delete(eventId);
    await this.auditLog?.log('case.event.delete', caseId, actor.id, { eventId });
    return { deleted: true };
  }

  async countForCase(caseId: string): Promise<number> {
    return this.events.count({ where: { caseId, status: Not('cancelled') } });
  }
}
```

- [ ] **Step 4: Controller**

`case-events.controller.ts` (mirror the cases controller guards; writes admin/social_worker — coordinators read-only, matching the existing case-route matrix):

```ts
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AbacGuard } from '../auth/guards/abac.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedRequest } from '../auth/types';
import { CaseEventsService } from './case-events.service';
import { CreateCaseEventInput, UpdateCaseEventInput } from './dto/case-events.zod';

@ApiTags('Case Events')
@Controller('cases/:caseId/events')
@UseGuards(JwtAuthGuard, RolesGuard, AbacGuard)
@ApiBearerAuth()
export class CaseEventsController {
  constructor(private readonly svc: CaseEventsService) {}

  @Get()
  @Roles('admin', 'social_worker', 'coordinator')
  list(@Param('caseId', new ParseUUIDPipe()) caseId: string) {
    return this.svc.listForCase(caseId);
  }

  @Post()
  @Roles('admin', 'social_worker')
  create(@Param('caseId', new ParseUUIDPipe()) caseId: string, @Body() dto: CreateCaseEventInput, @Request() req: AuthenticatedRequest) {
    return this.svc.create(caseId, dto, req.user);
  }

  @Patch(':eventId')
  @Roles('admin', 'social_worker')
  update(@Param('caseId', new ParseUUIDPipe()) caseId: string, @Param('eventId', new ParseUUIDPipe()) eventId: string, @Body() dto: UpdateCaseEventInput, @Request() req: AuthenticatedRequest) {
    return this.svc.update(caseId, eventId, dto, req.user);
  }

  @Delete(':eventId')
  @Roles('admin', 'social_worker')
  remove(@Param('caseId', new ParseUUIDPipe()) caseId: string, @Param('eventId', new ParseUUIDPipe()) eventId: string, @Request() req: AuthenticatedRequest) {
    return this.svc.remove(caseId, eventId, req.user);
  }
}
```

Register provider `CaseEventsService` and controller in `case-events.module.ts`, export `CaseEventsService`.

- [ ] **Step 5: Reassignment hook in CasesService.update**

In `cases.service.ts` `update` (the method that `Object.assign(caseEntity, rest)`s — find it by the `followUpVisits !== undefined` block around line 726), before applying the patch capture `const prevWorker = caseEntity.assignedWorkerId;` and after the save:

```ts
    if (rest.assignedWorkerId !== undefined && rest.assignedWorkerId !== prevWorker) {
      await this.syncService.moveForCase(id, rest.assignedWorkerId ?? null);
    }
```
Add `private readonly syncService: TeamScheduleSyncService` to the constructor (TeamModule import was added in Task 2).

- [ ] **Step 6: Controller spec (roles + basic shape)**

`case-events.controller.spec.ts`: verify `@Roles` metadata on the four routes (existing controllers do metadata assertions — mirror `cases.controller.spec.ts`'s pattern of reading `Reflect.getMetadata('roles', handler)`).

- [ ] **Step 7: Run the suites**

Run: `cd kapwa-server && npm run typecheck && npx jest case-events cases --silent`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add kapwa-server/src/case-events
git commit -m "feat(case-events): CRUD + legal gate + calendar sync orchestration
Create/list/update/delete events with the court_hearing legal-category
gate and attended semantics; sync/remove blocks on lifecycle changes;
countForCase for the step predicate; reassignment hook on case update."
```

---

### Task 5: `court_hearings` stepper step (server vocabulary + seal predicate + client stepper)

**Files:**
- Modify: `kapwa-server/src/cases/case-step-labels.ts` (label, `KNOWN_STEP_KEYS`, `CATEGORY_STEP_TEMPLATES` for the five legal categories, `CASE_STEP_FLOORS`)
- Modify: `kapwa-server/src/cases/case-step-locks.service.ts` (`case 'court_hearings'` branch in `stepDone`, count plumbing in `isStepDone`)
- Modify: `kapwa-server/src/cases/case-step-locks.service.spec.ts` (fixture-driven additions)
- Modify: `docs/superpowers/specs/case-step-done-fixture.json` (hearing-count scenarios)
- Modify: `kapwa-client/src/components/case-view/CaseStepper.tsx` (templates, `STEP_LABEL_KEYS`, `STEP_DESCRIPTIONS`, `STEP_PHASE`, `STEP_FLOORS`, `stepperStepDone` branch via `StepperProgressOpts.hearingsCount`)
- Modify: `kapwa-client/src/components/case-view/CaseStepper.done.test.ts`

**Interfaces:**
- Produces: step key `court_hearings` known to both apps; done = floor(0) AND `hearingsCount > 0` (non-cancelled); templates for the five legal categories inject it between `assessment` and `enrollments`; CNSP + Court-Ordered SCS gain full explicit templates.
- Consumes: `CaseEventsService.countForCase` (server), client `hearingsCount` prop plumbed through `StepperProgressOpts`.

- [ ] **Step 1: Server vocabulary**

In `case-step-labels.ts`:
- labels: `court_hearings: 'Court Hearings'`
- `CATEGORY_STEP_TEMPLATES` gains:
```ts
  'Children in Conflict with the Law (CICL)': ['assessment', 'court_hearings', 'discernment', 'enrollments', 'interventions', 'referrals', 'evaluate', 'closure'],
  'Violence Against Women and Their Children (VAWC)': ['assessment', 'court_hearings', 'protection_order', 'enrollments', 'interventions', 'referrals', 'evaluate', 'closure'],
  'Children in Need of Special Protection (CNSP)': ['assessment', 'court_hearings', 'enrollments', 'interventions', 'referrals', 'evaluate', 'closure'],
  'Adoption & Foster Care Case': ['assessment', 'court_hearings', 'adoption', 'enrollments', 'interventions', 'referrals', 'evaluate', 'closure'],
  'Indigency / Court-Ordered Social Case Study': ['assessment', 'court_hearings', 'enrollments', 'interventions', 'referrals', 'evaluate', 'closure'],
```
- `CASE_STEP_FLOORS`: `court_hearings: 0`.

- [ ] **Step 2: Lock-service branch + count**

In `case-step-locks.service.ts`: add `@InjectRepository(CaseEvent)` + constructor param; in `stepDone` switch add:
```ts
      // Court Hearings: at least one recorded hearing that was not cancelled
      // (attended or not — a not-attended hearing is still a recorded fact).
      case 'court_hearings':
        return opts.courtHearingCount > 0;
```
extend `StepDoneOpts` with `courtHearingCount?: number`; in `isStepDone` add the count (only for this key, same shape as `enrollmentCount`):
```ts
    const courtHearingCount =
      stepKey === 'court_hearings' ? await this.courtHearingsCount(caseId) : 0;
```
plus helper:
```ts
  private async courtHearingsCount(caseId: string): Promise<number> {
    return this.caseEvents.count({ where: { caseId, status: Not('cancelled') } });
  }
```
(import `Not` from typeorm) and pass `{ courtHearingCount }` into `stepDone`.

- [ ] **Step 3: Fixture + parity tests**

In `docs/superpowers/specs/case-step-done-fixture.json`, add a scenario shape `{ step: 'court_hearings', status: 'enrolled', data: {...}, counts: { interventions: 0, enrollments: 0 }, opts: { courtHearingCount: 1 }, done: true }` (read the file's existing entry shapes first and mirror them) and a second with `courtHearingCount: 0, done: false`. Add the matching case to `case-step-locks.service.spec.ts` and the client `CaseStepper.done.test.ts` (both read the fixture — follow each file's existing loop).

- [ ] **Step 4: Client stepper**

In `CaseStepper.tsx`:
- `StepperProgressOpts` gains `courtHearingCount?: number;`
- `CATEGORY_STEP_TEMPLATES` — same five templates as Task 5 Step 1.
- `STEP_LABEL_KEYS`: `court_hearings: { key: 'caseView.stepper.courtHearings', fallback: 'Court Hearings' }`
- `STEP_DESCRIPTIONS`: `court_hearings: { key: 'caseView.stepper.courtHearingsDesc', fallback: 'Record court hearings; dates sync to the team calendar' }`
- `STEP_PHASE`: `court_hearings: 'phaseIn'`
- `STEP_FLOORS`: `court_hearings: 0`
- `stepperStepDone` switch: `case 'court_hearings': return (opts.courtHearingCount ?? 0) > 0;`

- [ ] **Step 5: Run suites**

Run: `cd kapwa-server && npx jest case-step-locks --silent && cd ../kapwa-client && npm run typecheck && npm run test:run -- --run case/ 2>/dev/null || npm run test:run`
Expected: server + client PASS.

- [ ] **Step 6: Commit**

```bash
git add kapwa-server/src/cases/case-step-labels.ts kapwa-server/src/cases/case-step-locks.service.ts kapwa-server/src/cases/case-step-locks.service.spec.ts docs/superpowers/specs/case-step-done-fixture.json kapwa-client/src/components/case-view/CaseStepper.tsx kapwa-client/src/components/case-view/CaseStepper.done.test.ts
git commit -m "feat(steps): court_hearings step for legal categories
Injected between assessment and enrollments in the CICL/VAWC/CNSP/
Adoption/Court-Ordered-SCS templates; seal predicate = >=1 non-cancelled
hearing; client stepper mirrors templates, labels, floors and the done
branch via StepperProgressOpts.courtHearingCount."
```

---

### Task 6: Client — case-events API + StepCourtHearings + CaseViewPage mount

**Files:**
- Create: `kapwa-client/src/lib/case-events-api.ts`
- Create: `kapwa-client/src/components/case-view/StepCourtHearings.tsx`
- Create: `kapwa-client/src/components/case-view/StepCourtHearings.test.tsx`
- Modify: `kapwa-client/src/lib/query-keys.ts` (caseEvents key)
- Modify: `kapwa-client/src/pages/CaseViewPage.tsx` (SWR fetch of events count + `mountStep` case `'court_hearings'` + `StepperProgressOpts.courtHearingCount` plumbed into the stepper props)
- Modify: `kapwa-client/src/i18n/locales/en/index.ts` and `fil/index.ts`

**Interfaces:**
- Produces: `getCaseEvents(caseId)`, `createCaseEvent(caseId, input)`, `updateCaseEvent(caseId, eventId, patch)`, `deleteCaseEvent(caseId, eventId)`; `CaseEvent` client type; `StepCourtHearings` with the same props contract as `StepEnrollments` (`{ caseId, caseData, stepLock, userRole, readOnly, lockReadOnly }`).
- Consumes: server routes from Task 4; `queryKeys.caseEvents(caseId)`.

- [ ] **Step 1: Write the failing component test**

`StepCourtHearings.test.tsx` (mirror `StepEnrollments.test.tsx`'s setup — SWR wrapper, api mock):

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StepCourtHearings } from './StepCourtHearings';

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), del: jest.fn() },
}));

import { api } from '@/lib/api';

describe('StepCourtHearings', () => {
  const props = { caseId: 'c1', caseData: { controlNo: 'MSWD-2026-0012' }, stepLock: null, userRole: 'social_worker', readOnly: false, lockReadOnly: false } as any;

  it('renders recorded hearings and the add form', async () => {
    (api.get as jest.Mock).mockResolvedValue([
      { id: 'e1', eventType: 'court_hearing', attended: true, title: 'Hearing', venue: 'RTC Bulacan', eventDate: '2026-10-20', startTime: '09:00', status: 'planned' },
    ]);
    render(<StepCourtHearings {...props} />);
    expect(await screen.findByText(/Hearing/)).toBeTruthy();
    expect(screen.getByText(/RTC Bulacan/)).toBeTruthy();
  });

  it('creates an attended hearing and posts it', async () => {
    (api.get as jest.Mock).mockResolvedValue([]);
    (api.post as jest.Mock).mockResolvedValue({});
    render(<StepCourtHearings {...props} />);
    fireEvent.click(await screen.findByRole('button', { name: /Add Hearing/ }));
    fireEvent.change(await screen.findByLabelText(/Date/), { target: { value: '2026-11-02' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      expect.stringContaining('/cases/c1/events'),
      expect.objectContaining({ eventType: 'court_hearing', eventDate: '2026-11-02' }),
    ));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd kapwa-client && npm run test:run -- StepCourtHearings`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the API wrapper + component**

`lib/case-events-api.ts`:
```ts
import { api } from './api';

export type CaseEventType = 'court_hearing' | 'home_visit';

export interface CaseEvent {
  id: string;
  caseId: string;
  eventType: string;
  attended?: boolean | null;
  title?: string | null;
  venue?: string | null;
  eventDate: string;
  startTime?: string | null;
  endTime?: string | null;
  notes?: string | null;
  status: string;
}

export interface CaseEventInput {
  eventType: CaseEventType;
  attended?: boolean | null;
  title?: string | null;
  venue?: string | null;
  eventDate: string;
  startTime?: string | null;
  endTime?: string | null;
  notes?: string | null;
}

export const getCaseEvents = (caseId: string) => api.get<CaseEvent[]>(`/cases/${caseId}/events`);
export const createCaseEvent = (caseId: string, input: CaseEventInput) => api.post<CaseEvent>(`/cases/${caseId}/events`, input);
export const updateCaseEvent = (caseId: string, eventId: string, patch: Partial<CaseEventInput> & { status?: string }) =>
  api.patch<CaseEvent>(`/cases/${caseId}/events/${eventId}`, patch);
export const deleteCaseEvent = (caseId: string, eventId: string) => api.del<{ deleted: boolean }>(`/cases/${caseId}/events/${eventId}`);
```

`StepCourtHearings.tsx`: mirror `StepEnrollments.tsx` structure (self-titled card, `useTranslation`, `api.get` via the wrapper inside `useSWR(queryKeys.caseEvents(caseId), () => getCaseEvents(caseId))`), `readOnly` hides the form, list rows show date/time/venue/attended badge, row actions: Complete (PATCH `{ status: 'done' }`), Cancel (PATCH `{ status: 'cancelled' }`), Delete (confirm + DELETE), Add Hearing form with Date/Time/Venue/Attending toggle/Notes. After each mutation `mutate()` the SWR key. Use the exact i18n keys below.

- [ ] **Step 4: CaseViewPage mount + count**

- `query-keys.ts`: add `caseEvents: (caseId: string) => ['case-events', caseId] as const`.
- `CaseViewPage.tsx`: near the other SWR hooks, `const { data: hearings } = useSWR(queryKeys.caseEvents(id!), () => getCaseEvents(id!));` and pass `courtHearingCount={(hearings ?? []).filter(e => e.status !== 'cancelled').length}` into the `<CaseStepper …/>` props and the `StepperProgressOpts` used by `stepperStatus`.
- `mountStep`: add
```tsx
        case 'court_hearings':
          return <StepCourtHearings key={stepLockKey(id!, key)} {...common}
            readOnly={bodyReadOnly(caseClosed, key)} lockReadOnly={caseClosed} />;
```
and import `StepCourtHearings`.

- [ ] **Step 5: i18n (en + fil)**

Add to `i18n/locales/en/index.ts` (and the exact mirror in `fil/index.ts`):
- `caseView.stepper.courtHearings: 'Court Hearings'`, `caseView.stepper.courtHearingsDesc: 'Record court hearings; dates sync to the team calendar'`
- `caseView.hearings.title: 'Court Hearings'`, `caseView.hearings.add: 'Add Hearing'`, `caseView.hearings.date: 'Date'`, `caseView.hearings.time: 'Time'`, `caseView.hearings.venue: 'Venue / Court'`, `caseView.hearings.attending: 'Office will attend'`, `caseView.hearings.notes: 'Notes'`, `caseView.hearings.save: 'Save Hearing'`, `caseView.hearings.complete: 'Mark Done'`, `caseView.hearings.cancel: 'Cancel Hearing'`, `caseView.hearings.delete: 'Delete'`, `caseView.hearings.attendingBadge: 'Attending'`, `caseView.hearings.notAttendingBadge: 'Not attending'`, `caseView.hearings.empty: 'No hearings recorded yet'`
- `caseView.stepper` entries must stay inserted in the same object so both locales keep parity.

- [ ] **Step 6: Run the client suites**

Run: `cd kapwa-client && npm run typecheck && npm run test:run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add kapwa-client/src/lib/case-events-api.ts kapwa-client/src/lib/query-keys.ts kapwa-client/src/components/case-view/StepCourtHearings.tsx kapwa-client/src/components/case-view/StepCourtHearings.test.tsx kapwa-client/src/pages/CaseViewPage.tsx kapwa-client/src/i18n/locales
git commit -m "feat(case-view): court hearings step UI
StepCourtHearings (list/add/complete/cancel/delete) mounted for the
court_hearings template key; CaseViewPage fetches events and feeds
courtHearingCount into the stepper done-predicate; i18n en+fil."
```

---

### Task 7: Client — scheduled home visits in StepTransition

**Files:**
- Modify: `kapwa-client/src/components/case-view/StepTransition.tsx`
- Modify: `kapwa-client/src/components/case-view/StepTransition.test.tsx`
- Modify: `kapwa-client/src/i18n/locales/en/index.ts` + `fil/index.ts`

**Interfaces:**
- Consumes: `getCaseEvents/createCaseEvent/updateCaseEvent/deleteCaseEvent`, `queryKeys.caseEvents`.
- Produces: a "Scheduled Home Visits" area in the Evaluate step: planned `home_visit` events listed with date/time/notes, Add form, Complete (PATCH done), Cancel. `visitsReadOnly` (the same flag that read-onlys the history) hides the controls.

- [ ] **Step 1: Write the failing tests**

In `StepTransition.test.tsx` add (mirroring the existing fixture-based renders; api mock returns `[]` for case-events by default):

```tsx
  it('lists scheduled home visits and completes one', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (String(url).includes('/events')) return Promise.resolve([
        { id: 'e1', eventType: 'home_visit', eventDate: '2026-10-24', startTime: '14:00', notes: 'Check-up', status: 'planned' },
      ]);
      return Promise.resolve(mockCaseData);
    });
    render(<StepTransition {...baseProps} />);
    expect(await screen.findByText(/Check-up/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Complete/ }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(
      expect.stringContaining('/events/e1'), expect.objectContaining({ status: 'done' }),
    ));
  });
```
(Read the existing test file's setup first — adapt the api mock and `baseProps` to what it already defines.)

- [ ] **Step 2: Run to verify failure**

Run: `cd kapwa-client && npm run test:run -- StepTransition`
Expected: FAIL — new expectations unmet.

- [ ] **Step 3: Implement the section**

In `StepTransition.tsx`, below the Follow-up Visits card, add a "Scheduled Home Visits" card: `useSWR(queryKeys.caseEvents(caseId), () => getCaseEvents(caseId))`, filter `eventType === 'home_visit' && status === 'planned'`, render rows (date, time, notes, source-venue), Complete and Cancel buttons (disabled when `visitsReadOnly`), and an inline Add form (date/time/notes) posting `createCaseEvent(caseId, { eventType: 'home_visit', eventDate, startTime, notes })` then `mutate()`. New i18n keys: `caseView.transition.scheduledVisits`, `caseView.transition.scheduleVisit`, `caseView.transition.scheduledEmpty` (en + fil).

- [ ] **Step 4: Run the client suites**

Run: `cd kapwa-client && npm run typecheck && npm run test:run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add kapwa-client/src/components/case-view/StepTransition.tsx kapwa-client/src/components/case-view/StepTransition.test.tsx kapwa-client/src/i18n/locales
git commit -m "feat(case-view): scheduled home visits in the Evaluate step
Planned home_visit events listed, scheduled, completed and cancelled from
StepTransition; history ledger untouched."
```

---

### Task 8: Reminder engine + consent defaults (server)

**Files:**
- Create: `kapwa-server/src/case-events/case-event-reminder.service.ts`
- Create: `kapwa-server/src/case-events/case-event-reminder.service.spec.ts`
- Modify: `kapwa-server/src/notifications/notification.entity.ts` (enum values `COURT_HEARING`, `HOME_VISIT`)
- Modify: `kapwa-server/src/notifications/notifications.service.ts` (`checkConsent` default-on for the two categories on the email channel)
- Modify: `kapwa-server/src/case-events/case-events.module.ts` (provider registration; NO second `ScheduleModule.forRoot()` — the SLA module's global discovery already picks up new `@Cron` providers)

**Interfaces:**
- Produces: `CaseEventReminderService` with `@Cron(CronExpression.EVERY_15_MINUTES, { name: 'case-event-reminders' }) handleReminders()`, plus injectable `checkForReminders(): Promise<{ dispatched: number; skipped: number }>` for tests.
- Consumes: `CaseEvent`, `CaseEventReminder`, `ReminderSetting`, `Case`, `User` repos; `NotificationsService` (create + email); constants.
- `NotificationCategory` gains `COURT_HEARING = 'court_hearing'`, `HOME_VISIT = 'home_visit'`.

- [ ] **Step 1: Write the failing tests**

`case-event-reminder.service.spec.ts` (hand-built, mocked repos + notifications service):

```ts
import { CaseEventReminderService } from './case-event-reminder.service';

describe('CaseEventReminderService', () => {
  const events = { find: jest.fn() };
  const reminders = { findOne: jest.fn(), insert: jest.fn(), update: jest.fn() };
  const settings = { findOne: jest.fn() };
  const cases = { findOne: jest.fn() };
  const users = { findOne: jest.fn() };
  const notifs = { create: jest.fn(), checkConsent: jest.fn(), deliverByConsent: jest.fn() };
  const svc = new CaseEventReminderService(events as any, reminders as any, settings as any, cases as any, users as any, notifs as any);

  const now = new Date('2026-10-19T09:00:00Z');
  const event = {
    id: 'e1', caseId: 'c1', eventType: 'court_hearing', attended: true,
    eventDate: '2026-10-20', startTime: '09:00', venue: 'RTC', title: 'Hearing', status: 'planned',
  };
  const caseRow = { id: 'c1', controlNo: 'MSWD-2026-0012', assignedWorkerId: 'w1' };

  beforeEach(() => {
    jest.clearAllMocks();
    events.find.mockResolvedValue([event]);
    cases.findOne.mockResolvedValue(caseRow);
    users.findOne.mockResolvedValue({ id: 'w1', email: 'worker@mswdo.gov', isActive: true });
    settings.findOne.mockResolvedValue({ scope: 'system', eventType: 'court_hearing', offsets: [4320, 1440, 180] });
    reminders.findOne.mockResolvedValue(null);
    notifs.create.mockResolvedValue({ id: 'n1' });
    notifs.checkConsent.mockResolvedValue(true);
  });

  it('dispatches in-app + email for a due offset and claims both rows', async () => {
    const res = await svc.checkForReminders(now);
    expect(res.dispatched).toBe(2); // 1 day + 3h are due; 3 days already passed this tick
    expect(reminders.insert).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'e1', offsetMinutes: 1440, channel: 'in_app' }));
    expect(reminders.insert).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'e1', offsetMinutes: 1440, channel: 'email' }));
    expect(notifs.create).toHaveBeenCalledTimes(1); // one in-app row
  });

  it('does not claim already-sent offsets (dedupe)', async () => {
    reminders.findOne.mockImplementation(({ where }) =>
      Promise.resolve(where.offsetMinutes === 1440 ? { eventId: 'e1' } : null));
    const res = await svc.checkForReminders(now);
    expect(reminders.insert).not.toHaveBeenCalledWith(expect.objectContaining({ offsetMinutes: 1440 }));
  });

  it('uses the worker override when present, else the system default', async () => {
    settings.findOne.mockImplementation(({ where }) =>
      Promise.resolve(where.scope === 'worker'
        ? { scope: 'worker', eventType: 'court_hearing', offsets: [60] }
        : { scope: 'system', eventType: 'court_hearing', offsets: [4320, 1440, 180] }));
    const res = await svc.checkForReminders(now);
    expect(res.dispatched).toBe(2); // 60-min offset due for in_app + email
  });

  it('skips hearings the office is not attending', async () => {
    events.find.mockResolvedValue([{ ...event, attended: null }]);
    const res = await svc.checkForReminders(now);
    expect(res.dispatched).toBe(0);
  });

  it('never dispatches for done, cancelled, or past events', async () => {
    events.find.mockResolvedValue([
      { ...event, status: 'done' },
      { ...event, status: 'cancelled' },
      { ...event, id: 'e2', eventDate: '2026-10-18', status: 'planned' },
    ]);
    const res = await svc.checkForReminders(now);
    expect(res.dispatched).toBe(0);
  });

  it('emails only when consent says so; missing email falls back to in-app only', async () => {
    users.findOne.mockResolvedValue({ id: 'w1', email: null, isActive: true });
    const res = await svc.checkForReminders(now);
    expect(res.dispatched).toBe(1); // in-app only
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd kapwa-server && npx jest case-event-reminder --silent`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the reminder service**

`case-event-reminder.service.ts` (core):

```ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThan, Not } from 'typeorm';
import { CaseEvent } from './case-event.entity';
import { CaseEventReminder } from './case-event-reminder.entity';
import { ReminderSetting } from './reminder-setting.entity';
import { Case } from '../cases/case.entity';
import { User } from '../auth/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationCategory, NotificationType } from '../notifications/notification.entity';

const REMINDER_CHANNELS = ['in_app', 'email'] as const;

// Chained-reminder dispatcher: every 15 minutes it finds planned, upcoming
// events whose lead-time window has opened, claims a dedupe row per
// (event, offset, channel) BEFORE delivering, and only then sends. The claim
// row makes overlapping ticks safe; a failed email is not retried (in-app is
// the authoritative channel). No ScheduleModule.forRoot() here — the SLA
// module's registration discovers @Cron providers app-wide.
@Injectable()
export class CaseEventReminderService {
  private readonly logger = new Logger(CaseEventReminderService.name);

  constructor(
    @InjectRepository(CaseEvent) private readonly events: Repository<CaseEvent>,
    @InjectRepository(CaseEventReminder) private readonly ledger: Repository<CaseEventReminder>,
    @InjectRepository(ReminderSetting) private readonly settings: Repository<ReminderSetting>,
    @InjectRepository(Case) private readonly cases: Repository<Case>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_15_MINUTES, { name: 'case-event-reminders' })
  async handleReminders(): Promise<void> {
    await this.checkForReminders(new Date());
  }

  // Exposed for tests: the cron wrapper is the only thing the scheduler runs.
  async checkForReminders(now: Date): Promise<{ dispatched: number; skipped: number }> {
    let dispatched = 0; let skipped = 0;
    const upcoming = await this.events.find({
      where: { status: 'planned', eventDate: MoreThan(now.toISOString().slice(0, 10)) },
    });
    // Pick up events later today whose previous offsets already passed this
    // tick but whose event datetime is still ahead.
    const today = await this.events.find({
      where: { status: 'planned', eventDate: now.toISOString().slice(0, 10) },
    });
    const candidates = [...upcoming, ...today.filter(t => !upcoming.some(u => u.id === t.id))];
    for (const event of candidates) {
      if (event.eventType === 'court_hearing' && event.attended !== true) { skipped++; continue; }
      const c = await this.cases.findOne({ where: { id: event.caseId } });
      if (!c?.assignedWorkerId) { skipped++; continue; }
      const offsets = await this.resolveOffsets(event.eventType, c.assignedWorkerId);
      const eventAt = this.eventDateTime(event);
      if (eventAt.getTime() <= now.getTime()) { skipped++; continue; }
      for (const offset of offsets) {
        const remindAt = new Date(eventAt.getTime() - offset * 60_000);
        if (remindAt.getTime() > now.getTime()) continue; // not yet due
        for (const channel of REMINDER_CHANNELS) {
          const claimed = await this.ledger.findOne({ where: { eventId: event.id, offsetMinutes: offset, channel } });
          if (claimed) continue;
          await this.ledger.insert({ eventId: event.id, offsetMinutes: offset, channel });
          const ok = await this.deliver(event, c.controlNo, c.assignedWorkerId, channel);
          if (ok) {
            const row = await this.ledger.findOne({ where: { eventId: event.id, offsetMinutes: offset, channel } });
            if (row) await this.ledger.update(row.id, { sentAt: new Date() });
          }
          dispatched++;
        }
      }
    }
    return { dispatched, skipped };
  }

  private eventDateTime(event: CaseEvent): Date {
    const base = `${event.eventDate}T${event.startTime ?? '00:00'}:00`;
    const d = new Date(base.endsWith('00:00') ? `${event.eventDate}T00:00:00` : base);
    return Number.isNaN(d.getTime()) ? new Date(`${event.eventDate}T00:00:00Z`) : d;
  }

  // Worker override row wins; otherwise the system default. Absent rows for
  // either scope mean zero offsets (no reminders), never a crash.
  async resolveOffsets(eventType: string, workerId: string): Promise<number[]> {
    const worker = await this.settings.findOne({ where: { scope: 'worker', userId: workerId, eventType } });
    if (worker) return Array.isArray(worker.offsets) ? worker.offsets : [];
    const system = await this.settings.findOne({ where: { scope: 'system', eventType } });
    return system && Array.isArray(system.offsets) ? system.offsets : [];
  }

  private async deliver(
    event: CaseEvent, controlNo: string, workerId: string, channel: 'in_app' | 'email',
  ): Promise<boolean> {
    const label = event.eventType === 'court_hearing' ? 'Court hearing' : 'Home visit';
    const when = `${event.eventDate}${event.startTime ? ` ${event.startTime}` : ''}`;
    const where = event.venue ? ` at ${event.venue}` : '';
    const title = `Reminder: ${label} — ${controlNo}`;
    const message = `Case ${controlNo}: ${label} on ${when}${where}.${event.notes ? ` ${event.notes}` : ''}`;
    const category = event.eventType === 'court_hearing'
      ? NotificationCategory.COURT_HEARING : NotificationCategory.HOME_VISIT;
    if (channel === 'in_app') {
      await this.notifications.create({
        recipientId: workerId, title, message, category,
        referenceId: event.caseId, // case id so the client links to the case
      });
      return true;
    }
    // email: default-on consent for these categories, needs an address
    if (!(await this.notifications.checkConsent(workerId, NotificationType.EMAIL, category))) return false;
    const user = await this.users.findOne({ where: { id: workerId, isActive: true } });
    if (!user?.email) return false;
    try {
      return await this.notifications.sendEmailDirect(user.email, title, message);
    } catch {
      this.logger.warn(`Reminder email failed for event ${event.id}`);
      return false;
    }
  }
}
```

Add `sendEmailDirect(email, subject, body)` to `NotificationsService` (thin passthrough to `emailService.sendNotificationEmail`, so the reminder service does not depend on EmailService's transporter directly).

- [ ] **Step 4: Enum values + consent default-on**

`notification.entity.ts`:
```ts
  COURT_HEARING = 'court_hearing',
  HOME_VISIT = 'home_visit',
```

`notifications.service.ts`:
```ts
// Reminder categories are default-on for EMAIL when no preference row exists
// (absent = opted in), so planned-hearing/visit emails actually flow; workers
// opt out via Settings. Every other category keeps absent = opted out.
const EMAIL_DEFAULT_OPTIN_CATEGORIES: ReadonlySet<NotificationCategory> = new Set([
  NotificationCategory.COURT_HEARING,
  NotificationCategory.HOME_VISIT,
]);

async checkConsent(userId: string, channel: string, category: NotificationCategory): Promise<boolean> {
  const pref = await this.notifPrefRepo.findOne({
    where: { userId, channel: channel as any, category },
  });
  if (pref) return pref.optedIn;
  return channel === NotificationType.EMAIL && EMAIL_DEFAULT_OPTIN_CATEGORIES.has(category);
}
```

- [ ] **Step 5: Module registration**

`case-events.module.ts` providers += `CaseEventReminderService`. Do NOT add `ScheduleModule` — verify `sla.module.ts` still owns the only `ScheduleModule.forRoot()`.

- [ ] **Step 6: Run the suites**

Run: `cd kapwa-server && npm run typecheck && npx jest case-event-reminder notifications --silent`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add kapwa-server/src/case-events/case-event-reminder.service.ts kapwa-server/src/case-events/case-event-reminder.service.spec.ts kapwa-server/src/case-events/case-events.module.ts kapwa-server/src/notifications/notification.entity.ts kapwa-server/src/notifications/notifications.service.ts
git commit -m "feat(reminders): chained reminder dispatcher (15-min cron)
Planned upcoming events dispatch per resolved offset with a claim-first
dedupe ledger per (event, offset, channel); worker overrides beat system
defaults; hearings require attended=true; email default-on for the two
new categories, skipped without consent/address; in-app always."
```

---

### Task 9: Reminder settings API (system + worker)

**Files:**
- Create: `kapwa-server/src/case-events/reminder-settings.service.ts`
- Create: `kapwa-server/src/case-events/reminder-settings.controller.ts`
- Create: `kapwa-server/src/case-events/dto/reminder-settings.zod.ts`
- Create: `kapwa-server/src/case-events/reminder-settings.service.spec.ts` + `reminder-settings.controller.spec.ts`
- Modify: `kapwa-server/src/case-events/case-events.module.ts`

**Interfaces:**
- Produces:
  - `ReminderSettingsService`:
    - `systemDefaults(): Promise<ReminderSetting[]>`
    - `saveSystemDefaults(input: ReminderSettingDraft[], actorId): Promise<ReminderSetting[]>` (admin)
    - `workerSettings(userId): Promise<ReminderSetting[]>`
    - `saveWorkerSettings(userId, input, actorId): Promise<ReminderSetting[]>`
    - `resolveOffsets(eventType, workerId)` — same logic as Task 8's private one; Task 8 Step 3's service should call this instead (refactor in this task: `resolveOffsets` moves here; `CaseEventReminderService` delegates with `settingsService.resolveOffsets(...)`).
  - DTO: `ReminderSettingDraft = { eventType: 'court_hearing' | 'home_visit'; offsets: number[] }` with zod `offsets` rules: array of positive ints, strictly descending, max length 5, max single offset 30 days (43200 min).
- Routes: `GET/PUT /reminder-settings/system` (`@Roles('admin')`), `GET/PUT /reminder-settings/me` (admin, social_worker).

- [ ] **Step 1: Write the failing tests**

`reminder-settings.service.spec.ts`:
```ts
import { BadRequestException } from '@nestjs/common';
import { ReminderSettingsService } from './reminder-settings.service';

describe('ReminderSettingsService', () => {
  const settings = { find: jest.fn(), findOne: jest.fn(), upsert: jest.fn() };
  const svc = new ReminderSettingsService(settings as any);

  beforeEach(() => jest.clearAllMocks());

  it('validates offsets are strictly descending positive integers', async () => {
    await expect(svc.validateOffsets([60, 0])).rejects.toThrow(BadRequestException);
    await expect(svc.validateOffsets([60, 120])).rejects.toThrow(BadRequestException);
    await expect(svc.validateOffsets([])).resolves.toBeUndefined(); // explicit disable
    await expect(svc.validateOffsets([4320, 1440, 180])).resolves.toBeUndefined();
  });

  it('saves system defaults keyed by event type', async () => {
    settings.upsert.mockResolvedValue({});
    await svc.saveSystemDefaults([
      { eventType: 'court_hearing', offsets: [1440] },
      { eventType: 'home_visit', offsets: [180] },
    ], 'u1');
    expect(settings.upsert).toHaveBeenCalledTimes(2);
    for (const call of (settings.upsert as jest.Mock).mock.calls) {
      expect(call[0]).toMatchObject({ scope: 'system', userId: null, updatedBy: 'u1' });
    }
  });

  it('rejects an unknown event type', async () => {
    await expect(svc.saveSystemDefaults([{ eventType: 'birthday', offsets: [60] }], 'u1'))
      .rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd kapwa-server && npx jest reminder-settings --silent`
Expected: FAIL.

- [ ] **Step 3: Implement**

`dto/reminder-settings.zod.ts`:
```ts
import { z } from 'zod';

export const ReminderSettingDraftSchema = z.object({
  eventType: z.enum(['court_hearing', 'home_visit']),
  offsets: z.array(z.number().int().positive()).max(5),
}).strict();

export const ReminderSettingsBulkSchema = z.array(ReminderSettingDraftSchema).max(10);
export type ReminderSettingDraft = z.infer<typeof ReminderSettingDraftSchema>;
```
(Strictly-descending is a semantic rule applied in the service — `validateOffsets` below — because the error message should name the failing order, and the zod array rule cannot compare neighbors.)

`reminder-settings.service.ts`:
```ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReminderSetting } from './reminder-setting.entity';
import { ReminderSettingDraft, ReminderSettingsBulkSchema } from './dto/reminder-settings.zod';

// Lead-time configuration. System rows (admin) are the defaults every worker
// starts from; worker rows override only their own reminders. An empty
// offsets array is an explicit "no reminders for me" (worker) or a system
// default of none.
@Injectable()
export class ReminderSettingsService {
  constructor(
    @InjectRepository(ReminderSetting) private readonly repo: Repository<ReminderSetting>,
  ) {}

  validateOffsets(offsets: number[]): void {
    for (let i = 0; i < offsets.length; i++) {
      if (!Number.isInteger(offsets[i]) || offsets[i] <= 0) {
        throw new BadRequestException('Reminder offsets must be positive whole minutes.');
      }
      if (i > 0 && offsets[i - 1] <= offsets[i]) {
        throw new BadRequestException('Reminder offsets must be strictly descending (largest first).');
      }
    }
  }

  private validateAll(input: ReminderSettingDraft[]): void {
    const parsed = ReminderSettingsBulkSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException('Invalid reminder settings payload.');
    }
    for (const draft of parsed.data) this.validateOffsets(draft.offsets);
  }

  async systemDefaults(): Promise<ReminderSetting[]> {
    return this.repo.find({ where: { scope: 'system' }, order: { eventType: 'ASC' } });
  }

  async saveSystemDefaults(input: ReminderSettingDraft[], actorId: string): Promise<ReminderSetting[]> {
    this.validateAll(input);
    for (const draft of input) {
      await this.repo.upsert(
        { scope: 'system', userId: null, eventType: draft.eventType, offsets: draft.offsets, updatedBy: actorId },
        { conflictPaths: ['scope', 'user_id', 'event_type'] },
      );
    }
    return this.systemDefaults();
  }

  async workerSettings(userId: string): Promise<ReminderSetting[]> {
    return this.repo.find({ where: { scope: 'worker', userId }, order: { eventType: 'ASC' } });
  }

  async saveWorkerSettings(userId: string, input: ReminderSettingDraft[], actorId: string): Promise<ReminderSetting[]> {
    this.validateAll(input);
    for (const draft of input) {
      await this.repo.upsert(
        { scope: 'worker', userId, eventType: draft.eventType, offsets: draft.offsets, updatedBy: actorId },
        { conflictPaths: ['scope', 'user_id', 'event_type'] },
      );
    }
    return this.workerSettings(userId);
  }
}
```
> Note: `upsert` with partial unique indexes (`WHERE scope='worker'` …) does not resolve conflict targets by expression — verify against the actual DB behavior in the dev suite; if `conflictPaths` fails against the partial indexes, fall back to find-one-or-insert (`repo.findOne({ where: { scope, userId, eventType } })` then `save`) which is what the plan's tests assert through the mock anyway.

`reminder-settings.controller.ts`:
```ts
import { Body, Controller, Get, Put, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AbacGuard } from '../auth/guards/abac.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedRequest } from '../auth/types';
import { ReminderSettingsService } from './reminder-settings.service';
import { ReminderSettingDraft } from './dto/reminder-settings.zod';

@ApiTags('Reminder Settings')
@Controller('reminder-settings')
@UseGuards(JwtAuthGuard, RolesGuard, AbacGuard)
@ApiBearerAuth()
export class ReminderSettingsController {
  constructor(private readonly svc: ReminderSettingsService) {}

  @Get('system')
  @Roles('admin')
  systemDefaults() { return this.svc.systemDefaults(); }

  @Put('system')
  @Roles('admin')
  saveSystemDefaults(@Body() dto: ReminderSettingDraft[], @Request() req: AuthenticatedRequest) {
    return this.svc.saveSystemDefaults(dto, req.user.id);
  }

  @Get('me')
  @Roles('admin', 'social_worker')
  mine(@Request() req: AuthenticatedRequest) { return this.svc.workerSettings(req.user.id); }

  @Put('me')
  @Roles('admin', 'social_worker')
  saveMine(@Body() dto: ReminderSettingDraft[], @Request() req: AuthenticatedRequest) {
    return this.svc.saveWorkerSettings(req.user.id, dto, req.user.id);
  }
}
```

Refactor Task 8: `CaseEventReminderService.resolveOffsets` becomes `ReminderSettingsService.resolveOffsets(eventType, workerId)` (same body) and the reminder service injects `ReminderSettingsService` (registered in the same module). Update the reminder spec's construction accordingly.

- [ ] **Step 4: Controller spec (roles metadata)**

`reminder-settings.controller.spec.ts`: assert `@Roles('admin')` on system routes and `('admin','social_worker')` on me routes via `Reflect.getMetadata('roles', handler)` — mirror `case-events.controller.spec.ts` style from Task 4.

- [ ] **Step 5: Run the suites**

Run: `cd kapwa-server && npm run typecheck && npx jest case-events reminder --silent`
Expected: PASS (adjust the reminder spec's constructor call for the refactor).

- [ ] **Step 6: Commit**

```bash
git add kapwa-server/src/case-events
git commit -m "feat(reminder-settings): system defaults + worker overrides API
GET/PUT /reminder-settings/{system,me} with zod validation (positive,
strictly descending offsets, <=5, explicit [] disables); resolveOffsets
moved here so the dispatcher and the API share one resolution rule."
```

---

### Task 10: Client — Settings reminder card + notification categories + WeekView

**Files:**
- Modify: `kapwa-client/src/pages/SettingsPage.tsx` (CATEGORIES const += the two new ones; reminder settings card)
- Modify: `kapwa-client/src/pages/SettingsPage.test.tsx`
- Modify: `kapwa-client/src/pages/NotificationsPage.tsx` + `kapwa-client/src/components/NotificationsDropdown.tsx` (+ their tests) — category label/color/route entries
- Modify: `kapwa-client/src/components/team/team-utils.ts` — `BLOCK_COLORS['court_hearing']`, `BLOCK_TYPE_LABEL_KEYS['court_hearing']`
- Modify: `kapwa-client/src/components/team/WeekView.tsx` — synced-block edit guard + `source` rendering note
- Modify: `kapwa-client/src/lib/team-api.ts` — `TeamBlock` gains `source?: string; sourceRef?: string | null;`
- Modify: `kapwa-client/src/i18n/locales/en/index.ts` + `fil/index.ts`

**Interfaces:**
- Consumes: `ReminderSettingDraft` shape; `GET/PUT /reminder-settings/system|me` raw api calls (no wrapper file needed — SettingsPage already calls `api.get/put` for prefs); notification category maps in `NotificationsPage.tsx`/`NotificationsDropdown.tsx` (routes use `referenceId` = case id → `/cases/<id>`).

- [ ] **Step 1: Write the failing test — settings card**

In `SettingsPage.test.tsx` (existing prefs test style):
```tsx
  it('loads worker reminder settings into the reminder card', async () => {
    ... // stub api.get for /reminder-settings/me with
        // [{ eventType: 'court_hearing', offsets: [1440] }]
    render(<SettingsPage ... />);
    fireEvent.click(await screen.findByRole('button', { name: /Reminder settings/i }));
    expect(await screen.findByText(/Court Hearing/)).toBeTruthy();
  });
```
(Read the file's existing mock wiring first and extend it; the assertion must match the card's actual rendered label keys.)

- [ ] **Step 2: WeekView test — court_hearing renders with its color and synced blocks carry the source**

In `WeekView.test.tsx`, add a block `{ id: 'b1', userId: 'u1', blockDate: today, blockType: 'court_hearing', source: 'case_event', note: 'Case MSWD-2026-0012 — Hearing' }` and assert the note text renders (`getByText(/MSWD-2026-0012/)`) and the cell does not offer an edit affordance where the existing tests assert one exists for manual blocks (find the existing edit/delete affordance test and mirror its inverse).

- [ ] **Step 3: Run to verify failure**

Run: `cd kapwa-client && npm run test:run -- SettingsPage WeekView`
Expected: FAIL.

- [ ] **Step 4: Implement**

- `SettingsPage.tsx`: `CATEGORIES` lines 27 becomes `['case_update', 'approval', 'disbursement', 'chat', 'sync_conflict', 'system', 'court_hearing', 'home_visit'] as const;` (labels via a label map — add `court_hearing`/`home_visit` entries alongside the existing ones in that file). Add a **Reminder settings** card: `useSWR(['reminder-settings', 'me'], () => api.get('/reminder-settings/me'))` (and system defaults when `user.role === 'admin'`), per event type an offset row (chips `3 days / 1 day / 3 hours` that append/remove the minutes values `[4320, 1440, 180]`, an "off" state showing `[]`), Save button PUTting `{ eventType, offsets }[]`; admins additionally get a "System defaults (all workers)" section saving via PUT `/reminder-settings/system`.
- `team-utils.ts`: `BLOCK_COLORS['court_hearing'] = 'border-purple-400 bg-purple-50 text-purple-700'` (match the existing color-map value shape) and `BLOCK_TYPE_LABEL_KEYS['court_hearing'] = 'team.week.courtHearing'`; add `team.week.courtHearing: 'Court Hearing'` to both locale files.
- `team-api.ts`: extend `TeamBlock` with `source?: string; sourceRef?: string | null;`.
- `WeekView.tsx` + its owning page: where block edit/delete actions render, guard with `block.source !== 'case_event'` (synced rows get a muted "synced from case file" note instead — `team.week.syncedFromCase`), and pass `source` from the API shape.
- `NotificationsPage.tsx` + `NotificationsDropdown.tsx`: category maps gain
```ts
  court_hearing: n.referenceId ? `/cases/${n.referenceId}` : '/cases',
  home_visit: n.referenceId ? `/cases/${n.referenceId}` : '/cases',
```
plus labels (`notifications.catCourtHearing`: 'Court Hearing', `notifications.catHomeVisit`: 'Home Visit') and a badge color (e.g. purple/amber like the existing map values).

- [ ] **Step 5: i18n (en + fil)** — `settings.reminders.title/desc/labels`, `team.week.courtHearing`, `team.week.syncedFromCase`, `notifications.catCourtHearing/catHomeVisit`, category grid labels.

- [ ] **Step 6: Run the client suites**

Run: `cd kapwa-client && npm run typecheck && npm run test:run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add kapwa-client/src/pages/SettingsPage.tsx kapwa-client/src/pages/SettingsPage.test.tsx kapwa-client/src/pages/NotificationsPage.tsx kapwa-client/src/components/NotificationsDropdown.tsx kapwa-client/src/components/team/team-utils.ts kapwa-client/src/components/team/WeekView.tsx kapwa-client/src/lib/team-api.ts kapwa-client/src/i18n/locales
git commit -m "feat(settings): reminder lead-time card, hearing/visit categories, week-view
Reminder settings card (worker overrides + admin system defaults with
offset chips); notification categories court_hearing/home_visit in the
prefs grid, bell, and notifications page; WeekView renders court_hearing
blocks and marks synced blocks read-only; i18n en+fil."
```

---

### Task 11: SLA drive-by fix (dropped column)

**Files:**
- Modify: `kapwa-server/src/sla/sla.service.ts` (ACTIVE branch — remove the `waiting_period_days` raw query, use the `APPROVED_*` constants fallback the comment already promises)
- Modify: `kapwa-server/src/sla/sla.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Find the ACTIVE-case test in `sla.service.spec.ts` (the one exercising the >3-day waiting-period branch). Change its expectation to the constants-based behavior (`APPROVED_WARNING_DAYS`/`APPROVED_ESCALATION_DAYS` from `common/constants.ts`) and add:

```ts
  it('escalates an overdue ACTIVE case from the global constants (no program SQL)', async () => {
    // ACTIVE case created before APPROVED_ESCALATION_DAYS working days ago
    ... // use the spec's existing caseRepo mocking style
    expect(...).toContain('MSWDO Head review required'); // escalated alert staged
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `cd kapwa-server && npx jest sla --silent`
Expected: FAIL — the raw `p.waiting_period_days` query throws (column dropped) when an ACTIVE case exists.

- [ ] **Step 3: Implement the fix**

Replace the ACTIVE branch (lines ~59–82 of `sla.service.ts`): delete the `wpdByCase` raw-query block and the `let wpdByCase` declaration, and stage alerts for every overdue ACTIVE case using `APPROVED_WARNING_DAYS` / `APPROVED_ESCALATION_DAYS` directly:

```ts
    const activeOverdue = await this.caseRepo.find({
      where: { status: CaseStatus.ACTIVE },
    });
    for (const c of activeOverdue) {
      const age = this.workingDays(c.createdAt, new Date());
      if (age >= APPROVED_ESCALATION_DAYS) {
        this.stageAlert(alerts, c, 'active', 'MSWDO Head review required — case in active services > escalation threshold');
        escalated++;
      } else if (age >= APPROVED_WARNING_DAYS) {
        this.stageAlert(alerts, c, 'active', 'Warning: case in active services near review threshold');
        warnings++;
      }
    }
```
(Keep the message wording consistent with the existing stage strings in the file.)

- [ ] **Step 4: Run the suite**

Run: `cd kapwa-server && npm run typecheck && npx jest sla --silent`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/src/sla/sla.service.ts kapwa-server/src/sla/sla.service.spec.ts
git commit -m "fix(sla): stop querying dropped waiting_period_days
ACTIVE-case branch referenced the column dropped by migration 0081 and
would throw on the 30-min tick; now uses the APPROVED_* constants the
comment already promised as the fallback."
```

---

### Task 12: Regenerate the ERD + commit the generators

**Files:**
- Create: `docs/diagrams/scripts/erdgen.py` (introspection) and `docs/diagrams/scripts/erdwrite.py` (writer) — copied from the `/tmp/opencode` versions used for commit `026f5fb`, with `physical_files` already removed and `case_events`, `case_event_reminders`, `reminder_settings` added to the `CLUSTERS` map (C3/C4/C10) and the `REF` cross-reference table
- Modify: `docs/diagrams/06-erd.md` (regenerated output)

- [ ] **Step 1: Boot a fresh schema and regenerate**

```bash
cd kapwa-server && npm run build
dropdb -h /tmp/opencode/kapwa-pg -p 5433 -U kapwa erdgen 2>/dev/null; createdb -h /tmp/opencode/kapwa-pg -p 5433 -U kapwa erdgen
DB_HOST=/tmp/opencode/kapwa-pg DB_PORT=5433 DB_USER=kapwa DB_PASSWORD=kapwa DB_NAME=erdgen node dist/database/migrate.js >/dev/null
python3 docs/diagrams/scripts/erdgen.py && python3 docs/diagrams/scripts/erdwrite.py
dropdb -h /tmp/opencode/kapwa-pg -p 5433 -U kapwa erdgen
```
Update the erdwrite.py CLUSTERS: `case_events` → C3 (Cases, Case Files & Workflow), `case_event_reminders` + `reminder_settings` → C10 (Sync, Analytics, Consent & Platform) or C3 — choose C3 so the case file's events sit with the case. Expected: regenerated doc states 60 tables / the new constraint counts; assert `case_events` appears and no `waiting_period_days`/`philhealth` columns appear.

- [ ] **Step 2: Verify the mermaid renders**

Run: `cd kapwa-server && PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable npx -y @mermaid-js/mermaid-cli -i ../docs/diagrams/06-erd.md -o /tmp/erd-smoke.svg -b white 2>&1 | tail -2`
Expected: `✅` per chart, exit 0.

- [ ] **Step 3: Commit**

```bash
git add docs/diagrams/scripts docs/diagrams/06-erd.md
git commit -m "docs(erd): regenerate physical model with case events + sync columns
Reproducible generators now live in docs/diagrams/scripts; ERD reflects
case_events, case_event_reminders, reminder_settings, and
team_schedule_blocks.source/source_ref."
```

---

### Task 13: Full verification + deploy smoke

**Files:** none (verification only)

- [ ] **Step 1: Server suite + typecheck**

Run: `cd kapwa-server && npm run typecheck && npx jest --silent 2>&1 | tail -3`
Expected: PASS, no type errors.

- [ ] **Step 2: Client suite + typecheck**

Run: `cd kapwa-client && npm run typecheck && npm run test:run 2>&1 | tail -3`
Expected: PASS.

- [ ] **Step 3: Dev-stack smoke (API rebuild + restart)**

```bash
cd kapwa-server && npm run build
pkill -f "dist/main.js" || true
setsid nohup node dist/main.js > /tmp/opencode/kapwa-api.log 2>&1 & disown
sleep 3 && curl -s http://localhost:3000/health | head -c 200
```
Then exercise the feature against the dev DB (`kapwa_dev` on :5433 — it needs the new schema; if it was bootstrapped before Task 1, re-run `node dist/database/migrate.js` with the dev DB env first): login via the seed-demo accounts, `POST /cases/<id>/events`, GET the block in `/team/blocks?from=…&to=…` for the assigned worker, cancel the event, confirm the block disappears; PUT `/reminder-settings/me` and confirm `GET /reminder-settings/me` round-trips.
Expected: 200s, block appears/disappears, settings round-trip.

- [ ] **Step 4: Push**

```bash
git push origin main
```
Then confirm CI (`.github/workflows/ci.yml`) is green in the GitHub UI.

- [ ] **Step 5: Closing note**

Add a line to `.superpowers/sdd/progress.md` under a new dated heading: schema, step, sync, reminders, settings, SLA fix, ERD regen all landed; note the intentional `referenceId = caseId` deviation (spec §7 said event id — the client links to the case page, and the ledger already keys on the event id).

---

## Self-Review

**1. Spec coverage:** every spec section maps to a task — §3 data model → Task 1; §3.5 categories → Task 8; §4 gating/attending → Task 4; §5 stepper → Tasks 5–7; §6 sync engine + owner-only + reassignment → Tasks 3–4; §7 reminder engine, offsets, dedupe, email default-on → Tasks 8–9; §8 API surface + zod → Tasks 4, 9; §9 client UI → Tasks 6, 7, 10; §10 testing → inline per task; §11 delivery (both files, SLA fix, ERD, file list) → Tasks 1, 11, 12. No gaps.

**2. Placeholder scan:** no TBD/TODO; every step carries concrete code or an executable command; the two "read the existing file first" steps (SLA spec style, WeekView affordance location) are in the review-focus spirit of adapting to unknown test scaffolding and name the file and the seam.

**3. Type consistency:** `TeamScheduleSyncService.upsertForEvent` signature (Task 3) matches the Task 4 calls `upsertForEvent(saved, c.assignedWorkerId, c.controlNo)`; `countForCase` consumed by Task 5's `courtHearingsCount`; `resolveOffsets` moves from Task 8 to Task 9 and Task 8's reminder spec is told to update its constructor call; `stepperStepDone` branch reads `opts.courtHearingCount` everywhere (client) and `opts.courtHearingCount`/`courtHearingCount` on the server; `checkConsent` stays `(userId, channel, category)` for the Task 8 call. `ReminderSettingsService` constructor `(repo)` matches both controller and reminder-service injection.

**4. Review Focus:** every line of the Review Focus section has a pinning test — gate (Task 4 first test), stale blocks/reminders (Tasks 3–4, 8), empty override (Task 8 test 3 + Task 9 validation), past events (Task 8 test 5), reassignment (Task 3 test 5 + Task 4 hook), not-attending (Task 4 test 3 + Task 8 test 4), email disabled (Task 8 test 6 + Step 3 email guard), synced blocks 403 (Task 3 guard test), missing config (Task 9 validation + Task 8 resolve fallback), cron double-fire (Task 8 dedupe test).

**Execution risk notes embedded:** the `upsert`-vs-partial-index caveat in Task 9 and the referenceId deviation in Task 13 Step 5 are called out where the executor will meet them, not hidden.