# KAPWA System Diagrams Documentation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce 10 diagram documents covering the entire KAPWA MSWDO social welfare system, written under `docs/diagrams/`, with a functional-specification focus — each document pairs a Mermaid diagram with an FR-style functional specification so it can be dropped into the thesis (System Design chapter) as-is.

**Architecture:** Pure documentation task — no code changes. Each document is self-contained Markdown containing (a) a functional specification section (numbered FR requirements), (b) one or more Mermaid diagrams, (c) a narrative description of the diagram, (d) cross-references to the source modules/pages/tables. All facts derive from existing sources — do NOT re-discover the system.

**Tech Stack:** Markdown + Mermaid (v10+ syntax). Verification via `@mermaid-js/mermaid-cli` (`mmdc`) when runnable; the docs must render correctly in GitHub/VS Code Mermaid preview regardless.

## Global Constraints

- **All documents live in `docs/diagrams/`**, named `NN-<kebab-name>.md` (see File Structure Map).
- **Functional-spec focus:** every document MUST contain an FR-numbered specification section (`FR-xx`) — not just a picture. The diagram illustrates the spec; the spec is the primary content.
- **Canonical names (use verbatim everywhere):**
  - Actors/roles (7): `admin`, `social_worker`, `coordinator`, `claimant`, `mayor`, `auditor`, `agency_staff` (+ `guest/public` where applicable).
  - Server feature modules (26, from `app.module.ts`): Auth, Sync, Cases, Programs, Beneficiaries, Notifications, Irf, Dashboard, Chat, Csr, Audit, Export, Filing, Users, AccessCards, CaseInterventions, Lcr, Sla, Otp, Minio, Intake, Referrals, Announcements, Agencies, InterAgencyReferrals, AgencyPortal.
  - Core tables (from `DB-SCHEMA.md` Active Tables, 29): `persons`, `users`, `beneficiaries`, `households`, `household_memberships`, `beneficiary_claimants`, `beneficiary_roles`, `cases`, `case_history`, `case_interventions`, `programs`, `form_version_history`, `referrals`, `irf_cases`, `access_card_services`, `csr_reports`, `document_vault`, `chat_messages`, `notifications`, `notification_preferences`, `consent_ledger`, `otp_codes`, `sync_queue`, `version_vectors`, `idempotency_keys`, `audit_log`, `intervention_types`, `access_card_seq`, `irf_blotter_seq`.
- **Sources to cite (do not invent facts):** `EVALUATION.MD` (architecture, modules, pages, findings), `SYSTEMS_EVAL.MD` (22 findings), `DB-SCHEMA.md` (29 tables with columns), `docs/e2e-full-system.md` (role-by-role behavior evidence), `docs/coordinator-module-design.md`, `docs/inter-agency-beneficiary-tracking.md`, `kapwa-server/src/*` controllers/services, `kapwa-client/src/routes.tsx` (52 routes), `kapwa-client/src/pages/*` (49 pages), `kapwa-server/docker-compose.yml` + `deploy.sh` + `infra/Caddyfile` (deployment).
- **Mermaid constraints:** Mermaid v10-compatible syntax only; no external images; no features that fail in GitHub preview (no `flowchart-elk`, no unsupported skin params). Each diagram in a fenced `mermaid` block.
- **Consistency:** actors, module names, table names, endpoint paths must match canonical lists + cited sources. Reviewer spot-checks cross-document name consistency.
- **No code changes** — docs only.
- **Artifacts to files** (AGENTS.md rule): each task produces exactly one document file; never paste large outputs into chat.
- **Commit convention:** `docs:` prefix for all commits.

---

## File Structure Map

**New files (one per task):**
- `docs/diagrams/01-operational-feasibility-ishikawa.md`
- `docs/diagrams/02-use-case-diagram.md`
- `docs/diagrams/03-sequence-diagram.md`
- `docs/diagrams/04-activity-diagram.md`
- `docs/diagrams/05-output-and-user-interface.md`
- `docs/diagrams/06-erd.md`
- `docs/diagrams/07-data-dictionary.md`
- `docs/diagrams/08-system-architecture.md`
- `docs/diagrams/09-deployment-diagram.md`
- `docs/diagrams/10-program-specification.md`

**Common document template (every task follows it):**

```markdown
# <Diagram Title>

## 1. Purpose
<1-2 sentences: what this diagram/spec documents and for whom>

## 2. Functional Specification
| ID | Requirement |
|----|-------------|
| FR-xx | <functional requirement text> |

## 3. <Diagram Name> (Mermaid)
```mermaid
<diagram>
```

## 4. Diagram Narrative
<Walk-through of the diagram: what each node/flow means, mapping to FR-xx items>

## 5. Cross-References
| Item | Location |
|------|----------|
| <module/page/table> | <exact path> |
```

