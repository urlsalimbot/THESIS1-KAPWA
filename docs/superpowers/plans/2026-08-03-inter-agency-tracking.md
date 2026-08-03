# Inter-Agency Beneficiary Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add intra-municipal inter-agency beneficiary tracking (agencies table, closed-loop inter-agency referrals, agency-aware access-card service logs, and a three-section access-card aggregate view) on top of KAPWA's existing identity/consent foundations.

**Architecture:** Two new server modules (`agencies`, `inter-agency-referrals`) plus modifications to `access-cards` (agency_id on service logs + `GET /access-cards/:code/summary`), `beneficiaries` (PSN exact-match dedup), and `irf` (agencies-lookup export label). Three migrations. One new client page for the referral inbox/create flow and an enhanced access-card page. Service-level scoping (NOT RLS) follows the existing `referrals` module pattern.

**Tech Stack:** NestJS 11, TypeORM (Postgres 16, snake_case naming), Zod 3 + `ZodPipe`, JWT + Roles guards, React 19 + SWR + Vite, Zod 4 (client), vitest + @testing-library/react (client), Jest + ts-jest (server).

## Global Constraints

- **RLS is DORMANT in this codebase.** The app connects as table owner `kapwa`, never sets `app.current_role`, and Postgres owner connections bypass RLS policies. The working, proven pattern is **service-layer scoping** (see `referrals/referrals.service.ts`). Therefore: **do NOT add RLS policies in any new migration.** Enforce agency scoping in the service layer. This is a deliberate deviation from the spec's §4.
- **Server tests:** run from `kapwa-server/` with `npx jest <relative/path> --coverage=false`. Never `npm test` (full-coverage run is slow).
- **Client tests:** run from `kapwa-client/` with `npx vitest run <relative/path>`.
- **Server typecheck:** `cd kapwa-server && npx tsc --noEmit`. **Client build:** `cd kapwa-client && npx vite build` (or `npm run build`).
- **Migrations auto-run on app boot** (`migrationsRun: true`) and via `npm run migration:run` in `kapwa-server/`. Postgres runs via `docker compose up -d postgres` (service name `postgres`).
- **Naming/copy rules:** commit messages use conventional commits (`feat:`, `fix:`, `test:`). Never commit secrets. No code comments unless the surrounding file uses them.
- **Migration class naming:** `export class <Name>20260803<NNN> implements MigrationInterface { name = '<Name>20260803<NNN>'; }`.
- **Status flow (service guard):** `referred → received → actioned → closed`; `declined` allowed from `referred` only. Illegal transitions → `409 ConflictException` with an allowed-transitions message.
- **Error codes:** unknown agency code → `422 UnprocessableEntityException`; consent-inactive other-agency read → `200` with empty array (masked, not 403).
- **Client URL building:** SWR keys are arrays joined by `/` (see `normalizePath` in `lib/api.ts`). `queryKeys.accessCards.agencySummary(code)` must produce `['access-cards', code, 'summary']`.
- **Agency scoping rule:** a referral/row is visible to an agency staffer iff their `agencyId` equals `from_agency_id` or `to_agency_id`. Admin sees everything. `users.agency_id` is backfilled to the `MSWDO` agency for existing `admin`/`social_worker` users in migration 1.
- **`logService` "exactly one of agency_id or agency" is enforced at the controller DTO level** (the public HTTP surface). The internal `autoLogFromIntervention` call bypasses the DTO and stays agency-less (back-compat). Unknown freeform code → 422. This is a deliberate interpretation of spec §3.3.

---

## File Structure

**Server — new**
- `kapwa-server/src/database/migrations/20260803000001-CreateAgenciesTable.ts` — agencies table + seed + `users.agency_id`
- `kapwa-server/src/database/migrations/20260803000002-CreateInterAgencyReferralsTable.ts`
- `kapwa-server/src/database/migrations/20260803000003-AddAgencyIdToAccessCardServices.ts`
- `kapwa-server/src/agencies/agency.entity.ts`
- `kapwa-server/src/agencies/dto/agencies.zod.ts`
- `kapwa-server/src/agencies/agencies.service.ts`
- `kapwa-server/src/agencies/agencies.controller.ts`
- `kapwa-server/src/agencies/agencies.module.ts`
- `kapwa-server/src/agencies/agencies.service.spec.ts`
- `kapwa-server/src/inter-agency-referrals/inter-agency-referral.entity.ts`
- `kapwa-server/src/inter-agency-referrals/dto/inter-agency-referrals.zod.ts`
- `kapwa-server/src/inter-agency-referrals/inter-agency-referrals.service.ts`
- `kapwa-server/src/inter-agency-referrals/inter-agency-referrals.controller.ts`
- `kapwa-server/src/inter-agency-referrals/inter-agency-referrals.module.ts`
- `kapwa-server/src/inter-agency-referrals/inter-agency-referrals.service.spec.ts`
- `kapwa-server/src/beneficiaries/beneficiaries.service.spec.ts` (new — PSN dedup)

**Server — modified**
- `kapwa-server/src/auth/user.entity.ts` — add `agencyId`
- `kapwa-server/src/app.module.ts` — register `AgenciesModule`, `InterAgencyReferralsModule`
- `kapwa-server/src/access-cards/access-card-service.entity.ts` — add `agencyId` + `agencyRef` relation
- `kapwa-server/src/access-cards/dto/access-cards.zod.ts` — add `agencyId`, exactly-one refine
- `kapwa-server/src/access-cards/access-cards.service.ts` — resolve agency, add `getAgencySummary`
- `kapwa-server/src/access-cards/access-cards.controller.ts` — add `GET /access-cards/:code/summary`
- `kapwa-server/src/access-cards/access-cards.module.ts` — add `Agency`, `InterAgencyReferral` repos
- `kapwa-server/src/access-cards/access-cards.service.spec.ts` — update constructor mocks + new tests
- `kapwa-server/src/beneficiaries/beneficiaries.service.ts` — PSN exact-match in `createBeneficiary`
- `kapwa-server/src/irf/irf.module.ts` — import `AgenciesModule`
- `kapwa-server/src/irf/irf-export.service.ts` — replace hardcoded `'MSWDO Norzagaray'`
- `kapwa-server/src/irf/irf-export.service.spec.ts` — add `AgenciesService` mock

**Client — new**
- `kapwa-client/src/pages/InterAgencyReferralsPage.tsx`
- `kapwa-client/src/pages/InterAgencyReferralsPage.test.tsx`
- `kapwa-client/src/pages/AccessCardViewPage.test.tsx`

**Client — modified**
- `kapwa-client/src/lib/query-keys.ts` — add `agencies`, `interAgencyReferrals`, `accessCards.agencySummary`
- `kapwa-client/src/lib/auth-context.tsx` — add `agencyId` to `User`
- `kapwa-client/src/routes.tsx` — add `/intake/inter-agency-referrals`
- `kapwa-client/src/lib/nav-config.tsx` — add nav item
- `kapwa-client/src/pages/AccessCardViewPage.tsx` — three sections + agency select

---

### Task 1: Agencies infrastructure (migration + entity + module + user.agencyId)

**Files:**
- Create: `kapwa-server/src/database/migrations/20260803000001-CreateAgenciesTable.ts`
- Modify: `kapwa-server/src/auth/user.entity.ts`
- Create: `kapwa-server/src/agencies/agency.entity.ts`
- Create: `kapwa-server/src/agencies/dto/agencies.zod.ts`
- Create: `kapwa-server/src/agencies/agencies.service.ts`
- Create: `kapwa-server/src/agencies/agencies.controller.ts`
- Create: `kapwa-server/src/agencies/agencies.module.ts`
- Modify: `kapwa-server/src/app.module.ts`
- Create: `kapwa-server/src/agencies/agencies.service.spec.ts`

**Interfaces:**
- Consumes: `BaseEntity` from `src/common/base.entity.ts` (auto uuid-v7 `id`); `ZodPipe` from `src/common/pipes/zod.pipe`; guards from `src/auth/`.
- Produces: `Agency` entity (fields `id`, `code`, `name`, `type?`, `contactInfo?`, `isActive`); `AgenciesService` with `findAll(): Promise<Agency[]>`, `findById(id): Promise<Agency | null>`, `findByCode(code): Promise<Agency | null>`, `create(dto): Promise<Agency>`; `AgenciesModule` exports `AgenciesService`. `User.agencyId?: string`.

- [ ] **Step 1: Write the migration file**

Create `kapwa-server/src/database/migrations/20260803000001-CreateAgenciesTable.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAgenciesTable20260803000001 implements MigrationInterface {
  name = 'CreateAgenciesTable20260803000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS agencies (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        code VARCHAR(10) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(50),
        contact_info JSONB,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      INSERT INTO agencies (code, name, type, is_active) VALUES
        ('MSWDO', 'Municipal Social Welfare and Development Office', 'social_services', true),
        ('RHU', 'Rural Health Unit - Norzagaray', 'health', true),
        ('WCPD', 'Women and Children Protection Desk (PNP)', 'police', true),
        ('PESO', 'Public Employment Service Office', 'labor', true),
        ('DILG', 'Department of the Interior and Local Government', 'government', true),
        ('DSWD', 'Department of Social Welfare and Development', 'social_services', true),
        ('DepEd', 'Department of Education', 'education', true)
      ON CONFLICT (code) DO NOTHING
    `);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES agencies(id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_users_agency ON users(agency_id)`);
    await queryRunner.query(`
      UPDATE users u SET agency_id = a.id
      FROM agencies a
      WHERE a.code = 'MSWDO' AND u.agency_id IS NULL AND u.role IN ('admin', 'social_worker')
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_agency`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS agency_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS agencies`);
  }
}
```

- [ ] **Step 2: Run the migration up + verify + round-trip**

Run from `kapwa-server/`:

```bash
npm run migration:run
```

Expected: `migration:run` prints `Migration CreateAgenciesTable20260803000001 has been executed successfully.`

Verify the seed landed:

```bash
docker compose exec -T postgres psql -U kapwa -d kapwa -c "SELECT code, name FROM agencies ORDER BY code"
```

Expected: 7 rows (DepEd, DILG, DSWD, MSWDO, PESO, RHU, WCPD).

Round-trip (down then up) — revert the last migration (ours), then re-apply:

```bash
npm run migration:revert
npm run migration:run
```

Expected: revert drops `agencies`; re-run recreates it. (Note: if the DB is not running, start it first with `docker compose up -d postgres`.)

- [ ] **Step 3: Add `agencyId` to the User entity**

In `kapwa-server/src/auth/user.entity.ts`, add after the `assignedBarangay` column (line 44):

```ts
  @Column({ name: 'agency_id', nullable: true })
  agencyId?: string;
```

- [ ] **Step 4: Write the Agency entity**

Create `kapwa-server/src/agencies/agency.entity.ts`:

```ts
import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity({ name: 'agencies' })
export class Agency extends BaseEntity {
  @Column({ unique: true })
  code!: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  type?: string;

  @Column({ name: 'contact_info', type: 'jsonb', nullable: true })
  contactInfo?: Record<string, unknown>;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
```

- [ ] **Step 5: Write the agencies Zod DTO**

Create `kapwa-server/src/agencies/dto/agencies.zod.ts`:

```ts
import { z } from 'zod';

export const CreateAgencySchema = z.object({
  code: z.string().trim().min(1).max(10),
  name: z.string().trim().min(1).max(100),
  type: z.string().max(50).optional(),
  contactInfo: z.record(z.string(), z.unknown()).optional(),
});

export type CreateAgencyInput = z.infer<typeof CreateAgencySchema>;
```

- [ ] **Step 6: Write the agencies service**

Create `kapwa-server/src/agencies/agencies.service.ts`:

```ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agency } from './agency.entity';
import { CreateAgencyInput } from './dto/agencies.zod';

@Injectable()
export class AgenciesService {
  constructor(
    @InjectRepository(Agency)
    private repo: Repository<Agency>,
  ) {}

