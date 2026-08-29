# Schema Normalization to 3NF — Wave 2: Drop + Rewire (API-Preserving) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drop the Wave-1-deprecated legacy columns across all domains, rewire the server (entities + services + raw SQL + sync + seeds + RLS) to persist through the normalized child tables, add real FK constraints, and add DB-enforced FK constraints — while keeping the public API response shapes byte-identical so `kapwa-client` and the existing server tests stay green.

**Architecture:** Per-domain tasks, ordered upstream-first (persons → users → beneficiary/household → cases → referrals → agency/program). Each task: (1) register+wire the child entities in the module, (2) add `@OneToMany` relations + `@Expose()` getters so entity serialization reproduces the legacy shape, (3) rewrite service write paths to persist child rows, (4) rewrite all raw-SQL/query-builder readers that referenced the legacy columns, (5) drop the legacy columns in a `20260829*` migration, (6) add FK constraints in a `20260829*` migration (after orphan cleanup). `@Expose()` getters + `strategy:'exposeAll'` preserve the response shape.

**Tech Stack:** NestJS, TypeORM, PostgreSQL (uuid v7 PKs, jsonb, tsvector), Jest (superagent `--silent`).

## Global Constraints

- **Repo:** `/home/typwtypw/Documents/NC/THESIS1-KAPWA`. Server code under `kapwa-server/src`.
- **Wave-1 child tables already exist** (created+backfilled, legacy columns still present): `person_contacts`, `person_addresses`, `user_tokens`, `user_barangay_assignments`, `case_requirements`, `case_referrals`, `case_assistances`, `agency_contacts`, `program_fund_sources`, `program_required_documents`; plus `referrals.person_id` column (no FK) and `beneficiary_roles` (exists, unowned).
- **Additive/destructive discipline:** Wave 2 drops legacy columns and adds FK constraints; it does NOT change the public API response shape. Preserve every field the client reads today.
- **No `git add -A`/`git add .`.** The repo has pre-existing unrelated dirty files (`DB-SCHEMA.md`, `EVALUATION.MD`, `SPEC-GAP.md`, `docs/diagrams/06-erd.md`, `docs/diagrams/07-data-dictionary.md`, `docs/inter-agency-beneficiary-tracking.md`, `docs/superpowers/plans/2026-08-05-system-diagrams-docs.md`, `kapwa-server/src/common/constants.ts`, `kapwa-server/src/database/migrate.ts`, deleted `kapwa-server/src/database/migrations/20260712000001-CreateInterventionTypesTable.ts`). Stage ONLY the exact files the task names.
- **Migration shape:** `MigrationInterface`, `name` field, `async up(queryRunner)` raw SQL, `IF EXISTS`/`IF NOT EXISTS` guards, `async down(queryRunner)` (re-add columns/restores). New numbering `2026082900000N-*.ts` under `kapwa-server/src/database/migrations/`.
- **Module registration:** every child entity used by a task must be added to its module's `TypeOrmModule.forFeature([...])`.
- **Tests:** run from `kapwa-server/`: `npx jest <path> --silent`. Full suite: `npx jest --silent`. Typecheck: `npm run typecheck`.
- **Retained (do NOT drop):** `persons.search_vector`, `persons.estimated_monthly_income`+`occupation` (D1), `households.estimated_income` (D2 cached), `irf_cases.item_a/item_b` (D3), `beneficiaries.hash/prev_hash` + `cases.hash/prev_hash` + `case_interventions.hash/prev_hash` (D5), document/config JSONB (`cases`/`programs.form_template`, `approval_workflow`, `irf.key_wraps`).

---

## Task 1: Persons — drop address/current_address/phone/email/age, rewire to person_contacts + person_addresses

**Files:**
- Modify: `kapwa-server/src/beneficiaries/person.entity.ts`
- Modify: `kapwa-server/src/beneficiaries/person-contact.entity.ts` (add `@ManyToOne` to Person)
- Modify: `kapwa-server/src/beneficiaries/person-address.entity.ts` (add `@ManyToOne` to Person)
- Modify: `kapwa-server/src/beneficiaries/beneficiaries.module.ts` (register PersonContact, PersonAddress)
- Modify: `kapwa-server/src/beneficiaries/index.ts` (export PersonContact, PersonAddress)
- Modify: `kapwa-server/src/beneficiaries/beneficiaries.service.ts` (write path `createBeneficiary` + raw-SQL readers)
- Modify: `kapwa-server/src/intake/intake.service.ts` (person create/merge + matchCheck raw SQL)
- Modify: `kapwa-server/src/intake/member-person.ts` (family member age from dob)
- Modify: `kapwa-server/src/lcr/lcr.service.ts` (person create path)
- Modify: `kapwa-server/src/dashboard/dashboard.service.ts` + `dashboard.controller.ts` (raw SQL + age/barangay readers)
- Modify: `kapwa-server/src/cases/cases.service.ts` (findAll barangay filter + getTrackerEntries raw SQL + age readers)
- Modify: `kapwa-server/src/cases/cases-export.service.ts` (export readers)
- Modify: `kapwa-server/src/database/seed-demo.ts` (person write path)
- Modify: `kapwa-server/src/database/migrations/20260720000001-UnifiedPersonModel.ts` RLS section (MUST be edited in place; it is an executed migration but the current DB already applied it — do NOT re-run; instead the new drop migration will re-create the policy)
- Modify: `kapwa-server/src/database/migrations/20260829000001-DropPersonLegacyColumns.ts` (Create)
- Test: `kapwa-server/src/database/person-wave2.spec.ts` (Create)

**Interfaces:**
- Consumes: Wave-1 `PersonContact` (`personId, contactType, value, isPrimary`), `PersonAddress` (`personId, addressType, barangay, city, province, postal, isPrimary, raw`).
- Produces: `Person.get phone()`, `get email()`, `get address()`, `get currentAddress()`, `get age()` (computed from `dob`). Relations `Person.contacts`, `Person.addresses` (eager). Person write helpers: `upsertPersonContacts(personId, {phone,email})`, `upsertPersonAddresses(personId, {address,currentAddress})`.

### Architecture for Task 1

- **Read getters:** `Person` gains `@OneToMany(() => PersonAddress, a => a.person)` and `@OneToMany(() => PersonContact, c => c.person)` (both `eager: true`). Add `@Expose()` getters reproducing the legacy fields:
  - `get phone(): string | undefined` → first contact with `contactType === 'phone'` (or raw) `.value`.
  - `get email(): string | undefined` → contact `contactType === 'email'`.value.
  - `get address(): string | undefined` → `addresses.find(a => a.addressType === 'current')?.raw ?? addresses[0]?.raw`.
  - `get currentAddress(): Record<string,string> | undefined` → reassemble from the current-address row's barangay/city/province (only if any present).
  - `get age(): number | undefined` → computed from `dob` via `Math.floor((Date.now()-dob.getTime())/3.156e10)`.
