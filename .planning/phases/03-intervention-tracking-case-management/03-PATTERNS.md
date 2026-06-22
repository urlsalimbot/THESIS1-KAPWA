# Phase 3: Intervention Tracking & Case Management - Pattern Map

**Mapped:** 2026-06-22
**Files analyzed:** 22 (12 server EXTEND, 1 server NEW migration, 5 client EXTEND, 3 server read-only reuse, 1 client read-only reuse)
**Analogs found:** 22 / 22

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `kapwa-server/src/cases/cases.service.ts` | service | CRUD/FSM | Self — existing `updateStatus()`/`approve()` | self-extend |
| `kapwa-server/src/cases/cases.controller.ts` | controller | request-response | Self — existing guard pipeline pattern | self-extend |
| `kapwa-server/src/cases/case-history.entity.ts` | model | CRUD | Self — add override/reason columns | self-extend |
| `kapwa-server/src/cases/dto/cases.zod.ts` | dto | validation | Self — add OverrideStatusSchema, DisburseSchema | self-extend |
| `kapwa-server/src/cases/cases.module.ts` | config | dependency-injection | Self — minimal or no change | self-extend |
| `kapwa-server/src/interventions/interventions.service.ts` | service | CRUD | Self — add sig status, household_id | self-extend |
| `kapwa-server/src/interventions/intervention.entity.ts` | model | CRUD | Self — add client sig, receipt, signatureStatus columns | self-extend |
| `kapwa-server/src/interventions/interventions.controller.ts` | controller | request-response | Self — add sig/receipt upload endpoints | self-extend |
| `kapwa-server/src/interventions/dto/interventions.zod.ts` | dto | validation | Self — add optional sig fields | self-extend |
| `kapwa-server/src/sla/sla.service.ts` | service | batch/cron | Self — add @Cron, 3-day constants | self-extend |
| `kapwa-server/src/sla/sla.module.ts` | config | dependency-injection | Self — import ScheduleModule | self-extend |
| `kapwa-server/src/sla/constants.ts` | config | static | Self — update threshold values | self-extend |
| `kapwa-server/src/tracker/tracker.service.ts` | service | CRUD | Self — add NORZ-TRACK generation | self-extend |
| `kapwa-server/src/tracker/tracker.entity.ts` | model | CRUD | Self — add trackerId field | self-extend |
| `kapwa-server/src/sync/sync.service.ts` | service | event-driven/sync | Self — add offline FSM handling | self-extend |
| `kapwa-server/src/database/migrations/*.ts` | migration | DDL | `20260619000001-audit-hash-chain.ts` | role-match |
| `kapwa-client/src/pages/CasesPage.tsx` | component | request-response | Self — add role-specific action buttons | self-extend |
| `kapwa-client/src/pages/InterventionsPage.tsx` | component | request-response | Self — add signature status display | self-extend |
| `kapwa-client/src/pages/BeneficiaryViewPage.tsx` | component | request-response | Self — add tracker log display | self-extend |
| `kapwa-client/src/lib/api.ts` | utility | HTTP | Self — add signature upload, FSM transition functions | self-extend |
| `kapwa-client/src/lib/offline-queue.ts` | utility | event-driven | Self — add FSM transition queueing | self-extend |
| `kapwa-client/src/lib/sync.ts` | utility | event-driven/sync | Self — add tracking ID conflict resolution | self-extend |

## Pattern Assignments

### `kapwa-server/src/cases/cases.service.ts` (service, CRUD/FSM)
**Analog:** Self (`kapwa-server/src/cases/cases.service.ts`)

**Core FSM transition pattern — EXTEND with dedicated per-gate methods** (lines 101-147):
```typescript
// Existing updateStatus() pattern — replace per-gate methods
async updateStatus(id: string, newStatus: CaseStatus, userRole?: string) {
  const c = await this.findById(id);
  const oldStatus = c.status;
  const transitions: Record<CaseStatus, CaseStatus[]> = {
    [CaseStatus.PENDING]: [CaseStatus.IN_REVIEW, CaseStatus.CLOSED],
    [CaseStatus.IN_REVIEW]: [CaseStatus.APPROVED, CaseStatus.CLOSED],
    [CaseStatus.APPROVED]: [CaseStatus.DISBURSED, CaseStatus.CLOSED],
    [CaseStatus.DISBURSED]: [CaseStatus.CLOSED],
    [CaseStatus.CLOSED]: [],
  };
  if (!transitions[c.status]?.includes(newStatus)) {
    throw new BadRequestException(`Invalid transition from ${c.status} to ${newStatus}`);
  }
  // Role gate
  const roleTransitions: Record<CaseStatus, string[]> = {
    [CaseStatus.PENDING]: ['social_worker', 'coordinator'],
    [CaseStatus.IN_REVIEW]: ['admin'],
    [CaseStatus.APPROVED]: ['admin'],
    [CaseStatus.DISBURSED]: ['admin'],
    [CaseStatus.CLOSED]: ['admin', 'social_worker'],
  };
  const allowedRoles = roleTransitions[c.status] || ['admin'];
  if (userRole && !allowedRoles.includes(userRole)) {
    throw new ForbiddenException(`Role ${userRole} cannot transition from ${c.status} to ${newStatus}`);
  }
  c.status = newStatus;
  c.updatedAt = new Date();
  await this.caseRepo.save(c);
  await this.logHistory(id, oldStatus, newStatus, userRole);
  // ... notification logic ...
  return c;
}
```

