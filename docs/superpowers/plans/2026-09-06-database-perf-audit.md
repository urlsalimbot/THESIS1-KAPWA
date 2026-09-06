# Database Performance Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate per-parent N+1 query patterns in chat/sync/sla/notifications/inter-agency services, add missing hot-path DB indexes, and push cases-list filters (ageRange/category/sla) into SQL so page semantics are correct.

**Architecture:** One TypeORM migration (`…0000000000054`) adds 15 `CREATE INDEX IF NOT EXISTS` statements mirrored idempotently in `src/database/migrate.ts`. Five service refactors convert per-row repo calls into batched lookups / bulk upserts / one bulk save. The `cases.service.findAll` filter block moves ageRange+category into the QueryBuilder and routes the `sla` filter through a candidate-set query with in-memory pagination.

**Tech Stack:** NestJS 11, TypeORM 0.3.x, Postgres 18 (uuid-ossp, pgcrypto, pg_trgm, pgaudit). Jest for tests. Existing perf infra already correct: pg_trgm boot order, `idx_person_name_trgm`/`idx_person_search`/`idx_beneficiary_category_trgm`, `persons.search_vector`.

## Global Constraints

- All commands run from `kapwa-server/`.
- Repo untouched: full suite = `npx jest --silent` (51 suites / ~411 tests, must stay green). NEVER `npm test`.
- Run `npm run typecheck` and `npm run lint` before claiming a task done.
- Dirty pre-existing files (auth/cases/programs/notifications services, `migrate.ts` is WORK AREA but `git status` also lists other dirty files, `ReferralColumnsNullable…53` migration, `user-stories-tests.md`) — **NEVER stage or commit anything outside each task's own files**; stage explicit paths only, never `git add -A`.
- Commit style: conventional commits (`perf(indexes): …`, `perf(chat): …`).
- `migrate.ts` already has dirty local edits from other work — treat that file as a WORK AREA: append your index block, do NOT restructure or reformat existing lines, and stage it deliberately only in Task 1.
- Every index must be created with `CREATE INDEX IF NOT EXISTS` and mirrored in BOTH the new migration file and `migrate.ts`.

---

### Task 1: Index migration — `DatabasePerfIndexes0000000000054`

**Files:**
- Create: `kapwa-server/src/database/migrations/DatabasePerfIndexes0000000000054.ts`
- Modify: `kapwa-server/src/database/migrate.ts` (append index block after the last existing `idx_idempotency_key` line)
- Validate: disposable Postgres (`pg_ctl -D /tmp/opencode/kapwa-pg/data`, port 5433, db/user `kapwa`, trust auth)

**Interfaces:**
- Produces: `DatabasePerfIndexes0000000000054` MigrationInterface class with `up`/`down`.
- Consumes: nothing.

- [ ] **Step 1: Write the migration file**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

// Perf audit 2026-09-06: hot-path lookups had no supporting index.
// All statements are IF NOT EXISTS idempotent (safe under both boot paths).
export class DatabasePerfIndexes0000000000054 implements MigrationInterface {
  name = 'DatabasePerfIndexes0000000000054';

  private readonly statements: string[] = [
    `CREATE INDEX IF NOT EXISTS idx_inter_referral_from ON inter_agency_referrals(from_agency_id)`,
    `CREATE INDEX IF NOT EXISTS idx_inter_referral_to ON inter_agency_referrals(to_agency_id)`,
    `CREATE INDEX IF NOT EXISTS idx_inter_referral_status ON inter_agency_referrals(status)`,
    `CREATE INDEX IF NOT EXISTS idx_inter_referral_person ON inter_agency_referrals(person_id)`,
    `CREATE INDEX IF NOT EXISTS idx_inter_referral_case ON inter_agency_referrals(case_id)`,
    `CREATE INDEX IF NOT EXISTS idx_case_history_case ON case_history(case_id)`,
    `CREATE INDEX IF NOT EXISTS idx_cases_worker ON cases(assigned_worker_id)`,
    `CREATE INDEX IF NOT EXISTS idx_cases_beneficiary ON cases(beneficiary_id)`,
    `CREATE INDEX IF NOT EXISTS idx_cases_status_created ON cases(status, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_sync_device_idemp ON sync_queue(device_id, idempotency_key)`,
    `CREATE INDEX IF NOT EXISTS idx_sync_device ON sync_queue(device_id)`,
    `CREATE INDEX IF NOT EXISTS idx_irf_created ON irf_cases(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_acs_agency_date ON access_card_services(agency_id, service_date)`,
    `CREATE INDEX IF NOT EXISTS idx_acs_intervention ON access_card_services(intervention_id)`,
    `CREATE INDEX IF NOT EXISTS idx_acs_code ON access_card_services(access_card_code)`,
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of this.statements) {
      await queryRunner.query(statement);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const drops: string[] = [
      'idx_inter_referral_from', 'idx_inter_referral_to', 'idx_inter_referral_status',
      'idx_inter_referral_person', 'idx_inter_referral_case',
      'idx_case_history_case',
      'idx_cases_worker', 'idx_cases_beneficiary', 'idx_cases_status_created',
      'idx_sync_device_idemp', 'idx_sync_device',
      'idx_irf_created',
      'idx_acs_agency_date', 'idx_acs_intervention', 'idx_acs_code',
    ];
    for (const name of drops) {
      await queryRunner.query(`DROP INDEX IF EXISTS ${name}`);
    }
  }
}
```

- [ ] **Step 2: Mirror into migrate.ts**

Find the existing index block in `src/database/migrate.ts` (search for `idx_idempotency_key` — `CREATE INDEX IF NOT EXISTS idx_idempotency_key ON idempotency_keys(key)` is the current last index). Append these exact statements after it (same `await q.query(...)` style used by the surrounding block):

```ts
  await q.query(`CREATE INDEX IF NOT EXISTS idx_inter_referral_from ON inter_agency_referrals(from_agency_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_inter_referral_to ON inter_agency_referrals(to_agency_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_inter_referral_status ON inter_agency_referrals(status)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_inter_referral_person ON inter_agency_referrals(person_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_inter_referral_case ON inter_agency_referrals(case_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_case_history_case ON case_history(case_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_cases_worker ON cases(assigned_worker_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_cases_beneficiary ON cases(beneficiary_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_cases_status_created ON cases(status, created_at)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_sync_device_idemp ON sync_queue(device_id, idempotency_key)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_sync_device ON sync_queue(device_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_irf_created ON irf_cases(created_at)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_acs_agency_date ON access_card_services(agency_id, service_date)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_acs_intervention ON access_card_services(intervention_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_acs_code ON access_card_services(access_card_code)`);
