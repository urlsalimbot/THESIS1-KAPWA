# Family Member Data Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Family members in the intake form must provide **gender** and **date of birth**; the server must never again create member `persons` rows with the garbage fallbacks `gender: 'Male'` / `dob: new Date()`.

**Architecture:** Mirror the existing beneficiary/claimant pattern. Client replaces the manual `Age` number input with a Sex radio + DOB date picker and derives age via the existing `computeAge` helper. Server: `FamilyMemberSchema` requires gender (`z.enum(['Male','Female'])`) and dob (`YYYY-MM-DD`, refined to age 0–120); a pure `computeAgeFromDob` helper and a `memberToPerson` mapper build the `Person` row in both the `submitIntake` and `confirmMatch` loops, deleting the fallback defaults.

**Tech Stack:** NestJS 10 + TypeORM (Jest specs), React + Vite + Vitest/Testing Library, Zod v3 (server) / v4 (client).

## Global Constraints

- `FamilyMemberSchema`: `gender` required `z.enum(['Male', 'Female'], { message: 'Sex is required' })` (note: zod v3.25.76 ignores a plain string second arg — the object form is required to get the message); `dob` required `YYYY-MM-DD` regex + `.refine()` age in [0, 120]; `age` becomes `z.number().int().min(0).optional()` (newborn age 0 must parse).
- The service member-person build must never use `gender: 'Male'` or `dob: new Date()` as fallbacks — delete both.
- Age derivation formula (identical client `computeAge` and server `computeAgeFromDob`): `age = today.getFullYear() - birth.getFullYear()`; decrement when this year's birthday has not yet occurred (`m < 0 || (m === 0 && today.getDate() < birth.getDate())`); unparseable dates → `NaN`.
- Match-check (`/intake/match-check`) family matching stays surname/firstName only — untouched.
- Existing garbage `persons` rows are NOT migrated.
- Server Zod is **v3.25.76** — use `z.enum(values, message)` two-arg form. Client Zod v4.4.3 is unused by these forms.
- Server specs run with **Jest** (`npx jest <file>`); client specs with **Vitest** (`npx vitest run <file>`). Server build check: `npm run build` (nest build). Client type check: `npx tsc --noEmit -p tsconfig.json`.

---

### Task 1: Server — `computeAgeFromDob` pure helper

**Files:**
- Create: `kapwa-server/src/intake/compute-age.ts`
- Test: `kapwa-server/src/intake/compute-age.spec.ts`

**Interfaces:**
- Produces: `computeAgeFromDob(dob: Date | string): number` — full years between `dob` and now, `NaN` for unparseable dates.

- [x] **Step 1: Write the failing test**

Create `kapwa-server/src/intake/compute-age.spec.ts`:

```ts
import { computeAgeFromDob } from './compute-age';

describe('computeAgeFromDob', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 6, 31, 12));
  });

  afterEach(() => jest.useRealTimers());

  it('computes full years on the birthday', () => {
    expect(computeAgeFromDob(new Date(2006, 6, 31))).toBe(20);
  });

  it('computes full years when the birthday has already passed this year', () => {
    expect(computeAgeFromDob(new Date(2000, 0, 15))).toBe(26);
  });

  it('decrements when this year\'s birthday has not occurred yet', () => {
    expect(computeAgeFromDob(new Date(2000, 11, 31))).toBe(25);
  });

  it('returns 0 for a newborn', () => {
    expect(computeAgeFromDob(new Date('2026-07-31'))).toBe(0);
  });

  it('returns a negative number for a future date', () => {
    expect(computeAgeFromDob(new Date('2027-01-01'))).toBe(-1);
  });

  it('returns NaN for a non-date string', () => {
    expect(computeAgeFromDob('not-a-date')).toBeNaN();
  });

  it('returns NaN for an impossible calendar date', () => {
    expect(computeAgeFromDob('2023-02-30')).toBeNaN();
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx jest src/intake/compute-age.spec.ts`
Expected: FAIL — `Cannot find module './compute-age'` (or module-not-found for the import).

- [x] **Step 3: Write the minimal implementation**

Create `kapwa-server/src/intake/compute-age.ts`:

```ts
export function computeAgeFromDob(dob: Date | string): number {
  const birth = typeof dob === 'string' ? new Date(dob) : dob;
  if (Number.isNaN(birth.getTime())) return NaN;
  if (typeof dob === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dob) && !isRealIsoDate(dob, birth)) {
    return NaN;
  }
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function isRealIsoDate(input: string, birth: Date): boolean {
  const [y, m, d] = input.split('-').map(Number);
  return birth.getUTCFullYear() === y && birth.getUTCMonth() + 1 === m && birth.getUTCDate() === d;
}
```

