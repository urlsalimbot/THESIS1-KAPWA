# Case Lifecycle Stepper — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the CaseViewPage into a 5-stage stepper (Client Profile → Assessment → Interventions → Exit Plan → Signatures) with full backend support for intervention delivery records and transition/exit plans.

**Architecture:** Add `case_interventions` entity for delivery records (linked to programs or ad-hoc services), add transition/exit plan JSONB fields to `cases` entity, replace the flat CaseViewPage with a stepper UI that guides social workers through the case lifecycle.

**Tech Stack:** NestJS + TypeORM (backend), React + SWR + shadcn/ui (frontend), PostgreSQL

## Global Constraints

- URI-based API versioning: routes `/api/v1/...`
- Auth: JWT via `JwtAuthGuard`, roles via `@Roles()` decorator
- Frontend: React + SWR + Vite at `kapwa-client`
- Backend: NestJS + TypeORM at `kapwa-server`
- DB: PostgreSQL in podman container `kapwa-pg` (user: kapwa, pass: kapwa, db: kapwa)
- Must kill old PID before restart — stale compiled JS causes stale data
- Server start: `nohup npx nest start --watch > /tmp/kapwa-server.log 2>&1 &`
- Frontend dev: `cd kapwa-client && npx vite --port 5173 --host`
- Seed DB: `npx ts-node src/database/seed.ts`

---

## File Structure

### Backend (new/modified)

| File | Action | Purpose |
|------|--------|---------|
| `src/case-interventions/case-intervention.entity.ts` | **Create** | Delivery record entity |
| `src/case-interventions/case-interventions.module.ts` | **Create** | NestJS module |
| `src/case-interventions/case-interventions.service.ts` | **Create** | CRUD for interventions |
| `src/case-interventions/case-interventions.controller.ts` | **Create** | REST endpoints |
| `src/case-interventions/dto/case-interventions.zod.ts` | **Create** | Zod validation schemas |
| `src/cases/case.entity.ts` | **Modify** | Add transition/exit plan fields |
| `src/cases/cases.service.ts` | **Modify** | Add `getCaseInterventions`, `addCaseIntervention`, `updateCaseIntervention`, `deleteCaseIntervention`, `updateTransitionPlan` methods |
| `src/cases/cases.controller.ts` | **Modify** | Add intervention + transition plan endpoints |
| `src/app.module.ts` | **Modify** | Register CaseInterventionsModule |

### Frontend (new/modified)

| File | Action | Purpose |
|------|--------|---------|
| `src/components/case-view/CaseStepper.tsx` | **Create** | Stepper navigation component |
| `src/components/case-view/StepClientProfile.tsx` | **Create** | Stage 1: Client & Family Profile |
| `src/components/case-view/StepAssessment.tsx` | **Create** | Stage 2: Assessment & Diagnosis |
| `src/components/case-view/StepInterventions.tsx` | **Create** | Stage 3: Intervention Record |
| `src/components/case-view/StepExitPlan.tsx` | **Create** | Stage 4: Transition/Exit Plan |
| `src/components/case-view/StepSignatures.tsx` | **Create** | Stage 5: Signatures & Approval |
| `src/pages/CaseViewPage.tsx` | **Modify** | Replace flat layout with stepper |
| `src/lib/query-keys.ts` | **Modify** | Add caseInterventions query key |

---

## Task 1: Create `case_interventions` Entity & Migration

**Files:**
- Create: `kapwa-server/src/case-interventions/case-intervention.entity.ts`
- Modify: `kapwa-server/src/database/seed.ts` (truncate list)

**Interfaces:**
- Produces: `CaseIntervention` entity class with fields: id, caseId, programId (nullable), serviceName, category, deliveryDate, amount, modeOfDelivery, fundSource, notes, deliveredBy, createdAt, updatedAt

- [ ] **Step 1: Create the entity file**

```typescript
// kapwa-server/src/case-interventions/case-intervention.entity.ts
import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('case_interventions')
export class CaseIntervention extends BaseEntity {

  @Column({ name: 'case_id' })
  caseId!: string;

  @Column({ name: 'program_id', nullable: true })
  programId?: string;

  @Column({ name: 'service_name' })
  serviceName!: string;

  @Column({ nullable: true })
  category?: string;

  @Column({ name: 'delivery_date', type: 'date', nullable: true })
  deliveryDate?: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  amount?: number;

  @Column({ name: 'mode_of_delivery', nullable: true })
  modeOfDelivery?: string;

  @Column({ name: 'fund_source', nullable: true })
  fundSource?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'delivered_by', nullable: true })
  deliveredBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
```

- [ ] **Step 2: Verify entity compiles**

Run: `cd /home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-server && npx tsc --noEmit src/case-interventions/case-intervention.entity.ts 2>&1 | head -5`
Expected: No errors (or only import resolution errors which are fine)

- [ ] **Step 3: Commit**

```bash
git add kapwa-server/src/case-interventions/case-intervention.entity.ts
git commit -m "feat: add CaseIntervention entity for intervention delivery records"
```

---

## Task 2: Create CaseInterventions Module, Service, Controller

**Files:**
- Create: `kapwa-server/src/case-interventions/dto/case-interventions.zod.ts`
- Create: `kapwa-server/src/case-interventions/case-interventions.service.ts`
- Create: `kapwa-server/src/case-interventions/case-interventions.controller.ts`
- Create: `kapwa-server/src/case-interventions/case-interventions.module.ts`
- Modify: `kapwa-server/src/app.module.ts` (register module)

**Interfaces:**
- Consumes: `CaseIntervention` entity from Task 1
- Produces: `CaseInterventionsService` with `findByCaseId`, `create`, `update`, `delete` methods; REST endpoints at `/api/v1/cases/:caseId/interventions`

- [ ] **Step 1: Create Zod DTOs**

```typescript
// kapwa-server/src/case-interventions/dto/case-interventions.zod.ts
import { z } from 'zod';

export const CreateCaseInterventionSchema = z.object({
  programId: z.string().uuid().nullable().optional(),
  serviceName: z.string().min(1),
  category: z.string().nullable().optional(),
  deliveryDate: z.string().nullable().optional(),
  amount: z.number().nullable().optional(),
  modeOfDelivery: z.string().nullable().optional(),
  fundSource: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  deliveredBy: z.string().nullable().optional(),
});

export const UpdateCaseInterventionSchema = CreateCaseInterventionSchema.partial();

export type CreateCaseInterventionInput = z.infer<typeof CreateCaseInterventionSchema>;
export type UpdateCaseInterventionInput = z.infer<typeof UpdateCaseInterventionSchema>;
```

- [ ] **Step 2: Create the service**