  findAll(): Promise<Agency[]> {
    return this.repo.find({ where: { isActive: true }, order: { code: 'ASC' } });
  }

  findById(id: string): Promise<Agency | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByCode(code: string): Promise<Agency | null> {
    return this.repo.findOne({ where: { code } });
  }

  async create(dto: CreateAgencyInput): Promise<Agency> {
    const code = dto.code.toUpperCase();
    const existing = await this.repo.findOne({ where: { code } });
    if (existing) throw new BadRequestException(`Agency code already exists: ${code}`);
    return this.repo.save(
      this.repo.create({
        code,
        name: dto.name,
        type: dto.type,
        contactInfo: dto.contactInfo,
        isActive: true,
      }),
    );
  }
}
```

- [ ] **Step 7: Write the agencies controller**

Create `kapwa-server/src/agencies/agencies.controller.ts`:

```ts
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AgenciesService } from './agencies.service';
import { CreateAgencySchema } from './dto/agencies.zod';

@ApiTags('Agencies')
@Controller('agencies')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AgenciesController {
  constructor(private readonly svc: AgenciesService) {}

  @Get()
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'List active agencies' })
  async findAll() {
    return this.svc.findAll();
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create an agency' })
  async create(@Body(new ZodPipe(CreateAgencySchema)) dto: any) {
    return this.svc.create(dto);
  }
}
```

- [ ] **Step 8: Write the agencies module**

Create `kapwa-server/src/agencies/agencies.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgenciesService } from './agencies.service';
import { AgenciesController } from './agencies.controller';
import { Agency } from './agency.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Agency]), AuthModule],
  controllers: [AgenciesController],
  providers: [AgenciesService],
  exports: [AgenciesService],
})
export class AgenciesModule {}
```

- [ ] **Step 9: Register the module in app.module**

In `kapwa-server/src/app.module.ts`:
- Add import line after line 29 (`import { AnnouncementsModule } ...`):
  ```ts
  import { AgenciesModule } from './agencies/agencies.module';
  ```
- Add `AgenciesModule,` after `AnnouncementsModule,` in the `imports` array (after line 85).

- [ ] **Step 10: Write the failing agencies service spec**

Create `kapwa-server/src/agencies/agencies.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AgenciesService } from './agencies.service';
import { Agency } from './agency.entity';

describe('AgenciesService', () => {
  let service: AgenciesService;
  let repoMock: any;

  beforeEach(async () => {
    repoMock = { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgenciesService,
        { provide: getRepositoryToken(Agency), useValue: repoMock },
      ],
    }).compile();
    service = module.get<AgenciesService>(AgenciesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('lists only active agencies ordered by code', async () => {
    const agencies = [{ id: 'a1', code: 'RHU', name: 'RHU', isActive: true }];
    repoMock.find.mockResolvedValue(agencies);
    const result = await service.findAll();
    expect(repoMock.find).toHaveBeenCalledWith({ where: { isActive: true }, order: { code: 'ASC' } });
    expect(result).toEqual(agencies);
  });

  it('findByCode queries by exact code', async () => {
    const agency = { id: 'a1', code: 'MSWDO' };
    repoMock.findOne.mockResolvedValue(agency);
    const result = await service.findByCode('MSWDO');
    expect(repoMock.findOne).toHaveBeenCalledWith({ where: { code: 'MSWDO' } });
    expect(result).toEqual(agency);
  });

  it('create rejects a duplicate code', async () => {
    repoMock.findOne.mockResolvedValue({ id: 'a1', code: 'MSWDO' });
    await expect(
      service.create({ code: 'mswdo', name: 'Duplicate', type: 'social_services' }),
    ).rejects.toThrow('Agency code already exists: MSWDO');
  });

  it('create uppercases and persists a new agency', async () => {
    repoMock.findOne.mockResolvedValue(null);
    repoMock.create.mockImplementation((dto: any) => dto);
    repoMock.save.mockImplementation(async (dto: any) => ({ id: 'a2', ...dto }));
    const result = await service.create({ code: 'ngo1', name: 'NGO One', type: 'social_services' });
    expect(result).toEqual(expect.objectContaining({ id: 'a2', code: 'NGO1', name: 'NGO One', isActive: true }));
    expect(repoMock.create).toHaveBeenCalledWith(expect.objectContaining({ code: 'NGO1' }));
  });
});
```

- [ ] **Step 11: Run the spec**

Run from `kapwa-server/`:

```bash
npx jest src/agencies/agencies.service.spec.ts --coverage=false
```

Expected: 5 passing tests.

- [ ] **Step 12: Typecheck**

Run from `kapwa-server/`:

```bash
npx tsc --noEmit
```

Expected: no errors. (If pre-existing errors exist in unrelated files, report them; only new errors introduced here must be fixed.)

- [ ] **Step 13: Commit**

```bash
git add kapwa-server/src/database/migrations/20260803000001-CreateAgenciesTable.ts \
        kapwa-server/src/auth/user.entity.ts \
        kapwa-server/src/agencies \
        kapwa-server/src/app.module.ts
git commit -m "feat: add agencies module, seed data, and user.agency_id"
```

---

### Task 2: Inter-agency referrals module

**Files:**
- Create: `kapwa-server/src/database/migrations/20260803000002-CreateInterAgencyReferralsTable.ts`
- Create: `kapwa-server/src/inter-agency-referrals/inter-agency-referral.entity.ts`
- Create: `kapwa-server/src/inter-agency-referrals/dto/inter-agency-referrals.zod.ts`
- Create: `kapwa-server/src/inter-agency-referrals/inter-agency-referrals.service.ts`
- Create: `kapwa-server/src/inter-agency-referrals/inter-agency-referrals.controller.ts`
- Create: `kapwa-server/src/inter-agency-referrals/inter-agency-referrals.module.ts`
- Modify: `kapwa-server/src/app.module.ts`
- Create: `kapwa-server/src/inter-agency-referrals/inter-agency-referrals.service.spec.ts`

**Interfaces:**
- Consumes: `Agency` entity (Task 1), `AgenciesService` (Task 1 — not needed here, agencies are queried via repo), `User.agencyId` (Task 1), `CasesService` from `src/cases/cases.module.ts` (`create(data: Partial<Case>)` generates control number and returns `Case`).
- Produces: `InterAgencyReferral` entity; `InterAgencyReferralsService` with `create(dto, caller)`, `findInbox(caller)`, `findByPerson(personId, caller)`, `receive(id, caller)`, `action(id, caller)`, `close(id, caller, dto)`, `decline(id, caller, dto)`, `promoteToCase(id, caller)`; `InterAgencyReferralsModule`.

- [ ] **Step 1: Write the migration**

Create `kapwa-server/src/database/migrations/20260803000002-CreateInterAgencyReferralsTable.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInterAgencyReferralsTable20260803000002 implements MigrationInterface {
  name = 'CreateInterAgencyReferralsTable20260803000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS inter_agency_referrals (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        case_id UUID REFERENCES cases(id),
        person_id UUID NOT NULL REFERENCES persons(id),
        from_agency_id UUID NOT NULL REFERENCES agencies(id),
        to_agency_id UUID NOT NULL REFERENCES agencies(id),
        status TEXT NOT NULL DEFAULT 'referred'
          CHECK (status IN ('referred','received','actioned','closed','declined')),
        reason TEXT NOT NULL,
        notes TEXT,
        legal_basis_code TEXT NOT NULL,
        consent_ledger_id UUID REFERENCES consent_ledger(id),
        outcome TEXT,
        received_at TIMESTAMP,
        actioned_at TIMESTAMP,
        closed_at TIMESTAMP,
        declined_reason TEXT,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_iar_person ON inter_agency_referrals(person_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_iar_from_to ON inter_agency_referrals(from_agency_id, to_agency_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_iar_status ON inter_agency_referrals(status)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_iar_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_iar_from_to`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_iar_person`);
    await queryRunner.query(`DROP TABLE IF EXISTS inter_agency_referrals`);
  }
}
```

- [ ] **Step 2: Run the migration**

Run from `kapwa-server/`:

```bash
npm run migration:run
```

Expected: `Migration CreateInterAgencyReferralsTable20260803000002 has been executed successfully.`

- [ ] **Step 3: Write the entity**

Create `kapwa-server/src/inter-agency-referrals/inter-agency-referral.entity.ts`:

```ts
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Agency } from '../agencies/agency.entity';
import { Person } from '../beneficiaries/person.entity';
import { Case } from '../cases/case.entity';
import { User } from '../auth/user.entity';

export type InterAgencyReferralStatus = 'referred' | 'received' | 'actioned' | 'closed' | 'declined';

@Entity({ name: 'inter_agency_referrals' })
export class InterAgencyReferral extends BaseEntity {
  @Column({ name: 'case_id', nullable: true })
  caseId?: string;

  @ManyToOne(() => Case, { nullable: true })
  @JoinColumn({ name: 'case_id' })
  case?: Case;

  @Column({ name: 'person_id' })
  personId!: string;

  @ManyToOne(() => Person, { nullable: true })
  @JoinColumn({ name: 'person_id' })
  person?: Person;

  @Column({ name: 'from_agency_id' })
  fromAgencyId!: string;

  @ManyToOne(() => Agency, { nullable: true })
  @JoinColumn({ name: 'from_agency_id' })
  fromAgency?: Agency;

  @Column({ name: 'to_agency_id' })
  toAgencyId!: string;

  @ManyToOne(() => Agency, { nullable: true })
  @JoinColumn({ name: 'to_agency_id' })
  toAgency?: Agency;

  @Column({ type: 'text', default: 'referred' })
  status!: InterAgencyReferralStatus;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'legal_basis_code', type: 'text' })
  legalBasisCode!: string;

  @Column({ name: 'consent_ledger_id', nullable: true })
  consentLedgerId?: string;

  @Column({ type: 'text', nullable: true })
  outcome?: string;

  @Column({ name: 'received_at', type: 'timestamp', nullable: true })
  receivedAt?: Date;

  @Column({ name: 'actioned_at', type: 'timestamp', nullable: true })
  actionedAt?: Date;

  @Column({ name: 'closed_at', type: 'timestamp', nullable: true })
  closedAt?: Date;

  @Column({ name: 'declined_reason', type: 'text', nullable: true })
  declinedReason?: string;

  @Column({ name: 'created_by', nullable: true })
  createdBy?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
```

- [ ] **Step 4: Write the Zod DTOs**

Create `kapwa-server/src/inter-agency-referrals/dto/inter-agency-referrals.zod.ts`:

```ts
import { z } from 'zod';

export const CreateInterAgencyReferralSchema = z
  .object({
    personId: z.string().uuid().optional(),
    beneficiaryId: z.string().uuid().optional(),
    caseId: z.string().uuid().optional(),
    toAgencyId: z.string().uuid().min(1, 'Target agency is required'),
    reason: z.string().trim().min(1, 'Reason is required'),
    notes: z.string().optional(),
    legalBasisCode: z.string().trim().min(1, 'Legal basis is required'),
    consentLedgerId: z.string().uuid().optional(),
  })
  .refine(dto => dto.personId || dto.beneficiaryId || dto.caseId, {
    message: 'personId, beneficiaryId, or caseId is required',
  });

export type CreateInterAgencyReferralInput = z.infer<typeof CreateInterAgencyReferralSchema>;

export const CloseReferralSchema = z.object({
  outcome: z.string().trim().min(1, 'Outcome is required'),
});
export type CloseReferralInput = z.infer<typeof CloseReferralSchema>;

export const DeclineReferralSchema = z.object({
  declinedReason: z.string().trim().min(1, 'Reason for declining is required'),
});
export type DeclineReferralInput = z.infer<typeof DeclineReferralSchema>;
```

- [ ] **Step 5: Write the service**

Create `kapwa-server/src/inter-agency-referrals/inter-agency-referrals.service.ts`:

```ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/user.entity';
import { Agency } from '../agencies/agency.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { Case } from '../cases/case.entity';
import { CasesService } from '../cases/cases.service';
import {
  InterAgencyReferral,
  InterAgencyReferralStatus,
} from './inter-agency-referral.entity';
import {
  CloseReferralInput,
  CreateInterAgencyReferralInput,
  DeclineReferralInput,
} from './dto/inter-agency-referrals.zod';

