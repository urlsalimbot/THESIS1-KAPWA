# Phase 5: Dynamic Programs & IRF Module - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-22
**Phase:** 5-dynamic-programs-irf-module
**Areas discussed:** Program Form Designer, IRF Name Masking, IRF Encryption, Program Approval Rejection Flow, IRF Export Format, IRF Disposition FSM

---

## Program Form Designer

| Option | Description | Selected |
|--------|-------------|----------|
| JSON text editor | Admin writes JSON Schema directly in a code editor | |
| Visual field builder | Drag-and-drop interface that generates the schema | |
| Pre-defined templates | Admin selects from predefined form types | |

**User's choice:** Clarified that "Dynamic Programs" means admin can create custom intervention programs to comply with new government legislation — NOT a generic form builder. Programs = name, legal basis, required documents, waiting period, fund source. No custom intake questionnaire needed — the document checklist is the intake mechanism.

**Follow-up:** When a new government program is legislated, what fields does an admin configure?
**User:** Name of the intervention, legal underpinning, documents from the claimant/beneficiaries required, waiting period and fund source.

**Follow-up:** How does a beneficiary apply?
**User:** Part of case intake — worker assigns program to beneficiary during case creation/editing.

**Follow-up:** Document type?
**User:** Hybrid — worker marks documents received (checklist), can optionally upload digital copies.

**Follow-up:** Approval workflow?
**User:** Multi-step per program, fully configurable. Manual config — admin defines step names AND which role approves each.

**Follow-up:** Post-approval action?
**User:** Program configured and made available for social workers to assign to claimants. Assignment is received as an intervention and logged as such.

---

## IRF Name Masking

| Option | Description | Selected |
|--------|-------------|----------|
| API-level sanitization | Server returns masked names, endpoint with legal_basis_code returns unmasked | |
| UI-level conditional render | Server sends full names, UI conditionally masks | |
| DB-level with pgcrypto views | PostgreSQL views return masked by default, explicit code + audit for unmasked | ✓ |

**User's choice:** DB-level masking via pgcrypto views.

**Follow-up:** Unmasking flow?
**User:** Two-step unlock — enter legal basis code → server validates and logs → session-level access for that IRF case review. Masks again when navigating away.

**Follow-up:** Unlock duration?
**User:** Per-case review. Unmasked while reviewing a specific IRF case. Masks when navigating away.

---

## IRF Encryption

| Option | Description | Selected |
|--------|-------------|----------|
| Encrypt on server | Client sends plain text over HTTPS, server encrypts via pgcrypto | |
| Encrypt on client | Client encrypts before sending, defense in depth | |
| Full end-to-end | Client encrypts with beneficiary key, server stores encrypted blob | ✓ |

**User's choice:** Full end-to-end encryption.

**Follow-up:** Key management?
**User:** Per-IRF record key — each IRF gets a unique AES-256 key. Key encrypted with authorized users' public keys, stored alongside record. Re-encrypt on role change.

---

## Program Approval Rejection Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Reject at any step | Any step can approve or reject. Rejection ends workflow | ✓ |
| Only approve or defer | No rejection — return with notes for revision | |
| Two-tier | Only final step can approve/reject | |

**User's choice:** Reject at any step. Rejection ends workflow with "Rejected" status. Worker can resubmit after addressing issues.

**Follow-up:** SLA timers?
**User:** SLA with escalation — same pattern as Phase 3 Cases FSM. Each step has configurable SLA, escalation on timeout.

---

## IRF Export Format

| Option | Description | Selected |
|--------|-------------|----------|
| Encrypted PDF | AES password-protected PDF, shareable securely | |
| Encrypted JSON bundle | JSON with encrypted payload for system import | |
| Both | PDF + JSON covering both use cases | ✓ |
| Printable report | Browser-printable from dedicated view | |

**User's choice:** Both formats — PDF (human-readable) and JSON (machine-readable for WCPD/PNP systems).

**Follow-up:** Export authorization?
**User:** Any authenticated user with legal basis code + reason. Full audit trail.

---

## IRF Disposition FSM

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone IRF FSM | Separate from Cases FSM | |
| Integrated with Cases | IRF disposition mirrors case states | |
| Standalone with optional link | Own FSM, optional case link | ✓ |

**User's choice:** Standalone FSM with optional case link. States: Under Investigation → (Referred to PNP | Referred to WCPD | Dismissed) → Closed. Strict sequential, no backward transitions (same pattern as Phase 3).

---

## the agent's Discretion

- Program form UI design (how admin configures steps, roles, documents)
- Document upload UX (MinIO integration details)
- Program assignment UI in case intake flow
- IRF submission form layout
- SLA timer implementation approach (DB cron vs app-level)
- Approved-program-to-intervention mapping
- PDF export template design
- Key management implementation details

## Deferred Ideas

None — discussion stayed within phase scope.
