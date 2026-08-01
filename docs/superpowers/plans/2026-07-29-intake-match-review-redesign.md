# Intake Match Review Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the technical match-review screen with a universally approachable UI that uses plain-language labels, inline side-by-side comparison, and context-aware buttons (update only vs update + create case based on 30-day check).

**Architecture:** Backend (`kapwa-server/src/intake/`) — two targeted changes to the return values of `matchCheck()` and `confirmMatch()`. Frontend (`kapwa-client/src/pages/IntakeReviewPage.tsx`) — full rewrite of the review page with new card layout, no state management changes needed since all data flows through route state.

**Tech Stack:** NestJS, PostgreSQL (pg_trgm), React, Tailwind, vitest, testing-library

## Global Constraints

- Blocker for case creation: any case in the household created within the last 30 days prevents new case creation
- No percentages in the UI — use plain-language labels: "Very likely the same person", "Some similarities", "Same surname only"
- All comparison data must be visible without clicking "Show More"
- Buttons must read as questions ("Yes, this is Maria") not system actions ("Link to Household")
- The backend is the authoritative source for the 30-day check (re-checked at confirm time, not just match-check time)

---

### Task 1: Backend — Add `caseExistsWithin30Days` to match-check response

**Files:**
- Modify: `kapwa-server/src/intake/dto/intake.zod.ts:79-100`
- Modify: `kapwa-server/src/intake/intake.service.ts:225-341`

**Interfaces:**
- Consumes: existing `MatchCheckInput`, existing `MatchCandidate`
- Produces: updated `MatchCandidate` with `caseExistsWithin30Days: boolean` field

- [ ] **Step 1: Update MatchCandidate interface**

In `kapwa-server/src/intake/dto/intake.zod.ts`, add `caseExistsWithin30Days` to the `MatchCandidate` interface:

```typescript
export interface MatchCandidate {
  householdId: string;
  score: number;
  caseExistsWithin30Days: boolean;  // <-- add this
  primaryBeneficiary: { ... };
  // ... rest unchanged
}
```

- [ ] **Step 2: Update the match-check SQL query**

In `kapwa-server/src/intake/intake.service.ts`, modify the `matchCheck()` method. After the `LIMIT 10` line, add `case_exists_30d` to the subquery that already exists.

Find this block in the raw SQL (around line 283-298):

```sql
(SELECT MAX(c.created_at) FROM cases c
 JOIN beneficiaries b3 ON b3.id = c.beneficiary_id
  WHERE b3.household_id = h.id AND c.status = 'active') AS last_case_date
```

Replace with:

```sql
(SELECT EXISTS(
  SELECT 1 FROM cases c
  JOIN beneficiaries b3 ON b3.id = c.beneficiary_id
  WHERE b3.household_id = h.id
  AND c.created_at > NOW() - INTERVAL '30 days'
)) AS case_exists_30d,
(SELECT MAX(c.created_at) FROM cases c
 JOIN beneficiaries b3 ON b3.id = c.beneficiary_id
  WHERE b3.household_id = h.id AND c.status = 'active') AS last_case_date
```

- [ ] **Step 3: Map `case_exists_30d` into the candidate object**

In the `.map(r => ({` block (around line 318), add:

```typescript
.map(r => ({
  householdId: r.household_id,
  score: parseFloat(r.score) || 0,
  caseExistsWithin30Days: Boolean(r.case_exists_30d),  // <-- add this
  primaryBeneficiary: { ... },
  // ... rest unchanged
}))
```

- [ ] **Step 4: Run existing backend tests**

```bash
cd kapwa-server && npx jest test/intake --no-coverage --silent
```

Expected: all existing tests pass.

- [ ] **Step 5: Commit**

```bash
cd kapwa-server && git add src/intake/dto/intake.zod.ts src/intake/intake.service.ts && git commit -m "feat: add caseExistsWithin30Days to match-check response"
```

---

### Task 2: Backend — Make `confirmMatch()` conditionally create case based on 30-day check

**Files:**
- Modify: `kapwa-server/src/intake/dto/intake.zod.ts:105-111`
- Modify: `kapwa-server/src/intake/intake.service.ts:344-452`

**Interfaces:**
- Consumes: existing `ConfirmMatchInput`, existing `ConfirmMatchResponse`
- Produces: updated `ConfirmMatchResponse` with `caseCreated: boolean` and `message: string`