const TRANSITIONS: Record<InterAgencyReferralStatus, InterAgencyReferralStatus[]> = {
  referred: ['received', 'declined'],
  received: ['actioned'],
  actioned: ['closed'],
  closed: [],
  declined: [],
};

@Injectable()
export class InterAgencyReferralsService {
  constructor(
    @InjectRepository(InterAgencyReferral)
    private repo: Repository<InterAgencyReferral>,
    @InjectRepository(Agency)
    private agencyRepo: Repository<Agency>,
    @InjectRepository(Beneficiary)
    private benRepo: Repository<Beneficiary>,
    @InjectRepository(Case)
    private caseRepo: Repository<Case>,
    private casesService: CasesService,
  ) {}

  async create(dto: CreateInterAgencyReferralInput, caller: User) {
    if (caller.role !== 'admin' && !caller.agencyId) {
      throw new ForbiddenException('Your account is not linked to an agency');
    }
    const fromAgencyId = caller.agencyId as string;
    const toAgency = await this.agencyRepo.findOne({ where: { id: dto.toAgencyId, isActive: true } });
    if (!toAgency) throw new UnprocessableEntityException('Unknown target agency');
    if (toAgency.id === fromAgencyId) throw new BadRequestException('Cannot refer to your own agency');

    const personId = await this.resolvePersonId(dto);
    const ref = this.repo.create({
      personId,
      caseId: dto.caseId,
      fromAgencyId,
      toAgencyId: toAgency.id,
      reason: dto.reason,
      notes: dto.notes,
      legalBasisCode: dto.legalBasisCode,
      consentLedgerId: dto.consentLedgerId,
      status: 'referred',
      createdBy: caller.id,
    });
    return this.repo.save(ref);
  }

  async findInbox(caller: User) {
    if (caller.role === 'admin') {
      return this.repo.find({
        order: { createdAt: 'DESC' },
        relations: ['fromAgency', 'toAgency', 'person', 'case'],
      });
    }
    if (!caller.agencyId) return [];
    return this.repo.find({
      where: [
        { fromAgencyId: caller.agencyId },
        { toAgencyId: caller.agencyId },
      ],
      order: { createdAt: 'DESC' },
      relations: ['fromAgency', 'toAgency', 'person', 'case'],
    });
  }

  async findByPerson(personId: string, caller: User) {
    const scoped = await this.findInbox(caller);
    return scoped.filter(r => r.personId === personId);
  }

  async receive(id: string, caller: User) {
    const ref = await this.getScoped(id, caller);
    this.assertReceiver(ref, caller);
    this.assertTransition(ref.status, 'received');
    ref.status = 'received';
    ref.receivedAt = new Date();
    return this.repo.save(ref);
  }

  async action(id: string, caller: User) {
    const ref = await this.getScoped(id, caller);
    this.assertReceiver(ref, caller);
    this.assertTransition(ref.status, 'actioned');
    ref.status = 'actioned';
    ref.actionedAt = new Date();
    return this.repo.save(ref);
  }

  async close(id: string, caller: User, dto: CloseReferralInput) {
    const ref = await this.getScoped(id, caller);
    this.assertReceiver(ref, caller);
    this.assertTransition(ref.status, 'closed');
    ref.status = 'closed';
    ref.outcome = dto.outcome;
    ref.closedAt = new Date();
    return this.repo.save(ref);
  }

  async decline(id: string, caller: User, dto: DeclineReferralInput) {
    const ref = await this.getScoped(id, caller);
    this.assertReceiver(ref, caller);
    this.assertTransition(ref.status, 'declined');
    ref.status = 'declined';
    ref.declinedReason = dto.declinedReason;
    return this.repo.save(ref);
  }

  async promoteToCase(id: string, caller: User) {
    const ref = await this.getScoped(id, caller);
    if (ref.caseId) throw new ConflictException('Referral already linked to a case');
    if (ref.status === 'closed' || ref.status === 'declined') {
      throw new ConflictException(`Cannot promote a "${ref.status}" referral to a case`);
    }
    const ben = await this.benRepo.findOne({ where: { personId: ref.personId } });
    if (!ben) throw new ConflictException('No beneficiary found for the referred person');
    const created = await this.casesService.create({
      beneficiaryId: ben.id,
      serviceRequested: [ref.reason],
      assignedWorkerId: caller.id,
    });
    ref.caseId = created.id;
    ref.status = 'actioned';
    ref.actionedAt = new Date();
    await this.repo.save(ref);
    return created;
  }

  private async resolvePersonId(dto: CreateInterAgencyReferralInput): Promise<string> {
    if (dto.beneficiaryId) {
      const ben = await this.benRepo.findOne({ where: { id: dto.beneficiaryId } });
      if (!ben?.personId) throw new UnprocessableEntityException('Beneficiary has no linked person');
      return ben.personId;
    }
    if (dto.caseId) {
      const c = await this.caseRepo.findOne({ where: { id: dto.caseId } });
      if (!c?.beneficiaryId) throw new UnprocessableEntityException('Case has no beneficiary');
      const ben = await this.benRepo.findOne({ where: { id: c.beneficiaryId } });
      if (!ben?.personId) throw new UnprocessableEntityException('Case has no linked person');
      return ben.personId;
    }
    return dto.personId as string;
  }

  private async getScoped(id: string, caller: User): Promise<InterAgencyReferral> {
    const ref = await this.repo.findOne({ where: { id } });
    if (!ref) throw new NotFoundException('Referral not found');
    if (
      caller.role !== 'admin' &&
      caller.agencyId !== ref.fromAgencyId &&
      caller.agencyId !== ref.toAgencyId
    ) {
      throw new ForbiddenException('Referral is not associated with your agency');
    }
    return ref;
  }

  private assertReceiver(ref: InterAgencyReferral, caller: User) {
    if (caller.role !== 'admin' && caller.agencyId !== ref.toAgencyId) {
      throw new ForbiddenException('Only the receiving agency can update this referral');
    }
  }

  private assertTransition(current: InterAgencyReferralStatus, next: InterAgencyReferralStatus) {
    const allowed = TRANSITIONS[current];
    if (!allowed || !allowed.includes(next)) {
      throw new ConflictException(
        `Cannot transition from "${current}" to "${next}". Allowed: ${allowed?.join(', ') || 'none'}`,
      );
    }
  }
}
```

- [ ] **Step 6: Write the controller**

Create `kapwa-server/src/inter-agency-referrals/inter-agency-referrals.controller.ts`:

```ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { InterAgencyReferralsService } from './inter-agency-referrals.service';
import {
  CloseReferralSchema,
  CreateInterAgencyReferralSchema,
  DeclineReferralSchema,
} from './dto/inter-agency-referrals.zod';
import { AuthenticatedRequest } from '../auth/types';

@ApiTags('Inter-Agency Referrals')
@Controller('inter-agency-referrals')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class InterAgencyReferralsController {
  constructor(private readonly svc: InterAgencyReferralsService) {}

  @Get('inbox')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'List referrals for the caller agency' })
  async inbox(@Request() req: AuthenticatedRequest) {
    return this.svc.findInbox(req.user);
  }

  @Get('person/:personId')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'List referrals for a person' })
  async byPerson(
    @Param('personId', new ParseUUIDPipe()) personId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.svc.findByPerson(personId, req.user);
  }

  @Post()
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Create an inter-agency referral' })
  async create(
    @Body(new ZodPipe(CreateInterAgencyReferralSchema)) dto: any,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.svc.create(dto, req.user);
  }

  @Patch(':id/receive')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Mark referral as received' })
  async receive(@Param('id', new ParseUUIDPipe()) id: string, @Request() req: AuthenticatedRequest) {
    return this.svc.receive(id, req.user);
  }

  @Patch(':id/action')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Mark referral as actioned' })
  async action(@Param('id', new ParseUUIDPipe()) id: string, @Request() req: AuthenticatedRequest) {
    return this.svc.action(id, req.user);
  }

  @Patch(':id/close')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Close referral with outcome' })
  async close(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(CloseReferralSchema)) dto: any,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.svc.close(id, req.user, dto);
  }

  @Patch(':id/decline')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Decline a referred referral' })
  async decline(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(DeclineReferralSchema)) dto: any,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.svc.decline(id, req.user, dto);
  }

  @Post(':id/promote-to-case')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Promote a referral into a case' })
  async promoteToCase(@Param('id', new ParseUUIDPipe()) id: string, @Request() req: AuthenticatedRequest) {
    return this.svc.promoteToCase(id, req.user);
  }
}
```

- [ ] **Step 7: Write the module**

Create `kapwa-server/src/inter-agency-referrals/inter-agency-referrals.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InterAgencyReferralsController } from './inter-agency-referrals.controller';
import { InterAgencyReferralsService } from './inter-agency-referrals.service';
import { InterAgencyReferral } from './inter-agency-referral.entity';
import { Agency } from '../agencies/agency.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { Case } from '../cases/case.entity';
import { CasesModule } from '../cases/cases.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([InterAgencyReferral, Agency, Beneficiary, Case]),
    CasesModule,
    AuthModule,
  ],
  controllers: [InterAgencyReferralsController],
  providers: [InterAgencyReferralsService],
  exports: [InterAgencyReferralsService],
})
export class InterAgencyReferralsModule {}
```

- [ ] **Step 8: Register the module in app.module**

In `kapwa-server/src/app.module.ts`:
- Add import line after the `AgenciesModule` import:
  ```ts
  import { InterAgencyReferralsModule } from './inter-agency-referrals/inter-agency-referrals.module';
  ```
- Add `InterAgencyReferralsModule,` after `AgenciesModule,` in the `imports` array.

- [ ] **Step 9: Write the failing service spec**

Create `kapwa-server/src/inter-agency-referrals/inter-agency-referrals.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InterAgencyReferralsService } from './inter-agency-referrals.service';
import { InterAgencyReferral } from './inter-agency-referral.entity';
import { Agency } from '../agencies/agency.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { Case } from '../cases/case.entity';
import { CasesService } from '../cases/cases.service';

function agencyUser(id: string, agencyId: string) {
  return { id, role: 'social_worker', agencyId } as any;
}