**Notification dispatch pattern** (lines 133-144):
```typescript
if (c.assignedWorkerId) {
  await this.notifService.notifyCaseUpdate(c.assignedWorkerId, c.controlNo, newStatus);
}
if (newStatus === CaseStatus.DISBURSED && c.beneficiaryId) {
  await this.notifService.create({
    recipientId: c.beneficiaryId,
    title: 'Disbursement Approved',
    message: `Case ${c.controlNo} has been approved for disbursement...`,
    category: NotificationCategory.DISBURSEMENT,
    referenceId: c.controlNo,
  });
}
```

**LogHistory helper** (lines 83-92):
```typescript
private async logHistory(caseId: string, fromStatus: CaseStatus | undefined, toStatus: CaseStatus, changedByRole?: string, changedById?: string, remarks?: string) {
  await this.historyRepo.save({
    caseId, fromStatus, toStatus, changedByRole, changedById, remarks,
  });
}
```

**Approval pattern with signature** (lines 149-194):
```typescript
async approve(id: string, newStatus: CaseStatus, signature: string, userRole: string) {
  const c = await this.findById(id);
  const oldStatus = c.status;
  // ...transition validation...
  c.status = newStatus;
  c.approvedBySignature = signature;
  c.approvedByRole = userRole;
  c.updatedAt = new Date();
  await this.caseRepo.save(c);
  await this.logHistory(id, oldStatus, newStatus, userRole, undefined, `Approved by ${userRole}`);
  // ...notification...
  return c;
}
```

---

### `kapwa-server/src/cases/cases.controller.ts` (controller, request-response)
**Analog:** Self (`kapwa-server/src/cases/cases.controller.ts`)

**Imports pattern** (lines 1-10):
```typescript
import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { CasesService } from './cases.service';
import { CaseStatus } from './case.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/types';
import { AbacGuard } from '../auth/guards/abac.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { CreateCaseSchema, UpdateStatusSchema, ApproveCaseSchema, UpdateDocumentsSchema, CreateCaseInput } from './dto/cases.zod';
```

**Guard pipeline + controller class pattern** (lines 12-15):
```typescript
@Controller('cases')
@UseGuards(JwtAuthGuard, AbacGuard)
export class CasesController {
  constructor(private casesService: CasesService) {}
```

**Per-gate endpoint pattern — ADD new endpoints for 3-gate separation** (lines 47-57):
```typescript
@Patch(':id/request-review')     // NEW: pending→in_review  | Role: social_worker
@Roles('social_worker')
async requestReview(@Param('id') id: string, @Body(new ZodPipe(UpdateStatusSchema)) body: { status: CaseStatus }, @Request() req: AuthenticatedRequest) {
  return this.casesService.requestReview(id, req.user?.role);
}

@Patch(':id/approve')             // EXISTING: in_review→approved | Role: admin
@Roles('admin')
async approve(@Param('id') id: string, @Body(new ZodPipe(ApproveCaseSchema)) body: { status: CaseStatus; signature?: string }, @Request() req: AuthenticatedRequest) {
  return this.casesService.approve(id, body.status, body.signature || '', req.user?.role || '');
}

@Patch(':id/disburse')            // NEW: approved→disbursed  | Role: admin
@Roles('admin')
async disburse(@Param('id') id: string, @Body(new ZodPipe(ApproveCaseSchema)) body: { status: CaseStatus; signature?: string }, @Request() req: AuthenticatedRequest) {
  return this.casesService.disburse(id, body.status, body.signature || '', req.user?.role || '');
}

@Patch(':id/close')               // NEW: disbursed→closed  | Role: admin, social_worker
@Roles('admin', 'social_worker')
async close(@Param('id') id: string, @Body(new ZodPipe(UpdateStatusSchema)) body: { status: CaseStatus }, @Request() req: AuthenticatedRequest) {
  return this.casesService.close(id, body.status, req.user?.role);
}

@Patch(':id/override-status')     // NEW: any→any with reason | Role: admin
@Roles('admin')
async overrideStatus(@Param('id') id: string, @Body(new ZodPipe(OverrideStatusSchema)) body: OverrideStatusInput, @Request() req: AuthenticatedRequest) {
  return this.casesService.overrideStatus(id, body.status, body.reason, req.user?.role);
}
```

**ZodPipe + AuthenticatedRequest pattern** (line 49):
```typescript
@Body(new ZodPipe(UpdateStatusSchema)) body: { status: CaseStatus }, @Request() req: AuthenticatedRequest
```

---

### `kapwa-server/src/cases/case-history.entity.ts` (model, CRUD)
**Analog:** Self (`kapwa-server/src/cases/case-history.entity.ts`)

**Entity pattern — EXTEND with override fields** (lines 1-29):
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { CaseStatus } from './case.entity';

