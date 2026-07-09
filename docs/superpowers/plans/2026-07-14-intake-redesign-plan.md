# Intake Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the GIS Intake form to capture Personal Information + Family Composition, redirect to case page, and add Assessment + Services sections on the case view page.

**Architecture:** Two-step flow: (1) Intake form creates Beneficiary + Household + FamilyMembers + Case, redirects to `/cases/:id`. (2) CaseViewPage gets editable Section III (Assessment) + IV (Recommended Services). Backend entities get new columns via migration, frontend form uses structured JSONB for addresses.

**Tech Stack:** NestJS + TypeORM + PostgreSQL backend, React + SWR + shadcn/ui frontend.

## Global Constraints

- All Zod schemas use `zod` v4.x-compatible syntax
- Backend entity column names use snake_case `@Column({ name: 'column_name' })`
- Frontend API calls go through `api.ts` client which prepends `VITE_API_URL`
- SWR mutations not used for assessment save — plain `api.patch()` + manual `mutate()` instead (same pattern as NotificationsDropdown fix)
- `e.stopPropagation()` on interactive popover elements
- Form inputs use shadcn `Input`, `Button`, `select` classes from existing patterns

---

### Task 1: Backend migration — add new columns

**Files:**
- Create: `kapwa-server/src/database/migrations/20260714000003-AddIntakeFields.ts`
- Modify: `kapwa-server/src/database/migrate.ts`

**Interfaces:**
- Consumes: existing entity decorator patterns
- Produces: DB schema with new columns

- [ ] **Step 1: Create migration file**

```typescript
// kapwa-server/src/database/migrations/20260714000003-AddIntakeFields.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIntakeFields2026071400003 implements MigrationInterface {
  name = 'AddIntakeFields2026071400003';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Beneficiary new fields
    await queryRunner.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS place_of_birth TEXT`);
    await queryRunner.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS civil_status TEXT`);
    await queryRunner.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS current_address JSONB`);
    await queryRunner.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS provincial_address JSONB`);
    await queryRunner.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS philhealth_number TEXT`);
    await queryRunner.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS occupation TEXT`);
    await queryRunner.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS estimated_monthly_income DECIMAL(12,2)`);
    await queryRunner.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS age INTEGER`);

    // FamilyMember: add occupation, drop status_income
    await queryRunner.query(`ALTER TABLE family_members ADD COLUMN IF NOT EXISTS occupation TEXT`);
    await queryRunner.query(`ALTER TABLE family_members DROP COLUMN IF EXISTS status_income`);

    // Case new fields (Assessment + Services)
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS problems_presented TEXT`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS social_worker_assessment TEXT`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS client_category TEXT`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS nature_of_service TEXT[]`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS financial_subsidies JSONB`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS amount_assistance DECIMAL(12,2)`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS mode_financial_assistance TEXT`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS source_of_fund TEXT`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS legislator_specify TEXT`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS other_assistance JSONB`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS interviewed_by TEXT`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS client_signature TEXT`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE beneficiaries DROP COLUMN IF EXISTS place_of_birth`);
    await queryRunner.query(`ALTER TABLE beneficiaries DROP COLUMN IF EXISTS civil_status`);
    await queryRunner.query(`ALTER TABLE beneficiaries DROP COLUMN IF EXISTS current_address`);
    await queryRunner.query(`ALTER TABLE beneficiaries DROP COLUMN IF EXISTS provincial_address`);
    await queryRunner.query(`ALTER TABLE beneficiaries DROP COLUMN IF EXISTS philhealth_number`);
    await queryRunner.query(`ALTER TABLE beneficiaries DROP COLUMN IF EXISTS occupation`);
    await queryRunner.query(`ALTER TABLE beneficiaries DROP COLUMN IF EXISTS estimated_monthly_income`);
    await queryRunner.query(`ALTER TABLE beneficiaries DROP COLUMN IF EXISTS age`);
    await queryRunner.query(`ALTER TABLE family_members ADD COLUMN IF NOT EXISTS status_income TEXT`);
    await queryRunner.query(`ALTER TABLE family_members DROP COLUMN IF EXISTS occupation`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS problems_presented`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS social_worker_assessment`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS client_category`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS nature_of_service`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS financial_subsidies`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS amount_assistance`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS mode_financial_assistance`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS source_of_fund`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS legislator_specify`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS other_assistance`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS interviewed_by`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS client_signature`);
  }
}
```

- [ ] **Step 2: Update migrate.ts**

In `kapwa-server/src/database/migrate.ts`, add the new columns after the existing `beneficiaries` table creation, after the `family_members` table creation, and after the `cases` table creation:

```typescript
// Inside migrate(), after `CREATE TABLE IF NOT EXISTS beneficiaries` block:
await q.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS place_of_birth TEXT`);
await q.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS civil_status TEXT`);
await q.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS current_address JSONB`);
await q.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS provincial_address JSONB`);
await q.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS philhealth_number TEXT`);
await q.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS occupation TEXT`);
await q.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS estimated_monthly_income DECIMAL(12,2)`);
await q.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS age INTEGER`);

// After `CREATE TABLE IF NOT EXISTS family_members` block:
await q.query(`ALTER TABLE family_members ADD COLUMN IF NOT EXISTS occupation TEXT`);

