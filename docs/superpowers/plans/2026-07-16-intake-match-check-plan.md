# Intake Match-Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add prior-record detection during beneficiary intake — social workers check potential household matches before creating new records.

**Architecture:** Two new backend endpoints (`POST /intake/match-check`, `POST /intake/confirm/:householdId`), one new frontend page (`IntakeReviewPage.tsx`), modified intake submit flow. Uses PostgreSQL `pg_trgm` for fuzzy name matching (0.6 threshold). Match-review page uses split-pane layout: current intake on left, ranked candidates on right.

**Tech Stack:** NestJS + TypeORM + PostgreSQL (pg_trgm), React + react-router-dom v6 + Tailwind

## Global Constraints

- All new backend endpoints guarded by `JwtAuthGuard`, `RolesGuard`, `AbacGuard`
- New route `/intake/review` requires `admin`, `social_worker`, or `coordinator` role
- Trigram similarity threshold: 0.6 minimum
- Scoring: 60% beneficiary name match, 40% family member name match (averaged)
- Case created with `createdAt = NOW()` — next eligible date displayed for reference
- DO NOT use any libraries beyond what's already in package.json
- Follow existing patterns: Zod for DTO validation, route state for page navigation data

---
## File Structure

### Backend (kapwa-server)
| File | Action | Responsibility |
|------|--------|----------------|
| `src/intake/dto/intake.zod.ts` | Modify | Add `MatchCheckInputSchema` |
| `src/intake/intake.service.ts` | Modify | Add `matchCheck()` and `confirmMatch()` methods |
| `src/intake/intake.controller.ts` | Modify | Add `POST /match-check` and `POST /confirm/:householdId` |
| `test/intake.service.spec.ts` | Modify | Add tests for match-check and confirm-match |

### Frontend (kapwa-client)
| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/constants.ts` | Modify | Fix barangay list to 13 correct Norzagaray barangays |
| `src/pages/IntakePage.tsx` | Modify | Call match-check on submit, navigate to review or submit directly |
| `src/pages/IntakePage.test.tsx` | Modify | Update tests for new flow |
| `src/pages/IntakeReviewPage.tsx` | Create | Review page — split pane, expandable cards, link/create buttons |
| `src/pages/IntakeReviewPage.test.tsx` | Create | Tests for review page |
| `src/routes.tsx` | Modify | Add `/intake/review` route |

---

### Task 1: Fix client barangay lists

**Files:**
- Modify: `kapwa-client/src/lib/constants.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `BARANGAYS` constant with 13 correct Norzagaray barangays

- [ ] **Step 1: Replace BARANGAYS array**

In `kapwa-client/src/lib/constants.ts`, replace:

```ts
export const BARANGAYS = ['Bigte', 'Matictic', 'Partida', 'San Mateo', 'Tigbe', 'Minuyan', 'San Roque', 'Samson', 'FVR', 'Sta. Lucia'] as const;
```

With:

```ts
export const BARANGAYS = [
  'Bangkal', 'Baraka', 'Bigte', 'Bitungol', 'Friendship Village Resources (FVR)',
  'Matictic', 'Minuyan', 'Partida', 'Pinagtulayan', 'Poblacion',
  'San Lorenzo', 'San Mateo', 'Tigbe',
] as const;
```

- [ ] **Step 2: Run tests**

```bash
cd kapwa-client && npx vitest run src/lib/constants.test.ts 2>/dev/null || echo "no test file for constants"
npx vitest run src/pages/IntakePage.test.tsx
```

Expected: IntakePage tests pass (any test referencing old barangay `San Roque` or `Samson` should use one of the new 13).

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/src/lib/constants.ts
git commit -m "fix: update BARANGAYS to 13 correct Norzagaray barangays"
```

---

### Task 2: Backend — match-check DTO + service + controller + tests

**Files:**
- Modify: `kapwa-server/src/intake/dto/intake.zod.ts`
- Modify: `kapwa-server/src/intake/intake.service.ts`
- Modify: `kapwa-server/src/intake/intake.controller.ts`
- Modify: `kapwa-server/test/intake.service.spec.ts`

**Interfaces:**
- Consumes: `Beneficiary`, `Household`, `FamilyMember`, `Case` entities (already in module)
- Produces: `POST /intake/match-check` endpoint that returns `{ candidates: MatchCandidate[] }`

- [ ] **Step 1: Add MatchCheckInputSchema to intake.zod.ts**

Add after `IntakeInputSchema`:

```ts
export const MatchCheckInputSchema = z.object({
  surname: z.string().min(1),
  firstName: z.string().min(1),
  middleName: z.string().optional(),
  familyMembers: z.array(z.object({
    fullName: z.string().min(1),
  })).optional(),
  barangay: z.string().optional(),
});

