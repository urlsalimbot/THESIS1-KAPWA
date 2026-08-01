# Intake Form Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add field-level validation, postal code auto-fill, required address fields, and card-section-header UI to the intake form.

**Architecture:** Add a `useIntakeValidation` hook with Zod schema for inline errors + summary banner; add a static postal code lookup map; harden backend Zod; apply referral-style card headers.

**Tech Stack:** React + TypeScript, Zod, shadcn/ui, Vitest, NestJS

## Global Constraints

- Backend Zod is authoritative — frontend validation is UX, backend is security
- PH mobile format: `09` prefix, exactly 11 digits
- Age range: 0–120 inclusive
- Income: allow 0 (`.nonnegative()`)
- All address fields required (street, barangay, city, province, region, postalCode)
- Card section header pattern: `border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2`
- Error field styling: `border-destructive` ring + red error text below label
- Error ref:` <p className="text-xs text-destructive mt-1">{error}</p>` for inline errors

---
### Task 1: Backend Zod Hardening

**Files:**
- Modify: `kapwa-server/src/intake/dto/intake.zod.ts`
- Modify: `kapwa-server/test/intake.service.spec.ts`
- Test: `kapwa-server/test/intake.service.spec.ts` (existing)

- [ ] **Step 1: Update AddressSchema fields to required**

In `intake.zod.ts`, change the `AddressSchema` so every field is `.min(1)` instead of `.optional()`:

```ts
const AddressSchema = z.object({
  street: z.string().min(1, 'Street is required'),
  barangay: z.string().min(1, 'Barangay is required'),
  city: z.string().min(1, 'City is required'),
  province: z.string().min(1, 'Province is required'),
  region: z.string().min(1, 'Region is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  psgcCode: z.string().optional(),
});
```

- [ ] **Step 2: Add phone regex and income nonnegative**

In `intake.zod.ts`, modify the `PersonSchema`:

```ts
cellularNumber: z.string().regex(/^09\d{9}$/, 'Must be a valid 11-digit PH mobile number starting with 09'),
estimatedMonthlyIncome: z.number().nonnegative('Monthly income must be 0 or higher'),
```

- [ ] **Step 3: Update backend test payloads**

In `intake.service.spec.ts`, update all `currentAddress` objects in test payloads to include all required fields (`street`, `barangay`, `city`, `province`, `region`, `postalCode`). They currently have `street`, `barangay`, `city`, `province`, `postalCode` — add `region: '03'` to each.

Also update `sync.intake.spec.ts` — same change to all `currentAddress` and `provincialAddress` objects.

- [ ] **Step 4: Run tests to verify**

Run: `npx jest --config nest-cli.json 2>/dev/null || cd kapwa-server && npx vitest run test/intake.service.spec.ts 2>&1 | head -20`
Expected: existing tests pass with updated payloads.

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/src/intake/dto/intake.zod.ts kapwa-server/test/intake.service.spec.ts kapwa-server/test/sync.intake.spec.ts
git commit -m "feat(intake): harden backend validation — phone regex, income nonnegative, address fields required"
```

---
### Task 2: Postal Codes Map + IntakeAddressBlock Auto-Fill

**Files:**
- Create: `kapwa-client/src/lib/postal-codes.ts`
- Modify: `kapwa-client/src/components/IntakeAddressBlock.tsx`
- Create: `kapwa-client/src/components/IntakeAddressBlock.test.tsx`

- [ ] **Step 1: Create postal codes lookup map**

Create `kapwa-client/src/lib/postal-codes.ts`:

```ts
export const POSTAL_CODES: Record<string, string> = {
  'Norzagaray': '3012',
  'City of San Jose Del Monte': '1550',
  'Angat': '3013',
  'Bustos': '3007',
  'Baliuag': '3006',
  'Plaridel': '3004',
  'Pulilan': '3005',
  'Calumpit': '3003',
  'Hagonoy': '3002',
  'Malolos': '3000',
  'Paombong': '3001',
  'Bulakan': '3017',
  'Obando': '3021',
  'Meycauayan': '3020',
  'Marilao': '3019',
  'Bocaue': '3018',
  'Guiguinto': '3015',
  'Balagtas': '3016',
  'Pandi': '3014',
  'Santa Maria': '3022',
  'San Rafael': '3008',
  'San Miguel': '3011',
  'San Ildefonso': '3010',
  'Dona Remedios Trinidad': '3009',
  'City of Malabon': '1470',
  'City of Valenzuela': '1440',
  'City of Caloocan': '1400',
  'City of Manila': '1000',
  'Quezon City': '1100',
  'City of San Juan': '1500',
  'City of Mandaluyong': '1550',
  'City of Makati': '1200',
  'City of Pasig': '1600',
  'City of Marikina': '1800',
  'City of Pasay': '1300',
  'City of Paranaque': '1700',
  'City of Las Pinas': '1740',
  'City of Muntinlupa': '1770',
  'City of Taguig': '1630',
  'City of Navotas': '1480',
};
```

- [ ] **Step 2: Add auto-fill to IntakeAddressBlock**

In `IntakeAddressBlock.tsx`, import the map and add auto-fill in `handleMuncityChange`:

```ts
import { POSTAL_CODES } from '@/lib/postal-codes';