// After `CREATE TABLE IF NOT EXISTS cases` block:
await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS problems_presented TEXT`);
await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS social_worker_assessment TEXT`);
await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS client_category TEXT`);
await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS nature_of_service TEXT[]`);
await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS financial_subsidies JSONB`);
await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS amount_assistance DECIMAL(12,2)`);
await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS mode_financial_assistance TEXT`);
await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS source_of_fund TEXT`);
await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS legislator_specify TEXT`);
await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS other_assistance JSONB`);
await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS interviewed_by TEXT`);
await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS client_signature TEXT`);
```

- [ ] **Step 3: Run migration against dev DB**

```bash
PGPASSWORD=kapwa psql -h localhost -U kapwa -d kapwa -c "$(cat kapwa-server/src/database/migrations/20260714000003-AddIntakeFields.ts | grep 'ALTER TABLE' | sed 's/await queryRunner.query(\`//' | sed 's/\`);//')"
```

Or migrate via TypeORM if configured. Quick way:

```bash
# Run the ALTER statements directly from the migration file
PGPASSWORD=kapwa psql -h localhost -U kapwa -d kapwa <<EOF
ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS place_of_birth TEXT;
ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS civil_status TEXT;
ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS current_address JSONB;
ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS provincial_address JSONB;
ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS philhealth_number TEXT;
ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS occupation TEXT;
ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS estimated_monthly_income DECIMAL(12,2);
ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS occupation TEXT;
ALTER TABLE family_members DROP COLUMN IF EXISTS status_income;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS problems_presented TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS social_worker_assessment TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS client_category TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS nature_of_service TEXT[];
ALTER TABLE cases ADD COLUMN IF NOT EXISTS financial_subsidies JSONB;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS amount_assistance DECIMAL(12,2);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS mode_financial_assistance TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS source_of_fund TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS legislator_specify TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS other_assistance JSONB;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS interviewed_by TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS client_signature TEXT;
EOF
```

---

### Task 2: Update backend entities

**Files:**
- Modify: `kapwa-server/src/beneficiaries/beneficiary.entity.ts`
- Modify: `kapwa-server/src/beneficiaries/family-member.entity.ts`
- Modify: `kapwa-server/src/cases/case.entity.ts`

**Interfaces:**
- Consumes: migration Task 1 (columns exist in DB)
- Produces: entity classes with new fields for intake service and case assessment

- [ ] **Step 1: Add new fields to Beneficiary entity**

Add after line 49 (`category` column):

```typescript
  @Column({ name: 'place_of_birth', nullable: true })
  placeOfBirth?: string;

  @Column({ name: 'civil_status', nullable: true })
  civilStatus?: string;

  @Column({ name: 'current_address', type: 'jsonb', nullable: true })
  currentAddress?: Record<string, string>;

  @Column({ name: 'provincial_address', type: 'jsonb', nullable: true })
  provincialAddress?: Record<string, string>;

  @Column({ name: 'philhealth_number', nullable: true })
  philhealthNumber?: string;

  @Column({ name: 'occupation', nullable: true })
  occupation?: string;

  @Column({ name: 'estimated_monthly_income', type: 'decimal', precision: 12, scale: 2, nullable: true })
  estimatedMonthlyIncome?: number;

  @Column({ name: 'age', nullable: true })
  age?: number;
```

- [ ] **Step 2: Replace statusIncome with occupation in FamilyMember entity**

Replace line 21-22:

```typescript
  @Column({ name: 'status_income', nullable: true })
  statusIncome?: string;
```

With:

```typescript
  @Column({ name: 'occupation', nullable: true })
  occupation?: string;
```

- [ ] **Step 3: Add assessment + services fields to Case entity**

Add before line 51 (`@CreateDateColumn`):

```typescript
  @Column({ name: 'problems_presented', nullable: true, type: 'text' })
  problemsPresented?: string;

  @Column({ name: 'social_worker_assessment', nullable: true, type: 'text' })
  socialWorkerAssessment?: string;

  @Column({ name: 'client_category', nullable: true })
  clientCategory?: string;

  @Column('text', { name: 'nature_of_service', array: true, nullable: true })
  natureOfService?: string[];

  @Column({ name: 'financial_subsidies', type: 'jsonb', nullable: true })
  financialSubsidies?: Record<string, unknown>;

  @Column({ name: 'amount_assistance', type: 'decimal', precision: 12, scale: 2, nullable: true })
  amountAssistance?: number;

  @Column({ name: 'mode_financial_assistance', nullable: true })
  modeFinancialAssistance?: string;

  @Column({ name: 'source_of_fund', nullable: true })
  sourceOfFund?: string;

  @Column({ name: 'legislator_specify', nullable: true })
  legislatorSpecify?: string;

  @Column({ name: 'other_assistance', type: 'jsonb', nullable: true })
  otherAssistance?: Record<string, unknown>;

  @Column({ name: 'interviewed_by', nullable: true })
  interviewedBy?: string;

  @Column({ name: 'client_signature', nullable: true, type: 'text' })
  clientSignature?: string;
```

---

### Task 3: Update backend intake DTO + service

**Files:**
- Modify: `kapwa-server/src/intake/dto/intake.zod.ts`
- Modify: `kapwa-server/src/intake/intake.service.ts`

**Interfaces:**
- Consumes: updated entities from Task 2
- Produces: `POST /intake` accepts new fields, creates Beneficiary with new columns

- [ ] **Step 1: Update IntakeInputSchema**

```typescript
// kapwa-server/src/intake/dto/intake.zod.ts
import { z } from 'zod';

const AddressSchema = z.object({
  street: z.string().optional(),
  barangay: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
});

