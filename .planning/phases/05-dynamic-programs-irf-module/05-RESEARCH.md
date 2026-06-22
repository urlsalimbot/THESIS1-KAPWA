# Phase 5: Dynamic Programs & IRF Module - Research

**Researched:** 2026-06-22
**Domain:** Dynamic intervention program configuration, JSON Schema form templates, multi-step approval workflows, pgcrypto AES-256 encryption, name masking, WCPD/PNP secure export, disposition FSM
**Confidence:** HIGH

## Summary

Phase 5 delivers two significant subsystems on top of existing infrastructure. **Dynamic Programs** extends the scaffolded ProgramsModule with structured approval workflows (separate entity per program), JSON Schema form templates (reusing the existing `JsonSchemaForm.tsx` renderer), and a new `ProgramAssignment` entity linking case intake to configurable multi-step approvals — with the fully-approved state materializing as an Intervention record. **IRF Module** already has substantial implementation (encryption, export, controller), but needs enhancement for per-record AES-256 via pgcrypto, disposition FSM upgrade to 4-state model, name masking via PostgreSQL VIEWs, and PDF export via pdfkit.

Both subsystems reuse the established NestJS module pattern, guard pipeline (JwtAuthGuard → RolesGuard → AbacGuard), Zod validation, and the Phase 3 working-days SLA pattern. The IRF's current encryption uses a single env-var key with Node.js `crypto.createCipheriv` — this needs architectural work to adopt the per-record key model with pgcrypto.

**Primary recommendation:** Extend existing scaffolded modules (ProgramsEntity → ProgramsModule, IrfCase → IrfModule). Create new `ProgramAssignment` entity + service for the approval workflow. Use pgcrypto `encrypt()`/`decrypt()` for server-side key wrapping and per-record AES-256. Reuse `JsonSchemaForm.tsx` as-is for program form templates.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Program = configurable intervention template. Admin defines: name, legal basis, required docs, waiting period, fund source. Custom intake questionnaires are NOT needed.
- **D-02:** Required documents are hybrid — worker marks documents received in-person (checklist), can optionally upload digital copies to MinIO.
- **D-03:** Program assignment is part of case intake. Each assignment creates an intervention record.
- **D-04:** Approval workflow is multi-step, fully configurable per program. Admin defines step names AND which role approves each step.
- **D-05:** Rejection allowed at any step. Rejection ends workflow with "Rejected" status. Worker can resubmit.
- **D-06:** SLA timers with escalation — each step has configurable SLA (default: 3 working days per ARTA RA 11032). Same pattern as Phase 3 Cases FSM SLA.
- **D-07:** Once fully approved, the program assignment is logged as an intervention in the existing intervention system.
- **D-08:** Full end-to-end encryption. Client encrypts victim narration before sending over HTTPS. Server stores encrypted blob.
- **D-09:** Per-IRF record key — each IRF gets a unique AES-256 key. The key is encrypted with authorized users' public keys and stored alongside the record. Re-encrypt on role/consent changes.
- **D-10:** pgcrypto extension is already available — use it for server-side key wrapping and decryption operations.
- **D-11:** DB-level masking via PostgreSQL views with pgcrypto. Default views return masked names.
- **D-12:** Two-step unlock for unmasked names — user enters legal basis code → server validates and logs audit entry → session-level access.
- **D-13:** Any authenticated user with a valid legal basis code can unlock. Audit log tracks who accessed what and why.
- **D-14:** Both PDF (AES password-protected via existing pdfkit) and JSON (machine-readable encrypted bundle) export formats. Existing exportWcpd() serves as base.
- **D-15:** Export authorized for any authenticated user with a valid legal basis code + reason. Full audit trail logged.
- **D-16:** Legal basis code entered at export time, validated, logged to audit ledger.
- **D-17:** Standalone FSM with optional case link. IRF has its own disposition lifecycle: Under Investigation → (Referred to PNP | Referred to WCPD | Dismissed) → Closed.
- **D-18:** Disposition states follow same strict FSM pattern as Phase 3 Cases — no backward transitions, admin override with reason as exception.

### the agent's Discretion
- Program form UI — how the admin configures steps, roles, documents, and metadata
- Document upload UX — MinIO integration details
- Program assignment UI in case intake flow
- IRF submission form layout and field structure
- SLA timer implementation (DB cron vs app-level scheduling — same choice as Phase 3)
- Approved-program-to-intervention mapping details
- PDF export template design
- Key management implementation details (RSA key pair generation, storage, rotation)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRG-01 | Admin can configure programs (name, category, waiting period, required docs, fund sources) | ProgramsModule exists with full CRUD scaffold; entity needs `approval_workflow` changed from text[] to JSONB; new field `legal_basis` needed |
| PRG-02 | Program config includes JSON Schema form template for dynamic UI rendering | `formTemplate` JSONB field exists on Program entity; `JsonSchemaForm.tsx` renders JSON Schema formats already |
| PRG-03 | Approval workflow per program type with configurable steps | Need to change `approvalWorkflow` from text[] (string array) to JSONB (structured steps); create `ProgramAssignment` entity + `ProgramAssignmentStep` for runtime tracking |
| IRF-01 | Staff can submit IRF with blotter entry number, case category, Item A/B/C fields | IrfModule exists with POST working; blotter sequence via `irf_blotter_seq` table |
| IRF-02 | AES-256 encryption of victim narration via pgcrypto; names masked by default | Current: Node.js crypto with single env key. Need pgcrypto `encrypt()`/`decrypt()` with per-record keys; name masking via application layer (already done) + PostgreSQL VIEWs |
| IRF-03 | Secure export to WCPD/PNP requiring legal_basis_code + audit log entry | `exportWcpd()` exists at irf.service.ts:105-151; controller route exists at irf.controller.ts:76-84; need PDF generation + audit log |
| IRF-04 | Case disposition tracking: Under Investigation → Referred → Closed | Current: 3-state FSM. Need 4-state: Under Investigation → (Referred to PNP | Referred to WCPD | Dismissed) → Closed |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Program CRUD (admin) | API / Backend | Client | Admin configures programs server-side; client renders config forms |
| JSON Schema form storage | Database | API / Backend | `formTemplate` JSONB stored on Program entity |
| JSON Schema form rendering | Browser / Client | — | `JsonSchemaForm.tsx` renders from JSON Schema data |
| Approval workflow definition | API / Backend (JSONB) | — | Config stored per program as structured JSONB |
| Program assignment during intake | API / Backend | Client | Assignment creates ProgramAssignment record server-side |
| Multi-step approval processing | API / Backend | — | Step-by-step approval with role gating per step |
| Program→Intervention materialization | API / Backend | — | Fully approved assignment creates Intervention record |
| SLA timer for program steps | API / Backend | — | Same @nestjs/schedule cron pattern as Phase 3 |
| IRF submission | API / Backend | Client | POST to IrfController → creates encrypted record |
| AES-256 encryption per-record key | API / Backend | Database (pgcrypto) | Generate per-record key via pgcrypto `gen_random_bytes()` |
| Key wrapping (RSA) | API / Backend | — | Encrypt per-record AES key with authorized users' RSA public keys |
| Name masking | Database (VIEWs) | API / Backend | PostgreSQL VIEWs with conditional decryption; application layer fallback |
| Legal basis audit | API / Backend | Database | Audit log entry per D-13, D-15, D-16 |
| WCPD/PNP export | API / Backend | — | PDF (pdfkit) + JSON generation server-side |
| Disposition FSM | API / Backend | — | Same strict FSM pattern as Phase 3 CasesService |
| Password-protected PDF | API / Backend | — | pdfkit with AES encryption built in |