- **Write:** `Person` no longer has `address`/`phone`/`email`/`currentAddress`/`age` columns. Service write sites persist into child rows.
- **Raw SQL rewiring:** `persons.address` → `pa.raw` via JOIN to `person_addresses`; `p.age` → compute from `p.dob` in SQL; `p.current_address->>'barangay'` → `pa.barangay`.
- **RLS:** the existing policy referencing `persons.address` is replaced by one joining `person_addresses.barangay`.

- [ ] **Step 1: Write the failing test**

Create `kapwa-server/src/database/person-wave2.spec.ts`:

```ts
import { Person } from '../beneficiaries/person.entity';
import { PersonContact } from '../beneficiaries/person-contact.entity';
import { PersonAddress } from '../beneficiaries/person-address.entity';

describe('Person wave-2 getters', () => {
  it('assembles legacy flattened fields from child rows', () => {
    const p = new Person();
    p.surname = 'Cruz';
    p.firstName = 'Ana';
    p.dob = new Date('2000-01-15');
    const c1 = new PersonContact();
    c1.contactType = 'phone'; c1.value = '0917'; c1.isPrimary = true;
    const c2 = new PersonContact();
    c2.contactType = 'email'; c2.value = 'a@b.c'; c2.isPrimary = false;
    const a1 = new PersonAddress();
    a1.addressType = 'current'; a1.raw = 'Blk 1, Brgy San Isidro'; a1.barangay = 'San Isidro'; a1.isPrimary = true;
    (p as any).contacts = [c1, c2];
    (p as any).addresses = [a1];
    expect(p.phone).toBe('0917');
    expect(p.email).toBe('a@b.c');
    expect(p.address).toContain('Brgy San Isidro');
    expect((p.currentAddress as any)?.barangay).toBe('San Isidro');
    expect(typeof p.age).toBe('number');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (workdir `kapwa-server/`): `npx jest src/database/person-wave2.spec.ts --silent`
Expected: FAIL — `Person` has no property `contacts`/`addresses`/`phone`/`email` getters.

- [ ] **Step 3: Add relations + getters to `person.entity.ts`**

Edit `kapwa-server/src/beneficiaries/person.entity.ts`:

```ts
import { Entity, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Expose } from 'class-transformer';
import { BaseEntity } from '../common/base.entity';
import { PersonContact } from './person-contact.entity';
import { PersonAddress } from './person-address.entity';

@Entity('persons')
export class Person extends BaseEntity {
  @Column() surname!: string;
  @Column({ name: 'first_name' }) firstName!: string;
  @Column({ name: 'middle_name', nullable: true }) middleName?: string;
  @Column({ name: 'extension', nullable: true }) extension?: string;
  @Column({ name: 'gender', type: 'enum', enum: ['Male', 'Female'] }) gender!: 'Male' | 'Female';
  @Column({ name: 'dob', type: 'date' }) dob!: Date;
  @Column({ name: 'philsys_number', unique: true, nullable: true }) philsysNumber?: string;
  @Column({ name: 'place_of_birth', nullable: true }) placeOfBirth?: string;
  @Column({ name: 'civil_status', nullable: true }) civilStatus?: string;
  @Column({ name: 'philhealth_number', nullable: true }) philhealthNumber?: string;
  @Column({ nullable: true }) occupation?: string;
  @Column({ name: 'estimated_monthly_income', type: 'decimal', precision: 12, scale: 2, nullable: true }) estimatedMonthlyIncome?: number;
  @Column({ type: 'tsvector', name: 'search_vector', select: false, nullable: true }) searchVector?: string;

  @OneToMany(() => PersonContact, c => c.person, { eager: true, cascade: true })
  contacts!: PersonContact[];

  @OneToMany(() => PersonAddress, a => a.person, { eager: true, cascade: true })
  addresses!: PersonAddress[];

  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;

  // --- Legacy flattened shape, now assembled from child rows ---
  @Expose() get phone(): string | undefined {
    return this.contacts?.find(c => c.contactType === 'phone')?.value ?? this.contacts?.[0]?.value;
  }
  @Expose() get email(): string | undefined {
    return this.contacts?.find(c => c.contactType === 'email')?.value;
  }
  @Expose() get address(): string | undefined {
    return this.addresses?.find(a => a.addressType === 'current')?.raw ?? this.addresses?.[0]?.raw;
  }
  @Expose() get currentAddress(): Record<string, string> | undefined {
    const a = this.addresses?.find(x => x.addressType === 'current');
    if (!a || (!a.barangay && !a.city && !a.province)) return undefined;
    const out: Record<string, string> = {};
    if (a.barangay) out.barangay = a.barangay;
    if (a.city) out.city = a.city;
    if (a.province) out.province = a.province;
    return out;
  }
  @Expose() get age(): number | undefined {
    if (!this.dob) return undefined;
    return Math.floor((Date.now() - new Date(this.dob).getTime()) / 31557600000);
  }
}
```

- [ ] **Step 4: Add `@ManyToOne` to `person-contact.entity.ts` and `person-address.entity.ts`**

`kapwa-server/src/beneficiaries/person-contact.entity.ts` — add above the class fields:

```ts
import { Entity, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Person } from './person.entity';

@Entity('person_contacts')
export class PersonContact extends BaseEntity {
  @ManyToOne(() => Person, p => p.contacts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'person_id' })
  person!: Person;

  @Column({ name: 'person_id' }) personId!: string;
  @Column({ name: 'contact_type' }) contactType!: string;
  @Column() value!: string;
  @Column({ name: 'is_primary', nullable: true }) isPrimary?: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
```

`kapwa-server/src/beneficiaries/person-address.entity.ts` — add:

```ts
import { Entity, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Person } from './person.entity';

@Entity('person_addresses')
export class PersonAddress extends BaseEntity {
  @ManyToOne(() => Person, p => p.addresses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'person_id' })
  person!: Person;

  @Column({ name: 'person_id' }) personId!: string;
  @Column({ name: 'address_type' }) addressType!: string;
  @Column({ nullable: true }) barangay?: string;
  @Column({ nullable: true }) city?: string;
  @Column({ nullable: true }) province?: string;
  @Column({ nullable: true }) postal?: string;
  @Column({ name: 'is_primary', nullable: true }) isPrimary?: boolean;
  @Column({ nullable: true }) raw?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