export const IntakeInputSchema = z.object({
  beneficiary: z.object({
    surname: z.string().min(1, 'Surname is required'),
    firstName: z.string().min(1, 'First name is required'),
    middleName: z.string().optional(),
    gender: z.enum(['Male', 'Female']),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
    age: z.number().int().positive().optional(),
    placeOfBirth: z.string().min(1, 'Place of birth is required'),
    civilStatus: z.enum(['Single', 'Married', 'Widowed', 'Separated', 'Annulled']),
    cellularNumber: z.string().min(1, 'Cellular number is required'),
    currentAddress: AddressSchema,
    provincialAddress: AddressSchema,
    philhealthNumber: z.string().optional(),
    occupation: z.string().min(1, 'Occupation is required'),
    estimatedMonthlyIncome: z.number().positive('Estimated monthly income is required'),
  }),
  familyMembers: z.array(z.object({
    fullName: z.string().min(1, 'Name is required'),
    age: z.number().int().positive('Age is required'),
    relationship: z.string().min(1, 'Relationship is required'),
    occupation: z.string().min(1, 'Occupation is required'),
  })).optional(),
  case: z.object({
    serviceRequested: z.array(z.string()).optional(),
    requirementsChecklist: z.record(z.boolean()).optional(),
    assessedBy: z.string().optional(),
    assignedWorkerId: z.string().optional(),
  }),
});

export type IntakeInput = z.infer<typeof IntakeInputSchema>;
```

- [ ] **Step 2: Update IntakeService.submitIntake**

Replace the beneficiary creation block in `intake.service.ts`:

```typescript
// In submitIntake(), replace existing beneficiary creation:
const beneficiary = this.benRepo.create({
  surname: data.beneficiary.surname,
  firstName: data.beneficiary.firstName,
  middleName: data.beneficiary.middleName,
  gender: data.beneficiary.gender,
  dob: new Date(data.beneficiary.dob),
  age: data.beneficiary.age || undefined,
  placeOfBirth: data.beneficiary.placeOfBirth,
  civilStatus: data.beneficiary.civilStatus,
  phone: data.beneficiary.cellularNumber,
  currentAddress: data.beneficiary.currentAddress,
  provincialAddress: data.beneficiary.provincialAddress,
  philhealthNumber: data.beneficiary.philhealthNumber || undefined,
  occupation: data.beneficiary.occupation,
  estimatedMonthlyIncome: data.beneficiary.estimatedMonthlyIncome,
  address: data.beneficiary.currentAddress?.street
    ? `${data.beneficiary.currentAddress.street}, ${data.beneficiary.currentAddress.barangay || ''}`
    : undefined,
  consentStatus: 'active',
});
```

Replace the FamilyMember creation block:

```typescript
// Replace existing family member creation loop:
if (data.familyMembers && data.familyMembers.length > 0) {
  const validMembers = data.familyMembers.filter(m => m.fullName && m.fullName.trim().length > 0);
  for (const fm of validMembers) {
    const member = this.fmRepo.create({
      householdId: savedHousehold.id,
      fullName: fm.fullName,
      relationship: fm.relationship,
      age: fm.age,
      occupation: fm.occupation,
    });
    await queryRunner.manager.save(member);
  }
}
```

Update Household creation to use currentAddress barangay:

```typescript
// Replace household creation:
const household = this.hhRepo.create({
  primaryBeneficiaryId: savedBeneficiary.id,
  barangay: data.beneficiary.currentAddress?.barangay || '',
  estimatedIncome: data.beneficiary.estimatedMonthlyIncome,
});
```

---

### Task 4: Backend — add assessment PATCH endpoint

**Files:**
- Modify: `kapwa-server/src/cases/cases.controller.ts`
- Modify: `kapwa-server/src/cases/cases.service.ts`
- Modify: `kapwa-server/src/cases/dto/cases.zod.ts`

**Interfaces:**
- Consumes: case entity from Task 2
- Produces: `PATCH /cases/:id/assessment` endpoint

- [ ] **Step 1: Add AssessmentSchema to cases.zod.ts**

```typescript
export const AssessmentSchema = z.object({
  problemsPresented: z.string().min(1, 'Problem/s presented is required'),
  socialWorkerAssessment: z.string().min(1, 'Social worker assessment is required'),
  clientCategory: z.enum([
    'Children in Need of Special Protection',
    'Youth in Need of Special Protection',
    'Women in Especially Difficult Circumstances',
    'Person with Disability',
    'Senior Citizen',
    'Family Head and Other Needy Adult',
  ]),
  natureOfService: z.array(z.string()).optional(),
  financialSubsidies: z.record(z.unknown()).optional(),
  amountAssistance: z.number().positive().optional(),
  modeFinancialAssistance: z.enum(['Cash', 'Cheque']).optional().nullable(),
  sourceOfFund: z.string().optional(),
  legislatorSpecify: z.string().optional().nullable(),
  otherAssistance: z.record(z.unknown()).optional(),
  interviewedBy: z.string().optional(),
  clientSignature: z.string().optional(),
});

export type AssessmentInput = z.infer<typeof AssessmentSchema>;
```

- [ ] **Step 2: Add `updateAssessment` method to CasesService**

```typescript
// In CasesService:
async updateAssessment(id: string, data: AssessmentInput) {
  const c = await this.findById(id);
  Object.assign(c, {
    problemsPresented: data.problemsPresented,
    socialWorkerAssessment: data.socialWorkerAssessment,
    clientCategory: data.clientCategory,
    natureOfService: data.natureOfService,
    financialSubsidies: data.financialSubsidies,
    amountAssistance: data.amountAssistance,
    modeFinancialAssistance: data.modeFinancialAssistance,
    sourceOfFund: data.sourceOfFund,
    legislatorSpecify: data.legislatorSpecify,
    otherAssistance: data.otherAssistance,
    interviewedBy: data.interviewedBy,
    clientSignature: data.clientSignature,
    updatedAt: new Date(),
  });
  return this.caseRepo.save(c);
}
```

Import `AssessmentInput` at the top:

```typescript
import { AssessmentInput } from './dto/cases.zod';
```

- [ ] **Step 3: Add PATCH endpoint to CasesController**

```typescript
// In CasesController:
import { AssessmentSchema, AssessmentInput } from './dto/cases.zod';

