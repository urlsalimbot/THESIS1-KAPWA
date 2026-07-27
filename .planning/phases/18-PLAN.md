# Phase 18: DSWD KILOS UNLAD Case Management Alignment

**Goal:** Align Kapwa's case management workflow with the official DSWD KILOS UNLAD framework (3 phases, 6 steps).

**Created:** 2026-07-22

---

## Context

The DSWD KILOS UNLAD (Kapit-Bisig Laban sa Kahirapan - Comprehensive and Integrated Delivery of Social Services) uses a standardized case management process with 3 phases and 6 steps. Kapwa currently has a 4-step stepper that doesn't map to this framework.

### DSWD KILOS UNLAD Framework

| Phase | Step | Name | Key Activities | CM Forms |
|-------|------|------|----------------|----------|
| I: Phase-In | 1 | Enrollment | Registration, community assemblies, intake | CM Form 1 (General Intake) |
| I: Phase-In | 2 | Assess & Analyze | Home visit, family dialogue, SWDI, FRVA | CM Form 3 (FRVA), SWDI |
| II: Implementation | 3 | Implement HIP | Cash transfers, FDS/YDS, health, education, livelihood | CM Form 4 (HIP), CM Form 9 (Progress) |
| II: Implementation | 4 | Integrated Delivery | Referrals, networking, community resources | CM Form 2A (Referral), CM Form 7B (Resource Mapping) |
| III: Phase-Out | 5 | Transition/Graduation | Achieve Level 3 self-sufficiency, transition plan goals | CM Form 18 (Transition), CM Form 20 (Sustainability) |
| III: Phase-Out | 6 | Case Closure | Formal exit from program | — |

### Current Kapwa State

| Current Step | Mapped DSWD Step | Gap |
|--------------|------------------|-----|
| Assessment | Step 2 (partial) | Missing FRVA, SWDI, family dialogue |
| Interventions | Step 3 (partial) | Missing referral tracking |
| Exit Plan | Step 4 + 5 (partial) | Mixed referrals + transition |
| Signatures | Step 6 (partial) | Missing closure outcome |

---

## Implementation Plan

### Task 1: Update CaseStatus Enum (Server)

**File:** `kapwa-server/src/cases/case.entity.ts`

Replace the current `CaseStatus` enum:

```typescript
// OLD
export enum CaseStatus {
  PENDING = 'pending_assessment',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  DISBURSED = 'disbursed',
  CLOSED = 'closed'
}

// NEW
export enum CaseStatus {
  ENROLLED = 'enrolled',
  ASSESSED = 'assessed',
  IN_REVIEW = 'in_review',
  ACTIVE = 'active',
  TRANSITIONING = 'transitioning',
  CLOSED = 'closed'
}
```

**Status Transitions (DSWD-aligned):**
```
ENROLLED → ASSESSED → IN_REVIEW → ACTIVE → TRANSITIONING → CLOSED
```

### Task 2: Add New Entity Fields (Server)

**File:** `kapwa-server/src/cases/case.entity.ts`

Add fields for DSWD assessment tools and transition tracking:

```typescript
// Assessment fields (Step 2)
@Column({ name: 'frva_score', type: 'decimal', precision: 5, scale: 2, nullable: true })
frvaScore?: number;

@Column({ name: 'swdi_score', type: 'decimal', precision: 5, scale: 2, nullable: true })
swdiScore?: number;

@Column({ name: 'family_dialogue_notes', type: 'text', nullable: true })
familyDialogueNotes?: string;

// Transition fields (Step 5)
@Column({ name: 'self_reliance_level', type: 'int', nullable: true })
selfRelianceLevel?: number; // 1-3 scale

@Column({ name: 'sustainability_plan', type: 'text', nullable: true })
sustainabilityPlan?: string;

@Column({ name: 'transition_date', type: 'date', nullable: true })
transitionDate?: string;

// Closure fields (Step 6)
@Column({ name: 'closure_outcome', nullable: true })
closureOutcome?: string;

@Column({ name: 'closure_date', type: 'date', nullable: true })
closureDate?: string;

// Follow-up tracking
@Column({ name: 'follow_up_visits', type: 'jsonb', nullable: true })
followUpVisits?: Array<{
  date: string;
  type: string;
  notes: string;
  outcome: string;
}>;
```

### Task 3: Update Zod Schemas (Server)

**File:** `kapwa-server/src/cases/dto/cases.zod.ts`

Add new schemas:

```typescript
export const AssessmentV2Schema = z.object({
  problemsPresented: z.string().min(1, 'Problem/s presented is required'),
  socialWorkerAssessment: z.string().min(1, 'Social worker assessment is required'),
  clientCategory: z.enum([...]),
  frvaScore: z.number().min(0).max(100).optional(),
  swdiScore: z.number().min(0).max(100).optional(),
  familyDialogueNotes: z.string().optional(),
  natureOfService: z.array(z.string()).optional(),
  // ... existing fields
});

export const TransitionSchema = z.object({
  selfReliancePlan: z.string().nullable().optional(),
  selfRelianceLevel: z.number().min(1).max(3).nullable().optional(),
  sustainabilityPlan: z.string().nullable().optional(),
  transitionDate: z.string().nullable().optional(),
  referrals: z.array(z.object({...})).nullable().optional(),
});

export const ClosureSchema = z.object({
  closureOutcome: z.enum([
    'graduated',
    'self-sufficient',
    'referred',
    'incomplete',
    'deceased',
  ]),
  exitNotes: z.string().optional(),
  clientSignature: z.string().optional(),
});
```

### Task 4: Update Cases Service (Server)

**File:** `kapwa-server/src/cases/cases.service.ts`

Update transition logic to match DSWD flow:

```typescript
const transitions: Record<CaseStatus, CaseStatus[]> = {
  [CaseStatus.ENROLLED]: [CaseStatus.ASSESSED, CaseStatus.CLOSED],
  [CaseStatus.ASSESSED]: [CaseStatus.IN_REVIEW, CaseStatus.CLOSED],
  [CaseStatus.IN_REVIEW]: [CaseStatus.ACTIVE, CaseStatus.CLOSED],
  [CaseStatus.ACTIVE]: [CaseStatus.TRANSITIONING, CaseStatus.CLOSED],
  [CaseStatus.TRANSITIONING]: [CaseStatus.CLOSED],
  [CaseStatus.CLOSED]: [],
};
```

Update validation rules:
- `ENROLLED → ASSESSED`: Require problemsPresented, socialWorkerAssessment, clientCategory
- `ASSESSED → IN_REVIEW`: Require frvaScore OR swdiScore
- `IN_REVIEW → ACTIVE`: Require at least 1 intervention logged
- `ACTIVE → TRANSITIONING`: Require selfRelianceLevel, sustainabilityPlan
- `TRANSITIONING → CLOSED`: Require clientSignature, closureOutcome

### Task 5: Update Frontend Stepper (Client)

**File:** `kapwa-client/src/components/case-view/CaseStepper.tsx`

Expand from 4 to 6 steps:

```typescript
const STEPS = [
  { label: 'Enrollment', description: 'Registration & intake', phase: 'Phase-In' },
  { label: 'Assessment', description: 'FRVA & SWDI analysis', phase: 'Phase-In' },
  { label: 'Implement HIP', description: 'Intervention delivery', phase: 'Implementation' },
  { label: 'Integrated Delivery', description: 'Referrals & resources', phase: 'Implementation' },
  { label: 'Transition', description: 'Graduation readiness', phase: 'Phase-Out' },
  { label: 'Closure', description: 'Formal exit', phase: 'Phase-Out' },
];
```

Update `isStepDone` logic:
- Step 0 (Enrollment): Always done (case exists = enrolled)
- Step 1 (Assessment): `problemsPresented && clientCategory`
- Step 2 (Implement HIP): `interventionCount > 0`
- Step 3 (Integrated Delivery): `referrals.length > 0` OR skip if no referrals needed
- Step 4 (Transition): `selfRelianceLevel && sustainabilityPlan`
- Step 5 (Closure): `clientSignature && closureOutcome`

Add phase group headers to visually separate Phase-In / Implementation / Phase-Out.

### Task 6: Create New Step Components (Client)

#### 6a: StepEnrollment.tsx (NEW)

Display enrollment summary (from intake):
- Beneficiary info (already in sidebar)
- Case control number
- Service requested
- Assigned worker
- Date enrolled

This is mostly read-only since enrollment happens during intake.

#### 6b: Update StepAssessment.tsx

Add FRVA and SWDI fields:

```typescript
// New fields to add
<div className="space-y-1.5">
  <label className="text-sm font-medium">FRVA Score (0-100)</label>
  <Input type="number" min="0" max="100" ... />
</div>
<div className="space-y-1.5">
  <label className="text-sm font-medium">SWDI Score (0-100)</label>
  <Input type="number" min="0" max="100" ... />
</div>
<div className="space-y-1.5">
  <label className="text-sm font-medium">Family Dialogue Notes</label>
  <textarea ... />
</div>
```

#### 6c: Update StepInterventions.tsx → StepImplementHIP.tsx

Rename and keep existing functionality (intervention logging).

#### 6d: StepIntegratedDelivery.tsx (NEW - extracted from ExitPlan)

Move referral management here:
- Add/edit/delete referrals
- Track referral status (pending/completed/declined)
- Community resource mapping

#### 6e: StepTransition.tsx (NEW - replaces ExitPlan)

New fields:
- Self-reliance level (1-3 radio)
- Sustainability plan textarea
- Transition date
- Follow-up visit log

#### 6f: StepClosure.tsx (NEW - replaces Signatures)

New fields:
- Closure outcome dropdown (graduated, self-sufficient, referred, incomplete, deceased)
- Exit notes
- Client signature
- Final documents

### Task 7: Update CaseViewPage (Client)