```

- [ ] **Step 5: Register modules + exports**

`kapwa-server/src/beneficiaries/beneficiaries.module.ts` — add `PersonContact, PersonAddress` to the `TypeOrmModule.forFeature([...])` array (currently `[Person, BeneficiaryRole, HouseholdMembership, BeneficiaryClaimant, Beneficiary, ConsentLedger, Case]`).

`kapwa-server/src/beneficiaries/index.ts` — add `export * from './person-contact.entity'; export * from './person-address.entity';`.

- [ ] **Step 6: Rewire person write paths**

`kapwa-server/src/beneficiaries/beneficiaries.service.ts` `createBeneficiary` — replace the `personData` with:

```ts
const person = this.personRepo.create({
  surname: data.surname, firstName: data.firstName,
  middleName: data.middleName, gender: data.gender as 'Male' | 'Female',
  dob: data.dob,
});
person.contacts = data.phone ? [{ personId: undefined as any, contactType: 'phone', value: data.phone, isPrimary: true } as PersonContact] : [];
person.addresses = data.address ? [{ personId: undefined as any, addressType: 'current', raw: data.address, isPrimary: true } as PersonAddress] : [];
let savedPerson: Person;
if (data.philsysNumber) { /* existing lookup unchanged */ } else {
  savedPerson = await this.personRepo.save(this.personRepo.create(person));
}
```

(Use `this.personRepo.save(person)` and let cascade persist the child rows; add `PersonContact`/`PersonAddress` imports.)

`kapwa-server/src/lcr/lcr.service.ts` `:69` `address: data.address` — remove; after `personRepo.save`, push a `PersonAddress` child row if `data.address` present.

- [ ] **Step 7: Rewire raw SQL / query-builder readers to `person_addresses`**

Replace these reads (all reference the dropped columns):
- `kapwa-server/src/beneficiaries/beneficiaries.service.ts` `:85,97,112` `p.address ILIKE ...` → join `person_addresses pa` on `pa.person_id = p.id` and use `(pa.barangay ILIKE ... OR pa.raw ILIKE ...)`; de-dup with `qb.andWhere` on an EXISTS subquery: `EXISTS (SELECT 1 FROM person_addresses pa2 WHERE pa2.person_id = p.id AND (pa2.raw ILIKE :x OR pa2.barangay ILIKE :x))`.
- `kapwa-server/src/cases/cases.service.ts` `:99` barangay filter → same EXISTS pattern; `:481` `COALESCE(NULLIF(p.current_address->>'barangay',''), p.address)` → `COALESCE((SELECT pa2.barangay FROM person_addresses pa2 WHERE pa2.person_id=p.id AND pa2.address_type='current' LIMIT 1), (SELECT pa3.raw FROM person_addresses pa3 WHERE pa3.person_id=p.id LIMIT 1)) AS barangay`. `:475-477` `WHEN p.age IS NULL ... ELSE` → compute from `p.dob`: `WHEN p.dob IS NULL THEN 'Unknown' WHEN p.dob > NOW() - INTERVAL '18 years' THEN '0-17' WHEN p.dob < NOW() - INTERVAL '60 years' THEN '60+' ELSE '18-59' END`.
- `kapwa-server/src/dashboard/dashboard.service.ts` `:54,68,108,121-124` `p.current_address->>'barangay' OR p.address ILIKE` → EXISTS on `person_addresses.barangay/raw`.
- `kapwa-server/src/cases/cases-export.service.ts` `:108,134,137,138,139,391,394` `person?.address`, `person?.phone`, `person?.currentAddress` — these read the getters (now working); leave as-is. `:139 estimatedIncome` unchanged.
- `kapwa-server/src/intake/intake.service.ts` `:410-412` matchCheck raw SQL selects `p.address, p.phone, ... p.age` — replace `p.address` → `pa.raw`, join `person_addresses pa`, and `p.age` → computed `CASE WHEN p.dob...` expr. `:420` `'age', p3.age` → computed expr. `:461-466` map age/currentAddress from dob + join.
- `kapwa-server/src/dashboard/dashboard.controller.ts` `:60` `person.age || 0` → getter still works; `:76` `(person.currentAddress?.barangay).trim() || (person.address||'').split(',').pop()?.trim()` → getters still work. Leave as-is.

- [ ] **Step 8: Fix `intake/member-person.ts` age**

`kapwa-server/src/intake/member-person.ts:24` `age: fm.age ?? computeAgeFromDob(fm.dob)` — replace with `age: computeAgeFromDob(fm.dob)`. Ensure `computeAgeFromDob` exists (add if missing, mirroring the Person getter formula).

- [ ] **Step 9: Fix seed-demo.ts**

`kapwa-server/src/database/seed-demo.ts:110,117` — the dup-check `String(b.phone||'') === p.phone` reads entity getters (OK). The write at `:117` sets `address: p.address, phone: p.phone` into `personRepo.create` — remove those two and instead push child rows (same pattern as Step 6).

- [ ] **Step 10: Create drop migration + RLS fix**

Create `kapwa-server/src/database/migrations/20260829000001-DropPersonLegacyColumns.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropPersonLegacyColumns20260829000001 implements MigrationInterface {
  name = 'DropPersonLegacyColumns20260829000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE person_addresses
        ADD CONSTRAINT fk_person_addresses_person FOREIGN KEY (person_id)
        REFERENCES persons(id) ON DELETE CASCADE
        NOT VALID;
      ALTER TABLE person_addresses VALIDATE CONSTRAINT fk_person_addresses_person;

      ALTER TABLE person_contacts
        ADD CONSTRAINT fk_person_contacts_person FOREIGN KEY (person_id)
        REFERENCES persons(id) ON DELETE CASCADE
        NOT VALID;
      ALTER TABLE person_contacts VALIDATE CONSTRAINT fk_person_contacts_person;

      DELETE FROM person_contacts pc WHERE NOT EXISTS (SELECT 1 FROM persons p WHERE p.id = pc.person_id);
      DELETE FROM person_addresses pa WHERE NOT EXISTS (SELECT 1 FROM persons p WHERE p.id = pa.person_id);

      ALTER TABLE persons DROP COLUMN IF EXISTS address;
      ALTER TABLE persons DROP COLUMN IF EXISTS phone;
      ALTER TABLE persons DROP COLUMN IF EXISTS email;
      ALTER TABLE persons DROP COLUMN IF EXISTS current_address;
      ALTER TABLE persons DROP COLUMN IF EXISTS age;

      DROP POLICY IF EXISTS rls_barangay_persons_select ON persons;
      CREATE POLICY rls_barangay_persons_select ON persons
        USING (EXISTS (
          SELECT 1 FROM person_addresses pa
          WHERE pa.person_id = persons.id
            AND (pa.barangay ILIKE '%' || current_setting('app.current_barangay', true) || '%')
        ));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP POLICY IF EXISTS rls_barangay_persons_select ON persons;
      ALTER TABLE persons ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE persons ADD COLUMN IF NOT EXISTS phone TEXT;
      ALTER TABLE persons ADD COLUMN IF NOT EXISTS email TEXT;
      ALTER TABLE persons ADD COLUMN IF NOT EXISTS current_address JSONB;
      ALTER TABLE persons ADD COLUMN IF NOT EXISTS age INTEGER;
      ALTER TABLE person_contacts DROP CONSTRAINT IF EXISTS fk_person_contacts_person;
      ALTER TABLE person_addresses DROP CONSTRAINT IF EXISTS fk_person_addresses_person;
    `);
  }
}
```

- [ ] **Step 11: Run tests** — `npx jest src/database/person-wave2.spec.ts src/beneficiaries src/intake src/cases --silent` (expect passing; fix any reader that still references dropped columns). Then `npm run typecheck`.

- [ ] **Step 12: Commit**

```bash
cd /home/typwtypw/Documents/NC/THESIS1-KAPWA
git add kapwa-server/src/beneficiaries/person.entity.ts kapwa-server/src/beneficiaries/person-contact.entity.ts kapwa-server/src/beneficiaries/person-address.entity.ts kapwa-server/src/beneficiaries/beneficiaries.module.ts kapwa-server/src/beneficiaries/index.ts kapwa-server/src/beneficiaries/beneficiaries.service.ts kapwa-server/src/intake/intake.service.ts kapwa-server/src/intake/member-person.ts kapwa-server/src/lcr/lcr.service.ts kapwa-server/src/dashboard/dashboard.service.ts kapwa-server/src/cases/cases.service.ts kapwa-server/src/database/seed-demo.ts kapwa-server/src/database/migrations/20260829000001-DropPersonLegacyColumns.ts kapwa-server/src/database/person-wave2.spec.ts
git commit -m "feat(schema): wave2 persons — drop legacy address/contact/age, rewire to child tables + FKs"
```

---

## Task 2: Users — drop token + barangay legacy columns, rewire to user_tokens + user_barangay_assignments

**Files:**
- Modify: `kapwa-server/src/auth/user.entity.ts`
- Modify: `kapwa-server/src/auth/user-token.entity.ts` (add `@ManyToOne` User)
- Modify: `kapwa-server/src/auth/user-barangay-assignment.entity.ts` (add `@ManyToOne` User)
- Modify: `kapwa-server/src/auth/auth.module.ts`, `kapwa-server/src/users/users.module.ts` (register UserToken, UserBarangayAssignment)
- Modify: `kapwa-server/src/auth/auth.service.ts` (all token write/read/clear paths)
- Modify: `kapwa-server/src/users/users.service.ts` (createUser/update write paths)
- Modify: `kapwa-server/src/auth/guards/abac.guard.ts`, `kapwa-server/src/auth/services/abac.service.ts`, `kapwa-server/src/intake/intake.controller.ts`, `kapwa-server/src/referrals/referrals.controller.ts`, `kapwa-server/src/dashboard/dashboard.controller.ts`, `kapwa-server/src/access-cards/access-cards.controller.ts` (assignedBarangay/permittedBarangays readers — via getters)
- Modify: `kapwa-server/src/database/seed-accounts.ts`
- Modify: `kapwa-server/src/sync/sync.service.ts` (ALLOWED_COLUMNS + tableMap)
- Create: `kapwa-server/src/database/migrations/20260829000002-DropUserLegacyColumns.ts`
- Test: `kapwa-server/src/database/user-wave2.spec.ts`

**Interfaces:**
- Consumes: `UserToken` (`userId,purpose,token,expiresAt`), `UserBarangayAssignment` (`userId,barangay,isPrimary`).
- Produces: `User.get assignedBarangay()`, `get permittedBarangays()` (getter), `get verificationToken()`/`verificationTokenExpiresAt`/`resetToken`/`resetTokenExpiresAt`/`newEmail`/`newEmailToken`/`newEmailTokenExpiresAt` (getters → read `User.tokens`). Relations `User.tokens`, `User.barangayAssignments` (eager). Auth helper `AuthService#upsertToken(userId, purpose, {token,expiresAt})` and `AuthService#deleteTokens(userId, purpose)`.

- [ ] **Step 1: Write the failing test** — `kapwa-server/src/database/user-wave2.spec.ts`: construct `User` with child `tokens`/`barangayAssignments`; assert `assignedBarangay`, `permittedBarangays`, `verificationToken` getters return legacy-flattened values.

- [ ] **Step 2: Run test to verify it fails.**

- [ ] **Step 3: Edit `user.entity.ts`**

Remove the 9 legacy @Column declarations (`assigned_barangay:44-45`, `permitted_barangays:50-51`, `verification_token:71-72`, `verification_token_expires_at:74-75`, `reset_token:77-78`, `reset_token_expires_at:80-81`, `new_email:83-84`, `new_email_token:86-87`, `new_email_token_expires_at:89-90`). Add `@Expose()` getters + relations:

```ts
import { Expose } from 'class-transformer';
import { OneToMany } from 'typeorm';
import { UserToken } from './user-token.entity';
import { UserBarangayAssignment } from './user-barangay-assignment.entity';

// inside class:
  @OneToMany(() => UserToken, t => t.user, { eager: true, cascade: true })
  tokens!: UserToken[];

  @OneToMany(() => UserBarangayAssignment, b => b.user, { eager: true, cascade: true })
  barangayAssignments!: UserBarangayAssignment[];

  @Expose() get assignedBarangay(): string | undefined {
    return this.barangayAssignments?.find(b => b.isPrimary)?.barangay ?? this.barangayAssignments?.[0]?.barangay;
  }
  @Expose() get permittedBarangays(): string[] {
    return (this.barangayAssignments ?? []).filter(b => !b.isPrimary).map(b => b.barangay);
  }
  @Expose() get verificationToken(): string | undefined { return this.tokens?.find(t => t.purpose === 'email_verification')?.token; }
  @Expose() get verificationTokenExpiresAt(): Date | undefined { return this.tokens?.find(t => t.purpose === 'email_verification')?.expiresAt; }
  @Expose() get resetToken(): string | undefined { return this.tokens?.find(t => t.purpose === 'password_reset')?.token; }
  @Expose() get resetTokenExpiresAt(): Date | undefined { return this.tokens?.find(t => t.purpose === 'password_reset')?.expiresAt; }
  @Expose() get newEmail(): string | undefined { return this.tokens?.find(t => t.purpose === 'change_email')?.token && this.tokens?.find(t => t.purpose === 'change_email') ? (this as any)._newEmail : undefined; }
  @Expose() get newEmailToken(): string | undefined { return this.tokens?.find(t => t.purpose === 'change_email')?.token; }
  @Expose() get newEmailTokenExpiresAt(): Date | undefined { return this.tokens?.find(t => t.purpose === 'change_email')?.expiresAt; }
```

- [ ] **Step 4: Add `@ManyToOne` to `user-token.entity.ts` and `user-barangay-assignment.entity.ts`** (mirror the Task-1 child `@ManyToOne` — `person` → `user`, `p.contacts` → `u.tokens` / `u.barangayAssignments`, `onDelete: 'CASCADE'`).

- [ ] **Step 5: Register modules** — add `UserToken, UserBarangayAssignment` to both `auth.module.ts` and `users.module.ts` `forFeature`.

- [ ] **Step 6: Rewire `auth.service.ts` token paths** to write/read `user_tokens` child rows:
  - register `:38-50` → after saving user, create `UserToken { purpose:'email_verification', token, expiresAt: verificationTokenExpiresAt }` and assign to a `user.tokens` array; `verifyEmail :248-257` → query `user_tokens` by purpose+token (inject `UserToken` repo or use `dataSource`); on success delete the row. `:273-279` resend → upsert token row. `forgotPassword :289-292`, `resetPassword :300-310` same. `changeEmail :326-330`, `confirmEmailChange :338-348`: store `newEmail` — since `new_email` column is dropped, add a transient `(this as any)._newEmail`/store on the token row's `token` + a purpose `'change_email'`, and keep the pending email in the `UserToken` child row via a new column `meta jsonb` (add `@Column({type:'jsonb',nullable:true}) meta?` to `user-token.entity.ts`) storing `{ newEmail }`.

- [ ] **Step 7: Rewire `users.service.ts` write paths** — `createUser :66` and `update :91,93` replace column writes with child-row upserts (replace `user.barangayAssignments` to match `assigned_barangay` + `permitted_barangays`). Keep the DTO interfaces/types identical.

- [ ] **Step 8: Rewire `seed-accounts.ts`** — replace direct INSERT of `assigned_barangay, permitted_barangays` columns with child-table INSERTs; remove those columns from the INSERT column list.

- [ ] **Step 9: Update `sync.service.ts`** — remove `"assigned_barangay","permitted_barangays"` from `ALLOWED_COLUMNS`; add `"user_tokens"`, `"user_barangay_assignments"` to the `tableMap` (with their columns). The controller/guard reads of `assignedBarangay`/`permittedBarangays` now hit the getters — no change needed, but verify `abac.service.ts`/`abac.guard.ts` compile.

- [ ] **Step 10: Create drop migration** `20260829000002-DropUserLegacyColumns.ts` — add FK constraints on `user_tokens.user_id` + `user_barangay_assignments.user_id` (references users ON DELETE CASCADE, NOT VALID then VALIDATE), purge orphans, `DROP COLUMN IF EXISTS` the 9 legacy columns. `down()` re-adds columns, drops FK constraints.

- [ ] **Step 11: Run tests + typecheck** — `npx jest src/auth src/users src/database/user-wave2.spec.ts --silent`, then `npm run typecheck`.

- [ ] **Step 12: Commit** (stage only the files listed above; follow Task-1 commit pattern, message `feat(schema): wave2 users — drop token/barangay legacy columns, rewire to child tables + FKs`).

---

## Task 3: Beneficiary + Household — make beneficiary_roles the owner (person-keyed), drop category/consent_status from beneficiaries

**Files:**
- Modify: `kapwa-server/src/beneficiaries/beneficiary.entity.ts`
- Modify: `kapwa-server/src/beneficiaries/person.entity.ts` (add `roles` OneToMany → BeneficiaryRole)
- Modify: `kapwa-server/src/beneficiaries/beneficiaries.service.ts` (create/revokeConsent/findAll category+consentStatus paths)
- Modify: `kapwa-server/src/beneficiaries/person-normalization.spec.ts` (update to populate role relation instead of setter)
- Modify: `kapwa-server/src/intake/intake.service.ts` (consentStatus writes, matchCheck b.category)
- Modify: `kapwa-server/src/lcr/lcr.service.ts` (consentStatus write)
- Modify: `kapwa-server/src/sync/sync.service.ts` (ALLOWED_COLUMNS)
- Modify: `kapwa-server/src/database/seed-*` (if writes beneficiary category/consent_status)
- Create: `kapwa-server/src/database/migrations/20260829000003-BeneficiaryDedup.ts`
- Test: `kapwa-server/src/database/beneficiary-wave2.spec.ts`

**ARCHITECTURE (verified against actual code — DIVERGENCE from earlier drafting corrected):** `beneficiary_roles` is **person-keyed** (`person_id` UUID NOT NULL → `persons`), NOT beneficiary-keyed. It ALREADY owns `consent_status` (default 'active'), `category`, `access_card_code` (UNIQUE), plus `household_id`/`user_id`. Wave-1 Task-6 migration `20260828000006-DedupBeneficiaryColumns.ts` already declared it the authoritative owner and added `idx_beneficiary_roles_person`. So:
- The link is `Beneficiary.personId → BeneficiaryRole.personId` (via `Person.roles` OneToMany). NO `beneficiary_id` column — do NOT add one.
- Drop ONLY `beneficiaries.consent_status` + `beneficiaries.category`. `households.access_card_code` is KEPT (D2; actively read by `inter-agency-referrals` `h.access_card_code` and `getAccessCard`). `beneficiary_roles.access_card_code` is per-person — KEPT, untouched.
- Add the physical FK `beneficiary_roles.person_id → persons(id)` if not already present (Task-6 only added an index).

- [ ] **Step 1: Write failing test** — `beneficiary-wave2.spec.ts`: construct a `Beneficiary` whose `person.roles` contains a `BeneficiaryRole { consentStatus:'active', category:'Senior Citizen' }`; assert getters `category` and `consentStatus` return the role-owned values; assert `accessCardCode` still resolves via `household.accessCardCode` (when household set). Also update `person-normalization.spec.ts:30-35` which currently sets `b.category`/`b.consentStatus` as columns — change to build `b.person.roles = [role]` and assert the getters.

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Edit `beneficiary.entity.ts`**

Remove `@Column({name:'category'}) category?` (`:26-27`) and `@Column({name:'consent_status'}) consentStatus!` (`:20-21`). Add `@Expose()` getters reading the role via the person:

```ts
@Expose() get category(): string | undefined { return this.person?.roles?.[0]?.category; }
@Expose() get consentStatus(): string { return this.person?.roles?.[0]?.consentStatus ?? 'active'; }
```

Keep `household.accessCardCode` reads (`getAccessCard`) — `households.access_card_code` stays. `person-normalization.spec.ts` must be updated to use the role relation.

- [ ] **Step 4: Add `Person.roles` OneToMany** in `person.entity.ts`:

```ts
@OneToMany(() => BeneficiaryRole, r => r.person, { eager: true })
roles!: BeneficiaryRole[];
```

(`beneficiary-role.entity.ts` already has the inverse `@ManyToOne(() => Person, { nullable: false }) @JoinColumn({ name: 'person_id' }) person?` — no change needed there.)

- [ ] **Step 5: Rewire `beneficiaries.service.ts`**
  - `createBeneficiary :65` `consentStatus:'active'` → do NOT set on the entity; after person save, create/insert a `BeneficiaryRole { personId: person.id, consentStatus:'active', category: data.category }` row if one does not already exist for that person (inject `BeneficiaryRole` repo).
  - `revokeConsent :247` `benRepo.update(beneficiaryId, { consentStatus:'revoked' })` → look up the beneficiary's `personId`, then update `beneficiary_roles SET consent_status='revoked' WHERE person_id = :personId`.
  - `findAll :92-93,101-103,111` `b.category` filters → JOIN `beneficiary_roles br ON br.person_id = b.person_id` and filter `br.category` (`br.category = :category` / `br.category ILIKE :categoryMatch`).

- [ ] **Step 6: Rewire `intake.service.ts`** — search for any `consentStatus`/`category` writes on the beneficiary or `matchCheck` raw-SQL reads of `b.category`/`r.category`; rewire to `beneficiary_roles` (join by person_id). `lcr.service.ts` same (`consentStatus`/`category` writes → role row). Confirm `b.consentStatus`/`b.category` entity reads anywhere go through the new getters (`person.roles[0]`) — eager-loading Person on those queries must load `roles` (it does, eager).

- [ ] **Step 7: Verify access-cards service** — `UPDATE households SET access_card_code` stays (column kept); `getSummary`/`autoLogFromIntervention` read `h.access_card_code` (kept) — no change. Only remove any `beneficiaries.access_card_code` reference if one exists (the column was already moved to household in `20260730000003`; verify there is none).

- [ ] **Step 8: Update `sync.service.ts` ALLOWED_COLUMNS** — for `beneficiaries`, remove `"consent_status"` and `"category"` (dropped columns). `access_card_code` stays on `households` (keep it in the household line). Add `"beneficiary_roles"` to `tableMap` if sync should replicate roles.

- [ ] **Step 9: Update seeds** — adjust any `seed-demo.ts`/`seed-accounts.ts` writes touching beneficiary category/consent_status to insert into `beneficiary_roles` instead.

- [ ] **Step 10: Create drop migration** `20260829000003-BeneficiaryDedup.ts`:
  - Backfill: `INSERT INTO beneficiary_roles (person_id, household_id, user_id, consent_status, category) SELECT b.person_id, b.household_id, b.user_id, b.consent_status, b.category FROM beneficiaries b WHERE b.person_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM beneficiary_roles r WHERE r.person_id = b.person_id);` (use `uuid_generate_v7()` id + NOW() timestamps).
  - Add physical FK if missing: `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_beneficiary_roles_person') THEN ALTER TABLE beneficiary_roles ADD CONSTRAINT fk_beneficiary_roles_person FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE; END IF; END $$;` (plain `ADD CONSTRAINT` is fine — the backfill guarantees no orphans; verify no orphan rows first with a DELETE purging roles whose person_id has no persons row).
  - `ALTER TABLE beneficiaries DROP COLUMN IF EXISTS consent_status; ALTER TABLE beneficiaries DROP COLUMN IF EXISTS category;`
  - `down()` re-adds the two columns (`TEXT DEFAULT 'active'` / `TEXT`), backfills from `beneficiary_roles`, drops the FK.

- [ ] **Step 11: Run tests + typecheck** — `npx jest src/beneficiaries src/access-cards src/database/beneficiary-wave2.spec.ts --silent`, then `npm run typecheck`, then FULL `npx jest --silent`.

- [ ] **Step 12: Commit** — `feat(schema): wave2 beneficiary — person-keyed beneficiary_roles owns category/consent_status, drop legacy columns`.

---

## Task 4: Cases — decompose requirements/referrals/financial to child tables, fix follow_up_visits + case_assistance.amount

**Files:**
- Modify: `kapwa-server/src/cases/case.entity.ts`
- Modify: `kapwa-server/src/cases/case-requirement.entity.ts`, `case-referral.entity.ts`, `case-assistance.entity.ts` (add `@ManyToOne` Case + relations)
- Modify: `kapwa-server/src/cases/cases.module.ts` (register the 3 child entities + CaseRequirement etc.)
- Modify: `kapwa-server/src/cases/cases.service.ts` (create/updateAssessmentV2/updateRequirements/updateTransitionPlan/raw SQL)
- Modify: `kapwa-server/src/cases/cases-export.service.ts` (financial + referrals read)
- Modify: `kapwa-server/src/intake/intake.service.ts` (requirementsChecklist + serviceRequested writes)
- Modify: `kapwa-server/src/sync/sync.service.ts` (ALLOWED_COLUMNS + tableMap)
- Modify: `kapwa-server/src/database/seed-*` if writes case legacy JSONB
- Create: `kapwa-server/src/database/migrations/20260829000004-CaseDecompose.ts`
- Test: `kapwa-server/src/database/case-wave2.spec.ts`

- [ ] **Step 1: Write failing test** — construct `Case` with child `requirements`/`referrals`/`assistances`; assert getters `requirementsChecklist`, `referrals`, `followUpVisits` reassemble legacy shapes.

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Edit `case.entity.ts`**

Remove `requirementsChecklist` (`:27-28` jsonb), `referrals` (`:98` jsonb), `financialSubsidies` (`:71`), `otherAssistance` (`:86`), `amountAssistance` (`:74`), `modeFinancialAssistance` (`:77`), `sourceOfFund` (`:80`), `legislatorSpecify` (`:83`), `natureOfService` (`:68`), `followUpVisits` (`:137` jsonb). Keep `serviceRequested` (text[], still used by category filter; not decomposed per design) and `hash/prev_hash` (DB-only, not on entity). Add relations + getters:

```ts
@OneToMany(() => CaseRequirement, r => r.case, { eager:true, cascade:true }) requirements!: CaseRequirement[];
@OneToMany(() => CaseReferral, r => r.case, { eager:true, cascade:true }) referrals!: CaseReferral[];
@OneToMany(() => CaseAssistance, a => a.case, { eager:true, cascade:true }) assistances!: CaseAssistance[];

@Expose() get requirementsChecklist(): Record<string, boolean> | undefined {
  if (!this.requirements || this.requirements.length === 0) return undefined;
  const out: Record<string, boolean> = {};
  this.requirements.forEach(r => { out[r.requirementKey] = !!r.met; });
  return out;
}
@Expose() get followUpVisits(): Array<{date:string;type:string;notes:string;outcome:string}> | undefined {
  // follow_up_visits stays its own normalized column; if dropped, reassemble — see Step 5
  return undefined;
}
```

For the financial fields, keep the richest source of truth in `case_assistances` and reassemble via getters:

```ts
@Expose() get financialSubsidies(): Record<string, unknown> | undefined {
  return this.assistances?.find(a => a.assistanceType === 'financial')?.details;
}
@Expose() get amountAssistance(): number | undefined {
  const a = this.assistances?.find(x => x.assistanceType === 'financial');
  return a?.amount != null ? Number(a.amount) : undefined;
}
@Expose() get modeFinancialAssistance(): string | undefined {
  return this.assistances?.find(a => a.assistanceType === 'financial')?.mode;
}
@Expose() get sourceOfFund(): string | undefined {
  return this.assistances?.find(a => a.assistanceType === 'financial')?.sourceOfFund;
}
@Expose() get legislatorSpecify(): string | undefined {
  return this.assistances?.find(a => a.assistanceType === 'financial')?.legislatorSpecify;
}
@Expose() get otherAssistance(): Record<string, unknown> | undefined {
  const others = this.assistances?.filter(a => a.assistanceType !== 'financial') ?? [];
  if (others.length === 0) return undefined;
  const out: Record<string, unknown> = {};
  others.forEach(o => { out[o.assistanceType] = o.details ?? {}; });
  return out;
}
```

**`follow_up_visits`:** research shows zero code reads/writes it. Keep the column (retype JSONB→INTEGER per M8 is moot since it's dormant) — instead **drop the column entirely** and add getter returning `undefined`. Simpler and no behavior change. (Re-add a typed `followUpVisits` array column later if the feature is ever used.)

Keep `natureOfService` as a column (text[]); keep `serviceRequested`.

- [ ] **Step 4: Add `@ManyToOne` to the 3 case child entities** (like Task 1/2 pattern; `case` relation, `onDelete:'CASCADE'`).

- [ ] **Step 5: Register the 3 child entities in `cases.module.ts`** `forFeature`.

- [ ] **Step 6: Rewire `cases.service.ts` write/read paths** —
  - `create :64-71` → after `caseRepo.save`, create `CaseRequirement` rows from `data.requirementsChecklist` and `CaseAssistance` rows from financial fields if present.
  - `updateAssessmentV2 :401-422` → write child rows: upsert a `financial` `CaseAssistance` (assistanceType 'financial', amount, mode, sourceOfFund, legislatorSpecify, details=financialSubsidies) and `other` rows from `otherAssistance`; drop the now-removed column assigns. (Also `updateAssessment` dead method `:355-373` — remove or leave unreachable; leave as-is to minimize risk.)
  - `updateTransitionPlan :375-380` → writes `referrals` → create `CaseReferral` rows from `data.referrals` (agency=agencyName, status, notes) and delete/recreate; `followUpDate`/`exitNotes` stay columns.
  - `updateRequirements :382-387` → create/replace `CaseRequirement` rows from `data.requirementsChecklist`.
  - raw SQL `:393-399` `case_interventions` count — unchanged (that table stays).
- **`intake.service.ts` `:268,562`** writes `requirementsChecklist` + `serviceRequested` into `caseRepo.create` — remove `requirementsChecklist` (now child rows) and push `CaseRequirement` rows after save; keep `serviceRequested`.
- **`cases-export.service.ts`** financial/referrals reads use entity getters — verify they still compile (they read `case.amountAssistance` etc. via getters now).
- **`sync.service.ts`** — remove `"requirements_checklist","referrals","financial_subsidies","amount_assistance","mode_financial_assistance","source_of_fund","legislator_specify","other_assistance","follow_up_visits","nature_of_service"` from `ALLOWED_COLUMNS` (keep `"service_requested"`); add `"case_requirements","case_referrals","case_assistances"` to tableMap.

- [ ] **Step 7: Create drop migration** `20260829000004-CaseDecompose.ts` — add FKs on `case_requirements.case_id`/`case_referrals.case_id`/`case_assistances.case_id` → cases ON DELETE CASCADE (NOT VALID → VALIDATE); purge orphans; `ALTER TABLE cases DROP COLUMN IF EXISTS` the removed JSONB/financial/follow_up_visits columns. Ensure no column referenced by leftover code is dropped (only those removed from the entity).

- [ ] **Step 8: Run tests + typecheck** (`npx jest src/cases src/intake src/database/case-wave2.spec.ts --silent`, then typecheck).

- [ ] **Step 9: Commit.**

---

## Task 5: Referrals — drop embedded person copy, link via person_id

**Files:**
- Modify: `kapwa-server/src/referrals/referral.entity.ts`
- Modify: `kapwa-server/src/referrals/referrals.service.ts`
- Modify: `kapwa-server/src/referrals/dto/referrals.zod.ts` (accept person_id; keep embedded fields optional for back-compat)
- Modify: `kapwa-server/src/referrals/referrals.controller.ts` (registers + response)
- Modify: `kapwa-server/src/sync/sync.service.ts` (ALLOWED_COLUMNS/tableMap)
- Create: `kapwa-server/src/database/migrations/20260829000005-ReferralPersonLink.ts`
- Test: `kapwa-server/src/database/referral-wave2.spec.ts`

- [ ] **Step 1: Write failing test** — construct `Referral` with a joined `Person`; assert getters `surname`/`firstName`/`middleName`/`extension`/`gender`/`dob`/`address`/`phone` return person-derived values.

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Edit `referral.entity.ts`**

Remove the 9 embedded person @Column's (`surname:25-26`, `firstName:28-29`, `middleName:31-32`, `extension:34-35`, `gender:37-38`, `dob:40-41`, `address:43-44`, `phone:46-47`; keep `reason`, `barangay`, `status`, `coordinator_id`, `case_id`, `person_id`). Keep `personId` + `person` relation already present (`:65-70`); make it `eager` so it loads: `@ManyToOne(() => Person, { eager: true, nullable: true })`. Add getters:

```ts
@Expose() get surname(): string { return this.person?.surname ?? this._legacySurname ?? ''; }
@Expose() get firstName(): string { return this.person?.firstName ?? this._legacyFirstName ?? ''; }
@Expose() get middleName(): string | undefined { return this.person?.middleName ?? this._legacyMiddleName; }
@Expose() get extension(): string | undefined { return this.person?.extension ?? this._legacyExtension; }
@Expose() get gender(): string { return this.person?.gender ?? this._legacyGender ?? ''; }
@Expose() get dob(): string { return this.person?.dob ? new Date(this.person.dob).toISOString().split('T')[0] : this._legacyDob ?? ''; }
@Expose() get address(): Record<string, any> | undefined { return this.person?.address ? { raw: this.person.address } : this._legacyAddress; }
@Expose() get phone(): string | undefined { return this.person?.phone ?? this._legacyPhone; }
```

**Important:** Do NOT add `_legacy*` fields (they'd need columns). Instead make the create path resolve a Person and persist `personId`; the embedded fields come solely from `person`. Keep the getters mapping directly to `person`:

```ts
@Expose() get surname(): string { return this.person?.surname ?? ''; }
@Expose() get firstName(): string { return this.person?.firstName ?? ''; }
@Expose() get middleName(): string | undefined { return this.person?.middleName; }
@Expose() get extension(): string | undefined { return this.person?.extension; }
@Expose() get gender(): string { return this.person?.gender ?? ''; }
@Expose() get dob(): string { return this.person?.dob ? new Date(this.person.dob).toISOString().split('T')[0] : ''; }
@Expose() get address(): Record<string, any> | undefined { return this.person?.address ? { raw: this.person.address } : undefined; }
@Expose() get phone(): string | undefined { return this.person?.phone; }
```

- [ ] **Step 4: Rewire `referrals.service.ts` `create`** — resolve/create a `Person` from the DTO person fields (match by philsysNumber/surname+firstName+dob, else create), set `personId`, and stop spreading the embedded person fields onto the entity. Inject `Repository<Person>`.

- [ ] **Step 5: Update `dto/referrals.zod.ts`** — make embedded person fields `.optional()` (back-compat) and add `personId: z.string().uuid().optional()`. Keep `reason` required.

- [ ] **Step 6: Update controller** — ensure `findAll`/`findById`/`findMine` return the flattened shape via getters (they now load `person` eagerly; `person` relation returns getter output for embedded fields). No client-visible change.

- [ ] **Step 7: Update `sync.service.ts`** — remove embedded referral person columns from `ALLOWED_COLUMNS`; add `referrals` `person_id` handling.

- [ ] **Step 8: Create drop migration** `20260829000005-ReferralPersonLink.ts` — add FK `referrals.person_id → persons(id)` NOT VALID → VALIDATE; purge referrals with null/unmatched person first (match existing embedded data to persons during a backfill: for each referral with `person_id IS NULL` and embedded surname/first_name/dob, find-or-create a person and set `person_id`); `ALTER TABLE referrals DROP COLUMN IF EXISTS` the 8 embedded person columns (surname, first_name, middle_name, extension, gender, dob, address, phone). `down()` re-adds columns.

- [ ] **Step 9: Run tests + typecheck.**

- [ ] **Step 10: Commit.**

---

## Task 6: Agency + Program + Misc — drop contact_info/fund_sources/required_documents/agency, rewire to child tables

**Files:**
- Modify: `kapwa-server/src/agencies/agency.entity.ts`
- Modify: `kapwa-server/src/agencies/agency-contact.entity.ts` (add `@ManyToOne` Agency)
- Modify: `kapwa-server/src/agencies/agencies.module.ts`, `programs/programs.module.ts`, `access-cards/access-cards.module.ts` (register child entities)
- Modify: `kapwa-server/src/agencies/agencies.service.ts`
- Modify: `kapwa-server/src/programs/program.entity.ts`, `program-fund-source.entity.ts`, `program-required-document.entity.ts`
- Modify: `kapwa-server/src/programs/programs.service.ts`
- Modify: `kapwa-server/src/programs/dto/programs.zod.ts` (shape preserved)
- Modify: `kapwa-server/src/access-cards/access-card-service.entity.ts`, `access-cards.service.ts`, `dto/access-cards.zod.ts`, `access-cards.controller.ts`
- Modify: `kapwa-server/src/database/seed-programs.ts`
- Modify: `kapwa-server/src/sync/sync.service.ts` (ALLOWED_COLUMNS/tableMap)
- Create: `kapwa-server/src/database/migrations/20260829000006-AgencyProgramDrop.ts`
- Test: `kapwa-server/src/database/agency-program-wave2.spec.ts`

- [ ] **Step 1: Write failing test** — construct `Agency` with `contacts` child → `contactInfo` getter reassembles `{type:value}` record. Construct `Program` with `fundSources`/`requiredDocuments` children → getters reassemble `string[]` shapes.

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Entity edits**
  - `agency.entity.ts`: remove `contactInfo` (`:15-16`); add `@OneToMany(() => AgencyContact, c => c.agency, { eager:true, cascade:true }) contacts!` + getter `@Expose() get contactInfo(): Record<string,unknown> | undefined` reassembled from `contacts` (`out[type]=value`).
  - `agency-contact.entity.ts`: add `@ManyToOne(() => Agency, a => a.contacts, { onDelete:'CASCADE' }) @JoinColumn({ name:'agency_id' })`.
  - `program.entity.ts`: remove `fundSources` (`:26-27`) + `requiredDocuments` (`:23-24`); add `@OneToMany(() => ProgramFundSource, f => f.program, { eager:true, cascade:true }) fundSourceRows!` + `@OneToMany(() => ProgramRequiredDocument, d => d.program, { eager:true, cascade:true }) requiredDocumentRows!`; getters `@Expose() get fundSources(): string[] | undefined` (map `fundSourceRows.map(f=>f.name)`) and `@Expose() get requiredDocuments(): string[] | undefined` (map `requiredDocumentRows.map(d=>d.documentKey)`).
  - `program-fund-source.entity.ts`/`program-required-document.entity.ts`: add `@ManyToOne` to Program.
  - `access-card-service.entity.ts`: remove `agency` TEXT (`:20-21`).

- [ ] **Step 4: Register modules** — add `AgencyContact` to agencies.module; `ProgramFundSource, ProgramRequiredDocument` to programs.module.

- [ ] **Step 5: Rewire `agencies.service.ts` `create`** — accept `dto.contactInfo` (record) → map to `AgencyContact` child rows (one per key, `contactType=key, value=String(value), isPrimary=true`); stop setting `contactInfo` column.

- [ ] **Step 6: Rewire `programs.service.ts`** — `create`/`update` map `dto.fundSources`→`ProgramFundSource` rows and `dto.requiredDocuments`→`ProgramRequiredDocument` rows (documentKey=name, mandatory=true) via child-row upsert; stop writing `fundSources`/`requiredDocuments` columns. Keep `form_version` bump logic.

- [ ] **Step 7: Rewire access-cards `agency` drop** — remove `agency` from `access-cards.zod.ts` `LogServiceSchema` (`:10,14` refine now requires `agencyId` only), remove `agency` from `access-cards.service.ts` (`:85,87-88,95`), remove `resolveAgencyId` unused path, update controller typings (`:45,48`).

- [ ] **Step 8: Update `seed-programs.ts`** — insert child rows (program_fund_sources, program_required_documents) alongside/after the program INSERT instead of writing legacy JSONB columns.

- [ ] **Step 9: Update `sync.service.ts`** — remove `"contact_info","fund_sources","required_documents"` and `"agency"` from `ALLOWED_COLUMNS`; add the 5 child tables to tableMap.

- [ ] **Step 10: Create drop migration** `20260829000006-AgencyProgramDrop.ts` — add FKs: `agency_contacts.agency_id→agencies`, `program_fund_sources.program_id→programs`, `program_required_documents.program_id→programs`, `access_card_services.agency_id→agencies` (existing migration already added references; re-verify) each NOT VALID→VALIDATE; purge orphans; `ALTER TABLE ... DROP COLUMN IF EXISTS` `agencies.contact_info`, `programs.fund_sources`, `programs.required_documents`, `access_card_services.agency`. `down()` re-adds.

- [ ] **Step 11: Run tests + typecheck.**

- [ ] **Step 12: Commit.**

---

## Task 7: Full-wave verification

**Files:**
- Modify: `kapwa-server/src/sync/sync.service.ts` (final reconcile if needed)
- Test: none new.

- [ ] **Step 1: Run full server typecheck** — workdir `kapwa-server/`: `npm run typecheck`. Expected: PASS.

- [ ] **Step 2: Run the full server suite** — `npx jest --silent`. Expected: all suites PASS (381+ existing tests green — proves no client-visible DTO/response-shape break). Fix any failure introduced by the drop/rewire (each failure indicates a reader still on a dropped column).

- [ ] **Step 3: Run the Wave-2 spec files together** — `npx jest src/database/person-wave2.spec.ts src/database/user-wave2.spec.ts src/database/beneficiary-wave2.spec.ts src/database/case-wave2.spec.ts src/database/referral-wave2.spec.ts src/database/agency-program-wave2.spec.ts --silent`. Expected: PASS.

- [ ] **Step 4: Live-DB migration smoke (optional but recommended)** — against a scratch Postgres, run `migration:run` and confirm all `2026082900000*` migrations apply and `NOT VALID`→`VALIDATE` FK constraints succeed on the backfilled data.

- [ ] **Step 5: Commit any final reconcile** (sync module etc.) if Step 1–3 surfaced residual fixes → `git commit -m "fix(schema): wave2 residual reader reconciliation"`.

- [ ] **Step 6: Append the full-wave result to `.superpowers/sdd/progress.md`** and run the final whole-branch review across the plan base commit → HEAD.