```

- [ ] **Step 3: Validate SQL in isolation on disposable Postgres**

Spin up a scratch cluster (pattern documented in AGENTS.md): if the data dir does not exist yet, `initdb`. Use explicit UUIDs in test SQL — `uuid_generate_v7()` is NOT provided by `uuid-ossp` on PG18.

```bash
pg_ctl -D /tmp/opencode/kapwa-pg/data -o "-p 5433" -l /tmp/opencode/kapwa-pg/log start
createdb -h localhost -p 5433 -U kapwa kapwa 2>/dev/null || true
```

Create the tables and apply the 15 statements from the migration (copy from Step 1, no `IF NOT EXISTS` needed here). Expected: all succeed, no errors. Verify one index:

```bash
psql -h localhost -p 5433 -U kapwa -d kapwa -c "\d inter_agency_referrals" | grep idx_inter_referral_status
```

Then stop the cluster:

```bash
pg_ctl -D /tmp/opencode/kapwa-pg/data stop
```

- [ ] **Step 4: Run the full suite + typecheck + lint**

```bash
npx jest --silent
npm run typecheck
npm run lint
```

Expected: all green (no behavior changed yet — Task 1 is schema-only).

- [ ] **Step 5: Commit**

```bash
git add src/database/migrations/DatabasePerfIndexes0000000000054.ts src/database/migrate.ts
git commit -m "perf(indexes): add hot-path index migration for referrals, cases, sync, irf, access-card"
```

---

### Task 2: batch user lookup in chat `getConversations`

**Files:**
- Modify: `src/chat/chat.service.ts:68-106` (replace `getConversations`)
- Test: `src/chat/chat.service.spec.ts` (extend mock + add test)

**Interfaces:**
- Consumes: `this.chatRepo.find`, `this.userRepo.find`, `this.userRepo.findOne`, `this.getAssignedWorkerIds` — same signatures.
- Produces: `getConversations(userId, role?)` unchanged shape (array of `{ userId, name, role, lastMessage, lastTime, unread }`).

Current behavior removed: `userRepo.findOne` per conversation (O(conversations) queries).

- [ ] **Step 1: Write the failing test**

Append inside `describe('ChatService', …)` in `src/chat/chat.service.spec.ts`:

```ts
  it('batches user lookups in getConversations instead of per-conversation findOne', async () => {
    repoMock.find.mockResolvedValue([
      { senderId: 'u1', recipientId: 'u2', content: 'Hello', createdAt: new Date(), isRead: true, conversationId: 'u1_u2' },
      { senderId: 'u1', recipientId: 'u3', content: 'Hi', createdAt: new Date(), isRead: true, conversationId: 'u1_u3' },
    ]);
    userRepoMock.find.mockResolvedValue([
      { id: 'u2', firstName: 'Bob', lastName: 'B', nameExtension: null, role: 'social_worker' },
      { id: 'u3', firstName: 'Carol', lastName: 'C', nameExtension: null, role: 'social_worker' },
    ]);
    const result = await service.getConversations('u1');
    expect(result).toHaveLength(2);
    expect(userRepoMock.findOne).not.toHaveBeenCalled();
    expect(userRepoMock.find).toHaveBeenCalledTimes(1);
    expect(userRepoMock.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: expect.arrayContaining(['u2', 'u3']) }) }),
    );
    expect(result.map(r => r.name).sort()).toEqual(['Bob B', 'Carol C']);
  });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest chat.service.spec -t "batches user lookups"