---

### Task 1: `01-operational-feasibility-ishikawa.md` — Ishikawa (Fishbone) Analysis

**Files:**
- Create: `docs/diagrams/01-operational-feasibility-ishikawa.md`

**Sources:** `EVALUATION.MD` Findings, `SYSTEMS_EVAL.MD` (esp. S-* stability + B-* business findings), `docs/e2e-full-system.md`, `docs/podman-postgres-dev.md`, `deploy.sh`.

**Functional spec focus:** operational feasibility of running KAPWA at MSWDO Norzagaray — factors affecting whether the system can operate in the field, grouped by cause category.

- [ ] **Step 1: Create the document (standard template)**

1. **Purpose:** analyze operational feasibility factors: people (staff training, role coverage), process (intake/approval workflow fit), hardware & connectivity (tablets, offline sync, Minio), data (seed quality, migration), support & maintenance (deploy pipeline, backups).
2. **Functional Specification** — at least 10 FR rows, e.g.:
   - FR-01: The system SHALL support offline data capture on field devices via the sync queue, so social workers can record intakes without connectivity.
   - FR-02: The system SHALL provide role-based access covering all 7 MSWDO operational roles.
   - FR-03: The system SHALL auto-backup the database (see infra/backup) so operational data survives hardware failure.
   - FR-04: Seeded reference data (programs, agencies, intervention types) SHALL exist for first-day operation.
   - FR-05: Deployment SHALL be reproducible via the versioned `deploy.sh` + Docker Compose stack.
   - Add FR-06..FR-12 covering: connectivity resilience, training burden (demo guide), hardware sizing (Postgres/Minio on a single droplet), RLS/scoping correctness for barangay/agency isolation, monitoring (health endpoints), and known operational risks from SYSTEMS_EVAL findings (S-04 tsc gate, S-02 shutdown, S-06 sync hardening).
3. **Mermaid:** Ishikawa (fishbone) as a `flowchart LR` with a central "Operational Feasibility" outcome node and 5-6 category bones (People, Process, Hardware/Connectivity, Data, Support, Security), each with 3-4 cause leaves mapped to FR ids. Label leaves `FR-xx` so the diagram and spec cross-reference.
4. **Diagram Narrative:** walk each category bone, mapping leaves to FR rows and to the SYSTEMS_EVAL finding ids where relevant.
5. **Cross-References:** `deploy.sh`, `infra/backup`, `kapwa-server/src/sync/`, `seed-accounts.ts`, `seed-programs.ts`, `EVALUATION.MD`, `SYSTEMS_EVAL.MD`.

- [ ] **Step 2: Verify Mermaid renders**

Run: `cd kapwa-server && npx -y @mermaid-js/mermaid-cli -i ../docs/diagrams/01-operational-feasibility-ishikawa.md -o /tmp/diag1.svg`
Expected: exits 0 and produces `/tmp/diag1.svg` (if mmdc unavailable, do a manual fence/syntax re-read and note it in the report).

- [ ] **Step 3: Commit**

```bash
git add docs/diagrams/01-operational-feasibility-ishikawa.md
git commit -m "docs: operational feasibility (Ishikawa) diagram and functional spec"
```

---

### Task 2: `02-use-case-diagram.md` — Use Case Diagram

**Files:**
- Create: `docs/diagrams/02-use-case-diagram.md`

**Sources:** `routes.tsx` (52 routes), `kapwa-server/src/*/*.controller.ts` (30 controllers), `docs/e2e-full-system.md` (role-by-role behavior), `EVALUATION.MD` §5.

**Functional spec focus:** who does what — actors, use cases, and the role-to-feature matrix for the whole system.

- [ ] **Step 1: Create the document (standard template)**

1. **Purpose:** map every actor to the use cases they can perform across all 26 modules.
2. **Functional Specification** — one FR row per actor-area pair (aim 15-20 rows), e.g.:
   - FR-01: `guest/public` SHALL view the landing page and public announcements.
   - FR-02: `guest` SHALL register, verify email, and log in (with MFA when enabled).
   - FR-03: `claimant` SHALL view own access card and service history.
   - FR-04: `social_worker` SHALL create intakes, assess cases, log interventions, generate certificates/CSR/IRF, chat, and view notifications.
   - FR-05: `coordinator` SHALL file referrals, review intake requests, and manage access cards for their barangay.
   - FR-06: `admin` SHALL manage users, programs, agencies, announcements, and wipe/reset operations.
   - FR-07: `mayor` SHALL view reports/dashboard and export fund utilization.
   - FR-08: `auditor` SHALL view audit logs and export data.
   - FR-09: `agency_staff` SHALL view agency dashboard, referrals, and access-card activities for their agency.
   - FR-10: All actors SHALL receive role-appropriate notifications; chat SHALL be available to admin/social_worker/coordinator/claimant.