Note: Node rolls over impossible calendar dates (`new Date('2023-02-30')` → Mar 2), so the naive `Number.isNaN` guard is insufficient. The `isRealIsoDate` round-trip check is what makes the `'2023-02-30' → NaN` spec pass and is what Task 2's refine depends on.

- [x] **Step 4: Run the test to verify it passes**

Run: `npx jest src/intake/compute-age.spec.ts`
Expected: PASS — 7 tests, 0 failures.

- [x] **Step 5: Commit**

```bash
git add kapwa-server/src/intake/compute-age.ts kapwa-server/src/intake/compute-age.spec.ts
git commit -m "feat(intake): add computeAgeFromDob helper"
```

---

### Task 2: Server — require gender and dob on `FamilyMemberSchema`

**Files:**
- Modify: `kapwa-server/src/intake/dto/intake.zod.ts:1-45` (import + `FamilyMemberSchema`, export it and a `FamilyMemberInput` type)
- Test: `kapwa-server/src/intake/dto/intake.zod.spec.ts`

**Interfaces:**
- Consumes: `computeAgeFromDob` from `../compute-age`.
- Produces: `export const FamilyMemberSchema` and `export type FamilyMemberInput = z.infer<typeof FamilyMemberSchema>` — fields: `surname`, `firstName` (required strings), `middleName?`, `extension?` (enum), `gender` (required `'Male' | 'Female'`), `dob` (required `YYYY-MM-DD`, age 0–120), `age?` (`int().min(0)`), `relationship` (required string), `occupation?`, `income?` (`number().nonnegative()`), `status?`.

- [x] **Step 1: Write the failing test**

Create `kapwa-server/src/intake/dto/intake.zod.spec.ts`:

```ts
import { FamilyMemberSchema } from './intake.zod';

describe('FamilyMemberSchema', () => {
  const base = {
    surname: 'Dela Cruz',
    firstName: 'Maria',
    gender: 'Female',
    dob: '2015-08-10',
    relationship: 'Child',
  };

  it('accepts a member with gender, dob, and no age', () => {
    const r = FamilyMemberSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it('accepts a newborn with age 0', () => {
    const r = FamilyMemberSchema.safeParse({ ...base, dob: '2026-07-31', age: 0 });
    expect(r.success).toBe(true);
  });

  it('accepts a provided age', () => {
    const r = FamilyMemberSchema.safeParse({ ...base, age: 10 });
    expect(r.success).toBe(true);
  });

  it('rejects a missing gender', () => {
    const r = FamilyMemberSchema.safeParse({ ...base, gender: undefined });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some(i => i.message === 'Sex is required')).toBe(true);
    }
  });

  it('rejects an invalid gender', () => {
    const r = FamilyMemberSchema.safeParse({ ...base, gender: 'Other' });
    expect(r.success).toBe(false);
  });

  it('rejects a missing dob', () => {
    const r = FamilyMemberSchema.safeParse({ ...base, dob: undefined });
    expect(r.success).toBe(false);
  });

  it('rejects a wrongly formatted dob', () => {
    const r = FamilyMemberSchema.safeParse({ ...base, dob: '10/08/2015' });
    expect(r.success).toBe(false);
  });

  it('rejects an impossible calendar date', () => {
    const r = FamilyMemberSchema.safeParse({ ...base, dob: '2023-02-30' });
    expect(r.success).toBe(false);
  });

  it('rejects a dob more than 120 years ago', () => {
    const r = FamilyMemberSchema.safeParse({ ...base, dob: '1800-01-01' });
    expect(r.success).toBe(false);
  });

  it('rejects a future dob', () => {
    const r = FamilyMemberSchema.safeParse({ ...base, dob: '2999-01-01' });
    expect(r.success).toBe(false);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx jest src/intake/dto/intake.zod.spec.ts`
Expected: FAIL — `Cannot find module './intake.zod'`'s named export `FamilyMemberSchema` (undefined → TypeError on `.safeParse`).

- [x] **Step 3: Write the minimal implementation**

In `kapwa-server/src/intake/dto/intake.zod.ts`, add the import at the top (line 1):

```ts
import { computeAgeFromDob } from '../compute-age';
```

Replace the `FamilyMemberSchema` block (lines 33-45) with:

```ts
export const FamilyMemberSchema = z.object({
  surname: z.string().min(1, 'Surname is required'),
  firstName: z.string().min(1, 'First name is required'),
  middleName: z.string().optional(),
  extension: z.enum(NAME_EXTENSIONS).optional(),
  gender: z.enum(['Male', 'Female'], { message: 'Sex is required' }),
  dob: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format')
    .refine((d) => {
      const age = computeAgeFromDob(d);
      return !Number.isNaN(age) && age >= 0 && age <= 120;
    }, 'Date of birth must be a real date and at most 120 years ago'),
  age: z.number().int().min(0).optional(),
  relationship: z.string().min(1, 'Relationship is required'),
  occupation: z.string().optional(),
  income: z.number().nonnegative('Monthly income must be 0 or higher').optional(),
  status: z.string().optional(),
});
```

After the `IntakeInputSchema` definition (line 59), add:

```ts
export type FamilyMemberInput = z.infer<typeof FamilyMemberSchema>;
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npx jest src/intake/dto/intake.zod.spec.ts`
Expected: PASS — 10 tests, 0 failures.

- [x] **Step 5: Fix the existing integration spec's fixture (schema-contract ripple)**

The tracked integration spec `kapwa-server/test/intake.service.spec.ts` builds a typed `validInput: IntakeInput` whose `familyMembers[0]` lacks `gender`/`dob`. Making the schema require them breaks this fixture at compile time (TS2739). Update line 67:

```ts
      { surname: 'Dela Cruz', firstName: 'Jose', middleName: '', gender: 'Male', dob: '2015-06-15', age: 10, relationship: 'Child', occupation: 'Student' },
```

Run: `npx jest test/intake.service.spec.ts`
Expected: PASS — the suite compiles and all existing intake tests pass (the member now carries gender/dob; `age: 10` is preserved and preferred over the derived value).

- [x] **Step 6: Run the existing server test suite for regressions**

Run: `npx jest`
Expected: The 8 suites in `src/{notifications,chat,dashboard,filing,cases,sync/conflict-resolver,auth}` fail with **pre-existing** dirty-working-tree errors (e.g. AuthService gained an uncommitted `PersonRepository` dependency) — these predate this plan and are unrelated to the intake changes. The intake-related suites must pass: `compute-age.spec.ts`, `intake.zod.spec.ts`, `test/intake.service.spec.ts`. Do not attempt to fix the pre-existing failures; note them in your report.

- [x] **Step 7: Commit**

```bash
git add kapwa-server/src/intake/dto/intake.zod.ts kapwa-server/src/intake/dto/intake.zod.spec.ts kapwa-server/test/intake.service.spec.ts
git commit -m "feat(intake): require gender and dob on family members"
```

---

### Task 3: Server — `memberToPerson` mapper

**Files:**
- Create: `kapwa-server/src/intake/member-person.ts`
- Test: `kapwa-server/src/intake/member-person.spec.ts`

**Interfaces:**
- Consumes: `FamilyMemberInput` (Task 2), `computeAgeFromDob` (Task 1).
- Produces: `memberToPerson(fm: FamilyMemberInput): MemberPersonData` where

```ts
interface MemberPersonData {
  surname: string;
  firstName: string;
  middleName?: string;
  extension?: string;
  gender: 'Male' | 'Female';
  dob: Date;
  age?: number;
  occupation?: string;
  estimatedMonthlyIncome?: number;
}
```

- [x] **Step 1: Write the failing test**

Create `kapwa-server/src/intake/member-person.spec.ts`:

```ts
import { memberToPerson } from './member-person';
import type { FamilyMemberInput } from './dto/intake.zod';

describe('memberToPerson', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 6, 31, 12));
  });

  afterEach(() => jest.useRealTimers());

  const base: FamilyMemberInput = {
    surname: 'Reyes',
    firstName: 'Ana',
    gender: 'Female',
    dob: '2015-08-10',
    relationship: 'Child',
  };

  it('maps gender, parses dob, and derives age from dob when age is absent', () => {
    const p = memberToPerson(base);
    expect(p.gender).toBe('Female');
    expect(p.dob).toEqual(new Date('2015-08-10'));
    expect(p.age).toBe(10);
  });

  it('prefers a provided age over the computed one', () => {
    const p = memberToPerson({ ...base, age: 99 });
    expect(p.age).toBe(99);
  });

  it('maps income to estimatedMonthlyIncome', () => {
    const p = memberToPerson({ ...base, income: 12500 });
    expect(p.estimatedMonthlyIncome).toBe(12500);
  });

  it('never falls back to a default gender or dob', () => {
    const p = memberToPerson(base);
    expect(p.gender).not.toBe('Male');
    expect(p.dob.getTime()).not.toBe(new Date().getTime());
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx jest src/intake/member-person.spec.ts`
Expected: FAIL — `Cannot find module './member-person'`.

- [x] **Step 3: Write the minimal implementation**

Create `kapwa-server/src/intake/member-person.ts`:

```ts
import type { FamilyMemberInput } from './dto/intake.zod';
import { computeAgeFromDob } from './compute-age';

export interface MemberPersonData {
  surname: string;
  firstName: string;
  middleName?: string;
  extension?: string;
  gender: 'Male' | 'Female';
  dob: Date;
  age?: number;
  occupation?: string;
  estimatedMonthlyIncome?: number;
}

export function memberToPerson(fm: FamilyMemberInput): MemberPersonData {
  return {
    surname: fm.surname,
    firstName: fm.firstName,
    middleName: fm.middleName,
    extension: fm.extension,
    gender: fm.gender,
    dob: new Date(fm.dob),
    age: fm.age ?? computeAgeFromDob(fm.dob),
    occupation: fm.occupation,
    estimatedMonthlyIncome: fm.income,
  };
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npx jest src/intake/member-person.spec.ts`
Expected: PASS — 4 tests, 0 failures.

- [x] **Step 5: Commit**

```bash
git add kapwa-server/src/intake/member-person.ts kapwa-server/src/intake/member-person.spec.ts
git commit -m "refactor(intake): extract memberToPerson mapper"
```

---

### Task 4: Server — wire `memberToPerson` into `submitIntake` and `confirmMatch`

**Files:**
- Modify: `kapwa-server/src/intake/intake.service.ts:12` (import), `:139-150` (`submitIntake` member loop), `:350-358` (`confirmMatch` member loop)
- Test: `kapwa-server/test/intake.service.spec.ts` (append a `describe` — this tracked integration spec is the repo's existing harness for `IntakeService`, already used by Tests 1-5)

**Interfaces:**
- Consumes: `memberToPerson` (Task 3).
- Produces: both family-member loops call `this.findOrCreatePerson(memberToPerson(fm), queryRunner, deduplicate)`, preserving each loop's current flag (`false` in `submitIntake`, `true` in `confirmMatch`) — no inline object literals, no fallback defaults.

- [x] **Step 1: Write the failing test**

Append this block to `kapwa-server/test/intake.service.spec.ts`, immediately after the closing `});` of the `describe('confirmMatch', ...)` block (line ~321, before the `// Test 5` comment):

```ts
  describe('family member person build', () => {
    it('should save the member person with gender, dob, and computed age', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 6, 31, 12));

      const saveMock = mockQueryRunner.manager.save as jest.Mock;
      // save order: Person(ben), Beneficiary, Person(claimant), BeneficiaryClaimant, Household, Beneficiary(update), Person(FM), HouseholdMembership, Case, ConsentLedger
      saveMock
        .mockResolvedValueOnce({ id: 'person-uuid-1' })
        .mockResolvedValueOnce({ id: benUuid })
        .mockResolvedValueOnce({ id: claimUuid })
        .mockResolvedValueOnce({ id: bcUuid })
        .mockResolvedValueOnce({ id: hhUuid })
        .mockResolvedValueOnce({ id: benUuid, householdId: hhUuid })
        .mockResolvedValueOnce({ id: 'fm-person-1' })
        .mockResolvedValueOnce({ id: 'hm-uuid-1' })
        .mockResolvedValueOnce({ id: caseUuid })
        .mockResolvedValueOnce({ id: clUuid });

      (personRepo.create as jest.Mock).mockImplementation((data: any) => data);
      (benRepo.create as jest.Mock).mockReturnValue({});
      (hhRepo.create as jest.Mock).mockReturnValue({});
      (caseRepo.create as jest.Mock).mockReturnValue({});
      (consentRepo.create as jest.Mock).mockReturnValue({});

      try {
        await service.submitIntake({
          ...validInput,
          familyMembers: [
            { surname: 'Dela Cruz', firstName: 'Jose', gender: 'Female', dob: '2010-06-15', relationship: 'Child' },
          ],
        });

        const fmSaveCall = saveMock.mock.calls[6];
        expect(fmSaveCall[0]).toBe(Person);
        expect(fmSaveCall[1]).toMatchObject({ surname: 'Dela Cruz', firstName: 'Jose', gender: 'Female' });
        expect(fmSaveCall[1].dob).toEqual(new Date('2010-06-15'));
        expect(fmSaveCall[1].age).toBe(16);
      } finally {
        jest.useRealTimers();
      }
    });
  });
```

Notes:
- The member person save is the 7th `manager.save` call (index 6) — `findOrCreatePerson` calls `save(Person, entity)` (two args), so `fmSaveCall[1]` is the entity.
- `findOrCreatePerson` builds the save entity via `this.personRepo.create(data)`, so `personRepo.create` MUST be mocked with a pass-through `mockImplementation((data) => data)` — the happy-path boilerplate `mockReturnValue({})` would collapse the entity to `{}` and the assertions could never pass (verified by the implementer during Step 2; the other four repo mocks may stay `mockReturnValue({})` because their create results are overwritten by the save-call mocks).
- The fixture member deliberately uses `gender: 'Female'` (≠ the old `'Male'` default) and omits `age` so the derived age is what gets asserted. `dob 2010-06-15` at fake-time 2026-07-31 → full years 16.

- [x] **Step 2: Run the test to verify it fails**

Run: `npx jest test/intake.service.spec.ts`
Expected: FAIL — the new test: `fmSaveCall[1].gender` is `'Male'` (the garbage default), `fmSaveCall[1].dob` is today (fake-time 2026-07-31, the `new Date()` default), and `age` is `undefined` — so all three assertions fail. The other tests in the suite pass.

- [x] **Step 3: Write the minimal implementation**

In `kapwa-server/src/intake/intake.service.ts`:

Add the import after line 11 (the `CasesService` import):

```ts
import { memberToPerson } from './member-person';
```

Replace the inline member build in the `submitIntake` loop (lines 140-150):

```ts
          const memberPerson = await this.findOrCreatePerson(memberToPerson(fm), queryRunner, false);
```

Replace the inline member build in the `confirmMatch` loop (lines 351-358). Note: the current confirmMatch loop uses guarded fallbacks (`gender: (fm.gender || 'Male')`, `dob: fm.dob ? new Date(fm.dob) : new Date()`) — those guards are deleted because Task 2 makes `gender`/`dob` required and validated on `FamilyMemberInput`:

```ts
          const memberPerson = await this.findOrCreatePerson(memberToPerson(fm), queryRunner, true);
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npx jest test/intake.service.spec.ts`
Expected: PASS — all intake tests green, including the new family-member-person-build test.

- [x] **Step 5: Verify the server compiles**

Run: `npm run build`
Expected: SUCCESS — `nest build` exits 0.

- [x] **Step 6: Run the full server suite for regressions**

Run: `npx jest`
Expected: The 8 suites in `src/{notifications,chat,dashboard,filing,cases,sync/conflict-resolver,auth}` still fail with the **pre-existing** dirty-working-tree errors (unrelated to this plan, do not fix them). The intake-related suites must pass: `compute-age.spec.ts`, `member-person.spec.ts`, `intake.zod.spec.ts`, `test/intake.service.spec.ts`.

- [x] **Step 7: Commit**

```bash
git add kapwa-server/src/intake/intake.service.ts kapwa-server/test/intake.service.spec.ts
git commit -m "fix(intake): build member persons from validated gender and dob"
```

---

### Task 5: Client — family member card collects Sex and Date of Birth

**Files:**
- Modify: `kapwa-client/src/pages/IntakePage.tsx:30-42` (`FamilyMember` interface), `:271-282` (`addFamilyMember`), `:489-553` (family member card), `:543` (Done gate)
- Test: `kapwa-client/src/pages/IntakePage.test.tsx` (append a describe block)

**Interfaces:**
- Consumes: existing `computeAge` helper (already in `IntakePage.tsx`), existing `updateFamilyMember`.
- Produces: `FamilyMember` gains `gender: string` and `dob: string`, drops `age: number | ''`. Card renders Sex radio (`aria-label="FM gender"`, `name={`fm-${m.id}-gender`}`) and DOB date input (`aria-label="FM dob"`). No `FM age` input. Done gate requires `m.gender` and `m.dob` and rejects `dobError`. `dobError` computed per card: `m.dob && (!/^\d{4}-\d{2}-\d{2}$/.test(m.dob) || computeAge(m.dob) < 0 || computeAge(m.dob) > 120) ? 'Invalid date of birth' : ''`.

- [x] **Step 1: Write the failing tests**

Append this describe block to `kapwa-client/src/pages/IntakePage.test.tsx`:

```tsx
describe('IntakePage — family member sex and dob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queueCalls.length = 0;
    onlineStatus = true;
  });

  async function renderWithMember() {
    render(
      <MemoryRouter>
        <IntakePage />
      </MemoryRouter>
    );
    await screen.findByRole('heading', { name: /General Intake Form/i });
    fireEvent.click(screen.getByRole('button', { name: /Add Member/i }));
  }

  it('renders sex radios and a dob input, and no manual age input', async () => {
    await renderWithMember();
    expect(screen.getAllByLabelText('FM gender').length).toBe(2);
    expect(screen.getByLabelText('FM dob')).toBeInTheDocument();
    expect(screen.queryByLabelText('FM age')).not.toBeInTheDocument();
  });

  it('keeps Done disabled until gender and dob are provided', async () => {
    await renderWithMember();
    fireEvent.change(screen.getByLabelText('FM surname'), { target: { value: 'Reyes' } });
    fireEvent.change(screen.getByLabelText('FM first name'), { target: { value: 'Ana' } });
    const done = screen.getByRole('button', { name: 'Done' });
    expect(done).toBeDisabled();
    fireEvent.click(screen.getAllByLabelText('FM gender')[1]);
    expect(done).toBeDisabled();
    fireEvent.change(screen.getByLabelText('FM dob'), { target: { value: '2015-08-10' } });
    expect(done).toBeEnabled();
    fireEvent.click(done);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('blocks Done when the dob is more than 120 years ago', async () => {
    await renderWithMember();
    fireEvent.change(screen.getByLabelText('FM surname'), { target: { value: 'Reyes' } });
    fireEvent.change(screen.getByLabelText('FM first name'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getAllByLabelText('FM gender')[0]);
    fireEvent.change(screen.getByLabelText('FM dob'), { target: { value: '1800-01-01' } });
    expect(screen.getByText('Invalid date of birth')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled();
  });
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/pages/IntakePage.test.tsx`
Expected: FAIL — no element matches `FM gender`/`FM dob` (the card still renders `FM age`), and the Done gate ignores gender/dob.

- [x] **Step 3: Implement the interface and state changes**

In `kapwa-client/src/pages/IntakePage.tsx`, replace the `FamilyMember` interface (lines 30-42):

```ts
interface FamilyMember {
  id: string;
  surname: string;
  firstName: string;
  middleName: string;
  extension: string;
  gender: string;
  dob: string;
  relationship: string;
  occupation: string;
  income: string;
  status: string;
  done: boolean;
}
```

In `addFamilyMember` (lines 272-281), replace `age: '' as const,` with:

```ts
      gender: '', dob: '',
```

- [x] **Step 4: Rebuild the family member card**

Replace the whole map block (lines 489-553):

```tsx
            {family.length === 0 && <p className="text-sm text-muted-foreground italic">No family members added</p>}
            {family.map(m => {
              const dobError = m.dob && (!/^\d{4}-\d{2}-\d{2}$/.test(m.dob) || computeAge(m.dob) < 0 || computeAge(m.dob) > 120) ? 'Invalid date of birth' : '';
              return (
                <div key={m.id} className={`mb-3 rounded-lg border p-3 transition-colors ${m.done ? 'bg-green-50 border-green-300' : 'bg-muted/30'}`}>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Surname *</label>
                      <Input className="h-8 text-sm" required value={m.surname} onChange={e => updateFamilyMember(m.id, 'surname', e.target.value)} aria-label="FM surname" disabled={m.done} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">First Name *</label>
                      <Input className="h-8 text-sm" required value={m.firstName} onChange={e => updateFamilyMember(m.id, 'firstName', e.target.value)} aria-label="FM first name" disabled={m.done} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Middle Name</label>
                      <Input className="h-8 text-sm" value={m.middleName} onChange={e => updateFamilyMember(m.id, 'middleName', e.target.value)} aria-label="FM middle name" disabled={m.done} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Ext</label>
                      <select className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={m.extension} onChange={e => updateFamilyMember(m.id, 'extension', e.target.value)} aria-label="FM extension" disabled={m.done}>
                        {NAME_EXTENSIONS.map(e => <option key={e} value={e === 'N/A' ? '' : e}>{e}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Sex *</label>
                      <div className="flex gap-3 h-8 items-center">
                        {(['Male', 'Female'] as const).map(s => (
                          <label key={s} className="flex items-center gap-1 text-sm cursor-pointer">
                            <input type="radio" name={`fm-${m.id}-gender`} value={s} checked={m.gender === s} onChange={() => updateFamilyMember(m.id, 'gender', s)} aria-label="FM gender" disabled={m.done} />
                            {s}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Date of Birth *</label>
                      <Input type="date" className="h-8 text-sm" required value={m.dob} onChange={e => updateFamilyMember(m.id, 'dob', e.target.value)} aria-label="FM dob" disabled={m.done} />
                      {dobError && <p className="text-xs text-destructive mt-1">{dobError}</p>}
                      {!dobError && m.dob && <p className="text-xs text-muted-foreground mt-1">Age: {computeAge(m.dob)}</p>}
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Relationship *</label>
                      <select className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={m.relationship} onChange={e => updateFamilyMember(m.id, 'relationship', e.target.value)} aria-label="FM relationship" disabled={m.done}>
                        {['Spouse','Child','Parent','Sibling','Grandparent','Other'].map(r => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Occupation</label>
                      <Input className="h-8 text-sm" value={m.occupation} onChange={e => updateFamilyMember(m.id, 'occupation', e.target.value)} aria-label="FM occupation" disabled={m.done} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Status *</label>
                      <select className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={m.status} onChange={e => updateFamilyMember(m.id, 'status', e.target.value)} aria-label="FM status" disabled={m.done}>
                        {FAMILY_MEMBER_STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Monthly Income</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₱</span>
                        <Input type="text" inputMode="numeric" className="h-8 text-sm pl-5" value={m.income} onChange={e => updateFamilyMember(m.id, 'income', e.target.value.replace(/\D/g, ''))} onBlur={e => { const v = e.target.value; if (v) updateFamilyMember(m.id, 'income', formatMoney(v)); }} aria-label="FM income" disabled={m.done} />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant={m.done ? 'secondary' : 'default'} size="sm" onClick={() => toggleDone(m.id)} disabled={!m.done && (!m.surname || !m.firstName || !m.gender || !m.dob || !!dobError || !m.relationship || !m.status)} className="h-8 gap-1">
                      <Check size={14} />
                      {m.done ? 'Edit' : 'Done'}
                    </Button>
                    {!m.done && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeFamilyMember(m.id)} className="text-destructive h-8">Remove</Button>
                    )}
                  </div>
                </div>
              );
            })}
```

- [x] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/pages/IntakePage.test.tsx`
Expected: PASS — existing tests + 3 new tests, 0 failures.

- [x] **Step 6: Type-check the client**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: SUCCESS — exit 0 (no references to the removed `age` field remain; if the payload map in `handleSubmit` still reads `f.age`, this task's type-check fails here and Task 6 fixes it — proceed to Task 6 before re-running).

- [x] **Step 7: Commit**

```bash
git add kapwa-client/src/pages/IntakePage.tsx kapwa-client/src/pages/IntakePage.test.tsx
git commit -m "feat(intake): collect sex and date of birth on family members"
```

---

### Task 6: Client — submit gender, dob, and computed age in the payload

**Files:**
- Modify: `kapwa-client/src/pages/IntakePage.tsx:367-377` (`handleSubmit` familyMembers map)
- Test: `kapwa-client/src/pages/IntakePage.test.tsx` (append one test to the new describe block)

**Interfaces:**
- Consumes: `computeAge` (existing), FamilyMember `gender`/`dob` state (Task 5).
- Produces: `intakePayload.familyMembers[]` items gain `gender`, `dob`, and `age: computeAge(f.dob)` (computed, no longer `f.age || 0`).

- [x] **Step 1: Write the failing test**

Append to the `describe('IntakePage — family member sex and dob')` block in `kapwa-client/src/pages/IntakePage.test.tsx` (before its closing `});`):

```tsx
  it('submits gender, dob, and computed age for each member', async () => {
    render(
      <MemoryRouter>
        <IntakePage />
      </MemoryRouter>
    );
    await screen.findByRole('heading', { name: /General Intake Form/i });
    fireEvent.click(screen.getByRole('checkbox', { name: /Beneficiary is claimant/i }));

    fireEvent.change(screen.getByLabelText('ben-surname'), { target: { value: 'Dela Cruz' } });
    fireEvent.change(screen.getByLabelText('ben-firstName'), { target: { value: 'Juan' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Male' }));
    fireEvent.change(screen.getByLabelText('ben-dob'), { target: { value: '1990-01-15' } });
    fireEvent.change(screen.getByLabelText('ben-placeOfBirth'), { target: { value: 'Manila' } });
    fireEvent.change(screen.getByLabelText('ben-civilStatus'), { target: { value: 'Single' } });
    fireEvent.change(screen.getByLabelText('ben-cellularNumber'), { target: { value: '09171234567' } });
    fireEvent.change(screen.getByLabelText('ben-email'), { target: { value: 'juan@example.com' } });
    fireEvent.click(screen.getByText('Barangay not listed? Enter manually'));
    fireEvent.change(screen.getByLabelText('Address Street'), { target: { value: '123 Rizal St' } });
    fireEvent.change(screen.getByLabelText('Address Barangay'), { target: { value: 'Bangkal' } });
    fireEvent.change(screen.getByLabelText('Address City'), { target: { value: 'Norzagaray' } });
    fireEvent.change(screen.getByLabelText('Address Postal Code'), { target: { value: '3012' } });
    fireEvent.change(screen.getByLabelText('ben-occupation'), { target: { value: 'Fisherman' } });
    fireEvent.change(screen.getByLabelText('ben-income'), { target: { value: '15000' } });

    fireEvent.click(screen.getByRole('button', { name: /Add Member/i }));
    fireEvent.change(screen.getByLabelText('FM surname'), { target: { value: 'Reyes' } });
    fireEvent.change(screen.getByLabelText('FM first name'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getAllByLabelText('FM gender')[1]);
    const today = new Date().toLocaleDateString('en-CA');
    fireEvent.change(screen.getByLabelText('FM dob'), { target: { value: today } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    fireEvent.click(screen.getByRole('checkbox', { name: /consent/i }));
    const form = screen.getByRole('button', { name: /Submit Intake/i }).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const intakeCall = (api.post as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: unknown[]) => call[0] === '/intake',
    );
    expect(intakeCall).toBeDefined();
    expect(intakeCall?.[1].familyMembers[0]).toMatchObject({
      gender: 'Female',
      dob: today,
      age: 0,
    });
  });
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/pages/IntakePage.test.tsx -t "submits gender"`
Expected: FAIL — payload item lacks `gender`/`dob` and sends `age: f.age || 0`.

- [x] **Step 3: Implement the payload change**

In `kapwa-client/src/pages/IntakePage.tsx`, replace the familyMembers map (lines 367-377):

```ts
      familyMembers: family.filter(m => m.surname.trim()).map(f => ({
        surname: f.surname,
        firstName: f.firstName,
        middleName: f.middleName || undefined,
        extension: f.extension || undefined,
        gender: f.gender,
        dob: f.dob,
        age: computeAge(f.dob),
        relationship: f.relationship,
        occupation: f.occupation,
        income: f.income ? parseFloat(f.income.replace(/,/g, '')) : undefined,
        status: f.status || undefined,
      })),
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/pages/IntakePage.test.tsx`
Expected: PASS — full file green, 0 failures.

- [x] **Step 5: Type-check the client**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: SUCCESS — exit 0.

- [x] **Step 6: Commit**

```bash
git add kapwa-client/src/pages/IntakePage.tsx kapwa-client/src/pages/IntakePage.test.tsx
git commit -m "feat(intake): submit family member gender, dob, and computed age"
```

---

### Task 7: End-to-end verification (Playwright + full suites)

**Files:** none (verification only).

**Interfaces:**
- Consumes: Tasks 1-6 shipped changes on both apps.

- [x] **Step 1: Run the full server suite**

Run: `npx jest`
Actual: `Test Suites: 7 failed, 24 passed, 31 total; Tests: 53 failed, 179 passed, 232 total`. The 7 failing suites (`notifications`, `chat`, `dashboard`, `filing`, `cases`, `sync/conflict-resolver`, `auth`) are the **pre-existing** dirty-working-tree failures documented in Tasks 2-4 (AuthService `PersonRepository` dependency drift, etc.) — identical set/count at every task checkpoint, no regressions. All intake suites green.

- [x] **Step 2: Run the full client suite**

Run: `npm run test:run`
Actual: `Test Files: 12 failed, 53 passed (65); Tests: 25 failed, 327 passed (352)`. The 12 failing suites are **pre-existing** (verified at HEAD baseline by Task 5's implementer: ErrorBoundary, PageShell, SyncQueuePanel, auth-context, AdminPage, ApprovalPipelinePage, BeneficiariesPage, CaseTrackerPage, CasesPage, CoordinatorDashboardPage, DashboardPage, SettingsPage). `IntakePage.test.tsx` fully green (10 tests).

- [x] **Step 3: Restart both apps (API :3000, client :3001, DB container `kapwa-db-dev`) and verify live flows with Playwright**

All verified live against the restarted API (rebuild + `node dist/main`) and Vite client, with Playwright browser automation:
- Case `KAPWA-2026-00007`: member Angela, Sex Female, DOB 2015-08-10 → `persons` row has `gender='Female'`, `dob='2015-08-10'`, `age=10` (derived). ✓
- Done stays disabled when Sex/DOB empty; enables with both; re-disables when DOB cleared (screenshot `fm-card-negative-empty-sex-dob.png`). ✓
- Direct API POST to `/intake` with a family member missing gender/dob → HTTP 400, Zod errors `gender: "Sex is required"`, `dob: "Required"` (also verified dob-only and gender-only variants). ✓
- Multi-member regression (case `KAPWA-2026-00009`): members Rica (F, 2010-04-12 → 16) and Dindo (M, 1955-09-30 → 70) plus claimant — all `persons` rows correct; `submitIntake` + `confirmMatch` idempotency + info-merge confirmed. ✓

- [x] **Step 4: Commit any verification fixes**

Verification exposed no bugs — nothing to commit. Feature complete.
