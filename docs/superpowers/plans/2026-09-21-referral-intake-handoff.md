# Referral → Intake Handoff and Referral Name Schema — Implementation Plan

> **For agentic workers:** This plan is task-ordered and each task ends with a verification
> step. Use the `- [ ]` checkboxes to track progress. Several tasks change behaviour that
> existing tests assert — update the test **in the same task** as the behaviour change, not
> in a later cleanup pass.

> **Execution status — 2026-09-21:** Tasks 1–9 implemented and committed on
> `feat/referral-intake-handoff`. Task 10 Steps 1–3 verified: server typecheck + build +
> 70 suites / 570 tests, client typecheck + build + 110 files / 638 tests, and no migration
> or `migrate.ts` change (the feature is migration-free by design). Re-verified after merging
> `main` in.
>
> **Task 10 Step 4 (manual end-to-end) is NOT done.** It needs a live Postgres and writes real
> referral/intake data, so it is left for the operator. Steps are listed at the end of this
> document.
>
> Three contract corrections were discovered during implementation and folded back into
> Tasks 1–3: `Referral.address` could not change shape, `InterAgencyReferral.person` had to
> stay serialized, and inter-agency statuses have no `accepted` state.

**Goal:** Accepting a barangay referral, or receiving an inter-agency referral addressed to
MSWDO, hands the worker off to the Intake form pre-filled from the referral. The case is
created by the intake and linked back to the referral atomically. Every referral payload
exposes the `persons` name schema (surname / first name / middle name / extension).

**Architecture:** `accept` becomes a status change only. A new optional `sourceReferral` on
the intake payload drives an in-transaction link from the intake service to the referral
row it came from. The link is written with `queryRunner.manager` inside the intake's
existing transaction, so a case can never exist without its referral link. Referral name
fields are exposed via `@Expose()` getters reading the joined `Person`, matching the Wave-2
trio already used by `Referral`. Client-side, a shared prefill helper in `referral-utils.tsx`
builds the route state for both entry points.

**Tech Stack:** NestJS 11 + TypeORM + Postgres (server), React 19 + Vite + SWR + Tailwind/Radix
+ i18next (client), zod DTOs with `ZodPipe`, jest + vitest.

**Spec:** `docs/superpowers/specs/2026-09-21-referral-intake-handoff-design.md`

## Deviation from the spec (deliberate, review this)

Spec §4.3 proposed giving both referral services a `linkCase` method, called by the intake
service after commit, with `IntakeModule` importing the two referral modules.

The plan instead writes the link **inside the intake transaction** with
`queryRunner.manager`, via one private `linkSourceReferral` helper. Reasons:

1. **It is actually atomic.** A post-commit call can fail after the case exists, leaving a
   case with no referral link and a referral stuck displaying "intake pending" forever.
   The spec's stated intent was "so the two can never get out of sync".
2. **No module coupling.** It needs two entity imports, not two module imports, so there is
   no import graph change and no chance of a future cycle.