export type MatchCheckInput = z.infer<typeof MatchCheckInputSchema>;

export interface MatchCandidate {
  householdId: string;
  score: number;
  primaryBeneficiary: {
    id: string;
    surname: string;
    firstName: string;
    middleName?: string;
    gender: string;
    age: number;
    phone: string;
    occupation: string;
    estimatedMonthlyIncome: number;
    civilStatus: string;
    currentAddress: Record<string, string> | null;
    philhealthNumber?: string;
    category?: string;
  };
  allBeneficiaries: Array<{ id: string; surname: string; firstName: string }>;
  familyMembers: Array<{ id: string; fullName: string; relationship: string; age: number; occupation: string; income: number; status: string }>;
  lastApprovedCaseDate: string | null;
}
```

- [ ] **Step 2: Add `matchCheck()` method to intake.service.ts**

Add after `submitIntake()`:

```ts
import { MatchCheckInput, MatchCandidate } from './dto/intake.zod';

async matchCheck(data: MatchCheckInput, workerBarangays: string[]): Promise<{ candidates: MatchCandidate[] }> {
  const familyNames = (data.familyMembers || []).map(f => f.fullName).filter(Boolean);

  const raw = await this.dataSource.query(
    `WITH household_scores AS (
      SELECT
        h.id,
        GREATEST(
          similarity(b.surname, $1),
          similarity(b.first_name, $2)
        ) AS ben_score,
        CASE WHEN $3::text[] IS NOT NULL AND array_length($3::text[], 1) > 0 THEN (
          SELECT COALESCE(AVG(sub.best), 0)
          FROM (
            SELECT MAX(similarity(fm.full_name, u.name)) AS best
            FROM family_members fm
            CROSS JOIN unnest($3::text[]) AS u(name)
            WHERE fm.household_id = h.id
            GROUP BY u.name
          ) sub
        ) ELSE 0 END AS family_score
      FROM households h
      JOIN beneficiaries b ON h.primary_beneficiary_id = b.id
    )
    SELECT
      hs.id AS household_id,
      (0.6 * COALESCE(hs.ben_score, 0) + 0.4 * COALESCE(hs.family_score, 0)) AS score,
      b.id AS ben_id, b.surname, b.first_name, b.address,
      b.phone, b.occupation, b.estimated_monthly_income,
      b.civil_status, b.current_address, b.philhealth_number, b.age, b.gender, b.middle_name, b.category,
      (SELECT json_agg(json_build_object('id', b2.id, 'surname', b2.surname, 'first_name', b2.first_name))
       FROM beneficiaries b2 WHERE b2.household_id = h.id) AS all_beneficiaries,
      (SELECT json_agg(json_build_object(
        'id', fm.id, 'fullName', fm.full_name, 'relationship', fm.relationship,
        'age', fm.age, 'occupation', fm.occupation, 'income', fm.income, 'status', fm.status
       )) FROM family_members fm WHERE fm.household_id = h.id) AS family_members,
      (SELECT MAX(c.created_at) FROM cases c
       JOIN beneficiaries b3 ON b3.id = c.beneficiary_id
       WHERE b3.household_id = h.id AND c.status = 'approved') AS last_case_date
    FROM household_scores hs
    JOIN households h ON h.id = hs.id
    JOIN beneficiaries b ON b.id = h.primary_beneficiary_id
    WHERE (0.6 * COALESCE(hs.ben_score, 0) + 0.4 * COALESCE(hs.family_score, 0)) >= 0.6
    ORDER BY (0.6 * COALESCE(hs.ben_score, 0) + 0.4 * COALESCE(hs.family_score, 0)) DESC
    LIMIT 10`,
    [data.surname, data.firstName, familyNames.length > 0 ? familyNames : null],
  );

  const candidates: MatchCandidate[] = (raw as any[])
    .filter(r => {
      if (workerBarangays.length === 0) return true;
      const addr = r.current_address as Record<string, string> | null;
      const barangay = addr?.barangay || '';
      return workerBarangays.includes(barangay);
    })
    .map(r => ({
      householdId: r.household_id,
      score: parseFloat(r.score) || 0,
      primaryBeneficiary: {
        id: r.ben_id,
        surname: r.surname,
        firstName: r.first_name,
        middleName: r.middle_name || undefined,
        gender: r.gender,
        age: r.age,
        phone: r.phone || '',
        occupation: r.occupation || '',
        estimatedMonthlyIncome: r.estimated_monthly_income ? parseFloat(r.estimated_monthly_income) : 0,
        civilStatus: r.civil_status || '',
        currentAddress: r.current_address || null,
        philhealthNumber: r.philhealth_number || undefined,
        category: r.category || undefined,
      },
      allBeneficiaries: r.all_beneficiaries || [],
      familyMembers: r.family_members || [],
      lastApprovedCaseDate: r.last_case_date ? r.last_case_date.toISOString() : null,
    }));

  return { candidates };
}
```

- [ ] **Step 3: Add `POST /intake/match-check` to intake.controller.ts**

Add after existing `@Post()`:

```ts
import { MatchCheckInputSchema, MatchCheckInput } from './dto/intake.zod';