3. **Mermaid:** one `flowchart` (or `graph`) with actor nodes (7 + guest) on one side and use-case ellipse nodes on the other, grouped by module with subgraphs (`subgraph Auth`, `subgraph Intake`, `subgraph Cases`, `subgraph Referrals`, `subgraph Inter-Agency`, `subgraph Agency Portal`, `subgraph Reports`, `subgraph Admin`, `subgraph Messaging`). Every edge labeled with the actor name. Include the guest/public use cases. Keep node count readable (group per-module use cases into one ellipse per module if needed, e.g. "Intake: create/assess").
4. **Diagram Narrative:** describe each actor's coverage and note which use cases are role-restricted (cite `@Roles`/`ROLE_REDIRECT_MAP`).
5. **Cross-References:** `routes.tsx`, controller files per module, `role-access.ts`.

- [ ] **Step 2: Verify Mermaid renders**

Run: `cd kapwa-server && npx -y @mermaid-js/mermaid-cli -i ../docs/diagrams/02-use-case-diagram.md -o /tmp/diag2.svg`
Expected: exits 0 (or manual fallback as in Task 1).

- [ ] **Step 3: Commit**

```bash
git add docs/diagrams/02-use-case-diagram.md
git commit -m "docs: use case diagram and role matrix functional spec"
```

---

### Task 3: `03-sequence-diagram.md` — Sequence Diagrams

**Files:**
- Create: `docs/diagrams/03-sequence-diagram.md`

**Sources:** `auth-context.tsx`, `auth.controller.ts`, `intake.service.ts`, `cases.service.ts`, `sync.service.ts`, `inter-agency-referrals.service.ts`, `notifications.service.ts`.

**Functional spec focus:** the interaction order for the system's core business flows, from actor action to persistence.

- [ ] **Step 1: Create the document (standard template)**

1. **Purpose:** document 4 core end-to-end flows in sequence form.
2. **Functional Specification** — FR rows describing the flows (aim 12-16 rows):
   - FR-01..FR-04 (Auth): login → token issuance → 401 interceptor single-flight refresh → `kapwa:auth:logout` on refresh failure; MFA challenge flow.
   - FR-05..FR-08 (Intake): social_worker submits intake → beneficiary/person creation → case created (status `enrolled`) → family members linked to household.
   - FR-09..FR-12 (Case lifecycle): assessment → `assessed` → review → `in_review` → approve → `active` → disburse → `transitioning` → close → `closed`; each transition validated by the shared FSM (`case-fsm.ts`).
   - FR-13..FR-16 (Inter-agency referral): create → notify receiving agency staff → receive/action/close → notify creator.
3. **Mermaid:** four separate `sequenceDiagram` blocks, one per flow:
   - Auth: `Client` → `AuthController` → `AuthService` → `UserRepository`; alt blocks for success/MFA/failure.
   - Intake: `SocialWorker` → `IntakePage` → `IntakeController` → `IntakeService` → `PersonRepository`/`HouseholdRepository`/`CaseRepository`.
   - Case FSM: `SocialWorker` → `CasesController` → `CasesService` → `case-fsm.ts` (note `isValidTransition`/`canTransition` checks) → `CaseRepository`.
   - Referral: `AgencyStaff` → `ReferralsPage` → `InterAgencyReferralsController` → `InterAgencyReferralsService` → `NotificationsService` → `NotificationsGateway` (WebSocket push).
   Use `participant`, `activate`/`deactivate`, `alt`/`else`, and `Note over` annotations; label each sequence with its FR ids.
4. **Diagram Narrative:** one paragraph per sequence, mapping lifelines/messages to FR rows.
5. **Cross-References:** `case-fsm.ts`, `cases.service.ts`, `sync.service.ts`, `notifications.gateway.ts`, `intake.service.ts`, `auth-context.tsx`.

- [ ] **Step 2: Verify Mermaid renders**

Run: `cd kapwa-server && npx -y @mermaid-js/mermaid-cli -i ../docs/diagrams/03-sequence-diagram.md -o /tmp/diag3.svg`
Expected: exits 0 (or manual fallback).

- [ ] **Step 3: Commit**

```bash
git add docs/diagrams/03-sequence-diagram.md
git commit -m "docs: sequence diagrams for auth, intake, case FSM, and referral flows"
```

---

### Task 4: `04-activity-diagram.md` — Activity Diagrams

**Files:**
- Create: `docs/diagrams/04-activity-diagram.md`

