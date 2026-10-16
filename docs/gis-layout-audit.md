# GIS layout audit — current render vs physical DSWD FO3-07-011 (REV 01)

**Method:** geometry ledger of the current render (`pdftotext -bbox` on
`pdf/outputs/04-general-intake-sheet.pdf`, saved at `/tmp/opencode/gis-ledger.txt`),
the builder source (`kapwa-server/src/gis/gis-pdf.builder.ts`), and the approved
design spec `docs/superpowers/specs/2026-09-04-gis-pdf-design.md` (written against
the scanned physical form).

Status legend:
- **CONFIRMED** — differs from the approved spec / standard form with objective evidence.
- **VERIFY** — needs eyes on the physical copy (this session's model cannot view images).

## Implementation status (2026-09-25)

| Item | Status | Proof |
|---|---|---|
| C1 beneficiary/representative row 4 | **DONE** | `gis-pdf.builder.ts` L221-226 + call sites L237-241. Renders `Lugar ng Kapanganakan` (value `Norzagaray`), `Kalagayan ng Kalusugan` (blank), `Unang Bisita` (value `09/01/2026` = `case.createdAt`), `Time Start` (blank) in BOTH blocks. |
| C2 MSWDO footer line | **DONE** | `FOOTER_TEXT_2` (L39) + second footer line drawn at y=765. Wording is a placeholder until read off the physical copy. |
| C3 category sub-header captions | **PENDING** | Blocked on exact `Nakasaad sa … / Sama-Samang …` wording from the paper. Not invented. |

Verification: `npm run typecheck` clean · `npx jest gis-pdf.builder` 2/2 pass · regenerated
PDF 1 page A4, 88,901 B · `pdftotext -bbox` collision check **0 collisions / 0 off-page words**.

---

## Confirmed deviations (missing vs approved spec, which replicates the scanned form)

### C1. Beneficiary block is missing 4 fields the spec requires
Spec §3 lists: phone, age, sex, civil status, occupation, monthly income, birthdate,
**place of birth, health status, `Unang Bisita` date, `Time Start`**.

Current `personBlock` row 3 (`gis-pdf.builder.ts` L204–212) draws only:
`Numero ng Telepono | Kapanganakan (Birthdate) | Edad | Kasarian | Civil Status |
Trabaho | Buwanang Kita`.

Missing (data available in `GisPdfData`):
- **Lugar ng Kapanganakan (Place of Birth)** — `p.placeOfBirth` exists in `GisPdfData` and is populated by the loader.
- **Kalagayan ng Kalusugan (Health Status)** — draw blank (not captured anywhere).
- **Unang Bisita (First Visit)** — per spec mapping, `= case createdAt`. `createdAt` is in `GisPdfData`.
- **Time Start** — draw blank (spec data mapping: "time start/end blank").

Affects both blocks (beneficiary + representative). Suggested shape — a 4th row
(+19 pt per block = +38 pt total; fits: footer currently ends ~y=722, page bottom margin 823.89):

```
cells(y, 19, [
  { frac: 0.26, label: 'Lugar ng Kapanganakan (Place of Birth)', value: p.placeOfBirth ?? '' },
  { frac: 0.26, label: 'Kalagayan ng Kalusugan (Health Status)', value: '' },
  { frac: 0.24, label: 'Unang Bisita (First Visit)', value: fmtDate(data.createdAt) }, // beneficiary only
  { frac: 0.24, label: 'Time Start', value: '' },
]);
```

Note: `Unang Bisita` belongs to the beneficiary block only; the representative
block keeps `Relasyon sa Benepisyaryo | Time End` as its last row.

### C2. Footer missing the MSWDO contact line
Spec §10: footer = "DSWD F.O. III address line **+ MSWDO contact line**".

Current `FOOTER_TEXT` (`gis-pdf.builder.ts` L34–36) has only the DSWD FO3 address.
Ledger row y=722 confirms. Add a second centered line, e.g.
`Municipal Social Welfare and Development Office – Norzagaray, Bulacan` (confirm exact
line from the physical copy).

### C3. Beneficiary Category box missing left-column sub-headers
Spec §5: left column = "Target Sector / **Nakasaad sa … / Sama-Samang …**" with
sub-category checkboxes. Current (`gis-pdf.builder.ts` L243–245) prints only
`Target Sector` and `Specify Sub-Category`. The two additional sub-header lines are
absent (ledger rows y=269–279 show only Target Sector / Specify Sub-Category).
VERIFY exact wording of the two sub-headers on the paper before adding.

---

## VERIFY — check against the physical copy

| # | Item | Current (ledger/source) | Question for the paper |
|---|---|---|---|
| V1 | Form revision | `DSWD PMB-FO3-07-011 | REV 01 / 30 SEPT 2022` (L15) | Your copy REV 01, or REV 02 `08 JAN 2024` (`PMB-GF-011`, header "SWAD BATAAN OFFICE")? Builder targets REV 01. |
| V2 | Time Start placement | ID strip row (y=78, L162) | Spec §3 puts Time Start in the beneficiary block; §2 in the ID strip. Which does the paper have? |
| V3 | Assistance Rendered columns | 4 cols: `No. | Provided | Amount | Fund Source` (L329–334, header y=564) | Spec §8 lists 3 (Provided/Amount/Fund Source). Does the paper have a No. column? |
| V4 | QN / PCN box widths | QN 46 pt (16.2 mm), PCN 150 pt (52.9 mm) (L158–160) | Measure on paper. |
| V5 | Header masthead | No "REPUBLIC OF THE PHILIPPINES / DEPARTMENT OF SOCIAL WELFARE AND DEVELOPMENT" lines; only right-aligned `PROTECTIVE SERVICES DIVISION / FIELD OFFICE III` (L142–144) | Does the paper carry republic/DSWD masthead lines under/near the seal? |
| V6 | Family Composition rows | fixed 3 data rows + empty rows up to 3 (L289–300) | How many blank rows on the paper? |
| V7 | Needs-assessment items | Financial(5), Material(6), Psychosocial(2), Referral(1) (L308–313) | Item lists match the paper exactly? |
| V8 | Sub-category list | Solo Parents … Others (8 items) (L250–254); "Others:" has no write-in blank | Paper order/wording; do the tick boxes need a trailing blank line after `Others:`? |
| V9 | Signature block | 3 slots: declaration+thumbmark / Interviewed by (worker name) / Approving Authority (name+role+lic) (L362–407); captions below `Buong Pangalan at Pirma | Social Worker | Approving Authority` (y=709) | Does the paper also have a `Date` line and `Prepared by` / `Noted by` structure? |
| V10 | Label spellings | e.g. `Buwanang Kita (Monthly Salary)`, `Trabaho (Occupation)` (L210–211) | Match paper's exact captions (e.g. "Occupation/Okupasyon")? |

---

## Next step

Approve C1–C3 (and answer V1–V2) → implement as exact edits in
`gis-pdf.builder.ts`, re-render via the viewer (:8971, "GIS export" preset),
re-run the `pdftotext -bbox` collision/ledger check, and regenerate
`pdf/outputs/04-general-intake-sheet.{pdf,png}`.