@Post('match-check')
@Roles('admin', 'social_worker', 'coordinator')
async matchCheck(
  @Body(new ZodPipe(MatchCheckInputSchema)) body: MatchCheckInput,
  @Request() req: AuthenticatedRequest,
) {
  const permittedBarangays: string[] = req.user?.permittedBarangays || [];
  return this.intakeService.matchCheck(body, permittedBarangays);
}
```

- [ ] **Step 4: Add match-check test to intake.service.spec.ts**

Add to test file:

```ts
describe('matchCheck', () => {
  it('should call dataSource.query with surname and firstName', async () => {
    mockDataSource.query = jest.fn().mockResolvedValue([]);

    await service.matchCheck(
      { surname: 'Dela Cruz', firstName: 'Juan', familyMembers: [] },
      [],
    );

    expect(mockDataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('similarity'),
      ['Dela Cruz', 'Juan', null],
    );
  });

  it('should return empty candidates when no matches', async () => {
    mockDataSource.query = jest.fn().mockResolvedValue([]);

    const result = await service.matchCheck(
      { surname: 'Nonexistent', firstName: 'Nobody' },
      [],
    );

    expect(result).toEqual({ candidates: [] });
  });
});
```

- [ ] **Step 5: Run tests**

```bash
cd kapwa-server && npx jest test/intake.service.spec.ts --no-coverage -v
```

Expected: All existing tests pass, 2 new match-check tests pass.

- [ ] **Step 6: Commit**

```bash
git add kapwa-server/src/intake/dto/intake.zod.ts kapwa-server/src/intake/intake.service.ts kapwa-server/src/intake/intake.controller.ts kapwa-server/test/intake.service.spec.ts
git commit -m "feat: add intake match-check endpoint"
```

---

### Task 3: Backend — confirm-match endpoint

**Files:**
- Modify: `kapwa-server/src/intake/intake.service.ts`
- Modify: `kapwa-server/src/intake/intake.controller.ts`
- Modify: `kapwa-server/test/intake.service.spec.ts`

**Interfaces:**
- Consumes: `POST /intake/confirm/:householdId` with `IntakeInput` body
- Produces: creates beneficiary under existing household; returns `{ beneficiaryId, caseId, controlNo, status, nextEligibleDate }`

- [ ] **Step 1: Add `confirmMatch()` to intake.service.ts**

Add after `matchCheck()`:

```ts
async confirmMatch(householdId: string, data: IntakeInput, workerBarangays: string[]): Promise<{
  beneficiaryId: string;
  caseId: string;
  controlNo: string;
  status: string;
  nextEligibleDate: string;
}> {
  // Verify worker has permission for this household's barangay
  const household = await this.hhRepo.findOne({ where: { id: householdId } });
  if (!household) throw new NotFoundException('Household not found');
  if (workerBarangays.length > 0 && household.barangay && !workerBarangays.includes(household.barangay)) {
    throw new ForbiddenException('You do not have permission for this barangay');
  }

  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction('SERIALIZABLE');

  try {
    // 1. Create beneficiary linked to existing household
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
      householdId,
      consentStatus: 'active',
    });
    const savedBeneficiary = await queryRunner.manager.save(beneficiary);

    // 2. Add family members to existing household
    if (data.familyMembers && data.familyMembers.length > 0) {
      const validMembers = data.familyMembers.filter(m => m.fullName && m.fullName.trim().length > 0);
      for (const fm of validMembers) {
        const member = this.fmRepo.create({
          householdId,
          fullName: fm.fullName,
          relationship: fm.relationship,
          age: fm.age,
          occupation: fm.occupation,
          income: fm.income,
          status: fm.status,
        });
        await queryRunner.manager.save(member);
      }
    }

    // 3. Get latest approved case date for this household
    const lastCase = await this.caseRepo.findOne({
      where: { beneficiaryId: In(
        (await this.benRepo.find({ where: { householdId }, select: ['id'] })).map(b => b.id)
      ), status: CaseStatus.APPROVED },
      order: { createdAt: 'DESC' },
    });

    const lastApprovedDate = lastCase?.createdAt || null;
    const nextEligibleDate = lastApprovedDate
      ? new Date(lastApprovedDate.getTime() + 30 * 24 * 60 * 60 * 1000)
      : new Date();

    // 4. Generate controlNo
    const controlNo = await this.casesService.generateControlNo();

    // 5. Create case
    const caseEntity = this.caseRepo.create({
      controlNo,
      beneficiaryId: savedBeneficiary.id,
      status: CaseStatus.PENDING,
      serviceRequested: data.case.serviceRequested,
      requirementsChecklist: data.case.requirementsChecklist,
      assignedWorkerId: data.case.assignedWorkerId,
    });
    const savedCase = await queryRunner.manager.save(caseEntity);

    // 6. Create consent
    const consent = this.consentRepo.create({
      beneficiaryId: savedBeneficiary.id,
      purpose: 'registration',
      channel: 'web',
      status: 'active',
    });
    await queryRunner.manager.save(consent);

    await queryRunner.commitTransaction();

    return {
      beneficiaryId: savedBeneficiary.id,
      caseId: savedCase.id,
      controlNo,
      status: CaseStatus.PENDING,
      nextEligibleDate: nextEligibleDate.toISOString(),
    };
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw new InternalServerErrorException(
      error instanceof Error ? error.message : 'Confirm match transaction failed',
    );
  } finally {
    await queryRunner.release();
  }
}
```

Add imports at top:

```ts
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { In } from 'typeorm';
```

- [ ] **Step 2: Add `POST /intake/confirm/:householdId` to controller**

Add after matchCheck:

```ts
@Post('confirm/:householdId')
@Roles('admin', 'social_worker', 'coordinator')
async confirmMatch(
  @Param('householdId') householdId: string,
  @Body(new ZodPipe(IntakeInputSchema)) body: IntakeInput,
  @Request() req: AuthenticatedRequest,
) {
  const permittedBarangays: string[] = req.user?.permittedBarangays || [];
  return this.intakeService.confirmMatch(householdId, body, permittedBarangays);
}
```

- [ ] **Step 3: Add confirmMatch tests**

Add to test file:

```ts
describe('confirmMatch', () => {
  it('should throw NotFoundException for nonexistent household', async () => {
    hhRepo.findOne = jest.fn().mockResolvedValue(null) as any;

    await expect(
      service.confirmMatch('nonexistent-id', validInput, []),
    ).rejects.toThrow('Household not found');
  });

  it('should throw ForbiddenException if worker not permitted for barangay', async () => {
    hhRepo.findOne = jest.fn().mockResolvedValue({ id: 'hh-id', barangay: 'Bigte' }) as any;

    await expect(
      service.confirmMatch('hh-id', validInput, ['Matictic']),
    ).rejects.toThrow('You do not have permission for this barangay');
  });

  it('should create beneficiary with existing householdId on confirm', async () => {
    hhRepo.findOne = jest.fn().mockResolvedValue({ id: 'existing-hh', barangay: 'Bigte' }) as any;
    benRepo.find = jest.fn().mockResolvedValue([{ id: 'existing-ben' }]) as any;

    const saveMock = mockQueryRunner.manager.save as jest.Mock;
    saveMock
      .mockResolvedValueOnce({ id: 'new-ben-id' })
      .mockResolvedValueOnce({ id: 'fm-1' })
      .mockResolvedValueOnce({ id: 'new-case-id', controlNo: 'KAPWA-2026-00001' })
      .mockResolvedValueOnce({ id: 'cl-1' });

    (benRepo.create as jest.Mock).mockReturnValue({});
    (hhRepo.create as jest.Mock).mockReturnValue({});
    (caseRepo.create as jest.Mock).mockReturnValue({});
    (consentRepo.create as jest.Mock).mockReturnValue({});
    (fmRepo.create as jest.Mock).mockReturnValue({});

    casesService.generateControlNo = jest.fn().mockResolvedValue('KAPWA-2026-00001');
    caseRepo.findOne = jest.fn().mockResolvedValue(null) as any;

    const result = await service.confirmMatch('existing-hh', validInput, ['Bigte']);

    expect(benRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ householdId: 'existing-hh' }),
    );
    expect(result).toHaveProperty('beneficiaryId', 'new-ben-id');
    expect(result).toHaveProperty('status', 'pending_assessment');
  });
});
```

Add `CaseStatus` import at top if not already imported:

```ts
import { Case, CaseStatus } from '../src/cases/case.entity';
```

- [ ] **Step 4: Run tests**

```bash
cd kapwa-server && npx jest test/intake.service.spec.ts --no-coverage -v
```

Expected: All tests pass (existing + new).

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/src/intake/intake.service.ts kapwa-server/src/intake/intake.controller.ts kapwa-server/test/intake.service.spec.ts
git commit -m "feat: add intake confirm-match endpoint"
```