```typescript
// kapwa-server/src/case-interventions/case-interventions.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CaseIntervention } from './case-intervention.entity';
import { CreateCaseInterventionInput, UpdateCaseInterventionInput } from './dto/case-interventions.zod';

@Injectable()
export class CaseInterventionsService {
  constructor(
    @InjectRepository(CaseIntervention)
    private interventionRepo: Repository<CaseIntervention>,
  ) {}

  async findByCaseId(caseId: string) {
    return this.interventionRepo.find({
      where: { caseId },
      order: { deliveryDate: 'ASC', createdAt: 'ASC' },
    });
  }

  async create(caseId: string, data: CreateCaseInterventionInput) {
    const intervention = this.interventionRepo.create({ caseId, ...data });
    return this.interventionRepo.save(intervention);
  }

  async update(id: string, data: UpdateCaseInterventionInput) {
    const intervention = await this.interventionRepo.findOne({ where: { id } });
    if (!intervention) throw new NotFoundException('Intervention not found');
    Object.assign(intervention, data);
    return this.interventionRepo.save(intervention);
  }

  async delete(id: string) {
    const intervention = await this.interventionRepo.findOne({ where: { id } });
    if (!intervention) throw new NotFoundException('Intervention not found');
    await this.interventionRepo.remove(intervention);
  }
}
```

- [ ] **Step 3: Create the controller**

```typescript
// kapwa-server/src/case-interventions/case-interventions.controller.ts
import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { CaseInterventionsService } from './case-interventions.service';
import { CreateCaseInterventionSchema, UpdateCaseInterventionSchema, CreateCaseInterventionInput, UpdateCaseInterventionInput } from './dto/case-interventions.zod';

@Controller('cases/:caseId/interventions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CaseInterventionsController {
  constructor(private service: CaseInterventionsService) {}

  @Get()
  @Roles('admin', 'social_worker', 'coordinator')
  findAll(@Param('caseId') caseId: string) {
    return this.service.findByCaseId(caseId);
  }

  @Post()
  @Roles('admin', 'social_worker')
  create(@Param('caseId') caseId: string, @Body(new ZodPipe(CreateCaseInterventionSchema)) body: CreateCaseInterventionInput) {
    return this.service.create(caseId, body);
  }

  @Patch(':id')
  @Roles('admin', 'social_worker')
  update(@Param('id') id: string, @Body(new ZodPipe(UpdateCaseInterventionSchema)) body: UpdateCaseInterventionInput) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @Roles('admin', 'social_worker')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
```

- [ ] **Step 4: Create the module**

```typescript
// kapwa-server/src/case-interventions/case-interventions.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaseIntervention } from './case-intervention.entity';
import { CaseInterventionsService } from './case-interventions.service';
import { CaseInterventionsController } from './case-interventions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CaseIntervention])],
  controllers: [CaseInterventionsController],
  providers: [CaseInterventionsService],
  exports: [CaseInterventionsService],
})
export class CaseInterventionsModule {}
```

- [ ] **Step 5: Register in app.module.ts**

Add `CaseInterventionsModule` to the imports array in `kapwa-server/src/app.module.ts`.

- [ ] **Step 6: Build and verify**

Run: `cd /home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-server && npx nest build 2>&1 | tail -5`
Expected: Build successful

- [ ] **Step 7: Commit**

```bash
git add kapwa-server/src/case-interventions/
git commit -m "feat: add CaseInterventions module with CRUD endpoints"
```

---

## Task 3: Add Transition/Exit Plan Fields to Case Entity

**Files:**
- Modify: `kapwa-server/src/cases/case.entity.ts`
- Modify: `kapwa-server/src/cases/dto/cases.zod.ts`
- Modify: `kapwa-server/src/cases/cases.service.ts`
- Modify: `kapwa-server/src/cases/cases.controller.ts`

**Interfaces:**
- Consumes: existing Case entity
- Produces: extended Case entity with `selfReliancePlan`, `referrals`, `followUpDate`, `exitNotes` fields; `PATCH /cases/:id/transition-plan` endpoint

- [ ] **Step 1: Add fields to case.entity.ts**

Add these columns after the existing `clientSignature` field (before `@CreateDateColumn`):

```typescript
  @Column({ name: 'self_reliance_plan', type: 'text', nullable: true })
  selfReliancePlan?: string;

  @Column({ name: 'referrals', type: 'jsonb', nullable: true })
  referrals?: Array<{
    agencyName: string;
    contactInfo?: string;
    reason: string;
    status: 'pending' | 'completed' | 'declined';
    notes?: string;
  }>;

  @Column({ name: 'follow_up_date', type: 'date', nullable: true })
  followUpDate?: string;

  @Column({ name: 'exit_notes', type: 'text', nullable: true })
  exitNotes?: string;
```

- [ ] **Step 2: Add Zod schema for transition plan**

In `kapwa-server/src/cases/dto/cases.zod.ts`, add:

```typescript
export const TransitionPlanSchema = z.object({
  selfReliancePlan: z.string().nullable().optional(),
  referrals: z.array(z.object({
    agencyName: z.string(),
    contactInfo: z.string().nullable().optional(),
    reason: z.string(),
    status: z.enum(['pending', 'completed', 'declined']),
    notes: z.string().nullable().optional(),
  })).nullable().optional(),
  followUpDate: z.string().nullable().optional(),
  exitNotes: z.string().nullable().optional(),
});

export type TransitionPlanInput = z.infer<typeof TransitionPlanSchema>;
```

Add `TransitionPlanSchema` and `TransitionPlanInput` to the exports.

- [ ] **Step 3: Add service method**

In `kapwa-server/src/cases/cases.service.ts`, add:

```typescript
  async updateTransitionPlan(id: string, data: TransitionPlanInput) {
    const caseEntity = await this.caseRepo.findOne({ where: { id } });
    if (!caseEntity) throw new NotFoundException('Case not found');
    Object.assign(caseEntity, data);
    return this.caseRepo.save(caseEntity);
  }
```

Import `TransitionPlanInput` from the DTOs file.

- [ ] **Step 4: Add controller endpoint**

In `kapwa-server/src/cases/cases.controller.ts`, add:

```typescript
  @Patch(':id/transition-plan')
  @Roles('admin', 'social_worker')
  async updateTransitionPlan(
    @Param('id') id: string,
    @Body(new ZodPipe(TransitionPlanSchema)) body: TransitionPlanInput,
  ) {
    return this.casesService.updateTransitionPlan(id, body);
  }
```

Import `TransitionPlanSchema` and `TransitionPlanInput`.

- [ ] **Step 5: Build and verify**

Run: `cd /home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-server && npx nest build 2>&1 | tail -5`
Expected: Build successful

- [ ] **Step 6: Commit**

```bash
git add kapwa-server/src/cases/
git commit -m "feat: add transition/exit plan fields to Case entity and endpoints"
```

---

## Task 4: Seed Migration — Create `case_interventions` Table + Seed Data

**Files:**
- Modify: `kapwa-server/src/database/seed.ts`

**Interfaces:**
- Consumes: CaseIntervention entity from Task 1
- Produces: `case_interventions` table created via TypeORM synchronize, seeded with sample data

