# Document Parity & Summary Report — Design

- **Date:** 2026-09-26
- **Status:** Draft for review
- **Path:** Architectural (design → spec → plan)
- **Topic:** Bring all generated case documents to layout/content parity with the official MSWDO references, and add the missing GAD Summary Report.

## 1. Context

`pdf-samples/` holds the authoritative references for every generated document:

| Reference | Pages | Paper |
|---|---|---|
| `Certificate-of-Eligibility.jpeg` | 1 | 21 × 7 cm strip |
| `Perry-Cash-Voucher.jpeg` (Petty Cash Voucher) | 1 | 21 × 14 cm strip |
| `IRF.jpeg` (Incident Report Form) | 1 | A4 |
| `General-Intake-Sheet.jpeg` | 1 | A4 |
| `ACCESS-CARD-COVER.jpeg` + `ACCESS-CARD-INNER.jpeg` | 2 | A4 (two panels per page) |
| ` SummaryReportP1-Aggregate.jpeg` | 1 | A4 landscape |
| `SummaryReportP2-AggregatePerQuarter.jpeg` | 1 | A4 landscape |
| `SummaryReportP3-GAD Database Case List.jpeg` | 1 | A4 landscape |

Five of these already have builders in `kapwa-server`; the three-page GAD **Summary Report** does not exist. The four near-complete forms have drifted from the references in labelled/section/letterhead ways.

**Goal:** every generated document reproduces its reference's panels, sections, labels, printed wording, and field placement. The GAD Summary Report is delivered as one 3-page PDF, with data derived from existing records.

**Non-goal:** reproducing scan artifacts (paper folds, shadows, smudges) or hand-written signatures.

## 2. Parity definition and acceptance criteria

"Parity" means:

1. Same page count and paper size as the reference.
2. Same panel/section structure and order.
3. Same printed labels, in the same language and case (e.g. `Assistive Device & Technologies`, `KOMPOSISYON NG PAMILYA`).
4. Same letterhead lines in the same order, with the same seals/logos.
5. Data-bearing cells are filled from the database; the surrounding rules/boxes match the reference geometry.

Automated acceptance (mirrors the existing harness in `pdf/outputs/README.md`):

- `pdftotext -bbox` word rectangles: no pair overlaps > 25% of the smaller rectangle.
- Every word rectangle lies inside its page box.
- Page count and page size assertions in unit specs.

## 3. Deliverables

### D1 — Certificate of Eligibility (`cases/case-documents.builder.ts`)

- Letterhead order: `Republic of the Philippines` → `Province of Bulacan` → `Municipality of Norzagaray` → `MUNICIPAL SOCIAL WELFARE AND DEVELOPMENT OFFICE` (upper-case, bold), then the horizontal rule.
- Centred DSWD seal, as in the reference.
- Body: label/value runs with rules sized to the reference blanks.
- Signatory block bottom-left: `Recommending Approval` → signatory name + `, RSW` → `MSWDO`.
- Right block: blank rule labelled `Interviewer- Designation`; the interviewer name prints above the rule.

### D2 — Petty Cash Voucher (`cases/case-documents.builder.ts`)

- Keep the current two-column form; tune row heights so the liquidation (Part II) block proportions match the reference.
- Align the right-column `No: / Date: / Responsibility Center:` value lines.
- Part II remains blank (completed only at liquidation), as today.

### D3 — Incident Report Form (`irf/irf-pdf.builder.ts`)

- Structure already matches. Remove the generated footer line (`… generated … | Legal basis: …`) that is not on the paper form.
- Keep the municipal seal (left), italic `Norzagaray,Bulacan`, centred title, DSWD logo (right).

### D4 — General Intake Sheet (`gis/gis-pdf.builder.ts`)

- Correct the form number to `DSWD-PMB-GF-011 | REV 01 / 30 SEPT 2022`.
- `MAARING MAGPATULONG SUMAGOT SA DSWD PERSONNEL` bar: dark grey (currently red).
- Remove the inserted `Needs Assessment` heading; the checkbox groups sit directly under family composition.
- Remove the second footer line (`Municipal Social Welfare and Development Office (MSWDO) …`); keep the DSWD Field Office III address line.
- Logo/letterhead: DSWD seal left, `PROTECTIVE SERVICES DIVISION / FIELD OFFICE III / <form number>` right.

