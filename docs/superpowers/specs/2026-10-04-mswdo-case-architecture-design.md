# MSWDO Case Architecture — Sub-project A: Case File, Stepper, and Program Enrollments

Date: 2026-10-04
Status: approved design (brainstormed section by section) — not yet implemented

## 1. Goal and scope

Make the case model mirror the MSWDO operating model —
`[Client Profile] → [Case File] → [Intake/Assessment] → [Program Enrollments] → [Intervention Logs]` —
by (a) introducing **stable step keys** with a **per-category step template** (case-type-specific
stepper steps), (b) adding a **Program Enrollments** step and table, (c) adding **court docket**
tracking for legal cases, (d) a terminal **Aftercare** status, and (e) an **MSWD-** control-number
scheme. This is sub-project **A**; the statutory-alerts engine (Phase C details below), document
templates, and AICS budget tracking are separate later phases.

### Non-goals (later phases)
- **B — Document templates**: SCSR / Certificate of Indigency generators (reuse the existing
  COE/PCV/endorsement export pipeline).
- **C — Statutory alerts**: legal-deadline engine. Verified timeline sources are recorded in
  Appendix A so the phase-C spec starts from the law, not folklore.
- **D — AICS budget tracking**: per-client quarter/year caps + municipal budget watch.

## 2. Recorded decisions (from the brainstorm)

| Question | Decision |
|---|---|
| Stepper shape | **Case-type-specific steps** — the stepper adapts to the case category |
| Category steps vs lifecycle | **Layered injection** — common lifecycle steps stay; category steps are injected between them |
| Status model | Keep the FSM; add a terminal **`aftercare`** status after `closed` |
| Case number scheme | New cases use **`MSWD-<year>-<seq>`**; existing `KAPWA-…` numbers untouched |
| Program enrollments | **Per-case** `program_enrollments`, rendered as its own common step **right after Assess & Interview** |
| Step identification | **Stable string step keys** (`case_step_locks.step_key`), order from a per-category template |

## 3. The step model

### 3.1 Keys and common template

Steps are identified by stable string keys, in display order. Templates key on the **case
category value** (the stored subtype string), so non-statutory subtypes use the common template
while each statutory subtype injects its own step:

```
common:  assessment, enrollments, interventions, referrals, evaluate, closure
CICL:    assessment, discernment, enrollments, interventions, referrals, evaluate, closure
VAWC:    assessment, protection_order, enrollments, interventions, referrals, evaluate, closure
Solo Parent:  assessment, solo_parent, enrollments, interventions, referrals, evaluate, closure
Adoption & Foster Care:  assessment, adoption, enrollments, interventions, referrals, evaluate, closure
```

Cases with no category (legacy) use the common template. The catalog is a registry: adding a
category step later is adding a template entry, not touching the stepper core.

### 3.2 Lifecycle floors (when a step becomes due/sealable)

Replaces `CASE_STEP_MIN_STATUS`:

| Step key | Due at lifecycle position |
|---|---|
| `assessment`, `enrollments`, `interventions`, `referrals`, `discernment`, `protection_order`, `solo_parent`, `adoption` | `enrolled` (0) |
| `evaluate` | `active` (3) |
| `closure` | `transitioning` (4) |

`stepsDueAt(status, category)` returns the ordered due keys from the case's template.
Transition gates (`assessed → in_review`, `transitioning → closed`) and `assertStepsSealed`
operate on keys.

### 3.3 Done-predicates

| Step key | Done when |
|---|---|
| `assessment` | `problemsPresented && socialWorkerAssessment && clientCategory && caseCategory` (existing + category) |
| `enrollments` | `program_enrollments` has ≥ 1 row **or** `enrollments_not_needed` |
| `interventions` | existing predicate (intervention or `interventionNotNeeded`; required documents met) |
| `referrals` | existing predicate (referral or `referralNotNeeded`) |
| `discernment` | `discernmentAssessedAt` and `discernmentResult` set |
| `protection_order` | `protectionOrderType` set |
| `solo_parent` | Solo Parent ID issued (`soloParentIdIssuedDate` and `soloParentIdNumber` set) |
| `adoption` | `adoptionDvcDate` and `adoptionCaseStudyDate` set |
| `evaluate` | existing transition-plan predicate — M&E: progress against the case plan since implementation began (AO 10 §VIII.F) |
| `closure` | existing closure predicate (`closureOutcome`) |