describe('InterAgencyReferralsService', () => {
  let service: InterAgencyReferralsService;
  let repoMock: any;
  let agencyRepoMock: any;
  let benRepoMock: any;
  let caseRepoMock: any;
  let casesServiceMock: any;

  beforeEach(async () => {
    repoMock = { create: jest.fn(), save: jest.fn(), findOne: jest.fn(), find: jest.fn() };
    agencyRepoMock = { findOne: jest.fn() };
    benRepoMock = { findOne: jest.fn() };
    caseRepoMock = { findOne: jest.fn() };
    casesServiceMock = { create: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterAgencyReferralsService,
        { provide: getRepositoryToken(InterAgencyReferral), useValue: repoMock },
        { provide: getRepositoryToken(Agency), useValue: agencyRepoMock },
        { provide: getRepositoryToken(Beneficiary), useValue: benRepoMock },
        { provide: getRepositoryToken(Case), useValue: caseRepoMock },
        { provide: CasesService, useValue: casesServiceMock },
      ],
    }).compile();
    service = module.get<InterAgencyReferralsService>(InterAgencyReferralsService);
  });

  describe('create', () => {
    it('rejects callers with no linked agency', async () => {
      await expect(service.create({ toAgencyId: 'ag-2', reason: 'x', legalBasisCode: 'c' } as any, agencyUser('u1', ''))).rejects.toThrow('Your account is not linked to an agency');
    });

    it('rejects unknown target agency with 422', async () => {
      agencyRepoMock.findOne.mockResolvedValue(null);
      await expect(
        service.create({ personId: 'p1', toAgencyId: 'ag-2', reason: 'x', legalBasisCode: 'c' } as any, agencyUser('u1', 'ag-1')),
      ).rejects.toThrow('Unknown target agency');
    });

    it('creates a referred referral from the caller agency', async () => {
      agencyRepoMock.findOne.mockResolvedValue({ id: 'ag-2', name: 'RHU' });
      benRepoMock.findOne.mockResolvedValue({ id: 'b1', personId: 'p1' });
      repoMock.create.mockImplementation((dto: any) => dto);
      repoMock.save.mockImplementation(async (dto: any) => ({ id: 'r1', ...dto }));

      const result = await service.create(
        { beneficiaryId: 'b1', toAgencyId: 'ag-2', reason: 'Medical follow-up', legalBasisCode: 'public_authority_sec13' } as any,
        agencyUser('u1', 'ag-1'),
      );
      expect(result).toEqual(expect.objectContaining({
        id: 'r1',
        personId: 'p1',
        fromAgencyId: 'ag-1',
        toAgencyId: 'ag-2',
        status: 'referred',
        createdBy: 'u1',
      }));
    });
  });

  describe('transitions', () => {
    const baseRef = { id: 'r1', fromAgencyId: 'ag-1', toAgencyId: 'ag-2', status: 'referred', personId: 'p1' };

    it('receive by receiving agency works', async () => {
      repoMock.findOne.mockResolvedValue({ ...baseRef });
      repoMock.save.mockImplementation(async (dto: any) => dto);
      const result = await service.receive('r1', agencyUser('u2', 'ag-2'));
      expect(result.status).toBe('received');
      expect(result.receivedAt).toBeInstanceOf(Date);
    });

    it('rejects a non-participating agency', async () => {
      repoMock.findOne.mockResolvedValue({ ...baseRef });
      await expect(service.receive('r1', agencyUser('u9', 'ag-9'))).rejects.toThrow('Referral is not associated with your agency');
    });

    it('rejects sending agency from performing a transition', async () => {
      repoMock.findOne.mockResolvedValue({ ...baseRef });
      await expect(service.receive('r1', agencyUser('u1', 'ag-1'))).rejects.toThrow('Only the receiving agency can update this referral');
    });

    it('rejects illegal closed->referred transition', async () => {
      repoMock.findOne.mockResolvedValue({ ...baseRef, status: 'closed' });
      await expect(service.receive('r1', agencyUser('u2', 'ag-2'))).rejects.toThrow('Cannot transition from "closed" to "received"');
    });

    it('rejects action before receive', async () => {
      repoMock.findOne.mockResolvedValue({ ...baseRef, status: 'referred' });
      await expect(service.action('r1', agencyUser('u2', 'ag-2'))).rejects.toThrow('Cannot transition from "referred" to "actioned"');
    });

    it('allows decline only from referred', async () => {
      repoMock.findOne.mockResolvedValue({ ...baseRef, status: 'received' });
      await expect(service.decline('r1', agencyUser('u2', 'ag-2'), { declinedReason: 'no' })).rejects.toThrow('Cannot transition from "received" to "declined"');
    });

    it('decline from referred works', async () => {
      repoMock.findOne.mockResolvedValue({ ...baseRef });
      repoMock.save.mockImplementation(async (dto: any) => dto);
      const result = await service.decline('r1', agencyUser('u2', 'ag-2'), { declinedReason: 'Out of scope' });
      expect(result.status).toBe('declined');
      expect(result.declinedReason).toBe('Out of scope');
    });

    it('close requires an outcome and only from actioned', async () => {
      repoMock.findOne.mockResolvedValue({ ...baseRef, status: 'received' });
      await expect(service.close('r1', agencyUser('u2', 'ag-2'), { outcome: 'Done' })).rejects.toThrow('Cannot transition from "received" to "closed"');
    });
  });

  describe('inbox scoping', () => {
    it('admin sees all', async () => {
      repoMock.find.mockResolvedValue([]);
      await service.findInbox({ id: 'u-admin', role: 'admin' } as any);
      expect(repoMock.find).toHaveBeenCalledWith(expect.objectContaining({ order: { createdAt: 'DESC' } }));
    });

    it('agency caller sees from and to rows only', async () => {
      repoMock.find.mockResolvedValue([]);
      await service.findInbox(agencyUser('u1', 'ag-1'));
      expect(repoMock.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: [{ fromAgencyId: 'ag-1' }, { toAgencyId: 'ag-1' }] }),
      );
    });

    it('caller with no agency sees nothing', async () => {
      const result = await service.findInbox(agencyUser('u1', ''));
      expect(result).toEqual([]);
    });
  });

  describe('promoteToCase', () => {
    it('creates a case and links the referral', async () => {
      repoMock.findOne.mockResolvedValue({ id: 'r1', personId: 'p1', status: 'received', caseId: null, fromAgencyId: 'ag-1', toAgencyId: 'ag-2' });
      benRepoMock.findOne.mockResolvedValue({ id: 'b1' });
      casesServiceMock.create.mockResolvedValue({ id: 'case-1', controlNo: 'KAPWA-2026-0001' });
      repoMock.save.mockImplementation(async (dto: any) => dto);

      const result = await service.promoteToCase('r1', agencyUser('u2', 'ag-2'));
      expect(result.id).toBe('case-1');
      expect(casesServiceMock.create).toHaveBeenCalledWith({
        beneficiaryId: 'b1',
        serviceRequested: expect.any(Array),
        assignedWorkerId: 'u2',
      });
    });

    it('rejects promote when already linked to a case', async () => {
      repoMock.findOne.mockResolvedValue({ id: 'r1', personId: 'p1', status: 'received', caseId: 'case-9' });
      await expect(service.promoteToCase('r1', agencyUser('u2', 'ag-2'))).rejects.toThrow('already linked to a case');
    });
  });
});
```

- [ ] **Step 10: Run the spec**

Run from `kapwa-server/`:

```bash
npx jest src/inter-agency-referrals/inter-agency-referrals.service.spec.ts --coverage=false
```

Expected: all tests pass.

- [ ] **Step 11: Typecheck**

Run from `kapwa-server/`:

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 12: Commit**

```bash
git add kapwa-server/src/database/migrations/20260803000002-CreateInterAgencyReferralsTable.ts \
        kapwa-server/src/inter-agency-referrals \
        kapwa-server/src/app.module.ts
git commit -m "feat: add inter-agency referrals module with status guard"
```

---

### Task 3: Access card agency normalization + summary endpoint

**Files:**
- Create: `kapwa-server/src/database/migrations/20260803000003-AddAgencyIdToAccessCardServices.ts`
- Modify: `kapwa-server/src/access-cards/access-card-service.entity.ts`
- Modify: `kapwa-server/src/access-cards/dto/access-cards.zod.ts`
- Modify: `kapwa-server/src/access-cards/access-cards.service.ts`
- Modify: `kapwa-server/src/access-cards/access-cards.controller.ts`
- Modify: `kapwa-server/src/access-cards/access-cards.module.ts`
- Modify: `kapwa-server/src/access-cards/access-cards.service.spec.ts`

**Interfaces:**
- Consumes: `Agency` entity (Task 1), `ConsentLedger` entity, `InterAgencyReferral` entity (Task 2), `User.agencyId` (Task 1).
- Produces: `AccessCardsService.getAgencySummary(cardCode: string, caller: User)` returning `{ cardCode, person: { id, firstName, surname }, servicesRendered, servicesFromOtherAgencies, referralHistory, sharingConsentActive }`; controller route `GET /access-cards/:code/summary`.

- [ ] **Step 1: Write the migration**

Create `kapwa-server/src/database/migrations/20260803000003-AddAgencyIdToAccessCardServices.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAgencyIdToAccessCardServices20260803000003 implements MigrationInterface {
  name = 'AddAgencyIdToAccessCardServices20260803000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE access_card_services ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES agencies(id)`);
    await queryRunner.query(`
      UPDATE access_card_services s
      SET agency_id = a.id
      FROM agencies a
      WHERE s.agency_id IS NULL
        AND s.agency IS NOT NULL
        AND (UPPER(s.agency) = UPPER(a.code) OR UPPER(s.agency) = UPPER(a.name))
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_acs_agency ON access_card_services(agency_id)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_acs_agency`);
    await queryRunner.query(`ALTER TABLE access_card_services DROP COLUMN IF EXISTS agency_id`);
  }
}
```

- [ ] **Step 2: Run the migration**

Run from `kapwa-server/`:

```bash
npm run migration:run
```

Expected: `Migration AddAgencyIdToAccessCardServices20260803000003 has been executed successfully.`

- [ ] **Step 3: Add `agencyId` + relation to the entity**

In `kapwa-server/src/access-cards/access-card-service.entity.ts`, change the imports to:

```ts
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Agency } from '../agencies/agency.entity';
```

Then add, after the existing `agency` text column (after line 20):

```ts
  @Column({ name: 'agency_id', nullable: true })
  agencyId?: string;

  @ManyToOne(() => Agency, { nullable: true })
  @JoinColumn({ name: 'agency_id' })
  agencyRef?: Agency;
```

- [ ] **Step 4: Update the log-service DTO**

Replace the whole `LogServiceSchema` in `kapwa-server/src/access-cards/dto/access-cards.zod.ts` with:

```ts
export const LogServiceSchema = z
  .object({
    accessCardCode: z.string().min(1),
    serviceRendered: z.string().min(1),
    serviceDate: z.string().min(1),
    cost: z.number().nonnegative().optional(),
    agencyId: z.string().uuid().optional(),
    agency: z.string().optional(),
    workerNameSign: z.string().optional(),
    category: z.enum(['case_service', 'referral', 'community_service', 'seminar']).optional().default('referral'),
  })
  .refine(dto => Boolean(dto.agencyId) || Boolean(dto.agency && dto.agency.trim()), {
    message: 'Agency is required: provide agencyId or an agency code',
  });
```

- [ ] **Step 5: Update the service (constructor + logService + getAgencySummary)**

In `kapwa-server/src/access-cards/access-cards.service.ts`:

Replace the imports with:

```ts
import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessCardService } from './access-card-service.entity';
import { Agency } from '../agencies/agency.entity';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity';
import { InterAgencyReferral } from '../inter-agency-referrals/inter-agency-referral.entity';
import { User } from '../auth/user.entity';
```

Replace the constructor and `logService` (lines 9–89) with:

```ts
  constructor(
    @InjectRepository(AccessCardService)
    private repo: Repository<AccessCardService>,
    @InjectRepository(Agency)
    private agencyRepo: Repository<Agency>,
    @InjectRepository(ConsentLedger)
    private consentRepo: Repository<ConsentLedger>,
    @InjectRepository(InterAgencyReferral)
    private referralRepo: Repository<InterAgencyReferral>,
  ) {}
