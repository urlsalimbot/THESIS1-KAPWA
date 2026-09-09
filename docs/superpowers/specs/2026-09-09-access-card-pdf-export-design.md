# Access Card PDF Export Design

Date: 2026-09-09
Status: Approved (design v2)

## Problem

The Family Access Card form (physical, MSWDO Norzagaray) has a back side that tracks the
client's record of services availed (Date / Services Rendered (Including Cost if any) /
By Agency / Worker's Name & Signature) plus a PAALALA AT GABAY leaflet. No digital export
exists. The GIS (General Intake Sheet) export ships for cases (`GET /cases/:id/gis-pdf`);
the access card module has no equivalent.

## Goal

Provide a PDF export of the Family Access Card form from the Access Card view page,
populated with live data, mirroring the GIS export pattern (server pdfkit builder +
GET endpoint + client download button).

## User-Corrected Layout (authoritative)

The form is a two-page sheet, in this order:

**Page 1 — Start of services record:**
- Left: **PAALALA AT GABAY** (static leaflet text)
- Right: **CLIENT'S RECORD OF SERVICES AVAILED** table — rows from `access_card_services`
  (Date, Services Rendered, By Agency, Worker's Name & Signature)

**Page 2 — Continuation + client info:**
- Left: continuation of the services table (remaining rows / blank rows)
- Right: header (Republic of the Philippines / Province of Bulacan / Municipality of
  Norzagaray / MSWDO) + Code# (= access card code) + Barangay + Contact#,
  Client section (Surname / First Name / Middle Name, Gender M/F checkbox, Date of Birth,
  Address), **FAMILY COMPOSITION** table (Family Members / Relationship / Age /
  Status-Income) from `getFamilyGraph`, signature blocks (Applicant or Thumbmark,
  Barangay Captain, Municipal Mayor, Name and Signature of Social Worker)

## Server

### New files

- `src/access-cards/access-card-pdf.builder.ts` — pdfkit builder, mirrors
  `src/gis/gis-pdf.builder.ts` pattern (A4, 2 pages, exact table geometry).
- `src/access-cards/access-card-pdf.types.ts` — data types for the builder
  (client, family members, services rows).

### Endpoint

`GET /access-cards/beneficiary/:id/gis-pdf` in `AccessCardsController`:
- Roles: `admin`, `social_worker`, `coordinator`
- Resolves beneficiary → access card code (`findBeneficiaryCard`), person data,
  family graph (via beneficiaries service or direct query), `access_card_services` log.
- Response: `application/pdf`, `Content-Disposition: attachment; filename="<code>-access-card.pdf"`.

### Service

New `generateAccessCardPdf(beneficiaryId)` method (or a dedicated service) composing
builder input from:
- `AccessCardsService.findBeneficiaryCard` — code, person surname/firstName, services
- Family graph — reuse `getFamilyGraph` logic (household memberships join persons)
- Person — surname, firstName, middleName, gender, dob, address (current)

## Client

### New helper

`downloadAccessCardPdf(beneficiaryId)` in `src/lib/api.ts` — mirrors `downloadGisPdf`:
fetch with Bearer token → blob → `a[download]` → `"<code>-access-card.pdf"`.

### Button

"GIS (PDF)" button on `AccessCardViewPage` toolbar (next to Print Card), visible for
admin/social_worker/coordinator roles.

## Tests

- Builder spec: `src/access-cards/access-card-pdf.builder.spec.ts` — 2 pages, A4,
  table rows populated, paalala text present.
- Service spec: endpoint returns 200 + `application/pdf` + attachment filename.
- Client: `AccessCardViewPage.test.tsx` — button renders, click fires
  `downloadAccessCardPdf`.

## Non-goals

- No changes to existing GIS case export.
- No changes to access card data model.
- No blank-template mode.