3. The tolerance rules ("unknown or already-linked referral must not fail the intake, log
   and continue") are preserved — they just log inside the transaction instead of after.

Everything else in the spec is implemented as written.

## Global Constraints

- **No database migration.** Do **not** create a file in `src/database/migrations/` and do
  **not** touch `src/database/migrate.ts`. Every column this plan needs already exists
  (`referrals.case_id`, `inter_agency_referrals.case_id`, `person_addresses.barangay`).
  Adding a migration here would break the spec's D5 decision.
- Entities extend `BaseEntity` and use snake_case `name:` on every column.
- **Wave-2 serialization trio** for any `@Expose()` getter: the getter itself, `@Exclude()`
  on the eager child relation it reads, and `ClassSerializerInterceptor` +
  `SerializeOptions({ strategy: 'exposeAll' })` on the controller. Both referral controllers
  already carry the interceptor and options — do not remove them.
- `persons.age` is a getter, not a column. Compute age from `dob`.
- Server tests: `npx jest --silent` (never `npm test`). Typecheck: `npm run typecheck`.
- Client tests: `npm run test:run` from `kapwa-client/`. Typecheck: `npm run typecheck`.
- **i18n:** every new key must exist in **both** `kapwa-client/src/i18n/locales/en/index.ts`
  and `fil/index.ts`. `src/i18n/__tests__/fil-parity.test.ts` enforces: fil mirrors en
  key-for-key; no fil value equals its English value unless listed in `ALLOWED_IDENTICAL`;
  no value is empty or contains literal HTML; placeholders match key-for-key. Write genuinely
  different Filipino strings — do not reach for the allowlist.
- **zod constraints the prefill must respect** (`intake.zod.ts`): `extension` is
  `z.enum(['N/A','Jr.','Sr.','II','III','IV'])`; `cellularNumber` is `/^09\d{9}$/`;
  `currentAddress.street` and `.barangay` are `min(1)`. Never prefill a value that the form
  cannot submit.
- Stage explicit paths when committing (never `git add -A`); conventional commit messages;
  never commit secrets.

---

### Task 1: Referral name schema + address getters (server)

**Files:**
- Modify: `kapwa-server/src/inter-agency-referrals/inter-agency-referral.entity.ts`
- Modify: `kapwa-server/src/referrals/referral.entity.ts`

**Interfaces:**
- Consumes: `Person.address` / `Person.currentAddress` / `Person.phone` getters (already exist).
- Produces: both referral payloads expose `surname`, `firstName`, `middleName`, `extension`,
  `gender`, `dob` (`YYYY-MM-DD`), `phone`, plus the address trio — `address` and
  `currentAddress` (structured `{ barangay?, city?, province? }`) and `addressLine` (raw
  display string). Both payloads keep their existing `person` relation — pinned by
  `agency-program-wave2.spec.ts` and read by the agency portal — so the getters are purely
  additive. `Referral.address` keeps its existing object shape. Task 5's prefill helper
  consumes exactly these field names.

- [ ] **Step 1: Add the getters and exclude `person` on `InterAgencyReferral`**

Import `Expose` from `class-transformer`, then add the block after the `person` relation.
Leave the relation itself unmarked — see the note below the block.

```ts
  @ManyToOne(() => Person, { nullable: true })
  @JoinColumn({ name: 'person_id' })
  person?: Person;

  // --- Identity surface, assembled from the joined Person ------------------
  // Mirrors Referral so both referral payloads carry the persons name schema
  // (surname / first name / middle name / extension) rather than a flat name.
  // Getters need explicit @Expose(): exposeAll covers own enumerable
  // properties, not prototype accessors.
  @Expose() get surname(): string { return this.person?.surname ?? ''; }
  @Expose() get firstName(): string { return this.person?.firstName ?? ''; }
  @Expose() get middleName(): string | undefined { return this.person?.middleName; }
  @Expose() get extension(): string | undefined { return this.person?.extension; }
  @Expose() get gender(): string { return this.person?.gender ?? ''; }
  @Expose() get dob(): string {
    const d = this.person?.dob;
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  // Structured (mirrors Referral's pinned shape) and the raw display string.
  @Expose() get address(): Record<string, string> | undefined {
    return this.person?.currentAddress;
  }
  @Expose() get currentAddress(): Record<string, string> | undefined {
    return this.person?.currentAddress;
  }
  @Expose() get addressLine(): string | undefined { return this.person?.address; }
  @Expose() get phone(): string | undefined { return this.person?.phone; }
```

Do **not** add `@Exclude()` to `person`. `agency-program-wave2.spec.ts` (lines 145–149)
asserts the relation stays serialized with `person.surname` / `person.phone` present and only
the PII children (`addresses`, `roles`, `contacts`) absent, and the agency portal reads
`person.surname` / `person.firstName` directly. The new getters are additive; removing
`person` would be a breaking API change this feature does not need.

- [ ] **Step 2: Add the raw-backed `addressLine` — do NOT change `address`**

`referral-wave2.spec.ts` (line 38) asserts `referral.address` returns an object with
`.barangay`, so its shape is a pinned contract. Leave it alone and add the display string
plus an explicit structured alias beside it:

```ts
  // `address` above stays the structured object (pinned by referral-wave2.spec).
  // `addressLine` is the raw-backed display string; `currentAddress` is the same
  // structured shape under an explicit name so both referral payloads read alike.
  @Expose() get addressLine(): string | undefined { return this.person?.address; }
  @Expose() get currentAddress(): Record<string, string> | undefined {
    return this.person?.currentAddress;
  }
```

Give `InterAgencyReferral` the same three (already in Step 1 above), and on `Referral` add
only the two new getters — its `address` is unchanged.

- [ ] **Step 3: Confirm the existing specs still pass unchanged**

```bash
cd kapwa-server && npx jest referral-wave2 --silent
```

Expected: pass with no edits. If this fails, the `address` contract was changed by mistake —
restore it and use `addressLine` for the display string instead.

- [ ] **Step 4: Verify**

```bash
cd kapwa-server && npm run typecheck && npx jest referral-wave2 inter-agency-referrals --silent
```

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/src/inter-agency-referrals/inter-agency-referral.entity.ts \
        kapwa-server/src/referrals/referral.entity.ts
git commit -m "fix(referrals): expose person name schema on both referral payloads"
```

---

### Task 2: Referral address write path (server)

**Files:**
- Modify: `kapwa-server/src/referrals/referrals.service.ts` (`resolveOrCreatePerson`)
- Modify: `kapwa-server/src/referrals/referrals.service.spec.ts`

**Interfaces:**
- Consumes: `person_addresses.barangay` (existing column).
- Produces: newly created referral persons have a structured `barangay`, so
  `Person.currentAddress` — and therefore `referral.currentAddress` — resolves. Task 5's
  prefill reads it.

- [ ] **Step 1: Populate the structured barangay alongside `raw`**

Replace the address block in `resolveOrCreatePerson`:

```ts
    if (dto.address) {
      const raw = typeof dto.address === 'string'
        ? dto.address
        : Object.values(dto.address).filter(Boolean).join(', ');
      // Also set the structured barangay: Person.currentAddress requires at
      // least one of barangay/city/province, and the referral → intake prefill
      // needs a structured barangay to populate the intake address block.
      // There is no `street` column, so street stays inside `raw`.
      const structured =
        typeof dto.address === 'object' && dto.address !== null
          ? (dto.address as Record<string, unknown>).barangay
          : undefined;
      (person as any).addresses = [{
        personId: undefined,
        addressType: 'current',
        raw,
        barangay: typeof structured === 'string' && structured ? structured : undefined,
        isPrimary: true,
      }];
    }
```

- [ ] **Step 2: Add a spec case**

In `referrals.service.spec.ts`, add to the `create`/`resolveOrCreatePerson` coverage:

```ts
it('stores a structured barangay alongside the raw address string', async () => {
  // create a referral with address: { street: '123 Mabini St', barangay: 'Poblacion' }
  // expect the saved Person's addresses[0] to include
  //   raw: '123 Mabini St, Poblacion'  and  barangay: 'Poblacion'
});
```

- [ ] **Step 3: Verify**

```bash
cd kapwa-server && npx jest referrals --silent
```

- [ ] **Step 4: Commit**

```bash
git add kapwa-server/src/referrals/referrals.service.ts kapwa-server/src/referrals/referrals.service.spec.ts
git commit -m "fix(referrals): store structured barangay so referral address resolves"
```

---

### Task 3: `accept` becomes status-only (server)

**Files:**
- Modify: `kapwa-server/src/referrals/referrals.service.ts`
- Modify: `kapwa-server/src/referrals/referrals.controller.ts`
- Modify: `kapwa-server/src/referrals/referrals.service.spec.ts`

**Interfaces:**
- Produces: `ReferralsService.accept(id: string): Promise<Referral>` — no case is created.
  The case comes from the intake (Task 4) and is linked back there.

- [ ] **Step 1: Reduce `accept` to a status change**

```ts
  async accept(id: string): Promise<Referral> {
    const referral = await this.findById(id);
    if (referral.status !== ReferralStatus.PENDING) {
      throw new ForbiddenException('Referral is not in pending status');
    }
    // Status only: the case is created by the intake this hands off to and
    // linked back by IntakeService.linkSourceReferral. Creating one here would
    // produce a second case per accepted referral.
    referral.status = ReferralStatus.ACCEPTED;
    await this.repo.save(referral);
    return this.findById(id);
  }
```

- [ ] **Step 2: Drop the dependencies `accept` used to own**

Remove the `@InjectRepository(Beneficiary) private benRepo` and
`private casesService: CasesService` constructor parameters and their imports — after Step 1
they are unused, and `npm run lint` flags unused constructor parameter properties. Leave
`personRepo` (used by `resolveOrCreatePerson`) and `repo`.

- [ ] **Step 3: Update the controller call**

`@Patch(':id/accept')` passes `req.user!.id`; the method no longer takes an actor. Change to:

```ts
  async accept(@Param('id') id: string) {
    return this.svc.accept(id);
  }
```

- [ ] **Step 4: Rewrite the accept spec**

In `referrals.service.spec.ts`, the existing case *"creates a beneficiary (when missing) and a
case, then links and accepts"* asserts removed behaviour. Replace it with:

```ts
it('accepts without creating a case', async () => {
  repoMock.findOne.mockResolvedValue(pendingReferral());
  repoMock.save.mockResolvedValue({ ...pendingReferral(), status: ReferralStatus.ACCEPTED });
  const result = await service.accept('ref-1');
  expect(repoMock.save).toHaveBeenCalledWith(
    expect.objectContaining({ status: 'accepted' }),
  );
  expect((result as any).caseId).toBeUndefined();
});
```

Keep the existing "not in pending status" rejection test, and the existing
"accepts without creating a case when the referral has no linked person" test (it is now
redundant with the new one — merge it rather than leaving both).

- [ ] **Step 5: Verify**

```bash
cd kapwa-server && npm run typecheck && npx jest referrals --silent
```

- [ ] **Step 6: Commit**

```bash
git add kapwa-server/src/referrals/referrals.service.ts \
        kapwa-server/src/referrals/referrals.controller.ts \
        kapwa-server/src/referrals/referrals.service.spec.ts
git commit -m "refactor(referrals): accept flips status only, case comes from intake"
```

---

### Task 4: Atomic referral↔case link on intake (server)

**Files:**
- Modify: `kapwa-server/src/intake/dto/intake.zod.ts`
- Modify: `kapwa-server/src/intake/intake.service.ts`
- Modify: `kapwa-server/src/intake/intake.service.spec.ts` (create if absent)

**Interfaces:**
- Consumes: `Referral` / `InterAgencyReferral` entities (Task 1, Task 3 statuses).
- Produces: `IntakeInput.sourceReferral?: { type: 'barangay' | 'inter_agency'; id: string }`.
  When present and the intake yields a case, the referral's `caseId` is set in the same
  transaction. The rule is exactly: **link iff the intake's result carries a case id.**

- [ ] **Step 1: Extend the intake schema**

In `intake.zod.ts`:

```ts
export const SourceReferralSchema = z.object({
  type: z.enum(['barangay', 'inter_agency']),
  id: z.string().uuid(),
});
```

and add to `IntakeInputSchema` after `renewalOfCaseId`:

```ts
  sourceReferral: SourceReferralSchema.optional(),
```

- [ ] **Step 2: Add the linking helper to `IntakeService`**

Add imports: `EntityManager` from `typeorm`, `Referral` from `../referrals/referral.entity`,
`InterAgencyReferral` from `../inter-agency-referrals/inter-agency-referral.entity`.

```ts
  /**
   * Attach the case produced by this intake to the referral that handed off to
   * it. Runs inside the caller's transaction, so a case can never be committed
   * without its referral link.
   *
   * An unknown, not-yet-accepted, or differently-linked referral is logged and
   * skipped: the intake is the primary operation and the link is bookkeeping.
   */
  private async linkSourceReferral(
    manager: EntityManager,
    sourceReferral: IntakeInput['sourceReferral'],
    caseId: string | undefined,
  ): Promise<void> {
    if (!sourceReferral || !caseId) return;
    const { type, id } = sourceReferral;

    if (type === 'barangay') {
      const referral = await manager.findOne(Referral, { where: { id } });
      if (!referral) {
        this.logger.warn(`Intake ${caseId}: barangay referral ${id} not found; link skipped`);
        return;
      }
      if (referral.status !== ReferralStatus.ACCEPTED) {
        this.logger.warn(
          `Intake ${caseId}: barangay referral ${id} is "${referral.status}", not accepted; link skipped`,
        );
        return;
      }
      if (referral.caseId && referral.caseId !== caseId) {
        this.logger.warn(
          `Intake ${caseId}: barangay referral ${id} already linked to ${referral.caseId}; link skipped`,
        );
        return;
      }
      await manager.update(Referral, id, { caseId });
      return;
    }

    const referral = await manager.findOne(InterAgencyReferral, { where: { id } });
    if (!referral) {
      this.logger.warn(`Intake ${caseId}: inter-agency referral ${id} not found; link skipped`);
      return;
    }
    if (referral.status !== 'received') {
      this.logger.warn(
        `Intake ${caseId}: inter-agency referral ${id} is "${referral.status}", not received; link skipped`,
      );
      return;
    }
    if (referral.caseId && referral.caseId !== caseId) {
      this.logger.warn(
        `Intake ${caseId}: inter-agency referral ${id} already linked to ${referral.caseId}; link skipped`,
      );
      return;
    }
    await manager.update(InterAgencyReferral, id, { caseId });
  }
```

Add the `ReferralStatus` import: `import { ReferralStatus } from '../referrals/referral.entity';`
(combine with the `Referral` import).

- [ ] **Step 3: Call it before every commit that yields a case**

There are exactly three such commit points. Place the call immediately before each
`await queryRunner.commitTransaction();`.

`submitIntake` — early reuse branch, immediately before the commit at ~line 260:

```ts
          await this.linkSourceReferral(queryRunner.manager, data.sourceReferral, recentCase.id);
          await queryRunner.commitTransaction();
```

`submitIntake` — normal branch, immediately before the commit at ~line 365:

```ts
      await this.linkSourceReferral(queryRunner.manager, data.sourceReferral, savedCase.id);

      await queryRunner.commitTransaction();
```

`confirmMatch` — immediately before the commit at ~line 689. `savedCase` is `null` when a
recent case already existed, which correctly links nothing:

```ts
      await this.linkSourceReferral(queryRunner.manager, data.sourceReferral, savedCase?.id ?? undefined);

      await queryRunner.commitTransaction();
```

- [ ] **Step 4: Add intake specs**

Cover, with a mocked `queryRunner.manager`:

```ts
it('links the referral to the created case inside the transaction', ...);
it('does not fail the intake when the referral is unknown', ...);
it('does not overwrite an existing link to a different case', ...);
it('links nothing when confirmMatch reuses a recent case', ...);
```

- [ ] **Step 5: Verify**

```bash
cd kapwa-server && npm run typecheck && npx jest intake --silent
npx jest --silent
```

- [ ] **Step 6: Commit**

```bash
git add kapwa-server/src/intake/dto/intake.zod.ts \
        kapwa-server/src/intake/intake.service.ts \
        kapwa-server/src/intake/intake.service.spec.ts
git commit -m "feat(intake): link source referral to the created case atomically"
```

---

### Task 5: Client referral helpers — prefill + display names

**Files:**
- Modify: `kapwa-client/src/components/referrals/referral-utils.tsx`
- Modify: `kapwa-client/src/components/referrals/referral-utils.test.tsx` (create if absent)

**Interfaces:**
- Produces for Tasks 7–9:
  - `referralListName(p)` → `"Dela Cruz Jr., Juan Miguel"`
  - `referralFullName(p)` → `"Juan Miguel Dela Cruz Jr."`
  - `referralPrefill(src)` → `{ prefill, reason }` where `prefill` matches the intake
    prefill keys (`surname`, `firstName`, `middleName`, `extension`, `gender`, `dob`,
    `cellularNumber`, `currentAddress: { street, barangay }`)
  - `referralIntakeState(type, src)` → the `{ prefill, sourceReferral }` route state, shared
    by all three handoff call sites so the payload cannot drift between entry points
  - `InterAgencyReferral` gains `middleName`, `extension`, `gender`, `dob`, `address`,
    `currentAddress`, `addressLine`, `phone`, `caseId`.

- [ ] **Step 1: Extend `InterAgencyReferral`**

```ts
export interface InterAgencyReferral {
  id: string;
  personId: string;
  caseId?: string | null;
  case?: { controlNo?: string };
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
  // Identity surface (Task 1). `person` remains for backward compatibility.
  surname?: string;
  firstName?: string;
  middleName?: string;
  extension?: string;
  gender?: string;
  dob?: string;
  /** Structured address, mirrors Referral's pinned shape. */
  address?: Record<string, string>;
  currentAddress?: Record<string, string>;
  /** Raw-backed display string; the only place street is stored. */
  addressLine?: string;
  phone?: string;
  createdAt: string;
}
```

- [ ] **Step 2: Add the display-name helpers**

```tsx
export interface NameParts {
  surname?: string;
  firstName?: string;
  middleName?: string;
  extension?: string;
}

/** "Dela Cruz Jr., Juan Miguel" — table and dialog form. */
export function referralListName(p?: NameParts | null): string {
  if (!p) return '';
  const surname = [p.surname, p.extension].filter(Boolean).join(' ');
  const given = [p.firstName, p.middleName].filter(Boolean).join(' ');
  return [surname, given].filter(Boolean).join(', ');
}

/** "Juan Miguel Dela Cruz Jr." — inline sentence form. */
export function referralFullName(p?: NameParts | null): string {
  if (!p) return '';
  return [p.firstName, p.middleName, p.surname, p.extension].filter(Boolean).join(' ');
}
```

- [ ] **Step 3: Add the prefill builder**

```tsx
const NAME_EXTENSIONS = ['N/A', 'Jr.', 'Sr.', 'II', 'III', 'IV'];
const PH_MOBILE = /^09\d{9}$/;

export interface ReferralPrefillSource extends NameParts {
  gender?: string;
  dob?: string;
  phone?: string;
  /** Structured address as exposed on both referral payloads. */
  address?: Record<string, string>;
  currentAddress?: Record<string, string>;
  /** Raw-backed display string; the only place street is stored. */
  addressLine?: string;
  reason?: string;
}

/**
 * Build the Intake route state from a referral payload.
 *
 * Only values the intake will actually accept are emitted: the server validates
 * `extension` against a fixed list and `cellularNumber` against /^09\d{9}$/, so
 * a free-text referral value that does not match is dropped rather than
 * pre-filling an input the worker cannot submit.
 */
export function referralPrefill(src: ReferralPrefillSource) {
  const barangay = src.currentAddress?.barangay ?? src.address?.barangay ?? '';
  const rawAddress = src.addressLine ?? '';
  // `person_addresses` has no street column: street only exists inside the
  // comma-joined raw string, and only trust it when we also have a structured
  // barangay to anchor it to.
  const street = barangay && rawAddress ? rawAddress.split(',')[0].trim() : '';
  const phoneDigits = (src.phone ?? '').replace(/\D/g, '');

  return {
    prefill: {
      surname: src.surname ?? '',
      firstName: src.firstName ?? '',
      middleName: src.middleName ?? '',
      extension: NAME_EXTENSIONS.includes(src.extension ?? '') ? src.extension : '',
      gender: src.gender ?? '',
      dob: src.dob ?? '',
      cellularNumber: PH_MOBILE.test(phoneDigits) ? phoneDigits : '',
      currentAddress: { street, barangay },
    },
    reason: src.reason ?? '',
  };
}
```

- [ ] **Step 4: Add the shared route-state builder**

```tsx
/**
 * Route state for handing a referral off to the intake form. All three call
 * sites (worker list, review page, inter-agency detail) use this, so the
 * payload cannot drift between entry points.
 */
export function referralIntakeState(
  type: 'barangay' | 'inter_agency',
  src: { id: string } & ReferralPrefillSource,
) {
  const { prefill, reason } = referralPrefill(src);
  return { prefill, sourceReferral: { type, id: src.id, reason } };
}
```

- [ ] **Step 5: Spec the helpers**

```ts
it('builds the list name with middle name and extension', ...); // "Dela Cruz Jr., Juan Miguel"
it('drops a phone that is not a valid 09XXXXXXXXX', ...);
it('drops an extension outside the intake enum', ...);
it('leaves street blank when there is no structured barangay', ...);
it('referralIntakeState carries type, id and reason', ...);
```

- [ ] **Step 6: Verify**

```bash
cd kapwa-client && npm run typecheck && npm run test:run -- referral-utils
```

- [ ] **Step 7: Commit**

```bash
git add kapwa-client/src/components/referrals/referral-utils.tsx \
        kapwa-client/src/components/referrals/referral-utils.test.tsx
git commit -m "feat(referrals): add shared prefill and display-name helpers"
```

---

### Task 6: i18n keys (en + fil)

**Files:**
- Modify: `kapwa-client/src/i18n/locales/en/index.ts`
- Modify: `kapwa-client/src/i18n/locales/fil/index.ts`

**Interfaces:**
- Produces keys consumed by Tasks 7–9. Insert alphabetically within the `referral`, `intake`
  and `agency` namespaces, matching each file's comma style (en keeps a trailing comma on the
  last property; fil omits it).

- [ ] **Step 1: Add the English keys**

| Key | en |
|-----|-----|
| `referral.intakePending` | `Intake pending` |
| `referral.awaitingIntake` | `Awaiting intake` |
| `referral.awaitingIntakeDesc` | `Accepted referrals that still need an intake and a case.` |
| `referral.continueIntake` | `Continue intake` |
| `referral.continueIntakeAria` | `Continue intake for {{name}}` |
| `intake.fromReferral` | `From referral: {{reason}}` |

- [ ] **Step 2: Add distinct Filipino values (never identical to English)**

| Key | fil |
|-----|-----|
| `referral.intakePending` | `Nakabinbin ang intake` |
| `referral.awaitingIntake` | `Naghihintay ng intake` |
| `referral.awaitingIntakeDesc` | `Mga tinanggap na referral na kailangan pa ng intake at kaso.` |
| `referral.continueIntake` | `Ipagpatuloy ang intake` |
| `referral.continueIntakeAria` | `Ipagpatuloy ang intake para kay {{name}}` |
| `intake.fromReferral` | `Mula sa referral: {{reason}}` |

- [ ] **Step 3: Verify**

```bash
cd kapwa-client && npm run test:run -- fil-parity && npm run typecheck
```

`fil-parity` fails if a key is missing from either file, if a fil value equals its English
value outside `ALLOWED_IDENTICAL`, or if placeholders differ.

- [ ] **Step 4: Commit**

```bash
git add kapwa-client/src/i18n/locales/en/index.ts kapwa-client/src/i18n/locales/fil/index.ts
git commit -m "i18n(referrals): add intake handoff and pending-state strings"
```

---

### Task 7: Intake page — prefill extension, address, and source referral

**Files:**
- Modify: `kapwa-client/src/pages/IntakePage.tsx`
- Modify: `kapwa-client/src/pages/IntakePage.test.tsx`

**Interfaces:**
- Consumes: `Task 4`'s `sourceReferral` payload field; `Task 5`'s prefill key names.
- Produces: `intakePayload.sourceReferral`; the prefill effect now applies `extension` and
  `currentAddress`.

- [ ] **Step 1: Extend the prefill effect**

The effect currently sets identity fields but ignores `extension` and `currentAddress`.
Add `extension`, and merge the address instead of replacing it so the Norzagaray PSGC
defaults in `emptyAddress` survive:

```tsx
      const address = prefill.currentAddress as Record<string, string> | undefined;
      setBeneficiary(prev => ({
        ...prev,
        // ...existing fields unchanged...
        extension: prefill.extension ?? prev.extension,
        currentAddress: {
          ...prev.currentAddress,
          // Only assign non-empty values: the intake validates street and
          // barangay as min(1), and blanking the defaults gains nothing.
          ...(address?.street ? { street: address.street } : {}),
          ...(address?.barangay ? { barangay: address.barangay } : {}),
        },
      }));
```

- [ ] **Step 2: Carry `sourceReferral` into the payload**

Read it from route state next to `renewalOfCaseId` and add it to `intakePayload`:

```tsx
    const sourceReferral = (location.state as {
      sourceReferral?: { type: 'barangay' | 'inter_agency'; id: string; reason?: string };
    })?.sourceReferral;

    const intakePayload = {
      // ...unchanged...
      renewalOfCaseId: (location.state as { renewalOfCaseId?: string })?.renewalOfCaseId || undefined,
      sourceReferral: sourceReferral
        ? { type: sourceReferral.type, id: sourceReferral.id }
        : undefined,
      case: sourceReferral?.reason ? { serviceRequested: [sourceReferral.reason] } : {},
    };
```

Note the reason deliberately travels inside `case.serviceRequested` (an existing slot) rather
than inside `sourceReferral`, so no unvalidated field reaches the server DTO.

Because `IntakeReviewPage` posts the same `intakeData` object, no change is needed there —
but confirm by reading both `api.post` calls in `IntakeReviewPage.tsx` (they pass `intakeData`).

- [ ] **Step 3: Show where the intake came from**

Extend the existing prefill banner block:

```tsx
      {(location.state as { sourceReferral?: { reason?: string } })?.sourceReferral?.reason && (
        <div className="mb-4 rounded border border-accent/20 bg-accent/5 p-3 text-sm text-accent">
          {t('intake.fromReferral', 'From referral: {{reason}}', {
            reason: (location.state as { sourceReferral?: { reason?: string } }).sourceReferral!.reason,
          })}
        </div>
      )}
```

- [ ] **Step 4: Spec it**

```ts
it('applies extension and address from prefill', ...);
it('includes sourceReferral in the submitted payload', ...);
```

- [ ] **Step 5: Verify**

```bash
cd kapwa-client && npm run typecheck && npm run test:run -- IntakePage
```

- [ ] **Step 6: Commit**

```bash
git add kapwa-client/src/pages/IntakePage.tsx kapwa-client/src/pages/IntakePage.test.tsx
git commit -m "feat(intake): prefill extension and address, carry source referral"
```

---

### Task 8: Barangay accept → intake, plus the awaiting-intake queue

**Files:**
- Modify: `kapwa-server/src/referrals/referrals.service.ts` (`findAll`)
- Modify: `kapwa-server/src/referrals/referrals.controller.ts` (`findAll` query)
- Modify: `kapwa-client/src/pages/ReferralsPage.tsx`
- Modify: `kapwa-client/src/pages/ReferralsPage.test.tsx`
- Modify: `kapwa-client/src/pages/ReferralReviewPage.tsx`

**Interfaces:**
- Consumes: `referralPrefill` / `referralListName` (Task 5), `sourceReferral` (Task 7).
- Produces: `GET /referrals?intakePending=true` → accepted referrals with `case_id IS NULL`.

- [ ] **Step 1: Server filter**

In `findAll`, accept `intakePending?: boolean` and add:

```ts
    if (options?.intakePending) {
      qb.andWhere('r.status = :accepted', { accepted: ReferralStatus.ACCEPTED })
        .andWhere('r.case_id IS NULL');
    }
```

In the controller's `@Get()` add `@Query('intakePending') intakePending?: string` and pass
`intakePending: intakePending === 'true'`.

- [ ] **Step 2: Extend the client `Referral` type**

Add `personId?: string;` and `caseId?: string | null;` to the local `Referral` interface, then
switch the name column and dialog to `referralListName(row.original)` and
`referralListName(selected)` so the middle name stops being dropped.

- [ ] **Step 3: Accept hands off to intake — BOTH accept paths**

There are **two** barangay accept paths with byte-identical logic: `ReferralsPage.tsx` and
`ReferralReviewPage.tsx`. Both PATCH `/referrals/:id/accept` and both must hand off, or one of
them keeps accepting referrals into a case-less limbo with no intake.

```tsx
  async function handleAccept(id: string) {
    setActionId(id);
    try {
      const accepted = await api.patch<Referral>(`/referrals/${id}/accept`, {});
      setReferrals(prev => prev.filter(r => r.id !== id));
      toast.success(t('referral.accepted', 'Referral accepted'));

      if (accepted?.personId) {
        navigate('/intake', { state: referralIntakeState('barangay', accepted) });
      }
      // No linked person: nothing to prefill, stay on the list with the toast.
    } catch {
      toast.error(t('referral.acceptFailed', 'Failed to accept referral'));
    }
    setActionId(null);
  }
```

`ReferralReviewPage` needs `useNavigate` imported if it is not already.

- [ ] **Step 4: Add the awaiting-intake section**

Load `api.get<Referral[]>('/referrals?intakePending=true')` alongside the existing pending
load, render it as its own section using the existing `SectionHeader` / `EmptyReferrals`
components with `referral.awaitingIntake` / `referral.awaitingIntakeDesc`, and give each row a
**Continue intake** button that rebuilds the same route state:

```tsx
  function resumeIntake(r: Referral) {
    navigate('/intake', { state: referralIntakeState('barangay', r) });
  }
```

Reuse the `variantMap.accepted` badge treatment and add a small
`referral.intakePending` badge on rows where `!r.caseId`.

- [ ] **Step 5: Spec it**

`ReferralsPage.test.tsx` exists. `ReferralReviewPage` has **no** test file yet — create
`ReferralReviewPage.test.tsx`, mocking `useNavigate` the same way `ReferralsPage.test.tsx`
does.

```ts
it('navigates to intake with prefill after accepting', ...);
it('stays on the list when the referral has no linked person', ...);
it('offers continue-intake for accepted referrals without a case', ...);
it('ReferralReviewPage navigates to intake after accepting', ...);
```

- [ ] **Step 6: Verify**

```bash
cd kapwa-server && npx jest referrals --silent
cd ../kapwa-client && npm run typecheck && npm run test:run -- ReferralsPage ReferralReviewPage
```

- [ ] **Step 7: Commit**

```bash
git add kapwa-server/src/referrals/referrals.service.ts \
        kapwa-server/src/referrals/referrals.controller.ts \
        kapwa-client/src/pages/ReferralsPage.tsx \
        kapwa-client/src/pages/ReferralsPage.test.tsx
git commit -m "feat(referrals): accepting a barangay referral opens pre-filled intake"
```

---

### Task 9: Inter-agency receive → intake (MSWDO only)

**Files:**
- Modify: `kapwa-client/src/pages/AgencyReferralDetailPage.tsx`
- Modify: `kapwa-client/src/pages/AgencyReferralDetailPage.test.tsx`
- Modify: `kapwa-client/src/components/referrals/IncomingInterAgencyReferrals.tsx`
- Modify: `kapwa-client/src/pages/AgencyReferralsPage.tsx`

**Interfaces:**
- Consumes: `referralPrefill` / `referralListName` (Task 5), `toAgency.code` (already in the payload).

- [ ] **Step 1: Redirect on receive when MSWDO is the receiver**

```tsx
  async function transition(transitionId: string, action: string, body?: Record<string, string>) {
    try {
      await api.patch(`/inter-agency-referrals/${transitionId}/${action}`, body);
      if (id) await mutate(queryKeys.interAgencyReferrals.detail(id));

      // Only MSWDO runs an intake; an external receiving agency keeps the
      // plain receive-and-refresh behaviour.
      if (action === 'receive' && data?.toAgency?.code === 'MSWDO' && data.personId) {
        navigate('/intake', { state: referralIntakeState('inter_agency', data) });
      }
    } catch (err: any) {
      toast.error(t('agency.transitionFailed', 'Could not update this referral'), {
        description: humanizeError(err),
      });
    }
  }
```

- [ ] **Step 2: Fix the dropped middle name**

In `IncomingInterAgencyReferrals.tsx` replace both `r.person ? \`${r.person.firstName} ${r.person.surname}\``
expressions with `referralListName(r)`, and in `AgencyReferralsPage.tsx` apply the same helper
wherever a person name is rendered.

- [ ] **Step 3: Intake-pending indicator**

Where the status badge renders in the detail page and both agency lists, add the
`referral.intakePending` badge when
`(status === 'received' || status === 'accepted') && !caseId`.

- [ ] **Step 4: Spec it**

```ts
it('navigates to intake after receive when the receiving agency is MSWDO', ...);
it('does not navigate when the receiving agency is not MSWDO', ...);
it('renders the middle name in the incoming list', ...);
```

- [ ] **Step 5: Verify**

```bash
cd kapwa-client && npm run typecheck && npm run test:run -- AgencyReferral
```

- [ ] **Step 6: Commit**

```bash
git add kapwa-client/src/pages/AgencyReferralDetailPage.tsx \
        kapwa-client/src/pages/AgencyReferralDetailPage.test.tsx \
        kapwa-client/src/components/referrals/IncomingInterAgencyReferrals.tsx \
        kapwa-client/src/pages/AgencyReferralsPage.tsx
git commit -m "feat(referrals): MSWDO receive opens pre-filled intake"
```

---

### Task 10: Full verification sweep

**Files:** none (verification only).

- [ ] **Step 1: Server**

```bash
cd kapwa-server && npm run typecheck && npx jest --silent
```

Expected: all suites pass. The only intentionally changed test is the `accept` spec (Task 3).

- [ ] **Step 2: Client**

```bash
cd kapwa-client && npm run typecheck && npm run test:run
```

Expected: 108+ files pass, including `fil-parity`.

- [ ] **Step 3: Confirm no migration was added**

```bash
git status --short kapwa-server/src/database
```

Expected: empty. If anything appears, revert it — this feature is migration-free by design.

- [ ] **Step 4: Manual end-to-end (disposable Postgres + dev servers)**

1. As a coordinator, create a referral for a new person (surname, first name, middle name,
   gender, DOB, phone, street, barangay).
2. As a social worker, open `/referrals`, accept it. Expect: redirect to `/intake` with the
   name, gender, DOB, phone, street and barangay filled, and a "From referral" banner showing
   the reason.
3. Complete the intake with a new case. Expect: navigation to the case; the referral no longer
   appears in "Awaiting intake".
4. Re-run the same flow but close the tab after accepting. Expect: the referral appears under
   "Awaiting intake" with a working **Continue intake** button.
5. As an agency user (e.g. RHU), receive a referral addressed to RHU. Expect: no redirect.
6. Receive a referral addressed to MSWDO. Expect: redirect to the pre-filled intake.

- [ ] **Step 5: Final commit (if Steps 1–4 produced fixes)**

```bash
git add <explicit paths>
git commit -m "fix(referrals): address verification findings"
```

## Out of scope — do not do these

- No migration, no `migrate.ts` change, no backfill of existing raw addresses.
- No `agency_staff` access to `/intake`.
- No change to decline / action / close / promote-to-case / batch-family flows.
- No change to the referral creation forms or create DTOs — they already use the name schema.