@Entity('case_history')
export class CaseHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'case_id' })
  caseId!: string;

  @Column({ name: 'from_status', type: 'enum', enum: CaseStatus, nullable: true })
  fromStatus?: CaseStatus;

  @Column({ name: 'to_status', type: 'enum', enum: CaseStatus })
  toStatus!: CaseStatus;

  @Column({ name: 'changed_by_role', nullable: true })
  changedByRole?: string;

  @Column({ name: 'changed_by_id', nullable: true })
  changedById?: string;

  @Column({ name: 'remarks', nullable: true })
  remarks?: string;

  // NEW FIELDS for Phase 3:
  @Column({ name: 'transition_type', default: 'standard' })
  transitionType: 'standard' | 'override';

  @Column({ name: 'override_reason', nullable: true })
  overrideReason?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
```

---

### `kapwa-server/src/cases/dto/cases.zod.ts` (dto, validation)
**Analog:** Self (`kapwa-server/src/cases/dto/cases.zod.ts`)

**Zod schema pattern — ADD new schemas** (lines 1-28):
```typescript
import { z } from 'zod';
import { CaseStatus } from '../case.entity';

export const CreateCaseSchema = z.object({
  serviceRequested: z.array(z.string()).optional(),
  requirementsChecklist: z.record(z.boolean()).optional(),
  beneficiaryId: z.string().uuid().optional(),
  assignedWorkerId: z.string().uuid().optional(),
});

export const UpdateStatusSchema = z.object({
  status: z.nativeEnum(CaseStatus),
});

export const ApproveCaseSchema = z.object({
  status: z.nativeEnum(CaseStatus),
  signature: z.string().optional(),
});

// NEW schemas for Phase 3:
export const OverrideStatusSchema = z.object({
  status: z.nativeEnum(CaseStatus),
  reason: z.string().min(1, 'Override reason is required'),
});

export const DisburseSchema = z.object({
  status: z.nativeEnum(CaseStatus),
  signature: z.string().optional(),
});

export type CreateCaseInput = z.infer<typeof CreateCaseSchema>;
export type UpdateStatusInput = z.infer<typeof UpdateStatusSchema>;
export type ApproveCaseInput = z.infer<typeof ApproveCaseSchema>;
export type OverrideStatusInput = z.infer<typeof OverrideStatusSchema>;
```

---

### `kapwa-server/src/interventions/intervention.entity.ts` (model, CRUD)
**Analog:** Self (`kapwa-server/src/interventions/intervention.entity.ts`)

**Entity pattern — EXTEND with signature status + household_id** (lines 1-67):
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Case } from '../cases/case.entity';

export enum InterventionType {
  FA = 'FA', C = 'C', CSR = 'CSR', R = 'R', H = 'H', HV = 'HV'
}

export enum FundSource {
  REGULAR = 'Regular', PDAF = 'PDAF', LEGISLATIVE = 'Legislative', DONATION = 'Donation'
}

export enum SignatureStatus {
  PENDING = 'signatures_pending',
  COLLECTED = 'signatures_collected'
}

@Entity('interventions')
export class Intervention {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'case_id', nullable: true })
  caseId?: string;

  // DERIVED — denormalized for exclusion constraint (populated on create)
  @Column({ name: 'household_id', nullable: true })
  householdId?: string;

  @Column({ name: 'intervention_type', type: 'enum', enum: InterventionType, nullable: true })
  interventionType?: InterventionType;

  @Column({ name: 'amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  amount?: number;

  @Column({ name: 'fund_source', type: 'enum', enum: FundSource, nullable: true })
  fundSource?: FundSource;

  @Column({ name: 'agency', nullable: true })
  agency?: string;

  @Column({ name: 'service_date', type: 'date' })
  serviceDate!: Date;

  @Column({ name: 'voucher_no', nullable: true })
  voucherNo?: string;

  @Column({ name: 'or_reference', nullable: true })
  orReference?: string;

  @Column({ name: 'worker_signature_url' })
  workerSignatureUrl!: string;

  // NEW — client signature image URL
  @Column({ name: 'client_signature_url', nullable: true })
  clientSignatureUrl?: string;

  // NEW — client receipt/liquidation scan URL
  @Column({ name: 'client_receipt_url', nullable: true })
  clientReceiptUrl?: string;

  // NEW — deferrable signature status
  @Column({ name: 'signature_status', type: 'enum', enum: SignatureStatus, default: SignatureStatus.COLLECTED })
  signatureStatus!: SignatureStatus;

  @Column({ name: 'hash', nullable: true })
  hash?: string;

  @Column({ name: 'prev_hash', nullable: true })
  prevHash?: string;

  @Column({ name: 'logged_by', nullable: true })
  loggedById?: string;

  @ManyToOne(() => Case, { nullable: true })
  @JoinColumn({ name: 'case_id' })
  case?: Case;

  @CreateDateColumn({ name: 'logged_at' })
  loggedAt!: Date;
}
```

---

### `kapwa-server/src/interventions/interventions.service.ts` (service, CRUD)
**Analog:** Self (`kapwa-server/src/interventions/interventions.service.ts`)

**Import + constructor pattern** (lines 1-17):
```typescript
import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Intervention, InterventionType, FundSource, SignatureStatus } from './intervention.entity';
import { Case, CaseStatus } from '../cases/case.entity';

const DUPLICATE_WINDOW_DAYS = 30;
@Injectable()
export class InterventionsService {
  constructor(
    @InjectRepository(Intervention)
    private interventionRepo: Repository<Intervention>,
    @InjectRepository(Case)
    private caseRepo: Repository<Case>,
  ) {}
```