@Patch(':id/assessment')
@Roles('admin', 'social_worker')
async updateAssessment(
  @Param('id') id: string,
  @Body(new ZodPipe(AssessmentSchema)) body: AssessmentInput,
) {
  return this.casesService.updateAssessment(id, body);
}
```

---

### Task 5: Frontend — update constants

**Files:**
- Modify: `kapwa-client/src/lib/constants.ts`

**Interfaces:**
- Consumes: no prior tasks
- Produces: dropdown options used by IntakePage and CaseViewPage

- [ ] **Step 1: Add new constant arrays**

Append to `kapwa-client/src/lib/constants.ts`:

```typescript
export const CIVIL_STATUSES = ['Single', 'Married', 'Widowed', 'Separated', 'Annulled'] as const;

export const CLIENT_CATEGORIES_V2 = [
  'Children in Need of Special Protection',
  'Youth in Need of Special Protection',
  'Women in Especially Difficult Circumstances',
  'Person with Disability',
  'Senior Citizen',
  'Family Head and Other Needy Adult',
] as const;

export const NATURE_OF_SERVICE = ['Counseling', 'Financial Assistance', 'Legal Assistance'] as const;

export const FINANCIAL_SUBSIDIES = [
  'Food Subsidy', 'Livelihood', 'Education', 'Medical',
  'Guarantee Letter', 'Burial', 'Transportation',
] as const;

export const SOURCE_OF_FUND = [
  'Regular Funds', 'Donation', 'Priority Development Assistance Fund', 'Others',
] as const;

export const OTHER_ASSISTANCE = [
  'Food Pack', 'Used Clothing', 'Hot Meal', 'Assistive Devices', 'Other',
] as const;

export const CITIES = ['Norzagaray', 'Angat', 'Baliuag', 'Bocaue', 'Malolos', 'Meycauayan', 'San Jose del Monte', 'Santa Maria'] as const;

export const PROVINCES = ['Bulacan', 'Pampanga', 'Nueva Ecija', 'Rizal', 'Manila', 'Quezon City', 'Caloocan'] as const;
```

---

### Task 6: Frontend — rewrite IntakePage (Sections I + II)

**Files:**
- Rewrite: `kapwa-client/src/pages/IntakePage.tsx`

**Interfaces:**
- Consumes: constants from Task 5, backend POST /intake from Task 3
- Produces: full intake form with validation, submit → redirect to `/cases/:id`

- [ ] **Step 1: Rewrite IntakePage.tsx**

Full rewrite of the file. Key structure:

- Imports: `useState`, `useNavigate`, `api`, `PageShell`, `Input`, `Button`, `Separator`, `SignaturePad`, all constants
- Form state includes: surname, firstName, middleName, gender (radio), dob, age (computed), placeOfBirth, civilStatus, cellularNumber, currentAddress (object), provincialAddress (object), philhealthNumber, occupation, estimatedMonthlyIncome
- Family state: array of `{ fullName, age, relationship, occupation }`
- Age computed from DOB via `computeAge(dob)` function
- On submit: `api.post('/intake', payload)` → `navigate(`/cases/${data.caseId}`)`
- Redirection after success replaces `setSuccess` with `navigate()`

```typescript
// kapwa-client/src/pages/IntakePage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { PageShell } from '@/components/PageShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  BARANGAYS, CIVIL_STATUSES, CITIES, PROVINCES,
} from '../lib/constants';

