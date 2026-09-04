# GIS (General Intake Sheet) PDF After Case Assignment — Design

**Date:** 2026-09-04
**Status:** Approved by user (trigger: after case assignment; fidelity: exact replication incl. DSWD logo)
**Scope:** kapwa-server (PDF generation + endpoint) + kapwa-client (Download button on CaseViewPage)

## Goal

After completing intake, the system produces a PDF that replicates the DSWD General Intake Sheet
(DSWD PMB-FO3-07-011 | REV 01 / 30 SEPT 2022) exactly, with fields populated from the created case.

## Approach

PDFKit server-side (recommended, adopted): mirrors the existing `:id/csr-pdf` / IRF export pattern —
no new dependencies, A4 layout fully controlled, unit-testable in Jest with no DB.

Rejected alternatives:
- Playwright HTML→PDF in-server: requires browser binaries in the server image; heavy for a single form.
- Client-side jsPDF: font/checkbox fidelity and A4 form-grid replication are inferior.

## Architecture

### Server

1. New module `kapwa-server/src/gis/`:
   - `gis-export.service.ts` — `GisExportService.generateGisPdf(caseId: string): Promise<Buffer>`
   - `gis-export.service.spec.ts` — Jest spec, no DB (data injected via a small loader)
   - `gis-export.loader.ts` (or service-internal loader) — loads case + relations
     (`caseRepo.findOne({ where: { id }, relations: [...] })`) and maps to a plain
     `GisPdfData` shape consumed by the PDF builder.
   - `gis.module.ts` + register in `app.module.ts` (check current module registration pattern).
   - `assets/DSWD-Logo.png` — committed logo asset (already present at
     `kapwa-server/src/gis/assets/DSWD-Logo.png`, 1280x720 PNG).

2. Endpoint: `GET /cases/:id/gis-pdf` in `cases.controller.ts` mirroring `:id/csr-pdf`
   (Content-Type `application/pdf`, `Content-Disposition: attachment; filename="GIS-<controlNo>.pdf"`),
   roles `admin`, `social_worker`. 404 when case not found. Audit warning log pattern as in
   `cases-export.service.ts` / `export.service.ts`.

### Client

- `kapwa-client/src/pages/CaseViewPage.tsx` — add "Download GIS (PDF)" button in the existing
  actions area, using the same blob-download helper pattern as the CSR PDF download.
- Locale keys added to both `en` and `fil` (`caseView.downloadGisPdf` etc.).
- Test: assert button renders and triggers download route (mirror CSR PDF test).

## PDF layout (exact replication, A4)

Ordered sections, matching the scanned form:

1. Header: DSWD logo image (left, ~34pt), right-aligned bold block "PROTECTIVE SERVICES DIVISION /
   FIELD OFFICE III", thin gray bar, form number + REV line; centered red banner
   "MAARING MAGPATULONG SUMAGOT SA DSWD PERSONNEL" (red-filled bar, white text).
2. ID strip: QN | PCN boxes, `Time Start` box, Date/Year boxes with filled values; checkbox row
   `☐ New ☐ Returning ☐ On-Site ☐ Walk-in ☐ Referral ☐ Off-Site`.
3. Beneficiary block (gray header "IMPORMASYON NG BENEPISYARYO / Beneficiary's Identifying Information"):
   two-column bordered field boxes: name (Apelyido/Unang/Gitnang/Ext.), address (House No./Street/Purok,
   Barangay, City/Municipality, Province/District, Region), phone, age, sex, civil status, occupation,
   monthly income, birthdate, place of birth, health status, `Unang Bisita` date, `Time Start`.
4. Representative block ("IMPORMASYON NG KINATAWAN …"): same layout for the claimant +
   `Relasyon sa Benepisyaryo`, `Time End`.
5. Beneficiary Category cross-table: left "Target Sector / Nakasaad sa … / Sama-Samang …" with
   sub-category checkboxes; right "Social worker's Assessment" box with the verbatim fixed paragraph.
6. Family Composition ("KOMPOSISYON NG PAMILYA"): bordered table — Buong Pangalan | Relasyon sa
   Benepisyaryo | Edad | Trabaho | Buwanang kita — one row per family member.
7. Needs assessment grid: four checkbox columns (Financial Assistance / Material Assistance /
   Psychosocial Support / Referral) with their option lists.
8. Assistance table: Provided | Amount | Fund Source, numbered rows 1..3 (+ repeat if more).
9. Declaration paragraph verbatim; signature blocks: Interviewed by | Reviewed & Approved by,
   and "Social Worker / Signature over Printed Name / Buong Pangalan at Pirma" strips;
   Approving Authority right block.
10. Footer: DSWD F.O. III address line + MSWDO contact line, small centered.

Unpopulated fields are drawn empty (blank lines / unticked boxes) — never invented values.

## Data mapping

| GIS field | Source |
|---|---|
| QN / PCN | blank / `controlNo` |
| Date, Year | case creation date (`createdAt`), its year |
| New / Returning | intake `renewalOfCaseId` set → Returning, else New |
| On-Site / Referral | case has referral rows → Referral, else On-Site ticked |
| Beneficiary block | beneficiary person fields (names, sex, age/dob, civil status, occupation, monthly income, address fields, phone, place of birth); `Unang Bisita` = case `createdAt`; health status, time start/end blank |
| Representative block | claimant fields + `relationshipToBeneficiary` |
| Beneficiary category | `clientCategory` → sub-category tick; target-sector tick only if a sector value exists, else unticked |
| Family composition | `familyMembers` (name, relationship, age, occupation, income) |
| Needs assessment ticks | not captured → unticked |
| Provided / Amount / Fund Source | `case_interventions` rows (program name → Provided, amount, fund_source); numbered rows |
| Assessment + declaration | verbatim fixed form text |
| Interviewed by | `assignedWorker.fullName` (or blank) |
| Reviewed & Approved by | case approved-by name/role if present; Approving Authority block blank unless present |

## Error handling

- Case not found → `NotFoundException` (404).
- Intervention/program references missing (deleted program) → blank cells, never throw.
- Logo asset missing → warn + render text-only header (resilience, not error).

## Testing

- `gis-export.service.spec.ts`: inject `GisPdfData`, assert buffer starts with `%PDF`, contains
  controlNo, beneficiary surname, claimant name, family row names, verbatim assessment phrase,
  intervention row content; missing-data variant asserts blanks/no-crash.
- Controller: follow `cases.controller` spec conventions for the new `@Get(':id/gis-pdf')` route
  (roles guard, 404).
- Client: CaseViewPage button test + `fil` parity test entries for new keys.
- Verification: `npx jest --silent`, `npm run typecheck`, `npm run lint` (server);
  `npm run test:run`, `npm run typecheck` (client). All existing tests must stay green.

## Out of scope

- Capture of health status / time start-end / needs-assessment ticks / client signatures in intake.
- Editable PDF fields (no form widgets); static populated PDF only.
- Pre-assignment previews (intake review page).
