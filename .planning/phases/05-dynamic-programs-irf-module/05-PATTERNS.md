# Phase 5: Dynamic Programs & IRF Module — Pattern Map

**Mapped:** 2026-06-22
**Files analyzed:** 25 new/modified files
**Analogs found:** 22 / 25

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `kapwa-server/src/programs/program.entity.ts` (MODIFY) | entity | CRUD | `kapwa-server/src/irf/irf-case.entity.ts` | role-match |
| `kapwa-server/src/programs/dto/programs.zod.ts` (MODIFY) | dto | validation | `kapwa-server/src/cases/dto/cases.zod.ts` | exact |
| `kapwa-server/src/programs/programs.service.ts` (MODIFY) | service | CRUD | `kapwa-server/src/programs/programs.service.ts` (existing) | exact |
| `kapwa-server/src/programs/programs.controller.ts` (MODIFY) | controller | request-response | `kapwa-server/src/programs/programs.controller.ts` (existing) | exact |
| `kapwa-server/src/programs/programs.module.ts` (MODIFY) | module | DI config | `kapwa-server/src/cases/cases.module.ts` | role-match |
| `kapwa-server/src/programs/program-assignment.entity.ts` (CREATE) | entity | CRUD | `kapwa-server/src/cases/case.entity.ts` | exact (FSM entity) |
| `kapwa-server/src/programs/program-assignment-step.entity.ts` (CREATE) | entity | CRUD | `kapwa-server/src/cases/case-history.entity.ts` | exact (step tracking) |
| `kapwa-server/src/programs/dto/assignment.zod.ts` (CREATE) | dto | validation | `kapwa-server/src/cases/dto/cases.zod.ts` | exact |
| `kapwa-server/src/programs/program-assignments.service.ts` (CREATE) | service | CRUD + event-driven | `kapwa-server/src/cases/cases.service.ts` | exact (FSM + notification) |
| `kapwa-server/src/programs/program-assignments.controller.ts` (CREATE) | controller | request-response | `kapwa-server/src/cases/cases.controller.ts` | exact (dedicated FSM endpoints) |
| `kapwa-server/src/irf/irf-case.entity.ts` (MODIFY) | entity | CRUD | `kapwa-server/src/irf/irf-case.entity.ts` (existing) | exact |
| `kapwa-server/src/irf/dto/irf.zod.ts` (MODIFY) | dto | validation | `kapwa-server/src/irf/dto/irf.zod.ts` (existing) | exact |
| `kapwa-server/src/irf/irf.service.ts` (MODIFY) | service | CRUD + file I/O | `kapwa-server/src/cases/cases.service.ts` + `kapwa-server/src/irf/irf.service.ts` | role-match (FSM) + exact (encryption) |
| `kapwa-server/src/irf/irf.controller.ts` (MODIFY) | controller | request-response | `kapwa-server/src/irf/irf.controller.ts` (existing) | exact |
| `kapwa-server/src/irf/irf.module.ts` (MODIFY) | module | DI config | `kapwa-server/src/cases/cases.module.ts` | role-match |
| `kapwa-server/src/irf/irf-export.service.ts` (CREATE) | service | file I/O | `kapwa-server/src/irf/irf.service.ts:exportWcpd()` (lines 105-151) | exact (same domain) |
| `kapwa-server/src/irf/irf-audit.service.ts` (CREATE) | service | event-driven | `kapwa-server/src/notifications/notifications.service.ts` | role-match (logging) |
| `kapwa-server/src/irf/irf-key.service.ts` (CREATE) | service | utility | No direct analog | — |
| `kapwa-server/src/database/migrations/20260622000004-ProgramAndIRF.ts` (CREATE) | migration | batch | existing migrations in `kapwa-server/src/database/migrations/` | exact |
| `kapwa-client/src/pages/ProgramsPage.tsx` (CREATE) | page | CRUD | `kapwa-client/src/pages/CsrPage.tsx` | exact (CRUD page pattern) |
| `kapwa-client/src/pages/IrfPage.tsx` (MODIFY) | page | CRUD + file I/O | `kapwa-client/src/pages/IrfPage.tsx` (existing) | exact |
| `kapwa-client/src/pages/IrfDetailPage.tsx` (CREATE) | page | request-response | `kapwa-client/src/pages/BeneficiaryViewPage.tsx` | role-match (detail view) |
| `kapwa-client/src/components/irf/VictimNarrationField.tsx` (CREATE) | component | form input | `kapwa-client/src/components/forms/SignaturePad.tsx` | role-match (input component) |
| `kapwa-client/src/components/irf/NameMaskToggle.tsx` (CREATE) | component | event-driven | `kapwa-client/src/components/forms/SignaturePad.tsx` | role-match (interactive component) |
| `kapwa-client/src/lib/api.ts` (MODIFY) | utility | request-response | `kapwa-client/src/lib/api.ts` (existing) | exact |

---

## Pattern Assignments

---

### `kapwa-server/src/programs/program.entity.ts` (MODIFY) — entity, CRUD

**Analog:** `kapwa-server/src/irf/irf-case.entity.ts` (JSONB + enum pattern) + `kapwa-server/src/cases/case.entity.ts` (FSM enum)

**Entity pattern with JSONB columns** (irf-case.entity.ts lines 27-31):
```typescript
@Entity('irf_cases')
export class IrfCase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('jsonb', { nullable: true })
  itemAReportingPerson?: Record<string, any>;

  @Column({ type: 'bytea', nullable: true })
  encryptedNarration?: Buffer;
}
```

**Enum pattern for FSM** (case.entity.ts lines 4-10):
```typescript
export enum CaseStatus {
  PENDING = 'pending_assessment',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  DISBURSED = 'disbursed',
  CLOSED = 'closed'
}
```

**How to mirror in the new entity:**
```typescript
// program.entity.ts — Change approvalWorkflow from text[] to JSONB
@Entity('programs')
export class Program {
  // ... existing fields ...

  @Column({ type: 'jsonb', name: 'approval_workflow', nullable: true })
  approvalWorkflow?: ApprovalStep[];       // was: string[] (text[])

  @Column({ nullable: true, name: 'legal_basis' })
  legalBasis?: string;                     // NEW
  
  @Column('text', { name: 'fund_sources', array: true, nullable: true })
  fundSources?: string[];                  // keep existing, unchanged
}

// ApprovalStep stays as an interface in a shared types file or co-located:
interface ApprovalStep {
  stepName: string;
  approverRole: string;
  slaDays: number;
  order: number;
}
```

