# Case lifecycle — 5-step enforcement design

Date: 2026-09-21
Status: proposed (pending review)

## Goal

Make the MSWDO case lifecycle follow the five operational steps below and have
the system enforce each step's gate, instead of relying on the stepper UI alone.
The Case Study Report becomes a merged PDF bundle of the case's own documents.

## The five steps

| # | Step | Advances when | Status today |
|---|------|---------------|--------------|
| 1 | Assess and interview | `problemsPresented` + `socialWorkerAssessment` + `clientCategory`; FRVA/SWDI score required to leave the step | `enrolled` → `assessed` |
| 2 | Select intervention; client documentary needs; PCV & COE release | ≥1 intervention logged **and** every required document of the linked program(s) filed (remote client upload or on-site pass); admin approval; then **manual** Issue COE / Issue PCV | `assessed` → `in_review` → `active` |
| 3 | Determine need for inter-agency referrals (yes/no) | a referral is issued **or** "no referral needed" is recorded | `active` → `transitioning` |
| 4 | Evaluate help given | self-reliance assessment recorded (`selfRelianceLevel` + `sustainabilityPlan`); the level decides the recommendation: self-sufficient → Closure, not self-sufficient → subject to renewal | `active`/`transitioning` |
| 5 | Evaluate case study | closure form completed; CSR (merged bundle) available | → `closed` |

No status enum change and no new case columns. Step 4 uses the existing
self-reliance assessment as its guide.

## Changes

### 1. Stepper labels

`CaseStepper` step labels/descriptions become the operational wording:

1. Assess & Interview — "Interview, FRVA/SWDI"
2. Intervention & Requirements — "Select intervention; client documents; COE/PCV release"
3. Inter-agency Referrals — "Referral needed: yes or no"
4. Evaluate Help Given — "Self-reliance assessment"
5. Case Study & Closure — "Evaluate case study; close"

Phase grouping stays (Phase-In / Implementation / Phase-Out). i18n keys under
`caseView.stepper.*` updated in `en` and `fil`; `fil-parity` allowed-identical
list checked.

`stepperStepDone` gates stay as-is; the new enforcement lives server-side so a
client cannot bypass it:
- step 2 (index 1): intervention logged + program required documents filed.
- step 3 (index 2): referral issued or `referralNotNeeded` recorded.
- step 4 (index 3): `selfRelianceLevel` + `sustainabilityPlan` recorded.

### 2. Step 2 — documentary gate + manual COE/PCV release

**Server enforcement (new).** `CasesService.approve` (in_review → active) must
reject when the linked programmes' required documents are incomplete:

- Load the case's interventions → distinct `programId`s → each program's
  `requiredDocuments` (string keys).
- Load filed documents for the case and treat a requirement key as satisfied when
  a filing row exists with that `requirementKey`.
- No required documents configured → pass (do not block).
- Failure: `400` with the missing keys, mirroring the client helper
  `interventionRequirementsMet` (`kapwa-client/src/lib/case-progress.ts`).

**Remove auto-generation.** Delete the `transition(ACTIVE)` → `generateApprovalDocuments`
call in `CasesService.transition`. COE and PCV are no longer produced by approval.

**Manual release (new).**
- `CasesExportService.generateApprovalDocuments` splits into
  `buildCertificateOfEligibility`-based `issueCoe(caseId, actorId)` and
  `issuePcv(caseId, actorId)` (or one method with a `type` argument).
- Endpoints: `POST /cases/:id/issue-coe`, `POST /cases/:id/issue-pcv`
  (`@Roles('admin')`). Allowed when status is `active`, `transitioning`, or
  `closed` and the documents gate is met.
- Idempotent: if `certificateUrl` / `pettyCashVoucherUrl` already set, return it
  without re-filing.
- CaseViewPage shows **Issue COE** / **Issue PCV** buttons to admins while the
  respective URL is empty; once issued, the existing "Generated Documents"
  links/panels render.

### 3. Step 3 — referral decision enforcement

`validateTransition(active → transitioning)` additionally requires
`referrals.length > 0 || referralNotNeeded`, so the referral yes/no decision
cannot be skipped.

### 4. Step 4 — self-reliance evaluation (no new fields)

- No schema change. `selfRelianceLevel` (1–5) + `sustainabilityPlan` remain the
  recorded guide.
- New client constant `SELF_RELIANCE_SUFFICIENT_MIN_LEVEL = 3`. Step 4 renders
  the recorded level and a derived recommendation:
  - `level >= 3` → "Self-sufficient — proceed to Closure" (links to step 5).
  - `level < 3` → "Not self-sufficient — subject to case renewal" with the
    existing **Renew Case** action surfaced.
- Both actions stay available; the level is a guide, not a hard block. No
  automatic renewal-case creation.

### 5. Step 5 — CSR merged PDF bundle

- Add `pdf-lib` (pure JS) to `kapwa-server` for merging.
- `GET /cases/:id/csr-pdf` (and `GET /cases/csr/:controlNo/pdf`) returns one PDF:
  - cover page (case no., beneficiary, service, dates)
  - Petty Cash Voucher (built on demand, not read from filing)
  - Certificate of Eligibility (built on demand)
  - IRF (only when the case has a linked IRF; rendered **unencrypted** for the
    bundle — the standalone `GET /irf/:id/export-pdf` keeps its password)
  - GIS (via `GisExportService`)
- Filename unchanged: `CSR <controlNo>-<YYYY>-<MM>-<DD>.pdf` (doc §12).
- Removes the long-form CSR narrative from the case CSR export. The `csr`
  module's own records/endpoints are out of scope.

## Schema / migrations

None. No new columns, so no TypeORM migration and no `migrate.ts` change.

## Testing

- Server unit specs: approve rejects on missing required docs; passes when none
  configured; `issue-coe` / `issue-pcv` set URLs once and are idempotent; CSR
  bundle returns a valid PDF containing all sections; step-3 transition gate.
- Client unit tests: stepper labels/gates; Issue COE/PCV button visibility;
  step-4 recommendation wording at levels 2 and 3.
- Existing suites: server `npx jest --silent`, client `npm run test:run`, both
  typechecks.
- Browser audit re-run: lifecycle `enrolled → … → closed` with manual COE/PCV
  issuance, CSR bundle download, filename check.

## Out of scope

- New statuses or FSM rework.
- Automatic renewal-case creation (Renew Case stays manual).
- Client-side (remote) upload UX changes — the existing requirement uploader is
  the "remote or on-site" channel.
- The standalone `csr` module's narrative records.

## Open decision (already resolved by review)

- Step 4 flagging uses the self-reliance assessment, not new columns.
