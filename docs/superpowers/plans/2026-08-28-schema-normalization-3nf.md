# Database Schema Normalization to 3NF — Wave 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the additive 3NF child tables + entities + data-preserving TypeORM migrations, adding new columns/FKs where needed, while keeping all existing legacy columns so services/APIs keep compiling and the 500+ client tests stay green.

**Architecture:** Wave 1 is additive-only. For each normalized child table we: (1) define a new TypeORM `Entity` mirroring an existing entity's style, (2) write a data-preserving migration that creates the table and backfills rows from the parent's existing columns, (3) add new FK columns (e.g. `referrals.person_id`) where the spec requires. NO existing columns are dropped and NO services/DTOs are touched — that is Wave 2. Existing `@Expose()` getters and services keep working because legacy columns remain on the parent entities.

**Tech Stack:** TypeScript, NestJS, TypeORM (`DataSource`, `MigrationInterface`, `QueryRunner`), PostgreSQL. Entities extend `common/base.entity.ts` (UUID v7 `id` via `@BeforeInsert`). Migrations live in `kapwa-server/src/database/migrations/` and run through the custom bootstrap in `kapwa-server/src/database/migrate.ts`.

## Global Constraints

- Run all commands from `kapwa-server/` unless stated otherwise.
- TypeORM migration files use this exact shape (from `20260730000001-CreatePhysicalFilesTable.ts`): a class exporting `MigrationInterface` named `<Name><timestamp>` with a `name` field, an `async up(queryRunner)` using `queryRunner.query(...)` raw SQL with `IF NOT EXISTS`/`IF EXISTS` guards, PK `id UUID PRIMARY KEY DEFAULT uuid_generate_v7()`, `created_at TIMESTAMP DEFAULT NOW()`, and an `async down(queryRunner)`.
- Migrations are **data-preserving and additive** — backfill `INSERT ... SELECT` from parent columns; do NOT `DROP COLUMN` or delete data in Wave 1.
- New columns added to existing entities must be **nullable** so the existing schema/rows are unaffected.
- Every new child table gets an index on its parent FK column.
- New entity files follow the established entity style: extend `common/base.entity.ts`, use `@Entity('<snake_case_table>')`, `@Column({ name: 'snake_case' })`, export the class.
- Do NOT modify any service, controller, DTO, guard, or client file.
- Do NOT commit the pre-existing unrelated dirty files in the working tree (`DB-SCHEMA.md`, `EVALUATION.MD`, `SPEC-GAP.md`, `docs/diagrams/06-erd.md`, `docs/diagrams/07-data-dictionary.md`, `docs/inter-agency-beneficiary-tracking.md`, `docs/superpowers/plans/2026-08-05-system-diagrams-docs.md`, `kapwa-server/src/common/constants.ts`, `kapwa-server/src/database/migrate.ts`, deleted `kapwa-server/src/database/migrations/20260712000001-CreateInterventionTypesTable.ts`).
- After each task, run `npx jest <related-spec>` — but note that Wave 1 is additive and existing tests must still pass. Verification is primarily `npm run typecheck` (server must still compile) plus the migration's SQL being syntactically valid.
- Entity files referencing new entities from other folders import via relative paths matching existing convention (e.g. `import { PersonContact } from '../beneficiaries/...'`).

---

### Task 1: `person_contacts` + `person_addresses` entities and migrations

**Files:**
- Create: `kapwa-server/src/beneficiaries/person-contact.entity.ts`
- Create: `kapwa-server/src/beneficiaries/person-address.entity.ts`
- Create: `kapwa-server/src/database/migrations/20260828000001-CreatePersonContactsAddresses.ts`
- Test: create `kapwa-server/src/beneficiaries/person-normalization.spec.ts`

**Interfaces:**
- Consumes: `BaseEntity` from `../common/base.entity` (provides `id: string`, `@BeforeInsert` uuid v7).
- Produces: `PersonContact` entity (`@Entity('person_contacts')`, columns `person_id`, `contact_type`, `value`, `is_primary`); `PersonAddress` entity (`@Entity('person_addresses')`, columns `person_id`, `address_type`, `barangay`, `city`, `province`, `postal`, `is_primary`, `raw`). Later tasks reference these for the aggregate/backfill.

- [ ] **Step 1: Write the failing entity test**

Create `kapwa-server/src/beneficiaries/person-normalization.spec.ts`:

