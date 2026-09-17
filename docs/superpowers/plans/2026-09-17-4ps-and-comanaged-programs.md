# 4Ps Integration + Co-Managed National Programs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4Ps conditionality + payout tracking on top of household-bound access cards, seed the three co-managed national programs (KALAHI-CIDSS, Walang Gutom, UPLIFT), and add a Listahanan/NHTS-PR reference field on households.

**Architecture:** Two new case-scoped child tables (`case_compliance_items`, `case_payouts`) live in a new `fourps` NestJS module; the NHTS-PR id is a nullable column on `households` exposed through the existing beneficiaries controller. Client gets an embedded compliance section on case detail plus standalone compliance/payout pages. No DSWD-side data is duplicated; Listahanan is referenced only.

**Tech Stack:** NestJS 11 + TypeORM + Postgres (server), React 19 + Vite + SWR + Tailwind/Radix + i18next (client), zod DTOs with `ZodPipe`, jest + vitest.

**Spec:** `docs/superpowers/specs/2026-09-17-4ps-and-comanaged-programs-design.md`

## Global Constraints

- Every schema change lands in **both** the TypeORM migration file (next sequential keys `…0000000000057`, `…0000000000058`) **and** an idempotent statement in `src/database/migrate.ts`.
- Migration class names must end in 13 digits matching the key, e.g. `CreateFourPsTables0000000000057`, `name = 'CreateFourPsTables0000000000057'`.
- `persons.age` is a **getter**, not a column — always compute age from `persons.dob`.
- Entities extend `BaseEntity` (`id` is uuid v7) and use snake_case `name:` on every column.
- Server tests: `npx jest --silent` (never `npm test`). Typecheck: `npm run typecheck`. Lint: `npm run lint`.
- Client tests: `npm run test:run` from `kapwa-client/`. Typecheck: `npm run typecheck`.
- i18n keys must exist in **both** `kapwa-client/src/i18n/locales/en/index.ts` and `fil/index.ts` (fil-parity test enforces this; identical fil/en values require an allowlist entry only with justification).
- Stage explicit paths when committing (never `git add -A`); conventional commit messages; never commit secrets.
- Disposable Postgres for schema validation: port 5433, user/db `kapwa`, trust auth at `/tmp/opencode/kapwa-pg/data`.

---

### Task 1: Schema — fourps tables + NHTS-PR column

**Files:**
- Create: `kapwa-server/src/database/migrations/CreateFourPsTables0000000000057.ts`
- Create: `kapwa-server/src/database/migrations/AddNhtsPrIdToHouseholds0000000000058.ts`
- Modify: `kapwa-server/src/database/migrate.ts` (insert after the `physical_files` CREATE block, before `CREATE TABLE IF NOT EXISTS form_version_history`)
- Modify: `kapwa-server/src/beneficiaries/household.entity.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: tables `case_compliance_items` (unique dedupe index `idx_compliance_dedupe` on `(case_id, household_member_id, compliance_type, due_date)`) and `case_payouts`; column `households.nhts_pr_id` with partial unique index `idx_household_nhts`. Task 2 entities map to these exactly.

- [ ] **Step 1: Write migration 0057**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFourPsTables0000000000057 implements MigrationInterface {
  name = 'CreateFourPsTables0000000000057';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS case_compliance_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        case_id UUID NOT NULL REFERENCES cases(id),
        household_member_id UUID REFERENCES persons(id),
        compliance_type VARCHAR CHECK (compliance_type IN ('school_attendance','health_checkup','fds')),
        due_date DATE NOT NULL,
        month_label VARCHAR,
        met BOOLEAN DEFAULT FALSE,
        met_at TIMESTAMP,
        met_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_compliance_dedupe
        ON case_compliance_items(case_id, household_member_id, compliance_type, due_date);
      CREATE INDEX IF NOT EXISTS idx_compliance_case ON case_compliance_items(case_id);
      CREATE INDEX IF NOT EXISTS idx_compliance_due ON case_compliance_items(due_date);

      CREATE TABLE IF NOT EXISTS case_payouts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        case_id UUID NOT NULL REFERENCES cases(id),
        cycle_no VARCHAR,
        scheduled_at DATE NOT NULL,
        amount DECIMAL(12,2),
        status VARCHAR(20) DEFAULT 'scheduled'
          CHECK (status IN ('scheduled','completed','missed','cancelled')),
        notified_at TIMESTAMP,
        notified_by UUID REFERENCES users(id),
        remarks TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_payout_case ON case_payouts(case_id);
      CREATE INDEX IF NOT EXISTS idx_payout_date ON case_payouts(scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_payout_status ON case_payouts(status);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS case_payouts`);
    await queryRunner.query(`DROP TABLE IF EXISTS case_compliance_items`);
  }
}
```

- [ ] **Step 2: Write migration 0058**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNhtsPrIdToHouseholds0000000000058 implements MigrationInterface {
  name = 'AddNhtsPrIdToHouseholds0000000000058';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE households ADD COLUMN IF NOT EXISTS nhts_pr_id TEXT`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_household_nhts
        ON households(nhts_pr_id) WHERE nhts_pr_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_household_nhts`);
    await queryRunner.query(`ALTER TABLE households DROP COLUMN IF EXISTS nhts_pr_id`);
  }
}
```

- [ ] **Step 3: Mirror both migrations inside migrate.ts**