**Sources:** `intake.service.ts` (submit + match-check), `cases.service.ts` (transition guards), `sync.service.ts` (delta processing), `inter-agency-referrals.service.ts` (status transitions), `AnnouncementsService`.

**Functional spec focus:** the decision-heavy business workflows — branches, guards, and outcome states.

- [ ] **Step 1: Create the document (standard template)**

1. **Purpose:** document 4 decision workflows as activity diagrams with FR spec.
2. **Functional Specification** (aim 12-16 FR rows):
   - FR-01..FR-04 (Intake): start → fill form → match-check against existing beneficiaries → duplicate? → confirm vs new record → submit → case created `enrolled`; draft autosave and recovery.
   - FR-05..FR-08 (Case transitions): per-status guards — assessment required before `assessed`; review approvals; disburse is admin-only (`ACTIVE` → `TRANSITIONING`); close allowed from `TRANSITIONING` for social_worker/coordinator, admin override anywhere (FSM table).
   - FR-09..FR-12 (Sync): client delta → server validation (unknown meta fields rejected) → signature check → idempotency check → apply or conflict resolution (server-wins for financial tables).
   - FR-13..FR-16 (Referral lifecycle): create → receive → action → close/decline, with notifications at each step.
3. **Mermaid:** four `flowchart TD` blocks using start/end nodes (`([start])`, `([end])`), process boxes, decision diamonds (`{...}`), and edge labels for yes/no. Keep each diagram under ~20 nodes so it stays readable. Annotate decision nodes with the guard condition text (e.g. `canTransition(ACTIVE, role) === admin`).
4. **Diagram Narrative:** describe each workflow's decision points and what happens on each branch, mapping to FR rows and the FSM constants (`CASE_FSM`, `CASE_FSM_ROLES`).
5. **Cross-References:** `case-fsm.ts`, `cases.service.ts`, `sync.service.ts`, `conflict-resolver.ts`, `intake.service.ts`, `inter-agency-referrals.service.ts`.

- [ ] **Step 2: Verify Mermaid renders**

Run: `cd kapwa-server && npx -y @mermaid-js/mermaid-cli -i ../docs/diagrams/04-activity-diagram.md -o /tmp/diag4.svg`
Expected: exits 0 (or manual fallback).

- [ ] **Step 3: Commit**

```bash
git add docs/diagrams/04-activity-diagram.md
git commit -m "docs: activity diagrams for intake, case FSM, sync, and referral workflows"
```

---

### Task 5: `05-output-and-user-interface.md` — Output & User Interface

**Files:**
- Create: `docs/diagrams/05-output-and-user-interface.md`

**Sources:** `kapwa-client/src/pages/*` (49 pages), `kapwa-server/src/export/*` (exports: certificates PDF, fund utilization XLSX, CSV), `AccessCardPrintView.tsx`, `infra/Caddyfile` (serving), `docs/demo-screenshots/`, `docs/e2e-screenshots/`.

**Functional spec focus:** every screen and every generated output (report/export) the system produces, per role.

- [ ] **Step 1: Create the document (standard template)**

1. **Purpose:** inventory the UI surfaces and system-generated outputs with functional requirements for each.
2. **Functional Specification** — group FR rows by audience (aim 18-24 rows):
   - FR-01..FR-03 (Public): landing page sections, public announcements list + detail, contact/about.
   - FR-04..FR-08 (Auth): login, register, MFA setup/resolve, forgot/reset password, verify email; post-login redirect per role (`ROLE_REDIRECT_MAP`).
   - FR-09..FR-14 (MSWDO staff): dashboard (metrics), beneficiaries list + view, intake form (597-line, autosave, family members, match-check), cases list/tracker/view (timeline, close/transition controls with confirm dialogs), case tracker page, programs list/detail, IRF create/detail, CSR, physical files, chat, notifications.
   - FR-15..FR-18 (Coordinator): dashboard, referral form/list/review, access cards list + scan (QuickScanCard), beneficiary lookup.
   - FR-19..FR-21 (Claimant): my-dashboard, my access card page, announcements.
   - FR-22..FR-24 (Mayor/Auditor/Admin): reports page + fund utilization export, audit/audit-log pages, admin user/program/agency/announcement management, wipe page (confirm phrase).
   - FR-25..FR-27 (Agency staff): agency dashboard, referrals inbox, card activities, profile.
   - FR-28..FR-32 (Outputs): certificate of indigency/eligibility/referral PDF (`POST /export/certificate`), monthly fund utilization XLSX (`GET /export/monthly-funds`), access card print view, CSV/Excel exports, notification toasts + offline/pending-sync badges.