### 3.4 Step locks

`case_step_locks` gains `step_key` (unique per case), migrations map existing rows
(`0→assessment, 1→interventions, 2→referrals, 3→evaluate, 4→closure`), and the integer
`step_index` column is dropped. Seal/unlock APIs, `StepLockBar`, the case view's
`lockFor`/done maps, and the `filing` document-verify gate (`assertUnsealed(caseId, …)`)
move to keys.

## 4. Data model

### 4.1 `cases` new columns

| Column | Type | Notes |
|---|---|---|
| `court_docket_number` | TEXT NULL | legal categories (CICL, VAWC, CNSP) |
| `discernment_assessed_at` | DATE NULL | CICL step |
| `discernment_result` | TEXT NULL | `discerned` \| `not_discerned` |
| `discernment_notes` | TEXT NULL | |
| `protection_order_type` | TEXT NULL | `Barangay Protection Order (BPO)` \| `Temporary Protection Order (TPO)` \| `Permanent Protection Order (PPO)` |
| `protection_order_issued_at` | DATE NULL | |
| `protection_order_issued_by` | TEXT NULL | issuing authority (Punong Barangay / court) |
| `protection_order_notes` | TEXT NULL | |
| `enrollments_not_needed` | BOOLEAN NOT NULL DEFAULT FALSE | explicit "no programs" decision |
| `solo_parent_id_issued_date` | DATE NULL | Solo Parent step |
| `solo_parent_id_number` | TEXT NULL | |
| `solo_parent_notes` | TEXT NULL | |
| `adoption_dvc_date` | DATE NULL | Adoption & Foster Care step |
| `adoption_case_study_date` | DATE NULL | |
| `adoption_cdclaa_received` | BOOLEAN NULL | |
| `adoption_notes` | TEXT NULL | |
| `status` | enum + `aftercare` | terminal |

### 4.2 `program_enrollments` (new table)

- `id UUID PK` · `case_id UUID NOT NULL → cases(id)` · `program_id UUID NOT NULL → programs(id)`
- `enrolled_at DATE NOT NULL` · `status TEXT NOT NULL DEFAULT 'active'` (`active | completed | withdrawn`)
- `created_by UUID NULL` · `created_at` / `updated_at`
- **UNIQUE `(case_id, program_id)`**

### 4.3 `case_step_locks`

- Add `step_key TEXT NOT NULL`; UNIQUE `(case_id, step_key)`; backfill from `step_index`;
  drop `step_index`.

### 4.4 Programs & interventions shape (evaluated)

The existing tables already fit the model; the additive changes key the domains the way the
MSWDO reference does:

- **`programs.program_type TEXT NULL`** — seeded catalog: `aics`, `social_pension`,
  `supplemental_feeding`, `livelihood`, `family_welfare`, `women_welfare`, `disability_aid`,
  `cct`, `child_welfare`, `medical`, `shelter`, `diversion`, `aftercare`, `counseling`,
  `legal_referral`, `disaster_relief`. `name` stays the display label; `program_type` keys
  enrollments and the later AICS-budget phase. (The former standalone `burial`/`transport`/
  `education`/`food`/`financial` program types are gone — per MSWDO practice AICS is **one
  program whose assistance types are its services**; see Appendix B.)
- **`program_services` (new child table)** — the services a program can render:
  `program_id → programs(id)`, `intervention_type TEXT`, **UNIQUE `(program_id, intervention_type)`**.
  This is the Program → Services matrix: an intervention is a **service rendered under a
  program**, so the logging UI offers only the chosen program's services.
- **`case_interventions.intervention_type TEXT NULL`** — the service catalog (22 codes,
  mirroring DSWD AO 10 s. 2007 intervention/diversion program examples and the Quezon MSWDO
  helping-strategies catalog):
  `financial_grant`, `medical_assistance`, `burial_assistance`, `transport_assistance`,
  `food_pack`, `educational_assistance`, `livelihood_seed`, `training_seminar`,
  `crisis_counseling`, `psychosocial_support`, `parent_effectiveness`, `youth_engagement`,
  `community_service`, `legal_assistance`, `medico_legal_assistance`, `referral_pao`,
  `protection_order_issued`, `protective_custody`, `shelter_assistance`, `scsr_generated`,
  `home_visit`, `health_checkup`. `service_name` stays the human label.