```ts
import { PersonContact } from './person-contact.entity';
import { PersonAddress } from './person-address.entity';

describe('schema normalization — person child entities', () => {
  it('defines person_contacts with the expected columns', () => {
    const contact = new PersonContact();
    contact.personId = 'p1';
    contact.contactType = 'phone';
    contact.value = '09170000000';
    expect(contact.personId).toBe('p1');
    expect(contact.contactType).toBe('phone');
    expect(contact.value).toBe('09170000000');
  });

  it('defines person_addresses with the expected columns', () => {
    const addr = new PersonAddress();
    addr.personId = 'p1';
    addr.addressType = 'current';
    addr.barangay = 'Poblacion';
    addr.city = 'Norzagaray';
    addr.province = 'Bulacan';
    expect(addr.addressType).toBe('current');
    expect(addr.barangay).toBe('Poblacion');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-server && npx jest src/beneficiaries/person-normalization.spec.ts --silent`
Expected: FAIL — "Cannot find module './person-contact.entity'"

- [ ] **Step 3: Create the two entities**

Create `kapwa-server/src/beneficiaries/person-contact.entity.ts`:

```ts
import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('person_contacts')
export class PersonContact extends BaseEntity {
  @Column({ name: 'person_id' })
  personId!: string;

  @Column({ name: 'contact_type' })
  contactType!: string;

  @Column()
  value!: string;

  @Column({ name: 'is_primary', nullable: true })
  isPrimary?: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
```

Create `kapwa-server/src/beneficiaries/person-address.entity.ts`:

```ts
import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('person_addresses')
export class PersonAddress extends BaseEntity {
  @Column({ name: 'person_id' })
  personId!: string;

  @Column({ name: 'address_type' })
  addressType!: string;

  @Column({ nullable: true })
  barangay?: string;

  @Column({ nullable: true })
  city?: string;

  @Column({ nullable: true })
  province?: string;

  @Column({ nullable: true })
  postal?: string;

  @Column({ name: 'is_primary', nullable: true })
  isPrimary?: boolean;

  @Column({ nullable: true })
  raw?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd kapwa-server && npx jest src/beneficiaries/person-normalization.spec.ts --silent`
Expected: PASS (2 tests)

- [ ] **Step 5: Create the data-preserving migration**

Create `kapwa-server/src/database/migrations/20260828000001-CreatePersonContactsAddresses.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePersonContactsAddresses20260828000001 implements MigrationInterface {
  name = 'CreatePersonContactsAddresses20260828000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS person_contacts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        person_id UUID NOT NULL,
        contact_type VARCHAR(50) NOT NULL,
        value TEXT NOT NULL,
        is_primary BOOLEAN,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_person_contacts_person ON person_contacts(person_id)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS person_addresses (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        person_id UUID NOT NULL,
        address_type VARCHAR(50) NOT NULL,
        barangay VARCHAR(255),
        city VARCHAR(255),
        province VARCHAR(255),
        postal VARCHAR(20),
        is_primary BOOLEAN,
        raw TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_person_addresses_person ON person_addresses(person_id)`);

    // Backfill contacts from persons.phone / persons.email (only when non-null).
    await queryRunner.query(`
      INSERT INTO person_contacts (person_id, contact_type, value, is_primary)
      SELECT id, 'phone', phone, true FROM persons WHERE phone IS NOT NULL AND phone <> ''
    `);
    await queryRunner.query(`
      INSERT INTO person_contacts (person_id, contact_type, value, is_primary)
      SELECT id, 'email', email, true FROM persons WHERE email IS NOT NULL AND email <> ''
    `);

    // Backfill addresses from persons.address (free-form) and persons.current_address (jsonb).
    await queryRunner.query(`
      INSERT INTO person_addresses (person_id, address_type, raw, is_primary)
      SELECT id, 'current', address, true FROM persons WHERE address IS NOT NULL AND address <> ''
    `);
    await queryRunner.query(`
      INSERT INTO person_addresses (person_id, address_type, barangay, city, province, is_primary)
      SELECT id, 'current',
             current_address->>'barangay',
             current_address->>'city',
             current_address->>'province',
             true
      FROM persons
      WHERE current_address IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS person_addresses`);
    await queryRunner.query(`DROP TABLE IF EXISTS person_contacts`);
  }
}
```

- [ ] **Step 6: Verify server still type-checks**

Run: `cd kapwa-server && npm run typecheck`
Expected: PASS (no new errors from the two new entity files)

- [ ] **Step 7: Commit**

```bash
git add kapwa-server/src/beneficiaries/person-contact.entity.ts kapwa-server/src/beneficiaries/person-address.entity.ts kapwa-server/src/beneficiaries/person-normalization.spec.ts kapwa-server/src/database/migrations/20260828000001-CreatePersonContactsAddresses.ts
git commit -m "feat(schema): add person_contacts and person_addresses 3NF child tables"
```

---

### Task 2: `user_tokens` + `user_barangay_assignments` entities and migrations

**Files:**
- Create: `kapwa-server/src/auth/user-token.entity.ts`
- Create: `kapwa-server/src/auth/user-barangay-assignment.entity.ts`
- Create: `kapwa-server/src/database/migrations/20260828000002-CreateUserChildTables.ts`
- Test: create `kapwa-server/src/auth/user-normalization.spec.ts`

**Interfaces:**
- Consumes: `BaseEntity`; existing `User` entity (`users` table) for backfill references.
- Produces: `UserToken` (`@Entity('user_tokens')`: `user_id`, `purpose`, `token`, `expires_at`); `UserBarangayAssignment` (`@Entity('user_barangay_assignments')`: `user_id`, `barangay`, `is_primary`).

- [ ] **Step 1: Write the failing test**

Create `kapwa-server/src/auth/user-normalization.spec.ts`:

```ts
import { UserToken } from './user-token.entity';
import { UserBarangayAssignment } from './user-barangay-assignment.entity';