### D5 — Family Access Card (`access-cards/access-card-pdf.builder.ts`)

Two A4 pages, each split into two panels; page order matches the reference (cover side first).

- **Page 1** — left: `CLIENT'S RECORD OF SERVICES AVAILED` table (`DATE`, `SERVICES RENDERED (Including Cost if any)`, `BY AGENCY`, `WORKER'S NAME & SIGNATURE`); right: client cover — photo box, municipal seal + DSWD logo, letterhead (`Republic of the Philippines / Province of Bulacan / Municipality of Norzagaray / MUNICIPAL SOCIAL WELFARE & DEVELOPMENT OFFICE`), `Code #`, `Barangay:`, `Contact #`, `CLIENT` (Surname / First Name / Middle Name on rules), `Gender:` MALE/FEMALE boxes, `Date of Birth:`, `Address:`, `FAMILY COMPOSITION` table (`Family Members`, `Relationship`, `Age`, `Status / Income`, ~8 rows), signature block (`Signature of Applicant or Thumbmark` + thumbmark box, `Name and Signature of Social Worker`, `Barangay Captain`), printed signatory names.
- **Page 2** — left: boxed `PAALALA AT GABAY` heading + the numbered guidance text; right: `CLIENT'S RECORD OF SERVICES AVAILED` table (continuation).

### D6 — GAD Summary Report (new)

See §5.

## 4. Summary Report — page structure

One A4 **landscape** PDF, three pages. `GET /reports/summary?year=YYYY&quarter=N`. Both query params are optional: `year` defaults to the current year, `quarter` defaults to the current quarter (see §5.4).

### 4.1 Page 1 — Annual aggregate

- Letterhead centred: `Republic of the Philippines / Province of Bulacan / Municipality of Norzagaray / MUNICIPAL SOCIAL WELFARE & DEVELOPMENT OFFICE / ACCOMPLISHMENT REPORT (Services) {year}`; municipal seal left, DSWD logo right.
- Centred titles: `SUMMARY REPORT {year}`, then `GAD DATABASE CASE TRACKER`.
- One table with a grouped header. The three header tiers are:

```
Tier 1:            SEX      | FINANCIAL | LEGAL  | TECHNICAL
Tier 2: MALE FEMALE | FINANCIAL ASSISTANCE | PWD | REFERRAL | <technical columns | TOTAL>
Tier 3:            | BURIAL MEDICAL ASSISTIVE DEVICES | | LEGAL/PAO OTHERS | <technical columns | TOTAL>
```

`MALE`/`FEMALE` span tiers 1–3; `PWD`, the technical columns, and `TOTAL` span tiers 2–3; the band/section cells span as shown.

Exact column order (all numeric cells are case counts):

1. `MALE` (sex)
2. `FEMALE` (sex)
3. `BURIAL` (under FINANCIAL → FINANCIAL ASSISTANCE)
4. `MEDICAL`
5. `ASSISTIVE DEVICES`
6. `PWD` (under the FINANCIAL band)
7. `LEGAL/PAO` (under LEGAL → REFERRAL)
8. `OTHERS` (legal referral)
9. `BIRTH DISCREPANCY` (under TECHNICAL)
10. `TRAVEL ASSESSMENT`
11. `CASE STUDY REPORT`
12. `COUNSELLING`
13. `PHILHEALTH`
14. `CHILD CUSTODY`
15. `HOME VISIT`
16. `BALIK PROBINSYA`
17. `OTHERS` (technical)
18. `TOTAL` (highlighted)

Bottom: `Prepared by:` (name + `MSWD - STAFF`) and `Noted by:` (name + `MSWD-HEAD`).

### 4.2 Page 2 — Quarterly report

- Letterhead shorter form: `Municipality of Norzagaray / MUNICIPAL SOCIAL WELFARE & DEVELOPMENT OFFICE / ACCOMPLISHMENT REPORT (Services) {year} / {Ordinal} QUARTER REPORT`.
- One table per month in the quarter, titled by its actual date span (e.g. `April 1-30, 2025`, `May 1-31, 2025`, `June 1-30, 2025`), each with the same columns as page 1.
- A final `{Ordinal} QUARTER SUMMARY` table (Q1 = Jan–Mar, Q2 = Apr–Jun, Q3 = Jul–Sep, Q4 = Oct–Dec).
- `Prepared by:` / `Noted by:` block.