**Duplicate detection pattern** (lines 37-49):
```typescript
const duplicateCheck = await this.interventionRepo.query(
  `SELECT COUNT(*)::int AS cnt FROM interventions i
   JOIN cases c ON c.id = i.case_id
   JOIN beneficiaries b ON b.id = c.beneficiary_id
   JOIN households h ON h.primary_beneficiary_id = b.id
   WHERE h.primary_beneficiary_id = (SELECT beneficiary_id FROM cases WHERE id = $1)
     AND i.intervention_type = $2
     AND i.service_date >= CURRENT_DATE - INTERVAL '${DUPLICATE_WINDOW_DAYS} days'`,
  [caseId, data.interventionType],
);
if ((duplicateCheck?.[0]?.cnt || 0) > 0) {
  throw new BadRequestException('Duplicate intervention detected — same type within 30 days for this household');
}
```

**Hash chain pattern** (lines 55-75):
```typescript
const prevInt = await this.interventionRepo.findOne({
  where: { caseId },
  order: { loggedAt: 'DESC' },
});
const prevHash = prevInt?.hash || 'GENESIS';
const int = this.interventionRepo.create({
  interventionType: data.interventionType || InterventionType.FA,
  amount: data.amount || 0,
  fundSource: data.fundSource || FundSource.REGULAR,
  serviceDate: data.serviceDate || new Date(),
  workerSignatureUrl: data.workerSignatureUrl,
  loggedById: userId,
  caseId,
  prevHash,
});
int.hash = crypto.createHash('sha256').update(`${int.id || ''}:${int.interventionType}:${int.amount}:${int.prevHash}`).digest('hex');
const saved = await this.interventionRepo.save(int);
```

**NEW — Deferrable signature check** (lines 51-53):
```typescript
// Change from blocking check to deferrable:
if (!data.workerSignatureUrl && !data.signatureStatus) {
  // Allow creation with pending signatures
}
```

**NEW — household_id population** (insert before hash creation):
```typescript
// Populate denormalized household_id for exclusion constraint
if (!data.householdId) {
  const result = await this.interventionRepo.query(
    `SELECT h.id FROM households h 
     JOIN beneficiaries b ON b.id = h.primary_beneficiary_id 
     JOIN cases c ON c.beneficiary_id = b.id 
     WHERE c.id = $1`,
    [caseId],
  );
  int.householdId = result?.[0]?.id || undefined;
}
```

---

### `kapwa-server/src/interventions/interventions.controller.ts` (controller, request-response)
**Analog:** Self (`kapwa-server/src/interventions/interventions.controller.ts`)

**NEW — signature upload endpoint pattern** (follow MinIO controller line 29 pattern):
```typescript
@Post('upload-signature')
@Roles('admin', 'social_worker')
@UseInterceptors(FileInterceptor('file'))
async uploadSignature(@UploadedFile() file: any) {
  if (!file) throw new BadRequestException('File is required');
  const signedUrl = await this.minioService.uploadFile(
    'worker-signatures',   // or 'client-receipts'
    `${Date.now()}-${file.originalname}`,
    file.buffer,
    file.mimetype,
  );
  return { url: signedUrl };
}
```

---

### `kapwa-server/src/interventions/dto/interventions.zod.ts` (dto, validation)
**Analog:** Self (`kapwa-server/src/interventions/dto/interventions.zod.ts`)

**Extended Zod schema pattern** (lines 1-16):
```typescript
import { z } from 'zod';
import { InterventionType, FundSource, SignatureStatus } from '../intervention.entity';

export const CreateInterventionSchema = z.object({
  caseId: z.string().uuid(),
  interventionType: z.nativeEnum(InterventionType).default(InterventionType.FA),
  amount: z.number().nonnegative().default(0),
  fundSource: z.nativeEnum(FundSource).default(FundSource.REGULAR),
  serviceDate: z.string().datetime().optional(),
  workerSignatureUrl: z.string().url(),
  clientSignatureUrl: z.string().url().optional(),    // NEW — optional
  signatureStatus: z.nativeEnum(SignatureStatus).optional(),  // NEW
  clientReceiptUrl: z.string().url().optional(),      // NEW
  agency: z.string().optional(),
  voucherNo: z.string().optional(),
  orReference: z.string().optional(),
});

export type CreateInterventionInput = z.infer<typeof CreateInterventionSchema>;
```

---

### `kapwa-server/src/sla/sla.service.ts` (service, batch/cron)
**Analog:** Self (`kapwa-server/src/sla/sla.service.ts`)

**NEW — @Cron decorator pattern** (lines 1-94, add @Cron):
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';   // NEW import
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case, CaseStatus } from '../cases/case.entity';
import { Notification } from '../notifications/notification.entity';
// ...existing imports...

@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);
  // ...constructor...

  @Cron(CronExpression.EVERY_30_MINUTES, { name: 'sla-escalation' })   // NEW
  async handleSlaCheck() {                                               // NEW
    await this.checkAndEscalate();                                       // NEW
  }                                                                      // NEW