Insert immediately after the `physical_files` CREATE TABLE statement (the block ending with `)`) and before `await q.query(`CREATE TABLE IF NOT EXISTS form_version_history (`:

```ts
  // 4Ps conditionality + payout tracking (CreateFourPsTables migration)
  await q.query(`CREATE TABLE IF NOT EXISTS case_compliance_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    case_id UUID NOT NULL REFERENCES cases(id),
    household_member_id UUID REFERENCES persons(id),
    compliance_type VARCHAR CHECK (compliance_type IN ('school_attendance','health_checkup','fds')),
    due_date DATE NOT NULL,
    month_label VARCHAR,
    met BOOLEAN DEFAULT FALSE,
    met_at TIMESTAMP,
    met_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
  await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_compliance_dedupe
    ON case_compliance_items(case_id, household_member_id, compliance_type, due_date)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_compliance_case ON case_compliance_items(case_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_compliance_due ON case_compliance_items(due_date)`);
  await q.query(`CREATE TABLE IF NOT EXISTS case_payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    case_id UUID NOT NULL REFERENCES cases(id),
    cycle_no VARCHAR,
    scheduled_at DATE NOT NULL,
    amount DECIMAL(12,2),
    status VARCHAR(20) DEFAULT 'scheduled'
      CHECK (status IN ('scheduled','completed','missed','cancelled')),
    notified_at TIMESTAMP,
    notified_by UUID REFERENCES users(id),
    remarks TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_payout_case ON case_payouts(case_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_payout_date ON case_payouts(scheduled_at)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_payout_status ON case_payouts(status)`);
  // Listahanan / NHTS-PR reference id (AddNhtsPrIdToHouseholds migration)
  await q.query(`ALTER TABLE households ADD COLUMN IF NOT EXISTS nhts_pr_id TEXT`);
  await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_household_nhts
    ON households(nhts_pr_id) WHERE nhts_pr_id IS NOT NULL`);
```

- [ ] **Step 4: Add the entity column**

In `kapwa-server/src/beneficiaries/household.entity.ts`, after the `accessCardCode` column:

```ts
  @Column({ name: 'nhts_pr_id', nullable: true })
  nhtsPrId?: string;
```

- [ ] **Step 5: Validate the fresh-boot bootstrap against disposable Postgres**

```bash
cd kapwa-server && npm run build
[ -d /tmp/opencode/kapwa-pg/data ] || initdb -D /tmp/opencode/kapwa-pg/data -U kapwa -A trust
pg_ctl -D /tmp/opencode/kapwa-pg/data -o "-p 5433" -l /tmp/opencode/kapwa-pg/pg.log start
psql -h localhost -p 5433 -U kapwa -d postgres -c "DROP DATABASE IF EXISTS kapwa"
psql -h localhost -p 5433 -U kapwa -d postgres -c "CREATE DATABASE kapwa"
DB_HOST=localhost DB_PORT=5433 DB_USER=kapwa DB_PASSWORD=kapwa DB_NAME=kapwa node dist/database/migrate.js
DB_HOST=localhost DB_PORT=5433 DB_USER=kapwa DB_PASSWORD=kapwa DB_NAME=kapwa node dist/database/migrate.js
psql -h localhost -p 5433 -U kapwa -d kapwa -c "\d case_compliance_items"
psql -h localhost -p 5433 -U kapwa -d kapwa -c "\d case_payouts"
psql -h localhost -p 5433 -U kapwa -d kapwa -c "SELECT column_name FROM information_schema.columns WHERE table_name='households' AND column_name='nhts_pr_id'"
```

Expected: bootstrap succeeds twice (second run idempotent), both tables present with the dedupe index, `nhts_pr_id` present.

- [ ] **Step 6: Replay the TypeORM chain on a second fresh DB**

```bash
psql -h localhost -p 5433 -U kapwa -d postgres -c "DROP DATABASE IF EXISTS kapwa_chain"
psql -h localhost -p 5433 -U kapwa -d postgres -c "CREATE DATABASE kapwa_chain"
DB_HOST=localhost DB_PORT=5433 DB_USER=kapwa DB_PASSWORD=kapwa DB_NAME=kapwa_chain npx typeorm-ts-node-commonjs migration:run -d src/database/data-source.ts
pg_ctl -D /tmp/opencode/kapwa-pg/data stop
```

Expected: all migrations apply, ending with `CreateFourPsTables0000000000057` and `AddNhtsPrIdToHouseholds0000000000058`.

- [ ] **Step 7: Run the server suite and typecheck**

Run: `npx jest --silent && npm run typecheck`
Expected: 58 suites / 478 tests still pass; typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add kapwa-server/src/database/migrations/CreateFourPsTables0000000000057.ts \
       kapwa-server/src/database/migrations/AddNhtsPrIdToHouseholds0000000000058.ts \
       kapwa-server/src/database/migrate.ts \
       kapwa-server/src/beneficiaries/household.entity.ts
git commit -m "feat(schema): 4ps compliance + payout tables and household nhts_pr_id"
```

---

### Task 2: fourps entities + zod DTOs + module skeleton

**Files:**
- Create: `kapwa-server/src/fourps/fourps-compliance.entity.ts`
- Create: `kapwa-server/src/fourps/fourps-payout.entity.ts`
- Create: `kapwa-server/src/fourps/dto/fourps.zod.ts`
- Create: `kapwa-server/src/fourps/fourps.module.ts`
- Create: `kapwa-server/src/fourps/fourps-entities.spec.ts`
- Create: `kapwa-server/src/fourps/dto/fourps.zod.spec.ts`
- Modify: `kapwa-server/src/app.module.ts`

**Interfaces:**
- Consumes: tables from Task 1.
- Produces: `CaseComplianceItem` (props `caseId, householdMemberId?, complianceType?, dueDate, monthLabel?, met, metAt?, metBy?`), `CasePayout` (props `caseId, cycleNo?, scheduledAt, amount?, status, notifiedAt?, notifiedBy?, remarks?`), `ComplianceType`, `PayoutStatus`, `SchedulePayoutSchema`, `PayoutStatusSchema`, `SchedulePayoutInput`, `PayoutStatusInput`. (`FourPsModule` is produced in Task 6.)

- [ ] **Step 1: Write the failing entity spec**

```ts
import { getMetadataArgsStorage } from 'typeorm';
import { CaseComplianceItem } from './fourps-compliance.entity';
import { CasePayout } from './fourps-payout.entity';
import { Household } from '../beneficiaries/household.entity';

describe('fourps entities', () => {
  const storage = getMetadataArgsStorage();

  it('maps CaseComplianceItem to case_compliance_items', () => {
    const table = storage.tables.find(t => t.target === CaseComplianceItem);
    expect(table?.name).toBe('case_compliance_items');
    const cols = storage.columns.filter(c => c.target === CaseComplianceItem).map(c => c.propertyName);
    expect(cols).toEqual(expect.arrayContaining([
      'caseId', 'householdMemberId', 'complianceType', 'dueDate', 'monthLabel', 'met', 'metAt', 'metBy',
    ]));
  });

  it('maps CasePayout to case_payouts', () => {
    const table = storage.tables.find(t => t.target === CasePayout);
    expect(table?.name).toBe('case_payouts');
    const cols = storage.columns.filter(c => c.target === CasePayout).map(c => c.propertyName);
    expect(cols).toEqual(expect.arrayContaining([
      'caseId', 'cycleNo', 'scheduledAt', 'amount', 'status', 'notifiedAt', 'notifiedBy', 'remarks',
    ]));
  });

  it('maps the household nhts_pr_id column', () => {
    const col = storage.columns.find(c => c.target === Household && c.propertyName === 'nhtsPrId');
    expect(col).toBeDefined();
    expect(col?.options.name).toBe('nhts_pr_id');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest fourps-entities --silent`
Expected: FAIL — `Cannot find module './fourps-compliance.entity'`.

- [ ] **Step 3: Write the compliance entity**

```ts
import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export type ComplianceType = 'school_attendance' | 'health_checkup' | 'fds';

@Entity('case_compliance_items')
export class CaseComplianceItem extends BaseEntity {
  @Column({ name: 'case_id' })
  caseId!: string;

  @Column({ name: 'household_member_id', nullable: true })
  householdMemberId?: string;

  @Column({ name: 'compliance_type', type: 'varchar', nullable: true })
  complianceType?: ComplianceType;

  @Column({ name: 'due_date', type: 'date' })
  dueDate!: string;

  @Column({ name: 'month_label', nullable: true })
  monthLabel?: string;

  @Column({ default: false })
  met!: boolean;

  @Column({ name: 'met_at', type: 'timestamp', nullable: true })
  metAt?: Date;

  @Column({ name: 'met_by', nullable: true })
  metBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
```

- [ ] **Step 4: Write the payout entity**

```ts
import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export type PayoutStatus = 'scheduled' | 'completed' | 'missed' | 'cancelled';

@Entity('case_payouts')
export class CasePayout extends BaseEntity {
  @Column({ name: 'case_id' })
  caseId!: string;

  @Column({ name: 'cycle_no', nullable: true })
  cycleNo?: string;

  @Column({ name: 'scheduled_at', type: 'date' })
  scheduledAt!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  amount?: number;

  @Column({ type: 'varchar', length: 20, default: 'scheduled' })
  status!: PayoutStatus;

  @Column({ name: 'notified_at', type: 'timestamp', nullable: true })
  notifiedAt?: Date;

  @Column({ name: 'notified_by', nullable: true })
  notifiedBy?: string;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
```

- [ ] **Step 5: Run the entity spec to verify it passes**

Run: `npx jest fourps-entities --silent`
Expected: PASS (3 tests).

- [ ] **Step 6: Write the failing DTO spec**

```ts
import { SchedulePayoutSchema, PayoutStatusSchema } from './fourps.zod';

describe('fourps zod schemas', () => {
  it('accepts a minimal payout schedule', () => {
    const parsed = SchedulePayoutSchema.safeParse({ scheduledAt: '2026-10-01' });
    expect(parsed.success).toBe(true);
  });

  it('accepts cycle + amount', () => {
    const parsed = SchedulePayoutSchema.safeParse({ scheduledAt: '2026-10-01', cycleNo: 'CY2026-02', amount: 1200 });
    expect(parsed.success).toBe(true);
  });

  it('rejects a non-date scheduledAt', () => {
    expect(SchedulePayoutSchema.safeParse({ scheduledAt: 'tomorrow' }).success).toBe(false);
  });

  it('accepts only terminal payout statuses', () => {
    expect(PayoutStatusSchema.safeParse({ status: 'completed' }).success).toBe(true);
    expect(PayoutStatusSchema.safeParse({ status: 'missed', remarks: 'No show' }).success).toBe(true);
    expect(PayoutStatusSchema.safeParse({ status: 'scheduled' }).success).toBe(false);
    expect(PayoutStatusSchema.safeParse({ status: 'bogus' }).success).toBe(false);
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npx jest fourps.zod --silent`
Expected: FAIL — `Cannot find module './fourps.zod'`.

- [ ] **Step 8: Write the DTO schemas**

```ts
import { z } from 'zod';

export const SchedulePayoutSchema = z.object({
  cycleNo: z.string().min(1).max(50).optional(),
  scheduledAt: z.string().date(),
  amount: z.number().nonnegative().optional(),
});

export const PayoutStatusSchema = z.object({
  status: z.enum(['completed', 'missed', 'cancelled']),
  remarks: z.string().max(2000).optional(),
});

export type SchedulePayoutInput = z.infer<typeof SchedulePayoutSchema>;
export type PayoutStatusInput = z.infer<typeof PayoutStatusSchema>;
```

- [ ] **Step 9: Run the DTO spec to verify it passes**

Run: `npx jest fourps.zod --silent`
Expected: PASS (4 tests).

- [ ] **Step 10: Commit**

```bash
git add kapwa-server/src/fourps/fourps-compliance.entity.ts \
       kapwa-server/src/fourps/fourps-payout.entity.ts \
       kapwa-server/src/fourps/dto/fourps.zod.ts \
       kapwa-server/src/fourps/fourps-entities.spec.ts \
       kapwa-server/src/fourps/dto/fourps.zod.spec.ts
git commit -m "feat(4ps): fourps entities and zod schemas"
```

---

### Task 3: FourPsService — compliance generation

**Files:**
- Create: `kapwa-server/src/fourps/fourps.service.ts`
- Create: `kapwa-server/src/fourps/fourps.service.spec.ts`

**Interfaces:**
- Consumes: `CaseComplianceItem`, `CasePayout` (Task 2).
- Produces: `FourPsService` with `generateComplianceItems(caseId: string): Promise<number>` and the exported helper `ageFromDob(dob: string | Date | null | undefined, now?: Date): number`.

- [ ] **Step 1: Write the failing service spec (generation only)**

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { FourPsService, ageFromDob } from './fourps.service';
import { CaseComplianceItem } from './fourps-compliance.entity';
import { CasePayout } from './fourps-payout.entity';

describe('ageFromDob', () => {
  it('computes full years with birthday awareness', () => {
    const now = new Date('2026-09-17T00:00:00Z');
    expect(ageFromDob('2015-09-18', now)).toBe(10);
    expect(ageFromDob('2015-09-17', now)).toBe(11);
    expect(ageFromDob(null, now)).toBe(0);
  });
});

describe('FourPsService.generateComplianceItems', () => {
  let service: FourPsService;
  let repoMock: any;
  let payoutRepoMock: any;

  const yearsAgo = (years: number) => new Date(Date.now() - years * 365.25 * 86400000).toISOString().slice(0, 10);

  beforeEach(async () => {
    repoMock = { query: jest.fn(), find: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn((d: any) => d) };
    payoutRepoMock = { query: jest.fn(), find: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn((d: any) => d) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FourPsService,
        { provide: getRepositoryToken(CaseComplianceItem), useValue: repoMock },
        { provide: getRepositoryToken(CasePayout), useValue: payoutRepoMock },
      ],
    }).compile();
    service = module.get(FourPsService);
  });

  function mockGeneration(insertReturnsOne = true) {
    repoMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT b.household_id')) return [{ household_id: 'h1' }];
      if (sql.includes('access_card_code FROM households')) return [{ access_card_code: 'NORZ-AC-2026-0001' }];
      if (sql.includes('FROM household_memberships')) {
        return [
          { person_id: 'p-kid', gender: 'Male', dob: yearsAgo(10), relationship: 'Child', is_primary: false },
          { person_id: 'p-baby', gender: 'Female', dob: yearsAgo(1), relationship: 'Child', is_primary: false },
          { person_id: 'p-mom', gender: 'Female', dob: yearsAgo(40), relationship: 'Spouse', is_primary: false },
          { person_id: 'p-head', gender: 'Male', dob: yearsAgo(45), relationship: 'Head', is_primary: true },
        ];
      }
      if (sql.includes('INSERT INTO case_compliance_items')) return insertReturnsOne ? [{ id: 'new' }] : [];
      return [];
    });
  }

  it('creates per-member conditionality items for the next 12 months', async () => {
    mockGeneration(true);
    const count = await service.generateComplianceItems('case-1');
    // kid school x12, baby health x12, mom health+fds x24, head fds x12 => 60
    expect(count).toBe(60);

    const inserts = repoMock.query.mock.calls.filter((c: any[]) => String(c[0]).includes('INSERT INTO case_compliance_items'));
    expect(inserts).toHaveLength(60);
    expect(String(inserts[0][0])).toContain('ON CONFLICT');

    const typesByPerson: Record<string, Set<string>> = {};
    for (const [, params] of inserts) {
      const [, personId, complianceType, dueDate] = params;
      expect(dueDate).toMatch(/^\d{4}-\d{2}-01$/);
      typesByPerson[personId] = typesByPerson[personId] || new Set();
      typesByPerson[personId].add(complianceType);
    }
    expect(typesByPerson['p-kid']).toEqual(new Set(['school_attendance']));
    expect(typesByPerson['p-baby']).toEqual(new Set(['health_checkup']));
    expect(typesByPerson['p-mom']).toEqual(new Set(['health_checkup', 'fds']));
    expect(typesByPerson['p-head']).toEqual(new Set(['fds']));
  });

  it('returns 0 on rerun when every item already exists', async () => {
    mockGeneration(false);
    await expect(service.generateComplianceItems('case-1')).resolves.toBe(0);
  });

  it('throws when the household has no access card', async () => {
    repoMock.query
      .mockResolvedValueOnce([{ household_id: 'h1' }])
      .mockResolvedValueOnce([]);
    await expect(service.generateComplianceItems('case-1')).rejects.toThrow(NotFoundException);
  });

  it('throws when the case has no household', async () => {
    repoMock.query.mockResolvedValueOnce([]);
    await expect(service.generateComplianceItems('case-1')).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest fourps.service --silent`
Expected: FAIL — `Cannot find module './fourps.service'`.

- [ ] **Step 3: Write the minimal service**

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CaseComplianceItem, ComplianceType } from './fourps-compliance.entity';
import { CasePayout } from './fourps-payout.entity';

export function ageFromDob(dob: string | Date | null | undefined, now: Date = new Date()): number {
  if (!dob) return 0;
  const d = new Date(dob);
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - d.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < d.getUTCDate())) age--;
  return age;
}

@Injectable()
export class FourPsService {
  constructor(
    @InjectRepository(CaseComplianceItem)
    private complianceRepo: Repository<CaseComplianceItem>,
    @InjectRepository(CasePayout)
    private payoutRepo: Repository<CasePayout>,
  ) {}

  async generateComplianceItems(caseId: string): Promise<number> {
    const caseRows = await this.complianceRepo.query(
      `SELECT b.household_id
       FROM cases c
       JOIN beneficiaries b ON b.id = c.beneficiary_id
       WHERE c.id = $1`,
      [caseId],
    );
    const householdId = caseRows?.[0]?.household_id;
    if (!householdId) throw new NotFoundException('Household has no access card');

    const cardRows = await this.complianceRepo.query(
      `SELECT access_card_code FROM households WHERE id = $1`,
      [householdId],
    );
    if (!cardRows?.[0]?.access_card_code) {
      throw new NotFoundException('Household has no access card');
    }

    const members = await this.complianceRepo.query(
      `SELECT hm.person_id, p.gender, p.dob, hm.relationship, hm.is_primary
       FROM household_memberships hm
       JOIN persons p ON p.id = hm.person_id
       WHERE hm.household_id = $1`,
      [householdId],
    );

    const now = new Date();
    let count = 0;

    for (const member of members ?? []) {
      const age = ageFromDob(member.dob, now);
      const isSpouse = String(member.relationship ?? '').toLowerCase() === 'spouse';
      const types: ComplianceType[] = [];
      if (age >= 3 && age <= 18) types.push('school_attendance');
      if (age < 3 || (member.gender === 'Female' && isSpouse)) types.push('health_checkup');
      if (member.is_primary || isSpouse) types.push('fds');

      for (let i = 0; i < 12; i++) {
        const due = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
        const dueDate = due.toISOString().slice(0, 10);
        const monthLabel = due.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
        for (const complianceType of types) {
          const inserted = await this.complianceRepo.query(
            `INSERT INTO case_compliance_items
               (id, case_id, household_member_id, compliance_type, due_date, month_label)
             VALUES (uuid_generate_v7(), $1, $2, $3, $4, $5)
             ON CONFLICT (case_id, household_member_id, compliance_type, due_date) DO NOTHING
             RETURNING id`,
            [caseId, member.person_id, complianceType, dueDate, monthLabel],
          );
          count += inserted.length;
        }
      }
    }

    return count;
  }
}
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npx jest fourps.service --silent`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/src/fourps/fourps.service.ts kapwa-server/src/fourps/fourps.service.spec.ts
git commit -m "feat(4ps): compliance item generation service"
```

---

### Task 4: FourPsService — compliance status + checkoff

**Files:**
- Modify: `kapwa-server/src/fourps/fourps.service.ts`
- Modify: `kapwa-server/src/fourps/fourps.service.spec.ts`

**Interfaces:**
- Consumes: `FourPsService` (Task 3).
- Produces: `getComplianceStatus(caseId: string)` → `{ total, complied, rate, byType, entries }`; `markComplied(id: string, userId: string): Promise<void>`; `unmarkComplied(id: string): Promise<void>`.

- [ ] **Step 1: Write the failing tests (append a new describe block)**

```ts
describe('FourPsService compliance status', () => {
  let service: FourPsService;
  let repoMock: any;

  beforeEach(async () => {
    repoMock = { query: jest.fn(), find: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn((d: any) => d) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FourPsService,
        { provide: getRepositoryToken(CaseComplianceItem), useValue: repoMock },
        { provide: getRepositoryToken(CasePayout), useValue: { query: jest.fn(), find: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn((d: any) => d) } },
      ],
    }).compile();
    service = module.get(FourPsService);
  });

  it('computes totals, rate, and per-type breakdown', async () => {
    repoMock.find.mockResolvedValue([
      { id: 'c1', complianceType: 'school_attendance', met: true },
      { id: 'c2', complianceType: 'school_attendance', met: false },
      { id: 'c3', complianceType: 'fds', met: true },
    ]);
    const status = await service.getComplianceStatus('case-1');
    expect(status.total).toBe(3);
    expect(status.complied).toBe(2);
    expect(status.rate).toBeCloseTo(2 / 3);
    expect(status.byType['school_attendance']).toEqual({ total: 2, complied: 1, rate: 0.5 });
    expect(status.byType['fds']).toEqual({ total: 1, complied: 1, rate: 1 });
    expect(repoMock.find).toHaveBeenCalledWith({ where: { caseId: 'case-1' }, order: { dueDate: 'ASC' } });
  });

  it('marks an item met with the actor and timestamp', async () => {
    const entry = { id: 'c1', met: false, metAt: undefined, metBy: undefined };
    repoMock.findOne.mockResolvedValue(entry);
    repoMock.save.mockImplementation(async (e: any) => e);
    await service.markComplied('c1', 'user-1');
    expect(entry.met).toBe(true);
    expect(entry.metBy).toBe('user-1');
    expect(entry.metAt).toBeInstanceOf(Date);
    expect(repoMock.save).toHaveBeenCalledWith(entry);
  });

  it('unmarks an item', async () => {
    const entry = { id: 'c1', met: true, metAt: new Date(), metBy: 'user-1' };
    repoMock.findOne.mockResolvedValue(entry);
    repoMock.save.mockImplementation(async (e: any) => e);
    await service.unmarkComplied('c1');
    expect(entry.met).toBe(false);
    expect(entry.metAt).toBeUndefined();
    expect(entry.metBy).toBeUndefined();
  });

  it('throws for an unknown compliance id', async () => {
    repoMock.findOne.mockResolvedValue(null);
    await expect(service.markComplied('missing', 'user-1')).rejects.toThrow(NotFoundException);
    await expect(service.unmarkComplied('missing')).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest fourps.service --silent`
Expected: FAIL — `service.getComplianceStatus is not a function`.

- [ ] **Step 3: Add the methods to FourPsService**

```ts
  async getComplianceStatus(caseId: string): Promise<{
    total: number;
    complied: number;
    rate: number;
    byType: Record<string, { total: number; complied: number; rate: number }>;
    entries: CaseComplianceItem[];
  }> {
    const entries = await this.complianceRepo.find({
      where: { caseId },
      order: { dueDate: 'ASC' },
    });
    const total = entries.length;
    const complied = entries.filter(e => e.met).length;
    const byType: Record<string, { total: number; complied: number; rate: number }> = {};
    for (const entry of entries) {
      const type = entry.complianceType || 'other';
      if (!byType[type]) byType[type] = { total: 0, complied: 0, rate: 0 };
      byType[type].total++;
      if (entry.met) byType[type].complied++;
    }
    for (const value of Object.values(byType)) {
      value.rate = value.total > 0 ? value.complied / value.total : 0;
    }
    return { total, complied, rate: total > 0 ? complied / total : 0, byType, entries };
  }

  async markComplied(id: string, userId: string): Promise<void> {
    const entry = await this.complianceRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Compliance entry not found');
    entry.met = true;
    entry.metAt = new Date();
    entry.metBy = userId;
    await this.complianceRepo.save(entry);
  }

  async unmarkComplied(id: string): Promise<void> {
    const entry = await this.complianceRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Compliance entry not found');
    entry.met = false;
    entry.metAt = undefined;
    entry.metBy = undefined;
    await this.complianceRepo.save(entry);
  }
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npx jest fourps.service --silent`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/src/fourps/fourps.service.ts kapwa-server/src/fourps/fourps.service.spec.ts
git commit -m "feat(4ps): compliance status and checkoff service methods"
```

---

### Task 5: FourPsService — payout ledger

**Files:**
- Modify: `kapwa-server/src/fourps/fourps.service.ts`
- Modify: `kapwa-server/src/fourps/fourps.service.spec.ts`

**Interfaces:**
- Consumes: `CasePayout`, `PayoutStatus`.
- Produces: `schedulePayout(caseId: string, input: { cycleNo?: string; scheduledAt: string; amount?: number }): Promise<CasePayout>`; `setPayoutStatus(id: string, status: 'completed' | 'missed' | 'cancelled', remarks?: string): Promise<CasePayout>`; `markNotified(id: string, userId: string): Promise<CasePayout>`; `listByCase(caseId: string): Promise<CasePayout[]>`.

- [ ] **Step 1: Write the failing tests (append a new describe block)**

```ts
describe('FourPsService payouts', () => {
  let service: FourPsService;
  let payoutRepoMock: any;

  beforeEach(async () => {
    payoutRepoMock = { query: jest.fn(), find: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn((d: any) => d) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FourPsService,
        { provide: getRepositoryToken(CaseComplianceItem), useValue: { query: jest.fn(), find: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn((d: any) => d) } },
        { provide: getRepositoryToken(CasePayout), useValue: payoutRepoMock },
      ],
    }).compile();
    service = module.get(FourPsService);
  });

  it('schedules a payout as scheduled', async () => {
    payoutRepoMock.save.mockImplementation(async (e: any) => ({ id: 'p1', ...e }));
    const payout = await service.schedulePayout('case-1', { cycleNo: 'CY2026-02', scheduledAt: '2026-10-01', amount: 1200 });
    expect(payoutRepoMock.create).toHaveBeenCalledWith({
      caseId: 'case-1', cycleNo: 'CY2026-02', scheduledAt: '2026-10-01', amount: 1200, status: 'scheduled',
    });
    expect(payout).toMatchObject({ id: 'p1', status: 'scheduled' });
  });

  it('updates a payout to a terminal status with remarks', async () => {
    const payout = { id: 'p1', status: 'scheduled' };
    payoutRepoMock.findOne.mockResolvedValue(payout);
    payoutRepoMock.save.mockImplementation(async (e: any) => e);
    await service.setPayoutStatus('p1', 'missed', 'Beneficiary did not attend');
    expect(payout.status).toBe('missed');
    expect((payout as any).remarks).toBe('Beneficiary did not attend');
  });

  it('records a notification', async () => {
    const payout = { id: 'p1', status: 'scheduled', notifiedAt: undefined, notifiedBy: undefined };
    payoutRepoMock.findOne.mockResolvedValue(payout);
    payoutRepoMock.save.mockImplementation(async (e: any) => e);
    await service.markNotified('p1', 'user-1');
    expect(payout.notifiedAt).toBeInstanceOf(Date);
    expect(payout.notifiedBy).toBe('user-1');
  });

  it('lists payouts for a case ordered by date', async () => {
    payoutRepoMock.find.mockResolvedValue([]);
    await service.listByCase('case-1');
    expect(payoutRepoMock.find).toHaveBeenCalledWith({ where: { caseId: 'case-1' }, order: { scheduledAt: 'ASC' } });
  });

  it('throws for unknown payout ids', async () => {
    payoutRepoMock.findOne.mockResolvedValue(null);
    await expect(service.setPayoutStatus('missing', 'completed')).rejects.toThrow(NotFoundException);
    await expect(service.markNotified('missing', 'user-1')).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest fourps.service --silent`
Expected: FAIL — `service.schedulePayout is not a function`.

- [ ] **Step 3: Add the payout methods**

```ts
  async schedulePayout(
    caseId: string,
    input: { cycleNo?: string; scheduledAt: string; amount?: number },
  ): Promise<CasePayout> {
    return this.payoutRepo.save(this.payoutRepo.create({
      caseId,
      cycleNo: input.cycleNo,
      scheduledAt: input.scheduledAt,
      amount: input.amount,
      status: 'scheduled',
    }));
  }

  async setPayoutStatus(
    id: string,
    status: 'completed' | 'missed' | 'cancelled',
    remarks?: string,
  ): Promise<CasePayout> {
    const payout = await this.payoutRepo.findOne({ where: { id } });
    if (!payout) throw new NotFoundException('Payout not found');
    payout.status = status;
    if (remarks) payout.remarks = remarks;
    return this.payoutRepo.save(payout);
  }

  async markNotified(id: string, userId: string): Promise<CasePayout> {
    const payout = await this.payoutRepo.findOne({ where: { id } });
    if (!payout) throw new NotFoundException('Payout not found');
    payout.notifiedAt = new Date();
    payout.notifiedBy = userId;
    return this.payoutRepo.save(payout);
  }

  async listByCase(caseId: string): Promise<CasePayout[]> {
    return this.payoutRepo.find({ where: { caseId }, order: { scheduledAt: 'ASC' } });
  }
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npx jest fourps.service --silent`
Expected: PASS (14 tests).

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/src/fourps/fourps.service.ts kapwa-server/src/fourps/fourps.service.spec.ts
git commit -m "feat(4ps): payout ledger service methods"
```

---

### Task 6: FourPsController + module registration

**Files:**
- Create: `kapwa-server/src/fourps/fourps.controller.ts`
- Create: `kapwa-server/src/fourps/fourps.controller.spec.ts`
- Create: `kapwa-server/src/fourps/fourps.module.ts`
- Modify: `kapwa-server/src/app.module.ts`

**Interfaces:**
- Consumes: `FourPsService` methods from Tasks 3–5.
- Produces: routes `POST /fourps/:caseId/generate-compliance`, `GET /fourps/:caseId/compliance`, `PATCH /fourps/compliance/:id/meet`, `DELETE /fourps/compliance/:id/meet`, `POST /fourps/:caseId/payouts`, `GET /fourps/:caseId/payouts`, `PATCH /fourps/payouts/:id/status`, `POST /fourps/payouts/:id/notify`.

- [ ] **Step 1: Write the failing controller spec**

```ts
import { Test } from '@nestjs/testing';
import { FourPsController } from './fourps.controller';
import { FourPsService } from './fourps.service';
import { AbacGuard } from '../auth/guards/abac.guard';

describe('FourPsController', () => {
  let controller: FourPsController;
  const svc = {
    generateComplianceItems: jest.fn(),
    getComplianceStatus: jest.fn(),
    markComplied: jest.fn(),
    unmarkComplied: jest.fn(),
    schedulePayout: jest.fn(),
    listByCase: jest.fn(),
    setPayoutStatus: jest.fn(),
    markNotified: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [FourPsController],
      providers: [{ provide: FourPsService, useValue: svc }],
    })
      .overrideGuard(AbacGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(FourPsController);
    Object.values(svc).forEach(fn => fn.mockReset());
  });

  it('generates compliance items', async () => {
    svc.generateComplianceItems.mockResolvedValue(60);
    await expect(controller.generateCompliance('case-1')).resolves.toEqual({ generated: 60 });
  });

  it('returns compliance status', async () => {
    svc.getComplianceStatus.mockResolvedValue({ total: 0, complied: 0, rate: 0, byType: {}, entries: [] });
    await expect(controller.getCompliance('case-1')).resolves.toMatchObject({ total: 0 });
  });

  it('marks and unmarks a compliance item', async () => {
    svc.markComplied.mockResolvedValue(undefined);
    svc.unmarkComplied.mockResolvedValue(undefined);
    await expect(controller.markComplied('item-1', { user: { id: 'user-1' } } as any)).resolves.toEqual({ met: true });
    expect(svc.markComplied).toHaveBeenCalledWith('item-1', 'user-1');
    await expect(controller.unmarkComplied('item-1')).resolves.toEqual({ met: false });
  });

  it('schedules and lists payouts', async () => {
    svc.schedulePayout.mockResolvedValue({ id: 'p1' });
    svc.listByCase.mockResolvedValue([]);
    await controller.schedulePayout('case-1', { scheduledAt: '2026-10-01', amount: 1200 });
    expect(svc.schedulePayout).toHaveBeenCalledWith('case-1', { scheduledAt: '2026-10-01', amount: 1200 });
    await expect(controller.listPayouts('case-1')).resolves.toEqual([]);
  });

  it('updates payout status and records notification', async () => {
    svc.setPayoutStatus.mockResolvedValue({ id: 'p1' });
    svc.markNotified.mockResolvedValue({ id: 'p1' });
    await controller.setPayoutStatus('p1', { status: 'completed' });
    expect(svc.setPayoutStatus).toHaveBeenCalledWith('p1', 'completed', undefined);
    await controller.notifyPayout('p1', { user: { id: 'user-1' } } as any);
    expect(svc.markNotified).toHaveBeenCalledWith('p1', 'user-1');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest fourps.controller --silent`
Expected: FAIL — `Cannot find module './fourps.controller'`.

- [ ] **Step 3: Write the controller**

```ts
import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards,
  UseInterceptors, ParseUUIDPipe, Request,
} from '@nestjs/common';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbacGuard } from '../auth/guards/abac.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { FourPsService } from './fourps.service';
import { SchedulePayoutSchema, SchedulePayoutInput, PayoutStatusSchema, PayoutStatusInput } from './dto/fourps.zod';
import { AuthenticatedRequest } from '../auth/types';

@ApiTags('4Ps')
@Controller('fourps')
@UseGuards(JwtAuthGuard, RolesGuard, AbacGuard)
@UseInterceptors(ClassSerializerInterceptor)
@ApiBearerAuth()
export class FourPsController {
  constructor(private svc: FourPsService) {}

  @Post(':caseId/generate-compliance')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Generate 12 months of 4Ps conditionality items for a case' })
  async generateCompliance(@Param('caseId', new ParseUUIDPipe()) caseId: string) {
    const generated = await this.svc.generateComplianceItems(caseId);
    return { generated };
  }

  @Get(':caseId/compliance')
  @Roles('admin', 'social_worker', 'coordinator', 'claimant')
  @ApiOperation({ summary: 'Get 4Ps compliance status for a case' })
  async getCompliance(@Param('caseId', new ParseUUIDPipe()) caseId: string) {
    return this.svc.getComplianceStatus(caseId);
  }

  @Patch('compliance/:id/meet')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Mark a compliance item as complied' })
  async markComplied(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    await this.svc.markComplied(id, req.user!.id);
    return { met: true };
  }

  @Delete('compliance/:id/meet')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Unmark a compliance item' })
  async unmarkComplied(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.svc.unmarkComplied(id);
    return { met: false };
  }

  @Post(':caseId/payouts')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Schedule a 4Ps payout' })
  async schedulePayout(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Body(new ZodPipe(SchedulePayoutSchema)) body: SchedulePayoutInput,
  ) {
    return this.svc.schedulePayout(caseId, body);
  }

  @Get(':caseId/payouts')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'List payout schedules for a case' })
  async listPayouts(@Param('caseId', new ParseUUIDPipe()) caseId: string) {
    return this.svc.listByCase(caseId);
  }

  @Patch('payouts/:id/status')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Update payout status' })
  async setPayoutStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(PayoutStatusSchema)) body: PayoutStatusInput,
  ) {
    return this.svc.setPayoutStatus(id, body.status, body.remarks);
  }

  @Post('payouts/:id/notify')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Record a beneficiary payout notification' })
  async notifyPayout(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.svc.markNotified(id, req.user!.id);
  }
}
```

- [ ] **Step 4: Run the controller spec to verify it passes**

Run: `npx jest fourps.controller --silent`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the module and register it in app.module.ts**

Create `kapwa-server/src/fourps/fourps.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FourPsController } from './fourps.controller';
import { FourPsService } from './fourps.service';
import { CaseComplianceItem } from './fourps-compliance.entity';
import { CasePayout } from './fourps-payout.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([CaseComplianceItem, CasePayout]), AuthModule],
  controllers: [FourPsController],
  providers: [FourPsService],
  exports: [FourPsService],
})
export class FourPsModule {}
```

In `app.module.ts`: add `import { FourPsModule } from './fourps/fourps.module';` after the `ContactMessagesModule` import, and add `FourPsModule,` to the `imports` array after `ContactMessagesModule,`.

- [ ] **Step 6: Typecheck and run the suite**

Run: `npm run typecheck && npx jest --silent`
Expected: typecheck clean; all suites pass (new 4 fourps specs included).

- [ ] **Step 7: Commit**

```bash
git add kapwa-server/src/fourps/fourps.controller.ts \
       kapwa-server/src/fourps/fourps.controller.spec.ts \
       kapwa-server/src/fourps/fourps.module.ts \
       kapwa-server/src/app.module.ts
git commit -m "feat(4ps): fourps controller and module"
```

---

### Task 7: Seed the three co-managed programs + 4Ps

**Files:**
- Modify: `kapwa-server/src/database/seed-programs.ts`
- Create: `kapwa-server/src/database/seed-programs.spec.ts`

**Interfaces:**
- Consumes: existing `ProgramSeed` shape and `seedPrograms` child-row insert loop (`program_fund_sources`, `program_required_documents`).
- Produces: exported `PROGRAMS` array; guarded `main()` entry so importing the module in tests does not connect to a DB.

- [ ] **Step 1: Write the failing seed spec**

```ts
import { PROGRAMS } from './seed-programs';

describe('program seed data', () => {
  const byName = (needle: RegExp) => PROGRAMS.filter(p => needle.test(p.name));

  it('includes the 4Ps national CCT program with fund source and legal basis', () => {
    const [fourPs] = byName(/4Ps/i);
    expect(fourPs).toBeDefined();
    expect(fourPs.category).toBe('CCT');
    expect(fourPs.fundSources).toContain('DSWD - 4Ps National');
    expect(fourPs.legalBasis).toContain('RA 11310');
    expect(fourPs.requiredDocuments).toContain('4Ps Household ID');
  });

  it('includes KALAHI-CIDSS as a DSWD-funded community program', () => {
    const [kalahi] = byName(/KALAHI-CIDSS/i);
    expect(kalahi).toBeDefined();
    expect(kalahi.fundSources).toContain('DSWD - KALAHI-CIDSS');
    expect(kalahi.legalBasis).toContain('RA 7160');
  });

  it('includes Walang Gutom with its fund source', () => {
    const [walangGutom] = byName(/Walang Gutom/i);
    expect(walangGutom).toBeDefined();
    expect(walangGutom.fundSources).toContain('DSWD - Walang Gutom Food Stamp');
    expect(walangGutom.legalBasis).toContain('EO 44');
  });

  it('includes UPLIFT with its fund source', () => {
    const [uplift] = byName(/UPLIFT/i);
    expect(uplift).toBeDefined();
    expect(uplift.fundSources).toContain('DSWD - UPLIFT');
  });

  it('keeps every program id unique', () => {
    const ids = PROGRAMS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest seed-programs --silent`
Expected: FAIL — `PROGRAMS` is not exported (or undefined).

- [ ] **Step 3: Export PROGRAMS and guard main**

In `kapwa-server/src/database/seed-programs.ts`:
- change `const PROGRAMS: ProgramSeed[] = [` → `export const PROGRAMS: ProgramSeed[] = [`
- replace the trailing

```ts
main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
```

with

```ts
if (require.main === module) {
  main().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Add the four program rows**

Append to the `PROGRAMS` array (before the closing `];`):

```ts
  {
    id: uuidv7(),
    name: '4Ps — Pantawid Pamilyang Pilipino Program',
    category: 'CCT',
    waitingPeriodDays: 0,
    requiredDocuments: [
      '4Ps Household ID',
      'Valid ID of parent/guardian',
      'Birth certificates of children (PSA)',
      'Barangay Certificate of Indigency',
      'Enrollment certificate (for school-age children)',
    ],
    fundSources: ['DSWD - 4Ps National'],
    legalBasis: 'RA 11310 (Pantawid Pamilyang Pilipino Program Act)',
    isActive: true,
  },
  {
    id: uuidv7(),
    name: 'KALAHI-CIDSS (Community-Driven Development)',
    category: 'Community Development',
    waitingPeriodDays: 0,
    requiredDocuments: [
      'Barangay assembly resolution / endorsement',
      'Community sub-project proposal',
      'Listahanan/NHTS-PR reference for household validation',
      'Barangay Certificate of Indigency (for household grantees)',
    ],
    fundSources: ['DSWD - KALAHI-CIDSS'],
    legalBasis: 'RA 7160 (Local Government Code); DSWD Administrative Order No. 2011-016 (KALAHI-CIDSS NCDDP)',
    isActive: true,
  },
  {
    id: uuidv7(),
    name: 'Walang Gutom Program (Food Stamp)',
    category: 'Food & Nutrition',
    waitingPeriodDays: 0,
    requiredDocuments: [
      'NHTS-PR / Listahanan reference or DSWD validation',
      'Valid ID of household grantee',
      'Barangay Certificate of Indigency',
      'Household composition certification',
    ],
    fundSources: ['DSWD - Walang Gutom Food Stamp'],
    legalBasis: 'EO 44 s. 2021 (Walang Gutom: Food Provision through Community Participation Program)',
    isActive: true,
  },
  {
    id: uuidv7(),
    name: 'UPLIFT (Economic Empowerment)',
    category: 'Livelihood',
    waitingPeriodDays: 0,
    requiredDocuments: [
      'Valid ID of participant',
      'Barangay Certificate of Indigency',
      'NHTS-PR / Listahanan reference or DSWD validation',
      'Household savings-group or association endorsement',
    ],
    fundSources: ['DSWD - UPLIFT'],
    legalBasis: 'DSWD UPLIFT Program Guidelines; RA 8425 (Social Reform and Poverty Alleviation Act)',
    isActive: true,
  },
```

- [ ] **Step 5: Run the seed spec to verify it passes**

Run: `npx jest seed-programs --silent`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add kapwa-server/src/database/seed-programs.ts kapwa-server/src/database/seed-programs.spec.ts
git commit -m "feat(seed): 4ps and co-managed national programs"
```

---

### Task 8: Household NHTS-PR endpoint

**Files:**
- Modify: `kapwa-server/src/beneficiaries/dto/beneficiaries.zod.ts`
- Modify: `kapwa-server/src/beneficiaries/beneficiaries.service.ts`
- Modify: `kapwa-server/src/beneficiaries/beneficiaries.controller.ts`
- Create: `kapwa-server/src/beneficiaries/beneficiaries.controller.spec.ts`
- Modify: `kapwa-server/src/beneficiaries/beneficiaries.service.spec.ts`

**Interfaces:**
- Consumes: `households.nhts_pr_id` (Task 1), `Household` entity, `benRepo` (has `.manager.update`).
- Produces: `NhtsPrSchema`, `NhtsPrInput`; `BeneficiariesService.setHouseholdNhtsPr(beneficiaryId: string, nhtsPrId?: string | null): Promise<{ householdId: string; nhtsPrId: string | null }>`; route `PATCH /beneficiaries/:id/household/nhts-pr`.

- [ ] **Step 1: Write the failing service tests (append to the existing spec)**

Add `Household` and `NotFoundException` imports to `beneficiaries.service.spec.ts`, add `manager: { update: jest.fn() }` to the `benRepoMock` initializer, and append:

```ts
  describe('setHouseholdNhtsPr', () => {
    it('sets the Listahanan reference id', async () => {
      benRepoMock.findOne.mockResolvedValue({ id: 'ben-1', household: { id: 'h1' } });
      const res = await service.setHouseholdNhtsPr('ben-1', 'NHTS-2024-000123');
      expect(benRepoMock.manager.update).toHaveBeenCalledWith(Household, 'h1', { nhtsPrId: 'NHTS-2024-000123' });
      expect(res).toEqual({ householdId: 'h1', nhtsPrId: 'NHTS-2024-000123' });
    });

    it('clears the id when passed an empty string', async () => {
      benRepoMock.findOne.mockResolvedValue({ id: 'ben-1', household: { id: 'h1' } });
      await service.setHouseholdNhtsPr('ben-1', '');
      expect(benRepoMock.manager.update).toHaveBeenCalledWith(Household, 'h1', { nhtsPrId: null });
    });

    it('throws when the beneficiary has no household', async () => {
      benRepoMock.findOne.mockResolvedValue({ id: 'ben-1', household: null });
      await expect(service.setHouseholdNhtsPr('ben-1', 'X')).rejects.toThrow(NotFoundException);
    });
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest beneficiaries.service --silent`
Expected: FAIL — `service.setHouseholdNhtsPr is not a function`.

- [ ] **Step 3: Add the zod schema**

In `beneficiaries.zod.ts`:

```ts
export const NhtsPrSchema = z.object({
  nhtsPrId: z.string().max(50).nullable().optional(),
});

export type NhtsPrInput = z.infer<typeof NhtsPrSchema>;
```

- [ ] **Step 4: Add the service method**

In `beneficiaries.service.ts` add `import { Household } from './household.entity';` and:

```ts
  async setHouseholdNhtsPr(
    beneficiaryId: string,
    nhtsPrId?: string | null,
  ): Promise<{ householdId: string; nhtsPrId: string | null }> {
    const ben = await this.benRepo.findOne({ where: { id: beneficiaryId }, relations: ['household'] });
    if (!ben) throw new NotFoundException('Beneficiary not found');
    if (!ben.household) throw new NotFoundException('Beneficiary has no household');
    const value = nhtsPrId ? nhtsPrId.trim() : null;
    await this.benRepo.manager.update(Household, ben.household.id, { nhtsPrId: value } as any);
    return { householdId: ben.household.id, nhtsPrId: value };
  }
```

- [ ] **Step 5: Run the service spec to verify it passes**

Run: `npx jest beneficiaries.service --silent`
Expected: PASS (existing tests + 3 new).

- [ ] **Step 6: Write the failing controller spec**

```ts
import { Test } from '@nestjs/testing';
import { BeneficiariesController } from './beneficiaries.controller';
import { BeneficiariesService } from './beneficiaries.service';
import { AbacGuard } from '../auth/guards/abac.guard';

describe('BeneficiariesController', () => {
  let controller: BeneficiariesController;
  const svc = {
    setHouseholdNhtsPr: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [BeneficiariesController],
      providers: [{ provide: BeneficiariesService, useValue: svc }],
    })
      .overrideGuard(AbacGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(BeneficiariesController);
    svc.setHouseholdNhtsPr.mockReset();
  });

  it('updates the household NHTS-PR reference id', async () => {
    svc.setHouseholdNhtsPr.mockResolvedValue({ householdId: 'h1', nhtsPrId: 'NHTS-1' });
    await expect(controller.setHouseholdNhtsPr('ben-1', { nhtsPrId: 'NHTS-1' })).resolves.toEqual({
      householdId: 'h1',
      nhtsPrId: 'NHTS-1',
    });
    expect(svc.setHouseholdNhtsPr).toHaveBeenCalledWith('ben-1', 'NHTS-1');
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npx jest beneficiaries.controller --silent`
Expected: FAIL — `controller.setHouseholdNhtsPr is not a function`.

- [ ] **Step 8: Add the controller route**

In `beneficiaries.controller.ts`: add `Patch` to the `@nestjs/common` import, import `NhtsPrSchema, NhtsPrInput` from `./dto/beneficiaries.zod`, and add:

```ts
  @Patch(':id/household/nhts-pr')
  @Roles('admin', 'social_worker', 'coordinator')
  @Sensitivity('internal')
  async setHouseholdNhtsPr(
    @Param('id') id: string,
    @Body(new ZodPipe(NhtsPrSchema)) body: NhtsPrInput,
  ) {
    return this.benService.setHouseholdNhtsPr(id, body.nhtsPrId);
  }
```

- [ ] **Step 9: Run the controller spec to verify it passes**

Run: `npx jest beneficiaries.controller --silent`
Expected: PASS.

- [ ] **Step 10: Typecheck and run the full server suite**

Run: `npm run typecheck && npx jest --silent`
Expected: clean.

- [ ] **Step 11: Commit**

```bash
git add kapwa-server/src/beneficiaries/dto/beneficiaries.zod.ts \
       kapwa-server/src/beneficiaries/beneficiaries.service.ts \
       kapwa-server/src/beneficiaries/beneficiaries.controller.ts \
       kapwa-server/src/beneficiaries/beneficiaries.controller.spec.ts \
       kapwa-server/src/beneficiaries/beneficiaries.service.spec.ts
git commit -m "feat(households): listahanan nhts_pr_id reference endpoint"
```

---

### Task 9: Access card PDF — NHTS-PR line

**Files:**
- Modify: `kapwa-server/src/access-cards/access-card-pdf.types.ts`
- Modify: `kapwa-server/src/access-cards/access-card-pdf.builder.ts`
- Modify: `kapwa-server/src/access-cards/access-card-pdf.builder.spec.ts`
- Modify: `kapwa-server/src/access-cards/access-cards.service.ts`
- Modify: `kapwa-server/src/access-cards/access-cards.service.spec.ts`

**Interfaces:**
- Consumes: `households.nhts_pr_id`.
- Produces: `AccessCardPdfData.nhtsPrId?: string`, rendered on page 2 in the client block.

- [ ] **Step 1: Write the failing builder spec**

In `access-card-pdf.builder.spec.ts`, add `nhtsPrId: 'NHTS-2024-000123',` to `fullData` (top level, after `contact`) and add to the first test:

```ts
    expect(text).toContain('NHTS-PR');
    expect(text).toContain('NHTS-2024-000123');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest access-card-pdf.builder --silent`
Expected: FAIL — text does not contain 'NHTS-PR'.

- [ ] **Step 3: Add the type + render the line**

In `access-card-pdf.types.ts` add after `contact: string;`:

```ts
  nhtsPrId?: string;
```

In `access-card-pdf.builder.ts`, in the page-2 client block, immediately after the Address `doc.text(...)` (the line using `data.client.address`), insert:

```ts
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#555')
    .text('NHTS-PR / Listahanan ID:', rx + 10, cy + 40, { width: 95 });
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#111')
    .text(data.nhtsPrId || '', rx + 95, cy + 40, { width: WIDTH / 2 - 105, ellipsis: true });
```

and change the following `cy += 52;` to `cy += 64;`.

- [ ] **Step 4: Run the builder spec to verify it passes**

Run: `npx jest access-card-pdf.builder --silent`
Expected: PASS (2 tests).

- [ ] **Step 5: Feed the value from the service**

In `access-cards.service.ts` `generateAccessCardPdf`, extend the person query by adding this expression to the SELECT list (next to the `phone` subquery):

```sql
              (SELECT nhts_pr_id FROM households WHERE id = b.household_id) AS nhts_pr_id
```

and add to the `data` object after `contact: p.phone ?? '',`:

```ts
      nhtsPrId: p.nhts_pr_id ?? undefined,
```

In `access-cards.service.spec.ts` `generateAccessCardPdf` test, add `nhts_pr_id: 'NHTS-2024-000123'` to the second `repoMock.query` mock row (the person row).

- [ ] **Step 6: Run the access-cards specs and typecheck**

Run: `npx jest access-cards --silent && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add kapwa-server/src/access-cards/access-card-pdf.types.ts \
       kapwa-server/src/access-cards/access-card-pdf.builder.ts \
       kapwa-server/src/access-cards/access-card-pdf.builder.spec.ts \
       kapwa-server/src/access-cards/access-cards.service.ts \
       kapwa-server/src/access-cards/access-cards.service.spec.ts
git commit -m "feat(access-cards): print listahanan nhts-pr id on the family card"
```

---

### Task 10: Client — i18n + compliance section/page + case-detail embed

**Files:**
- Modify: `kapwa-client/src/i18n/locales/en/index.ts`
- Modify: `kapwa-client/src/i18n/locales/fil/index.ts`
- Modify: `kapwa-client/src/lib/query-keys.ts`
- Create: `kapwa-client/src/components/case-view/FourPsComplianceSection.tsx`
- Create: `kapwa-client/src/components/case-view/FourPsComplianceSection.test.tsx`
- Create: `kapwa-client/src/pages/FourPsCompliancePage.tsx`
- Modify: `kapwa-client/src/routes.tsx`
- Modify: `kapwa-client/src/pages/CaseViewPage.tsx`
- Modify: `kapwa-client/src/pages/CaseViewPage.test.tsx`

**Interfaces:**
- Consumes: server routes from Task 6.
- Produces: `FourPsComplianceSection({ caseId }: { caseId: string })`, `isFourPsCase(caseData): boolean`, `FourPsCompliancePage`, query keys `queryKeys.fourps.compliance(caseId)` / `queryKeys.fourps.payouts(caseId)`, i18n `fourps.*` keys.

- [ ] **Step 1: Add the failing component test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { FourPsComplianceSection, isFourPsCase } from './FourPsComplianceSection';

const { mockApiGet, mockApiPost, mockApiPatch } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPatch: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    patch: (...args: unknown[]) => mockApiPatch(...args),
    del: vi.fn(),
  },
}));

function renderSection() {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
      <FourPsComplianceSection caseId="C-1" />
    </SWRConfig>,
  );
}

describe('FourPsComplianceSection', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPatch.mockReset();
    mockApiGet.mockResolvedValue({
      total: 2,
      complied: 1,
      rate: 0.5,
      byType: { fds: { total: 2, complied: 1, rate: 0.5 } },
      entries: [
        { id: 'e1', complianceType: 'fds', dueDate: '2026-10-01', monthLabel: 'Oct 2026', met: true },
        { id: 'e2', complianceType: 'school_attendance', dueDate: '2026-10-01', monthLabel: 'Oct 2026', met: false },
      ],
    });
    mockApiPatch.mockResolvedValue({ met: true });
    mockApiPost.mockResolvedValue({ generated: 12 });
  });

  it('renders the summary and entries', async () => {
    renderSection();
    expect(await screen.findByText('1/2 complied · 50% rate')).toBeInTheDocument();
    expect(screen.getByText('Family Development Session')).toBeInTheDocument();
    expect(screen.getByText('School Attendance')).toBeInTheDocument();
  });

  it('marks a pending item as complied', async () => {
    renderSection();
    await screen.findByText('School Attendance');
    fireEvent.click(screen.getByRole('button', { name: 'Mark as complied' }));
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/fourps/compliance/e2/meet'));
  });

  it('generates 12-month items', async () => {
    renderSection();
    await screen.findByText('1/2 complied · 50% rate');
    fireEvent.click(screen.getByRole('button', { name: /Generate 12-Month Items/ }));
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/fourps/C-1/generate-compliance'));
  });

  it('detects 4Ps cases from service requests and category', () => {
    expect(isFourPsCase({ serviceRequested: ['4Ps — Pantawid Pamilyang Pilipino Program'] })).toBe(true);
    expect(isFourPsCase({ clientCategory: '4Ps' })).toBe(true);
    expect(isFourPsCase({ serviceRequested: ['Financial Assistance'] })).toBe(false);
    expect(isFourPsCase(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run (from `kapwa-client/`): `npx vitest run src/components/case-view/FourPsComplianceSection.test.tsx`
Expected: FAIL — cannot resolve `./FourPsComplianceSection`.

- [ ] **Step 3: Add the i18n keys**

In `kapwa-client/src/i18n/locales/en/index.ts`, just before `} as const;` at the end, add (matching the file's quoted-key style):

```ts
  "fourps": {
    "sectionTitle": "4Ps Compliance",
    "title": "4Ps Compliance Monitoring",
    "description": "Per-member conditionality tracking",
    "generate": "Generate 12-Month Items",
    "generating": "Generating…",
    "summary": "{{complied}}/{{total}} complied · {{rate}}% rate",
    "empty": "No compliance items. Generate for this household.",
    "due": "Due: {{date}}",
    "markMet": "Mark as complied",
    "loading": "Loading…",
    "type": {
      "school_attendance": "School Attendance",
      "health_checkup": "Health Checkup",
      "fds": "Family Development Session",
      "other": "Other"
    }
  },
```

In `kapwa-client/src/i18n/locales/fil/index.ts`, just before the final `}` (before `};`), add:

```ts
  "fourps": {
    "sectionTitle": "Pagsunod sa 4Ps",
    "title": "Pagsubaybay sa Pagsunod sa 4Ps",
    "description": "Pagsubaybay sa kondisyon ng bawat miyembro",
    "generate": "Bumuo ng 12-Buwang Aytem",
    "generating": "Ginagawa…",
    "summary": "{{complied}}/{{total}} ang natupad · {{rate}}%",
    "empty": "Walang aytem ng pagsunod. Bumuo para sa sambahayang ito.",
    "due": "Takdang petsa: {{date}}",
    "markMet": "Markahan bilang natupad",
    "loading": "Naglo-load…",
    "type": {
      "school_attendance": "Pagpasok sa Paaralan",
      "health_checkup": "Pagsusuri sa Kalusugan",
      "fds": "Sesyon sa Pagpapaunlad ng Pamilya",
      "other": "Iba pa"
    }
  },
```

- [ ] **Step 4: Add the query keys**

In `query-keys.ts`, add to the `queryKeys` object (e.g. after the `beneficiaries` block):

```ts
  fourps: {
    compliance: (caseId: string) =>
      memo(`fourps.compliance.${caseId}`, () => ['fourps', caseId, 'compliance'] as const),
    payouts: (caseId: string) =>
      memo(`fourps.payouts.${caseId}`, () => ['fourps', caseId, 'payouts'] as const),
  },
```

- [ ] **Step 5: Write the compliance section component**

```tsx
import { useState } from 'react';
import useSWR from 'swr';
import { CheckCircle, Circle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ComplianceEntry {
  id: string;
  complianceType?: 'school_attendance' | 'health_checkup' | 'fds';
  dueDate: string;
  monthLabel?: string;
  met: boolean;
}

interface ComplianceStatus {
  total: number;
  complied: number;
  rate: number;
  byType: Record<string, { total: number; complied: number; rate: number }>;
  entries: ComplianceEntry[];
}

export function isFourPsCase(caseData: {
  serviceRequested?: unknown;
  clientCategory?: unknown;
} | null | undefined): boolean {
  if (!caseData) return false;
  const requested = Array.isArray(caseData.serviceRequested) ? caseData.serviceRequested.join(' ') : '';
  const haystack = `${requested} ${caseData.clientCategory ?? ''}`;
  return /4ps|pantawid/i.test(haystack);
}

export function FourPsComplianceSection({ caseId }: { caseId: string }) {
  const { t } = useTranslation();
  const { data, isLoading, mutate } = useSWR<ComplianceStatus>(
    caseId ? queryKeys.fourps.compliance(caseId) : null,
  );
  const [generating, setGenerating] = useState(false);

  async function generate() {
    setGenerating(true);
    try {
      await api.post(`/fourps/${caseId}/generate-compliance`);
      await mutate();
    } finally {
      setGenerating(false);
    }
  }

  async function markMet(id: string) {
    await api.patch(`/fourps/compliance/${id}/meet`);
    await mutate();
  }

  const entries = data?.entries ?? [];
  const complied = data?.complied ?? 0;
  const total = data?.total ?? 0;
  const rate = total > 0 ? Math.round((complied / total) * 100) : 0;

  const typeLabel = (type?: string) => t(`fourps.type.${type || 'other'}`, { defaultValue: t('fourps.type.other', 'Other') });

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold">{t('fourps.sectionTitle', '4Ps Compliance')}</h3>
          <p className="text-xs text-muted-foreground">
            {t('fourps.summary', '{{complied}}/{{total}} complied · {{rate}}% rate', { complied, total, rate })}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={generate} disabled={generating}>
          <RefreshCw size={14} className={`mr-1 ${generating ? 'animate-spin' : ''}`} />
          {generating ? t('fourps.generating', 'Generating…') : t('fourps.generate', 'Generate 12-Month Items')}
        </Button>
      </div>

      <div className="w-full bg-secondary rounded-full h-2 mb-4">
        <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${rate}%` }} />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('fourps.loading', 'Loading…')}</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('fourps.empty', 'No compliance items. Generate for this household.')}</p>
      ) : (
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {entries.map(entry => (
            <div key={entry.id} className="flex items-center justify-between py-1.5 text-sm border-b last:border-0">
              <div className="min-w-0">
                <span className={entry.met ? 'line-through text-muted-foreground' : ''}>
                  {typeLabel(entry.complianceType)}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {t('fourps.due', 'Due: {{date}}', { date: entry.dueDate })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={entry.met ? 'default' : 'secondary'} className="text-xs">
                  {entry.monthLabel || typeLabel(entry.complianceType)}
                </Badge>
                {entry.met ? (
                  <CheckCircle size={16} className="text-green-600" />
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2"
                    aria-label={t('fourps.markMet', 'Mark as complied')}
                    onClick={() => markMet(entry.id)}
                  >
                    <Circle size={14} className="text-amber-600" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Run the component test to verify it passes**

Run: `npx vitest run src/components/case-view/FourPsComplianceSection.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 7: Write the standalone page**

```tsx
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageShell } from '@/components/PageShell';
import { FourPsComplianceSection } from '@/components/case-view/FourPsComplianceSection';

export function FourPsCompliancePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const { t } = useTranslation();

  return (
    <PageShell
      title={t('fourps.title', '4Ps Compliance Monitoring')}
      description={t('fourps.description', 'Per-member conditionality tracking')}
    >
      {caseId ? <FourPsComplianceSection caseId={caseId} /> : null}
    </PageShell>
  );
}
```

- [ ] **Step 8: Add the route**

In `routes.tsx`, add the lazy import next to the other page imports:

```tsx
const FourPsCompliancePage = lazy(() => import('./pages/FourPsCompliancePage').then(m => ({ default: m.FourPsCompliancePage })));
```

and the route entry after `{ path: '/cases/:id', ... }`:

```tsx
  { path: '/cases/:caseId/4ps-compliance', element: <Private roles={['admin','social_worker','coordinator']}><FourPsCompliancePage /></Private> },
```

- [ ] **Step 9: Embed the section in CaseViewPage**

Add the import (next to `CaseAccessCardPanel`):

```tsx
import { FourPsComplianceSection, isFourPsCase } from '@/components/case-view/FourPsComplianceSection';
```

and render it immediately after the `{/* Access Card Ledger ... */}` / `<CaseAccessCardPanel ... />` block (around line 478):

```tsx
          {/* 4Ps conditionality tracking — visible for Pantawid households */}
          {isFourPsCase(caseData) && id && (
            <FourPsComplianceSection caseId={id} />
          )}
```

- [ ] **Step 10: Add the CaseViewPage gate test**

Append to `CaseViewPage.test.tsx`:

```tsx
describe('CaseViewPage — 4Ps compliance', () => {
  it('shows the compliance section for a Pantawid case', async () => {
    mockUseAuth.mockReturnValue({ user: { id: '1', fullName: 'Admin', role: 'admin' } });
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('fourps')) return Promise.resolve({ total: 0, complied: 0, rate: 0, byType: {}, entries: [] });
      if (k.includes('history')) return Promise.resolve([]);
      if (k.includes('interventions')) return Promise.resolve([]);
      if (k.includes('family-graph')) return Promise.resolve({ members: [], primary: null });
      if (k.includes('inter-agency-referrals')) return Promise.resolve([]);
      if (k.includes('cases')) {
        return Promise.resolve({ ...mockCase, serviceRequested: ['4Ps — Pantawid Pamilyang Pilipino Program'] });
      }
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });

    renderWithSWR(<CaseViewPage />);

    expect(await screen.findByText('4Ps Compliance')).toBeInTheDocument();
  });
});
```

- [ ] **Step 11: Run the client tests + typecheck**

Run (from `kapwa-client/`): `npx vitest run src/pages/CaseViewPage.test.tsx src/components/case-view/FourPsComplianceSection.test.tsx src/i18n/__tests__/fil-parity.test.ts && npm run typecheck`
Expected: PASS, parity clean, typecheck clean.

- [ ] **Step 12: Commit**

```bash
git add kapwa-client/src/i18n/locales/en/index.ts \
       kapwa-client/src/i18n/locales/fil/index.ts \
       kapwa-client/src/lib/query-keys.ts \
       kapwa-client/src/components/case-view/FourPsComplianceSection.tsx \
       kapwa-client/src/components/case-view/FourPsComplianceSection.test.tsx \
       kapwa-client/src/pages/FourPsCompliancePage.tsx \
       kapwa-client/src/routes.tsx \
       kapwa-client/src/pages/CaseViewPage.tsx \
       kapwa-client/src/pages/CaseViewPage.test.tsx
git commit -m "feat(4ps): compliance section, page, and case-detail embed"
```

---

### Task 11: Client — payout schedule page

**Files:**
- Modify: `kapwa-client/src/i18n/locales/en/index.ts`
- Modify: `kapwa-client/src/i18n/locales/fil/index.ts`
- Create: `kapwa-client/src/pages/PayoutSchedulePage.tsx`
- Create: `kapwa-client/src/pages/PayoutSchedulePage.test.tsx`
- Modify: `kapwa-client/src/routes.tsx`

**Interfaces:**
- Consumes: `queryKeys.fourps.payouts` (Task 10), server payout routes (Task 6).
- Produces: `PayoutSchedulePage`, route `/cases/:caseId/payouts`, i18n `payouts.*` keys.

- [ ] **Step 1: Write the failing page test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { PayoutSchedulePage } from './PayoutSchedulePage';

const { mockApiGet, mockApiPatch, mockApiPost } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPatch: vi.fn(),
  mockApiPost: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    patch: (...args: unknown[]) => mockApiPatch(...args),
    del: vi.fn(),
  },
}));

function renderPage() {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
      <MemoryRouter initialEntries={['/cases/C-1/payouts']}>
        <Routes>
          <Route path="/cases/:caseId/payouts" element={<PayoutSchedulePage />} />
        </Routes>
      </MemoryRouter>
    </SWRConfig>,
  );
}

describe('PayoutSchedulePage', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPatch.mockReset();
    mockApiPost.mockReset();
    mockApiPatch.mockResolvedValue({ id: 'p1' });
    mockApiPost.mockResolvedValue({ id: 'p1' });
  });

  it('lists payouts and marks one completed', async () => {
    mockApiGet.mockResolvedValue([
      { id: 'p1', scheduledAt: '2026-10-01', cycleNo: 'CY2026-02', amount: 1200, status: 'scheduled' },
    ]);
    renderPage();
    expect(await screen.findByText('CY2026-02')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Mark Completed/ }));
    await waitFor(() =>
      expect(mockApiPatch).toHaveBeenCalledWith('/fourps/payouts/p1/status', { status: 'completed' }),
    );
  });

  it('shows the empty state', async () => {
    mockApiGet.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('No payout schedules yet.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run (from `kapwa-client/`): `npx vitest run src/pages/PayoutSchedulePage.test.tsx`
Expected: FAIL — cannot resolve `./PayoutSchedulePage`.

- [ ] **Step 3: Add the i18n keys**

In `kapwa-client/src/i18n/locales/en/index.ts` (just before the `fourps` block added in Task 10, or anywhere before `} as const;`):

```ts
  "payouts": {
    "title": "4Ps Payout Schedule",
    "description": "Track DSWD payout schedules and beneficiary notifications",
    "schedule": "Schedule Payout",
    "date": "Payout Date",
    "cycle": "Cycle",
    "cyclePlaceholder": "e.g. CY2026-02",
    "amount": "Amount (₱)",
    "save": "Save",
    "cancel": "Cancel",
    "notify": "Notify",
    "markCompleted": "Mark Completed",
    "markMissed": "Mark Missed",
    "cancelPayout": "Cancel Payout",
    "empty": "No payout schedules yet.",
    "notified": "Notified: {{date}}"
  },
```

In `kapwa-client/src/i18n/locales/fil/index.ts`:

```ts
  "payouts": {
    "title": "Iskedyul ng Pagbabayad sa 4Ps",
    "description": "Subaybayan ang iskedyul ng pagbabayad ng DSWD at mga abiso sa benepisyaryo",
    "schedule": "Iskedyul ang Pagbabayad",
    "date": "Petsa ng Pagbabayad",
    "cycle": "Siklo",
    "cyclePlaceholder": "hal. CY2026-02",
    "amount": "Halaga (₱)",
    "save": "I-save",
    "cancel": "Kanselahin",
    "notify": "Abisuhan",
    "markCompleted": "Markahan na Tapos",
    "markMissed": "Markahan na Hindi Natupad",
    "cancelPayout": "Kanselahin ang Pagbabayad",
    "empty": "Wala pang iskedyul ng pagbabayad.",
    "notified": "Naabisuhan: {{date}}"
  },
```

- [ ] **Step 4: Write the page**

```tsx
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { Bell, Calendar, CheckCircle, DollarSign, XCircle } from 'lucide-react';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Payout {
  id: string;
  cycleNo?: string;
  scheduledAt: string;
  amount?: number;
  status: 'scheduled' | 'completed' | 'missed' | 'cancelled';
  notifiedAt?: string;
  remarks?: string;
}

export function PayoutSchedulePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const { t } = useTranslation();
  const { data, mutate } = useSWR<Payout[]>(caseId ? queryKeys.fourps.payouts(caseId) : null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ scheduledAt: '', cycleNo: '', amount: '' });
  const [error, setError] = useState('');
  const payouts = data ?? [];

  async function handleSchedule() {
    if (!caseId || !form.scheduledAt) return;
    try {
      await api.post(`/fourps/${caseId}/payouts`, {
        scheduledAt: form.scheduledAt,
        cycleNo: form.cycleNo || undefined,
        amount: form.amount ? Number(form.amount) : undefined,
      });
      setShowForm(false);
      setForm({ scheduledAt: '', cycleNo: '', amount: '' });
      setError('');
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function setStatus(id: string, status: 'completed' | 'missed' | 'cancelled') {
    await api.patch(`/fourps/payouts/${id}/status`, { status });
    await mutate();
  }

  async function notify(id: string) {
    await api.post(`/fourps/payouts/${id}/notify`);
    await mutate();
  }

  const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    scheduled: 'outline',
    completed: 'default',
    missed: 'destructive',
    cancelled: 'secondary',
  };

  return (
    <PageShell
      title={t('payouts.title', '4Ps Payout Schedule')}
      description={t('payouts.description', 'Track DSWD payout schedules and beneficiary notifications')}
    >
      {error && (
        <div className="rounded-lg bg-destructive/10 border px-4 py-3 text-sm text-destructive mb-4">{error}</div>
      )}

      <div className="mb-4">
        <Button onClick={() => setShowForm(true)}>
          <Calendar size={14} className="mr-1" /> {t('payouts.schedule', 'Schedule Payout')}
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('payouts.schedule', 'Schedule Payout')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="date"
              aria-label={t('payouts.date', 'Payout Date')}
              value={form.scheduledAt}
              onChange={e => setForm(p => ({ ...p, scheduledAt: e.target.value }))}
            />
            <Input
              placeholder={t('payouts.cyclePlaceholder', 'e.g. CY2026-02')}
              aria-label={t('payouts.cycle', 'Cycle')}
              value={form.cycleNo}
              onChange={e => setForm(p => ({ ...p, cycleNo: e.target.value }))}
            />
            <Input
              type="number"
              placeholder={t('payouts.amount', 'Amount (₱)')}
              aria-label={t('payouts.amount', 'Amount (₱)')}
              value={form.amount}
              onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
            />
            <Button className="w-full" onClick={handleSchedule}>
              {t('payouts.save', 'Save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {payouts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <DollarSign className="mx-auto mb-2" size={32} />
          <p>{t('payouts.empty', 'No payout schedules yet.')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payouts.map(payout => (
            <div key={payout.id} className="rounded-lg border bg-card shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold">
                    {new Date(payout.scheduledAt).toLocaleDateString('en-PH', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                  {payout.cycleNo && <span className="ml-3 text-xs text-muted-foreground">{payout.cycleNo}</span>}
                  {payout.amount != null && (
                    <span className="ml-3 text-lg font-bold">₱{Number(payout.amount).toLocaleString()}</span>
                  )}
                </div>
                <Badge variant={statusVariant[payout.status] || 'outline'}>
                  {t(`payouts.status.${payout.status}`, {
                    defaultValue: payout.status,
                  })}
                </Badge>
              </div>
              <div className="mt-2 flex items-center gap-2">
                {payout.status === 'scheduled' && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => notify(payout.id)}>
                      <Bell size={14} className="mr-1" /> {t('payouts.notify', 'Notify')}
                    </Button>
                    <Button size="sm" variant="default" onClick={() => setStatus(payout.id, 'completed')}>
                      <CheckCircle size={14} className="mr-1" /> {t('payouts.markCompleted', 'Mark Completed')}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setStatus(payout.id, 'missed')}>
                      <XCircle size={14} className="mr-1" /> {t('payouts.markMissed', 'Mark Missed')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setStatus(payout.id, 'cancelled')}>
                      {t('payouts.cancelPayout', 'Cancel Payout')}
                    </Button>
                  </>
                )}
                {payout.notifiedAt && (
                  <span className="text-xs text-muted-foreground">
                    {t('payouts.notified', 'Notified: {{date}}', {
                      date: new Date(payout.notifiedAt).toLocaleString(),
                    })}
                  </span>
                )}
              </div>
              {payout.remarks && <p className="mt-1 text-xs text-muted-foreground">{payout.remarks}</p>}
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
```

Note: `t('payouts.status.scheduled')` etc. require status keys — add these to both locales alongside the block above:

```ts
    "status": {
      "scheduled": "Scheduled",
      "completed": "Completed",
      "missed": "Missed",
      "cancelled": "Cancelled"
    }
```

fil:

```ts
    "status": {
      "scheduled": "Naka-iskedyul",
      "completed": "Tapos na",
      "missed": "Hindi Natupad",
      "cancelled": "Kinansela"
    }
```

- [ ] **Step 5: Add the route**

In `routes.tsx`:

```tsx
const PayoutSchedulePage = lazy(() => import('./pages/PayoutSchedulePage').then(m => ({ default: m.PayoutSchedulePage })));
```

and after the 4ps-compliance route:

```tsx
  { path: '/cases/:caseId/payouts', element: <Private roles={['admin','social_worker','coordinator']}><PayoutSchedulePage /></Private> },
```

- [ ] **Step 6: Run the page test + parity + typecheck**

Run (from `kapwa-client/`): `npx vitest run src/pages/PayoutSchedulePage.test.tsx src/i18n/__tests__/fil-parity.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add kapwa-client/src/i18n/locales/en/index.ts \
       kapwa-client/src/i18n/locales/fil/index.ts \
       kapwa-client/src/pages/PayoutSchedulePage.tsx \
       kapwa-client/src/pages/PayoutSchedulePage.test.tsx \
       kapwa-client/src/routes.tsx
git commit -m "feat(4ps): payout schedule page and route"
```

---

### Task 12: Client — NHTS-PR display + edit

**Files:**
- Modify: `kapwa-client/src/i18n/locales/en/index.ts`
- Modify: `kapwa-client/src/i18n/locales/fil/index.ts`
- Modify: `kapwa-client/src/pages/BeneficiaryViewPage.tsx`
- Modify: `kapwa-client/src/pages/BeneficiaryViewPage.test.tsx`
- Modify: `kapwa-client/src/pages/CaseViewPage.tsx`

**Interfaces:**
- Consumes: `PATCH /beneficiaries/:id/household/nhts-pr` (Task 8).
- Produces: NHTS-PR row + inline editor on the beneficiary page; read-only row on the case-detail household card; i18n `nhts.*` keys (`label`, `placeholder`, `saved`, `saveFailed`, `edit`, `editLabel`, `save`, `saveLabel`, `cancel`, `notSet`).

- [ ] **Step 1: Write the failing test additions**

In `BeneficiaryViewPage.test.tsx`:
- add `household: { nhtsPrId: 'NHTS-2024-000123' }` to `mockBeneficiary`,
- extend the `vi.mock('../lib/api', ...)` object with `patch: (...args: unknown[]) => mockApiPatch(...args)` and add `mockApiPatch` to the `vi.hoisted` block (`mockApiPatch: vi.fn()`),
- reset it in `beforeEach`: `mockApiPatch.mockReset();`,
- append:

```tsx
  it('shows and edits the NHTS-PR / Listahanan ID', async () => {
    mockApiPatch.mockResolvedValue({ householdId: 'h1', nhtsPrId: 'NHTS-2024-999999' });
    renderWithSWR(<BeneficiaryViewPage />);

    expect(await screen.findByText('NHTS-2024-000123')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit NHTS-PR ID' }));
    const input = screen.getByLabelText('NHTS-PR / Listahanan ID');
    fireEvent.change(input, { target: { value: 'NHTS-2024-999999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save NHTS-PR ID' }));

    await waitFor(() =>
      expect(mockApiPatch).toHaveBeenCalledWith('/beneficiaries/BEN-001/household/nhts-pr', {
        nhtsPrId: 'NHTS-2024-999999',
      }),
    );
  });
```

Add `fireEvent` and `waitFor` to the existing `@testing-library/react` import in that file.

- [ ] **Step 2: Run it to verify it fails**

Run (from `kapwa-client/`): `npx vitest run src/pages/BeneficiaryViewPage.test.tsx`
Expected: FAIL — no `NHTS-2024-000123` text / no Edit button.

- [ ] **Step 3: Add the i18n keys**

en (before `} as const;`):

```ts
  "nhts": {
    "label": "NHTS-PR / Listahanan ID",
    "placeholder": "Enter NHTS-PR / Listahanan ID",
    "saved": "NHTS-PR ID saved.",
    "saveFailed": "Unable to save NHTS-PR ID.",
    "edit": "Edit",
    "editLabel": "Edit NHTS-PR ID",
    "save": "Save",
    "saveLabel": "Save NHTS-PR ID",
    "cancel": "Cancel",
    "notSet": "Not set"
  },
```

fil (before the final `}`):

```ts
  "nhts": {
    "label": "ID ng Listahanan (NHTS-PR)",
    "placeholder": "Ilagay ang ID ng Listahanan (NHTS-PR)",
    "saved": "Nai-save ang ID ng Listahanan.",
    "saveFailed": "Hindi na-save ang ID ng Listahanan.",
    "edit": "I-edit",
    "editLabel": "I-edit ang ID ng Listahanan",
    "save": "I-save",
    "saveLabel": "I-save ang ID ng Listahanan",
    "cancel": "Kanselahin",
    "notSet": "Hindi nakatakda"
  },
```

- [ ] **Step 4: Wire the beneficiary page**

In `BeneficiaryViewPage.tsx`:
- add `import { Input } from "@/components/ui/input";` (if not already imported),
- add `nhtsPrId?: string;` to the `BeneficiaryDetail` interface,
- add state next to the other `useState`s:

```tsx
  const [editingNhts, setEditingNhts] = useState(false);
  const [nhtsDraft, setNhtsDraft] = useState('');
  const [nhtsSaving, setNhtsSaving] = useState(false);
  const [nhtsMsg, setNhtsMsg] = useState('');
```

- populate the field in the `setBeneficiary({...})` mapping:

```tsx
        nhtsPrId: ((b.household as Record<string, unknown>)?.nhtsPrId as string) || undefined,
```

- add the save handler near `handleLogIntervention`:

```tsx
  async function saveNhtsPr() {
    if (!beneficiary?.id) return;
    setNhtsSaving(true);
    setNhtsMsg('');
    try {
      const value = nhtsDraft.trim() || null;
      await api.patch(`/beneficiaries/${beneficiary.id}/household/nhts-pr`, { nhtsPrId: value });
      setBeneficiary(prev => (prev ? { ...prev, nhtsPrId: value || undefined } : prev));
      setEditingNhts(false);
      setNhtsMsg(t('nhts.saved', 'NHTS-PR ID saved.'));
    } catch {
      setNhtsMsg(t('nhts.saveFailed', 'Unable to save NHTS-PR ID.'));
    } finally {
      setNhtsSaving(false);
    }
  }
```

- render the row + editor in the Personal Info card, directly after the `beneficiaries.household` `InfoRow`:

```tsx
              <div className="flex items-start justify-between gap-2">
                <InfoRow
                  icon={Tag}
                  label={t('nhts.label', 'NHTS-PR / Listahanan ID')}
                  value={beneficiary.nhtsPrId || t('nhts.notSet', 'Not set')}
                />
                {!editingNhts && (
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={t('nhts.editLabel', 'Edit NHTS-PR ID')}
                    onClick={() => {
                      setNhtsDraft(beneficiary.nhtsPrId || '');
                      setEditingNhts(true);
                    }}
                  >
                    {t('nhts.edit', 'Edit')}
                  </Button>
                )}
              </div>
              {editingNhts && (
                <div className="flex items-center gap-2">
                  <Input
                    aria-label={t('nhts.label', 'NHTS-PR / Listahanan ID')}
                    placeholder={t('nhts.placeholder', 'Enter NHTS-PR / Listahanan ID')}
                    value={nhtsDraft}
                    onChange={e => setNhtsDraft(e.target.value)}
                  />
                  <Button size="sm" disabled={nhtsSaving} aria-label={t('nhts.saveLabel', 'Save NHTS-PR ID')} onClick={saveNhtsPr}>
                    {t('nhts.save', 'Save')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingNhts(false)}>
                    {t('nhts.cancel', 'Cancel')}
                  </Button>
                </div>
              )}
              {nhtsMsg && <p className="text-xs text-muted-foreground">{nhtsMsg}</p>}
```

- [ ] **Step 5: Run the beneficiary test to verify it passes**

Run: `npx vitest run src/pages/BeneficiaryViewPage.test.tsx`
Expected: PASS.

- [ ] **Step 6: Show it read-only on the case detail household card**

In `CaseViewPage.tsx`, inside the Household card (`{household && (...)}`), after the `household.estimatedIncome` block:

```tsx
                {household.nhtsPrId && (
                  <div>
                    <span className="text-muted-foreground text-xs">{t('nhts.label', 'NHTS-PR / Listahanan ID')}</span>
                    <p>{household.nhtsPrId}</p>
                  </div>
                )}
```

- [ ] **Step 7: Run the full client suite + typecheck**

Run (from `kapwa-client/`): `npm run test:run && npm run typecheck`
Expected: all tests pass (i18n parity included), typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add kapwa-client/src/i18n/locales/en/index.ts \
       kapwa-client/src/i18n/locales/fil/index.ts \
       kapwa-client/src/pages/BeneficiaryViewPage.tsx \
       kapwa-client/src/pages/BeneficiaryViewPage.test.tsx \
       kapwa-client/src/pages/CaseViewPage.tsx
git commit -m "feat(nhts): listahanan reference display and edit on beneficiary page"
```

---

### Task 13: Docs + full verification

**Files:**
- Modify: `.superpowers/sdd/progress.md`
- Modify: `docs/inter-agency-beneficiary-tracking.md`
- Modify: `docs/case-lifecycle-research.md`

**Interfaces:**
- Consumes: everything above.
- Produces: ledger entry + updated notes.

- [ ] **Step 1: Update the progress ledger**

Append to `.superpowers/sdd/progress.md`:

```markdown
## 2026-09-17 — 4Ps integration + co-managed national programs
- Spec: docs/superpowers/specs/2026-09-17-4ps-and-comanaged-programs-design.md
- Plan: docs/superpowers/plans/2026-09-17-4ps-and-comanaged-programs.md
- Added case_compliance_items + case_payouts (migrations 0057/0058 + migrate.ts) and households.nhts_pr_id.
- New fourps module: compliance generation/checkoff + payout ledger, seeded 4Ps/KALAHI-CIDSS/Walang Gutom/UPLIFT.
- Client: 4Ps compliance section/page, payout schedule page, NHTS-PR display/edit.
```

- [ ] **Step 2: Note the new reference slot in the inter-agency doc**

In `docs/inter-agency-beneficiary-tracking.md`, near the Listahanan guidance (line ~113), add:

```markdown
> Implemented 2026-09-17: `households.nhts_pr_id` (nullable, partial-unique) is the
> single reference field for Listahanan/NHTS-PR. KAPWA stores the identifier only —
> it never duplicates Listahanan data.
```

- [ ] **Step 3: Mark the 4Ps gap addressed**

In `docs/case-lifecycle-research.md` §6, replace the "missing" bullets (compliance items, payout schedules, compliance page/route, program-driven workflow) with a single note referencing the spec:

```markdown
> Addressed 2026-09-17: conditionality checkoffs (`case_compliance_items`), payout
> schedule tracking (`case_payouts`), the 4Ps program seed, and the compliance
> UI routes now exist. See docs/superpowers/specs/2026-09-17-4ps-and-comanaged-programs-design.md.
```

- [ ] **Step 4: Full verification gates**

```bash
cd kapwa-server && npm run typecheck && npx jest --silent
cd ../kapwa-client && npm run typecheck && npm run test:run
```

Expected: server suite green (58 suites + 4 new fourps specs + seed spec + beneficiaries controller spec), client suite green, both typechecks clean.

- [ ] **Step 5: Lint the server**

Run (from `kapwa-server/`): `npm run lint`
Expected: no errors (lint auto-fixes).

- [ ] **Step 6: Commit**

```bash
git add .superpowers/sdd/progress.md docs/inter-agency-beneficiary-tracking.md docs/case-lifecycle-research.md
git commit -m "docs: record 4ps + co-managed programs implementation"
```

---

## Self-Review

**Spec coverage** (against `docs/superpowers/specs/2026-09-17-4ps-and-comanaged-programs-design.md`):

| Spec section | Task |
|---|---|
| §3.1 `case_compliance_items` + `case_payouts` (migration 0057) | Task 1 |
| §3.2 `households.nhts_pr_id` (migration 0058) | Task 1 |
| §3.3 entities + household column | Tasks 1–2 |
| §4 `fourps` module: generation, status, checkoff, payouts | Tasks 3–6 |
| §4.2 controller routes | Task 6 |
| §4.3 `PATCH /beneficiaries/:id/household/nhts-pr` | Task 8 |
| §5 four seed rows | Task 7 |
| §6 client compliance section/page/route, payout page/route, NHTS-PR display | Tasks 10–12 |
| §6 access card PDF shows NHTS-PR | Task 9 |
| §7 error handling (`NotFoundException`, `ON CONFLICT DO NOTHING`, zod) | Tasks 3–6, 8 |
| §8 testing | every task; final gates Task 13 |
| §10 docs | Task 13 |
| §6 i18n parity | Tasks 10–12 (both locales + parity test runs) |

**Deviation notes (deliberate):**
- Spec §4.1 named `generateComplianceItems(caseId, userId)` — implemented as `generateComplianceItems(caseId)` because no audit column consumes the actor id; `markComplied`/`markNotified` do take `userId`.
- Spec §6 said the embedded section lives in `pages/`; the plan places it in `components/case-view/` to match the existing `CaseAccessCardPanel` convention.
- Spec §6 "coordinator caseload surfaces compliance rate + open payout count" (cross-case dashboard aggregate) is **deferred** — the compliance section shows the rate and the payout page shows open payouts per case; a cross-case aggregate needs a new endpoint and is tracked as a follow-up.

**Placeholder scan:** no TBD/TODO; all steps carry concrete code or exact commands.

**Type consistency:** `ComplianceType`/`PayoutStatus` defined in Task 2 and used verbatim in Tasks 3–6; service method names in Task 6 match Tasks 3–5 (`generateComplianceItems`, `getComplianceStatus`, `markComplied`, `unmarkComplied`, `schedulePayout`, `listByCase`, `setPayoutStatus`, `markNotified`); client routes in Tasks 10–11 match controller paths in Task 6; i18n keys referenced in components exist in both locales (Tasks 10–12).