3. **Mermaid:** one `flowchart LR` "UI map" — start at Shell (Topbar + Sidebar + BottomNav role-filtered), branch per role into their page groups, then a separate small `flowchart` for the Outputs (PDF/XLSX/CSV/print) with their triggers. Use subgraphs per audience.
4. **Diagram Narrative:** walk the shell → per-role page trees; then outputs; map nodes to FR rows.
5. **Cross-References:** `routes.tsx`, `components/Topbar.tsx`, `components/Sidebar.tsx`, `components/BottomNav.tsx`, `pages/*`, `export/export.controller.ts`, `export/export.service.ts`, screenshots dirs.

- [ ] **Step 2: Verify Mermaid renders**

Run: `cd kapwa-server && npx -y @mermaid-js/mermaid-cli -i ../docs/diagrams/05-output-and-user-interface.md -o /tmp/diag5.svg`
Expected: exits 0 (or manual fallback).

- [ ] **Step 3: Commit**

```bash
git add docs/diagrams/05-output-and-user-interface.md
git commit -m "docs: output and user interface inventory with functional spec"
```

---

### Task 6: `06-erd.md` — Entity Relationship Diagram

**Files:**
- Create: `docs/diagrams/06-erd.md`

**Sources:** `DB-SCHEMA.md` (29 tables with columns and FKs), `kapwa-server/src/**/*.entity.ts` (TypeORM entities), `docs/diagrams/07-data-dictionary.md` (created in Task 7 — keep in sync).

**Functional spec focus:** entities, relationships, cardinalities, and the data rules that implement the functional requirements.

- [ ] **Step 1: Create the document (standard template)**

1. **Purpose:** document the logical data model — entities, relationships, cardinality — as the persistence backbone of the functional spec.
2. **Functional Specification** — data-rule FR rows (aim 12-16):
   - FR-01: Every person record SHALL be unique by `persons.id`; persons unify beneficiaries, claimants, users, and coordinators (person_id FKs).
   - FR-02: A beneficiary SHALL belong to at most one household via `household_memberships` (partial unique index on person_id+household_id).
   - FR-03: A case SHALL reference one beneficiary and track FSM status via the `cases.status` CHECK constraint.
   - FR-04: Case status transitions SHALL be recorded in `case_history` with from/to status enums.
   - FR-05: Interventions SHALL attach to cases (`case_interventions.case_id`) and optionally programs.
   - FR-06: Referrals SHALL link a person, a case, and from/to agencies; status lifecycle constrained by CHECK.
   - FR-07: Access card services SHALL reference a beneficiary's access card code; card codes unique.
   - FR-08: Notifications SHALL reference a recipient and category; preferences per user/channel/category.
   - FR-09: Sync queue entries SHALL carry idempotency keys; version vectors track per-device CRDT versions.
   - FR-10: Consent events SHALL be append-only in `consent_ledger`.
   - FR-11: Document vault entries SHALL reference a case/beneficiary; physical files SHALL reference an intervention.
   - FR-12: Program form templates SHALL be versioned via `form_version_history`.
3. **Mermaid:** ONE `erDiagram` block covering all 29 tables. Use `PK`, `FK`, `UK` markers, relationship lines with cardinality (`||--o{`, `||--||`, `}o--o{`, etc.). Group with `%%` comments per module (identity, cases, programs, referrals, sync, messaging, audit). Keep the diagram syntactically valid — Mermaid erDiagram is strict about attribute types and quotes (quote reserved words and dashed names).
4. **Diagram Narrative:** walk the entity clusters (identity & households, cases & interventions, programs, referrals & agencies, access cards, sync, messaging, audit), naming each relationship and cardinality, mapping to FR rows.
5. **Cross-References:** `DB-SCHEMA.md`, each `*.entity.ts` path.

- [ ] **Step 2: Verify Mermaid renders**

Run: `cd kapwa-server && npx -y @mermaid-js/mermaid-cli -i ../docs/diagrams/06-erd.md -o /tmp/diag6.svg`
Expected: exits 0. Fix any erDiagram syntax errors (reserved words, missing quotes) before committing.

- [ ] **Step 3: Commit**

```bash
git add docs/diagrams/06-erd.md
git commit -m "docs: entity relationship diagram for the full data model"
```

---

### Task 7: `07-data-dictionary.md` — Data Dictionary

**Files:**
- Create: `docs/diagrams/07-data-dictionary.md`

**Sources:** `DB-SCHEMA.md` (authoritative — 29 tables, columns, types), `kapwa-server/src/**/*.entity.ts` (fallback for exact column names/types/defaults).

**Functional spec focus:** complete column-level dictionary for every table, so the functional spec's data rules are traceable to fields.

- [ ] **Step 1: Create the document (standard template)**