---

### Task 4: Frontend — IntakePage submit flow

**Files:**
- Modify: `kapwa-client/src/pages/IntakePage.tsx`
- Modify: `kapwa-client/src/pages/IntakePage.test.tsx`

**Interfaces:**
- Consumes: `api.post('/intake/match-check', ...)` and `api.post('/intake', ...)`
- Produces: navigates to `/intake/review` with route state or to `/cases/:id`

- [ ] **Step 1: Modify IntakePage handleSubmit to call match-check first**

In `IntakePage.tsx`, replace the `handleSubmit` function:

```tsx
import { useNavigate } from 'react-router-dom';
```

Already imported. Replace `handleSubmit`:

```tsx
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setError('');
  if (!form.surname || !form.firstName || !form.dob || !form.gender || !form.placeOfBirth || !form.civilStatus || !form.cellularNumber || !form.occupation || !form.estimatedMonthlyIncome) {
    setError('Please fill in all required fields');
    return;
  }
  if (!hasConsent) {
    setError('Consent required per Data Privacy Act (RA 10173)');
    return;
  }
  setSubmitting(true);

  try {
    // Step 1: Check for prior records
    const intakeCheckPayload = {
      surname: form.surname,
      firstName: form.firstName,
      middleName: form.middleName || undefined,
      familyMembers: family.filter(m => m.fullName.trim()).map(f => ({ fullName: f.fullName })),
      barangay: form.currentAddress.barangay || undefined,
    };

    const matchResult = await api.post<{ candidates: unknown[] }>('/intake/match-check', intakeCheckPayload);

    const intakePayload = {
      beneficiary: {
        surname: form.surname,
        firstName: form.firstName,
        middleName: form.middleName || undefined,
        gender: form.gender,
        dob: form.dob,
        age,
        placeOfBirth: form.placeOfBirth,
        civilStatus: form.civilStatus,
        cellularNumber: form.cellularNumber,
        currentAddress: form.currentAddress,
        provincialAddress: form.provincialAddress,
        philhealthNumber: form.philhealthNumber || undefined,
        occupation: form.occupation,
        estimatedMonthlyIncome: parseFloat(form.estimatedMonthlyIncome.replace(/,/g, '')) || 0,
      },
      familyMembers: family.filter(m => m.fullName.trim()).map(f => ({
        fullName: f.fullName,
        age: f.age || 0,
        relationship: f.relationship,
        occupation: f.occupation,
        income: f.income ? parseFloat(f.income.replace(/,/g, '')) : undefined,
        status: f.status || undefined,
      })),
      case: {},
    };

    if (matchResult.candidates && matchResult.candidates.length > 0) {
      // Show review page
      navigate('/intake/review', {
        state: { candidates: matchResult.candidates, intakeData: intakePayload },
      });
    } else {
      // No matches — create new client directly
      const data = await api.post<{ caseId: string; controlNo: string }>('/intake', intakePayload);
      navigate(`/cases/${data.caseId}`);
    }
  } catch (err: unknown) {
    // On match-check error, fall through to normal intake
    try {
      const data = await api.post<{ caseId: string; controlNo: string }>('/intake', {
        beneficiary: {
          surname: form.surname,
          firstName: form.firstName,
          middleName: form.middleName || undefined,
          gender: form.gender,
          dob: form.dob,
          age,
          placeOfBirth: form.placeOfBirth,
          civilStatus: form.civilStatus,
          cellularNumber: form.cellularNumber,
          currentAddress: form.currentAddress,
          provincialAddress: form.provincialAddress,
          philhealthNumber: form.philhealthNumber || undefined,
          occupation: form.occupation,
          estimatedMonthlyIncome: parseFloat(form.estimatedMonthlyIncome.replace(/,/g, '')) || 0,
        },
        familyMembers: family.filter(m => m.fullName.trim()).map(f => ({
          fullName: f.fullName,
          age: f.age || 0,
          relationship: f.relationship,
          occupation: f.occupation,
          income: f.income ? parseFloat(f.income.replace(/,/g, '')) : undefined,
          status: f.status || undefined,
        })),
        case: {},
      });
      navigate(`/cases/${data.caseId}`);
    } catch (fallbackErr: unknown) {
      setError(fallbackErr instanceof Error ? fallbackErr.message : 'Failed to submit intake');
    }
  } finally {
    setSubmitting(false);
  }
}
```