---

### `kapwa-server/src/programs/dto/programs.zod.ts` (MODIFY) — dto, validation

**Analog:** `kapwa-server/src/cases/dto/cases.zod.ts` (lines 1-39)

**Pattern — Per-operation Zod schemas** (cases.zod.ts lines 1-39):
```typescript
import { z } from 'zod';
import { CaseStatus } from '../case.entity';

export const CreateCaseSchema = z.object({
  serviceRequested: z.array(z.string()).optional(),
  requirementsChecklist: z.record(z.boolean()).optional(),
  beneficiaryId: z.string().uuid().optional(),
  assignedWorkerId: z.string().uuid().optional(),
});

export const OverrideStatusSchema = z.object({
  status: z.nativeEnum(CaseStatus),
  reason: z.string().min(1, 'Override reason is required'),
});

export type CreateCaseInput = z.infer<typeof CreateCaseSchema>;
export type OverrideStatusInput = z.infer<typeof OverrideStatusSchema>;
```

**How to mirror for the new approval workflow:**
```typescript
// programs.zod.ts — Replace flat text[] with structured ApprovalStep
const ApprovalStepSchema = z.object({
  stepName: z.string().min(1, 'Step name required'),
  approverRole: z.string().min(1, 'Approver role required'),
  slaDays: z.number().int().min(1).default(3),
  order: z.number().int().min(0),
});

export const CreateProgramSchema = z.object({
  name: z.string().min(1, 'Program name is required'),
  category: z.string().optional(),
  waitingPeriodDays: z.number().int().nonnegative().optional(),
  requiredDocuments: z.array(z.string()).optional(),
  fundSources: z.array(z.string()).optional(),
  approvalWorkflow: z.array(ApprovalStepSchema).optional(),   // WAS: z.array(z.string())
  legalBasis: z.string().optional(),                            // NEW
  formTemplate: z.record(z.any()).optional(),
  isActive: z.boolean().optional(),
});
```

---

### `kapwa-server/src/programs/programs.service.ts` (MODIFY) — service, CRUD

**Analog:** Existing `kapwa-server/src/programs/programs.service.ts` (lines 1-48) + `kapwa-server/src/interventions/interventions.service.ts` (lines 23-144, complex create pattern)

**Existing service pattern** (programs.service.ts lines 15-47):
```typescript
@Injectable()
export class ProgramsService {
  constructor(
    @InjectRepository(Program) private progRepo: Repository<Program>,
    @InjectRepository(FormVersionHistory) private versionRepo: Repository<FormVersionHistory>,
  ) {}

  async create(data: Partial<Program>) {
    const prog = this.progRepo.create(data);
    return this.progRepo.save(prog);
  }

  async findAll(activeOnly = true) {
    const where = activeOnly ? { isActive: true } : {};
    return this.progRepo.find({ where });
  }

  async update(id: string, data: UpdateProgramInput) {
    const prog = await this.findById(id);
    const changed = 'formTemplate' in data && JSON.stringify(data.formTemplate) !== JSON.stringify(prog.formTemplate);
    await this.progRepo.update(id, data as any);
    if (changed) {
      await this.progRepo.query('UPDATE programs SET form_version = form_version + 1 WHERE id = $1', [id]);
      await this.versionRepo.save({ programId: id, formTemplate: data.formTemplate!, version: prog.formVersion + 1 });
    }
    return this.findById(id);
  }
}
```

**How to extend:** Add `legalBasis` to create/update. The approvalWorkflow change from `text[]` to `ApprovalStep[]` is transparent to the service — TypeORM JSONB handles it. Add approval workflow validation (e.g., duplicated step orders, empty steps) in `validateWorkflow()`.

---

### `kapwa-server/src/programs/programs.controller.ts` (MODIFY) — controller, request-response

**Analog:** Existing `kapwa-server/src/programs/programs.controller.ts` (lines 1-40)

**Controller pattern** (programs.controller.ts lines 1-40):
```typescript
@Controller('programs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProgramsController {
  constructor(private progService: ProgramsService) {}

  @Get()
  @Roles('admin')
  async findAll(@Query('activeOnly') activeOnly?: string) {
    return this.progService.findAll(activeOnly !== 'false');
  }

  @Post()
  @Roles('admin')
  async create(@Body(new ZodPipe(CreateProgramSchema)) body: CreateProgramInput) {
    return this.progService.create(body);
  }

  @Patch(':id')
  @Roles('admin')
  async update(@Param('id') id: string, @Body(new ZodPipe(UpdateProgramSchema)) body: UpdateProgramInput) {
    return this.progService.update(id, body);
  }
}
```

**How to mirror:** Minimal changes — the existing patterns directly accommodate the new fields. ZodPipe validates the new structured `approvalWorkflow` array automatically.

---

### `kapwa-server/src/programs/programs.module.ts` (MODIFY) — module, DI config

**Analog:** `kapwa-server/src/cases/cases.module.ts` (lines 1-16)

**Module pattern importing sub-modules** (cases.module.ts lines 1-16):
```typescript
@Module({
  imports: [TypeOrmModule.forFeature([Case, CaseHistory, ConsentLedger]), NotificationsModule],
  controllers: [CasesController],
  providers: [CasesService],
  exports: [CasesService]
})
export class CasesModule {}
```

**How to mirror:** Import `ProgramAssignmentsModule` and add `FormVersionHistory` to TypeOrm features (already present).

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([Program, FormVersionHistory])],
  controllers: [ProgramsController],
  providers: [ProgramsService],
  exports: [TypeOrmModule],
})
export class ProgramsModule {}
```

---

### `kapwa-server/src/programs/program-assignment.entity.ts` (CREATE) — entity, CRUD

**Analog:** `kapwa-server/src/cases/case.entity.ts` (lines 1-56) — FSM entity with status enum

**FSM entity pattern** (case.entity.ts lines 1-56):
```typescript
export enum CaseStatus {
  PENDING = 'pending_assessment',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  DISBURSED = 'disbursed',
  CLOSED = 'closed'
}

@Entity('cases')
export class Case {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'beneficiary_id', nullable: true })
  beneficiaryId?: string;

  @Column({ name: 'status', type: 'enum', enum: CaseStatus, default: CaseStatus.PENDING })
  status!: CaseStatus;

  @Column({ name: 'assigned_worker_id', nullable: true })
  assignedWorkerId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