```

**Working days calculator** (lines 84-93):
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

---

### `kapwa-server/src/sla/sla.module.ts` (config, dependency-injection)
**Analog:** Self (`kapwa-server/src/sla/sla.module.ts`)

**Module pattern — ADD ScheduleModule** (lines 1-14):
```typescript
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';           // NEW
import { TypeOrmModule } from '@nestjs/typeorm';
import { Case } from '../cases/case.entity';
import { Notification } from '../notifications/notification.entity';
import { SlaService } from './sla.service';
import { SlaController } from './sla.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),                                // NEW
    TypeOrmModule.forFeature([Case, Notification])
  ],
  controllers: [SlaController],
  providers: [SlaService],
  exports: [SlaService],
})
export class SlaModule {}
```

---

### `kapwa-server/src/sla/constants.ts` (config, static)
**Analog:** Self (`kapwa-server/src/sla/constants.ts`)

**UPDATE** (lines 1-8) — Change ALL gates to uniform 3-day thresholds per D-05:
```typescript
export const PENDING_ESCALATION_DAYS = 3;
export const PENDING_WARNING_DAYS = 2;        // unchanged
export const REVIEW_ESCALATION_DAYS = 3;      // was 5 → changed to 3
export const REVIEW_WARNING_DAYS = 2;          // was 3 → changed to 2
export const APPROVED_ESCALATION_DAYS = 3;     // was 7 → changed to 3
export const APPROVED_WARNING_DAYS = 2;        // was 5 → changed to 2
export const SATURDAY = 6;
export const SUNDAY = 0;
```

---

### `kapwa-server/src/tracker/tracker.service.ts` (service, CRUD)
**Analog:** Self (`kapwa-server/src/tracker/tracker.service.ts`)

**Sequence generation — EXTEND with NORZ-TRACK format** (lines 42-63):
```typescript
async createEntry(data: Partial<CaseTrackerLog>) {
  const nextSeq = await this.getNextSequence(data.transactionDate || new Date());
  const entry = this.trackerRepo.create({
    ...data,
    dailySeqNum: nextSeq,
  });
  return this.trackerRepo.save(entry);
}

// NEW — generate NORZ-TRACK ID
async generateTrackerId(date: Date, seqNum: number): Promise<string> {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `NORZ-TRACK-${year}-${month}${day}-${String(seqNum).padStart(3, '0')}`;
}
```

**Daily sequence helper** (lines 51-63):
```typescript
async getNextSequence(date: Date): Promise<number> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const lastEntry = await this.trackerRepo.findOne({
    where: { transactionDate: Between(start, end) },
    order: { dailySeqNum: 'DESC' },
  });

  return lastEntry ? lastEntry.dailySeqNum + 1 : 1;
}
```

---

### `kapwa-server/src/tracker/tracker.entity.ts` (model, CRUD)
**Analog:** Self (`kapwa-server/src/tracker/tracker.entity.ts`)

**Entity pattern — ADD trackerId field** (lines 1-42):
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique, Check } from 'typeorm';

@Entity('case_tracker_log')
@Unique(['transactionDate', 'dailySeqNum'])
export class CaseTrackerLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // NEW — NORZ-TRACK-YYYY-MMDD-NNN format
  @Column({ name: 'tracker_id', unique: true, nullable: true })
  trackerId?: string;

  @Column({ name: 'daily_seq_num' })
  dailySeqNum: number;

  @Column({ name: 'transaction_date' })
  transactionDate: Date;
  // ...remaining fields unchanged...
}
```

---

### `kapwa-server/src/sync/sync.service.ts` (service, event-driven/sync)
**Analog:** Self (`kapwa-server/src/sync/sync.service.ts`)

**Conflict detection with FSM-awareness — EXTEND processDelta** (lines 300-330):
```typescript
// In detectConflict(), add FSM transition handling for cases table
// The existing pattern already checks serverUpdatedAt vs clientUpdatedAt

// In processDelta(), add special handling for 'cases' tableName with FSM transitions:
if (change.tableName === 'cases') {
  // FSM transitions: server-wins for status conflicts
  // Reject if status changed on server after client's timestamp
  const serverCase = await this.dataSource.query(
    `SELECT status, updated_at FROM cases WHERE id = $1`,
    [change.recordId],
  );
  if (serverCase.length > 0 && change.payload?.status) {
    if (new Date(serverCase[0].updated_at) > new Date(change.clientUpdatedAt)) {
      // Server has newer status — reject client's FSM transition
      results.push({
        changeId: change.id,
        tableName: change.tableName,
        status: 'conflict',
        serverRecord: serverCase[0],
        reason: 'Case status changed on server — offline transition rejected',
      });
      continue;
    }
  }
}
```

**Resolve table name — ADD 'cases'** (lines 403-419):
```typescript
private resolveTableName(tableName: string): string {
  const tableMap: Record<string, string> = {
    cases: 'cases',
    // ...
  };
}
```

---

### `kapwa-server/src/database/migrations/*.ts` (migration, DDL)
**Analog:** `kapwa-server/src/database/migrations/20260619000001-audit-hash-chain.ts`