```

Expected: FAIL — `userRepoMock.findOne` was called, `userRepoMock.find` not called.

- [ ] **Step 3: Implement**

Replace the body of `getConversations` (currently `src/chat/chat.service.ts:68-106`) with:

```ts
  async getConversations(userId: string, role?: string) {
    const messages = await this.chatRepo.find({
      where: [
        { senderId: userId },
        { recipientId: userId },
      ],
      order: { createdAt: 'DESC' },
    });

    let allowedUserIds: Set<string> | null = null;
    if (role === 'claimant') {
      const workerIds = await this.getAssignedWorkerIds(userId);
      allowedUserIds = new Set(workerIds);
    }

    const seen = new Set<string>();
    const rows: Array<{ otherId: string; msg: ChatMessage }> = [];
    for (const msg of messages) {
      const otherId = msg.senderId === userId ? msg.recipientId : msg.senderId;
      if (allowedUserIds && !allowedUserIds.has(otherId)) continue;
      const convId = [msg.senderId, msg.recipientId].sort().join('_');
      if (seen.has(convId)) continue;
      seen.add(convId);
      rows.push({ otherId, msg });
    }

    const userMap = new Map<string, User>();
    if (rows.length > 0) {
      const users = await this.userRepo.find({
        where: { id: In(rows.map(r => r.otherId)) },
        select: ['id', 'firstName', 'middleName', 'lastName', 'nameExtension', 'role'],
      });
      for (const u of users) userMap.set(u.id, u);
    }

    return rows.map(({ otherId, msg }) => {
      const user = userMap.get(otherId);
      return {
        userId: otherId,
        name: user?.fullName || otherId.slice(0, 8),
        role: user?.role || '',
        lastMessage: msg.content,
        lastTime: msg.createdAt,
        unread: (!msg.isRead && msg.recipientId === userId) ? 1 : 0,
      };
    });
  }
```

`In` is already imported (`import { Repository, In } from 'typeorm'` at line 4). `ChatMessage` and `User` are already imported (lines 5-6).

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest chat.service.spec
```

Expected: PASS (new test + all pre-existing `getConversations`/`getConversation` tests).

- [ ] **Step 5: Full verification + commit**

```bash
npx jest --silent && npm run typecheck && npm run lint
git add src/chat/chat.service.ts src/chat/chat.service.spec.ts
git commit -m "perf(chat): batch conversation user lookup with In() instead of per-conversation findOne"
```

---

### Task 3: batch sync delta dedupe + version-vector upsert

**Files:**
- Modify: `src/sync/sync.service.ts` — `processDelta` dedupe block (`:135-148`), `updateVersionVectors` (`:562-592`)
- Test: `src/sync/sync.service.spec.ts` (ensure `getRepositoryToken(VersionVector)` provider exists; add 3 tests)

**Interfaces:**
- Consumes: `queueRepo.find`, `versionRepo.query`, `versionRepo.find` (repository methods only).
- Produces: `processDelta` and `updateVersionVectors` keep identical return types.

- [ ] **Step 1: Write failing tests**

Append inside `describe('SyncService', …)` in `src/sync/sync.service.spec.ts`. Ensure a `versionRepoMock` exists in the testing module with `getRepositoryToken(VersionVector)` (add if missing — model it on the other repo mocks in that file, with `query: jest.fn().mockResolvedValue([])` and `find: jest.fn().mockResolvedValue([])`):

```ts
  it('dedupes the delta batch with a single In() lookup, not per-change findOne', async () => {
    queueRepo.find.mockResolvedValue([
      { idempotencyKey: 'change-1', status: 'applied' },
    ]);
    queueRepo.findOne = jest.fn();
    const result = await service.processDelta({
      deviceId: 'dev-a',
      changes: [
        { id: 'change-1', tableName: 'persons', operation: 'UPDATE', recordId: 'p1', payload: { id: 'p1' }, clientUpdatedAt: '2026-09-04T00:00:00Z' },
        { id: 'change-2', tableName: 'cases', operation: 'INSERT', recordId: 'c2', payload: { id: 'c2' }, clientUpdatedAt: '2026-09-04T00:00:00Z' },
      ],
      versionVectors: [],
    } as any);

    expect(queueRepo.findOne).not.toHaveBeenCalled();
    expect(queueRepo.find).toHaveBeenCalled();
    expect(result.find(r => r.changeId === 'change-1')!.status).toBe('applied');
  });
```

Note: `processDelta` also needs the other dependencies (intakeService, idempotency cache, signature) mocked as the existing suite does — build the call args (including `idempotencyKey`, `signature`) to match the existing tests' patterns. The `queueRepo.findOne` overwrite forces the ECMAScript red fail safely.

```ts
  it('upserts all version vectors in a single ON CONFLICT statement', async () => {
    versionRepo.query.mockResolvedValue([]);
    versionRepo.find.mockResolvedValue([
      { id: 'v1', deviceId: 'dev-a', tableName: 'cases', localVersion: 1, serverVersion: 4 },
      { id: 'v2', deviceId: 'dev-a', tableName: 'persons', localVersion: 2, serverVersion: 2 },
    ]);

    // Drive through the public entry point that triggers updateVersionVectors.
    const result = await (service as any).updateVersionVectors('dev-a', [
      { tableName: 'cases', localVersion: 1, serverVersion: 4 },
      { tableName: 'persons', localVersion: 2, serverVersion: 1 },
    ]);

    expect(versionRepo.query).toHaveBeenCalledTimes(1);
    expect(versionRepo.query.mock.calls[0][0]).toContain('ON CONFLICT');
    expect(versionRepo.find).toHaveBeenCalledWith({ where: { deviceId: 'dev-a' }, order: { tableName: 'ASC' } });
    expect(result).toHaveLength(2);
  });
```