Change submit button text:

```tsx
<Button type="submit" disabled={submitting} aria-label="Submit Intake">
  {submitting ? 'Checking records...' : 'Submit & Check for Prior Records'}
</Button>
```

- [ ] **Step 2: Update IntakePage tests**

Update `IntakePage.test.tsx` to mock the new match-check endpoint:

```tsx
vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn((path: string, _body?: unknown) => {
      if (path === '/intake/match-check') {
        return Promise.resolve({ candidates: [] });
      }
      return Promise.resolve({ caseId: 'case-id-1', controlNo: 'NORZ-2026-0001' });
    }),
    put: vi.fn(),
    del: vi.fn(),
  },
}));
```

- [ ] **Step 3: Run tests**

```bash
cd kapwa-client && npx vitest run src/pages/IntakePage.test.tsx
```

Expected: Tests pass.

- [ ] **Step 4: Commit**

```bash
git add kapwa-client/src/pages/IntakePage.tsx kapwa-client/src/pages/IntakePage.test.tsx
git commit -m "feat: modify intake submit to check prior records first"
```

---

### Task 5: Frontend — IntakeReviewPage

**Files:**
- Create: `kapwa-client/src/pages/IntakeReviewPage.tsx`
- Create: `kapwa-client/src/pages/IntakeReviewPage.test.tsx`