- **`case_interventions.program_enrollment_id UUID NULL → program_enrollments(id)`** — the
  enrollment the service was delivered under.

**Seeds mirror real MSWDO programs** (matrix in Appendix B): every seeded program gets a
`program_type` and its `program_services` rows, so the enrollments select and the intervention
UI show real, internally consistent options. The catalog is anchored to the programs verified
in DSWD AO 10 s. 2007 and the Quezon/Bombon MSWDO published catalogs (Appendix C).

**`programs.approval_workflow` stays** (evaluated, not removed). It is not dead code:
`CreateProgramPage` collects the steps, `ProgramDetailPage`/`ProgramsPage` render them,
`programs.service` validates the shape, and the sync column manifest carries the column. It is
not *executed* by the approvals pipeline — which runs on case statuses — but removing it would
ripple through the entity, zod, service, two pages, i18n, the sync manifest, and migration
history for little gain. Out of scope for this rework.

## 5. Category steps (initial catalog)

### 5.1 CICL — `discernment` (Discernment Assessment)

Under R.A. 9344 §6/§22 the social worker determines whether a CICL (above 15, below 18)
**acted with discernment** — this decides diversion vs intervention program. The step records:

- `discernment_assessed_at` (date), `discernment_result` (`discerned | not_discerned`),
  `discernment_notes`.
- UI: date picker, result choice, notes; a hint shows the pathway implied by the result
  (diversion if discerned; intervention program if not).
- Done = date **and** result set. Hidden for non-CICL categories.

### 5.2 VAWC — `protection_order`

Under R.A. 9262 §8/§14–16 there are three protection orders with different issuers and
validities. The step records:

- `protection_order_type` (BPO / TPO / PPO), `protection_order_issued_at`,
  `protection_order_issued_by`, `protection_order_notes`.
- UI: type select, issued date/authority, notes; validity hint (BPO 15 days, TPO 30 days,
  PPO until revoked). Hidden for non-VAWC categories.

### 5.3 Solo Parent — `solo_parent`

Under R.A. 8972 the DSWD worker **assesses eligibility** (income below the NEDA poverty
threshold) and the LGU issues the **Solo Parent ID** (benefits: parental leave, educational,
housing). The step records:

- `solo_parent_id_issued_date`, `solo_parent_id_number`, plus optional notes.
- UI: eligibility assessment fields + ID issuance. Done = ID issued. Hidden for non-Solo-Parent
  categories.

### 5.4 Adoption & Foster Care — `adoption`

Under R.A. 11642 the LSWDO files CDCLAA petitions and processes DVC, the **child case-study
report** and the PAPs' **home study report**. The step tracks the MSWDO's part:

- `adoption_dvc_date`, `adoption_case_study_date`, `adoption_cdclaa_received`, plus notes.
- UI: dates + CDCLAA receipt checkbox; the required reports attach as documents (Phase B will
  generate the templates). Done = DVC date and case-study date set. Hidden for other categories.

### 5.5 Court docket

For legal categories (CICL, VAWC, CNSP) the case header shows an editable **Court Docket No.**,
saved via `PATCH /cases/:id/meta`.

## 6. Enrollment & intervention UIs

### 6.1 Program Enrollments step (`enrollments`)

- Shows the case's enrollments: program, enrollment date, status; add/remove/edit.
- Endpoints: `GET/POST /cases/:id/enrollments`, `DELETE /cases/:id/enrollments/:id`,
  and `PATCH /cases/:id/enrollments-decision { notNeeded }` (mirrors the referrals decision).
- The case-view detail payload carries the enrollments list (and `enrollments_not_needed`).

### 6.2 Interventions client UI

The **Program → Services** matrix drives the intervention logging UIs, so a logged intervention
is a **service the chosen program actually renders**:

- The case-view **New Intervention** dialog (StepImplementHIP) keeps its **Program** select;
  the **Service** select derives from that program's `program_services` (all catalog services
  when no program is chosen) and the payload sends `interventionType` + `serviceName`.
- The **Beneficiary quick log** (BeneficiaryViewPage "Log Intervention") gains an optional
  **Program** select with the same service derivation (all services when no program).
- The case-view intervention list and the beneficiary interventions panel render the resolved
  service label, and rows carry the enrollment they were delivered under.
- Server: `POST /cases/:id/interventions` accepts `interventionType` (enum, optional);
  `program_enrollment_id` (uuid, optional). Rows without a type render "uncatalogued".
- `seed-demo.ts` assigns `interventionType` to seeded intervention rows (mapping the legacy
  codes: FA → `financial_grant`, C → `crisis_counseling`, R → `referral_pao`, …).

## 7. Aftercare

- `CaseStatus.AFTERCARE = 'aftercare'`; FSM edge **`closed → aftercare`** (admin, social_worker);
  no outgoing edges; SLA alerts exclude aftercare.
- A closed case's action bar offers **"Move to Aftercare"**; aftercare cases render a read-only
  banner with the full step template sealed.
- Confirmed practice: DSWD AO 10 s. 2007 §VIII.G terminates the helping relationship when the
  rehabilitation goal is achieved, and institutionalized CICL are **referred to the C/MSWDO for
  aftercare services**; the Bombon MSWDO catalog lists **After Care Service** as a standing
  program pillar. Generalizes to PWUD aftercare, CICL diversion follow-up, VAWC safety
  monitoring.

## 8. Control numbers

`generateControlNo()` → `MSWD-<year>-<seq>` (same `case_control_counters` row; uniqueness is on
the full string, so `KAPWA-` and `MSWD-` coexist).

## 9. Case-category immutability

`caseCategory` defines the step template, so it is editable only while the case is `enrolled`
(during Step 1). Once the case leaves `enrolled`, it locks — the step-1 UI states why; the
assessment schema enforces it (a `caseCategory` change on an assessed+ case is rejected).

## 10. API surface added

| Endpoint | Purpose |
|---|---|
| `GET/POST /cases/:id/enrollments` | list / add an enrollment |
| `DELETE /cases/:id/enrollments/:enrollmentId` | remove one |
| `PATCH /cases/:id/enrollments-decision` `{ notNeeded }` | explicit no-programs decision |
| `PATCH /cases/:id/discernment` | CICL step save |
| `PATCH /cases/:id/protection-order` | VAWC step save |
| `PATCH /cases/:id/solo-parent` | Solo Parent step save |
| `PATCH /cases/:id/adoption` | Adoption & Foster Care step save |
| `PATCH /cases/:id/meta` `{ courtDocketNumber }` | court docket |
| `POST /cases/:id/interventions` | add an intervention (`interventionType`, `programEnrollmentId` optional) |
| `PATCH /cases/:id/status` `{ status: 'aftercare' }` | via the existing endpoint + FSM edge |

## 11. Migration & rollout plan

Five TypeORM migrations, each mirrored by idempotent statements in `src/database/migrate.ts`
(the fresh-boot bootstrap):

- **`…0000000000077`** — `program_enrollments` (+ indexes, unique).
- **`…0000000000078`** — `cases` columns: court docket, discernment, protection order,
  solo-parent, adoption, `enrollments_not_needed`; status enum + `aftercare`.
- **`…0000000000079`** — `case_step_locks.step_key`: add, backfill, rebuild unique,
  drop `step_index`.
- **`…0000000000080`** — `programs.program_type`; **`program_services`** table;
  `case_interventions.intervention_type` and `program_enrollment_id`.
- **Seed updates (not migrations):** `seed-programs.ts` seeds `programType` per program, the
  `program_services` matrix (Appendix B — AICS consolidation, new women's-/family-welfare
  programs, Juvenile Diversion & Aftercare), and drops the subsumed standalone assistance-type
  programs; `seed-demo.ts` assigns `interventionType` to seeded intervention rows; the
  program-type and service catalogs ship as shared constants (server/client parity test).