1. **Purpose:** the authoritative data dictionary: every table, column, type, nullability, default, and a functional description.
2. **Functional Specification** — dictionary conventions as FR rows (aim 8-10):
   - FR-01: The dictionary SHALL cover all 29 active tables from DB-SCHEMA.md.
   - FR-02: Each table section SHALL list: table name, purpose, and a column table (Column | Type | Null | Default | Description).
   - FR-03: Primary keys SHALL be marked `PK` and foreign keys `FK -> table.column`.
   - FR-04: Enum/CHECK-constrained columns SHALL list their allowed values in Description.
   - FR-05: Every column SHALL have a one-line functional description (what the field means in the workflow), not just the DB type.
   - FR-06: JSONB columns SHALL describe their expected shape (e.g. `current_address`, `requirements_checklist`, `financial_subsidies`).
   - FR-07: Timestamp columns SHALL note semantics (e.g. `created_at` = record creation, `published_at` = public visibility).
   - FR-08: Columns added by recent features (agency_id, delivery_date, case_id on access_card_services) SHALL be present.
3. **Body:** one `### N. table_name` section per table, in the same order as DB-SCHEMA.md (persons → irf_blotter_seq). Reproduce column tables faithfully from DB-SCHEMA.md; where DB-SCHEMA.md omits a column that an entity defines, add it and flag with a note. Cross-check against the ERD (Task 6) for FK consistency.
4. **Diagram Narrative / Notes:** replace the Mermaid section with a "## 4. Conventions" section (the dictionary is a table document; no diagram needed) — explain PK/FK notation, enum values legend, and how to trace a functional requirement to its fields (FR → table.column mapping examples).
5. **Cross-References:** `DB-SCHEMA.md`, `06-erd.md`.

- [ ] **Step 2: Verify consistency with DB-SCHEMA.md**

Run: `cd kapwa-server && npx tsc --noEmit` (sanity) and re-read the generated file's table count (grep -c '^###') — expected 29.

- [ ] **Step 3: Commit**

```bash
git add docs/diagrams/07-data-dictionary.md
git commit -m "docs: full data dictionary for the system data model"
```

---

### Task 8: `08-system-architecture.md` — System Architecture

**Files:**
- Create: `docs/diagrams/08-system-architecture.md`

**Sources:** `EVALUATION.MD` §4 (server architecture), `app.module.ts`, `main.ts`, `kapwa-client/src/main.tsx` + `App.tsx` + `routes.tsx`, `lib/api.ts` (fetch/retry/auth interceptor), `swr-config.tsx`, `sync.service.ts`, `notifications.gateway.ts` (WebSocket), `minio` module.

**Functional spec focus:** the logical architecture — layers, components, and data flows between them — that delivers the functional requirements.

- [ ] **Step 1: Create the document (standard template)**

1. **Purpose:** document the three-tier architecture (React client → NestJS API → Postgres/Minio) with cross-cutting concerns (auth, sync, realtime, exports).
2. **Functional Specification** (aim 14-18 FR rows):
   - FR-01: The client SHALL talk to the API only through the `/api/v1` prefix (versioned), with token auth header attached by the api layer.
   - FR-02: The api layer SHALL single-flight 401 refresh and dispatch `kapwa:auth:logout` on refresh failure.
   - FR-03: SWR SHALL provide server-state caching, revalidation on focus/reconnect, and offline queue integration.
   - FR-04: The API SHALL enforce global throttling, CSRF guard, helmet, and cookie parsing (main.ts).
   - FR-05: Role guards SHALL enforce module access (RolesGuard) and ABAC fallback.
   - FR-06: The shared case FSM (`case-fsm.ts`) SHALL be the single source of truth for case transitions used by both cases and sync modules.
   - FR-07: The sync service SHALL accept device deltas with signature + idempotency checks, reject unknown meta fields, and resolve conflicts server-wins for financial tables.
   - FR-08: The notifications gateway SHALL push realtime notifications over WebSocket; REST fallback for polling.
   - FR-09: Minio SHALL store documents (vault) and backups; the export module SHALL generate PDF/XLSX/CSV outputs.
   - FR-10: Health endpoints (`/health`, `/health/live`, `/health/ready`) SHALL reflect DB connectivity.
   - FR-11: JSON structured logging SHALL be enabled (S-05).
   - FR-12: Graceful shutdown hooks SHALL run on SIGTERM (S-02).
3. **Mermaid:** one `flowchart LR` with subgraphs: `Client Tier` (App shell, pages, SWR, api.ts, offline queue), `API Tier` (NestJS root: guards/filters/interceptors; module groups: Auth/Sync/Cases/Beneficiaries/Programs/Referrals/Agencies/Export/Notifications/Announcements...), `Data Tier` (Postgres, Minio), plus a `WebSocket` dashed edge from Notifications Gateway to Client, and a `Sync` dashed loop between client offline queue and sync module. Label edges with the FR ids they serve.
4. **Diagram Narrative:** describe the tiers, the request lifecycle (client → guards → module → repository → DB), and the two async channels (WebSocket push, sync delta loop), mapping to FR rows.
5. **Cross-References:** `app.module.ts`, `main.ts`, `lib/api.ts`, `swr-config.tsx`, `sync.service.ts`, `case-fsm.ts`, `notifications.gateway.ts`, `minio.module.ts`.