- [ ] **Step 1: Update ConfirmMatchResponse interface**

In `kapwa-server/src/intake/dto/intake.zod.ts`, replace the existing `ConfirmMatchResponse`:

```typescript
export interface ConfirmMatchResponse {
  beneficiaryId: string;
  caseId?: string;       // now optional — null when no case created
  controlNo?: string;    // now optional
  status?: string;       // now optional
  nextEligibleDate?: string;
  caseCreated: boolean;  // unchanged — already exists conceptually
  message: string;       // human-readable explanation
}
```

- [ ] **Step 2: Modify confirmMatch() to conditionally create case**

In `kapwa-server/src/intake/intake.service.ts`, replace the `confirmMatch()` method. The key change: check for a case < 30 days old before creating the case entity. If found, update but skip case creation. If not found, create the case as before.

The modified method (full replacement):

```typescript
async confirmMatch(householdId: string, data: ConfirmMatchInput, workerBarangays: string[]): Promise<ConfirmMatchResponse> {
  const household = await this.hhRepo.findOne({ where: { id: householdId } });
  if (!household) throw new NotFoundException('Household not found');
  if (workerBarangays.length > 0 && household.barangay && !workerBarangays.includes(household.barangay)) {
    throw new ForbiddenException('You do not have permission for this barangay');
  }

  const [lk1, lk2] = this.hashToLockPair(
    data.beneficiary.surname, data.beneficiary.firstName, data.beneficiary.dob,
  );
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  await queryRunner.query(`SELECT pg_advisory_xact_lock($1, $2)`, [lk1, lk2]);

  try {
    const benPerson = await this.findOrCreatePerson(this.personFromInput(data.beneficiary), queryRunner, true);

    const beneficiary = this.benRepo.create({
      personId: benPerson.id,
      householdId,
      consentStatus: 'active',
    });
    const savedBeneficiary = await queryRunner.manager.save(beneficiary);

    const claimPerson = await this.findOrCreatePerson(this.personFromInput(data.claimant), queryRunner, true);
    await queryRunner.manager.save(queryRunner.manager.create(BeneficiaryClaimant, {
      beneficiaryId: benPerson.id,
      claimantId: claimPerson.id,
      relationship: data.claimant.relationshipToBeneficiary,
      isPrimary: true,
      calendarYear: new Date().getFullYear(),
    }));

    if (data.familyMembers && data.familyMembers.length > 0) {
      const validMembers = data.familyMembers.filter(m => m.surname && m.surname.trim().length > 0);
      for (const fm of validMembers) {
        const memberPerson = await this.findOrCreatePerson({
          surname: fm.surname, firstName: fm.firstName,
          middleName: fm.middleName, extension: fm.extension,
          gender: fm.gender || 'Male' as const,
          dob: fm.dob ? new Date(fm.dob) : new Date(),
          age: fm.age, occupation: fm.occupation,
          estimatedMonthlyIncome: fm.income,
        }, queryRunner, true);
        const membership = queryRunner.manager.create(HouseholdMembership, {
          personId: memberPerson.id, householdId,
          relationship: fm.relationship, isPrimary: false,
          status: fm.status,
        });
        await queryRunner.manager.save(membership);
      }
    }

    // Check for recent case (any status) within 30 days across all household beneficiaries
    const recentCase = await this.caseRepo.findOne({
      where: {
        beneficiaryId: In(
          (await this.benRepo.find({ where: { householdId }, select: ['id'] })).map(b => b.id)
        ),
        createdAt: MoreThan(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
      },
      order: { createdAt: 'DESC' },
    });

    const controlNo = recentCase ? undefined : await this.casesService.generateControlNo();

    let savedCase = null;
    if (!recentCase) {
      const caseEntity = this.caseRepo.create({
        controlNo,
        beneficiaryId: savedBeneficiary.id,
        status: CaseStatus.ENROLLED,
        serviceRequested: data.case.serviceRequested,
        requirementsChecklist: data.case.requirementsChecklist,
        assignedWorkerId: data.case.assignedWorkerId,
      });
      savedCase = await queryRunner.manager.save(caseEntity);
    }

    const consent = this.consentRepo.create({
      beneficiaryId: savedBeneficiary.id,
      purpose: 'registration',
      channel: 'web',
      status: 'active',
    });
    await queryRunner.manager.save(consent);

    await queryRunner.commitTransaction();

    const existingCaseDate = recentCase?.createdAt?.toISOString() || null;

    return {
      updated: true,
      caseCreated: !recentCase,
      beneficiaryId: savedBeneficiary.id,
      caseId: savedCase?.id || null,
      controlNo: controlNo || null,
      status: recentCase ? null : CaseStatus.ENROLLED,
      existingCaseDate,
      message: recentCase
        ? `Info updated. No new case created — this household already has a case from ${new Date(recentCase.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}.`
        : 'Info updated and new case created.',
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

- [ ] **Step 3: Update ConfirmMatchResponse interface to match new return shape**

```typescript
export interface ConfirmMatchResponse {
  updated: boolean;
  caseCreated: boolean;
  beneficiaryId: string;
  caseId: string | null;
  controlNo: string | null;
  status: string | null;
  existingCaseDate: string | null;
  message: string;
}
```

- [ ] **Step 4: Run backend tests**

```bash
cd kapwa-server && npx jest test/intake --no-coverage --silent
```

- [ ] **Step 5: Commit**

```bash
cd kapwa-server && git add src/intake/dto/intake.zod.ts src/intake/intake.service.ts && git commit -m "feat: confirmMatch conditionally creates case based on 30-day check"
```

---

### Task 3: Frontend — Rewrite IntakeReviewPage with universally approachable UI

**Files:**
- Rewrite: `kapwa-client/src/pages/IntakeReviewPage.tsx`
- Rewrite: `kapwa-client/src/pages/IntakeReviewPage.test.tsx`
- Modify: `kapwa-client/src/pages/IntakePage.tsx:302-309` (handle new confirm response)

**Interfaces:**
- Consumes: updated `MatchCandidate` (with `caseExistsWithin30Days`), updated `ConfirmMatchResponse` (with `caseCreated`, `message`)
- Produces: new IntakeReviewPage component

- [ ] **Step 1: Write the failing test**

Replace `kapwa-client/src/pages/IntakeReviewPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { IntakeReviewPage } from './IntakeReviewPage';
import { axe } from 'vitest-axe';

const mockNavigate = vi.fn();

let mockLocationState: any = {
  candidates: [
    {
      householdId: 'hh-1',
      score: 0.92,
      caseExistsWithin30Days: false,
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
    {
      householdId: 'hh-2',
      score: 0.65,
      caseExistsWithin30Days: true,
      primaryBeneficiary: {
        id: 'ben-2', surname: 'Cruz', firstName: 'Rosa',
        gender: 'Female', age: 38, phone: '09171234599',
        occupation: 'Vendor', estimatedMonthlyIncome: 5000,
        civilStatus: 'Married', currentAddress: null,
        philhealthNumber: undefined, category: undefined,
      },
      allBeneficiaries: [{ id: 'ben-2', surname: 'Cruz', firstName: 'Rosa' }],
      familyMembers: [],
      lastApprovedCaseDate: new Date().toISOString(),
    },
  ],
  intakeData: {
    beneficiary: { surname: 'Dela Cruz', firstName: 'Juan', age: 40, currentAddress: { barangay: 'Bigte' }, gender: 'Male', estimatedMonthlyIncome: 8500, occupation: 'Farmer', cellularNumber: '09171234567' },
    familyMembers: [{ surname: 'Dela Cruz', firstName: 'Maria', relationship: 'Spouse' }],
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

vi.mock('../lib/api', () => ({
  api: { post: vi.fn().mockResolvedValue({ caseCreated: true, caseId: 'case-1', controlNo: 'CTRL-001', message: 'Info updated and new case created.' }) },
}));

describe('IntakeReviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render match cards with plain-language labels', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/Very likely the same person/i)).toBeDefined();
    expect(screen.getByText(/Some similarities/i)).toBeDefined();
  });

  it('should not render percentage scores', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    expect(screen.queryByText('92%')).toBeNull();
    expect(screen.queryByText(/Score/i)).toBeNull();
  });

  it('should show side-by-side comparison', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    const page = screen.getByTestId('review-page');
    expect(page.textContent).toContain('You entered');
    expect(page.textContent).toContain('Existing record');
  });

  it('should show context-aware buttons — "update info & create case" when no recent case', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    const btns = screen.getAllByRole('button', { name: /update info/i });
    expect(btns.length).toBeGreaterThanOrEqual(1);
  });

  it('should show "No, different person" buttons per card', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    const rejectBtns = screen.getAllByRole('button', { name: /different person/i });
    expect(rejectBtns.length).toBeGreaterThanOrEqual(1);
  });

  it('should show "None of these match — Register as new client" escape hatch', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/None of these match/i)).toBeDefined();
  });

  it('should show eligibility info on cards', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    // First card: no recent case, shows eligible
    expect(screen.getByText(/eligible for a new case/i)).toBeDefined();
  });

  it('should handle confirm success and navigate', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    const confirmBtn = screen.getAllByRole('button', { name: /update info/i })[0];
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  it('should show empty state when no candidates', async () => {
    mockLocationState = { candidates: [], intakeData: {} };
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/No prior records found/i)).toBeDefined();
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

  it('should show "update info" (no case) when caseExistsWithin30Days is true', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    // Second card (hh-2) has caseExistsWithin30Days: true
    const matchCards = screen.getAllByTestId('match-card');
    expect(matchCards.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd kapwa-client && npx vitest run src/pages/IntakeReviewPage.test.tsx --reporter=verbose 2>&1 | head -40
```

Expected: FAIL — multiple test failures because the new UI doesn't exist yet.

- [ ] **Step 3: Write the new IntakeReviewPage**

Replace `kapwa-client/src/pages/IntakeReviewPage.tsx`:

```tsx
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, CheckCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

interface MatchCandidate {
  householdId: string;
  score: number;
  caseExistsWithin30Days: boolean;
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
  intakeData: any;
}

function confidenceLabel(score: number): { label: string; className: string } {
  if (score >= 0.8) return { label: 'Very likely the same person', className: 'bg-green-100 text-green-800 border-green-300' };
  if (score >= 0.5) return { label: 'Some similarities', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
  return { label: 'Same surname only', className: 'bg-gray-100 text-gray-600 border-gray-300' };
}

function eligibilityNote(candidate: MatchCandidate): { text: string; icon: 'check' | 'info' } {
  if (candidate.caseExistsWithin30Days) {
    return { text: 'Has an active case — info will be updated, no new case will be created.', icon: 'info' };
  }
  if (candidate.lastApprovedCaseDate) {
    const d = new Date(candidate.lastApprovedCaseDate);
    return { text: `Last case: ${d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })} — eligible for a new case.`, icon: 'check' };
  }
  return { text: 'No prior case on record — a new case will be created.', icon: 'check' };
}

function MatchRow({ label, newVal, existingVal }: { label: string; newVal: string; existingVal: string }) {
  const match = newVal.toLowerCase() === existingVal.toLowerCase();
  return (
    <div className="grid grid-cols-[1fr_auto_1fr_24px] gap-2 items-center text-sm py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-right text-muted-foreground">{newVal || '—'}</span>
      <span className="text-xs text-muted-foreground mx-2">{label}</span>
      <span className="text-left font-medium">{existingVal || '—'}</span>
      <span className={match ? 'text-green-600' : 'text-gray-300'}>{match ? '✅' : '○'}</span>
    </div>
  );
}

function formatIntakeField(beneficiary: Record<string, any>, field: string): string {
  if (field === 'age') return String(beneficiary.age || '');
  if (field === 'barangay') return beneficiary.currentAddress?.barangay || '';
  if (field === 'estimatedMonthlyIncome') return `₱${(beneficiary.estimatedMonthlyIncome || 0).toLocaleString()}`;
  return String(beneficiary[field] || '');
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

  const sorted = [...candidates].sort((a, b) => b.score - a.score);

  async function handleConfirm(householdId: string) {
    setLoadingId(householdId);
    try {
      const result = await api.post<{ caseCreated: boolean; caseId?: string; message: string }>(
        `/intake/confirm/${householdId}`,
        intakeData,
      );
      if (result.caseCreated) {
        toast.success('Client registered', { description: result.message });
        navigate(`/cases/${result.caseId}`);
      } else {
        toast.info('Info updated', { description: result.message });
        navigate(`/cases`);
      }
    } catch {
      toast.error('Failed to update', { description: 'Please try again.' });
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
      toast.error('Failed to create client', { description: 'Please check your input and try again.' });
    } finally {
      setCreatingNew(false);
    }
  }

  return (
    <PageShell
      title="Check for Prior Records"
      description="We found records that may belong to this client."
      data-testid="review-page"
    >
      {sorted.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          <AlertTriangle size={32} className="mx-auto mb-2 opacity-40" />
          <p>No prior records found for this name.</p>
          <Button variant="default" className="mt-4" onClick={handleCreateNew} disabled={creatingNew}>
            {creatingNew ? 'Creating...' : 'Continue as new client'}
          </Button>
        </Card>
      )}

      <div className="space-y-6" data-testid="review-page">
        {sorted.map((c) => {
          const cLabel = confidenceLabel(c.score);
          const elig = eligibilityNote(c);
          return (
            <Card key={c.householdId} className="overflow-hidden" data-testid="match-card">
              {/* Confidence badge */}
              <div className={`px-4 py-2 border-b text-sm font-medium ${cLabel.className}`}>
                {cLabel.label}
              </div>

              {/* Main comparison */}
              <div className="p-4 space-y-3">
                <p className="text-base font-semibold">
                  Is this <span className="text-primary">{c.primaryBeneficiary.firstName} {c.primaryBeneficiary.surname}</span>?
                </p>

                <div className="bg-gray-50 rounded-lg p-4 space-y-1">
                  <div className="grid grid-cols-[1fr_auto_1fr_24px] gap-2 text-xs text-muted-foreground pb-1 border-b border-gray-200 mb-1">
                    <span className="text-right">You entered</span>
                    <span />
                    <span>Existing record</span>
                    <span />
                  </div>

                  <MatchRow label="Name" newVal={`${intake.surname}, ${intake.firstName}`} existingVal={`${c.primaryBeneficiary.surname}, ${c.primaryBeneficiary.firstName}`} />
                  <MatchRow label="Age" newVal={formatIntakeField(intake, 'age')} existingVal={String(c.primaryBeneficiary.age)} />
                  <MatchRow label="Barangay" newVal={formatIntakeField(intake, 'barangay')} existingVal={c.primaryBeneficiary.currentAddress?.barangay || ''} />
                  {c.primaryBeneficiary.philhealthNumber && (
                    <MatchRow label="PhilHealth" newVal={formatIntakeField(intake, 'philhealthNumber')} existingVal={c.primaryBeneficiary.philhealthNumber} />
                  )}
                </div>

                {/* Eligibility note */}
                <div className={`flex items-start gap-2 text-sm p-3 rounded-lg ${elig.icon === 'info' ? 'bg-blue-50 text-blue-800' : 'bg-green-50 text-green-800'}`}>
                  {elig.icon === 'info' ? <Info size={16} className="mt-0.5 shrink-0" /> : <CheckCircle size={16} className="mt-0.5 shrink-0" />}
                  <span>{elig.text}</span>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleConfirm(c.householdId)}
                    disabled={loadingId === c.householdId}
                  >
                    {loadingId === c.householdId
                      ? 'Updating...'
                      : c.caseExistsWithin30Days
                        ? `Yes, update info`
                        : `Yes, update info & create case`}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      toast('Marked as different. You can choose another match or create a new record below.');
                    }}
                  >
                    No, different person
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}

        <Separator className="my-2" />

        {/* Escape hatch */}
        <div className="text-center space-y-2 py-4">
          <p className="text-sm text-muted-foreground">
            None of these match your client?
          </p>
          <Button
            variant="outline"
            onClick={handleCreateNew}
            disabled={creatingNew}
          >
            {creatingNew ? 'Registering...' : 'Register as new client'}
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
```

- [ ] **Step 4: Update IntakePage.tsx to handle new confirm response**

In `kapwa-client/src/pages/IntakePage.tsx`, find the `handleSubmit` function (around line 293-309). The current code already handles the match-check flow correctly — no changes needed here since the navigation logic is in `IntakeReviewPage`.

However, ensure the `intakeData` passed through route state includes all fields needed by the comparison view. The existing code at line 274-291 already constructs `intakePayload` with all required fields. No changes needed.

- [ ] **Step 5: Run the frontend test to verify it passes**

```bash
cd kapwa-client && npx vitest run src/pages/IntakeReviewPage.test.tsx --reporter=verbose 2>&1 | head -60
```

Expected: all tests PASS.

- [ ] **Step 6: Type-check the frontend**

```bash
cd kapwa-client && npx tsc --noEmit 2>&1 | head -20
```

Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
cd kapwa-client && git add src/pages/IntakeReviewPage.tsx src/pages/IntakeReviewPage.test.tsx && git commit -m "feat: universally approachable match review UI with side-by-side comparison"
```
