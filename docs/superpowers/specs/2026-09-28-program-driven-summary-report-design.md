# Program-Driven Summary Report — Design

- **Date:** 2026-09-28
- **Status:** Draft for approval (no code yet)
- **Decision:** Option A — seed the missing programs, derive the summary-report columns from the `programs` table and the cases that have them.

## 1. Goal

The GAD Summary Report's columns become **program-backed**: every column is a program (or program group), counts = distinct cases linked to that program via `case_interventions.program_id`, still split MALE/FEMALE with the reference invariant `TOTAL = MALE + FEMALE = Σ columns`. Where a case has no program (referral-only, CSR/visit-only, ad-hoc), explicit buckets keep it countable.

## 2. What stays the same

- 3-page structure (annual table / quarterly tables / case list), A4 landscape, grouped header bands.
- Period math (Asia/Manila), signatory roles, client button, endpoint.
- Case-list **recency precedence** (latest addition wins) implemented this week.
- The no-intervention / no-referral case rules implemented this week.

## 3. New program seeds (~10)

Added to `seed-programs.ts` (idempotent `WHERE NOT EXISTS`), each with `fundSources` and `legalBasis`:

| Program name | category | fund sources | legal basis |
|---|---|---|---|
| Assistive Device Support | PWD Welfare | LGU - Municipal, DSWD | RA 7277, RA 10754 |
| Legal Referral (PAO) | Social Services | LGU - Municipal | RA 9999 (PAO Act) |
| Referral – Others | Social Services | LGU - Municipal | RA 7160 (LGC) |
| Birth Discrepancy Assistance | Civil Registration | LGU - Municipal, DSWD - AICS | RA 9048, RA 10172 |
| Case Study Report (CSR) | Social Services | LGU - Municipal | RA 9433 |
| Home Visit | Family Welfare | LGU - Municipal | RA 7160 (LGC) |
| PhilHealth Assistance | Medical | PhilHealth, LGU - Municipal | RA 11223 (UHC) |
| Child Custody Support | Family Welfare | LGU - Municipal, DSWD | RA 7610; Family Code |
| Balik Probinsya Assistance | Community Development | DSWD - BAS | EO 114 s. 2020 |
| Travel Assessment | Transportation | LGU - Municipal | RA 7160 (LGC) |

Existing programs already cover: BURIAL (Burial Assistance), MEDICAL (Medical Assistance, Medical Equipment Loan), PWD (PWD Assistance), COUNSELLING (Psychosocial Counseling), LEGAL (Referral & Linkage → Referral – Others / Legal Referral (PAO)), ASSISTIVE (Assistive Device Support, new).

## 4. Column model

Columns = **all active programs, ordered into the reference-style bands**, each program a column:

1. `SEX` band — MALE, FEMALE
2. `FINANCIAL` band — Burial, Medical, Assistive Device, PWD (sub-band `FINANCIAL ASSISTANCE` for the first three, per the reference)
3. `LEGAL` band — Referral & Linkage, Legal Referral (PAO), Referral – Others
4. `TECHNICAL` band — Birth Discrepancy, Travel Assessment, Case Study Report, Counseling, PhilHealth, Child Custody, Home Visit, Balik Probinsya
5. `OTHER PROGRAMS` band — the remaining active catalogue (Education, 4Ps, Food, Family/Senior Welfare, Livelihood, Disaster Response, KALAHI, Walang Gutom, UPLIFT, AICS, Solo Parent, Supplementary Feeding, Emergency Cash/Food, Community Development)
6. `UNASSIGNED` column — ad-hoc/unknown services, and cases with no program link
7. `TOTAL`

Program→band mapping lives in one exported constant (`SUMMARY_PROGRAM_BANDS`) keyed by program category/name, so admin CRUD changes are absorbed without layout churn (unmapped categories default to OTHER PROGRAMS).

## 5. Case → column counting (precedence contract)

Each case counts once, in this order:

1. **Program-linked intervention** — first intervention's program (order of `delivery_date`, then `created_at`); that program's band/column.
2. **Referral-only** — no program link but referrals exist → legal band columns (Legal Referral (PAO) if agency/reason matches PAO/legal, else Referral – Others).
3. **CSR/visit fallback** — no program link, no referral, but `csr_reports`/`case_follow_up_visits` exist → Case Study Report / Home Visit columns.
4. Otherwise → `UNASSIGNED`.

Sex from the person. The reference invariant holds by construction (exactly one column per case).

## 6. Backfill migration (`ZBackfillInterventionPrograms0000000000063`)

One-time data migration for existing DBs: for `case_interventions` with `program_id IS NULL`, match `service_name`/`category` (exact → first-token → `ILIKE`) against seed program names and backfill. Runs only on existing DBs via `migration:run`; fresh boots mark it applied (no historical data exists there). `seedPrograms` remains the canonical program source on both paths.

## 7. Case-list remark

Unchanged logic; the derived code maps from the case's program/band (FA for financial programs, CSR, HV, R for legal, C otherwise — program category drives the code in `recommendation-code` terms).

## 8. Files touched

- `src/database/seed-programs.ts` (10 new seeds)
- `src/database/migrations/ZBackfillInterventionPrograms0000000000063.ts` (new; data-only)
- `src/reports/summary-report.types.ts` (replace regex rules with `SUMMARY_PROGRAM_BANDS` + program precedence; keep `CategoryKey`-style keys)
- `src/reports/summary-report.service.ts` (SQL/classification)
- `src/reports/summary-report-pdf.builder.ts` (columns driven by band list; header from program names)
- Specs: `summary-report.types.spec.ts`, `summary-report.service.spec.ts` (band mapping, backfill-matching rules, invariant, unassigned bucket), `summary-report-pdf.builder.spec.ts` (labels)

## 9. Risks / decisions to confirm

- **Wide table:** 25+ program columns on landscape A4 (labels shrink-fitted; page may need larger font reduction on P1/P2 — acceptable).
- **Historical ad-hoc data** that matches no seed stays UNASSIGNED — visible, not lost.
- **Program names become report labels** — renaming a program renames its column (documented).
- Optional follow-up (separate decision): a `reportGroup` field on programs would remove the category heuristic for banding.

## 10. Gate

Server `npm run typecheck` + `npx jest --silent`; client `npm run typecheck` + `npm run test:run`; regenerate `pdf/outputs/14-summary-report.pdf`.