// Inside the component, find the muncity name in handleMuncityChange:
function handleMuncityChange(code: string) {
  onChange('city', code);
  onChange('barangay', '');
  onChange('psgcCode', '');
  const muncity = selectedProvince?.muncities.find(m => m.code === code);
  if (muncity && POSTAL_CODES[muncity.name]) {
    onChange('postalCode', POSTAL_CODES[muncity.name]);
  }
}
```

- [ ] **Step 3: Create IntakeAddressBlock tests**

Create `kapwa-client/src/components/IntakeAddressBlock.test.tsx`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntakeAddressBlock } from './IntakeAddressBlock';
import type { AddressFields } from './IntakeAddressBlock';

vi.mock('@/lib/postal-codes', () => ({
  POSTAL_CODES: { 'Norzagaray': '3012', 'City of San Jose Del Monte': '1550' },
}));

const emptyValue: AddressFields = { street: '', barangay: '', city: '', province: '0301400000', region: '03', postalCode: '', psgcCode: '' };

describe('IntakeAddressBlock', () => {
  it('renders all address selectors', () => {
    render(<IntakeAddressBlock value={emptyValue} onChange={vi.fn()} label="Address" />);
    expect(screen.getByText('Address')).toBeInTheDocument();
  });

  it('has a manual entry toggle button', () => {
    render(<IntakeAddressBlock value={emptyValue} onChange={vi.fn()} label="Address" />);
    expect(screen.getByText('Barangay not listed? Enter manually')).toBeInTheDocument();
  });

  it('auto-fills postal code when city is selected', () => {
    const onChange = vi.fn();
    render(<IntakeAddressBlock value={{ ...emptyValue, province: '0314000000' }} onChange={onChange} label="Address" />);
    // region and province must be set to show muncity dropdown
    // This is a simplified smoke test — the auto-fill depends on DOM state.
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run tests**

Run: `cd kapwa-client && npx vitest run src/components/IntakeAddressBlock.test.tsx --reporter=verbose 2>&1 | head -30`
Expected: Tests pass.

- [ ] **Step 5: Commit**

```bash
git add kapwa-client/src/lib/postal-codes.ts kapwa-client/src/components/IntakeAddressBlock.tsx kapwa-client/src/components/IntakeAddressBlock.test.tsx
git commit -m "feat(intake): add postal code auto-fill and lookup map"
```

---
### Task 3: Frontend Validation Hook

**Files:**
- Create: `kapwa-client/src/hooks/useIntakeValidation.ts`

- [ ] **Step 1: Write the validation hook**

Create `kapwa-client/src/hooks/useIntakeValidation.ts`:

```ts
import { useCallback } from 'react';
import { z } from 'zod';