- [ ] **Step 2: Verify Mermaid renders**

Run: `cd kapwa-server && npx -y @mermaid-js/mermaid-cli -i ../docs/diagrams/08-system-architecture.md -o /tmp/diag8.svg`
Expected: exits 0 (or manual fallback).

- [ ] **Step 3: Commit**

```bash
git add docs/diagrams/08-system-architecture.md
git commit -m "docs: system architecture diagram with cross-cutting functional spec"
```

---

### Task 9: `09-deployment-diagram.md` — Deployment Diagram

**Files:**
- Create: `docs/diagrams/09-deployment-diagram.md`

**Sources:** `kapwa-server/docker-compose.yml` (db/api/minio/client/caddy services, ports, volumes, healthchecks, depends_on), `kapwa-client/Dockerfile` (nginx static), `kapwa-server/Dockerfile` (dist), `Dockerfile.caddy`, `infra/Caddyfile`, `deploy.sh` (droplet flow), `infra/backup/`.

**Functional spec focus:** the physical topology — nodes, containers, ports, volumes, and how a request reaches the app in production.

- [ ] **Step 1: Create the document (standard template)**

1. **Purpose:** document the DigitalOcean droplet topology: containers, exposed ports, volumes, and the request path (Caddy → client/API).
2. **Functional Specification** (aim 10-14 FR rows):
   - FR-01: Caddy SHALL listen on 8090 (HTTP) and 443 (HTTPS) and route `/api/*` to the API container and everything else to the client container.
   - FR-02: The client SHALL serve static files from nginx on port 80, built from `dist/` via multi-stage Docker build.
   - FR-03: The API SHALL expose port 3000 internally only (no host port) and SHALL wait for db+minio healthy (depends_on conditions).
   - FR-04: Postgres SHALL persist data in the `kapwa-data` volume and run with pgaudit preload.
   - FR-05: Minio SHALL persist in `minio-data` and serve on 9000/9001 internally.
   - FR-06: Volumes `kapwa-data`, `minio-data`, `caddy-data` SHALL survive container recreation.
   - FR-07: All services SHALL restart unless-stopped.
   - FR-08: Bootstrap SHALL be reproducible via `deploy.sh` (env validation → build → up → health wait → migrate.js bootstrap → incremental run-migrations best-effort).
   - FR-09: Healthchecks SHALL gate startup order (db → api/client → caddy).
   - FR-10: Backups SHALL run via `infra/backup` against the db container.
3. **Mermaid:** one `flowchart LR` (or `graph TD`) deployment view: `Internet` → `Caddy (8090/443)` → split to `Client nginx (80)` and `API (3000)`; `API` → `Postgres (5432, kapwa-data volume)` and `API` → `Minio (9000/9001, minio-data)`; `Caddy` → `caddy-data volume`. Use `subgraph Droplet (Ubuntu 24.04)` enclosing all containers, and `%%` comments listing healthcheck conditions and depends_on. Optionally a second small `sequenceDiagram`-free `flowchart` for the `deploy.sh` steps (env check → build --pull → up -d → health wait → migrate → done).
4. **Diagram Narrative:** describe the request path and the deploy sequence, mapping to FR rows.
5. **Cross-References:** `docker-compose.yml`, `Dockerfile*`, `infra/Caddyfile`, `deploy.sh`, `infra/backup/`.

- [ ] **Step 2: Verify Mermaid renders**

Run: `cd kapwa-server && npx -y @mermaid-js/mermaid-cli -i ../docs/diagrams/09-deployment-diagram.md -o /tmp/diag9.svg`
Expected: exits 0 (or manual fallback).

- [ ] **Step 3: Commit**

```bash
git add docs/diagrams/09-deployment-diagram.md
git commit -m "docs: deployment diagram for the production droplet topology"
```

---

### Task 10: `10-program-specification.md` — Program Specification

**Files:**
- Create: `docs/diagrams/10-program-specification.md`

**Sources:** `app.module.ts` (26 modules), each module's controller+service (`kapwa-server/src/<module>/*.controller.ts`, `*.service.ts`), `routes.tsx` + pages (client side), `EVALUATION.MD` §4.3.

**Functional spec focus:** for every program (module) — its purpose, inputs, processing rules, outputs, and the endpoints/pages that realize it. This is the thesis "Program Specification" chapter material.