```

**How to mirror — ProgramAssignment entity:**
```typescript
export enum AssignmentStatus {
  PENDING = 'pending',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('program_assignments')
export class ProgramAssignment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'case_id' })
  caseId!: string;

  @Column({ name: 'program_id' })
  programId!: string;

  @Column({ type: 'enum', enum: AssignmentStatus, default: AssignmentStatus.PENDING })
  status!: AssignmentStatus;

  @Column({ name: 'current_step_order', default: 0 })
  currentStepOrder!: number;

  @Column({ name: 'assigned_worker_id' })
  assignedWorkerId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
```

---

### `kapwa-server/src/programs/program-assignment-step.entity.ts` (CREATE) — entity, CRUD

**Analog:** `kapwa-server/src/cases/case-history.entity.ts` (step-level tracking records)

**Per-step tracking pattern** (case-history.entity.ts pattern from cases module):
```typescript
// Reference: CaseHistory tracks each FSM transition
@Entity('case_history')
export class CaseHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  caseId: string;

  @Column({ type: 'enum', enum: CaseStatus })
  fromStatus?: CaseStatus;

  @Column({ type: 'enum', enum: CaseStatus })
  toStatus: CaseStatus;

  @Column({ nullable: true })
  changedByRole?: string;

  @Column({ nullable: true })
  overrideReason?: string;

  @Column({ default: 'standard' })
  transitionType: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

**How to mirror — ProgramAssignmentStep entity:**
```typescript
@Entity('program_assignment_steps')
export class ProgramAssignmentStep {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'assignment_id' })
  assignmentId!: string;

  @Column({ name: 'step_order' })
  stepOrder!: number;

  @Column({ name: 'step_name' })
  stepName!: string;

  @Column({ name: 'approver_role' })
  approverRole!: string;

  @Column({ default: 'pending' })
  status!: 'pending' | 'approved' | 'rejected';

  @Column({ name: 'approved_by', nullable: true })
  approvedBy?: string;

  @Column({ name: 'approved_at', nullable: true })
  approvedAt?: Date;

  @Column({ nullable: true })
  remarks?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
```

---

### `kapwa-server/src/programs/dto/assignment.zod.ts` (CREATE) — dto, validation

**Analog:** `kapwa-server/src/cases/dto/cases.zod.ts` (lines 1-39)

**Per-operation schema pattern** (cases.zod.ts):
```typescript
export const UpdateStatusSchema = z.object({
  status: z.nativeEnum(CaseStatus),
});

export const ApproveCaseSchema = z.object({
  status: z.nativeEnum(CaseStatus),
  signature: z.string().optional(),
});

export const OverrideStatusSchema = z.object({
  status: z.nativeEnum(CaseStatus),
  reason: z.string().min(1, 'Override reason is required'),
});
```

**How to mirror — assignment.zod.ts:**
```typescript
import { z } from 'zod';

export const CreateAssignmentSchema = z.object({
  caseId: z.string().uuid(),
  programId: z.string().uuid(),
  assignedWorkerId: z.string().uuid(),
});

export const ApproveStepSchema = z.object({
  stepOrder: z.number().int().min(0),
  remarks: z.string().optional(),
});

export const RejectStepSchema = z.object({
  stepOrder: z.number().int().min(0),
  remarks: z.string().min(1, 'Rejection reason required'),
});

export type CreateAssignmentInput = z.infer<typeof CreateAssignmentSchema>;
export type ApproveStepInput = z.infer<typeof ApproveStepSchema>;
export type RejectStepInput = z.infer<typeof RejectStepSchema>;
```

---

### `kapwa-server/src/programs/program-assignments.service.ts` (CREATE) — service, CRUD + event-driven

**Analog:** `kapwa-server/src/cases/cases.service.ts` (lines 146-313) — FSM transition pattern, role gating, notification

**FSM transition with role gating** (cases.service.ts lines 146-192):
```typescript
async updateStatus(id: string, newStatus: CaseStatus, userRole?: string) {
  const c = await this.findById(id);
  const oldStatus = c.status;
  const transitions: Record<CaseStatus, CaseStatus[]> = {
    [CaseStatus.PENDING]: [CaseStatus.IN_REVIEW, CaseStatus.CLOSED],
    [CaseStatus.IN_REVIEW]: [CaseStatus.APPROVED, CaseStatus.CLOSED],
    [CaseStatus.CLOSED]: [],
  };
  if (!transitions[c.status]?.includes(newStatus)) {
    throw new BadRequestException(`Invalid transition from ${c.status} to ${newStatus}`);
  }
  const roleTransitions: Record<CaseStatus, string[]> = {
    [CaseStatus.PENDING]: ['social_worker', 'coordinator'],
    [CaseStatus.IN_REVIEW]: ['admin'],
  };
  const allowedRoles = roleTransitions[c.status] || ['admin'];
  if (userRole && !allowedRoles.includes(userRole)) {
    throw new ForbiddenException(`Role ${userRole} cannot transition from ${c.status} to ${newStatus}`);
  }
  c.status = newStatus;
  await this.caseRepo.save(c);
  await this.logHistory(id, oldStatus, newStatus, userRole);
  // ... notification logic ...
  return c;
}
```

**Override pattern with reason** (cases.service.ts lines 299-313):
```typescript
async overrideStatus(id: string, targetStatus: CaseStatus, reason: string, userRole?: string) {
  const c = await this.findById(id);
  if (userRole !== 'admin') {
    throw new ForbiddenException(`Role ${userRole} cannot override case status`);
  }
  if (!reason || reason.trim().length === 0) {
    throw new BadRequestException('Override reason is required');
  }
  const oldStatus = c.status;
  c.status = targetStatus;
  await this.caseRepo.save(c);
  await this.logHistory(id, oldStatus, c.status, userRole, undefined, undefined, 'override', reason);
  return c;
}
```

