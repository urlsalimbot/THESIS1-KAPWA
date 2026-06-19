# Phase 3: Intervention Tracking & Case Management - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-19
**Phase:** 3-intervention-tracking-case-management
**Areas discussed:** Approval Workflow & Separation, Case Tracker Log Format, Duplicate Detection, FSM Transition Strictness, Signature Collection Flow

---

## Approval Workflow & Separation

| Option | Description | Selected |
|--------|-------------|----------|
| Social Worker initiates + Admin does both | SW initiates, Admin handles approval AND disbursement | |
| Social Worker + Admin + Finance separation | Three distinct gates: SW→Admin→Finance | ✓ |
| Flexible: any admin/approver role | Whoever has 'approve' permission advances through any gate | |

**User's choice:** Social Worker + Admin + Finance separation
**Notes:** Three-gate separation of duties.

| Option | Description | Selected |
|--------|-------------|----------|
| Flag only, no auto-advance | Overdue badge, no automatic movement | ✓ |
| Auto-escalate to next approver | Automatic notify/advance when SLA exceeds | |

**User's choice:** Flag only, no auto-advance

| Option | Description | Selected |
|--------|-------------|----------|
| Tag only for reporting | Fund source recorded, no budget enforcement | ✓ |
| Budget deduction with balance check | Deducts from running budget, blocks insufficient balance | |

**User's choice:** Tag only for reporting

| Option | Description | Selected |
|--------|-------------|----------|
| All transitions work offline | Full FSM offline, conflict resolution on sync | |
| Initiating only offline, approval online | SW can initiate offline, approval/disbursement needs connection | ✓ |
| Initiating offline, approval online with queue | Approval offline but queued pending server processing | |

**User's choice:** Initiating only offline, approval online
**Notes:** Approval and disbursement transitions require server connection for JIT role + consent validation.

| Option | Description | Selected |
|--------|-------------|----------|
| 3 days each (ARTA standard) | 3 working days per gate | ✓ |
| Flexible per step | Different SLAs per gate | |

**User's choice:** 3 days each (ARTA standard)

| Option | Description | Selected |
|--------|-------------|----------|
| Just click approve | Simple button, CaseHistory captures who | |
| Require approval signature | Password/digital signature per transition | |
| Require reason note | Mandatory text field for each transition | ✓ (soft) |

**User's choice:** Subject to stakeholder discussion, reason temporarily optional

## Case Tracker Log Format

| Option | Description | Selected |
|--------|-------------|----------|
| NORZ-TRACK-YYYY-MMDD-NNN | Readable prefix + date + sequential | ✓ |
| Auto-increment per case | Sequence resets per case | |
| YYYYMMDD-NNN only | Minimal machine-friendly | |

**User's choice:** NORZ-TRACK-YYYY-MMDD-NNN

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side only | Server assigns sequence on sync | |
| Client pre-generates with sync | Client caches daily counter, server resolves conflicts | ✓ |

**User's choice:** Client pre-generates with sync

## Duplicate Detection

| Option | Description | Selected |
|--------|-------------|----------|
| Hard block with reason | 409 Conflict, worker must acknowledge | ✓ |
| Soft warning with override | Warns but allows override with justification | |

**User's choice:** Hard block with reason

| Option | Description | Selected |
|--------|-------------|----------|
| Both — DB index + service check | Exclusion constraint + service-level check | ✓ |
| Service-level only | Application logic alone | |

**User's choice:** Both — DB index + service check

## FSM Transition Strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Strictly sequential | No skipping, exact sequence required | |
| Sequential with admin override | Admin can skip for emergency, logged as override | ✓ |

**User's choice:** Sequential with admin override

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — mandatory reason + audit flag | Override requires reason, flagged in CaseHistory | ✓ |
| Same as standard transition | No special flagging | |

**User's choice:** Yes — mandatory reason + audit flag

| Option | Description | Selected |
|--------|-------------|----------|
| Allow backward transitions | Admin can send back for revisions | |
| No backward — new case needed | Close and create new case | ✓ |

**User's choice:** No backward — new case needed

## Signature Collection Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Canvas-based (SignaturePad.tsx) | Existing component, digital capture offline | |
| File upload (photo of signed form) | Photo of paper form | |
| Both — canvas preferred, upload fallback | Default canvas, fallback to upload | ✓ |

**User's choice:** Both — canvas preferred, upload fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Mandatory at creation | Blocks creation without signatures | |
| Mandatory but deferrable | Created with signatures_pending state | ✓ |

**User's choice:** Mandatory but deferrable

| Option | Description | Selected |
|--------|-------------|----------|
| Local filesystem (uploads/) | Existing kapwa-server/uploads/ | |
| MinIO/S3 (planned) | S3-compatible object storage | ✓ |

**User's choice:** MinIO/S3 (planned)
**Notes:** Requires implementing MinIO client as part of Phase 3.

## the agent's Discretion

- FSM transition UI design
- Case Tracker Log display format in BeneficiaryViewPage
- MinIO client implementation details
- SLA timer implementation approach

## Deferred Ideas

(No deferred ideas)
