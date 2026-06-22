# Phase 5: Dynamic Programs & IRF Module - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can configure dynamic intervention programs (name, legal basis, required documents, waiting period, fund source) with configurable multi-step approval workflows per program. Social workers can assign programs to beneficiaries as part of case intake — the assignment creates an intervention record that follows the program's configured approval workflow. IRF (Incident Report Form) module enables staff to submit encrypted incident reports with victim narration AES-256 end-to-end encryption, name masking with two-step legal-basis unlock, secure WCPD/PNP export (PDF + JSON), and case disposition tracking through an FSM: Under Investigation → (Referred to PNP | Referred to WCPD | Dismissed) → Closed.

Requirements: PRG-01, PRG-02, PRG-03, IRF-01, IRF-02, IRF-03, IRF-04
</domain>

<decisions>
## Implementation Decisions

### Program Configuration (Dynamic Programs)
- **D-01:** Program = configurable intervention template. Admin defines: name, legal underpinning (law/regulation), required documents checklist, waiting period, fund source. Custom intake questionnaires are NOT needed — the program's intake is the document checklist + metadata.
- **D-02:** Required documents are hybrid — worker marks documents received in-person (checklist), can optionally upload digital copies to MinIO.
- **D-03:** Program assignment is part of case intake. When the social worker creates/edits a case, they can assign the beneficiary to one or more programs. Each assignment creates an intervention record.
- **D-04:** Approval workflow is multi-step, fully configurable per program. Admin defines step names AND which role approves each step (e.g., "Intake Review" by social_worker, "Supervisor Approval" by admin).
- **D-05:** Rejection is allowed at any step. Rejection ends the workflow with "Rejected" status. Worker can resubmit after addressing issues.
- **D-06:** SLA timers with escalation — each step has a configurable SLA (default: 3 working days per ARTA RA 11032). Exceeded SLA escalates to next step or notifies supervisor. Same pattern as Phase 3 Cases FSM SLA.
- **D-07:** Once fully approved, the program assignment is logged as an intervention in the existing intervention system.

### IRF — Victim Narration Encryption
- **D-08:** Full end-to-end encryption. Client encrypts victim narration before sending over HTTPS. Server stores encrypted blob. Only authorized users with decryption access can read plaintext.
- **D-09:** Per-IRF record key — each IRF gets a unique AES-256 key. The key is encrypted with authorized users' public keys and stored alongside the record. Re-encrypt on role/consent changes.
- **D-10:** pgcrypto extension is already available in the PostgreSQL stack — use it for server-side key wrapping and decryption operations.

### IRF — Name Masking
- **D-11:** DB-level masking via PostgreSQL views with pgcrypto. Default views return masked names (e.g., initials only). Queries with explicit legal_basis_code + audit context access unmasked views.
- **D-12:** Two-step unlock for unmasked names — user enters legal basis code → server validates and logs audit entry → session-level access to unmasked names for the duration of that IRF case review. Masks again when navigating away.
- **D-13:** Any authenticated user with a valid legal basis code can unlock. Audit log tracks who accessed what and why.

### IRF — WCPD/PNP Export
- **D-14:** Both PDF (human-readable, AES password-protected via existing pdfkit) and JSON (machine-readable encrypted bundle with defined schema) export formats. The existing exportWcpd() method in IrfService serves as base — needs controller route and schema definition.
- **D-15:** Export authorized for any authenticated user with a valid legal basis code + reason. Full audit trail logged (who exported what, when, why).
- **D-16:** Legal basis code entered at export time, validated, logged to audit ledger.

### IRF — Disposition Tracking
- **D-17:** Standalone FSM with optional case link. IRF has its own disposition lifecycle: Under Investigation → (Referred to PNP | Referred to WCPD | Dismissed) → Closed. Can optionally link to a case record — if linked, certain state changes may cascade.
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Project Context
- `.planning/REQUIREMENTS.md` — PRG-01 through PRG-03, IRF-01 through IRF-04
- `.planning/PROJECT.md` — Project context, constraints, key decisions
- `.planning/ROADMAP.md` — Phase 5 goal, success criteria, dependencies
- `.planning/STATE.md` — Accumulated decisions from Phases 1-4 execution