**Migration pattern — NEW exclusion constraint + btree_gist** (lines 1-44):
```typescript
// NEW FILE: 20260622000001-BtreeGistExclusionConstraint.ts

import { MigrationInterface, QueryRunner } from 'typeorm';

export class BtreeGistExclusionConstraint20260622000001 implements MigrationInterface {
  name = 'BtreeGistExclusionConstraint20260622000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Enable btree_gist extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);

    // 2. Add household_id column to interventions (denormalized)
    await queryRunner.query(`ALTER TABLE interventions ADD COLUMN IF NOT EXISTS household_id UUID`);

    // 3. Backfill household_id via JOIN
    await queryRunner.query(`
      UPDATE interventions i
      SET household_id = (
        SELECT h.id FROM households h
        JOIN beneficiaries b ON b.id = h.primary_beneficiary_id
        JOIN cases c ON c.beneficiary_id = b.id
        WHERE c.id = i.case_id
        LIMIT 1
      )
    `);

    // 4. Create exclusion constraint (defense-in-depth duplicate detection)
    await queryRunner.query(`
      ALTER TABLE interventions ADD CONSTRAINT no_duplicate_intervention_30d
      EXCLUDE USING gist (
        household_id WITH =,
        intervention_type WITH =,
        daterange(service_date, service_date + interval '30 days') WITH &&
      )
    `);

    // 5. Add tracker_id column to case_tracker_log
    await queryRunner.query(`ALTER TABLE case_tracker_log ADD COLUMN IF NOT EXISTS tracker_id VARCHAR UNIQUE`);

    // 6. Add signature fields to interventions
    await queryRunner.query(`ALTER TABLE interventions ADD COLUMN IF NOT EXISTS client_signature_url VARCHAR`);
    await queryRunner.query(`ALTER TABLE interventions ADD COLUMN IF NOT EXISTS client_receipt_url VARCHAR`);

    // 7. Add signature_status enum + column
    await queryRunner.query(`CREATE TYPE "public"."intervention_signature_status_enum" AS ENUM('signatures_pending', 'signatures_collected')`);
    await queryRunner.query(`ALTER TABLE interventions ADD COLUMN IF NOT EXISTS signature_status "public"."intervention_signature_status_enum" DEFAULT 'signatures_collected'`);

    // 8. Add transition_type and override_reason to case_history
    await queryRunner.query(`ALTER TABLE case_history ADD COLUMN IF NOT EXISTS transition_type VARCHAR DEFAULT 'standard'`);
    await queryRunner.query(`ALTER TABLE case_history ADD COLUMN IF NOT EXISTS override_reason VARCHAR`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE interventions DROP CONSTRAINT IF EXISTS no_duplicate_intervention_30d`);
    await queryRunner.query(`ALTER TABLE interventions DROP COLUMN IF EXISTS household_id`);
    await queryRunner.query(`ALTER TABLE case_tracker_log DROP COLUMN IF EXISTS tracker_id`);
    await queryRunner.query(`ALTER TABLE interventions DROP COLUMN IF EXISTS client_signature_url`);
    await queryRunner.query(`ALTER TABLE interventions DROP COLUMN IF EXISTS client_receipt_url`);
    await queryRunner.query(`ALTER TABLE interventions DROP COLUMN IF EXISTS signature_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."intervention_signature_status_enum"`);
    await queryRunner.query(`ALTER TABLE case_history DROP COLUMN IF EXISTS transition_type`);
    await queryRunner.query(`ALTER TABLE case_history DROP COLUMN IF EXISTS override_reason`);
  }
}
```

---

### `kapwa-client/src/pages/CasesPage.tsx` (component, request-response)
**Analog:** Self (`kapwa-client/src/pages/CasesPage.tsx`)

**Component pattern — EXTEND with role-specific action buttons:**
```typescript
// Add status-based action rendering per D-01:
function renderActions(c: CaseRow, role: string) {
  if (c.status === 'pending_assessment' && role === 'social_worker') {
    return <button className="btn btn-sm" onClick={() => requestReview(c.id)}>Request Review</button>;
  }
  if (c.status === 'in_review' && role === 'admin') {
    return <button className="btn btn-sm" onClick={() => approveCase(c.id)}>Approve</button>;
  }
  if (c.status === 'approved' && (role === 'admin' || role === 'finance')) {
    return <button className="btn btn-sm" onClick={() => disburseCase(c.id)}>Disburse</button>;
  }
  if (c.status === 'disbursed' && (role === 'admin' || role === 'social_worker')) {
    return <button className="btn btn-sm" onClick={() => closeCase(c.id)}>Close</button>;
  }
  return null;
}

// Add SLA overdue badge:
{c.slaOverdue && <span className="badge badge-warning">OVERDUE</span>}
```

---

### `kapwa-client/src/pages/InterventionsPage.tsx` (component, request-response)
**Analog:** Self (`kapwa-client/src/pages/InterventionsPage.tsx`)

**Component pattern — EXTEND with signature status display:**
```typescript
// In the table, add signature status column:
<td>
  {i.signatureStatus === 'signatures_pending'
    ? <span className="badge-pending">Signatures Pending</span>
    : <span className="badge-approved">✓ Signed</span>}
</td>
<td>
  {i.clientReceiptUrl
    ? <a href={i.clientReceiptUrl} target="_blank" className="text-[#2E5C8A] underline">Receipt</a>
    : <span className="text-gray-400">No receipt</span>}