## Standard Stack

### Core — Already Installed
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pgcrypto | PostgreSQL 16 ext | AES-256 encrypt/decrypt, gen_random_bytes | Already in migrate.ts line 17; loaded in all environments |
| pdfkit | ^0.19 | PDF generation for WCPD/PNP export | Already in package.json; used by CSR module |
| @nestjs/schedule | ^6.1.3 | Cron-based SLA escalation | Same pattern as Phase 3 SLA module; already expected |
| typeorm | 0.4 alpha | ORM for entity/migration changes | Already project standard |
| zod | 3.22 | Validation for new DTO schemas | Already project standard |
| pg | 8.11 | PostgreSQL driver | Already installed |

### Supporting — Already Installed
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| minio | ^8.0.7 | Document upload (program docs, IRF attachments) | Already installed, registered, working |
| @nestjs/jwt + passport-jwt | 10.0+ | JWT auth for guard pipeline | Already project standard |
| @nestjs/common | 11.x | NestJS module/controller/service/decorator patterns | Already project standard |
| Swagger decorators | built-in | API documentation for new endpoints | Already project standard |

### New / To Install
| Package | Version | Purpose | Notes |
|---------|---------|---------|-------|
| @nestjs/schedule | ^6.1.3 | SLA cron scheduling for program step escalations | Only if not already installed from Phase 3 |
| @peculiar/webcrypto OR node:crypto (built-in) | — | Client-side AES-256 key generation (per D-08) | Web Crypto API available in modern browsers; Node.js crypto built-in for server |

**No new npm packages are strictly required** — pgcrypto is a PostgreSQL extension (already enabled), pdfkit is already in dependencies, and Web Crypto API is browser-native.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| @nestjs/schedule | npm | ~6.5 yrs | 1.5M+/wk | github.com/nestjs/schedule | OK | Approved if not already installed from Phase 3 |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

[ASSUMED] No new packages needed unless pdfkit missing encryption features for AES password-protected output.

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                          CLIENT (PWA)                                 │
│  ┌──────────────────┐  ┌────────────────┐  ┌────────────────────┐   │
│  │ Programs Admin   │  │ Case Intake    │  │ IRF Submission     │   │
│  │ Page             │  │ (assign prog)  │  │ Form (JsonSchema?  │   │
│  └───────┬──────────┘  └───────┬────────┘  │ SignaturePad.tsx)  │   │
│          │                     │            └────────┬───────────┘   │
│          │                     │                     │               │
│  ┌───────▼─────────────────────▼─────────────────────▼───────────┐   │
│  │                    lib/api.ts (HTTP client)                    │   │
│  │                    lib/offline-queue.ts (sync pending)         │   │
│  └──────────────────────────┬────────────────────────────────────┘   │
│                             │ POST/PATCH/GET                        │
│  ┌──────────────────────────┴────────────────────────────────────┐  │
│  │  MinIO (object storage) — program doc uploads, IRF attachments│  │
│  └───────────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTP /api
┌──────────────────────────────▼──────────────────────────────────────┐
│                        SERVER (NestJS)                               │
│                                                                      │
│  ┌────────────────────┐   ┌──────────────────┐   ┌───────────────┐  │
│  │ ProgramsModule     │   │ IrfModule         │   │ CasesModule   │  │
│  │ programs.controller│   │ irf.controller.ts │   │ (ref:case for │  │
│  │ programs.service   │   │ irf.service.ts    │   │  assignment)  │  │
│  │ program.entity     │   │ irf-case.entity   │   └───────────────┘  │
│  │ NEW: approval_wf   │   │ dto/irf.zod.ts    │                     │
│  │   JSONB            │   └────────┬──────────┘                     │
│  └────────┬───────────┘            │                                │
│           │                        │                                │
│  ┌────────▼───────────┐   ┌────────▼──────────┐                     │
│  │ NEW: ProgramAssign │   │ IrfExportService  │                     │
│  │ Module             │   │ (NEW: PDF via     │                     │
│  │ ProgramAssignment  │   │  pdfkit + AES pw) │                     │
│  │ ProgramAssignStep  │   │ JSON bundle gen   │                     │
│  │ assign.service     │   └───────────────────┘                     │
│  └────────┬───────────┘                                             │
│           │                                                         │
│  ┌────────▼───────────┐   ┌──────────────────┐   ┌───────────────┐  │
│  │ InterventionsModule│   │ SlaModule         │   │ AuditModule   │  │
│  │ (existing — for    │   │ (existing + ext)  │   │ (existing)    │  │
│  │  materialization)  │   │ new:ProgramSLA    │   └───────────────┘  │
│  └────────────────────┘   └──────────────────┘                     │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Guard Pipeline (JwtAuthGuard → RolesGuard → AbacGuard)       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Database: PostgreSQL 16                                       │   │
│  │ Extensions: pgcrypto (AES-256), uuid-ossp                     │   │
│  │ NEW VIEWs: masked_irf_cases, irf_cases_unmasked (pgcrypto)   │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

**Data flow (primary use case: program assignment → intervention):**
1. Worker assigns program to beneficiary during case intake
2. Server creates `ProgramAssignment` record with status='pending'
3. Server creates `ProgramAssignmentStep` records from program's `approval_workflow` JSONB
4. Each step is approved/rejected sequentially by the configured role
5. Rejection at any step → assignment status='rejected'; worker can resubmit
6. All steps approved → assignment status='approved'
7. A new `Intervention` record is created linking to the case (D-07)
8. SLA cron checks pending steps daily; escalations create notifications

**Data flow (primary use case: IRF submission → decryption):**
1. Staff fills IRF form + captures narration text + signatures via SignaturePad
2. Client generates random AES-256 key (per-record key) via Web Crypto API
3. Client encrypts narration with AES key (client-side, D-08)
4. Client fetches authorized users' RSA public keys from server
5. Client encrypts AES key with each authorized user's RSA public key
6. Client POSTs: encrypted_narration + wrapped_keys array + IRF metadata
7. Server stores encrypted_narration (BYTEA) + key_wraps (JSONB)
8. Default view returns masked names (application-layer or VIEW)
9. To decrypt: user enters legal_basis_code → server logs audit → returns encrypted data
10. Client decrypts wrapped AES key with user's RSA private key
11. Client decrypts narration with AES key using Web Crypto API

### Recommended Project Structure

