# Document Parity (Printed Forms) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the five existing PDF builders (Certificate of Eligibility, Petty Cash Voucher, Incident Report Form, General Intake Sheet, Family Access Card) to layout/label/content parity with the `pdf-samples/` references.

**Architecture:** Each builder is a pure `pdfkit` function that takes a typed data struct and returns a `Buffer`. This plan edits those functions in place, adds text-level assertions to their existing Jest specs (decoding FlateDecode + hex-encoded `<...>` text, as `access-card-pdf.builder.spec.ts` already does), and adds a committed render script so `pdf/outputs/` can be regenerated and audited.

**Tech Stack:** NestJS 11, TypeScript, `pdfkit` (base-14 Helvetica only), `pdf-lib` (test-time page inspection), Jest/ts-jest, `pdftoppm`/`pdftotext` for the sample audit.

**Spec:** `docs/superpowers/specs/2026-09-26-document-parity-and-summary-report-design.md`

## Global Constraints

- Base-14 fonts only (`Helvetica`, `Helvetica-Bold`, `Helvetica-Oblique`). Never embed a font; never use the peso glyph (`₱`) — money renders as plain numerals (see `cases/case-documents.builder.ts` header comment).
- Office name is never hard-coded: resolve via `OrgService.officeName()` at the call site and pass it into the builder. Static geography comes from `ORG_LOCATION` (`common/constants.ts`).
- Do not revert the uncommitted WIP in `gis/gis-pdf.builder.ts` beyond the specific lines this plan names. The pre-existing change added `FOOTER_TEXT_2`, a Place-of-Birth row, and `unangBisita`; only `FOOTER_TEXT_2` is removed here.
- Tests run with `npx jest <file>` from `kapwa-server/`. Do not use `npm test` (adds `--coverage`).
- Gate before every commit: `npm run typecheck` from `kapwa-server/`.
- Stage explicit paths; never `git add -A`.

## Review Focus

- **Missing optional data** (no interviewer, no amount, no family members, no services): every builder must still emit a valid, non-crashing PDF. Each existing spec already has a "blank fallbacks" case; preserve it.
- **Overlong values** (long beneficiary names, addresses, narration): values must wrap/clip inside their own cell and never collide with a neighbour. Keep the existing shrink-to-fit / `ellipsis: true` behaviour on every cell this plan touches.
- **Date rendering** across time zones: use the existing `fmtDate` / `longDate` helpers (Asia/Manila), never `toISOString().slice(0,10)` for display.
- **Page geometry changes**: changing letterhead offsets or page order must not push content off-page. Assert page count and size after each change.
- **Access Card page order** is a visible change: page 1 must be the client-cover side and page 2 the PAALALA side, matching the reference upload order.

---

### Task 1: Certificate of Eligibility parity

**Files:**
- Modify: `kapwa-server/src/cases/case-documents.builder.ts` (letterhead block, `buildCertificateOfEligibilityPdf`, ~lines 195–215)
- Test: `kapwa-server/src/cases/case-documents.builder.spec.ts`

**Interfaces:**
- Consumes: `ORG_LOCATION` from `../common/constants`; existing `line()` helper inside the builder.
- Produces: unchanged public signature `buildCertificateOfEligibilityPdf(data: CertificateOfEligibilityData): Promise<Buffer>`.

- [ ] **Step 1: Write the failing test**

Append to `case-documents.builder.spec.ts`. Add the `zlib` import at the top (`import * as zlib from 'zlib';`) and this helper after the imports:

```ts
function searchableText(buf: Buffer): string {
  const raw = buf.toString('latin1');
  const streams: string[] = [];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    try { streams.push(zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1')); } catch { /* not FlateDecode */ }
  }
  const hex = streams.join('\n').match(/<([0-9A-Fa-f]+)>/g) ?? [];
  return `${raw}\n${hex.map(h => Buffer.from(h.slice(1, -1), 'hex').toString('latin1')).join('')}`;
}
```