```

```ts
  async logService(data: { accessCardCode: string; serviceRendered: string; serviceDate: Date; cost?: number; agency?: string; agencyId?: string; workerNameSign?: string; category?: string; loggedBy?: string; sourceBarangay?: string }) {
    let agencyId = data.agencyId;
    if (!agencyId && data.agency && data.agency.trim()) {
      agencyId = await this.resolveAgencyId(data.agency);
    }
    const entry = this.repo.create({
      accessCardCode: data.accessCardCode,
      serviceRendered: data.serviceRendered,
      serviceDate: data.serviceDate,
      cost: data.cost,
      agency: data.agency,
      agencyId,
      workerNameSign: data.workerNameSign,
      category: data.category || 'referral',
      loggedBy: data.loggedBy,
      sourceBarangay: data.sourceBarangay,
    });
    return this.repo.save(entry);
  }

  private async resolveAgencyId(agencyText: string): Promise<string> {
    const trimmed = agencyText.trim();
    const agency = await this.agencyRepo.findOne({
      where: [{ code: trimmed.toUpperCase() }, { name: trimmed }],
    });
    if (!agency) throw new UnprocessableEntityException(`Unknown agency: ${agencyText}`);
    return agency.id;
  }

  async getAgencySummary(cardCode: string, caller: User) {
    const rows = await this.repo.query(
      `SELECT b.id AS beneficiary_id, b.person_id, p.surname, p.first_name
       FROM households h
       JOIN beneficiaries b ON b.household_id = h.id
       JOIN persons p ON p.id = b.person_id
       WHERE h.access_card_code = $1
       LIMIT 1`,
      [cardCode],
    );
    if (!rows?.[0]) throw new NotFoundException('No access card found for this code');
    const ben = rows[0];

    const consent = await this.consentRepo.findOne({
      where: { beneficiaryId: ben.beneficiary_id, purpose: 'inter_agency_sharing', status: 'active' },
    });
    const sharingConsentActive = !!consent;
    const isAdmin = caller.role === 'admin';
    const callerAgency = caller.agencyId;

    const services = await this.repo.find({
      where: { accessCardCode: cardCode },
      order: { serviceDate: 'DESC' },
      relations: ['agencyRef'],
    });

    const servicesRendered = services.filter(s =>
      isAdmin || !callerAgency || s.agencyId === callerAgency || !s.agencyId,
    );

    const servicesFromOtherAgencies =
      sharingConsentActive || isAdmin
        ? services.filter(s => callerAgency && s.agencyId && s.agencyId !== callerAgency)
        : [];

    let referralHistory: InterAgencyReferral[];
    if (isAdmin || caller.role === 'claimant') {
      referralHistory = await this.referralRepo.find({
        where: { personId: ben.person_id },
        order: { createdAt: 'DESC' },
        relations: ['fromAgency', 'toAgency', 'case'],
      });
    } else if (callerAgency) {
      referralHistory = await this.referralRepo.find({
        where: [
          { personId: ben.person_id, fromAgencyId: callerAgency },
          { personId: ben.person_id, toAgencyId: callerAgency },
        ],
        order: { createdAt: 'DESC' },
        relations: ['fromAgency', 'toAgency', 'case'],
      });
    } else {
      referralHistory = [];
    }

    return {
      cardCode,
      person: { id: ben.person_id, firstName: ben.first_name, surname: ben.surname },
      servicesRendered,
      servicesFromOtherAgencies,
      referralHistory,
      sharingConsentActive,
    };
  }
```

- [ ] **Step 6: Update the controller**

In `kapwa-server/src/access-cards/access-cards.controller.ts`, add the summary route before the existing `@Get(':cardCode')` route (before line 56). The `AuthenticatedRequest` import is already present (line 10).

```ts
  @Get(':code/summary')
  @Roles('admin', 'social_worker', 'claimant', 'coordinator')
  @ApiOperation({ summary: 'Get agency view of a card: rendered, other-agency, referrals' })
  async agencySummary(@Param('code') code: string, @Request() req: AuthenticatedRequest) {
    return this.svc.getAgencySummary(code, req.user);
  }
```

- [ ] **Step 7: Update the module**

In `kapwa-server/src/access-cards/access-cards.module.ts`, change the `forFeature` list and add imports:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessCardsService } from './access-cards.service';
import { AccessCardsController } from './access-cards.controller';
import { AccessCardService } from './access-card-service.entity';
import { AuthModule } from '../auth/auth.module';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity';
import { Agency } from '../agencies/agency.entity';
import { InterAgencyReferral } from '../inter-agency-referrals/inter-agency-referral.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AccessCardService, ConsentLedger, Agency, InterAgencyReferral]),
    AuthModule,
  ],
  controllers: [AccessCardsController],
  providers: [AccessCardsService],
  exports: [AccessCardsService],
})
export class AccessCardsModule {}
```

- [ ] **Step 8: Update the service spec (constructor mocks + new tests)**

In `kapwa-server/src/access-cards/access-cards.service.spec.ts`:

Add imports:

```ts
import { Agency } from '../agencies/agency.entity';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity';
import { InterAgencyReferral } from '../inter-agency-referrals/inter-agency-referral.entity';
```

Replace the `beforeEach` module compilation (lines 33–40) with:

```ts
    agencyRepoMock = { findOne: jest.fn() };
    consentRepoMock = { findOne: jest.fn() };
    referralRepoMock = { find: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessCardsService,
        { provide: getRepositoryToken(AccessCardService), useValue: repoMock },
        { provide: getRepositoryToken(Agency), useValue: agencyRepoMock },
        { provide: getRepositoryToken(ConsentLedger), useValue: consentRepoMock },
        { provide: getRepositoryToken(InterAgencyReferral), useValue: referralRepoMock },
      ],
    }).compile();
    service = module.get<AccessCardsService>(AccessCardsService);
```

Add the mocks declaration before `beforeEach`:

```ts
  let agencyRepoMock: any;
  let consentRepoMock: any;
  let referralRepoMock: any;
```

Then append these new test blocks before the closing `});` of the outer `describe`:

```ts
  describe('logService agency resolution', () => {
    it('stores agencyId directly when provided', async () => {
      repoMock.create.mockImplementation((dto: any) => dto);
      repoMock.save.mockImplementation(async (dto: any) => ({ id: 's1', ...dto }));
      const result = await service.logService({
        accessCardCode: 'NORZ-AC-2026-0042',
        serviceRendered: 'Medical Aid',
        serviceDate: new Date(),
        agencyId: 'ag-1',
      });
      expect(result).toEqual(expect.objectContaining({ id: 's1', agencyId: 'ag-1' }));
      expect(agencyRepoMock.findOne).not.toHaveBeenCalled();
    });

    it('resolves a freeform code to agencyId', async () => {
      agencyRepoMock.findOne.mockResolvedValue({ id: 'ag-1', code: 'RHU' });
      repoMock.create.mockImplementation((dto: any) => dto);
      repoMock.save.mockImplementation(async (dto: any) => ({ id: 's1', ...dto }));
      const result = await service.logService({
        accessCardCode: 'NORZ-AC-2026-0042',
        serviceRendered: 'Medical Aid',
        serviceDate: new Date(),
        agency: 'rhu',
      });
      expect(agencyRepoMock.findOne).toHaveBeenCalledWith({ where: [{ code: 'RHU' }, { name: 'rhu' }] });
      expect(result).toEqual(expect.objectContaining({ id: 's1', agencyId: 'ag-1' }));
    });

    it('throws 422 for an unknown freeform code', async () => {
      agencyRepoMock.findOne.mockResolvedValue(null);
      await expect(
        service.logService({
          accessCardCode: 'NORZ-AC-2026-0042',
          serviceRendered: 'Medical Aid',
          serviceDate: new Date(),
          agency: 'bogus',
        }),
      ).rejects.toThrow('Unknown agency: bogus');
    });
  });

  describe('getAgencySummary', () => {
    const admin = { id: 'u1', role: 'admin', agencyId: 'ag-1' } as any;
    const swAg1 = { id: 'u2', role: 'social_worker', agencyId: 'ag-1' } as any;

    it('splits services by caller agency and includes referral history for admin', async () => {
      repoMock.query.mockResolvedValue([{ beneficiary_id: 'b1', person_id: 'p1', first_name: 'Juan', surname: 'Dela Cruz' }]);
      consentRepoMock.findOne.mockResolvedValue({ id: 'c1' });
      repoMock.find.mockResolvedValue([
        { id: 's1', agencyId: 'ag-1' },
        { id: 's2', agencyId: 'ag-2' },
        { id: 's3', agencyId: null },
      ]);
      referralRepoMock.find.mockResolvedValue([{ id: 'r1', fromAgencyId: 'ag-2', toAgencyId: 'ag-1' }]);

      const result = await service.getAgencySummary('NORZ-AC-2026-0042', admin);

      expect(result.sharingConsentActive).toBe(true);
      expect(result.servicesRendered.map((s: any) => s.id)).toEqual(['s1', 's2', 's3']);
      expect(result.servicesFromOtherAgencies.map((s: any) => s.id)).toEqual(['s2']);
      expect(result.referralHistory).toEqual([{ id: 'r1', fromAgencyId: 'ag-2', toAgencyId: 'ag-1' }]);
    });

    it('masks other-agency services when consent is inactive', async () => {
      repoMock.query.mockResolvedValue([{ beneficiary_id: 'b1', person_id: 'p1', first_name: 'Juan', surname: 'Dela Cruz' }]);
      consentRepoMock.findOne.mockResolvedValue(null);
      repoMock.find.mockResolvedValue([
        { id: 's1', agencyId: 'ag-1' },
        { id: 's2', agencyId: 'ag-2' },
      ]);

      const result = await service.getAgencySummary('NORZ-AC-2026-0042', swAg1);

      expect(result.sharingConsentActive).toBe(false);
      expect(result.servicesRendered.map((s: any) => s.id)).toEqual(['s1']);
      expect(result.servicesFromOtherAgencies).toEqual([]);
    });

    it('throws NotFoundException when card code has no beneficiary', async () => {
      repoMock.query.mockResolvedValue([]);
      await expect(service.getAgencySummary('NORZ-AC-0000', admin)).rejects.toThrow('No access card found for this code');
    });
  });
```

- [ ] **Step 9: Run the spec**

Run from `kapwa-server/`:

```bash
npx jest src/access-cards/access-cards.service.spec.ts --coverage=false
```

Expected: all tests pass (existing + new).

- [ ] **Step 10: Typecheck**

Run from `kapwa-server/`:

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 11: Commit**

```bash
git add kapwa-server/src/database/migrations/20260803000003-AddAgencyIdToAccessCardServices.ts \
        kapwa-server/src/access-cards
git commit -m "feat: normalize access card service agency and add card summary endpoint"
```

---

### Task 4: PSN exact-match dedup + IRF export agency lookup

**Files:**
- Modify: `kapwa-server/src/beneficiaries/beneficiaries.service.ts`
- Create: `kapwa-server/src/beneficiaries/beneficiaries.service.spec.ts`
- Modify: `kapwa-server/src/irf/irf.module.ts`
- Modify: `kapwa-server/src/irf/irf-export.service.ts`
- Modify: `kapwa-server/src/irf/irf-export.service.spec.ts`

**Interfaces:**
- Consumes: `Person` repo (already injected in `BeneficiariesService`), `AgenciesService.findByCode` (Task 1), `AgenciesModule` (Task 1).
- Produces: `BeneficiariesService.createBeneficiary` reuses an existing person when `philsysNumber` matches; `IrfExportService.exportPdf`/`exportJson` use the MSWDO agency name from the agencies table.

- [ ] **Step 1: Write the failing PSN dedup spec**