</td>
```

---

### `kapwa-client/src/pages/BeneficiaryViewPage.tsx` (component, request-response)
**Analog:** Self (`kapwa-client/src/pages/BeneficiaryViewPage.tsx`)

**Component pattern — EXTEND with Case Tracker Log display:**
```typescript
// Add a new section in the beneficiary detail:
<div className="rounded-lg bg-white p-6 shadow-sm border border-gray-100">
  <div className="mb-3 flex items-center gap-2 text-[#2E5C8A]">
    <FileText size={18} />
    <h3 className="text-sm font-semibold">Case Tracker Log</h3>
  </div>
  {trackerEntries.length === 0 ? (
    <p className="text-sm text-gray-400">No tracker entries</p>
  ) : (
    <div className="space-y-2">
      {trackerEntries.map(entry => (
        <div key={entry.id} className="flex items-center justify-between rounded bg-gray-50 p-2 text-sm">
          <div>
            <p className="font-medium text-gray-800">{entry.trackerId}</p>
            <p className="text-xs text-gray-400">{entry.interventionRemarks}</p>
          </div>
          <span className="text-xs text-gray-500">#{entry.dailySeqNum}</span>
        </div>
      ))}
    </div>
  )}
</div>
```

---

### `kapwa-client/src/lib/api.ts` (utility, HTTP)
**Analog:** Self (`kapwa-client/src/lib/api.ts`)

**EXTEND with new FSM transition API functions + signature upload:**
```typescript
export async function requestReview(id: string) {
  return apiFetch(`/cases/${id}/request-review`, { method: 'PATCH', body: JSON.stringify({ status: 'in_review' }) });
}

export async function disburseCase(id: string, signature?: string) {
  return apiFetch(`/cases/${id}/disburse`, { method: 'PATCH', body: JSON.stringify({ status: 'disbursed', signature }) });
}

export async function closeCase(id: string) {
  return apiFetch(`/cases/${id}/close`, { method: 'PATCH', body: JSON.stringify({ status: 'closed' }) });
}

export async function overrideCaseStatus(id: string, status: string, reason: string) {
  return apiFetch(`/cases/${id}/override-status`, { method: 'PATCH', body: JSON.stringify({ status, reason }) });
}

// Signature upload to MinIO (existing upload endpoint uses 'documents' bucket)
export async function uploadSignature(file: Blob, fileName: string): Promise<string> {
  const token = localStorage.getItem('kapwa_token');
  const formData = new FormData();
  formData.append('file', file, fileName);
  const res = await fetch(`${API}/minio/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) throw new Error('Signature upload failed');
  const data = await res.json();
  return data.url;  // presigned GET URL
}

// SignaturePad dataUrl → Blob → upload flow:
export function dataURItoBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
  return new Blob([array], { type: mime });
}
```

---

### `kapwa-client/src/lib/offline-queue.ts` (utility, event-driven)
**Analog:** Self (`kapwa-client/src/lib/offline-queue.ts`)

**EXTEND — Add FSM-specific queue helper (only for pending→in_review per D-04):**
```typescript
// Per D-04: social worker can initiate pending→in_review offline
export async function queueFsmTransition(caseId: string, newStatus: string, payload: Record<string, unknown>): Promise<QueuedChange> {
  return queueChange('cases', caseId, 'UPDATE', {
    ...payload,
    status: newStatus,
    // Must track if this is a FSM transition for sync conflict resolution
    _fsmTransition: true,
    _clientUpdatedAt: new Date().toISOString(),
  });
}
```

---

### `kapwa-client/src/lib/sync.ts` (utility, event-driven/sync)
**Analog:** Self (`kapwa-client/src/lib/sync.ts`)

**EXTEND — Handle tracking ID conflicts and FSM resolution:**
```typescript
// When processing sync results for cases, handle FSM-specific conflicts:
for (const r of result.results as any[]) {
  if (r.tableName === 'cases' && r.status === 'conflict') {
    // Server-wins for FSM transitions — overwrite local status
    if (r.serverRecord?.status) {
      // Update local state to match server
      console.warn(`Case ${r.recordId}: server status is ${r.serverRecord.status}, discarding local transition`);
    }
  }
}
```

## Shared Patterns

### Authentication / Guard Pipeline
**Source:** `kapwa-server/src/cases/cases.controller.ts` (lines 12-15)
**Apply to:** All new controller endpoints (disburse, override-status, close)
```typescript
@Controller('cases')
@UseGuards(JwtAuthGuard, AbacGuard)
export class CasesController {
  // Per-gate @Roles() decorator
  @Patch(':id/disburse')
  @Roles('admin')           // Role-gated per D-01
  async disburse(...) { ... }
}
```

### Role-Based Access Decorator
**Source:** `kapwa-server/src/auth/decorators/roles.decorator.ts` (lines 1-4)
**Apply to:** All new controller endpoints
```typescript
import { SetMetadata } from '@nestjs/common';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

### Zod Validation via ZodPipe
**Source:** `kapwa-server/src/common/pipes/zod.pipe.ts` (lines 1-14)
**Apply to:** All new POST/PATCH endpoints
```typescript
import { PipeTransform, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { ZodSchema } from 'zod';

export class ZodPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}
  transform(value: unknown, metadata: ArgumentMetadata) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(result.error.format());
    }
    return result.data;
  }
}
```

### MinIO Upload + Presigned URL
**Source:** `kapwa-server/src/minio/minio.service.ts` (lines 33-43)
**Apply to:** Signature upload flow (both worker and client signatures)
```typescript
async uploadFile(bucket: string, fileName: string, fileBuffer: Buffer, mimeType: string): Promise<string> {
  await this.client.putObject(bucket, fileName, fileBuffer, fileBuffer.length, {
    'Content-Type': mimeType,
  });
  return this.client.presignedGetObject(bucket, fileName, 24 * 60 * 60);
}
```

### MinIO File Upload Controller
**Source:** `kapwa-server/src/minio/minio.controller.ts` (lines 25-41)
**Apply to:** Signature upload — REUSE as-is (note: bucket is hardcoded to 'documents'; planner may extend)
```typescript
@Post('upload')
@UseInterceptors(FileInterceptor('file'))
@Roles('admin', 'social_worker')
async upload(@UploadedFile() file: any) {
  if (!file) { throw new BadRequestException('File is required'); }
  const signedUrl = await this.minioService.uploadFile('documents', file.originalname, file.buffer, file.mimetype);
  return { url: signedUrl };
}
```

### SignaturePad Canvas Component
**Source:** `kapwa-client/src/components/forms/SignaturePad.tsx` (lines 1-138)
**Apply to:** Worker and client signature collection
```typescript
// Component API:
<SignaturePad
  onSave={(dataUrl: string) => {
    const blob = dataURItoBlob(dataUrl);
    const formData = new FormData();
    formData.append('file', blob, `signature-${Date.now()}.png`);
    // Upload to MinIO, then store returned URL on intervention
  }}
  label="Worker Signature"