Rollout: single cohesive change set on `main`; CI (server jest + coverage, client vitest +
coverage, docker build); then the running stack applies migrations.

## 12. Testing

- **Parity**: server/client step templates, labels, and floors cross-checked (extends the
  existing `case-fsm-parity` pattern); templates per category pinned.
- Server: lock service key-based; gates on keys; enrollments CRUD + decision; discernment /
  protection-order / solo-parent / adoption / meta endpoints; aftercare transition + SLA
  exclusion; control-number prefix; category immutability; program/intervention type catalogs
  (parity + seeds).
- Client: stepper renders CICL vs VAWC vs Solo Parent vs Adoption vs common templates;
  lock-by-key; the five new step UIs; the typed intervention logging UIs (quick log +
  New Intervention dialog); CaseActionBar gates; aftercare banner/action; court-docket header.
- Existing index-pinning specs migrate to keys (`StepLocksAcrossSteps`, `CaseStepper.done`,
  `case-step-locks.service.spec`, etc.).

## 13. Risks and open items

- **Sync manifest**: `case_step_locks` participates in device sync — column lists in
  `sync.service.ts` must be updated for the `step_key` swap; verify conflict resolution paths.
- **Index-pinning tests**: the largest mechanical churn is migrating specs that reference
  integer step indices to keys.
- **Seed-program churn**: specs and client pages that pin seeded program names/counts
  (programs.service tests, ProgramsPage, seed assertions) break when Appendix B rows change —
  update them in the same change set, and re-verify seeded interventions that referenced the
  merged AICS sub-programs.
- **Case-detail payload size**: enrollments ride on the case detail; fine for the current
  volumes, keep it in mind.
- **Legacy cases**: category `NULL` → common template; their locks map to keys by position.

## Appendix A — Statutory & guideline sources (verified 2026-10-04)

- **R.A. 9344 (Juvenile Justice and Welfare Act), §6, §22**: discernment — child 15 or under
  exempt (intervention program); age 15–17 exempt *unless* acting with discernment, decided by
  the social worker; §21 custody turnover **≤ 8 hours**; §26 diversion proceedings **≤ 45 days**.
- **DSWD Administrative Order No. 10, s. 2007** (Guidelines for Social Workers in the Handling
  and Treatment of CICL): the **case-management framework** — identification of problem → data
  gathering → diagnostic assessment → treatment plan → implementation → monitoring & evaluation
  → termination (SCSR as the tool); the **intervention program** examples (counseling,
  life-skills trainings, parent-support services, referral, youth organizations, psychosocial/
  therapeutic programs; **6 months–1 year**); the **diversion program** examples (counseling,
  anger-management/problem-solving/values-formation trainings, **community service**, education/
  vocational programs; contract signed by child + parents + worker; proceedings **≤ 45 days**);
  and **aftercare referral to the C/MSWDO on termination** (§VIII.G).
- **R.A. 9262 (VAWC Act), §8, §14–16**: BPO (Punong Barangay, ex parte, **15 days**), TPO
  (court, ex parte, **30 days**), PPO (court, until revoked); §9 social workers may file;
  §40 MSWDO shelter/counseling duties.
