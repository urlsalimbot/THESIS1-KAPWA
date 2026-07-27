# CSR Generation from Case View — Design Document

**Status:** Brainstorming / Incomplete
**Date:** 2026-07-21
**Issue:** Insufficient business process data to finalize design.

## Goal

Add a "Generate CSR" button on the case detail page (`/cases/:id`) that navigates to the CSR create form with case data pre-filled.

## Pre-fill Mapping (Agreed)

| CSR Field | Source | Editable? |
|---|---|---|
| `caseId` | URL param `?caseId=` | Hidden (submitted but not shown) |
| `socialWorkerName` | Case's assigned worker (from `assignedWorkerId`) | Locked |
| `socialWorkerPosition` | Assigned worker's position | Locked |
| `referralOrigin` | From case data | Locked |
| `problemPresented` | Case's `problemsPresented` field | Locked |
| `assessmentAnalysis` | Case's `socialWorkerAssessment` field | Locked |
| `closedDate` | Derived from CaseHistory (`toStatus = 'closed'`) | Locked |
| `reviewerName` | Current user (person creating the CSR) | Editable |
| `reviewerPosition` | Current user's position | Editable |
| `reasonForReferral` | — | Editable |
| `familyBackground` | — | Editable |
| `socioEconomicProfile` | — | Editable |
| `recommendation` | — | Editable |
| `interventionPlan` | — | Editable |
| `finalized` | — | Editable |

## PDF Template Impact

- Section I (Case Reference) — add `Date Closed`
- "Prepared by" → `socialWorkerName` / `socialWorkerPosition` (assigned worker)
- "Noted by" → `reviewerName` / `reviewerPosition` (current user)

## Backend Changes (Tentative)

- Add `reviewer_name`, `reviewer_position`, `closed_date` columns to `CsrRecord` entity
- Update `createCsrSchema` / `updateCsrSchema` Zod DTOs
- Update PDF generator to render reviewer and closed date

## Frontend Changes (Tentative)

- **CaseViewPage**: "Generate CSR" button → `/csr/new?caseId=<uuid>`
- **CreateCsrPage**: Read `caseId` from search params, fetch case detail + history, pre-fill locked fields, show beneficiary reference card, add reviewer fields

## Gap

Business process around CSR workflows (who reviews, sign-off flow, when CSR is created relative to case lifecycle) is not yet fully understood. Design may need revision once more context is gathered.