**How to mirror — ProgramAssignmentsService:**
```typescript
@Injectable()
export class ProgramAssignmentsService {
  constructor(
    @InjectRepository(ProgramAssignment) private assignRepo: Repository<ProgramAssignment>,
    @InjectRepository(ProgramAssignmentStep) private stepRepo: Repository<ProgramAssignmentStep>,
    @InjectRepository(Program) private progRepo: Repository<Program>,
    private interventionsService: InterventionsService,
    private notifService: NotificationsService,
  ) {}

  async create(data: CreateAssignmentInput) {
    // 1. Get program to resolve approval_workflow config
    const program = await this.progRepo.findOne({ where: { id: data.programId } });
    if (!program) throw new NotFoundException('Program not found');

    // 2. Create assignment with pending status
    const assignment = this.assignRepo.create({ ...data, status: AssignmentStatus.PENDING });
    const saved = await this.assignRepo.save(assignment);

    // 3. Materialize steps from program.approvalWorkflow JSONB
    if (program.approvalWorkflow?.length) {
      const steps = program.approvalWorkflow.map(step => this.stepRepo.create({
        assignmentId: saved.id,
        stepOrder: step.order,
        stepName: step.stepName,
        approverRole: step.approverRole,
      }));
      await this.stepRepo.save(steps);
    }
    return saved;
  }

  async approveStep(assignmentId: string, stepOrder: number, userId: string, role: string) {
    const assignment = await this.findById(assignmentId);
    const step = await this.stepRepo.findOne({ where: { assignmentId, stepOrder } });
    if (!step) throw new NotFoundException('Step not found');
    if (step.approverRole !== role) {
      throw new ForbiddenException(`Step requires role: ${step.approverRole}`);
    }

    step.status = 'approved';
    step.approvedBy = userId;
    step.approvedAt = new Date();
    await this.stepRepo.save(step);

    // Check if all steps done → materialize intervention
    const remaining = await this.stepRepo.count({ where: { assignmentId, status: 'pending' } });
    if (remaining === 0) {
      assignment.status = AssignmentStatus.APPROVED;
      await this.materializeIntervention(assignment);
    } else {
      assignment.currentStepOrder = stepOrder + 1;
      assignment.status = AssignmentStatus.IN_REVIEW;
    }
    await this.assignRepo.save(assignment);
    return assignment;
  }

  private async materializeIntervention(assignment: ProgramAssignment) {
    const program = await this.progRepo.findOne({ where: { id: assignment.programId } });
    await this.interventionsService.create({
      caseId: assignment.caseId,
      interventionType: InterventionType.FA,  // map from program category
      fundSource: FundSource.REGULAR,
      serviceDate: new Date(),
    }, assignment.assignedWorkerId);
  }
}
```

---

### `kapwa-server/src/programs/program-assignments.controller.ts` (CREATE) — controller, request-response

**Analog:** `kapwa-server/src/cases/cases.controller.ts` (lines 57-85) — dedicated FSM endpoints

**Dedicated transition endpoint pattern** (cases.controller.ts lines 57-78):
```typescript
@Patch(':id/approve')
@Roles('admin')
async approve(@Param('id') id: string, @Body(new ZodPipe(ApproveCaseSchema)) body: { status: CaseStatus; signature?: string }, @Request() req: AuthenticatedRequest) {
  return this.casesService.approve(id, body.status, body.signature || '', req.user?.role || '');
}

@Patch(':id/request-review')
@Roles('social_worker')
async requestReview(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
  return this.casesService.requestReview(id, req.user?.role);
}
```

**How to mirror — ProgramAssignmentsController:**
```typescript
@Controller('program-assignments')
@UseGuards(JwtAuthGuard, RolesGuard, AbacGuard)
export class ProgramAssignmentsController {
  constructor(private assignService: ProgramAssignmentsService) {}

  @Post()
  @Roles('admin', 'social_worker')
  async create(@Body(new ZodPipe(CreateAssignmentSchema)) body: CreateAssignmentInput) {
    return this.assignService.create(body);
  }

  @Post(':id/steps/:stepOrder/approve')
  @Roles('admin', 'social_worker')
  async approveStep(
    @Param('id') id: string,
    @Param('stepOrder') stepOrder: number,
    @Body(new ZodPipe(ApproveStepSchema)) body: ApproveStepInput,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.assignService.approveStep(id, stepOrder, req.user!.id, req.user!.role);
  }

  @Post(':id/steps/:stepOrder/reject')
  @Roles('admin', 'social_worker')
  async rejectStep(
    @Param('id') id: string,
    @Param('stepOrder') stepOrder: number,
    @Body(new ZodPipe(RejectStepSchema)) body: RejectStepInput,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.assignService.rejectStep(id, stepOrder, body.remarks, req.user!.id, req.user!.role);
  }
}
```

---

### `kapwa-server/src/irf/irf-case.entity.ts` (MODIFY) — entity, CRUD

**Analog:** `kapwa-server/src/irf/irf-case.entity.ts` (existing, lines 1-47) + `kapwa-server/src/cases/case.entity.ts` (enum FSM)

**Existing entity** (irf-case.entity.ts lines 1-47):
```typescript
@Entity('irf_cases')
export class IrfCase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'bytea', nullable: true })
  encryptedNarration?: Buffer;

  @Column({ nullable: true })
  caseDisposition?: string;
}
```

**How to extend — add disposition enum + key management columns:**
```typescript
export enum IrfDisposition {
  UNDER_INVESTIGATION = 'Under Investigation',
  REFERRED_TO_PNP = 'Referred to PNP',
  REFERRED_TO_WCPD = 'Referred to WCPD',
  DISMISSED = 'Dismissed',
  CLOSED = 'Closed',
}

@Entity('irf_cases')
export class IrfCase {
  // ... existing fields ...

  @Column({ type: 'enum', enum: IrfDisposition, default: IrfDisposition.UNDER_INVESTIGATION })
  caseDisposition!: IrfDisposition;      // WAS: string

  @Column({ type: 'bytea', nullable: true, name: 'encrypted_narration' })
  encryptedNarration?: Buffer;           // unchanged

  @Column({ type: 'jsonb', nullable: true, name: 'key_wraps' })
  keyWraps?: KeyWrap[];                   // NEW — per-record AES key wraps

  @Column({ nullable: true, name: 'key_version', default: 1 })
  keyVersion?: number;                    // NEW — for key rotation
}

interface KeyWrap {
  userId: string;
  encryptedKey: string;  // base64
}
```

---

### `kapwa-server/src/irf/dto/irf.zod.ts` (MODIFY) — dto, validation

**Analog:** `kapwa-server/src/irf/dto/irf.zod.ts` (existing, lines 1-20) + `kapwa-server/src/cases/dto/cases.zod.ts` (FSM transitions)

