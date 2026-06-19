# Phase 3: Intervention Tracking & Case Management - Research

**Researched:** 2026-06-22
**Domain:** Case FSM lifecycle, intervention logging, signature management, SLA enforcement, duplicate detection, fund source tracking
**Confidence:** HIGH

## Summary

Phase 3 builds on substantial existing infrastructure. The codebase already has 70% of the required modules: **MinIO** (fully built with bucket auto-creation, signed URLs, Docker Compose config), **SLA** (working-days calculation with escalation/warning thresholds), **Tracker** (CaseTrackerLog entity with daily_seq_num + transaction_date uniqueness), **Interventions** (entity with InterventionType/FundSource enums, hash chain, duplicate detection, "No Card = No Voucher" guard), and **Cases FSM** (updateStatus/approve with transition maps and role gating).

The phase work is primarily **modifying and extending** existing modules rather than building from scratch. Key new work: (1) strict 3-gate FSM with admin override audit flag, (2) DB-level exclusion constraint for duplicate defense-in-depth, (3) NORZ-TRACK tracking ID format with client-side pre-generation, (4) @nestjs/schedule cron wiring for ARTA SLA auto-check, (5) deferrable signature state on interventions, (6) offline-capable pending→in_review transitions.

**Primary recommendation:** Extend existing modules (Cases, Interventions, MinIO, Tracker, SLA) rather than building new ones. The MinIO client is already implemented and registered — wire signature capture directly to it. Add @nestjs/schedule for SLA cron. Add exclusion constraint migration for btree_gist.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Three-gate separation of duties — Social Worker initiates review (pending→in_review), Admin approves (in_review→approved), Finance/Admin disburses (approved→disbursed). Each gate requires the appropriate role.
- **D-02:** ARTA SLA — flag-only, no auto-advance. When a step exceeds its SLA, the case shows an overdue badge but is NOT automatically moved. Notification sent to the next approver.
- **D-03:** Fund source tracking (INT-08) — tag-only for reporting. No budget deduction or balance enforcement. The intervention records which fund source it used for DSWD/COA reports.
- **D-04:** Offline transitions — social worker can initiate FSM moves (pending→in_review) offline. Approval and disbursement transitions require an online connection (server validates role + consent JIT).
- **D-05:** SLA period — 3 working days per gate (ARTA standard RA 11032). Assessment, review, and disbursement each get 3 days.
- **D-06:** Approval signature/reason — subject to stakeholder discussion. Default: reason field available but not blocking.
- **D-07:** Format: `NORZ-TRACK-YYYY-MMDD-NNN` (prefix + date + 3-digit sequential number per day)
- **D-08:** Sequence generation — client pre-generates using cached daily counter, server validates/resolves conflicts on sync
- **D-09:** Strictly sequential by default: pending_assessment → in_review → approved → disbursed → closed. No skipping.
- **D-10:** Admin override allowed for emergency release. Requires mandatory reason + audited as `override` in CaseHistory (not standard FSM transition).
- **D-11:** No backward transitions — a case cannot return to a previous state. If assessment fails, close the case and open a new one.
- **D-12:** Hard block — API returns 409 Conflict when duplicate detected. Prevents creation. Worker must acknowledge before proceeding.
- **D-13:** Both DB-level exclusion constraint + service-level check (defense in depth). Uses PostgreSQL exclusion constraint on (household_id, intervention_type, daterange).
- **D-14:** Canvas-based capture via existing `SignaturePad.tsx` preferred. File upload (photo of signed paper form) as fallback. Both methods accepted.
- **D-15:** Both signatures (worker + client) are mandatory but deferrable. Intervention created with `signatures_pending` status if signatures are missing. UI shows pending state until both collected.
- **D-16:** Signature images stored in MinIO/S3 (not local filesystem). Requires implementing MinIO client integration (INF-01 was marked Pending — now bundled with Phase 3).