```ts
  it('returns an empty list for empty version vectors without querying', async () => {
    const result = await (service as any).updateVersionVectors('dev-a', []);
    expect(versionRepo.query).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
```

- [ ] **Step 2: Run to verify red**

```bash
npx jest sync.service.spec -t "dedupes the delta batch"
```
Expected: FAIL (current code calls `queueRepo.findOne` per change).

```bash
npx jest sync.service.spec -t "upserts all version vectors"
```
Expected: FAIL (current code never calls `versionRepo.query`, and returns via findOne loop).

```bash
npx jest sync.service.spec -t "empty version vectors"
```
Expected: FAIL if the early-return is not implemented yet (later step).

- [ ] **Step 3: Implement — processDelta dedupe**

Replace the `results` loop setup. After the `results` array declaration (around `:125-133`) and BEFORE the `for (const change of changes)` loop, insert:

```ts
    const queueLookupKeys = changes.map(c => c.id).filter((id): id is string => !!id);
    const existingQueue = queueLookupKeys.length > 0
      ? await this.queueRepo.find({ where: { deviceId, idempotencyKey: In(queueLookupKeys) } })
      : [];
    const existingByKey = new Map(existingQueue.map(e => [e.idempotencyKey, e]));
```

Then inside the loop, replace:

```ts
        const existing = await this.queueRepo.findOne({
          where: { idempotencyKey: change.id, deviceId },
        });
```

with:

```ts
        const existing = existingByKey.get(change.id);
```

`In` — confirm the import at the top of `sync.service.ts` (`import { Repository, DataSource } from 'typeorm'`); add `In` to that import if missing.

- [ ] **Step 4: Implement — updateVersionVectors**

Replace the whole `updateVersionVectors` method (`:562-592`) with:

```ts
  private async updateVersionVectors(
    deviceId: string,
    clientVectors: Array<{ tableName: string; localVersion: number; serverVersion: number }>,
  ): Promise<VersionVector[]> {
    if (clientVectors.length === 0) return [];

    const now = new Date().toISOString();
    const tableNames = clientVectors.map(v => v.tableName);
    const localVersions = clientVectors.map(v => v.localVersion);
    const serverVersions = clientVectors.map(v => v.serverVersion);

    await this.versionRepo.query(
      `INSERT INTO version_vectors (device_id, table_name, local_version, server_version, last_synced_at)
       SELECT $1, t.table_name, t.local_version, t.server_version, $2::timestamp
       FROM unnest($3::text[], $4::int[], $5::int[]) AS t(table_name, local_version, server_version)
       ON CONFLICT (device_id, table_name)
       DO UPDATE SET
         local_version = GREATEST(version_vectors.local_version, EXCLUDED.local_version),
         server_version = GREATEST(version_vectors.server_version, EXCLUDED.server_version),
         last_synced_at = EXCLUDED.last_synced_at,
         updated_at = NOW()`,
      [deviceId, now, tableNames, localVersions, serverVersions],
    );

    return this.versionRepo.find({ where: { deviceId }, order: { tableName: 'ASC' } });
  }
```

- [ ] **Step 5: Run to verify green**

```bash
npx jest sync.service.spec -t "dedupes the delta batch"
npx jest sync.service.spec -t "upserts all version vectors"
npx jest sync.service.spec -t "empty version vectors"
npx jest sync.service.spec
```

Expected: all PASS. If any pre-existing sync spec test asserts `versionRepo.findOne`/`.save` behavior, update it to the new bulk semantics in the same commit.

- [ ] **Step 6: Full verification + commit**

```bash
npx jest --silent && npm run typecheck && npm run lint
git add src/sync/sync.service.ts src/sync/sync.service.spec.ts
git commit -m "perf(sync): batch delta dedupe and bulk-upsert version vectors"
```

---

### Task 4: bulk SLA alerts (hoist admin lookup + single batch save)

**Files:**
- Modify: `src/sla/sla.service.ts` — `checkAndEscalate` (`:26-100`), replace `createAlert` (`:114-127`)
- Test: `src/sla/sla.service.spec.ts`

**Interfaces:**
- Consumes: `caseRepo.find`, `caseRepo.query`, `notifRepo.save`, `notifRepo.create`.
- Produces: `checkAndEscalate(): Promise<{ escalated: number; warnings: number }>` unchanged. `createAlert` removed; replaced by `stageAlert` (sync) + `bulkCreateAlerts` (async).

The existing spec calls an admin query AFTER the wpd query (`caseRepo.query.mockResolvedValueOnce(wpd).mockResolvedValue(admins)`). The new design keeps the admin query as the final query of the run, so **mock sequencing in the existing tests stays valid**.

