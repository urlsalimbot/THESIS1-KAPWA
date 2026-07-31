# Family Member Data Hardening — Require Gender and Date of Birth

Relates to: `2026-07-30-intake-form-hardening-design.md` (family-member validation gap)

## Problem

Family members in the intake form (`IntakePage.tsx`) only require **surname, first name, manual age number, relationship, and status**. They collect no `gender` or `dob`. Because the server's member-person builder uses fallback defaults, the database gets garbage Person records:

- `gender: (fm.gender || 'Male')` — every member without a sex is stored as Male
- `dob: fm.dob ? new Date(fm.dob) : new Date()` — a member without a birth date is stored with **today's date** (age 0)

This defeats the `persons` table's purpose: members are persons too, and every other person (beneficiary, claimant) has real identity data.

## Scope Decision

Minimal hardening, per user choice: add **gender** and **date of birth** to family members only. No phone/email/address/PhilHealth expansion. Age becomes **computed from DOB** (replaces the manual age number input), mirroring the beneficiary/claimant section.

## Approach

Approach A: mirror the existing beneficiary/claimant `PersonFields` pattern for the two new fields (radio Sex + date-picker DOB with computed age). Rejected: reusing the full `PersonFields` component for members (heavier than the minimal scope).

## Design

### 1. Client — Family member card (`kapwa-client/src/pages/IntakePage.tsx`)

**State** — `FamilyMember` interface: replace `age: number | ''` with:

```ts
gender: string;
dob: string;
```

Age is derived on demand via the existing `computeAge(dob)` helper (already in the file).

**Card layout** (two grids):

- Row 1: Surname * / First Name * / Middle Name / Ext / **Sex** (radio `Male`/`Female`, `name={`fm-${m.id}-gender`}`, `aria-label="FM gender"`)
- Row 2: **Date of Birth** * (`<Input type="date">`, `aria-label="FM dob"`) / Relationship * / Occupation / Status * / Income

The manual `Age` number input is removed.

**Done gate** (`toggleDone` disabled condition) becomes:

```ts
!m.surname || !m.firstName || !m.gender || !m.dob || !m.relationship || !m.status
```

**Inline DOB validation** — computed on the card (no per-member error state needed):

```ts
const dobError = m.dob && (!/^\d{4}-\d{2}-\d{2}$/.test(m.dob) || computeAge(m.dob) < 0 || computeAge(m.dob) > 120)
  ? 'Invalid date of birth' : '';
```

Shown as `p.text-xs.text-destructive` under the DOB input. Done is disabled while `dobError` is set.

**Submit payload** (`handleSubmit` familyMembers map): add

```ts
gender: m.gender,
dob: m.dob,
age: computeAge(m.dob),
```

### 2. Server — Schema (`kapwa-server/src/intake/dto/intake.zod.ts`)

`FamilyMemberSchema`:

| Field | Current | New |
|-------|---------|-----|
| gender | optional | `z.enum(['Male', 'Female'], 'Sex is required')` |
| dob | optional | required `YYYY-MM-DD` + age 0–120 refine |
| age | `z.number().int().positive()` | optional — server derives from dob (allows newborn age 0) |

### 3. Server — Member person build (`kapwa-server/src/intake/intake.service.ts`)

Both the `submitIntake` family-member loop and the `confirmMatch` family-member loop change:

```ts
gender: (fm.gender || 'Male') as 'Male' | 'Female',   // →  gender: fm.gender as 'Male' | 'Female'
dob: fm.dob ? new Date(fm.dob) : new Date(),           // →  dob: new Date(fm.dob)
age: fm.age,                                           // →  age: fm.age ?? computeAgeFromDob(fm.dob)
```

Values are guaranteed by the schema; the garbage defaults are deleted. When `fm.age` is absent, the server computes full years between `dob` and today (same formula as the client's `computeAge`: subtract birth year, then decrement if this year's birthday has not occurred yet).

## Edge Cases

- **Newborn member (age 0)**: valid — `age` is optional/derived, no `.positive()` constraint.
- **Existing garbage records** (default Male / dob=today): left untouched. Noted, not migrated.
- **Match-check** (`/intake/match-check`) family matching uses surname/firstName only — unchanged.
- **Dedup merge** added in `findOrCreatePerson` continues to merge provided fields; gender/dob now always present.

## Testing

- Playwright: fill a complete FM card (gender + DOB) → case created; person row in `persons` has correct gender/dob/computed age.
- Playwright: a member missing gender or DOB → Done disabled client-side; direct API POST without gender/dob → 400 with clear Zod error.
- Server build/watch: `npm run start:dev` compile clean.
- Re-run the multi-member intake scenarios (Reyes/Garcia) to confirm no regression.