```ts
describe('Certificate of Eligibility letterhead parity', () => {
  it('prints the province and municipality lines in reference order', async () => {
    const text = searchableText(await buildCertificateOfEligibilityPdf(coeData));
    const republic = text.indexOf('Republic of the Philippines');
    const province = text.indexOf('Province of Bulacan');
    const municipality = text.indexOf('Municipality of Norzagaray');
    const office = text.indexOf('MUNICIPAL SOCIAL WELFARE AND DEVELOPMENT OFFICE');
    expect(republic).toBeGreaterThanOrEqual(0);
    expect(province).toBeGreaterThan(republic);
    expect(municipality).toBeGreaterThan(province);
    expect(office).toBeGreaterThan(municipality);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-server && npx jest case-documents -t "letterhead parity"`
Expected: FAIL — `Province of Bulacan` / `Municipality of Norzagaray` not found (current builder prints `Norzagaray, Bulacan` on one line).

- [ ] **Step 3: Write minimal implementation**

Add `import { ORG_LOCATION } from '../common/constants';` to `case-documents.builder.ts`. Replace the letterhead block:

```ts
  line('Republic of the Philippines', y, { size: 7 });
  line(data.officeName.toUpperCase(), y + 8, { size: 8.5, bold: true });
  line('Norzagaray, Bulacan', y + 17, { size: 7 });
  doc.moveTo(LEFT, y + 27).lineTo(RIGHT, y + 27).lineWidth(0.8).strokeColor('#111').stroke();

  // ---- Title ----
  line('CERTIFICATE OF ELIGIBILITY', y + 32, { size: 11, bold: true });
```

with:

```ts
  line('Republic of the Philippines', y, { size: 7 });
  line(`Province of ${ORG_LOCATION.province}`, y + 8, { size: 7 });
  line(`Municipality of ${ORG_LOCATION.municipality}`, y + 16, { size: 7 });
  line(data.officeName.toUpperCase(), y + 25, { size: 8.5, bold: true });
  doc.moveTo(LEFT, y + 35).lineTo(RIGHT, y + 35).lineWidth(0.8).strokeColor('#111').stroke();

  // ---- Title ----
  line('CERTIFICATE OF ELIGIBILITY', y + 40, { size: 11, bold: true });
```