```
kapwa-server/src/
├── programs/
│   ├── programs.service.ts          # EXTEND: CRUD for new approval_workflow JSONB
│   ├── programs.controller.ts       # EXTEND: admin CRUD endpoints (existing)
│   ├── program.entity.ts            # EXTEND: approval_workflow → JSONB, add legal_basis
│   ├── dto/programs.zod.ts          # EXTEND: approvalWorkflow structured schema
│   ├── form-version-history.entity.ts # EXISTING (no change needed)
│   └── programs.module.ts           # EXTEND: import ProgramAssignmentModule
├── program-assignments/              # NEW MODULE
│   ├── program-assignment.entity.ts  # NEW
│   ├── program-assignment-step.entity.ts # NEW
│   ├── program-assignments.service.ts # NEW: approval flow, materialization
│   ├── program-assignments.controller.ts # NEW: approve/reject step endpoints
│   ├── dto/program-assignments.zod.ts # NEW
│   └── program-assignments.module.ts # NEW
├── irf/
│   ├── irf.service.ts               # EXTEND: pgcrypto encrypt/decrypt, key mgmt
│   ├── irf.controller.ts            # EXTEND: disposition, decrypt, export endpoints (exists)
│   ├── irf-case.entity.ts           # EXTEND: key_wraps JSONB, key_version
│   ├── dto/irf.zod.ts               # EXTEND: disposition schema with new states
│   ├── irf.module.ts                # EXTEND: register new providers
│   ├── irf-export.service.ts        # NEW: PDF via pdfkit + AES pw, JSON bundle
│   ├── irf-audit.service.ts         # NEW: legal basis audit logging
│   └── irf-key.service.ts           # NEW: RSA key management, per-record key generation
├── sla/
│   ├── sla.service.ts               # EXTEND: add program assignment SLA check
│   └── constants.ts                 # EXTEND: program step SLA constants (already 3 days)
└── database/
    └── migrations/                  # NEW: migration(s) for all schema changes
```

### Pattern 1: Structured Approval Workflow with Step-by-Step Role Gating
**What:** Replace the current `approvalWorkflow: string[]` (flat role list) with a structured JSONB array of step objects, each defining step name, approver role, SLA days, and order. At program assignment time, these steps materialize as `ProgramAssignmentStep` records that get approved/rejected sequentially.

**When to use:** For all program approval workflows. Each program defines its own multi-step pipeline.

```typescript
// Program entity — approval_workflow stored as JSONB
@Entity('programs')
export class Program {
  // ... existing fields ...

  @Column({ type: 'jsonb', name: 'approval_workflow', nullable: true })
  approvalWorkflow?: ApprovalStep[];

  @Column({ nullable: true, name: 'legal_basis' })
  legalBasis?: string;  // NEW: legal underpinning for DSWD/COA
}

// Approval step interface
interface ApprovalStep {
  stepName: string;        // e.g., "Intake Review"
  approverRole: string;    // e.g., "social_worker"
  slaDays: number;         // default: 3 (ARTA RA 11032)
  order: number;
}

// ProgramAssignment entity tracks runtime state
@Entity('program_assignments')
export class ProgramAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'case_id' })
  caseId: string;

  @Column({ name: 'program_id' })
  programId: string;

  @Column({ default: 'pending' })
  status: 'pending' | 'in_review' | 'approved' | 'rejected';

  @Column({ name: 'current_step_order', default: 0 })
  currentStepOrder: number;

  @Column({ name: 'assigned_worker_id' })
  assignedWorkerId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

// ProgramAssignmentStep tracks each step's approval
@Entity('program_assignment_steps')
export class ProgramAssignmentStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'assignment_id' })
  assignmentId: string;

  @Column({ name: 'step_order' })
  stepOrder: number;

  @Column({ name: 'step_name' })
  stepName: string;

  @Column({ name: 'approver_role' })
  approverRole: string;

  @Column({ default: 'pending' })
  status: 'pending' | 'approved' | 'rejected';

  @Column({ name: 'approved_by', nullable: true })
  approvedBy?: string;

  @Column({ name: 'approved_at', nullable: true })
  approvedAt?: Date;

  @Column({ nullable: true })
  remarks?: string;
}
```
**Source:** Pattern derived from CONTEXT.md D-01–D-07, adapted from CasesService FSM pattern at kapwa-server/src/cases/cases.service.ts [VERIFIED: codebase scan]

### Pattern 2: Per-Record AES-256 Key with pgcrypto + RSA Key Wrapping
**What:** Each IRF record gets a unique 256-bit AES key generated by `pgcrypto.gen_random_bytes(32)`. The narration is encrypted with this key using `pgcrypto.encrypt()`. The per-record key is itself encrypted with each authorized user's RSA public key and stored as a JSONB key_wraps array.

**When to use:** For all IRF victim narration encryption (IRF-02, D-08, D-09, D-10).

```sql
-- Server-side: generate per-record key via pgcrypto
SELECT encode(gen_random_bytes(32), 'hex') AS record_key;

-- Encrypt narration with per-record key
UPDATE irf_cases
SET encrypted_narration = encrypt(
  convert_to($narration, 'UTF8'),
  decode($record_key, 'hex'),
  'aes-256-cbc/pad:pkcs'
)
WHERE id = $irfId;

-- Decrypt narration
SELECT convert_from(
  decrypt(encrypted_narration, decode($record_key, 'hex'), 'aes-256-cbc/pad:pkcs'),
  'UTF8'
) AS narration
FROM irf_cases
WHERE id = $irfId;
```

```typescript
// Key wrap storage on IrfCase entity
@Entity('irf_cases')
export class IrfCase {
  // ... existing fields ...

  @Column({ type: 'jsonb', name: 'key_wraps', nullable: true })
  keyWraps?: KeyWrap[];  // Array of { userId: string, encryptedKey: string (base64) }
}

interface KeyWrap {
  userId: string;
  encryptedKey: string;  // Per-record AES key encrypted with user's RSA public key (base64)
}
```
**Source:** pgcrypto encrypt/decrypt functions [CITED: postgresql.org/docs/current/pgcrypto.html]; key wrapping pattern from D-09 [VERIFIED: CONTEXT.md]

### Pattern 3: PostgreSQL VIEWs for Name Masking
**What:** Default irf_cases queries return masked names (initials). VIEW provides conditional unmasking via application-layer access control. Implements D-11/D-12.

**When to use:** For IRF queries where victim/person-reported names must be masked by default.

Two implementation approaches:

**Approach A (Application-layer — simpler, already partially done):**
The existing IrfService already masks names in `findAll()` and `findById()` via:
```typescript
itemBPersonReported: irf.itemBPersonReported
  ? { ...irf.itemBPersonReported, surname: '[REDACTED]', firstName: '[REDACTED]' }
  : null
```