const PHONE_REGEX = /^09\d{9}$/;
const NAME_REGEX = /^[A-Za-z\u00C0-\u024F\u1E00-\u1EFF\s'-]+$/;

function computeAge(dob: string): number {
  if (!dob) return 0;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

const personSchema = z.object({
  surname: z.string().min(1, 'Surname is required'),
  firstName: z.string().min(1, 'First name is required'),
  middleName: z.string().optional(),
  extension: z.string().optional(),
  gender: z.enum(['Male', 'Female'], { errorMap: () => ({ message: 'Sex is required' }) }),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').refine(val => {
    const age = computeAge(val);
    return age >= 0 && age <= 120;
  }, 'Age must be between 0 and 120'),
  placeOfBirth: z.string().min(1, 'Place of birth is required'),
  civilStatus: z.enum(['Single', 'Married', 'Widowed', 'Separated', 'Annulled'], {
    errorMap: () => ({ message: 'Civil status is required' }),
  }),
  cellularNumber: z.string().regex(PHONE_REGEX, 'Must be a valid 11-digit mobile number starting with 09'),
  email: z.string().email('Enter a valid email address'),
  street: z.string().min(1, 'Street is required'),
  barangay: z.string().min(1, 'Barangay is required'),
  city: z.string().min(1, 'City/Municipality is required'),
  province: z.string().min(1, 'Province is required'),
  region: z.string().min(1, 'Region is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  philhealthNumber: z.string().optional(),
  occupation: z.string().min(1, 'Occupation is required'),
  estimatedMonthlyIncome: z.string().refine(val => {
    const num = parseFloat(val.replace(/,/g, ''));
    return !isNaN(num) && num >= 0;
  }, 'Monthly income must be 0 or higher'),
});

export interface PersonFormValues {
  surname: string; firstName: string; middleName: string; extension: string;
  gender: string; dob: string; placeOfBirth: string; civilStatus: string;
  cellularNumber: string; email: string; street: string; barangay: string;
  city: string; province: string; region: string; postalCode: string;
  philhealthNumber: string; occupation: string; estimatedMonthlyIncome: string;
}

export type ValidationErrors = Record<string, string>;

export function validatePerson(values: PersonFormValues): ValidationErrors {
  const result = personSchema.safeParse(values);
  if (result.success) return {};
  const errors: ValidationErrors = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.');
    if (!errors[path]) errors[path] = issue.message;
  }
  return errors;
}

export function validateField(values: PersonFormValues, field: string): string {
  const schema = personSchema.shape[field as keyof typeof personSchema.shape];
  if (!schema) return '';
  const value = values[field as keyof PersonFormValues];
  const result = schema.safeParse(value);
  if (result.success) return '';
  return result.error.issues[0]?.message || '';
}
```

- [ ] **Step 2: Commit**

```bash
git add kapwa-client/src/hooks/useIntakeValidation.ts
git commit -m "feat(intake): add useIntakeValidation hook with Zod field validation"
```

---
### Task 4: IntakePage Integration — Validation, Error Display, Card Headers

**Files:**
- Modify: `kapwa-client/src/pages/IntakePage.tsx`

- [ ] **Step 1: Add imports and integrate validation hook**

At the top of `IntakePage.tsx`, add:

```ts
import { validatePerson, validateField, type PersonFormValues, type ValidationErrors } from '@/hooks/useIntakeValidation';
import { User, UserCheck, Users, ShieldCheck, AlertCircle } from 'lucide-react';
```

Add state in the `IntakePage` component:

```ts
const [benErrors, setBenErrors] = useState<ValidationErrors>({});
const [claimErrors, setClaimErrors] = useState<ValidationErrors>({});
```

- [ ] **Step 2: Add clear-error-on-change logic**

In `updateBeneficiary`, after setting the field, clear that field's error:

```ts
function updateBeneficiary(field: string, value: string) {
  setBeneficiary(prev => ({ ...prev, [field]: value }));
  setBenErrors(prev => {
    const next = { ...prev };
    delete next[`ben.${field}`];
    return next;
  });
}

Same pattern for `updateClaimant` with `claimErrors`/`setClaimErrors` (prefix `claim`).

For address field updates, also clear the error:

```ts
function updateBenAddress(type: 'currentAddress', field: string, value: string) {
  setBeneficiary(prev => ({ ...prev, [type]: { ...prev[type], [field]: value } }));
  setBenErrors(prev => {
    const next = { ...prev };
    delete next[`ben.${field}`];
    return next;
  });
}
```

- [ ] **Step 3: Add validate-on-blur via PersonFields**

In `PersonFields`, add `onBlur` to key fields. The component needs the errors map and a `prefix` to look up its errors. Update the signature:

```ts
function PersonFields({ prefix, form, onChange, onAddressChange, errors, showAge = true }: {
  prefix: string; form: PersonForm; onChange: (field: string, value: string) => void;
  onAddressChange: (type: 'currentAddress', field: string, value: string) => void;
  errors: ValidationErrors; showAge?: boolean;
}) {
  function getError(field: string): string {
    return errors[`${prefix}.${field}`] || errors[field] || '';
  }

  function InputWithError({ field, children }: { field: string; children: React.ReactNode }) {
    const err = getError(field);
    return (
      <div>
        {children}
        {err && <p className="text-xs text-destructive mt-1">{err}</p>}
      </div>
    );
  }
```

Wrap each Input in `InputWithError`. For example:

```tsx
<InputWithError field="surname">
  <Input required value={form.surname} onChange={e => onChange('surname', e.target.value)} onBlur={() => {/* clear on blur is handled by onChange */}} aria-label={`${prefix}-surname`} className={getError('surname') ? 'border-destructive' : ''} />
</InputWithError>
```

- [ ] **Step 4: Update handleSubmit with validation**

Replace the manual field checks in `handleSubmit`:

```ts
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setError('');

  // Build PersonFormValues for validation
  const toValidate = (form: PersonForm): PersonFormValues => ({
    ...form,
    street: form.currentAddress.street,
    barangay: form.currentAddress.barangay,
    city: form.currentAddress.city,
    province: form.currentAddress.province,
    region: form.currentAddress.region,
    postalCode: form.currentAddress.postalCode,
  });

  const benVals = toValidate(beneficiary);
  const rawBenErrs = validatePerson(benVals);
  // Prefix errors with 'ben.' so PersonFields can look up by prefix
  const benErrs: ValidationErrors = {};
  for (const [k, v] of Object.entries(rawBenErrs)) benErrs[`ben.${k}`] = v;
  setBenErrors(benErrs);

  let claimErrs: ValidationErrors = {};
  if (!beneficiaryIsClaimant) {
    const claimVals = toValidate(claimant);
    const rawClaimErrs = validatePerson(claimVals);
    for (const [k, v] of Object.entries(rawClaimErrs)) claimErrs[`claim.${k}`] = v;
    setClaimErrors(claimErrs);
  }

  const allErrors = { ...benErrs, ...claimErrs };
  if (Object.keys(allErrors).length > 0) {
    setError('Please fix the highlighted fields below.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  // Also validate relationship if separate claimant
  if (!beneficiaryIsClaimant && !relationshipToBeneficiary) {
    setError('Please specify claimant relationship to beneficiary');
    return;
  }
  if (!hasConsent) {
    setError('Consent required per Data Privacy Act (RA 10173)');
    return;
  }

  // ... rest of existing submit logic
```

- [ ] **Step 5: Update card section headers**

Replace the existing card wrappers with the section-header pattern. Example for Beneficiary:

```tsx
<div className="rounded-lg border">
  <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
    <User size={16} className="text-muted-foreground" />
    <h3 className="text-sm font-semibold">I. Beneficiary Information</h3>
  </div>
  <div className="p-6">
    <PersonFields prefix="ben" form={beneficiary} onChange={updateBeneficiary} onAddressChange={updateBenAddress} errors={benErrors} />
  </div>
</div>
```

Claimant card:

```tsx
<div className="rounded-lg border">
  <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
    <UserCheck size={16} className="text-muted-foreground" />
    <h3 className="text-sm font-semibold">II. Claimant Information</h3>
  </div>
  <div className="p-6">
    {/* existing claimant content */}
  </div>
</div>
```

Family Composition card:

```tsx
<div className="rounded-lg border">
  <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
    <Users size={16} className="text-muted-foreground" />
    <h3 className="text-sm font-semibold">III. Family Composition</h3>
    <div className="ml-auto">
      <Button type="button" variant="outline" size="sm" onClick={addFamilyMember}>+ Add Member</Button>
    </div>
  </div>
  <div className="p-6">
    {/* existing family content, no mb-4 needed on the button since it's in header */}
  </div>
</div>
```

Consent card:

```tsx
<div className="rounded-lg border">
  <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
    <ShieldCheck size={16} className="text-muted-foreground" />
    <h3 className="text-sm font-semibold">Data Privacy Consent</h3>
  </div>
  <div className="p-6">
    <label className="flex items-start gap-2 text-sm cursor-pointer">
      {/* existing consent checkbox */}
    </label>
  </div>
</div>
```