- [ ] **Step 1: Write failing tests**

Update the assertion blocks in `src/sla/sla.service.spec.ts` (they currently assert per-case `notifRepo.save` calls):

First test (`escalates an active case at the program waiting period…`, currently lines 59-68) — replace its assertion block:

```ts
    const result = await service.checkAndEscalate();

    expect(result.escalated).toBe(1);
    expect(result.warnings).toBe(1);
    expect(notifRepo.save).toHaveBeenCalledTimes(1);
    const rows = (notifRepo.save as jest.Mock).mock.calls[0][0] as Array<{
      title: string; message: string; referenceId: string;
    }>;
    expect(rows).toHaveLength(2); // one escalation + one warning, one admin
    expect(rows.some(r => r.title.includes('SLA Escalation'))).toBe(true);
    expect(rows.some(r => r.message.includes('> 5 days'))).toBe(true);
```

Second test (`falls back to global thresholds…`, lines 81-87) — replace its assertions:

```ts
    expect(result.escalated).toBe(1);
    const rows = (notifRepo.save as jest.Mock).mock.calls[0][0] as Array<{ referenceId: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(expect.objectContaining({ referenceId: 'c-esc' }));
```

Third test (`escalates at the global threshold…`, lines 100-104) — replace its assertions:

```ts
    expect(result.escalated).toBe(1);
    expect(notifRepo.save).toHaveBeenCalledTimes(1);
```

Fourth test (`leaves enrolled and in_review on the global constants`, lines 106-117) — keep `result.escalated` assertion; add:

```ts
    expect(notifRepo.save).toHaveBeenCalledTimes(1);
    const rows = (notifRepo.save as jest.Mock).mock.calls[0][0] as unknown[];
    expect(rows).toHaveLength(2); // two escalated cases × 1 admin
```

Also add a regression test:

```ts
  it('queries admins only once across a full escalation run', async () => {
    caseRepo.find
      .mockResolvedValueOnce([{ id: 'c-2', status: CaseStatus.ENROLLED, assignedWorkerId: 'w1', createdAt: date('2026-09-01') }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'c-3', status: CaseStatus.IN_REVIEW, createdAt: date('2026-09-01') }]);
    caseRepo.query.mockResolvedValue([{ id: 'admin-1' }]);

    const result = await service.checkAndEscalate();

    expect(result.escalated).toBe(2);
    const adminQueries = (caseRepo.query as jest.Mock).mock.calls.filter(
      (c: string[]) => c[0].includes('role = \'admin\''),
    );
    expect(adminQueries).toHaveLength(1);
  });
```

- [ ] **Step 2: Run to verify red**

```bash
npx jest sla.service.spec
```
Expected: FAIL on the bulk-save assertions (per-case saves today).

- [ ] **Step 3: Implement**

In `src/sla/sla.service.ts`:

(a) Add an `alerts` accumulator inside `checkAndEscalate` (right after `let warnings = 0;`):

```ts
    const alerts: Array<{ c: Case; stage: string; message: string }> = [];
```

(b) Replace the three in-loop `await this.createAlert(...)` calls with `this.stageAlert(alerts, c, '<same stage>', '<same message>');` (drop the `await` — `stageAlert` is sync; keep argument order `(alerts, c, stage, message)`).

(c) Before `this.logger.log(...)` / the return, add:

```ts
    if (alerts.length > 0) {
      await this.bulkCreateAlerts(alerts);
    }
```

(d) Replace the `createAlert` method with:

```ts
  private stageAlert(
    alerts: Array<{ c: Case; stage: string; message: string }>,
    c: Case,
    stage: string,
    message: string,
  ) {
    alerts.push({ c, stage, message });
  }

  private async bulkCreateAlerts(alerts: Array<{ c: Case; stage: string; message: string }>) {
    const admins = await this.caseRepo.query(
      `SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE`,
    );
    const rows: Notification[] = [];
    for (const a of alerts) {
      for (const admin of admins) {
        rows.push(this.notifRepo.create({
          recipientId: admin.id,
          title: `SLA Escalation: ${a.c.controlNo}`,
          message: `${a.message} — Case ${a.c.controlNo} (${this.statusLabel(a.stage)})`,
          category: NotificationCategory.SLA_ESCALATION,
          referenceId: a.c.id,
        }));
      }
    }
    if (rows.length > 0) {
      await this.notifRepo.save(rows);
    }
  }
```

- [ ] **Step 4: Run to verify green**

```bash
npx jest sla.service.spec
```
Expected: all PASS.

- [ ] **Step 5: Full verification + commit**

```bash
npx jest --silent && npm run typecheck && npm run lint
git add src/sla/sla.service.ts src/sla/sla.service.spec.ts
git commit -m "perf(sla): bulk-create escalation alerts with a single admin lookup"
```

---

### Task 5: batch notification preference upserts + add `createMany`

**Files:**
- Modify: `src/notifications/notifications.service.ts` — `bulkSetPreferences` (`:177-184`), add `createMany` method
- Test: `src/notifications/notifications.service.spec.ts`