**Existing IRF schema** (irf.zod.ts lines 1-20):
```typescript
export const CreateIrfSchema = z.object({
  caseCategory: z.nativeEnum(IrfCategory),
  datetimeReported: z.string().optional(),
  narration: z.string().optional(),
  // ... other fields
});

export const UpdateIrfDispositionSchema = z.object({
  disposition: z.string().min(1, 'disposition is required'),
});
```

**How to extend — typed disposition enum:**
```typescript
import { IrfDisposition } from '../irf-case.entity';

export const UpdateIrfDispositionSchema = z.object({
  disposition: z.nativeEnum(IrfDisposition),   // WAS: z.string()
});
```

---

### `kapwa-server/src/irf/irf.service.ts` (MODIFY) — service, CRUD + file I/O

**Analog:** `kapwa-server/src/cases/cases.service.ts` (FSM, lines 146-192) + `kapwa-server/src/irf/irf.service.ts` (encryption, lines 27-103)

**Existing FSM updateStatus** (irf.service.ts lines 153-168 — the pattern to REPLACE):
```typescript
async updateStatus(id: string, disposition: string) {
  if (!VALID_DISPOSITIONS.includes(disposition as Disposition)) {
    throw new BadRequestException(`Invalid disposition. Valid: ${VALID_DISPOSITIONS.join(', ')}`);
  }
  const irf = await this.findById(id);
  const current = irf.caseDisposition || 'Under Investigation';
  const allowed = DISPOSITION_TRANSITIONS[current as Disposition] || [];
  if (!allowed.includes(disposition as Disposition)) {
    throw new BadRequestException(`Invalid transition from "${current}" to "${disposition}".`);
  }
  await this.irfRepo.update(id, { caseDisposition: disposition });
  return this.findById(id);
}
```

**Reference FSM with dedicated endpoints** (cases.service.ts — the pattern to FOLLOW):
```typescript
// cases.service.ts lines 241-255 — dedicated endpoint per transition
async requestReview(id: string, userRole?: string) {
  const c = await this.findById(id);
  if (c.status !== CaseStatus.PENDING) {
    throw new BadRequestException(`Cannot request review from ${c.status}`);
  }
  if (userRole !== 'social_worker') throw new ForbiddenException(...);
  c.status = CaseStatus.IN_REVIEW;
  await this.caseRepo.save(c);
  await this.logHistory(id, oldStatus, c.status, userRole);
  return c;
}
```

**Existing encryption pattern** (irf.service.ts lines 27-32 — to REPLACE with pgcrypto):
```typescript
private encryptNarration(narration: string): Buffer {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex').subarray(0, 32), iv);
  const encrypted = Buffer.concat([cipher.update(narration, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}
```

**How to mirror — 4-state disposition with dedicated endpoints:**
```typescript
// New dedicated transitions (follow cases.service.ts pattern)
async referToPnp(id: string, userRole?: string) {
  const irf = await this.findById(id);
  if (irf.caseDisposition !== IrfDisposition.UNDER_INVESTIGATION) {
    throw new BadRequestException('Can only refer from Under Investigation');
  }
  irf.caseDisposition = IrfDisposition.REFERRED_TO_PNP;
  await this.irfRepo.save(irf);
  // notification, history
  return irf;
}

async dismiss(id: string, reason: string, userRole?: string) {
  const irf = await this.findById(id);
  if (irf.caseDisposition !== IrfDisposition.UNDER_INVESTIGATION) {
    throw new BadRequestException('Can only dismiss from Under Investigation');
  }
  irf.caseDisposition = IrfDisposition.DISMISSED;
  irf.dismissalReason = reason;
  await this.irfRepo.save(irf);
  return irf;
}

// Encryption via pgcrypto (replace Node.js crypto)
async encryptWithPgcrypto(narration: string, irfId: string): Promise<void> {
  // Generate per-record AES-256 key via pgcrypto
  // Store wrapped keys + encrypted narration
  await this.irfRepo.query(
    `UPDATE irf_cases SET
       encrypted_narration = encrypt(
         convert_to($1, 'UTF8'),
         decode($2, 'hex'),
         'aes-256-cbc/pad:pkcs'
       ),
       key_wraps = $3::jsonb
     WHERE id = $4`,
    [narration, perRecordKeyHex, JSON.stringify(keyWraps), irfId]
  );
}
```

---

### `kapwa-server/src/irf/irf.controller.ts` (MODIFY) — controller, request-response

**Analog:** `kapwa-server/src/irf/irf.controller.ts` (existing, lines 1-85) + `kapwa-server/src/cases/cases.controller.ts` (dedicated FSM endpoints)

**Existing controller** (irf.controller.ts lines 56-84):
```typescript
@Patch(':id/disposition')
@Roles('admin')
async updateStatus(@Param('id') id: string, @Body(new ZodPipe(UpdateIrfDispositionSchema)) body: { disposition: string }) {
  return this.irfService.updateStatus(id, body.disposition);
}
```

**How to mirror — replace generic updateStatus with dedicated endpoints:**
```typescript
@Patch(':id/refer-pnp')
@Roles('admin')
async referToPnp(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
  return this.irfService.referToPnp(id, req.user?.role);
}

@Patch(':id/refer-wcpd')
@Roles('admin')
async referToWcpd(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
  return this.irfService.referToWcpd(id, req.user?.role);
}

@Patch(':id/dismiss')
@Roles('admin')
async dismiss(@Param('id') id: string, @Body(new ZodPipe(DismissSchema)) body: { reason: string }, @Request() req: AuthenticatedRequest) {
  return this.irfService.dismiss(id, body.reason, req.user?.role);
}

@Patch(':id/close')
@Roles('admin')
async close(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
  return this.irfService.close(id, req.user?.role);
}
```

---

### `kapwa-server/src/irf/irf.module.ts` (MODIFY) — module, DI config

**Analog:** `kapwa-server/src/cases/cases.module.ts` (lines 1-16)

**How to mirror — add new services:**
```typescript
@Module({
  imports: [TypeOrmModule.forFeature([IrfCase])],
  controllers: [IrfController],
  providers: [IrfService, IrfExportService, IrfAuditService, IrfKeyService],
  exports: [IrfService, IrfExportService],
})
export class IrfModule {}
```

---

### `kapwa-server/src/irf/irf-export.service.ts` (CREATE) — service, file I/O