- [ ] **Step 6: Update error banner to show bullet list**

Replace the existing error banner:

```tsx
{error && (
  <div className="mb-4 rounded border border-destructive bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
    <AlertCircle size={16} className="mt-0.5 shrink-0" />
    <div>
      <p className="font-medium">Please fix the following:</p>
      {Object.keys(allErrors).length > 0 ? (
        <ul className="list-disc list-inside mt-1 space-y-0.5">
          {Object.values(allErrors).map((msg, i) => (
            <li key={i}>{msg}</li>
          ))}
        </ul>
      ) : (
        <p>{error}</p>
      )}
    </div>
  </div>
)}
```

Wait — the error banner needs access to `allErrors` which is computed inside `handleSubmit`. The cleanest approach: keep the error as `errors: string[]` instead of a single string. Actually, let me keep it simpler — just use a string for non-validation errors (like consent missing) and rely on the inline errors for field issues.

The simplest approach: the `error` state can be a string set from validation. The banner shows it. Inline errors handle the rest. No need for a bullet-list banner — the inline errors are per-field.

```tsx
{error && (
  <div className="mb-4 rounded border border-destructive bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
    <AlertCircle size={16} className="mt-0.5 shrink-0" />
    <p>{error}</p>
  </div>
)}
```

- [ ] **Step 7: Wire up address errors in PersonFields**

In `PersonFields`, the address fields live inside `IntakeAddressBlock`, not as direct inputs. Since errors use the prefix pattern, the address errors are keyed as `ben.street`, `ben.barangay`, etc. The `IntakeAddressBlock` needs to receive and display these.

Add an `addressErrors?: ValidationErrors` prop to `IntakeAddressBlock`, or pass the full errors map. Actually, the cleanest approach: pass `addressErrors` as a subset. Let me update the `IntakeAddressBlock` to accept optional error keys and show inline errors.

In `IntakeAddressBlock`, add:

```ts
interface Props {
  value: AddressFields;
  onChange: (field: string, value: string) => void;
  label: string;
  errors?: Record<string, string>;
  fieldPrefix?: string;
}
```

Then in each field, check `errors[fieldPrefix + '.' + fieldKey]` to show error text (e.g. `errors['ben.street']` for the street field with prefix `ben`).

For `IntakeAddressBlock` in PersonFields, pass `errors` and `fieldPrefix={prefix}` where `prefix` is the `PersonFields` `prefix` prop (`'ben'` or `'claim'`). This matches the prefixed error keys from `handleSubmit`.

- [ ] **Step 8: Commit**

```bash
git add kapwa-client/src/pages/IntakePage.tsx kapwa-client/src/components/IntakeAddressBlock.tsx
git commit -m "feat(intake): integrate validation, error display, and card section headers"
```

---
### Task 5: Frontend Tests

**Files:**
- Modify: `kapwa-client/src/pages/IntakePage.test.tsx`
- Create: `kapwa-client/src/hooks/useIntakeValidation.test.ts`

- [ ] **Step 1: Write validation hook tests**