Also move the body baseline down by 8 to clear the taller letterhead: change `drawRichParagraph(doc, spans, LEFT, y + 54, WIDTH, 7.5, 10.5);` to `y + 62`. Keep the interviewer and recommending-approval blocks anchored to `PAGE_H` (unchanged).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kapwa-server && npx jest case-documents`
Expected: PASS (including the existing page-size test; page height remains 198).

- [ ] **Step 5: Commit**

```bash
cd kapwa-server
git add src/cases/case-documents.builder.ts src/cases/case-documents.builder.spec.ts
git commit -m "fix(pdf): COE letterhead parity (province/municipality lines)"
```

---

### Task 2: Petty Cash Voucher parity (row proportions)

**Files:**
- Modify: `kapwa-server/src/cases/case-documents.builder.ts` (`H` constant inside `buildPettyCashVoucherPdf`, ~line 334)
- Test: `kapwa-server/src/cases/case-documents.builder.spec.ts`

**Interfaces:**
- Consumes: existing `H` map and `hline`/`vline`/`text` helpers.
- Produces: unchanged `buildPettyCashVoucherPdf`.

- [ ] **Step 1: Write the failing test**

```ts
describe('Petty Cash Voucher structure', () => {
  it('prints the reference section labels', async () => {
    const text = searchableText(await buildPettyCashVoucherPdf(pcvData));
    for (const label of [
      'PETTY CASH VOUCHER', 'Norzagaray, Bulacan', 'LGU',
      'Payee:', 'Address:', 'I. To be filled up upon request',
      'To payment of', 'Particular', 'Amount',
      'Approved by:', 'HON. MARIA ELENA L. GERMAR', 'MUNICIPAL MAYOR',
      'Paid by:', 'Disbursing Officer', 'Cash received by:',
      'Signature Over Printed Name of Payee',
    ]) {
      expect(text).toContain(label);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-server && npx jest case-documents -t "Petty Cash Voucher structure"`
Expected: PASS or FAIL — if PASS, the labels are already present; skip to Step 5 and commit nothing. The row-proportion tweak below is only applied if the rendered PNG (Task 6) shows the liquidation block visibly shorter than the reference.

- [ ] **Step 3: Apply the row-proportion tweak (only if Step 1 fails or Task 6 review flags it)**

Change the `H` map so the liquidation (right) column matches the reference's taller block:

```ts
  const H = { header: 46, payee: 20, address: 20, req: 16, thead: 15, tbody: 84, approved: 84, paid: 40, cash: 54 };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kapwa-server && npx jest case-documents`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd kapwa-server
git add src/cases/case-documents.builder.ts src/cases/case-documents.builder.spec.ts
git commit -m "fix(pdf): PCV row proportions and label parity"
```

---

### Task 3: Incident Report Form — remove generated footer

**Files:**
- Modify: `kapwa-server/src/irf/irf-pdf.builder.ts` (footer block, ~lines 380–386)
- Test: `kapwa-server/src/irf/irf-pdf.builder.spec.ts`

**Interfaces:**
- Consumes: `IrfPdfData` (unchanged).
- Produces: unchanged `buildIrfPdf`. `legalBasis` and `generatedAt` remain on the interface (callers still pass them) but are no longer printed.

- [ ] **Step 1: Write the failing test**

Add to `irf-pdf.builder.spec.ts` (reuse the `searchableText` helper — copy it in if the file does not already have one):

```ts
it('does not print a generated/legal-basis footer', async () => {
  const buf = await buildIrfPdf({
    blotterEntryNumber: 'BLT-2026-0001',
    caseCategory: 'Abuse',
    officeName: 'Municipal Social Welfare and Development Office',
    generatedAt: new Date('2026-09-23T07:34:00Z'),
    legalBasis: 'RA 9262',
  });
  const text = searchableText(buf);
  expect(text).not.toContain('Legal basis: RA 9262');
  expect(text).not.toContain('generated');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-server && npx jest irf-pdf`
Expected: FAIL — the current footer contains `generated … | Legal basis: RA 9262`.

- [ ] **Step 3: Write minimal implementation**

Delete the entire footer block at the end of `buildIrfPdf`:

```ts
  // ---- Footer: legal basis / audit trail ----
  doc.font('Helvetica-Oblique').fontSize(6.5).fillColor('#666')
    .text(
      `${data.officeName} — generated ${formatDateTime(data.generatedAt ?? new Date())}` +
        (data.legalBasis ? ` | Legal basis: ${data.legalBasis}` : ''),
      LEFT, BOTTOM + 8, { width: WIDTH, align: 'center', lineBreak: false },
    );
```

Leave `BOTTOM` defined (it is still used by the frame). If `BOTTOM` becomes unused after deletion, keep it because `doc.rect(LEFT, TOP, WIDTH, BOTTOM - TOP)` uses it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kapwa-server && npx jest irf-pdf`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd kapwa-server
git add src/irf/irf-pdf.builder.ts src/irf/irf-pdf.builder.spec.ts
git commit -m "fix(pdf): IRF matches paper form (remove generated footer)"
```

---

### Task 4: General Intake Sheet parity

**Files:**
- Modify: `kapwa-server/src/gis/gis-pdf.builder.ts` (`FORM_NUMBER`, banner, `Needs Assessment` heading, `FOOTER_TEXT_2`)
- Test: `kapwa-server/src/gis/gis-pdf.builder.spec.ts`

**Interfaces:**
- Consumes: `GisPdfData` (unchanged).
- Produces: unchanged `buildGisPdf`.

- [ ] **Step 1: Write the failing test**

Add to `gis-pdf.builder.spec.ts` (copy in the `searchableText` helper if absent):

```ts
it('prints the reference form number and omits the added footer/heading', async () => {
  const buf = await buildGisPdf(gisFixture);
  const text = searchableText(buf);
  expect(text).toContain('DSWD-PMB-GF-011');
  expect(text).not.toContain('DSWD-PMB-FO3-07-011');
  expect(text).not.toContain('Needs Assessment');
  expect(text).not.toContain('Municipal Social Welfare and Development Office (MSWDO) - Norzagaray, Bulacan');
});
```

Where `gisFixture` is the existing fixture object used by the other tests in that spec (reuse it; do not create a new one).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-server && npx jest gis-pdf`
Expected: FAIL — form number is `DSWD-PMB-FO3-07-011`; `Needs Assessment` and the second footer are present.

- [ ] **Step 3: Write minimal implementation**

1. Change the constant:

```ts
const FORM_NUMBER = 'DSWD-PMB-GF-011 | REV 01 / 30 SEPT 2022';
```

2. Make the `MAARING...` bar dark grey (reference) instead of red:

```ts
  banner(62, 11, BANNER_TEXT, 'gray', 6.5);
```

3. Delete the `Needs Assessment` heading (three lines) but keep the column boxes that follow:

```ts
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#111')
    .text('Needs Assessment', LEFT, y + 3, { lineBreak: false });
  y += 11;
```

Replace with nothing (the `needsH` block below it stays as-is).

4. Remove `FOOTER_TEXT_2` (declaration and its `.text(...)` call), leaving only `FOOTER_TEXT`:

```ts
  doc.font('Helvetica').fontSize(5).fillColor('#555')
    .text(FOOTER_TEXT, LEFT, y + 3, { width: WIDTH, align: 'center', lineBreak: false, ellipsis: true });
```

5. Do **not** touch the uncommitted Place-of-Birth / `unangBisita` row; it is flagged in the spec as an unverified addition.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kapwa-server && npx jest gis-pdf`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd kapwa-server
git add src/gis/gis-pdf.builder.ts src/gis/gis-pdf.builder.spec.ts
git commit -m "fix(pdf): GIS form number, banner tone, remove added heading/footer"
```

---

### Task 5: Family Access Card parity (page order + cover)

**Files:**
- Modify: `kapwa-server/src/access-cards/access-card-pdf.builder.ts`
- Test: `kapwa-server/src/access-cards/access-card-pdf.builder.spec.ts`

**Interfaces:**
- Consumes: `AccessCardPdfData` (unchanged in shape).
- Produces: unchanged `buildAccessCardPdf`.

- [ ] **Step 1: Write the failing test**

Extend the existing spec (it already has `searchableText` and `fullData`):

```ts
it('orders the cover side before the PAALALA side and prints cover furniture', async () => {
  const text = searchableText(await buildAccessCardPdf(fullData));
  const coverIdx = text.indexOf('FAMILY COMPOSITION');
  const paalalaIdx = text.indexOf('PAALALA AT GABAY');
  expect(coverIdx).toBeGreaterThanOrEqual(0);
  expect(paalalaIdx).toBeGreaterThanOrEqual(0);
  expect(coverIdx).toBeLessThan(paalalaIdx);
  expect(text).toContain('Municipality of Norzagaray');
  expect(text).toContain('Barangay Captain');
  expect(text).toContain('Municipal Mayor');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-server && npx jest access-card-pdf`
Expected: FAIL on `coverIdx < paalalaIdx` — current page 1 is PAALALA-left + services-right.

- [ ] **Step 3: Write minimal implementation**

Restructure `buildAccessCardPdf` so page 1 is the **cover side** and page 2 the **PAALALA side**, matching the reference. Concretely, split the function body into two render helpers and call them in the new order:

```ts
export async function buildAccessCardPdf(data: AccessCardPdfData): Promise<Buffer> {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 38, bottom: 40, left: LEFT - 15, right: RIGHT + 15 },
    info: { /* unchanged info block */ },
  });
  const buffers: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => buffers.push(chunk));

  // PAGE 1 — cover side (reference ACCESS-CARD-COVER): services left, client cover right.
  drawServicesPanel(doc, LEFT, 48, data.services, 14);
  drawClientCover(doc, LEFT + WIDTH / 2, data);

  // PAGE 2 — inner side (reference ACCESS-CARD-INNER): PAALALA left, services right.
  doc.addPage();
  drawPaalala(doc, LEFT, 48);
  drawServicesPanel(doc, LEFT + WIDTH / 2, 48, data.services, 14);

  doc.end();
  return new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(buffers))));
}
```

Implement the four helpers by moving the existing code:

- `drawServicesHeader` / `drawServiceRows` already exist — keep them; add `drawServicesPanel(doc, x, y, services, minRows)` that draws the header then the rows.
- `drawPaalala(doc, x, y)` = the existing `PAALALA_LINES` loop, but wrap the heading in a bordered rectangle and prefix `PAALALA AT GABAY` with the box (reference shows a boxed heading).
- `drawClientCover(doc, x, data)` = the existing page-2 right-column code, plus:
  - a photo box: `doc.rect(x + 10, 40, 70, 70).lineWidth(0.6).strokeColor('#111').stroke();` labelled `CLIENT` below it;
  - the municipal seal + DSWD logo to the right of the photo box (`path.join(__dirname, '..', 'gis', 'assets', 'norzagaray-bulacan-official-logo.png')` and `…', 'gis', 'assets', 'DSWD-Logo.png'`), each `{ fit: [46, 46] }`, guarded by `fs.existsSync`;
  - letterhead order `Republic of the Philippines` → `Province of Bulacan` → `Municipality of Norzagaray` → office name;
  - `FAMILY COMPOSITION` rendered with `Math.max(8, data.familyMembers.length)` rows;
  - the existing signature block, plus a printed-name line under each signature rule using the reference names from constants (Task 6 of the Summary Report plan adds the resolved-name path; here use `data` if a name is present, otherwise leave blank).