Create `kapwa-server/src/beneficiaries/beneficiaries.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BeneficiariesService } from './beneficiaries.service';
import { Person } from './person.entity';
import { Beneficiary } from './beneficiary.entity';
import { BeneficiaryClaimant } from './beneficiary-claimant.entity';
import { ConsentLedger } from './consent-ledger.entity';
import { HouseholdMembership } from './household-membership.entity';
import { Case } from '../cases/case.entity';

describe('BeneficiariesService', () => {
  let service: BeneficiariesService;
  let personRepoMock: any;
  let benRepoMock: any;
  let consentRepoMock: any;

  beforeEach(async () => {
    personRepoMock = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    benRepoMock = { create: jest.fn(), save: jest.fn(), findOne: jest.fn() };
    consentRepoMock = { save: jest.fn(), findOne: jest.fn(), find: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BeneficiariesService,
        { provide: getRepositoryToken(Person), useValue: personRepoMock },
        { provide: getRepositoryToken(Beneficiary), useValue: benRepoMock },
        { provide: getRepositoryToken(BeneficiaryClaimant), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(ConsentLedger), useValue: consentRepoMock },
        { provide: getRepositoryToken(HouseholdMembership), useValue: { query: jest.fn() } },
        { provide: getRepositoryToken(Case), useValue: { find: jest.fn(), findOne: jest.fn() } },
      ],
    }).compile();
    service = module.get<BeneficiariesService>(BeneficiariesService);
  });

  describe('createBeneficiary', () => {
    const baseData = {
      surname: 'Dela Cruz',
      firstName: 'Juan',
      gender: 'Male',
      dob: new Date('2000-01-01'),
      philsysNumber: '1234-5678-9012',
    };

    it('reuses an existing person when philsysNumber matches (no duplicate)', async () => {
      personRepoMock.findOne.mockResolvedValue({ id: 'person-existing', philsysNumber: '1234-5678-9012' });
      benRepoMock.create.mockImplementation((dto: any) => dto);
      benRepoMock.save.mockImplementation(async (dto: any) => ({ id: 'ben-1', ...dto }));
      consentRepoMock.save.mockResolvedValue({ id: 'c1' });

      const result = await service.createBeneficiary(baseData);

      expect(personRepoMock.findOne).toHaveBeenCalledWith({ where: { philsysNumber: '1234-5678-9012' } });
      expect(personRepoMock.save).not.toHaveBeenCalled();
      expect(result.personId).toBe('person-existing');
    });

    it('creates a new person when philsysNumber is new', async () => {
      personRepoMock.findOne.mockResolvedValue(null);
      personRepoMock.create.mockImplementation((dto: any) => dto);
      personRepoMock.save.mockImplementation(async (dto: any) => ({ id: 'person-new', ...dto }));
      benRepoMock.create.mockImplementation((dto: any) => dto);
      benRepoMock.save.mockImplementation(async (dto: any) => ({ id: 'ben-2', ...dto }));
      consentRepoMock.save.mockResolvedValue({ id: 'c2' });

      const result = await service.createBeneficiary(baseData);

      expect(personRepoMock.findOne).toHaveBeenCalled();
      expect(personRepoMock.save).toHaveBeenCalledTimes(1);
      expect(result.personId).toBe('person-new');
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run from `kapwa-server/`:

```bash
npx jest src/beneficiaries/beneficiaries.service.spec.ts --coverage=false
```

Expected: FAIL — the first test fails because `createBeneficiary` always creates a new person and calls `personRepo.save`.

- [ ] **Step 3: Implement PSN exact-match in createBeneficiary**

In `kapwa-server/src/beneficiaries/beneficiaries.service.ts`, replace the `createBeneficiary` method (lines 29–61) with:

```ts
  async createBeneficiary(data: {
    surname: string; firstName: string; middleName?: string;
    gender: string; dob: Date; address?: string; phone?: string;
    philsysNumber?: string; householdId?: string;
  }) {
    const personData = {
      surname: data.surname,
      firstName: data.firstName,
      middleName: data.middleName,
      gender: data.gender as 'Male' | 'Female',
      dob: data.dob,
      address: data.address,
      phone: data.phone,
      philsysNumber: data.philsysNumber,
    };

    let savedPerson: Person;
    if (data.philsysNumber) {
      const existing = await this.personRepo.findOne({ where: { philsysNumber: data.philsysNumber } });
      if (existing) {
        savedPerson = existing;
      } else {
        savedPerson = await this.personRepo.save(this.personRepo.create(personData));
      }
    } else {
      savedPerson = await this.personRepo.save(this.personRepo.create(personData));
    }

    const ben = this.benRepo.create({
      personId: savedPerson.id,
      householdId: data.householdId,
      consentStatus: 'active',
    });
    await this.benRepo.save(ben);

    await this.consentRepo.save({
      beneficiaryId: ben.id,
      purpose: 'registration',
      channel: 'web',
      status: 'active',
    });

    return ben;
  }