### Architecture & Codebase
- `.planning/codebase/ARCHITECTURE.md` — NestJS module pattern, guard pipeline, offline sync, RLS
- `.planning/codebase/STACK.md` — Technology stack (pgcrypto, pdfkit, NestJS, React, MinIO)
- `.planning/codebase/CONVENTIONS.md` — Naming, module structure, code patterns
- `.planning/codebase/CONCERNS.md` — WCPD/PNP export concern, FormVersionHistory concern

### Prior Phase Context
- `.planning/phases/03-intervention-tracking-case-management/03-CONTEXT.md` — FSM patterns, SLA approach, SignaturePad, MinIO integration patterns

### Existing Code
- `kapwa-server/src/programs/programs.service.ts` — Existing scaffolded program service
- `kapwa-server/src/programs/programs.controller.ts` — Existing scaffolded program controller
- `kapwa-server/src/programs/program.entity.ts` — Program entity definition
- `kapwa-server/src/programs/dto/programs.zod.ts` — Program Zod validation schemas
- `kapwa-server/src/programs/form-version-history.entity.ts` — Form version history entity (no service logic yet)
- `kapwa-server/src/irf/irf.service.ts` — IRF service with exportWcpd() at lines 105-151 (no controller route)
- `kapwa-server/src/irf/irf.controller.ts` — IRF controller (scaffolded)
- `kapwa-server/src/irf/irf-case.entity.ts` — IRF case entity
- `kapwa-server/src/irf/dto/irf.zod.ts` — IRF Zod validation schemas
- `kapwa-client/src/components/forms/JsonSchemaForm.tsx` — Dynamic form renderer, potential reuse for program-specific forms
- `kapwa-server/src/cases/cases.service.ts` — FSM transition pattern for IRF disposition (reference implementation)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `JsonSchemaForm.tsx` — Dynamic JSON Schema form rendering, potential reuse for program-specific intake fields if needed
- `SignaturePad.tsx` — Canvas-based signature capture, usable in IRF submission
- `CasesService` FSM pattern — Strict sequential state machine, override-with-reason pattern, directly applicable to IRF disposition FSM
- ABAC guard pipeline — Apply to IRF access control (victim data sensitivity maps to ABAC sensitivity levels)
- pgcrypto — Already available in PostgreSQL stack for AES-256 encryption/decryption
- pdfkit — Already in dependencies for PDF export generation
- MinIO — Available for document uploads (program required docs, IRF attachments)
- offline-queue.ts + sync.ts — Offline IRF submission support

### Established Patterns
- Module pattern: Controller → Service → Entity → DTO → Zod schemas
- Guard pipeline: JwtAuthGuard → RolesGuard → AbacGuard with @Roles() decorator
- Zod validation at API boundary via ZodPipe
- Strict sequential FSM with admin override (from Phase 3 Cases)
- SLA flag with escalation (from Phase 3)

### Integration Points
- `Routes` — New program management routes (/programs/*) and IRF routes (/irf/*)
- `api.ts` — New API client functions for program CRUD, IRF submission, export
- `AppModule` — Register ProgramsModule and IrfModule (may already be registered)
- `CasesController/Service` — Program assignment as part of case intake
- `InterventionsService` — Approved program creates intervention record
- Cases FSM — Optional IRF-to-case linking

</code_context>

<specifics>
## Specific Ideas

- Programs are legislated government interventions (e.g., AICS, Medical Assistance, Burial) — the system must adapt to new ones without code changes
- Legal basis code + audit log is required for both name unmasking and WCPD/PNP export — consistent pattern
- WCPD/PNP export needs both human-readable PDF and machine-readable JSON for external system integration
- FormVersionHistory entity exists but has no service logic — could be used for tracking program template changes
- IRF follows existing RLS on irf_cases table

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 5-Dynamic Programs & IRF Module*
*Context gathered: 2026-06-22*