**File:** `kapwa-client/src/pages/CaseViewPage.tsx`

Update imports and step components:

```typescript
import { StepEnrollment } from '@/components/case-view/StepEnrollment';
import { StepAssessment } from '@/components/case-view/StepAssessment';
import { StepImplementHIP } from '@/components/case-view/StepImplementHIP';
import { StepIntegratedDelivery } from '@/components/case-view/StepIntegratedDelivery';
import { StepTransition } from '@/components/case-view/StepTransition';
import { StepClosure } from '@/components/case-view/StepClosure';

const stepComponents = [
  <StepEnrollment key="enrollment" caseData={caseData} />,
  <StepAssessment key="assessment" caseData={caseData} assessment={assessment}
    onAssessmentChange={setAssessment} onSave={saveAssessment} saving={savingAssessment} />,
  <StepImplementHIP key="hip" caseId={id!} caseData={caseData} userRole={user?.role} />,
  <StepIntegratedDelivery key="delivery" caseId={id!} caseData={caseData} />,
  <StepTransition key="transition" caseId={id!} caseData={caseData} />,
  <StepClosure key="closure" caseId={id!} caseData={caseData} />,
];
```

Update `STATUS_LABELS` and `STATUS_BADGES` for new statuses.

### Task 8: Database Migration (Server)

**File:** `kapwa-server/src/migrations/XXXX-AlignCaseStatusKilosUnlad.ts`

Migration steps:
1. Add new columns to `cases` table
2. Update existing cases to new status values
3. Drop old enum values, add new ones
4. Update any foreign key references

```sql
-- Add new columns
ALTER TABLE cases ADD COLUMN frva_score DECIMAL(5,2);
ALTER TABLE cases ADD COLUMN swdi_score DECIMAL(5,2);
ALTER TABLE cases ADD COLUMN family_dialogue_notes TEXT;
ALTER TABLE cases ADD COLUMN self_reliance_level INTEGER;
ALTER TABLE cases ADD COLUMN sustainability_plan TEXT;
ALTER TABLE cases ADD COLUMN transition_date DATE;
ALTER TABLE cases ADD COLUMN closure_outcome VARCHAR(50);
ALTER TABLE cases ADD COLUMN closure_date DATE;
ALTER TABLE cases ADD COLUMN follow_up_visits JSONB;

-- Update status values
UPDATE cases SET status = 'enrolled' WHERE status = 'pending_assessment';
UPDATE cases SET status = 'assessed' WHERE status = 'in_review';
UPDATE cases SET status = 'active' WHERE status = 'approved';
UPDATE cases SET status = 'active' WHERE status = 'disbursed';
-- closed stays as closed
```

### Task 9: Update Tests (Server)

**File:** `kapwa-server/src/cases/__tests__/cases.service.spec.ts`

Update test cases for new status transitions and validation rules.

### Task 10: Update Frontend Tests (Client)

Update any existing stepper or case view tests to reflect new step count and labels.

---

## File Changes Summary

### Server Files
| File | Action | Description |
|------|--------|-------------|
| `kapwa-server/src/cases/case.entity.ts` | Edit | Update CaseStatus enum, add new columns |
| `kapwa-server/src/cases/dto/cases.zod.ts` | Edit | Add new schemas (AssessmentV2, Transition, Closure) |
| `kapwa-server/src/cases/cases.service.ts` | Edit | Update transitions, validation, new methods |
| `kapwa-server/src/cases/cases.controller.ts` | Edit | Add new endpoints if needed |
| `kapwa-server/src/migrations/XXXX-*.ts` | Create | Database migration |

### Client Files
| File | Action | Description |
|------|--------|-------------|
| `kapwa-client/src/components/case-view/CaseStepper.tsx` | Edit | 4→6 steps, phase headers |
| `kapwa-client/src/components/case-view/StepEnrollment.tsx` | Create | New enrollment summary step |
| `kapwa-client/src/components/case-view/StepAssessment.tsx` | Edit | Add FRVA, SWDI, family dialogue |
| `kapwa-client/src/components/case-view/StepInterventions.tsx` | Rename | → StepImplementHIP.tsx |
| `kapwa-client/src/components/case-view/StepIntegratedDelivery.tsx` | Create | Referral management |
| `kapwa-client/src/components/case-view/StepTransition.tsx` | Create | Transition/graduation |
| `kapwa-client/src/components/case-view/StepClosure.tsx` | Create | Case closure |
| `kapwa-client/src/pages/CaseViewPage.tsx` | Edit | Update imports and step components |

---

## Verification

1. `npm run build` in both server and client
2. `npx vitest run` passes all existing tests
3. Manual testing: Create new case → walk through all 6 steps → close case
4. Verify status transitions match DSWD KILOS UNLAD flow
5. Verify CM Form equivalents are captured at each step

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing cases | High | Migration maps old statuses to new ones |
| Test failures | Medium | Update tests in same PR |
| UI regression | Medium | Visual comparison before/after |
| Performance impact | Low | New columns are nullable, no index changes |
