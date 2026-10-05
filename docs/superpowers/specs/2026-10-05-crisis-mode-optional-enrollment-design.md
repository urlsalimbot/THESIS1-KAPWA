# Crisis Mode — Optional Program Enrollment

Date: 2026-10-05
Status: approved design (brainstormed section by section) — not yet implemented

## 1. Goal and scope

Make program enrollment **optional** in the case workflow by introducing a **crisis mode**: a worker-toggled case flag that reduces documentary requirements for ad-hoc services to intervention-anchored minimums, while keeping the review gate intact. This is the targeted fix for the friction identified in the program-optional redesign — walk-in crisis services no longer require a program enrollment or the "no program needed" checkbox to proceed.

**In scope:**
- `cases.crisis_mode` boolean (default `false`), toggled by the worker on the case
- New `intervention_required_documents` table (intervention_type → document_key, mandatory flag) — the documentary minimum for ad-hoc crisis services
- Requirements panel (`CaseRequirements`, rendered inside `StepImplementHIP`): in crisis mode, ad-hoc services (program_id NULL) use intervention-anchored documents; enrolled services still use program-anchored documents; the panel shows the union
- Stepper: crisis-mode banner + toggle; enrollments step unchanged (still requires enrollment or "no program needed")
- Gate: unchanged — `assessed → in_review` still requires all due steps sealed
- Migration: new table + new column; prod starts from scratch so no data migration

**Out of scope:**
- New FSM status (crisis mode is a flag, not a lifecycle state)
- Changes to the approval pipeline's step requirements
- AICS budget tracking (Phase D)
- Document templates (Phase B)
- Changes to the stepper template (steps stay the same)

## 2. Recorded decisions (from the brainstorm)

| Question | Decision |
|---|---|
| Crisis-mode requirements | **Intervention-anchored minimums** — each intervention type defines its own required documents |
| Crisis-mode trigger | **Manual toggle by the worker** on the case |
| Enrollments in gate | **Keep "no program needed" checkbox** — the gate is unchanged |
| Intervention documents | **New `intervention_required_documents` table** |
| Existing enrollments | **Prod starts from scratch** — no migration needed |
| UI architecture | **Maintain system theming and UI architecture** — all documentary requirements uploaded in `StepImplementHIP` (where `CaseRequirements` already renders) |

## 3. Data model

### 3.1 `cases.crisis_mode`

| Column | Type | Default | Notes |
|---|---|---|---|
| `crisis_mode` | boolean | `false` | Worker-toggled flag |

- Toggled via `PATCH /cases/:id/meta` (extends the existing meta endpoint that already handles `courtDocketNumber` and `assignedWorkerId`).
- When `true`, ad-hoc services (interventions with `program_id NULL`) use intervention-anchored documents.

### 3.2 `intervention_required_documents` (new table)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `intervention_type` | varchar(32) | e.g., `medical_assistance`, `burial_assistance` |
| `document_key` | varchar(64) | e.g., `medical_certificate`, `death_certificate` |
| `mandatory` | boolean | always `true` (all intervention documents are required) |
| `created_at` / `updated_at` | timestamp | |

Unique: `(intervention_type, document_key)`.

### 3.3 Seeded data

Based on AICS practice — each crisis service type carries its minimum documents:

| intervention_type | document_key |
|---|---|
| `medical_assistance` | `medical_certificate` |
| `medical_assistance` | `hospital_bill` |
| `burial_assistance` | `death_certificate` |
| `burial_assistance` | `burial_permit` |
| `educational_assistance` | `school_registration` |
| `educational_assistance` | `report_card` |
| `transportation_assistance` | `travel_request` |
| `shelter_assistance` | `shelter_request` |

Intervention types with no seeded rows (e.g., `crisis_counseling`, `food_pack`, `financial_grant`) have **no documentary minimum** — they can be logged with just the GIS.

### 3.4 Requirements resolution

- **Enrolled services** (interventions with `program_id`): use `programs.required_document_rows` (unchanged).
- **Ad-hoc services** (interventions with `program_id NULL`) **in crisis mode**: use `intervention_required_documents` for their `intervention_type`.
- The requirements panel shows the **union** of both sets, keyed by `document_key`.
- In non-crisis mode, ad-hoc services have no requirements (current behavior).

## 4. Stepper + requirements panel

### 4.1 Stepper

- A **crisis-mode banner** appears at the top of the case view when `crisis_mode = true`: "Crisis mode — ad-hoc services use intervention-anchored documents."
- A **toggle** in the case header (next to the assigned worker) lets the worker turn crisis mode on/off. Only `admin` and `social_worker` can toggle.
- The stepper template is **unchanged** — the enrollments step still exists and still requires enrollment or "no program needed."
- The gate is **unchanged** — `assessed → in_review` still requires all due steps sealed.

### 4.2 Requirements panel (`CaseRequirements` in `StepImplementHIP`)

- Currently: shows documents for programs behind the case's interventions.
- In crisis mode: also shows documents for intervention types behind **ad-hoc** interventions (program_id NULL).
- The panel shows the **union** of both sets, keyed by `document_key`. A document is satisfied when its `case_requirements` entry is `met`.
- The stepper's `requirementsMet` predicate (server + client) is updated to include intervention-anchored documents for ad-hoc services in crisis mode.
- In non-crisis mode, ad-hoc services have no requirements (current behavior).

### 4.3 Seal predicate for interventions step

- Currently: `(interventionCount > 0 || interventionNotNeeded) && (interventionCount === 0 || requirementsMet)`.
- In crisis mode: `requirementsMet` includes intervention-anchored documents for ad-hoc services.
- The server's `requirementsMet` and the client's `interventionRequirementsMet` are updated in lockstep (same pattern as the existing program-anchored logic).

## 5. Client + migration + testing

### 5.1 Client

- Crisis-mode toggle in the case header (admin + social_worker only).
- Crisis-mode banner when active.
- Requirements panel (`CaseRequirements` in `StepImplementHIP`) shows intervention-anchored documents for ad-hoc services in crisis mode.
- i18n keys (en + fil): `caseView.crisisMode`, `caseView.crisisModeToggle`, `caseView.crisisModeBanner`, `caseView.crisisModeHint`.

### 5.2 Migration (`…0084` + `migrate.ts` mirror)

- `ALTER TABLE cases ADD COLUMN crisis_mode BOOLEAN NOT NULL DEFAULT FALSE`.
- `CREATE TABLE intervention_required_documents (...)` with unique index.
- Seed rows for the 8 intervention-document pairs.
- Both files committed together (per repo convention).

### 5.3 Testing

- **Server:** crisis-mode toggle (meta endpoint), requirements resolution (union of program + intervention documents), seal predicate with intervention-anchored documents, gate unchanged.
- **Client:** crisis-mode toggle renders, banner shows, requirements panel shows intervention documents, i18n parity.
- **Migration:** fresh boot + existing chain.

## 6. Research basis

- DSWD AICS program: the primary document is the General Intake Sheet (GIS), plus service-specific documents.
- DSWD streamlining of AICS documentary requirements (Aug 2023): acknowledges leniency in urgent situations.
- COA audit findings: documentation is required for audit — the solution is to streamline, not eliminate.
- The three-tier model (Crisis/Ad-Hoc, Structured Service, Intake Only) aligns with MSWD practice.