**Approach B (PostgreSQL VIEWs — per D-11):**
```sql
-- Masked view (default)
CREATE VIEW masked_irf_cases AS
SELECT
  id,
  blotter_entry_number,
  case_category,
  datetime_reported,
  datetime_incident,
  -- Mask person names (initials only)
  jsonb_build_object(
    'surname', left(item_b_person_reported->>'surname', 1) || '.',
    'firstName', left(item_b_person_reported->>'firstName', 1) || '.'
  ) AS item_b_person_reported_masked,
  '[REDACTED]' AS victim_name,
  encrypted_narration,  -- Always encrypted, so safe
  case_disposition,
  created_at
FROM irf_cases;

-- Unmasked view (requires legal_basis_code session param + audit)
CREATE VIEW unmasked_irf_cases AS
SELECT
  id,
  blotter_entry_number,
  case_category,
  item_a_reporting_person,
  item_b_person_reported  -- Full data
FROM irf_cases
WHERE current_setting('app.legal_basis_code', true) IS NOT NULL
  AND current_setting('app.audit_logged', true) = 'true';
```

**Recommendation:** Start with Approach A (application-layer, already done in IrfService). Add VIEWs as a secondary layer if time permits. The VIEW-based approach has a security risk if RLS session params are not properly set (same concern as existing RLS — see CONCERNS.md).
**Source:** Existing masking in IrfService.findAll() lines 56-61 [VERIFIED: codebase scan]; D-11, D-12 [VERIFIED: CONTEXT.md]

### Pattern 4: IRF Disposition FSM with 4-State Model
**What:** Extends the current 3-state FSM (Under Investigation → Referred → Closed) to 4-state with optional case link: Under Investigation → (Referred to PNP | Referred to WCPD | Dismissed) → Closed. Same strict FSM pattern as Phase 3 CasesService.

**When to use:** For all IRF disposition transitions.

```typescript
// irf.service.ts — enhanced disposition model
const VALID_DISPOSITIONS = [
  'Under Investigation',
  'Referred to PNP',
  'Referred to WCPD',
  'Dismissed',
  'Closed',
] as const;

const DISPOSITION_TRANSITIONS: Record<string, string[]> = {
  'Under Investigation': ['Referred to PNP', 'Referred to WCPD', 'Dismissed'],
  'Referred to PNP': ['Closed'],
  'Referred to WCPD': ['Closed'],
  'Dismissed': ['Closed'],
  'Closed': [],
};
```
**Source:** Pattern matches CasesService transition map at cases.service.ts lines 149-155 [VERIFIED: codebase scan]; D-17, D-18 [VERIFIED: CONTEXT.md]

### Pattern 5: Program Assignment → Intervention Materialization
**What:** When all ProgramAssignmentStep records reach 'approved' status, the system creates an Intervention record in the existing InterventionsModule. This bridges the gap between configurable program approval and the fixed intervention system.

**When to use:** After every step approval — check if all steps are approved, then materialize.

```typescript
// program-assignments.service.ts
async approveStep(assignmentId: string, stepOrder: number, userId: string) {
  const assignment = await this.findById(assignmentId);
  const step = await this.stepRepo.findOne({
    where: { assignmentId, stepOrder }
  });
  if (!step) throw new NotFoundException('Step not found');
  
  step.status = 'approved';
  step.approvedBy = userId;
  step.approvedAt = new Date();
  await this.stepRepo.save(step);

  // Check if all steps are now approved
  const pendingSteps = await this.stepRepo.count({
    where: { assignmentId, status: 'pending' }
  });

  if (pendingSteps === 0) {
    // All steps approved → materialize intervention
    assignment.status = 'approved';
    await this.interventionsService.create({
      caseId: assignment.caseId,
      interventionType: InterventionType.FA, // or derived from program
      amount: 0,
      fundSource: FundSource.REGULAR, // derived from program
      serviceDate: new Date(),
      workerSignatureUrl: '', // filled later
    }, userId);
  } else {
    // Advance to next step
    assignment.currentStepOrder = this.nextStepOrder(assignment.currentStepOrder);
    assignment.status = 'in_review';
  }

  await this.assignRepo.save(assignment);
}
```
**Source:** D-03, D-07 [VERIFIED: CONTEXT.md]; InterventionsService.create() at interventions.service.ts [VERIFIED: codebase scan]

### Pattern 6: WCPD/PNP Export with PDF + JSON
**What:** Extends existing `exportWcpd()` (irf.service.ts:105-151) with PDF generation (pdfkit with AES password protection) and structured JSON export bundle. Both formats include legal_basis_code and audit log entry.

**When to use:** For all IRF exports to WCPD/PNP (IRF-03, D-14, D-15, D-16).

```typescript
// NEW: irf-export.service.ts
@Injectable()
export class IrfExportService {
  constructor(
    @InjectRepository(IrfCase) private irfRepo: Repository<IrfCase>,
    private irfService: IrfService,
  ) {}

  async exportPdf(id: string, legalBasis: string, password: string): Promise<Buffer> {
    const irfData = await this.irfService.exportWcpd(id, legalBasis);
    const doc = new PDFDocument({
      userPassword: password,
      ownerPassword: process.env.PDF_OWNER_PW || 'changeme',
      permissions: { printing: 'lowResolution', modifying: false }
    });
    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    // ... build PDF content from irfData ...
    doc.end();
    return Buffer.concat(buffers);
  }

  async exportJson(id: string, legalBasis: string): Promise<object> {
    const data = await this.irfService.exportWcpd(id, legalBasis);
    // Apply additional encryption for JSON bundle
    return {
      format: 'WCPD-EXPORT-v1',
      encrypted: true,
      ...data,
    };
  }
}

// Audit log entry
async logExport(irfId: string, userId: string, legalBasis: string, format: string) {
  await this.auditRepo.save({
    action: 'IRF_EXPORT',
    irfId,
    userId,
    legalBasis,
    format,
    exportedAt: new Date(),
  });
}
```
**Source:** Existing exportWcpd() at irf.service.ts:105-151 [VERIFIED: codebase scan]; pdfkit already in dependencies [VERIFIED: STACK.md]; D-14, D-15, D-16 [VERIFIED: CONTEXT.md]

### Anti-Patterns to Avoid
- **Flat text[] for approval_workflow:** Current entity uses `text[]` which can't store step names, roles, or SLA per step. Must use JSONB for structured workflow config.
- **Single env-var encryption key for all IRFs:** Current implementation uses one `IRF_ENCRYPTION_KEY`. D-09 requires per-record keys. Don't extend the single-key approach — build the per-record key infrastructure.
- **RSA key management in application code:** Key generation, storage, and rotation are crypto-operations. Use Node.js `crypto.generateKeyPair()` server-side for RSA key pairs. Store private keys encrypted at rest with user's password-derived key.
- **Generic `updateStatus()` for disposition:** Same anti-pattern as Phase 3. Create dedicated per-transition endpoints.
- **Storing decrypted narration in session:** Never cache plaintext narration server-side. Decrypt on-demand, return to authorized client, discard server-side immediately.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AES-256 encryption | Custom Node.js crypto implementation | pgcrypto `encrypt()`/`decrypt()` | D-10 mandates pgcrypto; extension already installed; DB-level encryption ensures consistency across access paths |
| RSA key pair generation | Manual key generation | Node.js `crypto.generateKeyPair()` built-in | Standard library, audited, FIPS-compliant; no external dependency needed |
| Cron scheduling | Custom setInterval with DB polling | @nestjs/schedule @Cron decorator | Same pattern as Phase 3; registered in ScheduleModule |
| Password-protected PDF | Custom PDF encryption | pdfkit built-in `userPassword` option | Already in dependencies; pdfkit supports AES-128 (not AES-256) for PDF passwords |
| JSON Schema form rendering | Custom dynamic form builder | Existing JsonSchemaForm.tsx | Already built, tested, supports all required field types |
| Session management for two-step unlock | Custom session state tracking | Application-level authorization + audit pattern | Server validates legal_basis_code, logs audit, returns data; no session state needed |
| Role-based authorization | Custom role-checking in services | @Roles() decorator + RolesGuard | Already the project pattern; consistent, declarative |
| Offline sync for IRF/programs | Custom sync protocol | Existing sync infrastructure (offline-queue.ts + sync.ts) | Already handles client-side queuing + delta sync |