function computeAge(dob: string): number {
  if (!dob) return 0;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

interface FamilyMember {
  id: string;
  fullName: string;
  age: number | '';
  relationship: string;
  occupation: string;
}

interface AddressFields {
  street: string;
  barangay: string;
  city: string;
  province: string;
  postalCode: string;
}

const emptyAddress: AddressFields = { street: '', barangay: '', city: 'Norzagaray', province: 'Bulacan', postalCode: '' };

export function IntakePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    surname: '', firstName: '', middleName: '',
    gender: '' as string,
    dob: '',
    placeOfBirth: '',
    civilStatus: '',
    cellularNumber: '',
    currentAddress: { ...emptyAddress },
    provincialAddress: { ...emptyAddress },
    philhealthNumber: '',
    occupation: '',
    estimatedMonthlyIncome: '' as string,
  });
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const age = computeAge(form.dob);

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function updateAddress(type: 'currentAddress' | 'provincialAddress', field: string, value: string) {
    setForm(prev => ({
      ...prev,
      [type]: { ...prev[type], [field]: value },
    }));
  }

  function addFamilyMember() {
    setFamily(prev => [...prev, {
      id: crypto.randomUUID(),
      fullName: '',
      age: '' as const,
      relationship: 'Spouse',
      occupation: '',
    }]);
  }

  function updateFamilyMember(id: string, field: string, value: string | number) {
    setFamily(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  }

  function removeFamilyMember(id: string) {
    setFamily(prev => prev.filter(m => m.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.surname || !form.firstName || !form.dob || !form.gender || !form.placeOfBirth || !form.civilStatus || !form.cellularNumber || !form.occupation || !form.estimatedMonthlyIncome) {
      setError('Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const data = await api.post<{ caseId: string; controlNo: string }>('/intake', {
        beneficiary: {
          surname: form.surname,
          firstName: form.firstName,
          middleName: form.middleName || undefined,
          gender: form.gender,
          dob: form.dob,
          age: age,
          placeOfBirth: form.placeOfBirth,
          civilStatus: form.civilStatus,
          cellularNumber: form.cellularNumber,
          currentAddress: form.currentAddress,
          provincialAddress: form.provincialAddress,
          philhealthNumber: form.philhealthNumber || undefined,
          occupation: form.occupation,
          estimatedMonthlyIncome: parseFloat(form.estimatedMonthlyIncome) || 0,
        },
        familyMembers: family.filter(m => m.fullName.trim()).map(f => ({
          fullName: f.fullName,
          age: f.age || 0,
          relationship: f.relationship,
          occupation: f.occupation,
        })),
        case: {},
      });
      navigate(`/cases/${data.caseId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit intake');
    } finally {
      setSubmitting(false);
    }
  }

  function AddressBlock({ type, label }: { type: 'currentAddress' | 'provincialAddress'; label: string }) {
    const addr = form[type];
    return (
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</h4>
        <div className="space-y-2">
          <label className="text-sm font-medium">House/Unit No., Street, Subdivision</label>
          <Input value={addr.street} onChange={e => updateAddress(type, 'street', e.target.value)} aria-label={`${label} Street`} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Barangay</label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={addr.barangay} onChange={e => updateAddress(type, 'barangay', e.target.value)} aria-label={`${label} Barangay`}>
              <option value="">Select...</option>
              {BARANGAYS.map(b => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">City/Municipality</label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={addr.city} onChange={e => updateAddress(type, 'city', e.target.value)} aria-label={`${label} City`}>
              {CITIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Province</label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={addr.province} onChange={e => updateAddress(type, 'province', e.target.value)} aria-label={`${label} Province`}>
              {PROVINCES.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Postal Code</label>
            <Input type="number" value={addr.postalCode} onChange={e => updateAddress(type, 'postalCode', e.target.value)} aria-label={`${label} Postal Code`} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <PageShell title="GIS Intake Form" description="Client Registration — Personal Information + Family Composition">
      {error && <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
        {/* Section I: Personal Information */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">I. Personal Information</h2>

          <div className="space-y-4">
            {/* 1. Name */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">1. Name of the Client</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Surname *</label>
                  <Input required value={form.surname} onChange={e => update('surname', e.target.value)} aria-label="Surname" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">First Name *</label>
                  <Input required value={form.firstName} onChange={e => update('firstName', e.target.value)} aria-label="First Name" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Middle Name</label>
                  <Input value={form.middleName} onChange={e => update('middleName', e.target.value)} aria-label="Middle Name" />
                </div>
              </div>
            </div>

            {/* 2. Sex */}
            <div>
              <label className="text-sm font-medium">2. Sex *</label>
              <div className="flex gap-4 mt-1">
                {['Male', 'Female'].map(s => (
                  <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="gender" value={s} checked={form.gender === s} onChange={e => update('gender', e.target.value)} className="text-primary" required />
                    {s}
                  </label>
                ))}
              </div>
            </div>

            {/* 3 + 4. Age + DOB */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">3. Age</label>
                <Input type="number" value={age || ''} disabled aria-label="Age" className="bg-muted" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">4a. Date of Birth *</label>
                <Input type="date" required value={form.dob} onChange={e => update('dob', e.target.value)} aria-label="Date of Birth" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">4b. Place of Birth *</label>
                <Input required value={form.placeOfBirth} onChange={e => update('placeOfBirth', e.target.value)} aria-label="Place of Birth" />
              </div>
            </div>

            {/* 5-6. Civil Status + Cellular */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">5. Civil Status *</label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" required value={form.civilStatus} onChange={e => update('civilStatus', e.target.value)} aria-label="Civil Status">
                  <option value="">Select...</option>
                  {CIVIL_STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">6. Cellular Number *</label>
                <Input type="tel" required value={form.cellularNumber} onChange={e => update('cellularNumber', e.target.value)} aria-label="Cellular Number" />
              </div>
            </div>

            {/* 7-8. Addresses */}
            <Separator />
            <AddressBlock type="currentAddress" label="7. Address (Current)" />
            <Separator />
            <AddressBlock type="provincialAddress" label="8. Provincial Address (Permanent)" />

            {/* 9. PhilHealth */}
            <div className="space-y-2">
              <label className="text-sm font-medium">9. PhilHealth Number</label>
              <Input value={form.philhealthNumber} onChange={e => update('philhealthNumber', e.target.value)} aria-label="PhilHealth Number" placeholder="Optional" />
            </div>

            {/* 10-11. Occupation + Income */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">10. Occupation *</label>
                <Input required value={form.occupation} onChange={e => update('occupation', e.target.value)} aria-label="Occupation" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">11. Estimated Monthly Income *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₱</span>
                  <Input type="number" min="0" step="0.01" required value={form.estimatedMonthlyIncome} onChange={e => update('estimatedMonthlyIncome', e.target.value)} aria-label="Estimated Monthly Income" className="pl-7" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section II: Family Composition */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">II. Family Composition</h2>
            <Button type="button" variant="outline" size="sm" onClick={addFamilyMember}>+ Add Member</Button>
          </div>
          {family.length === 0 && <p className="text-sm text-muted-foreground italic">No family members added</p>}
          {family.map(m => (
            <div key={m.id} className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border bg-muted/30 p-3">
              <div className="flex-1 min-w-[160px] space-y-1">
                <label className="text-xs text-muted-foreground">Name *</label>
                <Input className="h-8 text-sm" required value={m.fullName} onChange={e => updateFamilyMember(m.id, 'fullName', e.target.value)} aria-label="Family member name" />
              </div>
              <div className="w-16 space-y-1">
                <label className="text-xs text-muted-foreground">Age *</label>
                <Input type="number" min="0" className="h-8 text-sm" required value={m.age} onChange={e => updateFamilyMember(m.id, 'age', e.target.value === '' ? '' : Number(e.target.value))} aria-label="Family member age" />
              </div>
              <div className="w-28 space-y-1">
                <label className="text-xs text-muted-foreground">Relationship *</label>
                <select className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={m.relationship} onChange={e => updateFamilyMember(m.id, 'relationship', e.target.value)} aria-label="Family member relationship">
                  {['Spouse','Child','Parent','Sibling','Grandparent','Other'].map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[120px] space-y-1">
                <label className="text-xs text-muted-foreground">Occupation *</label>
                <Input className="h-8 text-sm" required value={m.occupation} onChange={e => updateFamilyMember(m.id, 'occupation', e.target.value)} aria-label="Family member occupation" />
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeFamilyMember(m.id)} className="text-destructive h-8">Remove</Button>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting} aria-label="Submit Intake">
            {submitting ? 'Submitting...' : 'Submit Intake'}
          </Button>
        </div>
      </form>
    </PageShell>
  );
}
```

---

### Task 7: Frontend — add Assessment + Services sections to CaseViewPage

**Files:**
- Modify: `kapwa-client/src/pages/CaseViewPage.tsx`

**Interfaces:**
- Consumes: `useAuth()` for interviewedBy, constants from Task 5, backend PATCH /cases/:id/assessment from Task 4
- Produces: editable Section III (Assessment) + IV (Recommended Services) on case view page

- [ ] **Step 0: Add `patch` method to api client**

In `kapwa-client/src/lib/api.ts`, add after the `put` method (line 173):

```typescript
  patch: <T>(path: ApiPath, body?: unknown, opts?: { signal?: AbortSignal }) =>
    executeWithRetry<T>('PATCH', path, body, opts?.signal),
```

- [ ] **Step 1: Add new imports**

At the top of `CaseViewPage.tsx`, add:

```typescript
import { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { SignaturePad } from '../components/forms/SignaturePad';
import { NATURE_OF_SERVICE, FINANCIAL_SUBSIDIES, SOURCE_OF_FUND, OTHER_ASSISTANCE, CLIENT_CATEGORIES_V2 } from '../lib/constants';
```

Note: `useState` is already imported. Add the others.

- [ ] **Step 2: Add assessment + services state and handlers inside CaseViewPage function**

After the `ageRange` computation (line 85), add:

```typescript
  const { user } = useAuth();
  const [editingAssessment, setEditingAssessment] = useState(false);
  const [assessment, setAssessment] = useState({
    problemsPresented: caseData?.problemsPresented || '',
    socialWorkerAssessment: caseData?.socialWorkerAssessment || '',
    clientCategory: caseData?.clientCategory || '',
    natureOfService: (caseData?.natureOfService || []) as string[],
    financialSubsidies: (caseData?.financialSubsidies || {}) as Record<string, unknown>,
    amountAssistance: caseData?.amountAssistance || '' as string | number,
    modeFinancialAssistance: caseData?.modeFinancialAssistance || '',
    sourceOfFund: caseData?.sourceOfFund || '',
    legislatorSpecify: caseData?.legislatorSpecify || '',
    otherAssistance: (caseData?.otherAssistance || {}) as Record<string, unknown>,
    clientSignature: caseData?.clientSignature || '',
  });
  const [savingAssessment, setSavingAssessment] = useState(false);

  useEffect(() => {
    if (caseData) {
      setAssessment({
        problemsPresented: caseData.problemsPresented || '',
        socialWorkerAssessment: caseData.socialWorkerAssessment || '',
        clientCategory: caseData.clientCategory || '',
        natureOfService: (caseData.natureOfService || []) as string[],
        financialSubsidies: (caseData.financialSubsidies || {}) as Record<string, unknown>,
        amountAssistance: caseData.amountAssistance || '',
        modeFinancialAssistance: caseData.modeFinancialAssistance || '',
        sourceOfFund: caseData.sourceOfFund || '',
        legislatorSpecify: caseData.legislatorSpecify || '',
        otherAssistance: (caseData.otherAssistance || {}) as Record<string, unknown>,
        clientSignature: caseData.clientSignature || '',
      });
    }
  }, [caseData]);
```

Add `useEffect` to the imports (already imported from React at top).

- [ ] **Step 3: Add assessment save handler**

Before `return` (line 107), add:

```typescript
  async function saveAssessment() {
    setSavingAssessment(true);
    try {
      await api.patch(`/cases/${id}/assessment`, {
        ...assessment,
        interviewedBy: `${user?.firstName || ''} ${user?.surname || ''}`.trim(),
        amountAssistance: typeof assessment.amountAssistance === 'string' ? parseFloat(assessment.amountAssistance) || 0 : assessment.amountAssistance,
      });
      await mutate(queryKeys.cases.detail(id!));
      setEditingAssessment(false);
    } catch (e) {
      console.error('Failed to save assessment:', e);
    } finally {
      setSavingAssessment(false);
    }
  }
```

Add `mutate` import from `swr`:

```typescript
import { useSWRConfig } from 'swr';

// Inside CaseViewPage:
const { mutate } = useSWRConfig();
```

- [ ] **Step 4: Add Section III rendering (after the Requirements Checklist card, before History)**

After the Requirements checklist block (after line 246), add:

```tsx
        {/* Section III: Assessment */}
        <div className="rounded-lg border bg-card">
          <div className="px-5 py-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">III. Assessment</h3>
            <Button variant="outline" size="sm" onClick={() => setEditingAssessment(!editingAssessment)}>
              {editingAssessment ? 'Cancel' : caseData?.problemsPresented ? 'Edit' : 'Add Assessment'}
            </Button>
          </div>
          <Separator />
          <div className="px-5 py-4 space-y-4">
            {editingAssessment ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">13a. Problem/s Presented *</label>
                  <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px]" required value={assessment.problemsPresented} onChange={e => setAssessment(a => ({ ...a, problemsPresented: e.target.value }))} aria-label="Problems Presented" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">13b. Social Worker's Assessment *</label>
                  <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px]" required value={assessment.socialWorkerAssessment} onChange={e => setAssessment(a => ({ ...a, socialWorkerAssessment: e.target.value }))} aria-label="Social Worker Assessment" />
                </div>
                <div>
                  <label className="text-sm font-medium">14. Client Category *</label>
                  <div className="mt-1 space-y-1">
                    {CLIENT_CATEGORIES_V2.map(cat => (
                      <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name="clientCategory" value={cat} checked={assessment.clientCategory === cat} onChange={e => setAssessment(a => ({ ...a, clientCategory: e.target.value }))} className="text-primary" />
                        {cat}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="text-sm">
                  <span className="text-muted-foreground">Problem/s Presented</span>
                  <p className="font-medium">{caseData?.problemsPresented || '—'}</p>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Social Worker's Assessment</span>
                  <p className="font-medium">{caseData?.socialWorkerAssessment || '—'}</p>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Client Category</span>
                  <p className="font-medium">{caseData?.clientCategory || '—'}</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Section IV: Recommended Services & Assistance */}
        <div className="rounded-lg border bg-card">
          <div className="px-5 py-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">IV. Recommended Services & Assistance</h3>
            {!editingAssessment && (
              <Button variant="outline" size="sm" onClick={() => setEditingAssessment(true)}>
                {caseData?.natureOfService?.length ? 'Edit' : 'Add Services'}
              </Button>
            )}
          </div>
          <Separator />
          <div className="px-5 py-4 space-y-4">
            {editingAssessment ? (
              <>
                {/* 15. Nature of Service */}
                <div>
                  <label className="text-sm font-medium">15. Nature of Service/Assistance *</label>
                  <div className="mt-1 space-y-1">
                    {NATURE_OF_SERVICE.map(n => (
                      <label key={n} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name="natureOfService" value={n} checked={assessment.natureOfService.includes(n)} onChange={() => setAssessment(a => ({ ...a, natureOfService: [n] }))} className="text-primary" />
                        {n}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Financial Assistance sub-options */}
                {assessment.natureOfService.includes('Financial Assistance') && (
                  <div className="ml-4 space-y-3 border-l-2 border-muted pl-4">
                    <p className="text-xs font-medium text-muted-foreground">Sub-options</p>
                    <div className="grid grid-cols-2 gap-2">
                      {FINANCIAL_SUBSIDIES.map(sub => (
                        <label key={sub} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={!!assessment.financialSubsidies[sub]} onChange={() => setAssessment(a => ({ ...a, financialSubsidies: { ...a.financialSubsidies, [sub]: !a.financialSubsidies[sub] } }))} className="rounded border-input text-primary" />
                          {sub}
                        </label>
                      ))}
                    </div>
                    {assessment.financialSubsidies['Medical'] && (
                      <div className="space-y-2">
                        <label className="text-sm text-muted-foreground">Medical — Specify</label>
                        <Input value={(assessment.financialSubsidies['medicalSpecify'] as string) || ''} onChange={e => setAssessment(a => ({ ...a, financialSubsidies: { ...a.financialSubsidies, medicalSpecify: e.target.value } }))} placeholder="Specify medical need" aria-label="Medical specify" />
                      </div>
                    )}

                    {/* 15a-c */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">15a. Amount (₱)</label>
                        <Input type="number" min="0" step="0.01" value={assessment.amountAssistance} onChange={e => setAssessment(a => ({ ...a, amountAssistance: e.target.value }))} aria-label="Amount" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">15b. Mode of Financial Assistance</label>
                        {assessment.financialSubsidies['Guarantee Letter'] ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <input type="checkbox" checked className="rounded border-input text-primary" />
                            Guarantee Letter (Cash/Cheque disabled)
                          </div>
                        ) : (
                          <div className="flex gap-4 mt-1">
                            {['Cash', 'Cheque'].map(m => (
                              <label key={m} className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="radio" name="modeFinancialAssistance" value={m} checked={assessment.modeFinancialAssistance === m} onChange={e => setAssessment(a => ({ ...a, modeFinancialAssistance: e.target.value }))} className="text-primary" />
                                {m}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 15c. Source of Fund */}
                    <div>
                      <label className="text-sm font-medium">15c. Source of Fund</label>
                      <div className="mt-1 space-y-1">
                        {SOURCE_OF_FUND.map(s => (
                          <div key={s}>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                              <input type="radio" name="sourceOfFund" value={s} checked={assessment.sourceOfFund === s} onChange={e => setAssessment(a => ({ ...a, sourceOfFund: e.target.value }))} className="text-primary" />
                              {s}
                            </label>
                            {assessment.sourceOfFund === s && s === 'Priority Development Assistance Fund' && (
                              <Input className="mt-1 ml-6" value={assessment.legislatorSpecify} onChange={e => setAssessment(a => ({ ...a, legislatorSpecify: e.target.value }))} placeholder="Specify Legislator" aria-label="Legislator" />
                            )}
                            {assessment.sourceOfFund === s && s === 'Others' && (
                              <Input className="mt-1 ml-6" value={assessment.legislatorSpecify} onChange={e => setAssessment(a => ({ ...a, legislatorSpecify: e.target.value }))} placeholder="Specify source" aria-label="Other source" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 16. Other Assistance */}
                <div>
                  <label className="text-sm font-medium">16. Other Assistance</label>
                  <div className="mt-1 space-y-1">
                    {OTHER_ASSISTANCE.map(o => (
                      <div key={o}>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={!!assessment.otherAssistance[o]} onChange={() => setAssessment(a => ({ ...a, otherAssistance: { ...a.otherAssistance, [o]: !a.otherAssistance[o] } }))} className="rounded border-input text-primary" />
                          {o}
                        </label>
                        {assessment.otherAssistance[o] && o === 'Assistive Devices' && (
                          <Input className="mt-1 ml-6" value={(assessment.otherAssistance['assistiveDevicesSpecify'] as string) || ''} onChange={e => setAssessment(a => ({ ...a, otherAssistance: { ...a.otherAssistance, assistiveDevicesSpecify: e.target.value } }))} placeholder="Specify assistive devices" aria-label="Assistive devices specify" />
                        )}
                        {assessment.otherAssistance[o] && o === 'Other' && (
                          <Input className="mt-1 ml-6" value={(assessment.otherAssistance['otherSpecify'] as string) || ''} onChange={e => setAssessment(a => ({ ...a, otherAssistance: { ...a.otherAssistance, otherSpecify: e.target.value } }))} placeholder="Specify other assistance" aria-label="Other specify" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Interviewed by + Client Signature */}
                <Separator />
                <div className="space-y-2">
                  <label className="text-sm font-medium">Interviewed by</label>
                  <Input value={`${user?.firstName || ''} ${user?.surname || ''}`.trim()} disabled className="bg-muted" aria-label="Interviewed by" />
                </div>
                <SignaturePad onSave={(sig: string) => setAssessment(a => ({ ...a, clientSignature: sig }))} label="Client Signature" />

                <Button onClick={saveAssessment} disabled={savingAssessment}>
                  {savingAssessment ? 'Saving...' : 'Save Assessment'}
                </Button>
              </>
            ) : (
              <>
                <div className="text-sm">
                  <span className="text-muted-foreground">Nature of Service</span>
                  <p className="font-medium">{(caseData?.natureOfService || []).join(', ') || '—'}</p>
                </div>
                {caseData?.amountAssistance && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Amount</span>
                    <p className="font-medium">₱{Number(caseData.amountAssistance).toLocaleString()}</p>
                  </div>
                )}
                <div className="text-sm">
                  <span className="text-muted-foreground">Source of Fund</span>
                  <p className="font-medium">{caseData?.sourceOfFund || '—'}</p>
                </div>
              </>
            )}
          </div>
        </div>
```

- [ ] **Step 5: Update CaseDetail interface to include new fields**

Add to the `CaseDetail` interface (after line 40):

```typescript
  problemsPresented?: string;
  socialWorkerAssessment?: string;
  clientCategory?: string;
  natureOfService?: string[];
  financialSubsidies?: Record<string, unknown>;
  amountAssistance?: number;
  modeFinancialAssistance?: string;
  sourceOfFund?: string;
  legislatorSpecify?: string;
  otherAssistance?: Record<string, unknown>;
  interviewedBy?: string;
  clientSignature?: string;
```

---

### Task 8: Update seed data

**Files:**
- Modify: `kapwa-server/src/database/seed-comprehensive.ts`

**Interfaces:**
- Consumes: new columns from Task 1
- Produces: seed data with new fields populated

- [ ] **Step 1: Update beneficiary seed INSERT to include new columns**

Find the beneficiaries INSERT (around line 290). Add new column values to each row:

```typescript
// Add to the column list: place_of_birth, civil_status, current_address, provincial_address, philhealth_number, occupation, estimated_monthly_income, age
// For each existing row, add reasonable defaults:
// place_of_birth: 'Norzagarary, Bulacan'
// civil_status: 'Married'
// current_address: '{"street": "123 Purok 3", "barangay": "Bigte", "city": "Norzagaray", "province": "Bulacan", "postalCode": "3012"}'::jsonb
// provincial_address: same as current_address
// philhealth_number: '123456789012'
// occupation: self-employed / vendor / etc.
// estimated_monthly_income: vary per row
// age: computed
```

---

## Self-Review Checklist

- [ ] **Spec coverage:** Every section from the spec has a corresponding task:
  - Section I (Personal Info) → Task 6
  - Section II (Family Composition) → Task 6
  - Section III (Assessment) → Task 7
  - Section IV (Services & Assistance) → Task 7
  - Backend schema changes → Tasks 1-4
  - Constants → Task 5
  - Seed → Task 8

- [ ] **Placeholder scan:** No TBDs, TODOs, or "implement later" sections. All code is fully specified.

- [ ] **Type consistency:** 
  - `IntakeInput.beneficiary.cellularNumber` → stored in `Beneficiary.phone`
  - `AssessmentSchema` fields match `Case` entity column names
  - `address` object shape consistent between frontend and backend JSONB
  - `FinancialSubsidies` uses same key names across frontend state and backend JSONB