### 4.3 Page 3 — GAD case list

- Title `GAD DATABASE CASE LIST`.
- Table header:

```
| No. | Date | NAME (SURNAME, FIRST NAME, MIDDLE NAME) | GENDER (M, F) | CLIENT CATEGORY (CEDC, WEDC, PWD, SR. CITIZEN, INDIGENT, 4Ps, IP) | Barangay | Intervention/Remarks |
```

- `Date` prints `MM-DD-YY`. Name is three columns (`SURNAME`, `FIRST NAME`, `MIDDLE NAME`). Gender is two tick columns (`M`, `F`). Client category is seven tick columns; a `/` marks each applicable category. `Intervention/Remarks` prints the derived code (see §5.3).

## 5. Summary Report — data

### 5.1 Sources

| Field | Source |
|---|---|
| Case date | `cases.created_at` |
| Sex | `beneficiaries` → `persons.gender` |
| Name | `persons.surname / first_name / middle_name` |
| Barangay | `person_addresses.barangay` |
| Client category | `cases.client_category` (+ age/sex rules) |
| Service | `case_interventions.service_name`, `case_interventions.category`, `programs.name`, `programs.category` |
| Referral | `case_referrals` / `inter_agency_referrals` |
| Amount, fund source | `case_interventions.amount / fund_source` |

### 5.2 Aggregate classification (pages 1–2)

A case contributes to **exactly one** category column, then is counted under its beneficiary's sex. This is required by the reference: `MALE + FEMALE = TOTAL = sum(category columns)`.

Classification precedence (first match wins), evaluated over the case's services/referrals/category:

1. `BURIAL` — service/program name or category matches `/burial/i`.
2. `MEDICAL` — `/medical|hospital|medicine/i`.
3. `ASSISTIVE DEVICES` — `/assistive|device|prosthes|wheelchair/i`.
4. `PWD` — `cases.client_category` = PWD (or `/pwd/i` in the service).
5. `BIRTH DISCREPANCY` — `/birth discrepancy/i`.
6. `TRAVEL ASSESSMENT` — `/travel/i`.
7. `CASE STUDY REPORT` — a CSR record exists, or `/case study|csr/i`.
8. `COUNSELLING` — `/counsel|psychosocial/i`.
9. `PHILHEALTH` — `/philhealth/i`.
10. `CHILD CUSTODY` — `/custody/i`.
11. `HOME VISIT` — a follow-up visit exists, or `/home visit|\bhv\b/i`.
12. `BALIK PROBINSYA` — `/balik probinsya/i`.
13. `LEGAL/PAO` — referral whose reason/agency matches `/legal|pao|public attorney/i`.
14. `OTHERS` (legal) — any other referral.
15. `OTHERS` (technical) — any remaining classified case.

The match patterns and their precedence live in one exported constant table (`SUMMARY_CATEGORY_RULES`) so they can be adjusted without touching layout code.

### 5.3 Case-list derivations (page 3)

- **Gender:** person sex → `M` or `F` tick.
- **Client category ticks** (multi-select; a `/` per match):
  - `CEDC` — age < 18.
  - `WEDC` — female and `client_category` in the women-at-risk set (e.g. WEDC / VAWC).
  - `PWD` — `client_category` = PWD.
  - `SR. CITIZEN` — age ≥ 60.
  - `INDIGENT` — `client_category` = indigent / `Barangay Certificate of Indigency` present.
  - `4Ps` — 4Ps program or `client_category` = 4Ps.
  - `IP` — `client_category` = IP / Indigenous People.
- **Intervention/Remarks code:** `FA` (financial), `C` (certification), `CSR` (case study report), `R` (referral), `H` (hospital/medical), `HV` (home visit), falling back to the classified category name.

### 5.4 Period logic

- `year` (default: current year) selects the `Jan 1 – Dec 31` window for page 1 and page 3.
- `quarter` (default: current quarter) selects three calendar months for page 2; month titles use the real month length so `February 1-28/29` is correct.
- All date filtering uses Asia/Manila boundaries.

### 5.5 Signatories (correction applied)