**Analog:** `kapwa-server/src/irf/irf.service.ts:exportWcpd()` (lines 105-151)

**Existing export pattern** (irf.service.ts lines 105-151):
```typescript
async exportWcpd(id: string, legalBasis: string) {
  if (!legalBasis) throw new ForbiddenException('Legal basis code is required');
  const irf = await this.irfRepo.findOne({ where: { id } });
  let narration: string | null = null;
  if (irf.encryptedNarration) {
    // ... decrypt with env key ...
  }
  this.logger.log(`IRF WCPD EXPORT: id=${id}, legalBasis=${legalBasis}`);
  return {
    exportMetadata: { generatedAt: new Date(), legalBasis, format: 'WCPD-EXPORT-v1', agency: 'MSWDO Norzagaray' },
    case: { blotterEntryNumber: irf.blotterEntryNumber, caseCategory: irf.caseCategory, ... },
    parties: { reportingPerson: irf.itemAReportingPerson, personReported: irf.itemBPersonReported },
    narration,
    signatures: { msdwSignatureUrl: irf.msdwSignatureUrl, reportingSignatureUrl: irf.reportingSignatureUrl },
  };
}
```

**How to mirror — IrfExportService with PDF + JSON:**
```typescript
@Injectable()
export class IrfExportService {
  constructor(
    @InjectRepository(IrfCase) private irfRepo: Repository<IrfCase>,
  ) {}

  async exportPdf(id: string, legalBasis: string, password: string): Promise<Buffer> {
    const data = await this.exportData(id, legalBasis);
    const doc = new PDFDocument({
      userPassword: password,
      ownerPassword: process.env.PDF_OWNER_PW || 'changeme',
      permissions: { printing: 'lowResolution', modifying: false }
    });
    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    // Build PDF content from data...
    doc.end();
    return Buffer.concat(buffers);
  }

  async exportJson(id: string, legalBasis: string): Promise<object> {
    const data = await this.exportData(id, legalBasis);
    return { format: 'WCPD-EXPORT-v1', encrypted: true, ...data };
  }

  private async exportData(id: string, legalBasis: string) {
    // ... same exportWcpd() core logic from irf.service.ts ...
    // Delegate to irf.service for decryption, build export payload
  }
}
```

---

### `kapwa-server/src/irf/irf-audit.service.ts` (CREATE) — service, event-driven

**Analog:** Notification pattern from `kapwa-server/src/notifications/notifications.service.ts`; history pattern from `kapwa-server/src/cases/cases.service.ts:logHistory()` (lines 126-137)

**History logging pattern** (cases.service.ts lines 126-137):
```typescript
private async logHistory(caseId: string, fromStatus: CaseStatus | undefined, toStatus: CaseStatus, changedByRole?: string, changedById?: string, remarks?: string, transitionType?: 'standard' | 'override', overrideReason?: string) {
  await this.historyRepo.save({
    caseId, fromStatus, toStatus,
    changedByRole, changedById, remarks,
    transitionType: transitionType || 'standard',
    overrideReason,
  });
}
```

**How to mirror — IrfAuditService:**
```typescript
@Injectable()
export class IrfAuditService {
  constructor(
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  async logAccess(params: {
    irfId: string;
    userId: string;
    action: 'DECRYPT' | 'EXPORT_PDF' | 'EXPORT_JSON' | 'UNMASK_NAME';
    legalBasis: string;
    format?: string;
  }) {
    return this.auditRepo.save({
      action: `IRF_${params.action}`,
      irfId: params.irfId,
      userId: params.userId,
      legalBasis: params.legalBasis,
      format: params.format,
      timestamp: new Date(),
    });
  }
}
```

---

### `kapwa-client/src/pages/ProgramsPage.tsx` (CREATE) — page, CRUD

**Analog:** `kapwa-client/src/pages/CsrPage.tsx` (lines 1-267) — full CRUD page with form, table, edit/delete