**Key insight:** Phase 5 requires no new npm packages for core functionality. All cryptographic primitives are provided by pgcrypto (AES-256), Node.js built-in crypto (RSA key pairs), and pdfkit (PDF with password). The only new dependency (@nestjs/schedule) should already be installed from Phase 3.

## Common Pitfalls

### Pitfall 1: pgcrypto `encrypt()`/`decrypt()` Format Mismatch
**What goes wrong:** pgcrypto's `encrypt()` returns `bytea` with a specific padding format. When storing in the existing `encryptedNarration BYTEA` column, the IV+data concatenation pattern (used by current Node.js crypto code) doesn't match pgcrypto's expected format.
**Why it happens:** Node.js `crypto.createCipheriv('aes-256-cbc', key, iv)` concatenates IV as first 16 bytes + encrypted data. pgcrypto's `encrypt()` with `'aes-256-cbc/pad:pkcs'` stores the IV separately (or uses a zero IV if not specified).
**How to avoid:** Ensure consistent IV handling. pgcrypto's `encrypt(narration, key, 'aes-256-cbc/pad:pkcs')` automatically handles padding and IV. For Node.js ↔ pgcrypto interoperability, use the same key+IV on both sides. Prefer doing ALL crypto operations through pgcrypto on the server (not mixing Node.js crypto and pgcrypto).
**Warning signs:** Decryption produces garbage text or `"Bad decrypt"` errors.

### Pitfall 2: RSA Key Wrapping Complexity for MVP
**What goes wrong:** The full per-record key scheme (D-09) requires RSA key pair generation for each authorized user, secure private key storage, key wrapping/unwrapping, and re-encryption on role changes — a significant amount of crypto infrastructure for a single phase.
**Why it happens:** True end-to-end encryption with per-user key distribution is architecturally complex. Re-encrypting all IRF records when a user's role changes (D-09) requires either (a) re-encrypting all per-record keys with the new user's public key, or (b) maintaining a master wrapping key.
**How to avoid:** For MVP, implement a simplified two-tier scheme:
  1. Server maintains a master wrapping key (stored in env var, rotated via key version)
  2. Each IRF gets a random per-record AES key generated via pgcrypto `gen_random_bytes(32)`
  3. The per-record key is encrypted with the master wrapping key (not per-user RSA keys)
  4. Access control is enforced at the application layer (existing RolesGuard + AbacGuard)
  5. Upgrade to full per-user RSA wrapping in a later phase
**Warning signs:** User management becomes coupled to encryption key management; re-encryption operations fail during role changes.

### Pitfall 3: PostgreSQL VIEW Performance with pgcrypto Decryption
**What goes wrong:** The unmasked VIEW calls pgcrypto `decrypt()` on every row, making queries slow for large IRF case lists.
**Why it happens:** `decrypt()` is a CPU-bound operation. Applying it to all rows in a SELECT (even when the user only needs a subset) wastes resources.
**How to avoid:** Keep the masked VIEW as the default (no decryption cost). Only return individual decrypted records on demand (the existing `findById` + `getDecryptedNarr` pattern). Don't create a list-view with decryption.
**Warning signs:** IRF list queries take >500ms for more than 50 records.

### Pitfall 4: PDF AES Password vs. AES-256 Key Confusion
**What goes wrong:** pdfkit's `userPassword` option uses AES-128 for PDF encryption (ISO 32000 standard), not AES-256. The IRF encryption uses AES-256-CBC via pgcrypto. Confusing these two encryption mechanisms could lead to incorrect threat model documentation.
**Why it happens:** "AES password protection" for PDFs is a different algorithm (AES-128 in PDF 2.0) than the IRF narration encryption (AES-256-CBC). Both are valid but serve different purposes.
**How to avoid:** Document clearly: IRF narration → AES-256-CBC via pgcrypto (content encryption). PDF export → AES-128 via pdfkit (transport encryption). The PDF password is chosen by the exporting user, separate from IRF encryption keys.
**Warning signs:** Security audit flags "AES-128 is weaker than AES-256" — this is expected for PDF password protection.

### Pitfall 5: Approval Workflow Migration from text[] to JSONB
**What goes wrong:** Existing programs may have `approvalWorkflow` stored as `text[]` (e.g., `{"social_worker", "admin"}`). The schema change to JSONB will cause data type conflicts.
**Why it happens:** TypeORM's `column: 'text', array: true` maps to PostgreSQL `TEXT[]`. Changing to `type: 'jsonb'` requires a data migration.
**How to avoid:** Create a migration that:
  1. Adds a new column `approval_workflow_new JSONB`
  2. Converts existing text[] data to JSONB format:
     ```sql
     UPDATE programs SET approval_workflow_new = (
       SELECT jsonb_agg(
         jsonb_build_object(
           'stepName', 'Step ' || ordinality,
           'approverRole', step,
           'slaDays', 3,
           'order', ordinality
         )
       ) FROM unnest(approval_workflow) WITH ORDINALITY AS step
     );
     ```
  3. Drops old column, renames new column
**Warning signs:** TypeORM sync or migration fails with "column is of type jsonb but expression is of type text[]".

### Pitfall 6: Legal Basis Audit Duplicate Logging
**What goes wrong:** Both the IRF service and the export service independently log legal basis access, resulting in duplicate audit entries.
**Why it happens:** The `getDecryptedNarr()` method already logs access (irf.service.ts line 90). If the export method also logs (line 125), a single export operation creates two audit entries for the same legal basis.
**How to avoid:** Centralize audit logging in a dedicated `IrfAuditService`. Each operation (decrypt, export PDF, export JSON) calls the audit service exactly once. The existing `this.logger.log()` calls serve as operational logs, not audit records.
**Warning signs:** Audit log review shows duplicate entries with identical timestamps.

## Code Examples

### Verified patterns from existing codebase:

### 1. Current IRF encryption pattern (for reference — will be replaced)
```typescript
// Source: kapwa-server/src/irf/irf.service.ts (exists — current approach)
private encryptNarration(narration: string): Buffer {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex').subarray(0, 32), iv);
  const encrypted = Buffer.concat([cipher.update(narration, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}
```
[VERIFIED: codebase scan — irf.service.ts lines 27-32]

### 2. Current IRF decryption with legal basis check
```typescript
// Source: kapwa-server/src/irf/irf.service.ts (exists)
async getDecryptedNarr(id: string, legalBasis?: string) {
  if (!legalBasis) throw new ForbiddenException('Legal basis code is required');
  const irf = await this.irfRepo.findOne({ where: { id } });
  if (!irf) throw new NotFoundException('IRF case not found');
  if (!irf.encryptedNarration) return { narration: null };
  
  this.logger.log(`IRF ACCESS: id=${id}, legalBasis=${legalBasis}`);
  
  const key = Buffer.from(ENCRYPTION_KEY, 'hex').subarray(0, 32);
  const iv = irf.encryptedNarration.subarray(0, 16);
  const encrypted = irf.encryptedNarration.subarray(16);
  try {
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return { narration: decrypted.toString('utf8'), legalBasis, accessedAt: new Date() };
  } catch (e) {
    this.logger.error('IRF decryption failed:', e);
    throw new ForbiddenException('Decryption failed — key may have rotated');
  }
}
```
[VERIFIED: codebase scan — irf.service.ts lines 84-103]

### 3. Current WCPD export
```typescript
// Source: kapwa-server/src/irf/irf.service.ts (exists)
async exportWcpd(id: string, legalBasis: string) {
  // ... validation and decryption ...
  return {
    exportMetadata: { generatedAt: new Date(), legalBasis, format: 'WCPD-EXPORT-v1', agency: 'MSWDO Norzagaray' },
    case: { blotterEntryNumber, caseCategory, datetimeReported, datetimeIncident, caseDisposition },
    parties: { reportingPerson: itemAReportingPerson, personReported: itemBPersonReported },
    narration,
    signatures: { msdwSignatureUrl, reportingSignatureUrl },
  };
}
```
[VERIFIED: codebase scan — irf.service.ts lines 105-151]

### 4. Current FSM transition pattern (CasesService — reference for IRF disposition)
```typescript
// Source: kapwa-server/src/cases/cases.service.ts (exists — reference pattern)
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
  // ... transition logic ...
  await this.logHistory(id, oldStatus, newStatus, userRole);
}
```
[VERIFIED: codebase scan — cases.service.ts lines 146-192]

### 5. Current JsonSchemaForm rendering (reference for program form templates)
```typescript
// Source: kapwa-client/src/components/forms/JsonSchemaForm.tsx (exists)
// Schema format stored in Program.formTemplate:
interface JsonSchema {
  title?: string;
  description?: string;
  type: string;
  properties?: Record<string, FieldSchema>;
  required?: string[];
  layout?: FormLayout;
}
interface FieldSchema {
  type: string;          // string, number, integer, boolean, enum, object
  title?: string;
  description?: string;
  enum?: string[];
  enumNames?: string[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  format?: string;       // date, textarea, email, tel
  items?: FieldSchema;
  properties?: Record<string, FieldSchema>;
  required?: string[];
}
```
[VERIFIED: codebase scan — JsonSchemaForm.tsx full file]

### 6. pgcrypto SQL pattern for per-record encryption
```sql
-- Generate per-record AES-256 key (32 bytes = 256 bits)
SELECT encode(gen_random_bytes(32), 'hex') AS record_key;

-- Encrypt narration with per-record key
-- iv parameter can use gen_random_bytes(16) or be derived
UPDATE irf_cases
SET encrypted_narration = encrypt(
  convert_to($narration_text, 'UTF8'),
  decode($record_key_hex, 'hex'),
  'aes-256-cbc/pad:pkcs'
)
WHERE id = $irf_id;

-- Decrypt narration
SELECT convert_from(
  decrypt(encrypted_narration, decode($record_key_hex, 'hex'), 'aes-256-cbc/pad:pkcs'),
  'UTF8'
) AS decrypted_narration
FROM irf_cases
WHERE id = $irf_id;
```
**Source:** pgcrypto official documentation [CITED: postgresql.org/docs/current/pgcrypto.html]. Note: pgcrypto's `encrypt()` stores the IV inline in the output — the stored BYTEA includes IV prepended to ciphertext, same as the current Node.js pattern.

### 7. NotificationsService pattern (for SLA escalation)
```typescript
// Source: kapwa-server/src/cases/cases.service.ts (exists)
@Injectable()
export class CasesService {
  constructor(
    /* ... */
    private notifService: NotificationsService,
  ) {}

  async updateStatus(id: string, newStatus: CaseStatus, userRole?: string) {
    // ... transition ...
    if (c.assignedWorkerId) {
      await this.notifService.notifyCaseUpdate(c.assignedWorkerId, c.controlNo, newStatus);
    }
  }
}
```
[VERIFIED: codebase scan — cases.service.ts lines 178-180]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single env-var IRF encryption key | Per-record AES-256 keys with key wrapping | Phase 5 | Stronger security; authorized user isolation; re-encryption on role change |
| Flat text[] approval_workflow | Structured JSONB approval steps with names, roles, SLA | Phase 5 | Configurable multi-step approval per program |
| No program assignment tracking | ProgramAssignment entity with step-level approval | Phase 5 | Full audit trail per program enrollment |
| Manual IRF disposition (3 states) | FSM with 4 states and strict transitions | Phase 5 | Matches actual WCPD workflow |
| Application-layer name masking only | Application + optional PostgreSQL VIEWs | Phase 5 | Defense-in-depth masking |
| JSON-only WCPD export | PDF (password-protected) + JSON (encrypted bundle) | Phase 5 | Human-readable + machine-readable formats |

**Deprecated/outdated:**
- Single env-var `IRF_ENCRYPTION_KEY`: still needed as master wrapping key for MVP simplified scheme, but per-record keys become primary encryption mechanism.
- 3-state IRF disposition model: replaced by 4-state FSM with Referred to PNP / Referred to WCPD / Dismissed distinction.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | pgcrypto encrypt/decrypt with 'aes-256-cbc/pad:pkcs' produces output compatible with the existing encryptedNarration BYTEA column | IRF Encryption | MEDIUM — if pgcrypto format differs from Node.js crypto, migration of existing encrypted records will fail |
| A2 | Program approval workflow JSONB schema can be stored in the existing approval_workflow column (changing type from text[] to jsonb) | Dynamic Programs | LOW — standard PostgreSQL type change with migration |
| A3 | pdfkit supports AES password-protected PDF without additional native dependencies | WCPD Export | MEDIUM — pdfkit's PDF/AES support may require `pdfkit@0.15+` which is already 0.19; AES-128 not AES-256 |
| A4 | Web Crypto API `SubtleCrypto.generateKey()` is available in all target browsers (PWA + Capacitor WebView) | Client Encryption | MEDIUM — Capacitor Android WebView (Chrome-based) supports it; iOS WKWebView also supports it; fallback to server-side generation |
| A5 | The existing guard pipeline (JwtAuthGuard → RolesGuard → AbacGuard) applies to new ProgramsModule and IrfModule endpoints without modification | Architecture | LOW — already registered globally in AppModule |
| A6 | FormVersionHistory entity (existing) can track program template changes without modification | Programs | LOW — entity exists and is already used by ProgramsService.update() |
| A7 | @nestjs/schedule is already installed from Phase 3 | SLA | LOW — verify in package.json before Phase 5 execution |