- [ ] **Step 1: Add CaseIntervention to seed imports and truncate**

Add `CaseIntervention` to the TypeORM imports and add `case_interventions` to the truncate list.

- [ ] **Step 2: Add seed section for case_interventions**

After the `program_assignments` section, add:

```typescript
  // ── Case Interventions (delivery records) ──
  const CaseInterventionEntity = DataSource.getRepository(CaseIntervention);
  const caseInterventionData = [
    { caseId: CASE_IDS[0], programId: PROG_IDS[0], serviceName: 'AKAP Financial Aid', category: 'Financial Assistance', deliveryDate: '2026-07-15', amount: 5000, modeOfDelivery: 'Cash', fundSource: 'DSWD', deliveredBy: 'Maria Santos' },
    { caseId: CASE_IDS[0], programId: PROG_IDS[1], serviceName: 'Medical Assistance', category: 'Health', deliveryDate: '2026-07-18', amount: 3000, modeOfDelivery: 'Guarantee Letter', fundSource: 'LGU', deliveredBy: 'Maria Santos' },
    { caseId: CASE_IDS[1], programId: PROG_IDS[4], serviceName: 'Food Assistance', category: 'Basic Needs', deliveryDate: '2026-07-20', amount: 2000, modeOfDelivery: 'Cash', fundSource: 'DSWD', deliveredBy: 'Juan Cruz' },
    { caseId: CASE_IDS[2], serviceName: 'Counseling Session', category: 'Counseling', deliveryDate: '2026-07-22', notes: 'Initial counseling session — family conflict resolution', deliveredBy: 'Maria Santos' },
    { caseId: CASE_IDS[3], programId: PROG_IDS[3], serviceName: 'Educational Assistance', category: 'Education', deliveryDate: '2026-07-25', amount: 10000, modeOfDelivery: 'Cheque', fundSource: 'PDAF', deliveredBy: 'Juan Cruz' },
    { caseId: CASE_IDS[3], serviceName: 'Home Visit', category: 'Counseling', deliveryDate: '2026-07-28', notes: 'Follow-up home visit — assessed living conditions', deliveredBy: 'Maria Santos' },
    { caseId: CASE_IDS[4], programId: PROG_IDS[2], serviceName: 'Burial Assistance', category: 'Crisis Intervention', deliveryDate: '2026-07-10', amount: 5000, modeOfDelivery: 'Cash', fundSource: 'LGU', deliveredBy: 'Juan Cruz' },
    { caseId: CASE_IDS[5], programId: PROG_IDS[0], serviceName: 'AKAP Financial Aid', category: 'Financial Assistance', deliveryDate: '2026-07-12', amount: 3000, modeOfDelivery: 'Cash', fundSource: 'DSWD', deliveredBy: 'Maria Santos' },
  ];
  for (const d of caseInterventionData) {
    await CaseInterventionEntity.save(CaseInterventionEntity.create(d));
  }
```

Define `PROG_IDS` constant at the top of the seed file:

```typescript
const PROG_IDS = [
  '70000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000002',
  '70000000-0000-0000-0000-000000000003',
  '70000000-0000-0000-0000-000000000004',
  '70000000-0000-0000-0000-000000000005',
  '70000000-0000-0000-0000-000000000006',
];
```

Add transition plan data to some cases:

```typescript
  // ── Update cases with transition plan data ──
  for (const [i, caseId] of CASE_IDS.entries()) {
    if (i < 3) {
      await CaseEntity.update(caseId, {
        selfReliancePlan: i === 0
          ? 'Client will undergo skills training for livelihood program. Follow-up in 30 days.'
          : i === 1
          ? 'Referred to DSWD for sustainable livelihood assistance.'
          : 'Ongoing counseling — self-reliance plan to be developed after 3 sessions.',
        referrals: i === 0
          ? [{ agencyName: 'DSWD Regional Office', reason: 'Livelihood program referral', status: 'pending' as const }]
          : i === 1
          ? [{ agencyName: 'DOLE', reason: 'Job placement assistance', status: 'completed' as const }]
          : [],
        followUpDate: i === 0 ? '2026-08-15' : i === 1 ? '2026-08-01' : undefined,
      });
    }
  }
```

- [ ] **Step 3: Re-seed the database**

Run: `cd /home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-server && npx ts-node src/database/seed.ts 2>&1 | tail -30`
Expected: Seed completes with `Case Interventions: 8` in output

- [ ] **Step 4: Verify data in DB**

Run: `podman exec kapwa-pg psql -U kapwa -d kapwa -c "SELECT id, case_id, service_name, category, amount FROM case_interventions;"`
Expected: 8 rows returned

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/src/database/seed.ts
git commit -m "feat: seed case_interventions and transition plan data"
```

---

## Task 5: Frontend — Query Keys + CaseInterventions API Hook

**Files:**
- Modify: `kapwa-client/src/lib/query-keys.ts`

**Interfaces:**
- Produces: `queryKeys.cases.interventions(caseId)` for SWR fetching

- [ ] **Step 1: Add query key**

In `kapwa-client/src/lib/query-keys.ts`, update the `cases` section to add:

```typescript
    interventions: (caseId: string) =>
      memo(`cases.interventions.${caseId}`, () => ['cases', caseId, 'interventions'] as const),
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-client && npx tsc --noEmit 2>&1 | tail -3`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/src/lib/query-keys.ts
git commit -m "feat: add caseInterventions query key"
```

---

## Task 6: Frontend — Stepper Component

**Files:**
- Create: `kapwa-client/src/components/case-view/CaseStepper.tsx`

**Interfaces:**
- Consumes: `currentStep` (number), `onStepClick` callback
- Produces: `CaseStepper` component rendering 5 numbered steps with active/completed states

- [ ] **Step 1: Create CaseStepper component**

```tsx
// kapwa-client/src/components/case-view/CaseStepper.tsx
import { Check } from 'lucide-react';

const STEPS = [
  { label: 'Client Profile', description: 'Basic info & household' },
  { label: 'Assessment', description: 'Evaluation & diagnosis' },
  { label: 'Interventions', description: 'Programs & services' },
  { label: 'Exit Plan', description: 'Transition & referrals' },
  { label: 'Signatures', description: 'Approval & closing' },
];

interface CaseStepperProps {
  currentStep: number;
  onStepClick: (step: number) => void;
}

export function CaseStepper({ currentStep, onStepClick }: CaseStepperProps) {
  return (
    <nav className="flex items-center gap-1 px-4 py-3 overflow-x-auto">
      {STEPS.map((step, i) => {
        const isActive = i === currentStep;
        const isCompleted = i < currentStep;
        return (
          <button
            key={i}
            onClick={() => onStepClick(i)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              isActive
                ? 'bg-primary text-primary-foreground'
                : isCompleted
                ? 'bg-primary/10 text-primary hover:bg-primary/20'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
              isActive
                ? 'bg-primary-foreground text-primary'
                : isCompleted
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}>
              {isCompleted ? <Check size={14} /> : i + 1}
            </span>
            <span className="hidden sm:inline">{step.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-client && npx tsc --noEmit 2>&1 | tail -3`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/src/components/case-view/