**Interfaces:**
- Consumes: `notifPrefRepo.find/create/save`, `notifRepo.create/save`, `notifGateway.emitToUser`.
- Produces: `bulkSetPreferences(userId, prefs)` same return shape. New `createMany(notifs: Array<Partial<Notification>>): Promise<Notification[]>` — single `save`, emits `notification:new` per saved row. Used by Task 6.

- [ ] **Step 1: Write failing tests**

Append inside `describe('NotificationsService', …)`:

```ts
  it('bulk sets preferences with one lookup and one save', async () => {
    prefRepoMock.find.mockResolvedValue([
      { id: 'p1', userId: 'u1', channel: 'in_app', category: 'case_update', optedIn: false },
    ]);
    prefRepoMock.create.mockImplementation((x: any) => x);
    prefRepoMock.save.mockImplementation((xs: unknown[]) => Promise.resolve(xs));

    const results = await service.bulkSetPreferences('u1', [
      { channel: 'in_app', category: 'case_update', optedIn: true },
      { channel: 'sms', category: 'alert', optedIn: true },
    ]);

    expect(prefRepoMock.findOne).not.toHaveBeenCalled();
    expect(prefRepoMock.save).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(2);
    expect(results[0].optedIn).toBe(true);
  });

  it('createMany saves all rows in one call and emits per recipient', async () => {
    const saved = [
      { id: 'n1', recipientId: 'u2', title: 'T1', message: 'M1' },
      { id: 'n2', recipientId: 'u3', title: 'T2', message: 'M2' },
    ];
    repoMock.create.mockImplementation((x: any) => ({ ...x }));
    repoMock.save.mockResolvedValue(saved);

    const out = await service.createMany([
      { recipientId: 'u2', title: 'T1', message: 'M1' },
      { recipientId: 'u3', title: 'T2', message: 'M2' },
    ]);

    expect(repoMock.save).toHaveBeenCalledTimes(1);
    expect(out).toHaveLength(2);
    expect((repoMock.save as jest.Mock).mock.calls[0][0]).toHaveLength(2);
    expect((repoMock.create as jest.Mock).mock.calls).toHaveLength(2);
  });

  it('createMany returns [] and does not save for empty input', async () => {
    await expect(service.createMany([])).resolves.toEqual([]);
    expect(repoMock.save).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run to verify red**

```bash
npx jest notifications.service.spec
```
Expected: FAIL — `bulkSetPreferences` still loops over `setPreference` (findOne per pref), `createMany` does not exist.

- [ ] **Step 3: Implement**

Replace `bulkSetPreferences`:

```ts
  async bulkSetPreferences(userId: string, prefs: UpdatePreferenceInput[]) {
    const existing = await this.notifPrefRepo.find({ where: { userId } });
    const byKey = new Map(existing.map(p => [`${p.channel}:${p.category}`, p]));
    const results: NotificationPreference[] = [];
    const toSave: Array<Partial<NotificationPreference>> = [];
    for (const pref of prefs) {
      const key = `${pref.channel}:${pref.category}`;
      const found = byKey.get(key);
      if (found) {
        found.optedIn = pref.optedIn;
        toSave.push(found);
        results.push(found);
      } else {
        const created = this.notifPrefRepo.create({
          userId,
          channel: pref.channel,
          category: pref.category,
          optedIn: pref.optedIn,
        });
        toSave.push(created);
        results.push(created as NotificationPreference);
      }
    }
    if (toSave.length > 0) {
      await this.notifPrefRepo.save(toSave as NotificationPreference[]);
    }
    return results;
  }
```

Add `createMany` (place it after `create`):

```ts
  async createMany(notifs: Array<Partial<Notification>>): Promise<Notification[]> {
    if (notifs.length === 0) return [];
    const entities = notifs.map(n => this.notifRepo.create(n));
    const saved = await this.notifRepo.save(entities);
    for (const n of saved) {
      this.notifGateway.emitToUser(n.recipientId, 'notification:new', n);
    }
    return saved;
  }
```

`NotificationPreference` is already imported (line 6). Confirm `channel`/`category`/`optedIn` are valid keys on `NotificationPreference` (they exist per `setPreference` usage).

- [ ] **Step 4: Run to verify green**

```bash
npx jest notifications.service.spec
```
Expected: all PASS (including existing `creates a notification` test — `create` still called once; note pre-existing tests assert `repoMock.save` call counts, confirm none break; the new tests are additive).

- [ ] **Step 5: Full verification + commit**

```bash
npx jest --silent && npm run typecheck && npm run lint
git add src/notifications/notifications.service.ts src/notifications/notifications.service.spec.ts
git commit -m "perf(notifications): batch preference upserts and add bulk createMany"
```

---

### Task 6: batch inter-agency agency-staff notifications via `createMany`

**Files:**
- Modify: `src/inter-agency-referrals/inter-agency-referrals.service.ts` — `notifyAgency` (`:451-462`)
- Test: `src/inter-agency-referrals/inter-agency-referrals.service.spec.ts`

**Interfaces:**
- Consumes: `userRepo.find`, `this.notifService.createMany` (from Task 5), `this.notifService.create`.
- Produces: `notifyAgency(agencyId, title, message)` unchanged behavior — one bulk `createMany`.

- [ ] **Step 1: Write failing test**

In `src/inter-agency-referrals/inter-agency-referrals.service.spec.ts`, find the `notificationsService` mock in the test module. Add `createMany: jest.fn().mockResolvedValue([])` to it. Append:

```ts
  it('notifies all agency staff in one bulk createMany call', async () => {
    userRepoMock.find.mockResolvedValue([
      { id: 's1', role: 'agency_staff' },
      { id: 's2', role: 'agency_staff' },
    ]);
    const notifMock = (service as any).notifService;
    notifMock.createMany = jest.fn().mockResolvedValue([]);

    await (service as any).notifyAgency('ag-1', 'New Referral', 'Incoming referral');

    expect(notifMock.createMany).toHaveBeenCalledTimes(1);
    expect(notifMock.createMany).toHaveBeenCalledWith([
      expect.objectContaining({ recipientId: 's1', title: 'New Referral' }),
      expect.objectContaining({ recipientId: 's2', title: 'New Referral' }),
    ]);
    expect(notifMock.create).not.toHaveBeenCalled();
  });