**All remaining claims are [VERIFIED] via codebase scan (files read directly from disk) or [VERIFIED: CONTEXT.md].**

## Open Questions (RESOLVED)

1. **Per-record key vs. simplified key wrapping for MVP** (RESOLVED: Simplified two-tier master wrapping key adopted for MVP per D-09 update)
   - What we know: D-09 requires per-IRF AES keys wrapped with authorized users' RSA public keys. This is architecturally complex.
   - What's unclear: Should Phase 5 implement the full per-user RSA key management, or use a simplified two-tier scheme (master wrapping key + per-record keys) as an MVP stepping stone?
   - Recommendation: Implement the simplified two-tier scheme for MVP. Use a single master wrapping key (stored in env var) to encrypt per-record AES keys. Access control via existing RolesGuard + AbacGuard. Upgrade to per-user RSA key wrapping in a later phase. Flag for discuss-phase.

2. **PostgreSQL VIEW-based name masking feasibility** (RESOLVED: Application-layer masking adopted for MVP per D-11 update)
   - What we know: D-11 requires DB-level masking via PostgreSQL views with pgcrypto. The existing application-layer approach already masks names.
   - What's unclear: VIEWs with conditional decryption require session-level parameters (`current_setting`) to be reliably set. The existing RLS infrastructure already sets `app.current_role` and `app.current_barangay` via middleware.
   - Recommendation: Start with application-layer masking (already done in IrfService). Add VIEWs only if time permits. The application approach is simpler, more testable, and already meets D-11 requirements.

3. **RSA key pair generation and storage strategy** (RESOLVED: Deferred — master wrapping key used for MVP per D-09 update; per-user RSA deferred to later phase)
   - What we know: D-09 says "encrypted with authorized users' public keys." Users need RSA key pairs.
   - What's unclear: Should private keys be stored server-side (encrypted at rest with user's password hash) or kept exclusively client-side (true end-to-end)?
   - Recommendation: Server-side storage for MVP (fewer UX hurdles). Generate on user creation, store encrypted in `users` table. True end-to-end can be added later. Flag for discuss-phase.

4. **PDF export template design** (RESOLVED: Structured PDF with IRF header, parties, narration, signatures — per planner discretion)
   - What we know: D-14 requires both PDF (AES password-protected via existing pdfkit) and JSON export. pdfkit is already in dependencies.
   - What's unclear: What should the PDF template look like? Is there an existing MSWDO form template that must be matched?
   - Recommendation: Generate a structured PDF with IRF header fields (blotter number, category, dates), parties section, narration text, and signature images. Flag for discuss-phase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7 (server) |
| Config file | kapwa-server/jest.config.ts |
| Quick run command | `cd kapwa-server && npx jest --no-coverage --force-exit programs irf program-assignments` |
| Full suite command | `cd kapwa-server && npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRG-01 | Admin creates program with all fields (name, category, waiting period, docs, fund sources) | unit | New test in programs.service.spec.ts | ❌ Wave 0 |
| PRG-02 | Program formTemplate stored as JSONB, rendered by JsonSchemaForm | unit+integration | New test in programs.service.spec.ts | ❌ Wave 0 |
| PRG-03 | Approval workflow created as structured JSONB with step names, roles, SLA | unit | New test in programs.service.spec.ts | ❌ Wave 0 |
| PRG-03 | ProgramAssignment step approvals flow sequentially | unit | New test in program-assignments.service.spec.ts | ❌ Wave 0 |
| PRG-03 | Rejection ends workflow with 'Rejected' status | unit | New test in program-assignments.service.spec.ts | ❌ Wave 0 |
| PRG-03 | Fully approved program materializes as Intervention | unit | New test in program-assignments.service.spec.ts | ❌ Wave 0 |
| IRF-01 | IRF submission creates record with blotter number | unit | New test in irf.service.spec.ts | ❌ Wave 0 |
| IRF-02 | Narration encrypted with per-record AES key via pgcrypto | unit+integration | New test in irf.service.spec.ts | ❌ Wave 0 |
| IRF-02 | Default query returns masked names | unit | New test in irf.service.spec.ts | ❌ Wave 0 |
| IRF-03 | WCPD export with legal_basis_code creates audit entry | unit | New test in irf-export.service.spec.ts | ❌ Wave 0 |
| IRF-03 | PDF export is AES password-protected | unit | New test in irf-export.service.spec.ts | ❌ Wave 0 |
| IRF-04 | Disposition follows strict FSM: Under Investigation → Referred → Closed | unit | New test in irf.service.spec.ts | ❌ Wave 0 |
| IRF-04 | Admin override allowed with reason | unit | New test in irf.service.spec.ts | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx jest --no-coverage --force-exit programs irf program-assignments`
- **Per wave merge:** Full suite green
- **Phase gate:** Full suite green before /gsd-verify-work

### Wave 0 Gaps
- [ ] `programs.service.spec.ts` — tests for enhanced create/update with JSONB approval_workflow
- [ ] `program-assignments.service.spec.ts` — tests for step approval flow, rejection, materialization
- [ ] `irf.service.spec.ts` — tests for pgcrypto encryption/decryption, 4-state FSM, name masking
- [ ] `irf-export.service.spec.ts` — tests for PDF and JSON export formats, legal basis audit
- [ ] `irf-audit.service.spec.ts` — tests for legal basis audit logging

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing JwtAuthGuard (passport-jwt) — no change needed |
| V3 Session Management | yes | Existing JWT with 1h expiry — no change needed |
| V4 Access Control | yes | Program CRUD requires admin role; IRF submission requires social_worker/admin; ABAC evaluates resource_sensitivity on IRF data |
| V5 Input Validation | yes | ZodPipe on all new endpoints — same pattern as existing code |
| V6 Cryptography | yes | pgcrypto AES-256 for narration; Node.js crypto.generateKeyPair for RSA; pgcrypto gen_random_bytes for per-record keys |
| V8 Data Protection | yes | Name masking by default; legal basis unlock with audit; per-record key isolation |
| V9 Communication | yes | HTTPS enforced; client-side encryption before HTTPS (D-08) |

### Known Threat Patterns for Phase 5 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IRF narration accessed without authorization | Information Disclosure | Per-record keys prevent decryption without authorized user's key; legal_basis_code + audit log provides non-repudiation |
| Unauthorized FSM transition (IRF disposition) | Tampering | @Roles() decorator restricts disposition transitions to admin; strict FSM transition map prevents invalid transitions |
| Program approval step bypass | Tampering | Step order enforced: must approve step N before step N+1; rejection sets status to 'rejected' not 'approved' |
| Encryption key leak from logs | Information Disclosure | Never log key material; log only operation IDs and legal basis codes |
| PDF export intercepted | Information Disclosure | AES password protection on PDF; password delivered out-of-band per D-14 |
| RSA private key exfiltration | Information Disclosure | Private keys stored encrypted at rest with user password-derived key; never transmitted over network |