```

- [ ] **Step 4: Run the spec to verify it passes**

Run from `kapwa-server/`:

```bash
npx jest src/beneficiaries/beneficiaries.service.spec.ts --coverage=false
```

Expected: PASS (2 tests).

- [ ] **Step 5: Update IRF module and export service**

In `kapwa-server/src/irf/irf.module.ts`:
- Add import: `import { AgenciesModule } from '../agencies/agencies.module';`
- Add `AgenciesModule` to the `imports` array.

In `kapwa-server/src/irf/irf-export.service.ts`:
- Add import: `import { AgenciesService } from '../agencies/agencies.service';`
- Add to the constructor (after `private irfAuditService: IrfAuditService,`):
  ```ts
  private agenciesService: AgenciesService,
  ```
- Add a private helper before `exportPdf`:
  ```ts
  private async agencyLabel(): Promise<string> {
    const mswdo = await this.agenciesService.findByCode('MSWDO');
    return mswdo?.name || 'MSWDO Norzagaray';
  }
  ```
- In `exportPdf`, add `const agencyName = await this.agencyLabel();` right after the `if (!legalBasis) ...` guard, and replace:
  - `Author: 'MSWDO Norzagaray',` (line 40) → `Author: agencyName,`
  - `doc.fontSize(10).font('Helvetica').text('MSWDO Norzagaray, Bulacan', { align: 'center' });` (line 57) → `doc.fontSize(10).font('Helvetica').text(\`${agencyName}, Bulacan\`, { align: 'center' });`
  - `.text('Agency: MSWDO Norzagaray', { align: 'center' });` (line 115) → `.text(\`Agency: ${agencyName}\`, { align: 'center' });`
- In `exportJson`, add `const agencyName = await this.agencyLabel();` after the audit call, and replace `agency: 'MSWDO Norzagaray',` (line 144) → `agency: agencyName,`.

- [ ] **Step 6: Update the IRF export spec**

In `kapwa-server/src/irf/irf-export.service.spec.ts`:
- Add import: `import { AgenciesService } from '../agencies/agencies.service';`
- In `beforeEach`, add `agenciesServiceMock = { findByCode: jest.fn() };` and a provider:
  ```ts
  { provide: AgenciesService, useValue: agenciesServiceMock },
  ```
- Add `let agenciesServiceMock: any;` next to the other mock declarations.
- In the `exportPdf` tests, add a default resolution so the PDF still builds:
  ```ts
  agenciesServiceMock.findByCode.mockResolvedValue({ name: 'Municipal Social Welfare and Development Office' });
  ```

- [ ] **Step 7: Run both server specs + typecheck**

Run from `kapwa-server/`:

```bash
npx jest src/beneficiaries/beneficiaries.service.spec.ts src/irf/irf-export.service.spec.ts --coverage=false
npx tsc --noEmit
```

Expected: all pass; no new typecheck errors.

- [ ] **Step 8: Commit**

```bash
git add kapwa-server/src/beneficiaries/beneficiaries.service.ts \
        kapwa-server/src/beneficiaries/beneficiaries.service.spec.ts \
        kapwa-server/src/irf/irf.module.ts \
        kapwa-server/src/irf/irf-export.service.ts \
        kapwa-server/src/irf/irf-export.service.spec.ts
git commit -m "feat: dedup beneficiaries by philsys number and use agency lookup in IRF exports"
```

---

### Task 5: Client — inter-agency referrals page

**Files:**
- Modify: `kapwa-client/src/lib/query-keys.ts`
- Modify: `kapwa-client/src/lib/auth-context.tsx`
- Modify: `kapwa-client/src/routes.tsx`
- Modify: `kapwa-client/src/lib/nav-config.tsx`
- Create: `kapwa-client/src/pages/InterAgencyReferralsPage.tsx`
- Create: `kapwa-client/src/pages/InterAgencyReferralsPage.test.tsx`

**Interfaces:**
- Consumes: server routes `GET /agencies`, `GET /inter-agency-referrals/inbox`, `POST /inter-agency-referrals`, `PATCH /inter-agency-referrals/:id/{receive|action|close|decline}` (Tasks 1–2); `useDebouncedSearch` from `@/hooks/useDebouncedSearch` (returns `SearchResult { id, fullName, controlNo, barangay }` where `id` is the beneficiary id).
- Produces: route `/intake/inter-agency-referrals`; nav item "Inter-Agency Referrals"; `queryKeys.agencies.list()` → `/agencies`; `queryKeys.interAgencyReferrals.inbox()` → `/inter-agency-referrals/inbox`.

- [ ] **Step 1: Add query keys**

In `kapwa-client/src/lib/query-keys.ts`, add inside `accessCards` (after the `detail` line 77):

```ts
    agencySummary: (code: string) =>
      memo(`accessCards.agencySummary.${code}`, () => ['access-cards', code, 'summary'] as const),
```

Then add two new top-level groups after `accessCards` (after line 78):

```ts
  agencies: {
    all: ['agencies'] as const,
    list: () => memo('agencies.list', () => ['agencies'] as const),
  },
  interAgencyReferrals: {
    all: ['inter-agency-referrals'] as const,
    inbox: () => memo('iar.inbox', () => ['inter-agency-referrals', 'inbox'] as const),
  },
```

- [ ] **Step 2: Expose `agencyId` on the client user**

In `kapwa-client/src/lib/auth-context.tsx`, change line 4 to:

```ts
interface User { id: string; email: string; fullName: string; role: string; phone?: string; agencyId?: string; }
```

- [ ] **Step 3: Write the failing page test**

Create `kapwa-client/src/pages/InterAgencyReferralsPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { InterAgencyReferralsPage } from './InterAgencyReferralsPage';

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
    put: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'social_worker', agencyId: 'ag-1' } }),
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}

describe('InterAgencyReferralsPage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiPatch.mockReset();
    mockApiPost.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('inter-agency-referrals')) {
        return Promise.resolve([
          {
            id: 'r1',
            personId: 'p1',
            fromAgencyId: 'ag-2',
            toAgencyId: 'ag-1',
            status: 'referred',
            reason: 'Medical follow-up needed',
            legalBasisCode: 'public_authority_sec13',
            createdAt: '2026-08-01T00:00:00.000Z',
            fromAgency: { id: 'ag-2', code: 'RHU', name: 'Rural Health Unit - Norzagaray' },
            toAgency: { id: 'ag-1', code: 'MSWDO', name: 'Municipal Social Welfare and Development Office' },
            person: { id: 'p1', firstName: 'Juan', surname: 'Dela Cruz' },
          },
        ]);
      }
      if (k.includes('agencies')) {
        return Promise.resolve([
          { id: 'ag-1', code: 'MSWDO', name: 'Municipal Social Welfare and Development Office' },
          { id: 'ag-2', code: 'RHU', name: 'Rural Health Unit - Norzagaray' },
        ]);
      }
      if (k.includes('beneficiaries')) {
        return Promise.resolve({ data: [{ id: 'ben1', firstName: 'Juan', surname: 'Dela Cruz', address: 'Brgy. Centro, Norzagaray' }], total: 1 });
      }
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders the page heading and a referral card', async () => {
    renderWithSWR(<InterAgencyReferralsPage />);
    expect(await screen.findByRole('heading', { name: 'Inter-Agency Referrals' })).toBeTruthy();
    expect(await screen.findByText('Juan Dela Cruz')).toBeTruthy();
    expect(screen.getByText('Referred')).toBeTruthy();
  });

  it('calls receive transition for the receiving agency', async () => {
    const user = userEvent.setup();
    renderWithSWR(<InterAgencyReferralsPage />);
    const receiveButton = await screen.findByRole('button', { name: 'Receive' });
    await user.click(receiveButton);
    expect(mockApiPatch).toHaveBeenCalledWith('/inter-agency-referrals/r1/receive', undefined);
  });

  it('creates a referral from the form', async () => {
    const user = userEvent.setup();
    renderWithSWR(<InterAgencyReferralsPage />);

    await user.selectOptions(await screen.findByLabelText('To Agency *'), 'ag-2');
    await user.type(await screen.findByPlaceholderText('Search beneficiary by name...'), 'juan');
    await user.click(await screen.findByRole('button', { name: /Juan Dela Cruz/ }));
    await user.type(await screen.findByLabelText('Reason *'), 'Needs medical aid');
    await user.click(screen.getByRole('button', { name: 'Create Referral' }));

    expect(mockApiPost).toHaveBeenCalledWith('/inter-agency-referrals', {
      beneficiaryId: 'ben1',
      toAgencyId: 'ag-2',
      reason: 'Needs medical aid',
      notes: undefined,
      legalBasisCode: 'public_authority_sec13',
    });
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run from `kapwa-client/`:

```bash
npx vitest run src/pages/InterAgencyReferralsPage.test.tsx
```

Expected: FAIL — module not found (`InterAgencyReferralsPage`).

- [ ] **Step 5: Write the page**

Create `kapwa-client/src/pages/InterAgencyReferralsPage.tsx`:

```tsx
import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { useAuth } from '../lib/auth-context';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { PageShell } from '@/components/PageShell';
import { CardGridSkeleton } from '@/components/skeletons/CardGridSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/EmptyState';
import { Send, ArrowLeftRight } from 'lucide-react';

export interface Agency {
  id: string;
  code: string;
  name: string;
  type?: string;
}

export type ReferralStatus = 'referred' | 'received' | 'actioned' | 'closed' | 'declined';

export interface InterAgencyReferral {
  id: string;
  personId: string;
  caseId?: string;
  fromAgencyId: string;
  toAgencyId: string;
  status: ReferralStatus;
  reason: string;
  notes?: string;
  legalBasisCode: string;
  outcome?: string;
  declinedReason?: string;
  fromAgency?: Agency;
  toAgency?: Agency;
  person?: { id: string; surname: string; firstName: string };
  createdAt: string;
}

const STATUS_LABELS: Record<ReferralStatus, string> = {
  referred: 'Referred',
  received: 'Received',
  actioned: 'Actioned',
  closed: 'Closed',
  declined: 'Declined',
};

const LEGAL_BASIS_OPTIONS = ['public_authority_sec13', 'consent_verified', 'emergency_situation'];

function StatusTimeline({ status }: { status: ReferralStatus }) {
  const steps: ReferralStatus[] = ['referred', 'received', 'actioned', 'closed'];
  const activeIndex = status === 'declined' ? -1 : steps.indexOf(status);
  return (
    <div className="flex items-center gap-1" aria-label="status-timeline">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <span
            className={`h-2 w-2 rounded-full ${i <= activeIndex ? 'bg-primary' : 'bg-muted'}`}
          />
          {i < steps.length - 1 && (
            <span className={`h-px w-4 ${i < activeIndex ? 'bg-primary' : 'bg-muted'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function ReferralCard({
  referral,
  myAgencyId,
  onTransition,
}: {
  referral: InterAgencyReferral;
  myAgencyId?: string;
  onTransition: (id: string, action: string, body?: Record<string, string>) => Promise<void>;
}) {
  const [outcome, setOutcome] = useState('');
  const isReceiver = referral.toAgencyId === myAgencyId;
  const canReceive = isReceiver && referral.status === 'referred';
  const canAction = isReceiver && referral.status === 'received';
  const canClose = isReceiver && referral.status === 'actioned';
  const canDecline = isReceiver && referral.status === 'referred';
  const personName = referral.person
    ? `${referral.person.firstName} ${referral.person.surname}`.trim()
    : 'Person';

  return (
    <div className="rounded-lg bg-card p-4 shadow-sm border border-border space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold truncate">{personName}</p>
          <p className="text-xs text-muted-foreground truncate">
            {referral.fromAgency?.name || referral.fromAgencyId} →{' '}
            {referral.toAgency?.name || referral.toAgencyId}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {referral.status !== 'declined' && <StatusTimeline status={referral.status} />}
          <Badge variant={referral.status === 'declined' ? 'destructive' : 'default'}>
            {STATUS_LABELS[referral.status]}
          </Badge>
        </div>
      </div>
      <p className="text-sm">{referral.reason}</p>
      <p className="text-xs text-muted-foreground">
        Basis: {referral.legalBasisCode} · {new Date(referral.createdAt).toLocaleDateString()}
      </p>
      {referral.notes && <p className="text-xs text-muted-foreground">Notes: {referral.notes}</p>}
      {referral.outcome && <p className="text-xs text-muted-foreground">Outcome: {referral.outcome}</p>}
      {referral.declinedReason && (
        <p className="text-xs text-destructive">Declined: {referral.declinedReason}</p>
      )}
      {canReceive && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onTransition(referral.id, 'receive')}>
            Receive
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() =>
              onTransition(referral.id, 'decline', {
                declinedReason: 'Unable to accommodate',
              })
            }
          >
            Decline
          </Button>
        </div>
      )}
      {canAction && (
        <Button size="sm" onClick={() => onTransition(referral.id, 'action')}>
          Mark Actioned
        </Button>
      )}
      {canClose && (
        <div className="flex gap-2 items-end">
          <input
            value={outcome}
            onChange={e => setOutcome(e.target.value)}
            placeholder="Outcome"
            className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          />
          <Button
            size="sm"
            onClick={() => onTransition(referral.id, 'close', { outcome })}
            disabled={!outcome.trim()}
          >
            Close
          </Button>
        </div>
      )}
    </div>
  );
}

function CreateReferralForm({
  agencies,
  onCreated,
}: {
  agencies: Agency[];
  onCreated: () => void;
}) {
  const [toAgencyId, setToAgencyId] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [legalBasisCode, setLegalBasisCode] = useState(LEGAL_BASIS_OPTIONS[0]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<{ beneficiaryId: string; label: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { results, loading } = useDebouncedSearch(query, 300, 8);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !toAgencyId || !reason.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await api.post('/inter-agency-referrals', {
        beneficiaryId: selected.beneficiaryId,
        toAgencyId,
        reason,
        notes: notes || undefined,
        legalBasisCode,
      });
      setSelected(null);
      setQuery('');
      setReason('');
      setNotes('');
      setToAgencyId('');
      onCreated();
    } catch (err: any) {
      setError(err?.message || 'Failed to create referral');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg bg-card p-4 shadow-sm border border-border space-y-3"
    >
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Send size={16} className="text-primary" /> Create Referral
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="iar-to-agency">
            To Agency *
          </label>
          <select
            id="iar-to-agency"
            value={toAgencyId}
            onChange={e => setToAgencyId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            required
          >
            <option value="">Select agency...</option>
            {agencies.map(a => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="iar-legal-basis">
            Legal Basis *
          </label>
          <select
            id="iar-legal-basis"
            value={legalBasisCode}
            onChange={e => setLegalBasisCode(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          >
            {LEGAL_BASIS_OPTIONS.map(o => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium">Beneficiary *</label>
        {selected ? (
          <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span>{selected.label}</span>
            <button type="button" onClick={() => setSelected(null)} className="text-xs text-muted-foreground">
              Clear
            </button>
          </div>
        ) : (
          <>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search beneficiary by name..."
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            />
            {loading && <p className="text-xs text-muted-foreground">Searching...</p>}
            {results.length > 0 && (
              <ul className="rounded-md border divide-y max-h-40 overflow-y-auto">
                {results.map(r => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => {
                        setSelected({ beneficiaryId: r.id, label: r.fullName });
                        setQuery('');
                      }}
                    >
                      {r.fullName} <span className="text-xs text-muted-foreground">{r.barangay}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium" htmlFor="iar-reason">
          Reason *
        </label>
        <textarea
          id="iar-reason"
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          rows={2}
          required
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium" htmlFor="iar-notes">
          Notes
        </label>
        <textarea
          id="iar-notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          rows={2}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button
        type="submit"
        size="sm"
        disabled={submitting || !selected || !toAgencyId || !reason.trim()}
      >
        {submitting ? 'Saving...' : 'Create Referral'}
      </Button>
    </form>
  );
}

export function InterAgencyReferralsPage() {
  const { user } = useAuth();
  const { mutate } = useSWRConfig();
  const [filter, setFilter] = useState<'all' | 'received' | 'sent'>('all');

  const { data: referrals, isLoading } = useSWR<InterAgencyReferral[]>(
    queryKeys.interAgencyReferrals.inbox(),
  );
  const { data: agencies } = useSWR<Agency[]>(queryKeys.agencies.list());

  const myAgencyId = user?.agencyId;

  const visible = (referrals || []).filter(r => {
    if (filter === 'all') return true;
    if (filter === 'received') return r.toAgencyId === myAgencyId;
    return r.fromAgencyId === myAgencyId;
  });

  async function transition(id: string, action: string, body?: Record<string, string>) {
    await api.patch(`/inter-agency-referrals/${id}/${action}`, body);
    await mutate(queryKeys.interAgencyReferrals.inbox());
  }

  if (isLoading) {
    return (
      <PageShell title="Inter-Agency Referrals" description="Track referrals between agencies">
        <CardGridSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Inter-Agency Referrals"
      description="Track referrals between agencies"
      icon={<ArrowLeftRight className="text-primary" />}
    >
      <CreateReferralForm
        agencies={agencies || []}
        onCreated={() => mutate(queryKeys.interAgencyReferrals.inbox())}
      />

      <div className="mt-4 mb-2 flex gap-1">
        {(['all', 'received', 'sent'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {f === 'all' ? 'All' : f === 'received' ? 'Received' : 'Sent'}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState variant="no-data" />
      ) : (
        <div className="space-y-3">
          {visible.map(r => (
            <ReferralCard key={r.id} referral={r} myAgencyId={myAgencyId} onTransition={transition} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run from `kapwa-client/`:

```bash
npx vitest run src/pages/InterAgencyReferralsPage.test.tsx
```

Expected: PASS (3 tests).

- [ ] **Step 7: Add the route**

In `kapwa-client/src/routes.tsx`:
- Add import after line 29 (`import { ReferralsPage } ...`):
  ```tsx
  import { InterAgencyReferralsPage } from './pages/InterAgencyReferralsPage';
  ```
- Add the route after line 113 (`/intake/referrals`):
  ```tsx
  { path: '/intake/inter-agency-referrals', element: <Private roles={['admin','social_worker']}><InterAgencyReferralsPage /></Private> },
  ```

- [ ] **Step 8: Add the nav item**

In `kapwa-client/src/lib/nav-config.tsx`:
- Add `ArrowLeftRight` to the lucide-react import list (line 5).
- Add after the `/referrals` item (line 27):
  ```tsx
  { path: '/intake/inter-agency-referrals', label: 'Inter-Agency Referrals', icon: <ArrowLeftRight size={20} />, roles: ['admin', 'social_worker'] },
  ```

- [ ] **Step 9: Build + run the full client test suite for the page**

Run from `kapwa-client/`:

```bash
npx vitest run src/pages/InterAgencyReferralsPage.test.tsx
npm run build
```

Expected: tests pass; production build succeeds.

- [ ] **Step 10: Commit**

```bash
git add kapwa-client/src/lib/query-keys.ts \
        kapwa-client/src/lib/auth-context.tsx \
        kapwa-client/src/routes.tsx \
        kapwa-client/src/lib/nav-config.tsx \
        kapwa-client/src/pages/InterAgencyReferralsPage.tsx \
        kapwa-client/src/pages/InterAgencyReferralsPage.test.tsx
git commit -m "feat: add inter-agency referrals page with inbox and create form"
```

---

### Task 6: Client — access card three sections

**Files:**
- Modify: `kapwa-client/src/pages/AccessCardViewPage.tsx`
- Create: `kapwa-client/src/pages/AccessCardViewPage.test.tsx`

**Interfaces:**
- Consumes: server route `GET /access-cards/:code/summary` (Task 3); `GET /agencies` (Task 1); `queryKeys.accessCards.agencySummary(code)` and `queryKeys.agencies.list()` (Task 5).
- Produces: access-card page with "Services Rendered", "Services From Other Agencies", and "Referrals History" sections; the add-entry form uses an agency select sending `agencyId`.

- [ ] **Step 1: Write the failing page test**

Create `kapwa-client/src/pages/AccessCardViewPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { AccessCardViewPage } from './AccessCardViewPage';

const { mockApiGet } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
  },
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter initialEntries={['/beneficiary/ben1/access-card']}>
        <Routes>
          <Route path="/beneficiary/:id/access-card" element={ui} />
        </Routes>
      </MemoryRouter>
    </SWRConfig>,
  );
}

describe('AccessCardViewPage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('access-cards') && k.includes('summary')) {
        return Promise.resolve({
          cardCode: 'NORZ-AC-2026-0001',
          person: { id: 'p1', firstName: 'Juan', surname: 'Dela Cruz' },
          servicesRendered: [{ id: 's1', agencyId: 'ag-1', agency: 'MSWDO' }],
          servicesFromOtherAgencies: [
            { id: 's2', agencyId: 'ag-2', agency: 'RHU', serviceRendered: 'Medical Consultation' },
          ],
          referralHistory: [
            {
              id: 'r1',
              fromAgencyId: 'ag-1',
              toAgencyId: 'ag-2',
              status: 'referred',
              reason: 'Medical follow-up',
              createdAt: '2026-08-01T00:00:00.000Z',
              fromAgency: { id: 'ag-1', code: 'MSWDO', name: 'Municipal Social Welfare and Development Office' },
              toAgency: { id: 'ag-2', code: 'RHU', name: 'Rural Health Unit - Norzagaray' },
            },
          ],
          sharingConsentActive: true,
        });
      }
      if (k.includes("'beneficiaries'") && k.includes('ben1')) {
        return Promise.resolve({ firstName: 'Juan', surname: 'Dela Cruz', gender: 'Male', address: 'Norzagaray' });
      }
      if (k.includes('family-graph')) {
        return Promise.resolve({ members: [] });
      }
      if (k.includes('access-cards') && k.includes('beneficiary')) {
        return Promise.resolve({
          beneficiary: { first_name: 'Juan', surname: 'Dela Cruz' },
          code: 'NORZ-AC-2026-0001',
          services: [
            { id: 's1', accessCardCode: 'NORZ-AC-2026-0001', serviceDate: '2026-07-01', serviceRendered: 'Financial Assistance', agency: 'MSWDO', category: 'case_service' },
          ],
        });
      }
      if (k.includes('agencies')) {
        return Promise.resolve([
          { id: 'ag-1', code: 'MSWDO', name: 'Municipal Social Welfare and Development Office' },
          { id: 'ag-2', code: 'RHU', name: 'Rural Health Unit - Norzagaray' },
        ]);
      }
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders the Services Rendered section', async () => {
    renderWithSWR(<AccessCardViewPage />);
    expect(await screen.findByRole('heading', { name: /Access Card/ })).toBeTruthy();
    expect(screen.getByText('Services Rendered')).toBeTruthy();
  });

  it('renders Services From Other Agencies and Referrals History from the summary', async () => {
    renderWithSWR(<AccessCardViewPage />);
    expect(await screen.findByText('Services From Other Agencies')).toBeTruthy();
    expect(screen.getByText('Medical Consultation')).toBeTruthy();
    expect(await screen.findByText('Referrals History')).toBeTruthy();
    expect(screen.getByText('Medical follow-up')).toBeTruthy();
  });

  it('shows an agency select in the add-entry form', async () => {
    renderWithSWR(<AccessCardViewPage />);
    const addEntryButton = await screen.findByRole('button', { name: /Add Entry/ });
    // jsdom does not implement showModal; click is enough to open the form markup below.
    addEntryButton.click();
    expect(await screen.findByLabelText('Agency')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run from `kapwa-client/`:

```bash
npx vitest run src/pages/AccessCardViewPage.test.tsx
```

Expected: FAIL — `Services From Other Agencies` / `Referrals History` not found (and possibly a broken form label).

- [ ] **Step 3: Update the page**

In `kapwa-client/src/pages/AccessCardViewPage.tsx`:

1. Update the imports block (lines 1–11) to:

```tsx
import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { CardGridSkeleton } from '@/components/skeletons/CardGridSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditCard, User, MapPin, Calendar, Phone, Users, Plus, Building2, ArrowLeftRight } from 'lucide-react';
```

2. Update the `AccessCardService` interface (lines 13–22) to add `agencyId` and `agencyRef`:

```tsx
interface AccessCardService {
  id: string;
  accessCardCode: string;
  serviceDate: string;
  serviceRendered: string;
  cost?: number;
  agency?: string;
  agencyId?: string;
  agencyRef?: { id: string; code: string; name: string };
  workerNameSign?: string;
  category?: string;
}
```

3. Add summary/referral/agency types after the `CATEGORY_TAB_LABELS` block (after line 38):

```tsx
interface ReferralSummary {
  id: string;
  fromAgencyId: string;
  toAgencyId: string;
  status: string;
  reason: string;
  outcome?: string;
  fromAgency?: { id: string; code: string; name: string };
  toAgency?: { id: string; code: string; name: string };
  createdAt: string;
}

interface AgencySummary {
  cardCode: string;
  person: { id: string; firstName: string; surname: string };
  servicesRendered: AccessCardService[];
  servicesFromOtherAgencies: AccessCardService[];
  referralHistory: ReferralSummary[];
  sharingConsentActive: boolean;
}

interface Agency {
  id: string;
  code: string;
  name: string;
}

const REFERRAL_STATUS_LABELS: Record<string, string> = {
  referred: 'Referred',
  received: 'Received',
  actioned: 'Actioned',
  closed: 'Closed',
  declined: 'Declined',
};
```

4. Update the `addForm` state (line 59) to use `agencyId` instead of `agency`:

```tsx
  const [addForm, setAddForm] = useState({ serviceRendered: '', serviceDate: '', cost: '', agencyId: '', workerNameSign: '', category: 'referral' });
```

5. Add two SWR fetches after the `cardData` fetch (after line 70):

```tsx
  const { data: summary } = useSWR<AgencySummary>(
    cardData?.code ? queryKeys.accessCards.agencySummary(cardData.code) : null,
  );
  const { data: agencies } = useSWR<Agency[]>(queryKeys.agencies.list());
```

6. Update `handleAddEntry` (lines 76–98) to send `agencyId`:

```tsx
  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!cardData?.code) return;
    setAdding(true);
    try {
      await api.post('/access-cards/log', {
        accessCardCode: cardData.code,
        serviceRendered: addForm.serviceRendered,
        serviceDate: addForm.serviceDate,
        cost: addForm.cost ? parseFloat(addForm.cost) : undefined,
        agencyId: addForm.agencyId || undefined,
        workerNameSign: addForm.workerNameSign || undefined,
        category: addForm.category,
      });
      await cardMutate();
      setShowAddForm(false);
      setAddForm({ serviceRendered: '', serviceDate: '', cost: '', agencyId: '', workerNameSign: '', category: 'referral' });
    } catch (err) {
      console.error('Failed to add entry:', err);
    } finally {
      setAdding(false);
    }
  }
```

7. Rename the "Service Records" heading to "Services Rendered" (line 172):

```tsx
            <h3 className="text-sm font-semibold">Services Rendered</h3>
```

8. Replace the freeform "Agency" input (lines 236–239) with an agency select:

```tsx
              <div className="space-y-1">
                <label className="text-xs font-medium">Agency *</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  value={addForm.agencyId}
                  onChange={e => setAddForm(f => ({ ...f, agencyId: e.target.value }))}
                  required
                >
                  <option value="">Select agency...</option>
                  {(agencies || []).map(a => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                  ))}
                </select>
              </div>
```

9. Update the service row agency display (line 264) to prefer the resolved agency:

```tsx
                      {s.agencyRef?.name || s.agency}
```

10. After the services card's closing `</div>` (after line 276, before the final `</PageShell>`), insert the two new sections:

```tsx
      {summary && summary.servicesFromOtherAgencies.length > 0 && (
        <div className="rounded-lg bg-card p-4 shadow-sm border border-border mt-4">
          <div className="flex items-center gap-2 text-primary mb-3">
            <Building2 size={16} />
            <h3 className="text-xs font-semibold uppercase tracking-wider">Services From Other Agencies</h3>
          </div>
          {!summary.sharingConsentActive && (
            <p className="text-xs text-muted-foreground mb-2">
              Inter-agency sharing consent is not active — shown to MSWDO only.
            </p>
          )}
          <div className="space-y-1">
            {summary.servicesFromOtherAgencies.map(s => (
              <div key={s.id} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{s.serviceRendered}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(s.serviceDate).toLocaleDateString()}
                    {s.agencyRef?.name && ` · ${s.agencyRef.name}`}
                  </p>
                </div>
                {s.cost != null && Number(s.cost) > 0 && (
                  <span className="text-xs font-semibold shrink-0">₱{Number(s.cost).toLocaleString()}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {summary && summary.referralHistory.length > 0 && (
        <div className="rounded-lg bg-card p-4 shadow-sm border border-border mt-4">
          <div className="flex items-center gap-2 text-primary mb-3">
            <ArrowLeftRight size={16} />
            <h3 className="text-xs font-semibold uppercase tracking-wider">Referrals History</h3>
          </div>
          <div className="space-y-1">
            {summary.referralHistory.map(r => (
              <div key={r.id} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
                <Badge variant={r.status === 'declined' ? 'destructive' : 'secondary'} className="text-[10px]">
                  {REFERRAL_STATUS_LABELS[r.status] || r.status}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{r.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {(r.fromAgency?.name || r.fromAgencyId)} → {(r.toAgency?.name || r.toAgencyId)} ·{' '}
                    {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
```

Note: the existing `Calendar` import is unused in the current file; leave it as-is (out of scope) or remove it — if you remove it, also remove it from the import list.

- [ ] **Step 4: Run the test to verify it passes**

Run from `kapwa-client/`:

```bash
npx vitest run src/pages/AccessCardViewPage.test.tsx
```

Expected: PASS (3 tests).

- [ ] **Step 5: Build + run the related tests**

Run from `kapwa-client/`:

```bash
npx vitest run src/pages/AccessCardViewPage.test.tsx src/pages/InterAgencyReferralsPage.test.tsx
npm run build
```

Expected: both test files pass; production build succeeds.

- [ ] **Step 6: Commit**

```bash
git add kapwa-client/src/pages/AccessCardViewPage.tsx \
        kapwa-client/src/pages/AccessCardViewPage.test.tsx
git commit -m "feat: show agency-scoped service and referral history on access card page"
```

---

## Self-Review

**Spec coverage:**
- §3.1 agencies table + seed → Task 1 (migration + entity + module).
- §3.2 inter_agency_referrals + transition guard → Task 2.
- §3.3 access_card_services.agency_id + logService resolution + 422 → Task 3.
- §4 RLS → deliberately NOT implemented; replaced by service-layer scoping (documented in Global Constraints; consistent with the codebase's dormant-RLS reality).
- §5 new modules → Tasks 1–2; modified files → Tasks 3–4.
- §5 GET /access-cards/:code/summary → Task 3.
- §5 PSN exact-match → Task 4.
- §6 frontend route + inbox/create page + access card three sections → Tasks 5–6.
- §7 migrations (3) → Tasks 1, 2, 3.
- §8 error handling (409 transitions, 422 unknown agency, masked consent reads, case-less referral + promote-to-case) → Tasks 2–3 (promote-to-case service in Task 2).
- §9 testing → every task carries specs; migration round-trip verified in Task 1 Step 2.

**Placeholder scan:** no TBD/TODO; every step has concrete code or commands.

**Type consistency:** `Agency` (`id/code/name/type`), `InterAgencyReferralStatus`, `getAgencySummary` return shape, `queryKeys.agencies.list()` → `['agencies']` and `queryKeys.interAgencyReferrals.inbox()` → `['inter-agency-referrals','inbox']` are identical across server and client tasks. `useDebouncedSearch` result `id` = beneficiary id is mapped to `beneficiaryId` in the create payload, matching the server DTO's `beneficiaryId` field (resolved to `person_id` server-side).