Signatory slots resolve from live users at generation time, not hard-coded constants:

- `Approved by` / `Noted by` / `Reviewed & Approved by` / `Recommending Approval` → the active **admin** user's full name (MSWDO Head).
- `Prepared by` / `MSWD-STAFF` / `Interviewed by` / `Social Worker` → an active **social_worker** user's full name.
- If no matching user exists (empty/first boot), fall back to the reference names so a document is still produced.

The fallback names and the role→slot mapping live in `common/constants.ts`.

## 6. Architecture

New NestJS module `kapwa-server/src/reports/`:

| File | Responsibility |
|---|---|
| `reports.module.ts` | Import `TypeOrmModule.forFeature([Case, CaseIntervention, Beneficiary, Person, PersonAddress, CaseReferral, Csr, User])`, `CommonModule`; register controller + services |
| `summary-report.service.ts` | Period resolution, aggregation query, classification, signatory resolution |
| `summary-report-pdf.builder.ts` | Pure `pdfkit` renderer for the three pages |
| `summary-report.types.ts` | `SummaryReportData`, row/cell types, `SUMMARY_CATEGORY_RULES` |
| `reports.controller.ts` | `GET /reports/summary` |
| `dto/summary-report.query.ts` | `year`/`quarter` validation (Zod, matching the codebase) |

Registered in `app.module.ts` after `ExportModule`.

**API:** `GET /reports/summary?year=2025&quarter=2` → `application/pdf`, `Content-Disposition: attachment; filename="summary-report-2025-Q2.pdf"`. Guarded by `AuthGuard('jwt')` + `RolesGuard`.

> **Assumption to confirm:** roles = `mayor`, `admin`, `social_worker`. The existing `GET /dashboard/reports/mayor` is `mayor`-only; the Summary Report is prepared by staff and noted by the head, so all three are proposed. If you prefer mayor-only, say so at spec review.

**Client:** add a `Export Summary Report` button (with year + quarter selects) to `MayorReportsPage.tsx`, reusing the download helper pattern in `ReportsExportButton.tsx` (`fetch` with bearer token → blob → object URL). Extend `client/lib/api.ts` with `downloadSummaryReport(year, quarter)`.

## 7. Testing and verification

- `summary-report-pdf.builder.spec.ts` — asserts 3 pages, A4 landscape size, each page's title/header strings, and that every numeric cell is present. Uses fixture data matching the reference shape.
- `summary-report.service.spec.ts` — mocked repositories: classification precedence, one-category-per-case invariant (`MALE + FEMALE = TOTAL = Σ categories`), quarter month windows (incl. February), signatory role resolution + fallback.
- `reports.controller.spec.ts` — role guard, query validation, content type, filename.
- `gis-pdf.builder.spec.ts` / `irf-pdf.builder.spec.ts` / `case-documents.builder.spec.ts` / `access-card-pdf.builder.spec.ts` — update expected form number, remove footer assertions, assert page/panel changes.
- Client: extend `MayorReportsPage.test.tsx` for the new button.
- Regenerate `pdf/outputs/` for all six deliverables (including `14-summary-report-{p1,p2,p3}.pdf/png`), re-run the bbox overlap/off-page checks, and refresh the inventory table in `pdf/outputs/README.md`.
- Gate: `cd kapwa-server && npm run typecheck && npx jest --silent`; `cd kapwa-client && npm run typecheck && npm run test:run`.

## 8. Schema and DB bootstrap

No schema change. The mapping derives every Summary Report field from existing tables, so neither a new TypeORM migration nor an edit to `src/database/migrate.ts` is required.

## 9. Out of scope

- CSR bundle, Certificate of Referral, and generic export service (no reference supplied).
- Hand-written signature images.
- Any change to CSV/XLSX exports.

## 10. Risks and assumptions

- **Scan ambiguity.** The references are photographs; fine geometry is approximated where the scan is unreadable (e.g. exact row heights). Parity is judged on section/label/field structure, not pixel diffing.
- **Derived categories may not match real-world tagging.** The precedence table is the documented contract; if staff disagree with a column, only `SUMMARY_CATEGORY_RULES` changes.
- **Reference names** (`ARLYNDA F. GAMUTIA`, `ANNALYN JOY C. SAN PEDRO`) are fallbacks only; live users take precedence.