**Interfaces:**
- Consumes: route state `{ candidates, intakeData }` from `useLocation()`
- Produces: calls `api.post('/intake/confirm/:householdId', intakeData)` or `api.post('/intake', intakeData)`, then navigates to case view

- [ ] **Step 1: Create IntakeReviewPage.tsx**

```tsx
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface MatchCandidate {
  householdId: string;
  score: number;
  primaryBeneficiary: {
    id: string; surname: string; firstName: string; middleName?: string;
    gender: string; age: number; phone: string; occupation: string;
    estimatedMonthlyIncome: number; civilStatus: string;
    currentAddress: Record<string, string> | null;
    philhealthNumber?: string; category?: string;
  };
  allBeneficiaries: Array<{ id: string; surname: string; firstName: string }>;
  familyMembers: Array<{ id: string; fullName: string; relationship: string; age: number; occupation: string; income: number; status: string }>;
  lastApprovedCaseDate: string | null;
}

interface LocationState {
  candidates: MatchCandidate[];
  intakeData: unknown;
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-orange-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold tabular-nums w-10 text-right">{pct}%</span>
    </div>
  );
}

export function IntakeReviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);

  if (!state || !state.candidates) {
    return (
      <PageShell title="Match Review" description="No intake data found">
        <div className="text-center py-12 text-muted-foreground">
          No intake data to review. <Button variant="link" onClick={() => navigate('/intake')}>Go back to intake form</Button>
        </div>
      </PageShell>
    );
  }

  const { candidates, intakeData } = state;
  const intake = (intakeData as any)?.beneficiary || {};
  const family = (intakeData as any)?.familyMembers || [];

  async function handleLink(householdId: string) {
    setLoadingId(householdId);
    try {
      const result = await api.post<{ caseId: string; controlNo: string; nextEligibleDate: string }>(
        `/intake/confirm/${householdId}`,
        intakeData,
      );
      toast.success(`Linked to existing household. Next case eligible: ${new Date(result.nextEligibleDate).toLocaleDateString()}`);
      navigate(`/cases/${result.caseId}`);
    } catch {
      toast.error('Failed to link to household. Please try again.');
    } finally {
      setLoadingId(null);
    }
  }

  async function handleCreateNew() {
    setCreatingNew(true);
    try {
      const result = await api.post<{ caseId: string; controlNo: string }>('/intake', intakeData);
      navigate(`/cases/${result.caseId}`);
    } catch {
      toast.error('Failed to create new client record.');
    } finally {
      setCreatingNew(false);
    }
  }

  function formatDate(iso: string | null) {
    if (!iso) return 'None';
    return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function nextEligibleDate(lastCaseDate: string | null) {
    if (!lastCaseDate) return 'Now';
    const d = new Date(lastCaseDate);
    d.setDate(d.getDate() + 30);
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  return (
    <PageShell
      title="Potential Prior Record Match Review"
      description="Review potential household matches before creating a new record."
    >
      <div className="flex gap-6">
        {/* LEFT: Current Intake Summary */}
        <div className="w-80 shrink-0 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Current Intake</h3>
          <Card className="p-4 space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Name</p>
              <p className="font-medium">{intake.surname}, {intake.firstName} {intake.middleName || ''}</p>
            </div>
            {intake.currentAddress && (
              <div>
                <p className="text-xs text-muted-foreground">Address</p>
                <p>{intake.currentAddress.street || ''}, {intake.currentAddress.barangay || ''}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Demographics</p>
              <p>{intake.gender} · {intake.age || ''} yrs · {intake.civilStatus || ''}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Contact</p>
              <p>{intake.cellularNumber || ''}</p>
            </div>
            {family.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">Family Members</p>
                <ul className="list-disc list-inside text-xs">
                  {family.map((f: any, i: number) => (
                    <li key={i}>{f.fullName} ({f.relationship})</li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Income</p>
              <p>₱{(intake.estimatedMonthlyIncome || 0).toLocaleString()}/mo</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Occupation</p>
              <p>{intake.occupation || ''}</p>
            </div>
          </Card>
        </div>

        {/* RIGHT: Potential Matches */}
        <div className="flex-1 space-y-4 min-w-0">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Potential Matches ({candidates.length})
          </h3>

          {candidates.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">
              <AlertTriangle size={32} className="mx-auto mb-2 opacity-40" />
              <p>No prior records found for this name.</p>
            </Card>
          )}

          {candidates.map((c, i) => (
            <MatchCard
              key={c.householdId}
              candidate={c}
              index={i}
              loading={loadingId === c.householdId}
              onLink={() => handleLink(c.householdId)}
            />
          ))}

          <Separator className="my-4" />

          <div className="text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              If none of these match your client, create a new record.
            </p>
            <Button
              variant="outline"
              onClick={handleCreateNew}
              disabled={creatingNew}
            >
              {creatingNew ? 'Creating...' : 'Create New Client'}
            </Button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function MatchCard({ candidate: c, index, loading, onLink }: {
  candidate: MatchCandidate;
  index: number;
  loading: boolean;
  onLink: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="overflow-hidden">
      {/* Header (collapsed view) */}
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Match #{index + 1}</span>
          <ScoreBar score={c.score} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">{c.primaryBeneficiary.surname}, {c.primaryBeneficiary.firstName}</p>
            <p className="text-sm text-muted-foreground">
              {c.primaryBeneficiary.gender} · {c.primaryBeneficiary.age} yrs · {c.primaryBeneficiary.currentAddress?.barangay || ''}
            </p>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={onLink}
            disabled={loading}
          >
            {loading ? 'Linking...' : 'Link to This Household'}
          </Button>
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>Members: {c.familyMembers.length}</span>
          {c.lastApprovedCaseDate && (
            <>
              <span>Last case: {new Date(c.lastApprovedCaseDate).toLocaleDateString()}</span>
              <span>Next eligible: {new Date(new Date(c.lastApprovedCaseDate).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
            </>
          )}
        </div>
        <button
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Show Less' : 'Show More'}
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t px-4 py-3 space-y-3 text-sm bg-muted/20">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p>{c.primaryBeneficiary.phone || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">PhilHealth</p>
              <p>{c.primaryBeneficiary.philhealthNumber || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Civil Status</p>
              <p>{c.primaryBeneficiary.civilStatus || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Occupation</p>
              <p>{c.primaryBeneficiary.occupation || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Monthly Income</p>
              <p>₱{(c.primaryBeneficiary.estimatedMonthlyIncome || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Category</p>
              <p>{c.primaryBeneficiary.category || '—'}</p>
            </div>
          </div>

          {c.primaryBeneficiary.currentAddress && (
            <div>
              <p className="text-xs text-muted-foreground">Full Address</p>
              <p className="text-xs">
                {c.primaryBeneficiary.currentAddress.street || ''}, {c.primaryBeneficiary.currentAddress.barangay || ''}, {c.primaryBeneficiary.currentAddress.city || ''}, {c.primaryBeneficiary.currentAddress.province || ''}
              </p>
            </div>
          )}

          {c.familyMembers.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">All Family Members</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="text-left py-1">Name</th>
                    <th className="text-left py-1">Relationship</th>
                    <th className="text-right py-1">Age</th>
                    <th className="text-left py-1">Occupation</th>
                    <th className="text-right py-1">Income</th>
                    <th className="text-left py-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {c.familyMembers.map(fm => (
                    <tr key={fm.id} className="border-b border-muted/30">
                      <td className="py-1">{fm.fullName}</td>
                      <td className="py-1">{fm.relationship}</td>
                      <td className="py-1 text-right">{fm.age}</td>
                      <td className="py-1">{fm.occupation || '—'}</td>
                      <td className="py-1 text-right">{fm.income ? `₱${fm.income}` : '—'}</td>
                      <td className="py-1">{fm.status || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {c.allBeneficiaries.length > 1 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Other Beneficiaries in Household</p>
              <div className="flex flex-wrap gap-2">
                {c.allBeneficiaries.filter(b => b.id !== c.primaryBeneficiary.id).map(b => (
                  <span key={b.id} className="text-xs bg-muted px-2 py-1 rounded">{b.surname}, {b.firstName}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Create IntakeReviewPage.test.tsx**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { IntakeReviewPage } from './IntakeReviewPage';
import { axe } from 'vitest-axe';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...(actual as object), useNavigate: () => mockNavigate };
});

vi.mock('../lib/api', () => ({
  api: { post: vi.fn().mockResolvedValue({ caseId: 'case-1', controlNo: 'CTRL-001' }) },
}));

const mockLocationState = {
  candidates: [
    {
      householdId: 'hh-1',
      score: 0.92,
      primaryBeneficiary: {
        id: 'ben-1', surname: 'Dela Cruz', firstName: 'Juan',
        gender: 'Male', age: 40, phone: '09171234567',
        occupation: 'Farmer', estimatedMonthlyIncome: 8500,
        civilStatus: 'Married', currentAddress: { barangay: 'Bigte', street: '123 Purok 1' },
        philhealthNumber: '123456789', category: 'Family',
      },
      allBeneficiaries: [{ id: 'ben-1', surname: 'Dela Cruz', firstName: 'Juan' }],
      familyMembers: [
        { id: 'fm-1', fullName: 'Maria Dela Cruz', relationship: 'Spouse', age: 35, occupation: 'Housewife', income: 0, status: 'Unemployed' },
      ],
      lastApprovedCaseDate: '2025-01-20T00:00:00.000Z',
    },
  ],
  intakeData: {
    beneficiary: { surname: 'Dela Cruz', firstName: 'Juan', currentAddress: { barangay: 'Bigte' } },
    familyMembers: [{ fullName: 'Maria Dela Cruz', relationship: 'Spouse' }],
  },
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...(actual as object),
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: mockLocationState }),
  };
});

describe('IntakeReviewPage', () => {
  it('should render match candidate cards', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/Match #1/i)).toBeDefined();
    expect(screen.getByText(/Dela Cruz, Juan/i)).toBeDefined();
  });

  it('should show 92% score bar', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    expect(screen.getByText('92%')).toBeDefined();
  });

  it('should show current intake summary', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/Current Intake/i)).toBeDefined();
  });

  it('should have expand/collapse on match cards', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    const showMore = screen.getByText(/Show More/i);
    fireEvent.click(showMore);
    expect(screen.getByText(/Show Less/i)).toBeDefined();
    expect(screen.getByText(/PhilHealth/i)).toBeDefined();
  });

  it('should show Create New Client button', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    expect(screen.getByText('Create New Client')).toBeDefined();
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should show empty state when no candidates', async () => {
    vi.mocked(await import('react-router-dom')).useLocation = () => ({
      state: { candidates: [], intakeData: {} },
    } as any);

    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/No prior records found/i)).toBeDefined();
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd kapwa-client && npx vitest run src/pages/IntakeReviewPage.test.tsx
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add kapwa-client/src/pages/IntakeReviewPage.tsx kapwa-client/src/pages/IntakeReviewPage.test.tsx
git commit -m "feat: add intake match review page with split-pane layout"
```

---

### Task 6: Frontend — add route for IntakeReviewPage

**Files:**
- Modify: `kapwa-client/src/routes.tsx`

**Interfaces:**
- Consumes: `IntakeReviewPage` component
- Produces: navigable route `/intake/review`

- [ ] **Step 1: Add import and route**

In `routes.tsx`, add import:

```tsx
import { IntakeReviewPage } from './pages/IntakeReviewPage';
```

Add route after the `/intake` line:

```tsx
{ path: '/intake/review', element: <Private roles={['admin','social_worker','coordinator']}><IntakeReviewPage /></Private> },
```

- [ ] **Step 2: Run typecheck**

```bash
cd kapwa-client && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/src/routes.tsx
git commit -m "feat: add route for intake match review page"
```