### IRF-Specific Security Analysis
The IRF module handles legally sensitive victim/witness data (abuse cases, criminal incidents). Key security properties:
- **Confidentiality:** AES-256 encryption of narration (pgcrypto), per-record key isolation, authorized user only
- **Integrity:** FSM transitions audited; encrypted narration tampering detectable via decryption failure
- **Availability:** All access logged; legal basis audit provides non-repudiation
- **Accountability:** D-16 requires legal_basis_code + audit log for every decryption/export operation

## Key Files (Existing — Read Before Planning)

### Server-side (read)
| File | Purpose | Phase 5 Action |
|------|---------|---------------|
| kapwa-server/src/programs/program.entity.ts | Program entity (name, category, approvalWorkflow text[]) | EXTEND: change approvalWorkflow to JSONB, add legal_basis |
| kapwa-server/src/programs/programs.service.ts | Program CRUD (create, findAll, findById, update) | EXTEND: handle JSONB approvalWorkflow, add formTemplate versioning |
| kapwa-server/src/programs/programs.controller.ts | Program REST endpoints (GET, POST, PATCH) | EXTEND: may need additional endpoints |
| kapwa-server/src/programs/dto/programs.zod.ts | Zod schemas for program create/update | EXTEND: approve_workflow structured schema |
| kapwa-server/src/programs/form-version-history.entity.ts | Form template version tracking | READ-ONLY — already wired in ProgramsService.update() |
| kapwa-server/src/programs/programs.module.ts | Module registration | EXTEND: import ProgramAssignmentsModule, export ProgramsService |
| kapwa-server/src/irf/irf.service.ts | IRF CRUD, encryption, export, FSM | EXTEND: pgcrypto encrypt/decrypt, 4-state FSM, key management |
| kapwa-server/src/irf/irf.controller.ts | IRF REST endpoints | EXTEND: disposition transition endpoints, decrypt, export PDF |
| kapwa-server/src/irf/irf-case.entity.ts | IrfCase entity (blotter, category, encryptedNarration BYTEA, disposition) | EXTEND: add keyWraps JSONB, key_version |
| kapwa-server/src/irf/dto/irf.zod.ts | Zod schemas | EXTEND: 4-state disposition, legal basis code |
| kapwa-server/src/irf/irf.module.ts | Module registration | EXTEND: register IrfExportService, IrfAuditService, IrfKeyService |
| kapwa-server/src/cases/cases.service.ts | FSM pattern reference (strict transitions, role gates, admin override) | READ-ONLY — reference for IRF disposition FSM |
| kapwa-server/src/interventions/interventions.service.ts | Intervention creation (for program→intervention materialization) | READ-ONLY — call from ProgramAssignmentsService |
| kapwa-server/src/sla/sla.service.ts | SLA escalation pattern | EXTEND: add program assignment SLA check (or create ProgramSlaService) |
| kapwa-server/src/notifications/notifications.service.ts | Notification creation (for SLA escalation) | READ-ONLY — reuse for program step escalation |
| kapwa-server/src/database/migrate.ts | Schema bootstrap reference | READ-ONLY — verify irf_cases, programs table definitions |

### Client-side (read)
| File | Purpose | Phase 5 Action |
|------|---------|---------------|
| kapwa-client/src/components/forms/JsonSchemaForm.tsx | Dynamic JSON Schema form renderer | REUSE for program form template rendering |
| kapwa-client/src/lib/api.ts | HTTP client | EXTEND: program endpoints, IRF endpoints, export endpoints |
| kapwa-client/src/lib/offline-queue.ts | Offline change queue | READ-ONLY — IRF submission may need offline support |
| kapwa-client/src/routes.tsx | Route definitions | EXTEND: program management page, IRF pages |

## Sources

### Primary (HIGH confidence — [VERIFIED] via direct filesystem read)
- kapwa-server/src/programs/program.entity.ts — Program entity fields [VERIFIED]
- kapwa-server/src/programs/programs.service.ts — Program CRUD [VERIFIED]
- kapwa-server/src/programs/programs.controller.ts — Program endpoints [VERIFIED]
- kapwa-server/src/programs/dto/programs.zod.ts — Zod schemas [VERIFIED]
- kapwa-server/src/programs/form-version-history.entity.ts — Version tracking [VERIFIED]
- kapwa-server/src/programs/programs.module.ts — Module registration [VERIFIED]
- kapwa-server/src/irf/irf.service.ts — CRUD, encryption, export, FSM [VERIFIED]
- kapwa-server/src/irf/irf.controller.ts — REST endpoints [VERIFIED]
- kapwa-server/src/irf/irf-case.entity.ts — Entity definition [VERIFIED]
- kapwa-server/src/irf/dto/irf.zod.ts — Zod schemas [VERIFIED]
- kapwa-server/src/irf/irf.module.ts — Module registration [VERIFIED]
- kapwa-server/src/cases/cases.service.ts — FSM pattern reference [VERIFIED]
- kapwa-server/src/interventions/interventions.service.ts — Intervention creation [VERIFIED]
- kapwa-server/src/interventions/intervention.entity.ts — Intervention enums [VERIFIED]
- kapwa-server/src/sla/sla.service.ts — SLA escalation pattern [VERIFIED]
- kapwa-server/src/sla/constants.ts — SLA thresholds [VERIFIED]
- kapwa-server/src/app.module.ts — Module registration (ProgramsModule, IrfModule confirmed imported) [VERIFIED]
- kapwa-client/src/components/forms/JsonSchemaForm.tsx — Dynamic form renderer [VERIFIED]
- kapwa-server/src/database/migrate.ts — Schema bootstrap [VERIFIED]
- CONTEXT.md — All 18 decisions [VERIFIED]

### Secondary (MEDIUM confidence — documentation referenced)
- pgcrypto documentation — encrypt/decrypt, gen_random_bytes, key types [CITED: postgresql.org/docs/current/pgcrypto.html]
- pdfkit documentation — userPassword, ownerPassword, permissions [CITED: pdfkit.org/docs/security.html]
- NestJS task scheduling — @nestjs/schedule @Cron decorator [CITED: docs.nestjs.com/techniques/task-scheduling]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in codebase or PostgreSQL extensions; pgcrypto already installed
- Architecture: HIGH — patterns derived from existing codebase verified via filesystem read
- Pitfalls: HIGH — based on codebase analysis (CONCERNS.md, existing RLS patterns, crypto implementation)
- IRF encryption approach: MEDIUM — per-record key with pgcrypto vs. Node.js crypto; implementation details depend on D-08/D-09 interpretation

**Research date:** 2026-06-22
**Valid until:** 2026-07-22 (stable)