/>
```

### NestJS Module Registration
**Source:** `kapwa-server/src/app.module.ts` (lines 33-88)
**Apply to:** Import new modules into AppModule (if any new modules are created)
```typescript
@Module({
  imports: [
    // All existing modules...
    SlaModule,          // Already imported — needs ScheduleModule.forRoot() added
    MinioModule,        // Already imported — reuse as-is
    // No new modules needed — all changes are EXTENDs to existing modules
  ],
})
export class AppModule {}
```

### Error Handling Pattern (NestJS)
**Source:** `kapwa-server/src/cases/cases.service.ts` (lines 101-113, 159-160)
**Apply to:** All service-layer validation
```typescript
throw new NotFoundException('Case not found');
throw new BadRequestException('Invalid transition...');
throw new ForbiddenException(`Role ${userRole} cannot...`);
// DB constraint violation (23505) — retry loop in create()
```

### Offline Queue Pattern
**Source:** `kapwa-client/src/lib/offline-queue.ts` (lines 44-71)
**Apply to:** Offline FSM transitions
```typescript
export async function queueChange(table: string, recordId: string, operation: SyncOperation, payload: Record<string, unknown>): Promise<QueuedChange> {
  const queue = loadQueue();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const change: QueuedChange = { id, tableName: table, recordId, operation, payload, clientUpdatedAt: now, serverVersion: 0, status: 'pending', retryCount: 0 };
  queue.push(change);
  saveQueue(queue);
  await incrementLocalVersion(table);
  return change;
}
```

### Module Definition Pattern
**Source:** `kapwa-server/src/cases/cases.module.ts` (lines 1-16)
**Apply to:** All NestJS modules
```typescript
@Module({
  imports: [TypeOrmModule.forFeature([...entities...]), ...otherModules],
  controllers: [...controllers],
  providers: [...services],
  exports: [...services]
})
export class SomeModule {}
```

## No Analog Found

All files in this phase are **extensions of existing modules** with existing analogs in the same file. Every file has a self-analog or a close role-match analog. There are no greenfield modules in Phase 3.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| *(none)* | | | All 22 files have existing analogs |

## Metadata

**Analog search scope:** 
- `kapwa-server/src/cases/` — CasesService, CasesController, CaseHistory, Case entity, Zod DTOs, Module
- `kapwa-server/src/interventions/` — InterventionsService, InterventionsController, Intervention entity, Zod DTOs, Module
- `kapwa-server/src/minio/` — MinioService, MinioController, MinioModule
- `kapwa-server/src/sla/` — SlaService, SlaController, constants, Module
- `kapwa-server/src/tracker/` — TrackerService, TrackerController, Tracker entity, Module
- `kapwa-server/src/sync/` — SyncService
- `kapwa-server/src/database/migrations/` — Existing migration files
- `kapwa-server/src/auth/decorators/` — Roles decorator
- `kapwa-server/src/common/pipes/` — ZodPipe
- `kapwa-server/src/auth/guards/` — AbacGuard, RolesGuard
- `kapwa-server/src/app.module.ts` — AppModule
- `kapwa-client/src/pages/` — CasesPage, InterventionsPage, BeneficiaryViewPage
- `kapwa-client/src/lib/` — api.ts, offline-queue.ts, sync.ts
- `kapwa-client/src/components/forms/` — SignaturePad.tsx

**Files scanned:** 25+ key reference files read directly from disk
**Pattern extraction date:** 2026-06-22