**CRUD page pattern** (CsrPage.tsx lines 1-267):
```typescript
export function CsrPage() {
  const [records, setRecords] = useState<CsrRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CsrForm>(emptyForm);
  const [msg, setMsg] = useState('');

  useEffect(() => { const ac = new AbortController(); load(ac.signal); return () => ac.abort(); }, []);

  async function load(signal?: AbortSignal) { /* ... */ }
  function openNew() { setForm(emptyForm); setEditingId(null); setShowForm(true); }
  function openEdit(r: CsrRecord) { /* populate form */ setEditingId(r.id); setShowForm(true); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) {
      await updateCsrRecord(editingId, form);
    } else {
      await createCsrRecord(form);
    }
    setShowForm(false);
    load();
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">CSR Generator</h2>
        <p className="page-desc">Family Case Study Reports — MSWDO Norzagaray</p>
      </div>

      {/* Success message */}
      {msg && <div className="mb-4 rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">{msg}</div>}

      {/* Toolbar */}
      <div className="toolbar">
        <button className="btn btn-primary" onClick={openNew}>+ New CSR</button>
        <input type="text" placeholder="Search..." className="form-input max-w-xs" />
      </div>

      {/* Form modal/inline */}
      {showForm && (
        <div className="card mb-6 max-w-4xl">
          <h3 className="font-heading font-semibold mb-4">{editingId ? 'Edit CSR' : 'New CSR'}</h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* ... form fields in sections ... */}
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary">{editingId ? 'Update' : 'Create'}</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Table/card list */}
      {records.map(r => (
        <div key={r.id} className="card">
          <div className="flex items-center justify-between">
            {/* ... detail + edit/delete buttons ... */}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**How to mirror — ProgramsPage.tsx:** Same structure. Admin defines: name, category, waitingPeriodDays, legalBasis, requiredDocuments (checklist), fundSources, approvalWorkflow (array of step objects with stepName, approverRole, slaDays, order), formTemplate (JSON Schema editor). Use `JsonSchemaForm.tsx` for formTemplate preview.

---

### `kapwa-client/src/pages/IrfPage.tsx` (MODIFY) — page, CRUD + file I/O

**Analog:** Existing `kapwa-client/src/pages/IrfPage.tsx` (lines 1-181)

**Existing page pattern** (IrfPage.tsx lines 17-181):
```typescript
export function IrfPage() {
  const [irfs, setIrf] = useState<IrfCase[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [exportIrfId, setExportIrfId] = useState<string | null>(null);
  const [legalBasis, setLegalBasis] = useState('');

  // ... load, submit, handleExport ...

  return (
    <div className="p-6">
      {/* Table with Export WCPD button per row */}
      <table>...</table>

      {/* WCPD Export modal */}
      {exportIrfId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <Shield className="text-[#2E5C8A]" size={20} />
            <h3 className="font-semibold text-gray-800">WCPD Export</h3>
            {/* legal basis input + export/cancel */}
          </div>
        </div>
      )}
    </div>
  );
}
```

**How to extend:** Add links to IrfDetailPage (for disposition tracking), PDF download alongside JSON export, encrypted narration field via `VictimNarrationField` component, and name masking toggle via `NameMaskToggle`.

---

### `kapwa-client/src/pages/IrfDetailPage.tsx` (CREATE) — page, request-response

**Analog:** `kapwa-client/src/pages/BeneficiaryViewPage.tsx` (detail view pattern with tabs or sections)

**Detail view pattern reference** (BeneficiaryViewPage.tsx — general pattern):
```typescript
export function BeneficiaryViewPage() {
  const { id } = useParams<{ id: string }>();
  const [beneficiary, setBeneficiary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [id]);
  async function load() { /* fetch by id */ }

  return (
    <div>
      {/* Header with back button */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)}>← Back</button>
        <h1 className="text-2xl font-bold">Beneficiary Details</h1>
      </div>
      {/* Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Info, Case History, etc. */}
      </div>
    </div>
  );
}
```

**How to mirror — IrfDetailPage.tsx:**
```typescript
export function IrfDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [irf, setIrf] = useState<IrfCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNarration, setShowNarration] = useState(false);

  useEffect(() => { load(); }, [id]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)}>← IRF List</button>
        <h1 className="text-2xl font-bold">IRF: {irf?.blotterEntryNumber}</h1>
      </div>
      
      {/* IRF Detail Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Item A (Reporting Person) */}
        {/* Item B (Person Reported) — with NameMaskToggle */}
        {/* Case Info */}
      </div>

      {/* Disposition Timeline — FSM state badges */}
      <div className="card mt-6">
        <h3>Disposition</h3>
        <div className="flex items-center gap-2">
          {dispositionStates.map(state => (
            <span className={`px-3 py-1 rounded-full text-xs ${current === state ? 'bg-blue-100 text-blue-800' : 'bg-gray-100'}`}>
              {state}
            </span>
          ))}
        </div>
      </div>

      {/* Narration with NameMaskToggle + VictimNarrationField */}
      {/* Export buttons (PDF + JSON) with legal basis modal */}
    </div>
  );
}
```

---

### `kapwa-client/src/lib/api.ts` (MODIFY) — utility, request-response

**Analog:** Existing `kapwa-client/src/lib/api.ts` (lines 66-68 for programs, lines 1-223 overall)

**Existing program API calls** (api.ts lines 66-68):
```typescript
export async function getPrograms() {
  return apiFetch('/programs');
}
```

**Existing export pattern** (api.ts lines 97-110):
```typescript
export async function downloadCsrPdf(controlNo: string) {
  const token = localStorage.getItem('kapwa_token');
  const res = await fetch(`${API}/csr/${controlNo}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('PDF download failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = `CSR-${controlNo}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
```

**How to extend — add new functions:**
```typescript
// Programs
export async function createProgram(data: Record<string, unknown>) {
  return apiFetch('/programs', { method: 'POST', body: JSON.stringify(data) });
}
export async function updateProgram(id: string, data: Record<string, unknown>) {
  return apiFetch(`/programs/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

// Program Assignments
export async function getAssignments(caseId?: string) {
  const q = caseId ? `?caseId=${caseId}` : '';
  return apiFetch(`/program-assignments${q}`);
}
export async function approveStep(assignmentId: string, stepOrder: number, remarks?: string) {
  return apiFetch(`/program-assignments/${assignmentId}/steps/${stepOrder}/approve`, {
    method: 'POST', body: JSON.stringify({ stepOrder, remarks }),
  });
}
export async function rejectStep(assignmentId: string, stepOrder: number, remarks: string) {
  return apiFetch(`/program-assignments/${assignmentId}/steps/${stepOrder}/reject`, {
    method: 'POST', body: JSON.stringify({ stepOrder, remarks }),
  });
}

// IRF
export async function getIrfCase(id: string) {
  return apiFetch(`/irf/${id}`);
}
export async function exportIrfPdf(id: string, legalBasis: string) {
  const token = localStorage.getItem('kapwa_token');
  const res = await fetch(`${API}/irf/${id}/export-pdf?legalBasis=${encodeURIComponent(legalBasis)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('PDF export failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = `IRF-${id}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
```

---

### Client components — `VictimNarrationField.tsx` and `NameMaskToggle.tsx`

**Analog:** `kapwa-client/src/components/forms/SignaturePad.tsx` (interactive component pattern)

**Component pattern** (SignaturePad.tsx style):
```typescript
// Reusable input component with state management
interface InputProps {
  value?: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export default function Component({ value, onChange, readOnly }: InputProps) {
  // ... render logic ...
}
```

**How to mirror:**

`VictimNarrationField.tsx` — Encrypted textarea that shows encryption status:
```typescript
export default function VictimNarrationField({ value, onChange, readOnly, isEncrypted }: {
  value: string;
  onChange: (val: string) => void;
  readOnly?: boolean;
  isEncrypted?: boolean;
}) {
  return (
    <div className="mb-4">
      <label className="mb-1 block text-sm font-medium text-gray-700">
        Victim Narration
        {isEncrypted && <span className="ml-2 text-xs text-green-600">🔒 AES-256 Encrypted</span>}
      </label>
      <textarea
        className="w-full rounded border border-gray-300 p-2 text-sm"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={readOnly}
        rows={6}
      />
    </div>
  );
}
```

`NameMaskToggle.tsx` — Two-step legal basis unlock:
```typescript
export default function NameMaskToggle({ irfId, onUnlock }: {
  irfId: string;
  onUnlock: (names: { surname: string; firstName: string }) => void;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [legalBasis, setLegalBasis] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleUnlock() {
    setLoading(true);
    try {
      const data = await apiFetch(`/irf/${irfId}/unmask-names?legalBasis=${encodeURIComponent(legalBasis)}`);
      setUnlocked(true);
      onUnlock(data);
    } catch (e) {
      alert('Unlock failed — verify legal basis code');
    }
    setLoading(false);
  }

  return !unlocked ? (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">[REDACTED]</span>
      <input
        className="form-input text-sm w-48"
        placeholder="Legal basis code"
        value={legalBasis}
        onChange={e => setLegalBasis(e.target.value)}
        aria-label="Legal basis code"
      />
      <button onClick={handleUnlock} disabled={!legalBasis || loading}
        className="text-xs text-[#2E5C8A] hover:underline">
        {loading ? 'Unlocking...' : 'Unlock'}
      </button>
    </div>
  ) : (
    <span className="text-sm text-gray-900">{/* unmasked names */}</span>
  );
}
```

---

## Shared Patterns

### Authentication & Authorization
**Source:** All controllers use the guard pipeline.
```typescript
@Controller('irf')
@UseGuards(JwtAuthGuard, RolesGuard, AbacGuard)   // or just JwtAuthGuard + RolesGuard
export class IrfController {
```
- **Apply to:** ProgramsController, ProgramAssignmentsController, IrfController

### Zod Validation at API Boundary
**Source:** `kapwa-server/src/common/pipes/zod.pipe.ts` (lines 1-14)
```typescript
@Post()
@Roles('admin')
async create(@Body(new ZodPipe(CreateIrfSchema)) body: CreateIrfInput) {
```
- **Apply to:** All POST/PATCH endpoints — wrap body params with `new ZodPipe(Schema)`

### FSM Transition Pattern — Strict State Machine
**Source:** `kapwa-server/src/cases/cases.service.ts` (lines 146-192)
```typescript
const transitions: Record<CaseStatus, CaseStatus[]> = {
  [CaseStatus.PENDING]: [CaseStatus.IN_REVIEW, CaseStatus.CLOSED],
  [CaseStatus.IN_REVIEW]: [CaseStatus.APPROVED, CaseStatus.CLOSED],
  [CaseStatus.CLOSED]: [],
};
if (!transitions[c.status]?.includes(newStatus)) {
  throw new BadRequestException(`Invalid transition from ${c.status} to ${newStatus}`);
}
```
- **Apply to:** IRF disposition FSM, ProgramAssignment approval step FSM
- **Dedicated endpoints per transition** (not generic `updateStatus`)

### ProgramAssignment → Intervention Materialization
**Source:** `kapwa-server/src/interventions/interventions.service.ts:create()` (lines 23-144)
- When all approval steps approve, call `interventionsService.create()` with program-derived values

### Working-Days SLA
**Source:** `kapwa-server/src/sla/constants.ts` (lines 1-8) + `kapwa-server/src/cases/cases.service.ts:workingDays()` (lines 115-124)
```typescript
private workingDays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== SUNDAY && day !== SATURDAY) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}
```
- **Apply to:** Program assignment step SLA — each step has configurable `slaDays`

### Audit Logging for Legal Basis
**Source:** `kapwa-server/src/irf/irf.service.ts` (lines 90, 125)
```typescript
this.logger.log(`IRF ACCESS: id=${id}, legalBasis=${legalBasis}, accessedAt=${new Date().toISOString()}`);
```
- **Upgrade to:** Dedicated IrfAuditService with DB-backed audit log entries

### NestJS Test Pattern
**Source:** `kapwa-server/src/cases/cases.service.spec.ts` (lines 1-235) + `kapwa-server/src/interventions/interventions.service.spec.ts` (lines 1-176)
```typescript
describe('CasesService', () => {
  let service: CasesService;
  let repoMock: any;
  beforeEach(async () => {
    repoMock = { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CasesService,
        { provide: getRepositoryToken(Case), useValue: repoMock },
      ],
    }).compile();
    service = module.get<CasesService>(CasesService);
  });

  describe('updateStatus', () => {
    it('should transition from pending to in_review', async () => {
      repoMock.findOne.mockResolvedValue({ id: '1', status: CaseStatus.PENDING } as Case);
      repoMock.save.mockResolvedValue({ id: '1', status: CaseStatus.IN_REVIEW } as Case);
      const result = await service.updateStatus('1', CaseStatus.IN_REVIEW);
      expect(result.status).toBe(CaseStatus.IN_REVIEW);
    });
  });
});
```
- **Apply to:** ProgramAssignmentsService, IrfService FSM, IrfExportService

### Swagger/API Documentation
**Source:** `kapwa-server/src/irf/irf.controller.ts` (lines 2-3, 26-27)
```typescript
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
@ApiTags('IRF')
@ApiOperation({ summary: 'List IRF cases' })
```
- **Apply to:** All new controller endpoints

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `kapwa-server/src/irf/irf-key.service.ts` | service | utility | RSA key management is a new pattern — no existing key service in codebase. Use Node.js `crypto.generateKeyPair()` built-in; reference pgcrypto SQL for key generation via `gen_random_bytes()` |
| `kapwa-client/src/components/irf/VictimNarrationField.tsx` | component | form input | Encryption-aware text input doesn't exist yet. Base on `SignaturePad.tsx` for component structure |
| `kapwa-client/src/components/irf/NameMaskToggle.tsx` | component | event-driven | Two-step legal-basis unlock is unique. Base on modal pattern from IrfPage.tsx's export modal (lines 124-146) |

## Anti-Patterns to Avoid

1. **Flat text[] for approval_workflow:** Current Program entity uses `text[]` — must use JSONB with structured `ApprovalStep[]`
2. **Generic `updateStatus()` for disposition:** Same anti-pattern as Phase 3 Cases. Create dedicated per-transition endpoints (`referToPnp()`, `dismiss()`, `close()`, etc.)
3. **Single env-var encryption key for all IRFs:** Current `IRF_ENCRYPTION_KEY` approach must be replaced with per-record AES-256 keys via pgcrypto
4. **Mixing Node.js crypto and pgcrypto:** Avoid interop issues — prefer pgcrypto for all server-side encryption operations
5. **Storing decrypted narration in session:** Never cache plaintext narration server-side. Decrypt on-demand, return to client, discard immediately
6. **Duplicate export audit logging:** Centralize audit logging in `IrfAuditService` — don't log the same legal basis access in multiple places

## Metadata

**Analog search scope:** kapwa-server/src/{cases,interventions,programs,irf}/, kapwa-client/src/{pages,components/forms,lib}/
**Files scanned:** 28
**Pattern extraction date:** 2026-06-22