- **R.A. 8972 (Solo Parents' Welfare Act), §4**: eligibility assessed by the DSWD worker against
  the NEDA poverty threshold; ID issuance is the LGU workflow the `solo_parent` step records.
- **R.A. 11310 (4Ps Act)**: conditional cash transfer; Kilos-Unlad social case management
  (assess → plan → manage → coordinate → advocate) and program exit rules inform the
  `evaluate` step and the seeded 4Ps program (FDS = parent-effectiveness sessions).
- **R.A. 11642 (Domestic Administrative Adoption and Alternative Child Care Act, 2022)**:
  LSWDO files CDCLAA petitions (§12); DVC, child case-study and home-study reports are the
  document spine of the `adoption` step; CDCLAA within **3 months** of DVC/foundling
  certification (§11).
- These timelines are inputs for the **Phase C** statutory-alerts design.

## Appendix B — Seeded program → service matrix (mirrors real MSWDO programs)

Every seeded program gets a `program_type` and its `program_services` rows (the Program →
Services matrix). Anchored to DSWD AO 10 s. 2007 intervention examples and the published
Quezon/Bombon MSWDO program catalogs (Appendix C).

**Catalog changes vs. the previous draft (all research-verified):**
- The standalone **Medical / Burial / Transportation / Food / Financial / Educational
  Assistance** programs are **merged into AICS** — per the Palanan MSWDO process, AICS is one
  program providing "direct financial assistance and material assistance including medical,
  transportation, financial, burial and food"; its assistance types are its *services*.
  These six rows still seed as **untyped report-support rows** (`program_type: NULL`) because
  the GAD summary report's BURIAL/MEDICAL/EDUCATION columns key on the names; they are
  outside the typed catalog, which keys off `aics` + `intervention_type`.
- **“Livelihood Assistance”** duplicate dropped (Sustainable Livelihood Program covers it).
- New: **VAWC Protection & Women's Welfare** (`women_welfare`), **Parent Effectiveness
  Service**, **Family Casework Service**, **Crisis Intervention & Psychosocial Support**
  (renamed from generic "Psychosocial Counseling"), **Emergency Shelter Assistance** (now
  seeded — a standard emergency-assistance PPA, not optional), **Juvenile Diversion &
  Intervention Program (CICL)** (renamed per AO 10 §IV: Intervention = "series of activities…
  counseling, skills training, education"), enriched **Aftercare Support**.

| Program (seed name) | program_type | program_services (intervention_type) |
|---|---|---|
| AICS — Assistance to Individuals in Crisis Situation | aics | financial_grant, medical_assistance, burial_assistance, transport_assistance, food_pack, educational_assistance, scsr_generated, crisis_counseling |
| Social Pension for Indigent Senior Citizens | social_pension | financial_grant, scsr_generated, home_visit |
| Supplementary Feeding Program | supplemental_feeding | food_pack, health_checkup |
| Sustainable Livelihood Program | livelihood | livelihood_seed, training_seminar, home_visit |
| Parent Effectiveness Service | family_welfare | parent_effectiveness, training_seminar, crisis_counseling |
| Solo Parent Support | family_welfare | financial_grant, crisis_counseling, legal_assistance, training_seminar, scsr_generated |
| Family Casework Service | family_welfare | crisis_counseling, home_visit |
| VAWC Protection & Women's Welfare | women_welfare | crisis_counseling, psychosocial_support, legal_assistance, medico_legal_assistance, protection_order_issued, shelter_assistance, referral_pao |
| PWD Assistance | disability_aid | medical_assistance, financial_grant, health_checkup, scsr_generated |
| 4Ps — Pantawid Pamilyang Pilipino Program | cct | financial_grant, crisis_counseling, parent_effectiveness, health_checkup, educational_assistance |
| Child Welfare Assistance (CNSP) | child_welfare | financial_grant, crisis_counseling, legal_assistance, medico_legal_assistance, educational_assistance, protective_custody, shelter_assistance |
| **Juvenile Diversion & Intervention Program (CICL)** | diversion | crisis_counseling, psychosocial_support, training_seminar, community_service, youth_engagement, parent_effectiveness, legal_assistance, home_visit |
| **Aftercare Support** | aftercare | home_visit, crisis_counseling, psychosocial_support, scsr_generated |
| Crisis Intervention & Psychosocial Support | counseling | crisis_counseling, psychosocial_support |
| Referral and Linkage Services | legal_referral | referral_pao, legal_assistance, scsr_generated |
| Emergency Shelter Assistance | shelter | shelter_assistance, financial_grant, home_visit |
| Emergency Cash/Food for Work | disaster_relief | food_pack, financial_grant |
| Disaster Response and Relief Assistance | disaster_relief | food_pack, transport_assistance, financial_grant, crisis_counseling, home_visit |
| Medical Equipment Loan | medical | medical_assistance, scsr_generated |

Real installations may add local PPAs (pre-marriage counseling, municipal scholarship, OSCA
innovations) as custom programs with their own `program_services` via `CreateProgramPage`.

## Appendix C — Internet-verified MSWDO practice sources (2026-10-04)

Primary and official sources fetched during research:

- **DSWD Administrative Order No. 10, s. 2007** — Guidelines for Social Workers in the
  Handling and Treatment of CICL (Supreme Court E-Library)
  `https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/24/52303`
  — 7-phase case-management framework with the SCSR as tool; intervention vs diversion program
  definitions and examples; 6-month–1-year program duration; monthly reporting/compliance
  monitoring; aftercare referral on termination.
- **Quezon, Quezon MSWDO Operation Manual 2025** (official municipal site)
  `https://quezonquezon.gov.ph/documents/mswdo-operation-manual-2025-quezon-quezon/`
  — case folder contents per category (CICL / sexual abuse / VAWC); records policy (progress
  notes in every folder, authorized access, logbook, number-coded folders filed by category,
  locked cabinets); SCSR timelines (simple 1–2 days, complex 30 days; discernment certification
  to court 15–30 days); §VIII program catalog (family, community, women, child/youth,
  PWD/elderly, emergency assistance — AICS, ESA, food/cash for work, crisis intervention);
  §IX helping strategies (services must follow the case plan); CEDC/WEDC/CICL case processes;
  caseload standards (60 clients/RSW generalist, 20/RSW legal specialist); AICS rates per
  assistance type (burial ₱2,000, shelter ₱1,500–5,000, medical ₱500–5,000, …).
- **Bombon, Camarines Sur MSWDO** (official municipal site)
  `https://bombon.gov.ph/offices/mswdo/`
  — program & services catalog by client group (child/youth, family/community, women, elderly,
  PWD, **After Care Service**, capability development), confirming the seed groupings.
- **Palanan, Isabela MSWDO client-flow manual** `https://www.palanan.gov.ph/wp-content/uploads/MSWDO.pdf`
  — walk-in service flow: logbook sign-in → interview → General Intake Sheet → assessment →
  SCSR/referral letter → MSWDO approval → service release; **AICS** as one program covering
  medical, transportation, financial, burial and food assistance.
- **PCW Barangay VAW Desk Handbook** `https://pcw.gov.ph/assets/files/2019/04/Barangay-VAW-Desk-Handbook.pdf`
  — barangay VAW desk as the reporting entry point; referral to MSWDO/PNP/medico-legal.
- **JJWC Barangay Protocol in Managing Cases of CICL and CAR**
  `https://jjwc.gov.ph/wp-content/uploads/2020/06/Barangay-Protocol-in-Managing-Cases-of-CICL-and-CAR.pdf`
  — chaptered protocol: intervention program & custody of CICL without discernment; diversion
  of CICL; programs to keep CAR from becoming CICL.
- **DSWD KM Portal — Buklod Paglaom para sa CICL (HoPE) Program Manual**
  `https://kmportal.dswd.gov.ph/knowledge-products/how-guide/buklod-paglaom-para-sa-cicl-holistic-psychosocial-and-economic-hope`
  — holistic psychosocial + economic intervention framework for CICL (IJISC/Bahay Pag-asa,
  RRCY), cognitive-behavioral sessions.
- **LUSTRE thesis (IJRISS 2026)** on lived experiences of discharged Home for Girls clients
  `https://rsisinternational.org/journals/ijriss/uploads/vol10-iss8-pg17579-17621-202609_pdf.pdf`
  — documents DSWD **aftercare** strategies for clients discharged from institutional care.

**What the sources settle (evidence for the design):**
1. Case folders are **per-category** (intake sheet + SCSR + category forms + ancillary
   documents) — the case-category key and per-category step templates mirror this.
2. The case-management arc is intake → **assessment (diagnostic study)** → treatment plan →
   implementation (**interventions = services rendered, based on the case plan**) → monitoring
   & evaluation → termination → **aftercare** — the stepper's arc and the terminal `aftercare`
   status are grounded.
3. Interventions are **services under programs** (AICS assistance types, diversion-program
   activities, counseling/referral/life-skills — AO 10 §IV examples), so the Program →
   Services matrix and typed intervention logs match field practice.
4. Progress is recorded continuously (**progress notes** per folder; monthly reporting for
   CICL/diversion) — the intervention-log + step-lock model captures that granularity.
5. AICS is **one program with per-assistance-type rates and requirements** — the later
   AICS-budget phase keys off `program_type = aics` + `intervention_type`.