```

Note: if the spec already defines `userRepoMock = { find: jest.fn().mockResolvedValue([]) }` (line 32), reuse it; if the spec reassigns `service.userRepo` per-test (line 309 does), the implementer must wire whichever object the test module actually injects. If `notifyAgency` is not directly reachable, drive it through the public method that calls it and assert on `createMany`.

- [ ] **Step 2: Run to verify red**

```bash
npx jest inter-agency-referrals.service.spec
```
Expected: FAIL — `createMany` never called; `create` called per staff.

- [ ] **Step 3: Implement**

Replace `notifyAgency`:

```ts
  private async notifyAgency(agencyId: string, title: string, message: string) {
    const staff = await this.userRepo.find({ where: { agencyId, role: UserRole.AGENCY_STAFF } });
    if (staff.length === 0) return;
    await this.notifService.createMany(
      staff.map(s => ({
        recipientId: s.id,
        title,
        message,
        category: NotificationCategory.CASE_UPDATE,
        channel: NotificationType.IN_APP,
      })),
    );
  }
```

- [ ] **Step 4: Run to verify green**

```bash
npx jest inter-agency-referrals.service.spec
```
Expected: all PASS.

- [ ] **Step 5: Full verification + commit**

```bash
npx jest --silent && npm run typecheck && npm run lint
git add src/inter-agency-referrals/inter-agency-referrals.service.ts src/inter-agency-referrals/inter-agency-referrals.service.spec.ts
git commit -m "perf(inter-agency): batch staff notifications via NotificationsService.createMany"
```

---

### Task 7: push cases-list filters into SQL (ageRange, category, sla)

**Files:**
- Modify: `src/cases/cases.service.ts` — `findAll` (`:103-167`)
- Test: `src/cases/cases.service.spec.ts`

**Interfaces:**
- Consumes: existing `createQueryBuilder` chain + `computeSlaOverdue`.
- Produces: `findAll(page, limit, filters)` same return type `{ data, total }`. Behavior change: filters apply BEFORE pagination.

- [ ] **Step 1: Write failing tests**

In `src/cases/cases.service.spec.ts`, the `qbMock` currently only has `getManyAndCount`. Add `getMany: jest.fn().mockResolvedValue([])` to `qbMock`. Append:

```ts
  it('pushes ageRange and category filters into SQL before pagination', async () => {
    const qbMock = repoMock.createQueryBuilder();
    qbMock.getManyAndCount.mockResolvedValue([[], 0]);

    await service.findAll(1, 10, { ageRange: '0-17', category: 'medical' });

    const andWhereCalls = (qbMock.andWhere as jest.Mock).mock.calls
      .map((c: [string, unknown]) => c[0]);
    const ageSql = andWhereCalls.find(s => s.includes('18 years'));
    const catSql = andWhereCalls.find(s => s.includes('unnest(c.service_requested)'));
    expect(ageSql).toBeDefined();
    expect(catSql).toBeDefined();
    // in-memory filter removed: filters.goalSQL — total must reflect DB pagination + these predicates
    expect(qbMock.getManyAndCount).toHaveBeenCalledTimes(1);
  });

  it('computes sla filter over a candidate set and paginates in memory', async () => {
    const qbMock = repoMock.createQueryBuilder();
    qbMock.getMany.mockResolvedValue([
      { id: 'c-old', status: CaseStatus.ACTIVE, controlNo: 'KAPWA-2026-00001', createdAt: new Date('2026-08-01T00:00:00Z') },
      { id: 'c-new', status: CaseStatus.ACTIVE, controlNo: 'KAPWA-2026-00002', createdAt: new Date('2026-09-03T00:00:00Z') },
    ]);

    const result = await service.findAll(1, 10, { sla: 'overdue' });

    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('c-old');
    expect(qbMock.getManyAndCount).not.toHaveBeenCalled();
  });