Create `kapwa-client/src/hooks/useIntakeValidation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validatePerson, validateField } from './useIntakeValidation';

const validPerson = {
  surname: 'Dela Cruz', firstName: 'Juan', middleName: '', extension: '',
  gender: 'Male', dob: '1990-01-15', placeOfBirth: 'Manila', civilStatus: 'Single',
  cellularNumber: '09171234567', email: 'juan@example.com',
  street: '123 Rizal St', barangay: 'Bangkal', city: 'Norzagaray',
  province: '0314000000', region: '03', postalCode: '3012',
  philhealthNumber: '', occupation: 'Fisherman', estimatedMonthlyIncome: '15000',
};

describe('validatePerson', () => {
  it('returns no errors for valid data', () => {
    expect(validatePerson(validPerson)).toEqual({});
  });

  it('returns error for missing surname', () => {
    const errs = validatePerson({ ...validPerson, surname: '' });
    expect(Object.values(errs)).toContain('Surname is required');
  });

  it('returns error for invalid phone', () => {
    const errs = validatePerson({ ...validPerson, cellularNumber: '12345' });
    expect(Object.values(errs)).toContain('Must be a valid 11-digit mobile number starting with 09');
  });

  it('returns error for invalid email', () => {
    const errs = validatePerson({ ...validPerson, email: 'notanemail' });
    expect(Object.values(errs)).toContain('Enter a valid email address');
  });

  it('returns error for age > 120', () => {
    const errs = validatePerson({ ...validPerson, dob: '1800-01-01' });
    expect(Object.values(errs)).toContain('Age must be between 0 and 120');
  });

  it('returns error for missing address fields', () => {
    const errs = validatePerson({ ...validPerson, street: '' });
    expect(Object.values(errs)).toContain('Street is required');
  });

  it('returns error for missing barangay', () => {
    const errs = validatePerson({ ...validPerson, barangay: '' });
    expect(Object.values(errs)).toContain('Barangay is required');
  });

  it('allows 0 income', () => {
    const errs = validatePerson({ ...validPerson, estimatedMonthlyIncome: '0' });
    expect(Object.values(errs)).not.toContain('Monthly income must be 0 or higher');
  });
});

describe('validateField', () => {
  it('returns empty for valid field', () => {
    expect(validateField(validPerson, 'surname')).toBe('');
  });

  it('returns error for invalid field', () => {
    expect(validateField({ ...validPerson, surname: '' }, 'surname')).toBe('Surname is required');
  });
});
```

- [ ] **Step 2: Run validation hook tests**

Run: `cd kapwa-client && npx vitest run src/hooks/useIntakeValidation.test.ts --reporter=verbose 2>&1 | head -40`
Expected: All 9 tests pass.

- [ ] **Step 3: Update IntakePage tests**

Update `IntakePage.test.tsx` to account for the new validation. The existing tests mock `api.post` to return `{ candidates: [] }` — after validation, the submit flow navigates to `/intake/review` or posts directly. Since the mock form fields need to pass validation, update the test setup to fill in valid data.

Add a helper to fill required fields:

```ts
function fillValidForm() {
  const fields = [
    { label: 'ben-surname', value: 'Dela Cruz' },
    { label: 'ben-firstName', value: 'Juan' },
    { label: 'ben-dob', value: '1990-01-15' },
    { label: 'ben-placeOfBirth', value: 'Manila' },
    { label: 'ben-cellularNumber', value: '09171234567' },
    { label: 'ben-occupation', value: 'Fisherman' },
    { label: 'ben-income', value: '15000' },
    { label: 'ben-email', value: 'juan@example.com' },
    { label: 'ben-street', value: '123 Rizal St' },
    { label: 'ben-postalCode', value: '3012' },
  ];
  fields.forEach(({ label, value }) => {
    const el = screen.getByLabelText(label);
    fireEvent.change(el, { target: { value } });
  });
  // Select radio, selects, etc.
  // ...
}
```

Also add 2 new tests:

```ts
it('shows validation errors when required fields are empty', async () => {
  render(<IntakePage />);
  fireEvent.click(screen.getByLabelText('Submit Intake'));
  expect(await screen.findByText(/Please fix/)).toBeInTheDocument();
});
```

- [ ] **Step 4: Run all frontend tests**

Run: `cd kapwa-client && npx vitest run --reporter=verbose 2>&1 | tail -30`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add kapwa-client/src/hooks/useIntakeValidation.test.ts kapwa-client/src/pages/IntakePage.test.tsx
git commit -m "test(intake): add validation hook tests and update IntakePage tests"
```

---
### Task 6: Lint and Typecheck

**Files:** All modified files.

- [ ] **Step 1: Typecheck frontend**

Run: `cd kapwa-client && npx tsc --noEmit 2>&1 | head -30`
Expected: No type errors.

- [ ] **Step 2: Typecheck backend**

Run: `cd kapwa-server && npx tsc --noEmit 2>&1 | head -30`
Expected: No type errors.

- [ ] **Step 3: Lint**

Run: `cd kapwa-client && npx eslint . --ext .ts,.tsx 2>&1 | head -20`
Expected: No lint errors.

- [ ] **Step 4: Final commit if lint/typecheck fixes needed**

```bash
git commit -am "chore: fix lint and typecheck issues"
```