Add `import * as path from 'path'; import * as fs from 'fs';` if not already imported.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kapwa-server && npx jest access-card-pdf`
Expected: PASS — 2 pages, cover text precedes PAALALA text, all existing assertions still hold.

- [ ] **Step 5: Commit**

```bash
cd kapwa-server
git add src/access-cards/access-card-pdf.builder.ts src/access-cards/access-card-pdf.builder.spec.ts
git commit -m "fix(pdf): access card cover-first page order and cover furniture"
```

---

### Task 6: Committed sample renderer + output audit

**Files:**
- Create: `kapwa-server/scripts/render-pdf-samples.mjs`
- Modify: `pdf/outputs/README.md`
- Test: manual (script output), not a Jest test.

- [ ] **Step 1: Confirm the script does not already exist**

Run: `ls kapwa-server/scripts 2>/dev/null; test -f kapwa-server/scripts/render-pdf-samples.mjs && echo EXISTS || echo MISSING`
Expected: `MISSING` (the original harness was temporary and was not committed).

- [ ] **Step 2: Write the renderer**

Create `kapwa-server/scripts/render-pdf-samples.mjs`. It builds a fixture per document (mirroring the values in the existing `*.builder.spec.ts` fixtures), requires the compiled builders from `dist/` (or runs against `ts-node`/`tsx` per repo convention — check `kapwa-server/package.json` for an existing script runner and match it), writes PDFs to `pdf/outputs/`, and invokes:

```js
import { execFileSync } from 'node:child_process';
// after writing each PDF:
execFileSync('pdftoppm', ['-r', '110', '-png', pdfPath, pngPrefix]);
execFileSync('pdftotext', ['-bbox', pdfPath, bboxPath]);
```

The script must print the inventory rows (`# | Export | Source | Paper | Pages | Size`) and assert the bbox checks (overlap > 25%, off-page) from the spec, exiting non-zero on failure.

- [ ] **Step 3: Build and run**

Run: `cd kapwa-server && npm run build && node scripts/render-pdf-samples.mjs`
Expected: prints a row per document; all bbox checks clean; exits 0.

- [ ] **Step 4: Update the inventory**

Update `pdf/outputs/README.md`: refresh the table (paper, pages, byte size) and the "Automated layout checks" paragraph, and note that the renderer is now `kapwa-server/scripts/render-pdf-samples.mjs`.

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/scripts/render-pdf-samples.mjs pdf/outputs/README.md pdf/outputs
git commit -m "chore(pdf): committed sample renderer and refreshed output inventory"
```

---

## Self-Review

- **Spec coverage:** D1 (Task 1), D2 (Task 2), D3 (Task 3), D4 (Task 4), D5 (Task 5), acceptance checks (Task 6). Covered.
- **Placeholder scan:** No `TBD`/`TODO`. Task 2 deliberately makes the row tweak conditional on observed output rather than inventing unverifiable geometry.
- **Type consistency:** All builders keep their existing exported signatures and data interfaces; no type renames.
- **Review Focus coverage:** blank-data cases preserved in each spec; overlap/clip behaviour retained; Access Card page order asserted in Task 5; geometry asserted in Task 6.