```

(If the spec's `repoMock.createQueryBuilder` returns `qbMock` directly, reuse `qbMock` rather than calling `repoMock.createQueryBuilder()` again.)

- [ ] **Step 2: Run to verify red**

```bash
npx jest cases.service.spec -t "pushes ageRange and category filters"
npx jest cases.service.spec -t "computes sla filter"
```
Expected: both FAIL — filters still in-memory after `getManyAndCount`; no `unnest`/`18 years` SQL; sla path never reaches `getMany`.

- [ ] **Step 3: Implement**

Replace the filter section of `findAll` (`:114-166`). After the existing `dateTo` block and BEFORE the `skip(...).take(...)` line, add:

```ts
    if (filters?.ageRange) {
      switch (filters.ageRange) {
        case '0-17':
          qb.andWhere("(person.dob IS NULL OR person.dob > NOW() - INTERVAL '18 years')");
          break;
        case '60+':
          qb.andWhere("person.dob <= NOW() - INTERVAL '60 years'");
          break;
        case '18-59':
          qb.andWhere("person.dob <= NOW() - INTERVAL '18 years' AND person.dob > NOW() - INTERVAL '60 years'");
          break;
      }
    }
    if (filters?.category) {
      qb.andWhere('EXISTS (SELECT 1 FROM unnest(c.service_requested) AS sreq WHERE sreq ILIKE :category)', {
        category: `%${filters.category}%`,
      });
    }
```

Then replace `qb.skip(...).take(...)...` + the post-query filter block (`:136-166`) with:

```ts
    qb.orderBy('c.createdAt', 'DESC');

    if (filters?.sla) {
      qb.andWhere('c.status IN (:...slaStatuses)', {
        slaStatuses: [CaseStatus.ENROLLED, CaseStatus.IN_REVIEW, CaseStatus.ACTIVE],
      });
      const candidate = await qb.getMany();
      let mapped = candidate.map(c => ({
        c,
        slaOverdue: this.computeSlaOverdue(c),
      }));
      if (filters.sla === 'overdue') {
        mapped = mapped.filter(m => m.slaOverdue);
      } else if (filters.sla === 'on_track') {
        mapped = mapped.filter(m => !m.slaOverdue);
      }
      const sTotal = mapped.length;
      return {
        data: mapped
          .slice((page - 1) * limit, page * limit)
          .map(m => Object.assign(m.c, { slaOverdue: m.slaOverdue })),
        total: sTotal,
      };
    }

    qb.skip((page - 1) * limit).take(limit);
    const [cases, total] = await qb.getManyAndCount();
    const data = cases.map(c => {
      (c as any).slaOverdue = this.computeSlaOverdue(c);
      return c;
    });
    return { data, total };
```

- [ ] **Step 4: Validate SQL against disposable Postgres**

Spin up the scratch cluster again (Task 1, Step 3) and validate the ageRange boundary conditions against a real `persons` table; expected outcomes:

```bash
psql -h localhost -p 5433 -U kapwa -d kapwa -c "
CREATE TABLE IF NOT EXISTS persons (id uuid PRIMARY KEY, dob date);
INSERT INTO persons VALUES ('00000000-0000-0000-0000-000000000001', NOW()::date - interval '10 years'),
                           ('00000000-0000-0000-0000-000000000002', NOW()::date - interval '40 years'),
                           ('00000000-0000-0000-0000-000000000003', NOW()::date - interval '70 years'),
                           ('00000000-0000-0000-0000-000000000004', NULL);
SELECT count(*) FILTER (WHERE dob IS NULL OR dob > NOW() - INTERVAL '18 years') AS age_0_17  FROM persons; -- expect 2
SELECT count(*) FILTER (WHERE dob <= NOW() - INTERVAL '18 years' AND dob > NOW() - INTERVAL '60 years') AS age_18_59 FROM persons; -- expect 1
SELECT count(*) FILTER (WHERE dob <= NOW() - INTERVAL '60 years') AS age_60plus FROM persons; -- expect 1
"
```

Expected: 2 / 1 / 1 (4 rows). Stop the cluster afterward.

- [ ] **Step 5: Run to verify green + full verification**

```bash
npx jest cases.service.spec
npx jest --silent && npm run typecheck && npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add src/cases/cases.service.ts src/cases/cases.service.spec.ts
git commit -m "perf(cases): push ageRange/category/sla filters into SQL before pagination"
```

---

## Self-Review

- **Spec coverage:** §1 → Task 1 (all 15 indexes). §2.1 → Task 2; §2.2 → Task 3; §2.3 → Task 4; §2.4 → Task 5; §2.5 → Tasks 5+6. §3 → Task 7. §4 verification commands distributed per task (typecheck/lint/jest each, disposable-PG validation in Tasks 1 and 7).
- **Placeholder scan:** no TBD/TODO; every step has concrete code or a referenced existing pattern.
- **Type consistency:** `NotificationPreference` channel/category/optedIn confirmed against `setPreference`. `createMany` returns `Promise<Notification[]>` (Task 5) consumed by Task 6. `stageAlert`/`bulkCreateAlerts` names used consistently in Task 4. `updateVersionVectors` returns `Promise<VersionVector[]>` in both Tasks 3 branches. Chat `In` import already present.
- **Migration file ordering:** `0000000000054` is the next sequential key after `ReferralColumnsNullable0000000000053`; TypeORM sorts by the trailing 13 digits.