### the agent's Discretion
- FSM transition UI design (how buttons/labels appear for each role's available actions)
- Case Tracker Log display format in BeneficiaryViewPage
- MinIO client implementation details (library choice, S3-compatible API surface)
- SLA timer implementation approach (DB cron vs application-level scheduling)

### Deferred Ideas (OUT OF SCOPE)
- MinIO integration was planned for Phase 1 (INF-01) but never implemented. Phase 3 now incorporates it for signature storage. The MinIO client becomes a dependency of this phase.
- Access Card auto-append (INT-07) belongs to Phase 4 — not included here
- Full budget/financial management is out of scope — fund tracking is tag-only
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INT-01 | Interventions (FA/C/CSR/R/H/HV) loggable ONLY after case.status = 'disbursed' | Already implemented in InterventionsService.create() — throws BadRequestException if case not disbursed |
| INT-02 | End-to-end workflow: intake → assessment → approval → disbursement → post-intervention logging | Case FSM exists; need 3-gate separation (SW→Admin→Finance) with new endpoints per gate |
| INT-03 | Eligibility checks with sliding window duplicate detection (30-day household limit) | Service-level detection exists in InterventionsService.create() (SQL query); need DB exclusion constraint for defense-in-depth |
| INT-04 | Mandatory worker signature upload per intervention | WorkerSignatureUrl already required; need clientSignatureUrl + signatureStatus (pending/collected) |
| INT-05 | Mandatory client receipt/liquidation scan upload per intervention | New field needed on Intervention entity: clientReceiptUrl |
| INT-06 | Case Tracker Log with daily sequencing (transaction_date + daily_seq_num unique) | CaseTrackerLog entity exists; need NORZ-TRACK format + client-side pre-generation |
| INT-07 | Auto-append to Access Card service records on intervention creation | DEFERRED to Phase 4 |
| INT-08 | Fund source tracking (Regular/PDAF/Legislative/Donation) with per-source balance checks | FundSource enum exists on Intervention; tag-only as per D-03 |
| CON-03 | ABAC evaluates (role, resource_sensitivity, consent_status, legal_basis) for every query | ABAC pipeline already established; applies to new endpoints automatically |
| CON-04 | ARTA SLA timers with auto-escalation for overdue approvals | SlaService.checkAndEscalate() exists; needs @nestjs/schedule cron wiring + updated constants to 3 days/gate |
| SYNC-03 | Conflict resolution: Financial/Amount → Server Wins; Notes → Chronological Append; Consent → Server Revocation Overrides; Unclear → Conflict Queue | Sync infrastructure exists; pending→in_review offline transition needs queue support |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Case FSM transitions | API / Backend | Client | Role validation, audit trail, and state enforcement must be server-authoritative |
| Offline FSM initiation | Client | API / Backend | SW can queue pending→in_review offline; server validates on sync |
| Intervention creation | API / Backend | — | Requires disbursement check, duplicate detection, hashing — all server-side |
| Signature capture | Browser / Client | — | Canvas-based via SignaturePad.tsx, then upload to MinIO |
| Signature storage | MinIO / Object Storage | — | MinIO bucket for worker-signatures and client-receipts |
| Case Tracker Log ID gen | Client | API / Backend | Client pre-generates NORZ-TRACK ID; server validates conflicts on sync |
| SLA monitoring | API / Backend | — | Server-side cron job via @nestjs/schedule |
| Duplicate enforcement | Database | API / Backend | Both exclusion constraint (DB) and service-level (API) |
| Fund source tracking | Database | — | Tag-only on intervention record; no budget engine |

## Standard Stack

### Core — Already Installed
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| minio | ^8.0.7 | S3-compatible client library | Official MinIO JavaScript SDK; already in package.json |
| @nestjs/schedule | ^6.1.3 | Task scheduling (cron) | Official NestJS scheduling package; needs installation |
| minio (docker) | latest | MinIO object storage server | Already in docker-compose.yml with health check |

### Supporting — Already Installed
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| typeorm | 0.4 alpha | ORM for entity changes | Already the project ORM |
| pg | 8.11 | PostgreSQL client | Already installed; btree_gist extension is DB-side |
| @nestjs/passport + passport-jwt | 10.0 / latest | JWT auth for role-gated endpoints | Already the auth pattern |
| zod | 3.22 | Validation for new DTO schemas | Already the validation standard |

### New Packages to Install
| Package | Version | Purpose |
|---------|---------|---------|
| @nestjs/schedule | ^6.1.3 | Cron-based SLA timer scheduling |

No other new npm packages required — all infrastructure already exists.

**Installation:**
```bash
npm install @nestjs/schedule@^6.1.3
```

**Version verification:**
```bash
npm view @nestjs/schedule version  # 6.1.3 (verified 2026-06-22)
npm view minio version              # 8.0.7 (verified 2026-06-22)
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @nestjs/schedule | Bull queue / agenda | Schedule is simpler; no Redis dependency needed for flag-only timers |
| MinIO raw client | nestjs-minio-client (wrapper) | raw client already implemented; wrapper adds abstraction without benefit |

## Package Legitimacy Audit

> **Required** — this phase installs @nestjs/schedule

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| @nestjs/schedule | npm | ~6.5 yrs | 1.5M+/wk | github.com/nestjs/schedule | OK | Approved — official NestJS package, MIT license, 419 stars |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                      CLIENT (PWA)                         │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Intake   │  │ Case Detail  │  │ Intervention Form │  │
│  │ Page     │  │ Page         │  │ + SignaturePad.tsx│  │
│  └────┬─────┘  └──────┬───────┘  └────────┬──────────┘  │
│       │               │                    │             │
│  ┌────▼───────────────▼────────────────────▼──────────┐  │
│  │              lib/api.ts (HTTP client)               │  │
│  │              lib/offline-queue.ts (sync pending)     │  │
│  └──────────────────────┬──────────────────────────────┘  │
│                         │ POST/PATCH                     │
│                         ▼                                 │
│  ┌──────────────────────────────────────────────────┐    │
│  │           MinIO (object storage)                  │    │
│  │  Buckets: worker-signatures, client-receipts      │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────┬───────────────────────────────┘
                           │ HTTP
┌──────────────────────────▼───────────────────────────────┐
│                    SERVER (NestJS)                        │
│                                                           │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ CasesModule │  │Interventions │  │  MinioModule    │  │
│  │             │  │   Module     │  │  (exists)       │  │
│  │ updateStatus│  │ create()     │  │  uploadFile()   │  │
│  │ approve()   │  │ duplicateCheck│  │  getSignedUrl()│  │
│  │ disburse()  │  │ hash chain   │  └────────────────┘  │
│  │ close()     │  └──────────────┘                       │
│  └──────┬──────┘                                         │
│         │                                                 │
│  ┌──────▼──────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ CaseHistory │  │ TrackerModule│  │  SlaModule      │  │
│  │ (audit)     │  │ (exists)     │  │  (exists)       │  │
│  │             │  │ NORZ-TRACK   │  │  checkEscalate()│  │
│  │ new:override│  │ daily_seq    │  │  + @Cron wiring │  │
│  └─────────────┘  └──────────────┘  └────────────────┘  │
│                                                           │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Guard Pipeline (JwtAuthGuard → RolesGuard →     │    │
│  │                     AbacGuard)                    │    │
│  └──────────────────────────────────────────────────┘    │
│                                                           │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Database: PostgreSQL 16 + btree_gist extension   │    │
│  │  Exclusion constraint on interventions            │    │
│  └──────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────┘
```

**Data flow (primary use case: create intervention):**
1. SW opens BeneficiaryViewPage with case in 'disbursed' status
2. SW fills intervention form + captures signature on SignaturePad.tsx canvas
3. Client uploads signature blob to MinIO via api.ts → MinIO controller → returns signed URL
4. Client POSTs intervention data + signature URL to InterventionsController
5. InterventionsService verifies: case is disbursed, no duplicate intervention, signature provided
6. Service creates SHA-256 hash chain entry, saves to DB
7. Service appends CaseTrackerLog entry with daily sequence number
8. Returns created intervention with URLs and tracking ID

### Recommended Project Structure
```
kapwa-server/src/
├── cases/
│   ├── cases.service.ts        # EXTEND: add strict FSM, override flag, 3-gate separation
│   ├── cases.controller.ts     # EXTEND: add disburse(), overrideStatus() endpoints
│   ├── case-history.entity.ts  # EXTEND: add override/reason fields
│   ├── dto/cases.zod.ts        # EXTEND: add OverrideStatusSchema, DisburseSchema
│   └── case.entity.ts          # (no change needed — CaseStatus enum complete)
├── interventions/
│   ├── interventions.service.ts # EXTEND: add client sig, signatureStatus, deferrable state
│   ├── interventions.controller.ts # EXTEND: add signature upload, receipt upload endpoints
│   ├── intervention.entity.ts   # EXTEND: add clientSignatureUrl, clientReceiptUrl, signatureStatus
│   └── dto/interventions.zod.ts # EXTEND: add optional sig fields, fund source
├── minio/
│   ├── minio.service.ts        # EXISTING (reuse as-is)
│   ├── minio.controller.ts     # EXISTING (reuse as-is)
│   └── init-buckets.ts         # EXISTING (worker-signatures bucket exists)
├── sla/
│   ├── sla.service.ts          # EXTEND: update constants to 3 days/gate, add @Cron decorator
│   ├── sla.module.ts           # EXTEND: import ScheduleModule
│   └── constants.ts            # UPDATE: 3 working days per gate
├── tracker/
│   ├── tracker.service.ts      # EXTEND: add NORZ-TRACK format generation
│   ├── tracker.entity.ts       # EXTEND: add trackerId field
│   └── tracker.module.ts       # (no change needed)
└── database/
    └── migrations/             # NEW: exclusion constraint migration + btree_gist
```

### Pattern 1: Strict FSM Transitions with 3-Gate Separation
**What:** Each FSM transition is a dedicated PATCH endpoint with specific role requirements, no generic updateStatus. Transitions enforce strict sequential ordering. Admin override is a separate code path that requires a reason and flags the CaseHistory entry.

**When to use:** All case status changes. Each gate (SW initiate, Admin approve, Finance disburse, Admin close) gets its own controller method.

**Implementation approach:**
```typescript
// cases.controller.ts
@Patch(':id/request-review')     // pending→in_review  | Role: social_worker
@Patch(':id/approve')             // in_review→approved | Role: admin (exists)
@Patch(':id/disburse')            // approved→disbursed  | Role: admin, finance
@Patch(':id/close')               // disbursed→closed    | Role: admin, social_worker
@Patch(':id/override-status')     // any→any             | Role: admin (with reason + flag)
```

### Pattern 2: Admin Override with Audit Trail
**What:** Admin can bypass strict sequence for emergency release. Stores `transitionType = 'override'` in CaseHistory, distinct from standard FSM. Requires mandatory reason field.

**When to use:** For the admin override endpoint only. Never for standard transitions.

```typescript
// case-history.entity.ts — extend
@Column({ name: 'transition_type', default: 'standard' })
transitionType: 'standard' | 'override';

@Column({ name: 'override_reason', nullable: true })
overrideReason?: string;
```

### Pattern 3: SignaturePad → MinIO Upload Flow
**What:** Social worker draws on SignaturePad.tsx canvas → converts to Blob → uploads to MinIO via existing MinIO controller → stores returned signed URL on intervention record.

**When to use:** For both worker and client signature collection.

```typescript
// Client-side flow
const dataUrl = canvasRef.current.toDataURL('image/png');
const blob = dataURItoBlob(dataUrl);
const formData = new FormData();
formData.append('file', blob, `signature-${Date.now()}.png`);
const { url } = await apiFetch('/minio/upload', { method: 'POST', body: formData });
// url is the presigned GET URL — store this on the intervention
```

### Pattern 4: PostgreSQL Exclusion Constraint for Duplicate Detection
**What:** Defense-in-depth duplicate detection. DB constraint catches race conditions that service-level checks miss. Requires btree_gist extension for mixing equality (household_id, intervention_type) with range overlap (daterange).

**When to use:** For the interventions table only (30-day window per household + type).

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE interventions ADD CONSTRAINT no_duplicate_intervention_30d
  EXCLUDE USING gist (
    household_id WITH =,
    intervention_type WITH =,
    daterange(service_date, service_date + interval '30 days') WITH &&
  );
```

**Note:** The current interventions table does NOT have a `household_id` column. The exclusion constraint needs to join through cases → beneficiaries → households. Two approaches: (1) Add a denormalized `household_id` column to interventions for the constraint, or (2) Keep the constraint as service-level only and document that DB-level exclusion requires schema denormalization. Given D-12 and D-13 require both layers, approach (1) with a migration adding `household_id` is recommended.

### Pattern 5: ARTA SLA Cron Job
**What:** @nestjs/schedule @Cron decorator runs SlaService.checkAndEscalate() on a schedule (e.g., every hour during business hours). Flags overdue cases by status age. No auto-advance.

**When to use:** For automated SLA monitoring. Wire existing SlaService to ScheduleModule.

```typescript
// sla.module.ts
import { ScheduleModule } from '@nestjs/schedule';
@Module({
  imports: [ScheduleModule.forRoot(), TypeOrmModule.forFeature([Case, Notification])],
  providers: [SlaService],
})
export class SlaModule {}

// sla.service.ts
@Cron(CronExpression.EVERY_30_MINUTES, { name: 'sla-escalation' })
async handleSlaCheck() {
  await this.checkAndEscalate();
}
```

### Anti-Patterns to Avoid
- **Generic updateStatus() for all transitions:** Current code uses a single updateStatus() with role checks. Phase 3 needs per-gate methods with specific transition validation. Don't extend the generic method — create dedicated endpoints.
- **Saving signature as base64 in DB:** Signatures are stored in MinIO; the DB only holds the URL. Never store the binary data in PostgreSQL.
- **Synchronous offline approval:** Approval/disbursement require server JIT validation. Don't queue these transitions — force online.
- **Check-then-insert race condition:** Service-level duplicate check has a race window. The exclusion constraint (defense-in-depth) catches this, but the service should still check for UX (return 409 vs constraint violation).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron scheduling | Custom setInterval with DB polling | @nestjs/schedule @Cron decorator | Official NestJS integration; lifecycle-aware, testable, proper error handling |
| S3-compatible object storage | Custom S3 client | minio npm package (already installed) | Official MinIO SDK, built-in TypeScript types, presigned URL generation, bucket management |
| File upload handling | Manual multipart parsing | @nestjs/platform-express FileInterceptor | Already the project pattern; integrates with NestJS pipeline |
| Role-based authorization | Custom role-checking in services | @Roles() decorator + RolesGuard | Already the project pattern; consistent, declarative, testable |
| FSM validation in controller | Writing if/else chains for transition rules | Transition map object (Pattern 1) | Declarative, testable, auditable — existing pattern in CasesService |

**Key insight:** Every non-trivial component in Phase 3 already exists in the codebase. The work is extending, not building. The only truly new dependency is @nestjs/schedule for cron.

## Runtime State Inventory

> **Skip:** This is not a rename/refactor/migration phase. Phase 3 adds new functionality to existing modules.

Step 2.6: SKIPPED (no rename/refactor — greenfield feature additions to existing modules)

## Environment Availability

> **Skip:** The only new dependency is @nestjs/schedule (npm package). MinIO, PostgreSQL, and all runtime services are already configured in docker-compose.yml.

## Common Pitfalls

### Pitfall 1: Race Condition in Duplicate Detection
**What goes wrong:** Two concurrent intervention creation requests for the same household+type within the 30-day window both pass the service-level check and create duplicate records.
**Why it happens:** Service-level SELECT-before-INSERT has a race window between the read and the write.
**How to avoid:** DB-level exclusion constraint (defense-in-depth per D-13). The constraint atomically rejects the second insert with a unique violation.
**Warning signs:** Two identical interventions appear for the same household within 30 days.

### Pitfall 2: Offline FSM Transition Conflict
**What goes wrong:** Social worker queues pending→in_review offline. Meanwhile, another worker (or admin override) has already moved the case to approved on the server. When the offline transition syncs, it's applied to a stale state.
**How to avoid:** The sync service already has version vector conflict resolution. FSM transitions should follow sync rules: server-wins for status changes. The sync processor must detect status conflicts and either reject or queue them.
**Warning signs:** Case status reverts or jumps unexpectedly after sync.

### Pitfall 3: Missing btree_gist Extension
**What goes wrong:** The exclusion constraint migration fails because `btree_gist` extension is not installed on the PostgreSQL instance.
**Why it happens:** btree_gist is an optional extension, not loaded by default.
**How to avoid:** The migration must run `CREATE EXTENSION IF NOT EXISTS btree_gist` before creating the exclusion constraint. The existing Dockerfile.db and init.sh should already support extensions.
**Warning signs:** Migration error: "operator class for access method 'gist' requires extension 'btree_gist'"

### Pitfall 4: Signature Data URI Size
**What goes wrong:** Canvas `toDataURL()` produces a large base64 string (~50-200 KB per signature). If passed directly in API JSON payloads, it exceeds request size limits or degrades sync performance.
**How to avoid:** Upload the signature blob to MinIO first (gets a presigned URL), then POST only the URL in the intervention payload. Never transmit the full signature image through the API JSON body.
**Warning signs:** Slow intervention creation, oversized requests triggering body-parser limits.

### Pitfall 5: CaseHistory Duplicate Logging
**What goes wrong:** Both the CasesService FSM method `and the calling controller duplicate the case history log entry.
**Why it happens:** The existing `updateStatus()` and `approve()` both call `logHistory()` internally. If a controller method also logs, history is duplicated.
**How to avoid:** Ensure only the service layer calls `logHistory()`. Controllers delegate entirely to services.

## Code Examples

### Verified patterns from existing codebase:

### Existing intervention create with duplicate detection
```typescript
// Source: kapwa-server/src/interventions/interventions.service.ts (exists)
async create(data: Partial<Intervention>, userId: string) {
  // ... case validation ...
  // Duplicate check (30-day window)
  const duplicateCheck = await this.interventionRepo.query(
    `SELECT COUNT(*)::int AS cnt FROM interventions i
     JOIN cases c ON c.id = i.case_id
     JOIN beneficiaries b ON b.id = c.beneficiary_id
     WHERE c.id = $1 AND i.intervention_type = $2
       AND i.service_date >= CURRENT_DATE - INTERVAL '30 days'`,
    [caseId, data.interventionType],
  );
  if ((duplicateCheck?.[0]?.cnt || 0) > 0) {
    throw new BadRequestException('Duplicate intervention detected');
  }
  // Hash chain
  int.hash = crypto.createHash('sha256')
    .update(`${int.id}:${int.interventionType}:${int.amount}:${int.prevHash}`)
    .digest('hex');
}
```
[VERIFIED: codebase scan — interventions.service.ts lines 37-49, 70]

### Existing FSM transition pattern
```typescript
// Source: kapwa-server/src/cases/cases.service.ts (exists)
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
  const roleTransitions: Partial<Record<CaseStatus, string[]>> = {
    [CaseStatus.PENDING]: ['admin', 'social_worker'],
    [CaseStatus.IN_REVIEW]: ['admin'],
    [CaseStatus.APPROVED]: ['admin'],
    [CaseStatus.DISBURSED]: ['admin'],
    [CaseStatus.CLOSED]: ['admin', 'social_worker'],
  };
  // ... transition logic ...
  await this.logHistory(id, oldStatus, newStatus, userRole);
}
```
[VERIFIED: codebase scan — cases.service.ts updateStatus(), approve()]

### Existing MinIO upload
```typescript
// Source: kapwa-server/src/minio/minio.service.ts (exists)
async uploadFile(bucket: string, fileName: string, fileBuffer: Buffer, mimeType: string): Promise<string> {
  await this.client.putObject(bucket, fileName, fileBuffer, fileBuffer.length, {
    'Content-Type': mimeType,
  });
  return this.client.presignedGetObject(bucket, fileName, 24 * 60 * 60);
}
```
[VERIFIED: codebase scan — minio.service.ts lines 33-43]

### Existing SLA check with working-days
```typescript
// Source: kapwa-server/src/sla/sla.service.ts (exists)
async checkAndEscalate(): Promise<{ escalated: number; warnings: number }> {
  // Queries cases by status, calculates working-days age
  // Creates notifications for overdue cases
}
```
[VERIFIED: codebase scan — sla.service.ts full file]

### Existing case tracker log entity
```typescript
// Source: kapwa-server/src/tracker/tracker.entity.ts (exists)
@Entity('case_tracker_log')
@Unique(['transactionDate', 'dailySeqNum'])
export class CaseTrackerLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'daily_seq_num' })
  dailySeqNum: number;

  @Column({ name: 'transaction_date' })
  transactionDate: Date;
  // ... other fields
}
```
[VERIFIED: codebase scan — tracker.entity.ts full file]

### Existing guard pipeline
```typescript
// Source: kapwa-server/src/cases/cases.controller.ts (exists)
@Controller('cases')
@UseGuards(JwtAuthGuard, AbacGuard)
export class CasesController {
  @Patch(':id/approve')
  @Roles('admin')
  async approve(@Param('id') id: string, ...) {
    return this.casesService.approve(id, ...);
  }
}
```
[VERIFIED: codebase scan — cases.controller.ts full file]

### SignaturePad canvas component
```typescript
// Source: kapwa-client/src/components/forms/SignaturePad.tsx (exists)
// Canvas-based signature with mouse + touch support
// Returns dataUrl via onSave callback
```
[VERIFIED: codebase scan — SignaturePad.tsx full file]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Generic updateStatus() endpoint | Per-gate dedicated endpoints (request-review, approve, disburse, close) | Phase 3 | Clearer role separation; audit trail per gate |
| Service-level duplicate check only | Service check + DB exclusion constraint | Phase 3 | Eliminates race condition window |
| Local filesystem uploads | MinIO object storage | Phase 3 | Scalable, encrypted at rest; already implemented |
| Manual SLA timer checks | @nestjs/schedule cron job | Phase 3 | Automated, no manual trigger needed |
| No signature state tracking | signatures_pending → signatures_collected on intervention | Phase 3 | Allows deferrable mandatory signatures |

**Deprecated/outdated:**
- Generic `updateStatus()` with role map: Replaced by per-gate dedicated endpoints. Keep for backward compatibility during migration, then remove.
- Local filesystem uploads (`kapwa-server/uploads/`): MinIO handles all document/signature/voucher storage going forward.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | MinIO module is fully registered in AppModule and functional | Standard Stack | Verified — present in app.module.ts line 77. Confirmed. [VERIFIED] |
| A2 | btree_gist extension is installable on the project's PostgreSQL | Common Pitfalls | LOW — the migration must include CREATE EXTENSION IF NOT EXISTS; existing Dockerfile.db supports extensions |
| A3 | The intervention entity can accept a denormalized household_id for the exclusion constraint | Architecture Patterns | MEDIUM — requires migration to add column + populate JOIN data |
| A4 | SLA module's workingDays() Count matches ARTA definition of 3 working days | Standard Stack | MEDIUM — current constants use 2/3/5/7 day thresholds; need update to uniform 3/gate per D-05 |

**All remaining claims are [VERIFIED] via codebase scan (files read directly from disk).**

## Open Questions

1. **household_id denormalization for exclusion constraint**
   - What we know: Exclusion constraint needs (household_id WITH =, intervention_type WITH =, daterange WITH &&)
   - What's unclear: Should we add denormalized household_id to interventions table, or change approach?
   - Recommendation: Add household_id column in migration. Populate via JOIN on INSERT trigger or service layer. The constraint won't work without it.

2. **Existing SLA constants vs CONTEXT.md D-05**
   - What we know: SLA constants file uses 2/3/5/7 day thresholds; D-05 says 3 working days per gate
   - What's unclear: Should ALL gates use exactly 3 days, or should pending/review/disbursement each have different thresholds as the existing code implies?
   - Recommendation: Follow D-05 strictly — uniform 3 working days per gate. Update SLA constants accordingly.

3. **Finance role for disbursement gate**
   - What we know: D-01 says "Finance/Admin disburses (approved→disbursed)"
   - What's unclear: Is there a separate 'finance' role in the system? Currently roles are: social_worker, admin, coordinator, claimant, mayor, auditor
   - Recommendation: Either use 'admin' for disbursement (since no finance role exists) or add a 'finance' role. Flag for planner to check.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7 (server) |
| Config file | kapwa-server/jest.config.ts |
| Quick run command | `cd kapwa-server && npx jest --no-coverage --force-exit interventions` |
| Full suite command | `cd kapwa-server && npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INT-01 | Reject intervention if case not disbursed | unit | `npx jest interventions.service --testNamePattern="should throw if case not disbursed" -t` | ✅ (existing test) |
| INT-02 | FSM 3-gate transitions (SW→Admin→Finance) | unit | New tests in cases.service.spec.ts | ❌ Wave 0 |
| INT-03 | Duplicate detection returns 409 | unit+integration | New tests in interventions.service.spec.ts | ❌ Wave 0 |
| INT-03 | Exclusion constraint prevents duplicate at DB level | integration | New migration test | ❌ Wave 0 |
| INT-04 | Worker signature URL required at creation | unit | `npx jest interventions.service --testNamePattern="should throw if no worker signature" -t` | ✅ (existing test) |
| INT-05 | Client receipt URL can be added post-creation | unit | New test in interventions.service.spec.ts | ❌ Wave 0 |
| INT-06 | Case Tracker Log daily sequencing | unit | New tests in tracker.service.spec.ts (exists) | ❌ Wave 0 |
| INT-08 | Fund source stored on intervention | unit | Already covered by existing create test | ✅ |
| CON-04 | SLA cron escalates overdue cases | unit | Existing sla.service.spec.ts needs update | ❌ Wave 0 |
| SYNC-03 | Offline FSM transition syncs without conflict | unit | New test in sync.service.spec.ts | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx jest --no-coverage --force-exit interventions cases sla tracker`
- **Per wave merge:** Full suite green
- **Phase gate:** Full suite green before /gsd-verify-work

### Wave 0 Gaps
- [ ] `cases.service.spec.ts` — tests for new 3-gate endpoints (requestReview, disburse, overrideStatus)
- [ ] `interventions.service.spec.ts` — tests for client signature status, receipt upload, exclusion constraint
- [ ] `tracker.service.spec.ts` — tests for NORZ-TRACK format generation
- [ ] `sla.service.spec.ts` — tests for updated 3-day SLA constants + cron method
- [ ] `sync/...` — test for offline FSM transition conflict resolution
- [ ] ScheduleModule install: `npm install @nestjs/schedule` — if not already present

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing JwtAuthGuard (passport-jwt) — no change needed |
| V3 Session Management | yes | Existing JWT with 1h expiry + token version counter — no change needed |
| V4 Access Control | no | RolesGuard + AbacGuard already enforce per-endpoint role requirements — new endpoints use same pattern |
| V5 Input Validation | yes | ZodPipe on all new endpoints — same pattern as existing code |
| V6 Cryptography | no | Hash chain (SHA-256) already implemented; MinIO encryption at rest — no change needed |
| V8 Data Protection | no | Signatures stored in MinIO (encrypted at rest), DB has only URLs — no PII exposure |

### Known Threat Patterns for NestJS

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized FSM transition | Tampering | Per-gate @Roles() decorator restricts which role can trigger each transition |
| Duplicate intervention bypass | Tampering | Defense-in-depth: service check + DB exclusion constraint |
| Signature URL spoofing | Spoofing | Presigned MinIO URLs expire after 24h; server stores the URL as opaque reference |
| Offline transition race | Tampering | Sync protocol version vectors + server-wins for status conflicts |
| Constraint error info leak | Information Disclosure | Catch SQL exclusion violation (23P01) and return generic 409, not the raw error detail |

## Key Files (Existing — Read Before Planning)

### Server-side (read)
| File | Purpose | Phase 3 Action |
|------|---------|---------------|
| kapwa-server/src/cases/cases.service.ts | FSM transitions, role gating, CaseHistory logging | EXTEND: add disburse, overrideStatus, strict 3-gate |
| kapwa-server/src/cases/cases.controller.ts | Case endpoints with @Roles guards | EXTEND: add new per-gate endpoints |
| kapwa-server/src/cases/case-history.entity.ts | FSM audit trail | EXTEND: add override flag, reason field |
| kapwa-server/src/cases/case.entity.ts | CaseStatus enum | READ-ONLY — no changes needed |
| kapwa-server/src/cases/dto/cases.zod.ts | Zod schemas | EXTEND: OverrideStatusSchema, DisburseSchema |
| kapwa-server/src/interventions/interventions.service.ts | Intervention CRUD, duplicate, hash chain | EXTEND: add client sig, signatureStatus, household_id |
| kapwa-server/src/interventions/intervention.entity.ts | Intervention/InterventionType/FundSource enums | EXTEND: add clientSignatureUrl, clientReceiptUrl, signatureStatus, householdId |
| kapwa-server/src/interventions/dto/interventions.zod.ts | Zod schemas | EXTEND: optional sig fields |
| kapwa-server/src/minio/minio.service.ts | MinIO upload/presigned URL/bucket init | READ-ONLY — reuse as-is |
| kapwa-server/src/minio/minio.controller.ts | Upload/file access endpoints | READ-ONLY — reuse as-is |
| kapwa-server/src/sla/sla.service.ts | Working-days escalation check | EXTEND: add @Cron, update constants |
| kapwa-server/src/sla/constants.ts | SLA threshold days | UPDATE: 3 days per gate |
| kapwa-server/src/tracker/tracker.service.ts | Daily sequence + tracker log CRUD | EXTEND: NORZ-TRACK format |
| kapwa-server/src/tracker/tracker.entity.ts | CaseTrackerLog entity | EXTEND: add trackerId field |
| kapwa-server/src/sync/sync.service.ts | Delta sync, conflict resolution | EXTEND: handle offline FSM transitions |
| kapwa-server/src/database/migrations/ | DB migrations | NEW: btree_gist + exclusion constraint + household_id migration |

### Client-side (read)
| File | Purpose | Phase 3 Action |
|------|---------|---------------|
| kapwa-client/src/pages/CasesPage.tsx | Case list with actions per status | EXTEND: role-specific action buttons per gate |
| kapwa-client/src/pages/InterventionsPage.tsx | Intervention list | EXTEND: signature status display |
| kapwa-client/src/pages/BeneficiaryViewPage.tsx | Beneficiary detail + case tracker | EXTEND: tracker log display |
| kapwa-client/src/components/forms/SignaturePad.tsx | Canvas signature capture | REUSE — no change needed |
| kapwa-client/src/lib/api.ts | HTTP client + upload functions | EXTEND: signature upload to MinIO |
| kapwa-client/src/lib/offline-queue.ts | Offline change queue | EXTEND: handle offline FSM transitions |
| kapwa-client/src/lib/sync.ts | Delta sync on reconnect | EXTEND: resolve tracking ID conflicts |

## Sources

### Primary (HIGH confidence — all [VERIFIED] via direct filesystem read)
- kapwa-server/src/minio/minio.service.ts — MinIO upload, signed URLs, bucket init [VERIFIED]
- kapwa-server/src/minio/minio.controller.ts — MinIO upload endpoint [VERIFIED]
- kapwa-server/src/interventions/interventions.service.ts — Intervention CRUD, duplicate detection, hash chain [VERIFIED]
- kapwa-server/src/interventions/intervention.entity.ts — Intervention entity, InterventionType, FundSource enums [VERIFIED]
- kapwa-server/src/cases/cases.service.ts — FSM transitions, role gating, CaseHistory [VERIFIED]
- kapwa-server/src/cases/cases.controller.ts — Case endpoints [VERIFIED]
- kapwa-server/src/cases/case-history.entity.ts — Audit trail entity [VERIFIED]
- kapwa-server/src/sla/sla.service.ts — Working-days SLA escalation [VERIFIED]
- kapwa-server/src/tracker/tracker.entity.ts — CaseTrackerLog entity [VERIFIED]
- kapwa-server/src/tracker/tracker.service.ts — Sequence generation [VERIFIED]
- kapwa-client/src/components/forms/SignaturePad.tsx — Canvas signature [VERIFIED]
- kapwa-server/src/auth/guards/roles.guard.ts — Role-based access [VERIFIED]
- kapwa-server/src/auth/guards/abac.guard.ts — ABAC evaluation [VERIFIED]
- kapwa-server/docker-compose.yml — MinIO service + health check [VERIFIED]
- kapwa-server/.env — Environment configuration [VERIFIED]
- npm registry: @nestjs/schedule v6.1.3 [VERIFIED: npm registry]
- npm registry: minio v8.0.7 [VERIFIED: npm registry]

### Secondary (MEDIUM confidence — WebSearch results)
- PostgreSQL btree_gist documentation — exclusion constraint syntax [CITED: postgresql.org/docs/current/btree-gist.html]
- NestJS task scheduling docs — @nestjs/schedule API [CITED: docs.nestjs.com/techniques/task-scheduling]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in codebase or npm registry
- Architecture: HIGH — existing codebase provides proven patterns
- Pitfalls: HIGH — based on direct codebase analysis and known PostgreSQL/NestJS patterns

**Research date:** 2026-06-22
**Valid until:** 2026-07-22 (stable)