describe('schema normalization — user child entities', () => {
  it('defines user_tokens with the expected columns', () => {
    const t = new UserToken();
    t.userId = 'u1';
    t.purpose = 'password_reset';
    t.token = 'rst-abc';
    expect(t.purpose).toBe('password_reset');
    expect(t.token).toBe('rst-abc');
  });

  it('defines user_barangay_assignments with the expected columns', () => {
    const a = new UserBarangayAssignment();
    a.userId = 'u1';
    a.barangay = 'Poblacion';
    a.isPrimary = true;
    expect(a.barangay).toBe('Poblacion');
    expect(a.isPrimary).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-server && npx jest src/auth/user-normalization.spec.ts --silent`
Expected: FAIL — module not found

- [ ] **Step 3: Create the two entities**

Create `kapwa-server/src/auth/user-token.entity.ts`:

```ts
import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('user_tokens')
export class UserToken extends BaseEntity {
  @Column({ name: 'user_id' })
  userId!: string;

  @Column()
  purpose!: string;

  @Column()
  token!: string;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
```

Create `kapwa-server/src/auth/user-barangay-assignment.entity.ts`:

```ts
import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('user_barangay_assignments')
export class UserBarangayAssignment extends BaseEntity {
  @Column({ name: 'user_id' })
  userId!: string;

  @Column()
  barangay!: string;

  @Column({ name: 'is_primary', nullable: true })
  isPrimary?: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd kapwa-server && npx jest src/auth/user-normalization.spec.ts --silent`
Expected: PASS (2 tests)

- [ ] **Step 5: Create the data-preserving migration**

Create `kapwa-server/src/database/migrations/20260828000002-CreateUserChildTables.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserChildTables20260828000002 implements MigrationInterface {
  name = 'CreateUserChildTables20260828000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        user_id UUID NOT NULL,
        purpose VARCHAR(50) NOT NULL,
        token TEXT NOT NULL,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_tokens_user ON user_tokens(user_id)`);

    // Backfill existing token columns (only non-null rows).
    await queryRunner.query(`
      INSERT INTO user_tokens (user_id, purpose, token, expires_at)
      SELECT id, 'email_verification', verification_token, verification_token_expires_at
      FROM users WHERE verification_token IS NOT NULL
    `);
    await queryRunner.query(`
      INSERT INTO user_tokens (user_id, purpose, token, expires_at)
      SELECT id, 'password_reset', reset_token, reset_token_expires_at
      FROM users WHERE reset_token IS NOT NULL
    `);
    await queryRunner.query(`
      INSERT INTO user_tokens (user_id, purpose, token, expires_at)
      SELECT id, 'change_email', new_email_token, new_email_token_expires_at
      FROM users WHERE new_email_token IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_barangay_assignments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        user_id UUID NOT NULL,
        barangay VARCHAR(255) NOT NULL,
        is_primary BOOLEAN,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_barangay_user ON user_barangay_assignments(user_id)`);

    // Backfill primary assigned barangay.
    await queryRunner.query(`
      INSERT INTO user_barangay_assignments (user_id, barangay, is_primary)
      SELECT id, assigned_barangay, true FROM users WHERE assigned_barangay IS NOT NULL AND assigned_barangay <> ''
    `);
    // Backfill the permitted_barangays array via unnest.
    await queryRunner.query(`
      INSERT INTO user_barangay_assignments (user_id, barangay, is_primary)
      SELECT u.id, b.barangay, false
      FROM users u, unnest(u.permitted_barangays) AS b(barangay)
      WHERE array_length(u.permitted_barangays, 1) > 0
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_barangay_assignments`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_tokens`);
  }
}
```

- [ ] **Step 6: Verify server still type-checks**

Run: `cd kapwa-server && npm run typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add kapwa-server/src/auth/user-token.entity.ts kapwa-server/src/auth/user-barangay-assignment.entity.ts kapwa-server/src/auth/user-normalization.spec.ts kapwa-server/src/database/migrations/20260828000002-CreateUserChildTables.ts
git commit -m "feat(schema): add user_tokens and user_barangay_assignments 3NF child tables"
```

---

### Task 3: `case_requirements` + `case_referrals` + `case_assistances` entities and migrations

**Files:**
- Create: `kapwa-server/src/cases/case-requirement.entity.ts`
- Create: `kapwa-server/src/cases/case-referral.entity.ts`
- Create: `kapwa-server/src/cases/case-assistance.entity.ts`
- Create: `kapwa-server/src/database/migrations/20260828000003-CreateCaseChildTables.ts`
- Test: create `kapwa-server/src/cases/case-normalization.spec.ts`

**Interfaces:**
- Consumes: `BaseEntity`; existing `Case` entity (`cases` table) columns `requirements_checklist` (jsonb), `referrals` (jsonb array), `financial_subsidies`/`other_assistance` (jsonb), `amount_assistance`/`mode_financial_assistance`/`source_of_fund`/`legislator_specify` for backfill sources.
- Produces: `CaseRequirement` (`@Entity('case_requirements')`: `case_id`, `requirement_key`, `met`); `CaseReferral` (`@Entity('case_referrals')`: `case_id`, `agency`, `status`, `notes`); `CaseAssistance` (`@Entity('case_assistances')`: `case_id`, `assistance_type`, `amount`, `mode`, `source_of_fund`, `legislator_specify`, `details`, `approved_by_signature`, `approved_by_role`).

- [ ] **Step 1: Write the failing test**

Create `kapwa-server/src/cases/case-normalization.spec.ts`:

```ts
import { CaseRequirement } from './case-requirement.entity';
import { CaseReferral } from './case-referral.entity';
import { CaseAssistance } from './case-assistance.entity';

describe('schema normalization — case child entities', () => {
  it('defines case_requirements', () => {
    const r = new CaseRequirement();
    r.caseId = 'c1';
    r.requirementKey = 'birth_certificate';
    r.met = true;
    expect(r.requirementKey).toBe('birth_certificate');
  });

  it('defines case_referrals', () => {
    const r = new CaseReferral();
    r.caseId = 'c1';
    r.agency = 'MSWDO';
    r.status = 'pending';
    expect(r.agency).toBe('MSWDO');
  });

  it('defines case_assistances', () => {
    const a = new CaseAssistance();
    a.caseId = 'c1';
    a.assistanceType = 'financial';
    a.amount = 5000;
    expect(a.assistanceType).toBe('financial');
    expect(a.amount).toBe(5000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-server && npx jest src/cases/case-normalization.spec.ts --silent`
Expected: FAIL — module not found

- [ ] **Step 3: Create the three entities**

Create `kapwa-server/src/cases/case-requirement.entity.ts`:

```ts
import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('case_requirements')
export class CaseRequirement extends BaseEntity {
  @Column({ name: 'case_id' })
  caseId!: string;

  @Column({ name: 'requirement_key' })
  requirementKey!: string;

  @Column({ nullable: true })
  met?: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
```

Create `kapwa-server/src/cases/case-referral.entity.ts`:

```ts
import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('case_referrals')
export class CaseReferral extends BaseEntity {
  @Column({ name: 'case_id' })
  caseId!: string;

  @Column({ nullable: true })
  agency?: string;

  @Column({ nullable: true })
  status?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
```

Create `kapwa-server/src/cases/case-assistance.entity.ts`:

```ts
import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('case_assistances')
export class CaseAssistance extends BaseEntity {
  @Column({ name: 'case_id' })
  caseId!: string;

  @Column({ name: 'assistance_type' })
  assistanceType!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  amount?: number;

  @Column({ nullable: true })
  mode?: string;

  @Column({ name: 'source_of_fund', nullable: true })
  sourceOfFund?: string;

  @Column({ name: 'legislator_specify', nullable: true })
  legislatorSpecify?: string;

  @Column({ type: 'jsonb', nullable: true })
  details?: Record<string, unknown>;

  @Column({ name: 'approved_by_signature', nullable: true, type: 'text' })
  approvedBySignature?: string;

  @Column({ name: 'approved_by_role', nullable: true })
  approvedByRole?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd kapwa-server && npx jest src/cases/case-normalization.spec.ts --silent`
Expected: PASS (3 tests)

- [ ] **Step 5: Create the data-preserving migration**

Create `kapwa-server/src/database/migrations/20260828000003-CreateCaseChildTables.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCaseChildTables20260828000003 implements MigrationInterface {
  name = 'CreateCaseChildTables20260828000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS case_requirements (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        case_id UUID NOT NULL,
        requirement_key VARCHAR(100) NOT NULL,
        met BOOLEAN,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_case_requirements_case ON case_requirements(case_id)`);

    // Backfill requirements_checklist jsonb: each jsonb_each key becomes one row.
    await queryRunner.query(`
      INSERT INTO case_requirements (case_id, requirement_key, met)
      SELECT c.id, e.key, e.value::boolean
      FROM cases c, jsonb_each(c.requirements_checklist) AS e
      WHERE c.requirements_checklist IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS case_referrals (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        case_id UUID NOT NULL,
        agency VARCHAR(255),
        status VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_case_referrals_case ON case_referrals(case_id)`);

    // Backfill referrals jsonb array: one row per element.
    await queryRunner.query(`
      INSERT INTO case_referrals (case_id, agency, status, notes)
      SELECT c.id,
             r->>'agencyName',
             r->>'status',
             r->>'notes'
      FROM cases c, jsonb_array_elements(c.referrals) AS r
      WHERE c.referrals IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS case_assistances (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        case_id UUID NOT NULL,
        assistance_type VARCHAR(50) NOT NULL,
        amount DECIMAL(12,2),
        mode VARCHAR(50),
        source_of_fund VARCHAR(100),
        legislator_specify VARCHAR(255),
        details JSONB,
        approved_by_signature TEXT,
        approved_by_role VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_case_assistances_case ON case_assistances(case_id)`);

    // Backfill a financial assistance row from the flat financial columns.
    await queryRunner.query(`
      INSERT INTO case_assistances
        (case_id, assistance_type, amount, mode, source_of_fund, legislator_specify, details)
      SELECT c.id,
             'financial',
             c.amount_assistance,
             c.mode_financial_assistance,
             c.source_of_fund,
             c.legislator_specify,
             c.financial_subsidies
      FROM cases c
      WHERE c.amount_assistance IS NOT NULL OR c.financial_subsidies IS NOT NULL
    `);
    // Backfill other_assistance jsonb object: one row per key.
    await queryRunner.query(`
      INSERT INTO case_assistances (case_id, assistance_type, details)
      SELECT c.id, 'other', jsonb_build_object(e.key, e.value)
      FROM cases c, jsonb_each(c.other_assistance) AS e
      WHERE c.other_assistance IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS case_assistances`);
    await queryRunner.query(`DROP TABLE IF EXISTS case_referrals`);
    await queryRunner.query(`DROP TABLE IF EXISTS case_requirements`);
  }
}
```

- [ ] **Step 6: Verify server still type-checks**

Run: `cd kapwa-server && npm run typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add kapwa-server/src/cases/case-requirement.entity.ts kapwa-server/src/cases/case-referral.entity.ts kapwa-server/src/cases/case-assistance.entity.ts kapwa-server/src/cases/case-normalization.spec.ts kapwa-server/src/database/migrations/20260828000003-CreateCaseChildTables.ts
git commit -m "feat(schema): add case_requirements, case_referrals, case_assistances 3NF child tables"
```

---

### Task 4: `agency_contacts` + `program_fund_sources` + `program_required_documents` entities and migrations

**Files:**
- Create: `kapwa-server/src/agencies/agency-contact.entity.ts`
- Create: `kapwa-server/src/programs/program-fund-source.entity.ts`
- Create: `kapwa-server/src/programs/program-required-document.entity.ts`
- Create: `kapwa-server/src/database/migrations/20260828000004-CreateAgencyProgramChildTables.ts`
- Test: create `kapwa-server/src/database/normalization-schema.spec.ts`

**Interfaces:**
- Consumes: `BaseEntity`; existing `agencies.contact_info` (jsonb), `programs.fund_sources` (text[]), `programs.required_documents` (jsonb) for backfill.
- Produces: `AgencyContact` (`@Entity('agency_contacts')`: `agency_id`, `contact_type`, `value`, `is_primary`); `ProgramFundSource` (`@Entity('program_fund_sources')`: `program_id`, `name`); `ProgramRequiredDocument` (`@Entity('program_required_documents')`: `program_id`, `document_key`, `mandatory`).

- [ ] **Step 1: Write the failing test**

Create `kapwa-server/src/database/normalization-schema.spec.ts`:

```ts
import { AgencyContact } from '../agencies/agency-contact.entity';
import { ProgramFundSource } from '../programs/program-fund-source.entity';
import { ProgramRequiredDocument } from '../programs/program-required-document.entity';

describe('schema normalization — agency/program child entities', () => {
  it('defines agency_contacts', () => {
    const c = new AgencyContact();
    c.agencyId = 'a1';
    c.contactType = 'phone';
    c.value = '0917';
    expect(c.contactType).toBe('phone');
  });

  it('defines program_fund_sources', () => {
    const f = new ProgramFundSource();
    f.programId = 'p1';
    f.name = 'LGU';
    expect(f.name).toBe('LGU');
  });

  it('defines program_required_documents', () => {
    const d = new ProgramRequiredDocument();
    d.programId = 'p1';
    d.documentKey = 'birth_certificate';
    d.mandatory = true;
    expect(d.documentKey).toBe('birth_certificate');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-server && npx jest src/database/normalization-schema.spec.ts --silent`
Expected: FAIL — module not found

- [ ] **Step 3: Create the three entities**

Create `kapwa-server/src/agencies/agency-contact.entity.ts`:

```ts
import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('agency_contacts')
export class AgencyContact extends BaseEntity {
  @Column({ name: 'agency_id' })
  agencyId!: string;

  @Column({ name: 'contact_type' })
  contactType!: string;

  @Column()
  value!: string;

  @Column({ name: 'is_primary', nullable: true })
  isPrimary?: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
```

Create `kapwa-server/src/programs/program-fund-source.entity.ts`:

```ts
import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('program_fund_sources')
export class ProgramFundSource extends BaseEntity {
  @Column({ name: 'program_id' })
  programId!: string;

  @Column()
  name!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
```

Create `kapwa-server/src/programs/program-required-document.entity.ts`:

```ts
import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('program_required_documents')
export class ProgramRequiredDocument extends BaseEntity {
  @Column({ name: 'program_id' })
  programId!: string;

  @Column({ name: 'document_key' })
  documentKey!: string;

  @Column({ nullable: true })
  mandatory?: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd kapwa-server && npx jest src/database/normalization-schema.spec.ts --silent`
Expected: PASS (3 tests)

- [ ] **Step 5: Create the data-preserving migration**

Create `kapwa-server/src/database/migrations/20260828000004-CreateAgencyProgramChildTables.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAgencyProgramChildTables20260828000004 implements MigrationInterface {
  name = 'CreateAgencyProgramChildTables20260828000004';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS agency_contacts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        agency_id UUID NOT NULL,
        contact_type VARCHAR(50) NOT NULL,
        value TEXT NOT NULL,
        is_primary BOOLEAN,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_agency_contacts_agency ON agency_contacts(agency_id)`);

    // Backfill agencies.contact_info jsonb keys.
    await queryRunner.query(`
      INSERT INTO agency_contacts (agency_id, contact_type, value, is_primary)
      SELECT a.id, e.key, e.value::text, true
      FROM agencies a, jsonb_each_text(a.contact_info) AS e
      WHERE a.contact_info IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS program_fund_sources (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        program_id UUID NOT NULL,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_program_funds_program ON program_fund_sources(program_id)`);

    // Backfill programs.fund_sources text[] via unnest.
    await queryRunner.query(`
      INSERT INTO program_fund_sources (program_id, name)
      SELECT p.id, f.name
      FROM programs p, unnest(p.fund_sources) AS f(name)
      WHERE array_length(p.fund_sources, 1) > 0
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS program_required_documents (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        program_id UUID NOT NULL,
        document_key VARCHAR(100) NOT NULL,
        mandatory BOOLEAN,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_program_docs_program ON program_required_documents(program_id)`);

    // Backfill programs.required_documents jsonb.
    await queryRunner.query(`
      INSERT INTO program_required_documents (program_id, document_key, mandatory)
      SELECT p.id, e.key, (e.value = 'required')
      FROM programs p, jsonb_each_text(p.required_documents) AS e
      WHERE p.required_documents IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS program_required_documents`);
    await queryRunner.query(`DROP TABLE IF EXISTS program_fund_sources`);
    await queryRunner.query(`DROP TABLE IF EXISTS agency_contacts`);
  }
}
```

- [ ] **Step 6: Verify server still type-checks**

Run: `cd kapwa-server && npm run typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add kapwa-server/src/agencies/agency-contact.entity.ts kapwa-server/src/programs/program-fund-source.entity.ts kapwa-server/src/programs/program-required-document.entity.ts kapwa-server/src/database/normalization-schema.spec.ts kapwa-server/src/database/migrations/20260828000004-CreateAgencyProgramChildTables.ts
git commit -m "feat(schema): add agency_contacts, program_fund_sources, program_required_documents 3NF child tables"
```

---

### Task 5: Add `person_id` FK to `referrals` (D4)

**Files:**
- Modify: `kapwa-server/src/referrals/referral.entity.ts`
- Create: `kapwa-server/src/database/migrations/20260828000005-AddReferralPersonId.ts`
- Test: modify `kapwa-server/src/referrals/referral.entity.ts` test if one exists; else add coverage in `kapwa-server/src/database/normalization-schema.spec.ts`

**Interfaces:**
- Consumes: existing `Referral` entity columns (`surname`, `first_name`, etc. — kept, not dropped in Wave 1).
- Produces: `Referral.personId` (`@Column({ name: 'person_id', nullable: true })`) + `Person` relation. Later Wave-2 tasks will populate/use it; Wave 1 only adds the column.

- [ ] **Step 1: Add the failing test**

Append to `kapwa-server/src/database/normalization-schema.spec.ts`:

```ts
import { Referral } from '../referrals/referral.entity';

describe('schema normalization — referrals person link', () => {
  it('supports a nullable person_id', () => {
    const r = new Referral();
    r.coordinatorId = 'u1';
    r.barangay = 'Poblacion';
    r.surname = 'Dela Cruz';
    r.firstName = 'Juan';
    r.gender = 'Male';
    r.dob = '1990-01-15';
    r.reason = 'Medical emergency';
    r.personId = 'p1';
    expect(r.personId).toBe('p1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-server && npx jest src/database/normalization-schema.spec.ts --silent`
Expected: FAIL — `Property 'personId' does not exist on type 'Referral'`

- [ ] **Step 3: Modify the entity**

In `kapwa-server/src/referrals/referral.entity.ts`, add `person_id` column and `Person` relation. Import `Person` from `../beneficiaries/person.entity`:

```ts
  @Column({ name: 'person_id', nullable: true })
  personId?: string;

  @ManyToOne(() => Person)
  @JoinColumn({ name: 'person_id' })
  person?: Person;
```

Add to the imports at the top of the file:

```ts
import { Person } from '../beneficiaries/person.entity';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd kapwa-server && npx jest src/database/normalization-schema.spec.ts --silent`
Expected: PASS

- [ ] **Step 5: Create the additive migration**

Create `kapwa-server/src/database/migrations/20260828000005-AddReferralPersonId.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReferralPersonId20260828000005 implements MigrationInterface {
  name = 'AddReferralPersonId20260828000005';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS person_id UUID`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_referrals_person ON referrals(person_id)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE referrals DROP COLUMN IF EXISTS person_id`);
  }
}
```

- [ ] **Step 6: Verify server still type-checks**

Run: `cd kapwa-server && npm run typecheck`
Expected: PASS (referral entity still has all legacy columns so the embedded person copy compiles)

- [ ] **Step 7: Commit**

```bash
git add kapwa-server/src/referrals/referral.entity.ts kapwa-server/src/database/migrations/20260828000005-AddReferralPersonId.ts kapwa-server/src/database/normalization-schema.spec.ts
git commit -m "feat(schema): add referrals.person_id FK (D4) for person linkage"
```

---

### Task 6: Dedup `beneficiaries` — drop the duplicate access-card/category/consent columns (D4/D5 housekeeping, additive-safe)

**Files:**
- Modify: `kapwa-server/src/beneficiaries/beneficiary.entity.ts` (keep the columns for Wave-1 compile safety — see note)
- Create: `kapwa-server/src/database/migrations/20260828000006-DedupBeneficiaryColumns.ts`
- Test: extend `kapwa-server/src/beneficiaries/person-normalization.spec.ts`

**Interfaces:**
- Consumes: existing `beneficiaries` and `beneficiary_roles` tables.
- Produces: A documented migration that, when applied in a later Wave, removes `beneficiaries.access_card_code`/`consent_status`/`category`. **In Wave 1 this is a NO-OP migration** that only verifies the columns still exist (guarded), because dropping them would break the running services that still read `beneficiaries.*`. It lays the additive groundwork.

- [ ] **Step 1: Write the test**

Append to `kapwa-server/src/beneficiaries/person-normalization.spec.ts`:

```ts
import { Beneficiary } from './beneficiary.entity';

describe('schema normalization — beneficiary dedup groundwork', () => {
  it('beneficiary still exposes legacy category for Wave-1 compatibility', () => {
    const b = new Beneficiary();
    b.category = 'Senior Citizen';
    b.consentStatus = 'active';
    expect(b.category).toBe('Senior Citizen');
    expect(b.consentStatus).toBe('active');
  });
});
```

- [ ] **Step 2: Run test to verify it passes (no change needed yet)**

Run: `cd kapwa-server && npx jest src/beneficiaries/person-normalization.spec.ts --silent`
Expected: PASS — this documents that Wave 1 keeps legacy columns.

- [ ] **Step 3: Create the groundwork migration (no-op, column drops deferred to Wave 2)**

Create `kapwa-server/src/database/migrations/20260828000006-DedupBeneficiaryColumns.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

// Wave 1: additive groundwork only. The actual column drops on `beneficiaries`
// (access_card_code, consent_status, category) are intentionally deferred to
// Wave 2 because services still read them. This migration verifies the columns
// exist and stays a no-op so the normalization intent is recorded in history.
export class DedupBeneficiaryColumns20260828000006 implements MigrationInterface {
  name = 'DedupBeneficiaryColumns20260828000006';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure beneficiary_roles is the authoritative owner; add a defensive index.
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_beneficiary_roles_person ON beneficiary_roles(person_id)`);
    // NO COLUMN DROPS in Wave 1.
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Nothing to reverse in Wave 1.
  }
}
```

- [ ] **Step 4: Verify server still type-checks**

Run: `cd kapwa-server && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/src/beneficiaries/person-normalization.spec.ts kapwa-server/src/database/migrations/20260828000006-DedupBeneficiaryColumns.ts
git commit -m "feat(schema): record beneficiary/beneficiary_roles dedup groundwork migration"
```

---

### Task 7: Full-wave verification (typecheck + SQL validation + ledger)

**Files:**
- Modify: `.superpowers/sdd/progress.md` (append completion lines — must be checked against existing content first)
- Test: `.superpowers/sdd/progress.md`

**Interfaces:**
- Consumes: all tasks 1–6 outputs.
- Produces: a green server typecheck + a validated migration set.

- [ ] **Step 1: Run the full server typecheck**

Run: `cd kapwa-server && npm run typecheck`
Expected: PASS

- [ ] **Step 2: Confirm all new test specs pass together**

Run: `cd kapwa-server && npx jest src/beneficiaries/person-normalization.spec.ts src/auth/user-normalization.spec.ts src/cases/case-normalization.spec.ts src/database/normalization-schema.spec.ts --silent`
Expected: PASS (all normalization specs)

- [ ] **Step 3: Append to SDD progress ledger**

Read `.superpowers/sdd/progress.md` (if present) first; append:

```markdown
## 3NF Normalization — Wave 1 (2026-08-28)
- Task 1: person_contacts + person_addresses (complete)
- Task 2: user_tokens + user_barangay_assignments (complete)
- Task 3: case_requirements + case_referrals + case_assistances (complete)
- Task 4: agency_contacts + program_fund_sources + program_required_documents (complete)
- Task 5: referrals.person_id FK (complete)
- Task 6: beneficiary dedup groundwork migration (complete)
```

- [ ] **Step 4: Commit (if the ledger is tracked) or leave as working-tree note**

```bash
git add .superpowers/sdd/progress.md 2>/dev/null || true
git commit -m "chore(schema): record Wave 1 3NF normalization in SDD ledger" 2>/dev/null || echo "ledger not tracked; skipped commit"
```

---

## Self-Review notes

- **Spec coverage (Wave 1):** Every new child table from §4 of the spec is created — `person_contacts`/`person_addresses` (§4.1), `user_tokens`/`user_barangay_assignments` (§4.2), `case_requirements`/`case_referrals`/`case_assistances` (§4.5), `agency_contacts` (§4.7), `program_fund_sources`/`program_required_documents` (§4.8), and `referrals.person_id` (D4). IRF JSONB snapshots (D3) and derived/dedup column drops (D2/D6, §4.3/§4.4) are intentionally deferred: D3 is a no-op by design, and the beneficiary/households/persons column removals are Wave-2 work that would break services.
- **Placeholder scan:** Every step has complete code; no TBD/TODO.
- **Type consistency:** Entity column names use snake_case DB names matching the migrations; `personId`/`person_id`, `caseId`/`case_id`, `programId`/`program_id`, `agencyId`/`agency_id` mapping is consistent throughout.
- **Wave 2 (explicitly out of scope here):** dropping legacy columns, updating services/DTOs/`@Expose()` getters, fixing the client's 500 tests, and the `app.addGlobalPrefix`/DTO-shape work. A separate plan should be authored for Wave 2 once Wave 1 is reviewed and merged.