git commit -m "feat: add CaseStepper component for 5-stage case lifecycle"
```

---

## Task 7: Frontend — Step 1: Client & Family Profile

**Files:**
- Create: `kapwa-client/src/components/case-view/StepClientProfile.tsx`

**Interfaces:**
- Consumes: `caseData` (CaseDetail), `famGraph` (family graph data)
- Produces: `StepClientProfile` component rendering beneficiary info, claimant info, and household composition

- [ ] **Step 1: Create StepClientProfile component**

This component extracts the beneficiary sidebar content from the current CaseViewPage and presents it as a full-width section. It shows:
- Beneficiary: Full name, gender, age, DOB, address, phone, Philsys #, Access Card
- Claimant: Full name, relationship, phone, address
- Household: Barangay, estimated income, family graph

```tsx
// kapwa-client/src/components/case-view/StepClientProfile.tsx
import { User, Users, Phone, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FamilyGraph } from '../family/FamilyGraph';

interface StepClientProfileProps {
  caseData: any;
  famGraph?: { members: Array<Record<string, unknown>>; primary: Record<string, unknown> };
  famLoading: boolean;
}

export function StepClientProfile({ caseData, famGraph, famLoading }: StepClientProfileProps) {
  const ben = caseData?.beneficiary;
  const claimant = caseData?.claimant;
  const household = ben?.household;
  const dob = ben?.dob;
  const age = dob ? new Date().getFullYear() - new Date(dob).getFullYear() : 0;
  const ageRange = dob ? (age < 18 ? '0-17' : age > 59 ? '60+' : '18-59') : '';

  return (
    <div className="space-y-4">
      {/* Case Control Info */}
      <div className="rounded-lg border bg-card px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Case Information</h3>
          <Badge variant="outline" className="text-xs">{caseData.controlNo}</Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground text-xs">Status</span>
            <p className="font-medium">{caseData.status?.replace(/_/g, ' ')}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Service Requested</span>
            <p className="font-medium">{(caseData.serviceRequested || []).join(', ') || '—'}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Created</span>
            <p className="font-medium">{new Date(caseData.createdAt).toLocaleDateString()}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Updated</span>
            <p className="font-medium">{new Date(caseData.updatedAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Beneficiary */}
      {ben && (
        <div className="rounded-lg border bg-card">
          <div className="px-4 py-3 flex items-center gap-3">
            <User size={20} className="text-primary" />
            <h3 className="text-sm font-semibold">Beneficiary</h3>
          </div>
          <Separator />
          <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div className="col-span-2 md:col-span-3">
              <span className="text-muted-foreground text-xs">Full Name</span>
              <p className="font-medium">{ben.firstName} {ben.middleName || ''} {ben.surname}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Gender</span>
              <p>{ben.gender || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Age Range</span>
              <p>{ageRange || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Date of Birth</span>
              <p>{dob ? new Date(dob).toLocaleDateString() : '—'}</p>
            </div>
            <div className="flex items-start gap-2">
              <MapPin size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
              <div>
                <span className="text-muted-foreground text-xs">Address</span>
                <p>{ben.address || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Phone size={14} className="shrink-0 text-muted-foreground" />
              <div>
                <span className="text-muted-foreground text-xs">Phone</span>
                <p>{ben.phone || '—'}</p>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Philsys #</span>
              <p>{ben.philsysNumber || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Access Card</span>
              <p>{ben.accessCardCode || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Category</span>
              <p>{ben.category || '—'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Claimant */}
      {claimant && (
        <div className="rounded-lg border bg-card">
          <div className="px-4 py-3 flex items-center gap-3">
            <User size={20} className="text-primary" />
            <h3 className="text-sm font-semibold">Claimant</h3>
          </div>
          <Separator />
          <div className="px-4 py-3 space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Full Name</span>
              <p className="font-medium">{claimant.fullName}</p>
            </div>
            {claimant.relationship !== 'Self' && (
              <div>
                <span className="text-muted-foreground text-xs">Relationship</span>
                <p>{claimant.relationship}</p>
              </div>
            )}
            {claimant.phone && (
              <div className="flex items-center gap-2">
                <Phone size={14} className="shrink-0 text-muted-foreground" />
                <div>
                  <span className="text-muted-foreground text-xs">Phone</span>
                  <p>{claimant.phone}</p>
                </div>
              </div>
            )}
            {claimant.address && (
              <div className="flex items-start gap-2">
                <MapPin size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                <div>
                  <span className="text-muted-foreground text-xs">Address</span>
                  <p>{claimant.address}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Household */}
      {household && (
        <div className="rounded-lg border bg-card">
          <div className="px-4 py-3 flex items-center gap-3">
            <Users size={20} className="text-primary" />
            <h3 className="text-sm font-semibold">Household</h3>
          </div>
          <Separator />
          <div className="px-4 py-3 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <MapPin size={14} className="shrink-0 text-muted-foreground" />
              <span>{household.barangay || '—'}</span>
            </div>
            {household.estimatedIncome && (
              <div>
                <span className="text-muted-foreground text-xs">Estimated Income</span>
                <p>₱{Number(household.estimatedIncome).toLocaleString()}/mo</p>
              </div>
            )}
            {(famGraph?.members?.length || 0) > 0 && (
              <div className="mt-2">
                <span className="text-muted-foreground text-xs flex items-center gap-1 mb-2">
                  <Users size={12} /> {famGraph!.members.length} Member{famGraph!.members.length > 1 ? 's' : ''}
                </span>
                <FamilyGraph
                  loading={famLoading && !famGraph}
                  members={famGraph?.members || [] as any}
                  primary={famGraph?.primary || null as any}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-client && npx tsc --noEmit 2>&1 | tail -3`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/src/components/case-view/StepClientProfile.tsx
git commit -m "feat: add StepClientProfile component for stage 1"
```

---

## Task 8: Frontend — Step 2: Assessment & Diagnosis

**Files:**
- Create: `kapwa-client/src/components/case-view/StepAssessment.tsx`

**Interfaces:**
- Consumes: `caseData` (CaseDetail), `assessment` state, `editingAssessment` flag, `saveAssessment` callback
- Produces: `StepAssessment` component with problems presented, social worker assessment, client category

- [ ] **Step 1: Create StepAssessment component**

Extract the existing Section III content from CaseViewPage into its own component. The form fields remain the same (problemsPresented, socialWorkerAssessment, clientCategory).

```tsx
// kapwa-client/src/components/case-view/StepAssessment.tsx
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CLIENT_CATEGORIES_V2 } from '@/lib/constants';

interface StepAssessmentProps {
  caseData: any;
  assessment: any;
  editingAssessment: boolean;
  onEditToggle: () => void;
  onAssessmentChange: (updater: (prev: any) => any) => void;
  onSave: () => void;
  saving: boolean;
}

export function StepAssessment({
  caseData, assessment, editingAssessment, onEditToggle, onAssessmentChange, onSave, saving,
}: StepAssessmentProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Assessment & Diagnosis</h3>
          <Button variant="outline" size="sm" onClick={onEditToggle}>
            {editingAssessment ? 'Cancel' : caseData?.problemsPresented ? 'Edit' : 'Add Assessment'}
          </Button>
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-3">
          {editingAssessment ? (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Problem/s Presented *</label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                  value={assessment.problemsPresented}
                  onChange={e => onAssessmentChange(a => ({ ...a, problemsPresented: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Social Worker's Assessment *</label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                  value={assessment.socialWorkerAssessment}
                  onChange={e => onAssessmentChange(a => ({ ...a, socialWorkerAssessment: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Client Category *</label>
                <div className="mt-1 space-y-1">
                  {CLIENT_CATEGORIES_V2.map(cat => (
                    <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="clientCategory" value={cat}
                        checked={assessment.clientCategory === cat}
                        onChange={e => onAssessmentChange(a => ({ ...a, clientCategory: e.target.value }))}
                        className="text-primary" />
                      {cat}
                    </label>
                  ))}
                </div>
              </div>
              <Button onClick={onSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Assessment'}
              </Button>
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
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-client && npx tsc --noEmit 2>&1 | tail -3`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/src/components/case-view/StepAssessment.tsx
git commit -m "feat: add StepAssessment component for stage 2"
```

---

## Task 9: Frontend — Step 3: Intervention Record

**Files:**
- Create: `kapwa-client/src/components/case-view/StepInterventions.tsx`

**Interfaces:**
- Consumes: `caseId` (string), `interventions` (array), `programs` (array from `/api/v1/programs`), `mutate` (SWR mutate)
- Produces: `StepInterventions` component with list of delivered interventions + "Add Intervention" form

- [ ] **Step 1: Create StepInterventions component**

This is the most complex step. It shows:
1. List of existing interventions (cards with service name, date, amount, notes)
2. "Add Intervention" form with:
   - Program selector (dropdown from available programs)
   - Or ad-hoc service type (from SERVICE_TYPES constant)
   - Delivery date, amount, mode, fund source, notes

```tsx
// kapwa-client/src/components/case-view/StepInterventions.tsx
import { useState } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Calendar, DollarSign } from 'lucide-react';
import { SERVICE_TYPES, NATURE_OF_SERVICE } from '@/lib/constants';

interface Intervention {
  id: string;
  caseId: string;
  programId?: string;
  serviceName: string;
  category?: string;
  deliveryDate?: string;
  amount?: number;
  modeOfDelivery?: string;
  fundSource?: string;
  notes?: string;
  deliveredBy?: string;
}

interface Program {
  id: string;
  name: string;
  category?: string;
}

interface StepInterventionsProps {
  caseId: string;
}

export function StepInterventions({ caseId }: StepInterventionsProps) {
  const { data: interventions = [], mutate } = useSWR<Intervention[]>(
    queryKeys.cases.interventions(caseId),
  );
  const { data: programs = [] } = useSWR<Program[]>(queryKeys.programs.list());

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    programId: '',
    serviceName: '',
    category: '',
    deliveryDate: '',
    amount: '',
    modeOfDelivery: '',
    fundSource: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    setSaving(true);
    try {
      const selectedProgram = programs.find(p => p.id === form.programId);
      const serviceName = selectedProgram?.name || form.serviceName;
      const category = selectedProgram?.category || form.category || undefined;
      await api.post(`/cases/${caseId}/interventions`, {
        programId: form.programId || null,
        serviceName,
        category,
        deliveryDate: form.deliveryDate || null,
        amount: form.amount ? parseFloat(form.amount) : null,
        modeOfDelivery: form.modeOfDelivery || null,
        fundSource: form.fundSource || null,
        notes: form.notes || null,
      });
      await mutate();
      setAdding(false);
      setForm({ programId: '', serviceName: '', category: '', deliveryDate: '', amount: '', modeOfDelivery: '', fundSource: '', notes: '' });
    } catch (e) {
      console.error('Failed to add intervention:', e);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/cases/${caseId}/interventions/${id}`);
      await mutate();
    } catch (e) {
      console.error('Failed to delete intervention:', e);
    }
  }

  const totalAmount = interventions.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-lg border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Intervention Record</h3>
            <p className="text-xs text-muted-foreground">
              {interventions.length} intervention{interventions.length !== 1 ? 's' : ''} delivered
              {totalAmount > 0 && ` · ₱${totalAmount.toLocaleString()} total`}
            </p>
          </div>
          <Button size="sm" onClick={() => setAdding(!adding)}>
            <Plus size={14} className="mr-1" /> Add Intervention
          </Button>
        </div>
      </div>

      {/* Add Form */}
      {adding && (
        <div className="rounded-lg border bg-card px-4 py-3 space-y-3">
          <h4 className="text-sm font-medium">New Intervention</h4>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Program / Service *</label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.programId}
              onChange={e => setForm(f => ({ ...f, programId: e.target.value }))}
            >
              <option value="">— Select a program —</option>
              {programs.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              <optgroup label="Other Services">
                {SERVICE_TYPES.map(s => (
                  <option key={s} value={`adhoc:${s}`}>{s}</option>
                ))}
                {NATURE_OF_SERVICE.map(s => (
                  <option key={s} value={`adhoc:${s}`}>{s}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {form.programId.startsWith('adhoc:') && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Service Name *</label>
              <Input
                value={form.serviceName}
                onChange={e => setForm(f => ({ ...f, serviceName: e.target.value }))}
                placeholder="e.g., Counseling Session, Home Visit"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Delivery Date</label>
              <Input type="date" value={form.deliveryDate} onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Amount (₱)</label>
              <Input type="text" inputMode="numeric" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value.replace(/,/g, '') }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Mode of Delivery</label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.modeOfDelivery} onChange={e => setForm(f => ({ ...f, modeOfDelivery: e.target.value }))}>
                <option value="">—</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
                <option value="Guarantee Letter">Guarantee Letter</option>
                <option value="In-kind">In-kind</option>
                <option value="Service">Service</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Fund Source</label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.fundSource} onChange={e => setForm(f => ({ ...f, fundSource: e.target.value }))}>
                <option value="">—</option>
                <option value="DSWD">DSWD</option>
                <option value="LGU">LGU</option>
                <option value="PDAF">PDAF</option>
                <option value="Donation">Donation</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notes</label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Additional details about this intervention..."
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleAdd} disabled={saving || (!form.programId && !form.serviceName)}>
              {saving ? 'Saving...' : 'Save Intervention'}
            </Button>
            <Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Intervention List */}
      {interventions.length === 0 ? (
        <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No interventions recorded yet. Click "Add Intervention" to document delivered services.
        </div>
      ) : (
        <div className="space-y-2">
          {interventions.map(intv => (
            <div key={intv.id} className="rounded-lg border bg-card px-4 py-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{intv.serviceName}</span>
                    {intv.category && <Badge variant="secondary" className="text-[10px]">{intv.category}</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {intv.deliveryDate && (
                      <span className="flex items-center gap-1">
                        <Calendar size={12} /> {new Date(intv.deliveryDate).toLocaleDateString()}
                      </span>
                    )}
                    {intv.amount && (
                      <span className="flex items-center gap-1">
                        <DollarSign size={12} /> ₱{Number(intv.amount).toLocaleString()}
                      </span>
                    )}
                    {intv.modeOfDelivery && <span>{intv.modeOfDelivery}</span>}
                    {intv.fundSource && <span>{intv.fundSource}</span>}
                  </div>
                  {intv.notes && <p className="text-xs text-muted-foreground/70 mt-1">{intv.notes}</p>}
                </div>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(intv.id)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-client && npx tsc --noEmit 2>&1 | tail -3`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/src/components/case-view/StepInterventions.tsx
git commit -m "feat: add StepInterventions component for stage 3"
```

---

## Task 10: Frontend — Step 4: Transition/Exit Plan

**Files:**
- Create: `kapwa-client/src/components/case-view/StepExitPlan.tsx`

**Interfaces:**
- Consumes: `caseData` (CaseDetail with transition plan fields), `mutate` (SWR mutate)
- Produces: `StepExitPlan` component with self-reliance plan, referrals list, follow-up date, exit notes

- [ ] **Step 1: Create StepExitPlan component**

```tsx
// kapwa-client/src/components/case-view/StepExitPlan.tsx
import { useState } from 'react';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useSWRConfig } from 'swr';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, ExternalLink } from 'lucide-react';

interface Referral {
  agencyName: string;
  contactInfo?: string;
  reason: string;
  status: 'pending' | 'completed' | 'declined';
  notes?: string;
}

interface StepExitPlanProps {
  caseId: string;
  caseData: any;
}

export function StepExitPlan({ caseId, caseData }: StepExitPlanProps) {
  const { mutate } = useSWRConfig();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [plan, setPlan] = useState({
    selfReliancePlan: caseData?.selfReliancePlan || '',
    referrals: (caseData?.referrals || []) as Referral[],
    followUpDate: caseData?.followUpDate || '',
    exitNotes: caseData?.exitNotes || '',
  });

  const [newReferral, setNewReferral] = useState({ agencyName: '', contactInfo: '', reason: '', notes: '' });

  function addReferral() {
    if (!newReferral.agencyName) return;
    setPlan(p => ({
      ...p,
      referrals: [...p.referrals, { ...newReferral, status: 'pending' as const }],
    }));
    setNewReferral({ agencyName: '', contactInfo: '', reason: '', notes: '' });
  }

  function removeReferral(index: number) {
    setPlan(p => ({
      ...p,
      referrals: p.referrals.filter((_, i) => i !== index),
    }));
  }

  function updateReferralStatus(index: number, status: 'pending' | 'completed' | 'declined') {
    setPlan(p => ({
      ...p,
      referrals: p.referrals.map((r, i) => i === index ? { ...r, status } : r),
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch(`/cases/${caseId}/transition-plan`, {
        selfReliancePlan: plan.selfReliancePlan || null,
        referrals: plan.referrals.length > 0 ? plan.referrals : null,
        followUpDate: plan.followUpDate || null,
        exitNotes: plan.exitNotes || null,
      });
      await mutate(queryKeys.cases.detail(caseId));
      setEditing(false);
    } catch (e) {
      console.error('Failed to save transition plan:', e);
    } finally {
      setSaving(false);
    }
  }

  const hasData = caseData?.selfReliancePlan || (caseData?.referrals?.length > 0) || caseData?.followUpDate || caseData?.exitNotes;

  return (
    <div className="space-y-4">
      {/* Self-Reliance Plan */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Self-Reliance Plan</h3>
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              {hasData ? 'Edit' : 'Add Plan'}
            </Button>
          )}
        </div>
        <Separator />
        <div className="px-4 py-3">
          {editing ? (
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px]"
              value={plan.selfReliancePlan}
              onChange={e => setPlan(p => ({ ...p, selfReliancePlan: e.target.value }))}
              placeholder="Recommendations for self-reliance steps, skills training, livelihood programs..."
            />
          ) : (
            <p className="text-sm">{caseData?.selfReliancePlan || '—'}</p>
          )}
        </div>
      </div>

      {/* Referrals */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Referrals to Other Agencies</h3>
          {editing && (
            <Button variant="outline" size="sm" onClick={() => {
              if (!newReferral.agencyName) return;
              addReferral();
            }}>
              <Plus size={14} className="mr-1" /> Add Referral
            </Button>
          )}
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-3">
          {editing && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Input placeholder="Agency name *" value={newReferral.agencyName} onChange={e => setNewReferral(r => ({ ...r, agencyName: e.target.value }))} />
              <Input placeholder="Contact info" value={newReferral.contactInfo} onChange={e => setNewReferral(r => ({ ...r, contactInfo: e.target.value }))} />
              <Input placeholder="Reason for referral" value={newReferral.reason} onChange={e => setNewReferral(r => ({ ...r, reason: e.target.value }))} className="col-span-2" />
            </div>
          )}

          {plan.referrals.length === 0 && !editing ? (
            <p className="text-sm text-muted-foreground text-center py-3">No referrals recorded.</p>
          ) : (
            plan.referrals.map((ref, i) => (
              <div key={i} className="flex items-start justify-between p-2 rounded border bg-muted/30">
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{ref.agencyName}</span>
                    <Badge variant={ref.status === 'completed' ? 'default' : ref.status === 'declined' ? 'destructive' : 'outline'} className="text-[10px]">
                      {ref.status}
                    </Badge>
                  </div>
                  {ref.contactInfo && <p className="text-xs text-muted-foreground">{ref.contactInfo}</p>}
                  {ref.reason && <p className="text-xs text-muted-foreground">{ref.reason}</p>}
                </div>
                {editing && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => updateReferralStatus(i, 'completed')}>✓</Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeReferral(i)}>
                      <Trash2 size={12} />
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Follow-up & Exit Notes */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold">Follow-up & Closing Notes</h3>
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-3">
          {editing ? (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Follow-up Date</label>
                <Input type="date" value={plan.followUpDate} onChange={e => setPlan(p => ({ ...p, followUpDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Exit Notes</label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                  value={plan.exitNotes}
                  onChange={e => setPlan(p => ({ ...p, exitNotes: e.target.value }))}
                  placeholder="Final notes before case closure..."
                />
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Exit Plan'}
              </Button>
            </>
          ) : (
            <>
              <div className="text-sm">
                <span className="text-muted-foreground">Follow-up Date</span>
                <p className="font-medium">{caseData?.followUpDate ? new Date(caseData.followUpDate).toLocaleDateString() : '—'}</p>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Exit Notes</span>
                <p className="font-medium">{caseData?.exitNotes || '—'}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-client && npx tsc --noEmit 2>&1 | tail -3`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/src/components/case-view/StepExitPlan.tsx
git commit -m "feat: add StepExitPlan component for stage 4"
```

---

## Task 11: Frontend — Step 5: Signatures & Approval

**Files:**
- Create: `kapwa-client/src/components/case-view/StepSignatures.tsx`

**Interfaces:**
- Consumes: `caseData` (CaseDetail), `mutate` (SWR mutate)
- Produces: `StepSignatures` component with client signature, worker signature, approval status, and PDF export trigger

- [ ] **Step 1: Create StepSignatures component**

```tsx
// kapwa-client/src/components/case-view/StepSignatures.tsx
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileText, CheckCircle, Clock } from 'lucide-react';
import SignaturePad from '../forms/SignaturePad';

interface StepSignaturesProps {
  caseData: any;
}

export function StepSignatures({ caseData }: StepSignaturesProps) {
  const isApproved = caseData?.status === 'approved' || caseData?.status === 'disbursed' || caseData?.status === 'closed';
  const isClosed = caseData?.status === 'closed';

  return (
    <div className="space-y-4">
      {/* Approval Status */}
      <div className="rounded-lg border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Case Status</h3>
          <Badge variant={isApproved ? 'default' : 'outline'} className="text-sm">
            {isApproved ? <CheckCircle size={12} className="mr-1" /> : <Clock size={12} className="mr-1" />}
            {caseData?.status?.replace(/_/g, ' ') || 'pending'}
          </Badge>
        </div>
      </div>

      {/* Client Signature */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold">Client Signature</h3>
        </div>
        <Separator />
        <div className="px-4 py-3">
          {caseData?.clientSignature ? (
            <div className="space-y-2">
              <img src={caseData.clientSignature} alt="Client signature" className="max-h-20 border rounded bg-white" />
              <p className="text-xs text-muted-foreground">Signed</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No signature captured yet.</p>
          )}
        </div>
      </div>

      {/* Worker / Approver Signatures */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold">Social Worker & Approver</h3>
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-muted-foreground text-xs">Assigned Worker</span>
              <p className="font-medium">{caseData?.assignedWorkerId || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Approved By</span>
              <p className="font-medium">{caseData?.approvedByRole?.replace(/_/g, ' ') || '—'}</p>
            </div>
          </div>
          {caseData?.approvedBySignature && (
            <div>
              <span className="text-muted-foreground text-xs">Approver Signature</span>
              <img src={caseData.approvedBySignature} alt="Approver signature" className="max-h-16 border rounded bg-white mt-1" />
            </div>
          )}
        </div>
      </div>

      {/* Documents */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold">Documents</h3>
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Certificate</span>
            {caseData?.certificateUrl ? (
              <a href={caseData.certificateUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                <FileText size={14} /> View <ExternalLink size={10} />
              </a>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Petty Cash Voucher</span>
            {caseData?.pettyCashVoucherUrl ? (
              <a href={caseData.pettyCashVoucherUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                <FileText size={14} /> View <ExternalLink size={10} />
              </a>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        </div>
      </div>

      {/* Export to PDF placeholder */}
      <div className="rounded-lg border bg-card px-4 py-3">
        <Button variant="outline" className="w-full" disabled>
          <FileText size={14} className="mr-2" /> Export Case to PDF (Coming Soon)
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-client && npx tsc --noEmit 2>&1 | tail -3`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/src/components/case-view/StepSignatures.tsx
git commit -m "feat: add StepSignatures component for stage 5"
```

---

## Task 12: Frontend — Rewrite CaseViewPage with Stepper

**Files:**
- Modify: `kapwa-client/src/pages/CaseViewPage.tsx`

**Interfaces:**
- Consumes: All step components from Tasks 7-11
- Produces: Complete CaseViewPage with stepper navigation replacing the flat 2-column layout

- [ ] **Step 1: Rewrite CaseViewPage.tsx**

Replace the entire file content. The new page:
1. Fetches case data, history, programs, interventions, family graph
2. Renders `CaseStepper` at the top
3. Shows the active step component based on `currentStep` state
4. Preserves the existing assessment state management

```tsx
// kapwa-client/src/pages/CaseViewPage.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useSWR, { useSWRConfig } from 'swr';
import { AlertTriangle, FileText } from 'lucide-react';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { useAuth } from '../lib/auth-context';
import { PageShell } from '@/components/PageShell';
import { Badge } from '@/components/ui/badge';
import { CaseStepper } from '@/components/case-view/CaseStepper';
import { StepClientProfile } from '@/components/case-view/StepClientProfile';
import { StepAssessment } from '@/components/case-view/StepAssessment';
import { StepInterventions } from '@/components/case-view/StepInterventions';
import { StepExitPlan } from '@/components/case-view/StepExitPlan';
import { StepSignatures } from '@/components/case-view/StepSignatures';

const STATUS_BADGES: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending_assessment: 'outline',
  in_review: 'secondary',
  approved: 'default',
  disbursed: 'secondary',
  closed: 'outline',
};

const STATUS_LABELS: Record<string, string> = {
  pending_assessment: 'Pending Assessment',
  in_review: 'In Review',
  approved: 'Approved',
  disbursed: 'Disbursed',
  closed: 'Closed',
};

export function CaseViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { mutate } = useSWRConfig();

  const [currentStep, setCurrentStep] = useState(0);

  const { data: caseData, isLoading } = useSWR<any>(
    id ? queryKeys.cases.detail(id) : null,
  );
  const { data: history, isLoading: historyLoading } = useSWR<any[]>(
    id ? queryKeys.cases.detail(`${id}/history`) : null,
  );
  const benId = caseData?.beneficiary?.id;
  const { data: famGraph, isLoading: famLoading } = useSWR<{ members: Array<Record<string, unknown>>; primary: Record<string, unknown> }>(
    benId ? queryKeys.beneficiaries.familyGraph(benId) : null,
  );

  // Assessment state (preserved from original)
  const [editingAssessment, setEditingAssessment] = useState(false);
  const [assessment, setAssessment] = useState({
    problemsPresented: '',
    socialWorkerAssessment: '',
    clientCategory: '',
  });
  const [savingAssessment, setSavingAssessment] = useState(false);

  useEffect(() => {
    if (caseData) {
      setAssessment({
        problemsPresented: caseData.problemsPresented || '',
        socialWorkerAssessment: caseData.socialWorkerAssessment || '',
        clientCategory: caseData.clientCategory || '',
      });
    }
  }, [caseData]);

  async function saveAssessment() {
    setSavingAssessment(true);
    try {
      await api.patch(`/cases/${id}/assessment`, {
        ...assessment,
        interviewedBy: user?.fullName || '',
      });
      await mutate(queryKeys.cases.detail(id!));
      setEditingAssessment(false);
    } catch (e) {
      console.error('Failed to save assessment:', e);
    } finally {
      setSavingAssessment(false);
    }
  }

  if (isLoading) {
    return (
      <PageShell title="Loading..." description="">
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading case...</div>
      </PageShell>
    );
  }

  if (!caseData) {
    return (
      <PageShell title="Case Not Found" description="" backTo={{ label: "Back to Cases", onClick: () => navigate('/cases') }}>
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <FileText size={40} className="mb-3 opacity-30" />
          <p className="text-sm">Case not found.</p>
        </div>
      </PageShell>
    );
  }

  const stepComponents = [
    <StepClientProfile key="profile" caseData={caseData} famGraph={famGraph} famLoading={famLoading} />,
    <StepAssessment key="assessment" caseData={caseData} assessment={assessment}
      editingAssessment={editingAssessment} onEditToggle={() => setEditingAssessment(!editingAssessment)}
      onAssessmentChange={setAssessment} onSave={saveAssessment} saving={savingAssessment} />,
    <StepInterventions key="interventions" caseId={id!} />,
    <StepExitPlan key="exit" caseId={id!} caseData={caseData} />,
    <StepSignatures key="signatures" caseData={caseData} />,
  ];

  return (
    <PageShell
      title={`Case ${caseData.controlNo}`}
      description={`Beneficiary: ${caseData.beneficiary?.firstName || ''} ${caseData.beneficiary?.surname || ''}`}
      backTo={{ label: 'Back to Cases', onClick: () => navigate('/cases') }}
      actions={caseData.slaOverdue ? (
        <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
          <AlertTriangle size={12} /> OVERDUE
        </span>
      ) : undefined}
    >
      {/* Stepper */}
      <div className="rounded-lg border bg-card mb-4">
        <CaseStepper currentStep={currentStep} onStepClick={setCurrentStep} />
      </div>

      {/* Active Step Content */}
      <div className="max-w-3xl mx-auto">
        {stepComponents[currentStep]}
      </div>

      {/* Case History (always visible at bottom) */}
      {history && history.length > 0 && (
        <div className="rounded-lg border bg-card mt-6">
          <div className="px-4 py-3">
            <h3 className="text-sm font-semibold">Case History</h3>
          </div>
          <div className="px-4 py-3">
            <div className="relative pl-5 space-y-3">
              {history.map((entry: any, i: number) => (
                <div key={entry.id} className="relative">
                  {i < history.length - 1 && (
                    <div className="absolute left-[-18px] top-[18px] w-px h-full bg-border" />
                  )}
                  <div className="absolute left-[-22px] top-[6px] w-2.5 h-2.5 rounded-full border-2 border-primary bg-background" />
                  <div className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {entry.fromStatus
                          ? `${STATUS_LABELS[entry.fromStatus] || entry.fromStatus} → ${STATUS_LABELS[entry.toStatus] || entry.toStatus}`
                          : STATUS_LABELS[entry.toStatus] || entry.toStatus}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        {entry.transitionType}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(entry.createdAt).toLocaleString()}
                      {entry.changedByRole && ` · by ${entry.changedByRole.replace(/_/g, ' ')}`}
                    </p>
                    {entry.remarks && (
                      <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{entry.remarks}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-client && npx tsc --noEmit 2>&1 | tail -5`
Expected: No errors

- [ ] **Step 3: Verify frontend builds**

Run: `cd /home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-client && npx vite build 2>&1 | tail -5`
Expected: Build successful

- [ ] **Step 4: Commit**

```bash
git add kapwa-client/src/pages/CaseViewPage.tsx
git commit -m "feat: rewrite CaseViewPage with 5-stage stepper lifecycle"
```

---

## Task 13: Integration Test — Start Server & Frontend, Verify

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: All previous tasks complete
- Produces: Working server + frontend with stepper case view

- [ ] **Step 1: Kill old server and rebuild**

```bash
kill $(lsof -ti:3000) 2>/dev/null; sleep 1
cd /home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-server && npx nest build 2>&1 | tail -3
```
Expected: Build successful

- [ ] **Step 2: Re-seed DB**

```bash
cd /home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-server && npx ts-node src/database/seed.ts 2>&1 | tail -10
```
Expected: Seed completes, `Case Interventions: 8` in output

- [ ] **Step 3: Start server**

```bash
cd /home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-server && nohup npx nest start --watch > /tmp/kapwa-server.log 2>&1 &
sleep 5 && curl -s http://localhost:3000/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@mswdo.test","password":"admin123"}' | head -c 30
```
Expected: JWT token returned

- [ ] **Step 4: Test case interventions endpoint**

```bash
TOKEN=$(curl -s http://localhost:3000/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@mswdo.test","password":"admin123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['accessToken'])")
CASE_ID=$(curl -s http://localhost:3000/api/v1/cases -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0]['id'] if d else '')")
curl -s http://localhost:3000/api/v1/cases/$CASE_ID/interventions -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'{len(d)} interventions')"
```
Expected: `2 interventions` (or similar count)

- [ ] **Step 5: Test transition plan endpoint**

```bash
curl -s -X PATCH http://localhost:3000/api/v1/cases/$CASE_ID/transition-plan -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"selfReliancePlan":"Test plan","followUpDate":"2026-08-01"}' | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('selfReliancePlan','MISSING'))"
```
Expected: `Test plan`

- [ ] **Step 6: Start frontend and verify**

```bash
cd /home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-client && nohup npx vite --port 5173 --host > /tmp/kapwa-client.log 2>&1 &
sleep 3 && curl -s http://localhost:5173 | head -c 100
```
Expected: HTML returned

- [ ] **Step 7: Verify case view page renders stepper**

Navigate to `http://localhost:5173/cases/{case-id}` and verify:
- Stepper shows 5 steps at the top
- Step 1 (Client Profile) shows beneficiary, claimant, household
- Clicking Step 2 shows Assessment form
- Clicking Step 3 shows Intervention list + Add form
- Clicking Step 4 shows Exit Plan with referrals
- Clicking Step 5 shows Signatures & Approval

- [ ] **Step 8: Final commit**

```bash
git add -A && git commit -m "feat: case lifecycle stepper complete — 5 stages with interventions and exit plan"
```

---

## Summary

| Task | Description | Backend/Frontend |
|------|-------------|-----------------|
| 1 | CaseIntervention entity | Backend |
| 2 | CaseInterventions module + CRUD | Backend |
| 3 | Case entity transition plan fields | Backend |
| 4 | Seed data + migration | Backend |
| 5 | Query keys | Frontend |
| 6 | CaseStepper component | Frontend |
| 7 | StepClientProfile | Frontend |
| 8 | StepAssessment | Frontend |
| 9 | StepInterventions | Frontend |
| 10 | StepExitPlan | Frontend |
| 11 | StepSignatures | Frontend |
| 12 | Rewrite CaseViewPage | Frontend |
| 13 | Integration test | Both |