- [ ] **Step 1: Create the document (standard template)**

1. **Purpose:** one program specification per module (server) + the client shell, in a uniform template, so each program's functional behavior is fully specified.
2. **Program Specification table template** (one per module):

```markdown
### P-xx: <Module Name> (<Module>Module)
- **Purpose:** <2-3 sentences>
- **Functional Requirements:**
  | ID | Requirement |
  |----|-------------|
  | FR-xx-yy | <requirement> |
- **Inputs:** <data the module consumes — DTOs, params, upstream events>
- **Processing:** <key business rules, guards, FSM transitions, validations>
- **Outputs:** <responses, created records, notifications, exports>
- **Endpoints:** `METHOD /api/v1/<path>` — <one-line purpose> (list all from the controller)
- **Client surfaces:** <pages/routes that consume it>
- **Dependencies:** <modules it imports>
```

3. **Coverage:** write one such section for each of the 26 modules: Auth, Sync, Cases, Programs, Beneficiaries, Notifications, Irf, Dashboard, Chat, Csr, Audit, Export, Filing, Users, AccessCards, CaseInterventions, Lcr, Sla, Otp, Minio, Intake, Referrals, Announcements, Agencies, InterAgencyReferrals, AgencyPortal. Then one section for the Client Shell (routing, auth context, SWR config, Topbar/Sidebar/BottomNav, offline queue, theme).
4. **Functional Specification:** keep the per-module FR tables tight (3-6 rows each; ~100 rows total across modules). Ensure the FR ids are prefixed per module (`FR-AUTH-01`, `FR-CASE-01`, `FR-SYNC-01`, ...) and cross-referenced in the other diagram docs where relevant (each other doc may reference `10-program-specification.md#p-xx`).
5. **Mermaid:** no diagrams required; replace section 3 with "## 3. Module Dependency Overview" — a single `flowchart LR` where each module is a node and edges are module imports (from `app.module.ts` imports + service constructor injections), grouped by domain subgraphs. This gives the thesis its "program structure" figure.
6. **Diagram Narrative:** describe the dependency graph: which modules are leaves (Lcr, Sla, Otp, Minio), which are hubs (Cases, Beneficiaries, Notifications, Sync), and how the client shell depends on all page groups.
7. **Cross-References:** per module: controller/service/entity paths; `app.module.ts`.

- [ ] **Step 2: Verify Mermaid renders**

Run: `cd kapwa-server && npx -y @mermaid-js/mermaid-cli -i ../docs/diagrams/10-program-specification.md -o /tmp/diag10.svg`
Expected: exits 0 (or manual fallback).

- [ ] **Step 3: Commit**

```bash
git add docs/diagrams/10-program-specification.md
git commit -m "docs: program specifications for all 26 modules and the client shell"
```

---

## Self-Review

**Spec coverage vs the requested diagram list:**
- Operational Feasibility (Ishikawa) → Task 1 ✓
- Use Case Diagram → Task 2 ✓
- Sequence Diagram → Task 3 ✓
- Activity Diagram → Task 4 ✓
- Output and User Interface → Task 5 ✓
- ERD → Task 6 ✓
- Data Dictionary → Task 7 ✓
- System Architecture → Task 8 ✓
- Deployment Diagram → Task 9 ✓
- Program Specification → Task 10 ✓

**Functional-spec focus:** every task mandates an FR table as the primary section; the Mermaid diagram is the illustration. FR ids are prefixed per doc (FR-xx) and per module in Task 10 (FR-AUTH-01 ...), with cross-references between docs (e.g. ERD ↔ Data Dictionary, Program Spec ↔ all others).

**Placeholder scan:** no TBD/TODO steps — every step names the exact file, the section contents, the FR rows to include (with example text), the mermaid kind, and the exact verify/commit commands. Task 7 is explicitly a table-document with a Conventions section instead of a diagram (its "diagram" is the dictionary itself); Task 10 replaces the diagram section with the module dependency graph — both deviations are stated in the task.

**Consistency:** canonical actor/role names, the 26-module list, and the 29-table list are pinned in Global Constraints and must be used verbatim; reviewer spot-checks name consistency across the 10 files. Task 6 and Task 7 are mutually referential — Task 7 must reproduce Task 6's entity/relationship names.

**Execution note for Task 7:** DB-SCHEMA.md is authoritative for columns; if an entity adds a column not in DB-SCHEMA.md, add it flagged with a note rather than silently dropping it.

**Task ordering:** Tasks 1-5 and 8-9 are independent; Task 6 (ERD) and Task 7 (Data Dictionary) should run in either order but MUST be consistent (7 depends on 6's entity names; run 6 then 7 for a clean dependency chain). Task 10 is last because other docs reference it.
