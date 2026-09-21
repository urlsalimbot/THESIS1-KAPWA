# Case Lifecycle 5-Step Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce the five-step MSWDO case lifecycle server-side, move COE/PCV to manual admin issuance, and make the Case Study Report a merged PDF bundle.

**Architecture:** Case gates live in `CasesService.validateTransition` / `approve`, backed by a new requirement-check helper on `CasesExportService`. Document issuance moves from an automatic side-effect of `in_review → active` to explicit admin endpoints. The CSR export composes existing PDF builders (cover, PCV, COE, IRF summary, GIS) into one file with `pdf-lib`.

**Tech Stack:** NestJS 11 + TypeORM 0.4 (alpha) + Postgres, pdfkit (existing), `pdf-lib` (new), React 19 + Vite client.

**Spec:** `docs/superpowers/specs/2026-09-21-case-lifecycle-5step-design.md`

## Global Constraints

- No new database columns; no TypeORM migration and no `migrate.ts` change.
- Step 4 uses the existing `selfRelianceLevel` + `sustainabilityPlan`; threshold constant `SELF_RELIANCE_SUFFICIENT_MIN_LEVEL = 3`.
- Case-document PDF filenames follow `docs/FUNCTIONALITY.md §12`: `<CaseType> <caseNo>-<YYYY>-<MM>-<DD>.pdf` via `exportFileName` (`kapwa-server/src/common/constants.ts`).
- Server tests: `npx jest --silent` (never `npm test`). Typecheck: `npm run typecheck`.
- Client tests: `npm run test:run`. Typecheck: `npm run typecheck`.
- Conventional commits; stage explicit paths (never `git add -A`).
- A program with **no** required documents must never block approval.

## Review Focus

1. A program with zero `requiredDocuments` configured → `approve` must pass.
2. A filing row whose `requirement_key` was uploaded for a different case → must not satisfy the requirement.
3. `POST /cases/:id/issue-coe` called twice → one filing row, same URL returned.
4. CSR export on a case with **no** linked IRF → valid PDF, IRF section omitted.
5. CSR export when COE/PCV have not been issued yet → still builds both from the builders.
6. CSR export on a `closed` case with zero interventions → valid PDF (no crash on empty lists).

---

### Task 1: Documentary-requirements gate on approval

**Files:**
- Modify: `kapwa-server/src/cases/cases-export.service.ts` (add `missingRequiredDocuments`)
- Modify: `kapwa-server/src/cases/cases.service.ts:316-338` (`validateTransition`)
- Test: `kapwa-server/src/cases/cases.service.spec.ts`

**Interfaces:**
- Produces: `CasesExportService.missingRequiredDocuments(caseId: string): Promise<string[]>` — required document keys (from mandatory `program_required_documents` of the case's intervention programs) that have no matching `document_vault.requirement_key` for the case. Empty array = gate passed.

- [ ] **Step 1: Write the failing test** (append to `cases.service.spec.ts`, inside the existing `describe('CasesService')`; the spec already builds `repoMock` and a `service` — add `casesExport` to its providers if absent)

```ts
it('blocks in_review -> active when required documents are missing', async () => {
  const c = {
    id: '1', status: CaseStatus.IN_REVIEW, controlNo: 'KAPWA-2026-00001',
    beneficiaryId: null, assignedWorkerId: null, updatedAt: new Date(),
  } as unknown as Case;
  repoMock.findOne.mockResolvedValue(c);
  (service as any).casesExport = { missingRequiredDocuments: jest.fn().mockResolvedValue(['Valid ID']) };

  await expect(service.approve('1', CaseStatus.ACTIVE, 'sig', 'admin', 'u1'))
    .rejects.toThrow(/missing required document/i);
});

it('allows in_review -> active when no documents are required', async () => {
  const c = {
    id: '1', status: CaseStatus.IN_REVIEW, controlNo: 'KAPWA-2026-00001',
    beneficiaryId: null, assignedWorkerId: null, updatedAt: new Date(),
  } as unknown as Case;
  repoMock.findOne.mockResolvedValue(c);
  repoMock.save.mockImplementation(async (x: any) => x);
  (service as any).casesExport = { missingRequiredDocuments: jest.fn().mockResolvedValue([]) };
  (service as any).getInterventionCount = jest.fn().mockResolvedValue(1);

  await expect(service.approve('1', CaseStatus.ACTIVE, 'sig', 'admin', 'u1')).resolves.toBeTruthy();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd kapwa-server && npx jest cases.service -t "required documents"`
Expected: FAIL — `service.approve` resolves (no gate) / `missingRequiredDocuments` is not a function.

- [ ] **Step 3: Add the helper** in `cases-export.service.ts` (after `controlNo`)

```ts
  // Required document keys (mandatory) contributed by the programs behind this
  // case's interventions, minus the keys already filed against the case.
  // A program with no required documents contributes nothing.
  async missingRequiredDocuments(caseId: string): Promise<string[]> {
    const required: Array<{ document_key: string }> = await this.caseRepo.manager.query(
      `SELECT DISTINCT prd.document_key
         FROM case_interventions ci
         JOIN program_required_documents prd ON prd.program_id = ci.program_id
        WHERE ci.case_id = $1 AND prd.mandatory = TRUE`,
      [caseId],
    );
    const requiredKeys = required.map((r) => r.document_key).filter(Boolean);
    if (requiredKeys.length === 0) return [];

    const filed: Array<{ requirement_key: string }> = await this.caseRepo.manager.query(
      `SELECT DISTINCT requirement_key FROM document_vault
        WHERE case_id = $1 AND requirement_key IS NOT NULL`,
      [caseId],
    );
    const filedKeys = new Set(filed.map((r) => r.requirement_key));
    return requiredKeys.filter((k) => !filedKeys.has(k));
  }
```

- [ ] **Step 4: Enforce it** in `cases.service.ts` `validateTransition`, inside the `IN_REVIEW -> ACTIVE` branch

```ts
    if (c.status === CaseStatus.IN_REVIEW && newStatus === CaseStatus.ACTIVE) {
      const interventionCount = await this.getInterventionCount(c.id);
      if (interventionCount === 0) {
        throw new BadRequestException('At least one intervention must be logged before activating');
      }
      const missing = await this.casesExport.missingRequiredDocuments(c.id);
      if (missing.length > 0) {
        throw new BadRequestException(
          `Cannot activate: missing required document(s): ${missing.join(', ')}`,
        );
      }
    }
```

- [ ] **Step 5: Add helper unit tests** in `kapwa-server/src/cases/cases-export.service.spec.ts` (create if absent). The manager mock records the SQL so the case scoping is pinned:

```ts
it('returns only required keys with no filed document, scoped to the case', async () => {
  const query = jest.fn()
    .mockResolvedValueOnce([{ document_key: 'A' }, { document_key: 'B' }])
    .mockResolvedValueOnce([{ requirement_key: 'A' }, { requirement_key: 'Z' }]);
  const caseRepo = { manager: { query } };
  const svc = new CasesExportService(caseRepo as any, {} as any, {} as any, {} as any, {} as any);
  await expect(svc.missingRequiredDocuments('c1')).resolves.toEqual(['B']);
  expect(query.mock.calls[0][0]).toMatch(/WHERE ci\.case_id = \$1/);
  expect(query.mock.calls[0][1]).toEqual(['c1']);
  expect(query.mock.calls[1][0]).toMatch(/WHERE case_id = \$1/);
  expect(query.mock.calls[1][1]).toEqual(['c1']);
});

it('passes when no program requires documents', async () => {
  const caseRepo = { manager: { query: jest.fn().mockResolvedValueOnce([]) } };
  const svc = new CasesExportService(caseRepo as any, {} as any, {} as any, {} as any, {} as any);
  await expect(svc.missingRequiredDocuments('c1')).resolves.toEqual([]);
});
```

The `WHERE case_id = $1` clause is what stops a document filed for another case from satisfying this case's requirement.

- [ ] **Step 6: Run tests**

Run: `cd kapwa-server && npx jest cases.service cases-export && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add kapwa-server/src/cases/cases-export.service.ts kapwa-server/src/cases/cases.service.ts kapwa-server/src/cases/cases.service.spec.ts kapwa-server/src/cases/cases-export.service.spec.ts
git commit -m "feat(cases): block activation until required documents are filed"
```

---

### Task 2: Manual COE/PCV issuance

**Files:**
- Modify: `kapwa-server/src/cases/cases-export.service.ts:523-549`
- Modify: `kapwa-server/src/cases/cases.service.ts:356-370` (remove auto-gen), `:399-401` (add `issueDocument`)
- Modify: `kapwa-server/src/cases/cases.controller.ts` (two routes)
- Test: `kapwa-server/src/cases/cases.service.spec.ts`, `cases-export.service.spec.ts`

**Interfaces:**
- Produces: `CasesExportService.issueCoe(caseId, actorId?): Promise<string>` and `issuePcv(caseId, actorId?): Promise<string>` — file the document and return its `/filing/:id/download` URL; return the stored URL unchanged when already issued.
- Produces: `CasesService.issueDocument(id: string, type: 'coe' | 'pcv', actorId?: string): Promise<{ url: string }>`.
- Consumes: Task 1's `missingRequiredDocuments`.

- [ ] **Step 1: Write the failing tests** in `cases-export.service.spec.ts`

```ts
it('issues COE once and reuses the stored URL', async () => {
  const filedUrl = '/filing/coe-1/download';
  const caseRepo = {
    findOne: jest.fn()
      .mockResolvedValueOnce({ id: 'c1', controlNo: 'KAPWA-2026-00001', certificateUrl: undefined })
      .mockResolvedValueOnce({ id: 'c1', controlNo: 'KAPWA-2026-00001', certificateUrl: filedUrl }),
  };
  const filing = { upload: jest.fn().mockResolvedValue({ id: 'coe-1' }) };
  const svc = new (require('./cases-export.service').CasesExportService)(caseRepo, {} as any, {} as any, filing as any, {} as any);
  jest.spyOn(svc as any, 'buildCertificateOfEligibility').mockResolvedValue(Buffer.from('%PDF-1.3'));
  (svc as any).caseRepo = caseRepo;
  (svc as any).filing = filing;

  await expect(svc.issueCoe('c1', 'u1')).resolves.toBe(filedUrl);
  await expect(svc.issueCoe('c1', 'u1')).resolves.toBe(filedUrl);
  expect(filing.upload).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd kapwa-server && npx jest cases-export -t "issues COE"`
Expected: FAIL — `svc.issueCoe is not a function`.

- [ ] **Step 3: Implement issuance** in `cases-export.service.ts`, replacing `generateApprovalDocuments`

```ts
  private async requireCase(caseId: string) {
    const c = await this.caseRepo.findOne({
      where: { id: caseId },
      relations: ['beneficiary', 'beneficiary.person', 'assistances', 'assignedWorker'],
    });
    if (!c) throw new NotFoundException('Case not found');
    return c;
  }

  // Manual issuance (see spec §2). Idempotent: an already-issued document is
  // returned as-is without filing a duplicate.
  async issueCoe(caseId: string, actorId?: string): Promise<string> {
    const c = await this.requireCase(caseId);
    if (c.certificateUrl) return c.certificateUrl;
    const pdf = await this.buildCertificateOfEligibility(c);
    const doc = await this.filing.upload(
      { originalname: `COE-${c.controlNo}.pdf`, mimetype: 'application/pdf', size: pdf.length, buffer: pdf },
      { caseId: c.id, category: 'approval_document', notes: `Certificate of Eligibility — issued for ${c.controlNo}`, uploadedBy: actorId },
    );
    c.certificateUrl = `/filing/${doc.id}/download`;
    await this.caseRepo.save(c);
    return c.certificateUrl;
  }

  async issuePcv(caseId: string, actorId?: string): Promise<string> {
    const c = await this.requireCase(caseId);
    if (c.pettyCashVoucherUrl) return c.pettyCashVoucherUrl;
    const pdf = await this.buildPettyCashVoucher(c);
    const doc = await this.filing.upload(
      { originalname: `PCV-${c.controlNo}.pdf`, mimetype: 'application/pdf', size: pdf.length, buffer: pdf },
      { caseId: c.id, category: 'approval_document', notes: `Petty Cash Voucher — issued for ${c.controlNo}`, uploadedBy: actorId },
    );
    c.pettyCashVoucherUrl = `/filing/${doc.id}/download`;
    await this.caseRepo.save(c);
    return c.pettyCashVoucherUrl;
  }
```

- [ ] **Step 4: Remove the automatic generation** in `cases.service.ts` `transition` (delete the whole `if (newStatus === CaseStatus.ACTIVE && oldStatus !== CaseStatus.ACTIVE) { ... }` block, lines 356-370). Add to `CasesService`:

```ts
  async issueDocument(id: string, type: 'coe' | 'pcv', actorId?: string) {
    const c = await this.findById(id);
    if (![CaseStatus.ACTIVE, CaseStatus.TRANSITIONING, CaseStatus.CLOSED].includes(c.status)) {
      throw new BadRequestException('COE/PCV can only be issued once the case is active');
    }
    const url = type === 'coe'
      ? await this.casesExport.issueCoe(id, actorId)
      : await this.casesExport.issuePcv(id, actorId);
    await this.auditLog?.log(`case.issue_${type}`, id, actorId, { controlNo: c.controlNo, url });
    return { url };
  }
```

- [ ] **Step 5: Add the endpoints** in `cases.controller.ts` (near `:id/approve`)

```ts
  @Post(':id/issue-coe')
  @Roles('admin')
  async issueCoe(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.casesService.issueDocument(id, 'coe', req.user?.id);
  }

  @Post(':id/issue-pcv')
  @Roles('admin')
  async issuePcv(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.casesService.issueDocument(id, 'pcv', req.user?.id);
  }
```

- [ ] **Step 6: Update the auto-gen test** — the existing `cases.service.spec.ts` assertion that approval generates documents must be deleted/inverted (approval no longer files anything).

- [ ] **Step 7: Run tests**

Run: `cd kapwa-server && npx jest cases.service cases-export && npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add kapwa-server/src/cases/cases-export.service.ts kapwa-server/src/cases/cases-export.service.spec.ts kapwa-server/src/cases/cases.service.ts kapwa-server/src/cases/cases.service.spec.ts kapwa-server/src/cases/cases.controller.ts
git commit -m "feat(cases): manual admin issuance of COE and PCV"
```

---

### Task 3: Referral-decision gate on transition

**Files:**
- Modify: `kapwa-server/src/cases/cases.service.ts` (`validateTransition`, `ACTIVE -> TRANSITIONING`)
- Test: `kapwa-server/src/cases/cases.service.spec.ts`

**Interfaces:**
- Consumes: `Case.referrals` getter and `Case.referralNotNeeded` (existing).

- [ ] **Step 1: Write the failing test**

```ts
it('blocks active -> transitioning until a referral decision is recorded', async () => {
  const c = {
    id: '1', status: CaseStatus.ACTIVE, controlNo: 'KAPWA-2026-00001', referrals: [],
    referralNotNeeded: false, selfRelianceLevel: 3, sustainabilityPlan: 'plan',
    updatedAt: new Date(),
  } as unknown as Case;
  repoMock.findOne.mockResolvedValue(c);
  await expect(service.updateStatus('1', CaseStatus.TRANSITIONING, 'admin', 'u1'))
    .rejects.toThrow(/referral/i);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd kapwa-server && npx jest cases.service -t "referral decision"`
Expected: FAIL.

- [ ] **Step 3: Implement** in the `ACTIVE -> TRANSITIONING` branch

```ts
    if (c.status === CaseStatus.ACTIVE && newStatus === CaseStatus.TRANSITIONING) {
      if (!c.selfRelianceLevel || !c.sustainabilityPlan) {
        throw new BadRequestException('Self-reliance level and sustainability plan are required for transition');
      }
      if (!(c.referrals?.length) && !c.referralNotNeeded) {
        throw new BadRequestException('Record the inter-agency referral decision before transitioning');
      }
    }
```

- [ ] **Step 4: Run tests**

Run: `cd kapwa-server && npx jest cases.service && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/src/cases/cases.service.ts kapwa-server/src/cases/cases.service.spec.ts
git commit -m "feat(cases): require the inter-agency referral decision before transition"
```

---

### Task 4: Unencrypted IRF render for the CSR bundle

**Files:**
- Modify: `kapwa-server/src/irf/irf-export.service.ts:27-57`
- Test: `kapwa-server/src/irf/irf-export.service.spec.ts` (create if absent)

**Interfaces:**
- Produces: `IrfExportService.buildIrfPdfBuffer(id: string, opts?: { password?: string; userId?: string }): Promise<Buffer>` — the existing PDF body; password-protected only when `password` is given.

- [ ] **Step 1: Write the failing test**

```ts
it('builds an unencrypted IRF buffer when no password is given', async () => {
  const svc: any = new IrfExportService({} as any, {
    exportWcpd: jest.fn().mockResolvedValue({ case: { blotterEntryNumber: 'BLT-1' }, parties: {}, narration: 'n' }),
  } as any, { logAccess: jest.fn() } as any, { findByCode: jest.fn().mockResolvedValue({ name: 'MSWDO' }) } as any);
  const buf = await svc.buildIrfPdfBuffer('irf-1', {});
  expect(Buffer.isBuffer(buf)).toBe(true);
  expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(svc.irfAuditService.logAccess).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd kapwa-server && npx jest irf-export -t "unencrypted"`
Expected: FAIL — `buildIrfPdfBuffer is not a function`.

- [ ] **Step 3: Refactor** `exportPdf` so the body accepts options

Extract everything from `const PDFDocument = require('pdfkit')` onward into:

```ts
  async buildIrfPdfBuffer(
    id: string,
    opts: { password?: string; userId?: string; legalBasis?: string } = {},
  ): Promise<Buffer> {
    const agencyName = await this.agencyLabel();
    const irfData = opts.legalBasis
      ? await this.irfService.exportWcpd(id, opts.legalBasis)
      : await this.irfService.exportWcpd(id, 'RA 9262');
    if (!irfData) throw new NotFoundException('IRF case not found');
    // ... existing builder body, with the doc options built conditionally:
    const docOptions: any = { size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 }, info: { ... } };
    if (opts.password) {
      docOptions.userPassword = opts.password;
      docOptions.ownerPassword = process.env.PDF_OWNER_PW || 'kapwa-admin-2026';
      docOptions.permissions = { printing: 'lowResolution', modifying: false, copying: false };
    }
    // ... rest unchanged
  }
```

`exportPdf(id, legalBasis, password, userId)` becomes: `await this.irfAuditService.logAccess(...)` then `return this.buildIrfPdfBuffer(id, { password, legalBasis, userId });`

- [ ] **Step 4: Run tests**

Run: `cd kapwa-server && npx jest irf && npm run typecheck`
Expected: PASS (existing IRF specs unchanged).

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/src/irf/irf-export.service.ts kapwa-server/src/irf/irf-export.service.spec.ts
git commit -m "refactor(irf): extract unencrypted IRF PDF builder"
```

---

### Task 5: CSR merged PDF bundle

**Files:**
- Modify: `kapwa-server/package.json` (add `pdf-lib`)
- Modify: `kapwa-server/src/cases/cases-export.service.ts` (`generateCsrPdf`, inject `GisExportService`)
- Test: `kapwa-server/src/cases/cases-export.service.spec.ts`
- Test (integration, real PDF): `kapwa-server/test/csr-bundle.spec.ts`

**Interfaces:**
- Constructor becomes `CasesExportService(caseRepo, historyRepo, interventionRepo, filing, org, gis: GisExportService, irfExport: IrfExportService)`.
- Consumes: `GisExportService.generateGisPdf(caseId)`; `IrfExportService.buildIrfPdfBuffer(id, opts)` (Task 4); `buildCertificateOfEligibility` / `buildPettyCashVoucher` (private, same class); IRF id via `caseRepo.manager.query('SELECT id FROM irf_cases WHERE case_id = $1 LIMIT 1', [caseId])`.
- Produces: `generateCsrPdf(caseId): Promise<Buffer>` — merged PDF, same endpoint and filename as today.
- Wiring: `IrfModule` exports `IrfExportService` and does not import `CasesModule` (verified), so add `IrfModule` to `cases.module.ts` imports.

- [ ] **Step 1: Install the dependency**

Run: `cd kapwa-server && npm install pdf-lib@^1.17.1`
Expected: `pdf-lib` in `dependencies`.

- [ ] **Step 2: Write the failing test** (`cases-export.service.spec.ts`)

```ts
it('merges cover + PCV + COE + GIS and omits IRF when none is linked', async () => {
  const caseRepo = {
    findOne: jest.fn().mockResolvedValue({ id: 'c1', controlNo: 'KAPWA-2026-00001' }),
    manager: { query: jest.fn().mockResolvedValue([]) },
  };
  const svc: any = new (require('./cases-export.service').CasesExportService)(caseRepo, {} as any, {} as any, {} as any, {} as any);
  svc.gis = { generateGisPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.3\n%%EOF')) };
  jest.spyOn(svc, 'buildCsrCover').mockResolvedValue(Buffer.from('%PDF-1.3\n%%EOF'));
  jest.spyOn(svc, 'buildPettyCashVoucher').mockResolvedValue(Buffer.from('%PDF-1.3\n%%EOF'));
  jest.spyOn(svc, 'buildCertificateOfEligibility').mockResolvedValue(Buffer.from('%PDF-1.3\n%%EOF'));

  const out = await svc.generateCsrPdf('c1');
  expect(Buffer.isBuffer(out)).toBe(true);
  expect(out.subarray(0, 5).toString()).toBe('%PDF-');
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd kapwa-server && npx jest cases-export -t "merges cover"`
Expected: FAIL.

- [ ] **Step 4: Implement the merge.** Inject `GisExportService` into `CasesExportService`'s constructor (`private readonly gis: GisExportService`). Extract the current CSR cover/summary rendering at the top of `generateCsrPdf` into `buildCsrCover(c: Case): Promise<Buffer>` (same pdfkit body as today, ending before the sections that are now separate files). Replace `generateCsrPdf` with:

```ts
  async generateCsrPdf(caseId: string): Promise<Buffer> {
    const c = await this.caseRepo.findOne({
      where: { id: caseId },
      relations: ['beneficiary', 'beneficiary.person', 'beneficiary.household', 'assignedWorker'],
    });
    if (!c) throw new NotFoundException('Case not found');

    const parts: Buffer[] = [
      await this.buildCsrCover(c),
      await this.buildPettyCashVoucher(c),
      await this.buildCertificateOfEligibility(c),
    ];

    const irfRows: Array<{ id: string }> = await this.caseRepo.manager.query(
      'SELECT id FROM irf_cases WHERE case_id = $1 LIMIT 1', [caseId],
    );
    if (irfRows[0]?.id) {
      const pdf = await this.irfExport.buildIrfPdfBuffer(irfRows[0].id, {});
      parts.push(pdf);
    }

    parts.push(await this.gis.generateGisPdf(caseId));

    const merged = await PdfLib.create();
    for (const buf of parts) {
      const src = await PdfLib.load(buf, { ignoreEncryption: true });
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
    }
    return Buffer.from(await merged.save());
  }
```

Also inject `IrfExportService` (import from `../irf/irf-export.service`) and add `IrfModule` to `cases.module.ts` imports (`IrfModule` exports `IrfExportService` and does not import `CasesModule`, so there is no cycle).

- [ ] **Step 5: Run the unit test + typecheck**

Run: `cd kapwa-server && npx jest cases-export && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Add a real-builder merge test** (`cases-export.service.spec.ts`). It uses the actual pdfkit builders (only repos/org are mocked) and asserts the merged page count with `pdf-lib`:

```ts
it('produces a multi-page merged PDF from the real builders', async () => {
  const caseRepo = {
    findOne: jest.fn().mockResolvedValue({
      id: 'c1', controlNo: 'KAPWA-2026-00001', status: 'closed',
      beneficiary: { person: { firstName: 'Juan', surname: 'Dela Cruz' } },
      assistances: [], assignedWorker: null,
    }),
    manager: { query: jest.fn().mockResolvedValue([]) },
  };
  const svc: any = new (require('./cases-export.service').CasesExportService)(caseRepo, {} as any, {} as any, {} as any, {} as any);
  svc.org = { officeName: jest.fn().mockResolvedValue('MSWDO Norzagaray') };
  svc.gis = { generateGisPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.3\n%%EOF')) };

  const out = await svc.generateCsrPdf('c1');
  const { PDFDocument } = require('pdf-lib');
  const doc = await PDFDocument.load(out);
  expect(out.subarray(0, 5).toString()).toBe('%PDF-');
  expect(doc.getPageCount()).toBeGreaterThanOrEqual(3);
});
```

- [ ] **Step 7: Run**

Run: `cd kapwa-server && npx jest cases-export && npm run typecheck`
Expected: PASS (both the mock-builder test and the real-builder merge test).

- [ ] **Step 8: Commit**

```bash
git add kapwa-server/package.json kapwa-server/package-lock.json kapwa-server/src/cases/cases-export.service.ts kapwa-server/src/cases/cases-export.service.spec.ts kapwa-server/src/cases/cases.module.ts kapwa-server/src/irf/irf.module.ts
git commit -m "feat(cases): Case Study Report merges PCV, COE, IRF and GIS"
```

---

### Task 6: Stepper labels (client)

**Files:**
- Modify: `kapwa-client/src/components/case-view/CaseStepper.tsx:49-55`
- Modify: `kapwa-client/src/i18n/locales/en/index.ts`, `kapwa-client/src/i18n/locales/fil/index.ts`
- Test: `kapwa-client/src/components/case-view/CaseStepper.test.tsx`

**Interfaces:**
- Produces: step labels `Assess & Interview`, `Intervention & Requirements`, `Inter-agency Referrals`, `Evaluate Help Given`, `Case Study & Closure`, with matching `caseView.stepper.*` i18n keys in both locales.

- [ ] **Step 1: Write the failing test**

```tsx
it('renders the five lifecycle step labels', () => {
  render(<CaseStepper currentStep={0} onStepClick={() => {}} caseData={{}} interventionCount={0} />);
  ['Assess & Interview', 'Intervention & Requirements', 'Inter-agency Referrals', 'Evaluate Help Given', 'Case Study & Closure']
    .forEach((label) => expect(screen.getByTitle(label)).toBeTruthy());
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd kapwa-client && npx vitest run src/components/case-view/CaseStepper.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Update `STEPS`** in `CaseStepper.tsx` (keep the existing i18n key suffixes, change default English strings):

```tsx
  const STEPS = [
    { label: t('caseView.stepper.assessment', 'Assess & Interview'), description: t('caseView.stepper.assessmentDesc', 'Interview and FRVA/SWDI analysis'), phase: t('caseView.stepper.phaseIn', 'Phase-In') },
    { label: t('caseView.stepper.implementHip', 'Intervention & Requirements'), description: t('caseView.stepper.implementHipDesc', 'Select intervention; client documents; COE/PCV release'), phase: t('caseView.stepper.phaseImplementation', 'Implementation') },
    { label: t('caseView.stepper.serviceDelivery', 'Inter-agency Referrals'), description: t('caseView.stepper.serviceDeliveryDesc', 'Referral needed: yes or no'), phase: t('caseView.stepper.phaseImplementation', 'Implementation') },
    { label: t('caseView.stepper.transition', 'Evaluate Help Given'), description: t('caseView.stepper.transitionDesc', 'Self-reliance assessment'), phase: t('caseView.stepper.phaseOut', 'Phase-Out') },
    { label: t('caseView.stepper.closure', 'Case Study & Closure'), description: t('caseView.stepper.closureDesc', 'Evaluate case study; formal exit'), phase: t('caseView.stepper.phaseOut', 'Phase-Out') },
  ];
```

- [ ] **Step 4: Update the locale strings** for `caseView.stepper.assessment|implementHip|serviceDelivery|transition|closure` and their `*Desc` keys in `en` and `fil`. If the `fil` value equals the `en` value, add the key to `ALLOWED_IDENTICAL` in `kapwa-client/src/i18n/__tests__/fil-parity.test.ts`.

- [ ] **Step 5: Run tests**

Run: `cd kapwa-client && npx vitest run src/components/case-view/CaseStepper.test.tsx src/i18n/__tests__/fil-parity.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add kapwa-client/src/components/case-view/CaseStepper.tsx kapwa-client/src/components/case-view/CaseStepper.test.tsx kapwa-client/src/i18n/locales/en/index.ts kapwa-client/src/i18n/locales/fil/index.ts kapwa-client/src/i18n/__tests__/fil-parity.test.ts
git commit -m "feat(case-view): lifecycle step labels"
```

---

### Task 7: Issue COE / Issue PCV buttons (client)

**Files:**
- Modify: `kapwa-client/src/pages/CaseViewPage.tsx` (generated-docs strip, ~line 420)
- Test: `kapwa-client/src/pages/CaseViewPage.test.tsx`

**Interfaces:**
- Consumes: `POST /cases/:id/issue-coe`, `POST /cases/:id/issue-pcv` (Task 2).

- [ ] **Step 1: Write the failing test.** Add it inside the existing `describe('CaseViewPage — government ID photo')` block in `CaseViewPage.test.tsx` (that block's `beforeEach` already resolves `mockCase` for `cases` and stubs `mockUseAuth`):

```tsx
it('shows Issue COE and Issue PCV to an admin on an active case without documents', async () => {
  mockUseAuth.mockReturnValue({ user: { id: '1', fullName: 'Admin', role: 'admin' }, loading: false });
  renderWithSWR(<CaseViewPage />);
  expect(await screen.findByRole('button', { name: /Issue COE/i })).toBeTruthy();
  expect(screen.getByRole('button', { name: /Issue PCV/i })).toBeTruthy();
});
```

`mockCase` has `status: 'active'` and no `certificateUrl` / `pettyCashVoucherUrl`, which is exactly the state that shows both buttons.

- [ ] **Step 2: Run to verify it fails**

Run: `cd kapwa-client && npx vitest run src/pages/CaseViewPage.test.tsx -t "Issue COE"`
Expected: FAIL.

- [ ] **Step 3: Implement** in `CaseViewPage.tsx`. Add state + handlers:

```tsx
  const [issuing, setIssuing] = useState<'coe' | 'pcv' | null>(null);
  async function issueDoc(type: 'coe' | 'pcv') {
    setIssuing(type);
    try {
      await api.post(`/cases/${id}/${type === 'coe' ? 'issue-coe' : 'issue-pcv'}`);
      await mutate(queryKeys.cases.detail(id!));
      toast.success(type === 'coe' ? t('cases.coeIssued', 'Certificate of Eligibility issued') : t('cases.pcvIssued', 'Petty Cash Voucher issued'));
    } catch (e) {
      toast.error(humanizeError(e));
    }
    setIssuing(null);
  }
```

Render in the actions row (next to GIS), for `user?.role === 'admin'`:

```tsx
  {user?.role === 'admin' && !caseData.certificateUrl && (
    <Button variant="outline" size="sm" className="gap-1.5" disabled={issuing === 'coe'} onClick={() => issueDoc('coe')}>
      <FileText size={14} aria-hidden="true" /> {issuing === 'coe' ? t('cases.issuing', 'Issuing…') : t('cases.issueCoe', 'Issue COE')}
    </Button>
  )}
  {user?.role === 'admin' && !caseData.pettyCashVoucherUrl && (
    <Button variant="outline" size="sm" className="gap-1.5" disabled={issuing === 'pcv'} onClick={() => issueDoc('pcv')}>
      <FileText size={14} aria-hidden="true" /> {issuing === 'pcv' ? t('cases.issuing', 'Issuing…') : t('cases.issuePcv', 'Issue PCV')}
    </Button>
  )}
```

- [ ] **Step 4: Run tests**

Run: `cd kapwa-client && npx vitest run src/pages/CaseViewPage.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add kapwa-client/src/pages/CaseViewPage.tsx kapwa-client/src/pages/CaseViewPage.test.tsx kapwa-client/src/i18n/locales/en/index.ts kapwa-client/src/i18n/locales/fil/index.ts
git commit -m "feat(case-view): admin Issue COE / Issue PCV actions"
```

---

### Task 8: Step 4 self-reliance recommendation (client)

**Files:**
- Create: `kapwa-client/src/lib/self-reliance.ts`
- Modify: `kapwa-client/src/components/case-view/StepTransition.tsx`
- Test: `kapwa-client/src/lib/self-reliance.test.ts`, `StepTransition.test.tsx` (create if absent)

**Interfaces:**
- Produces: `SELF_RELIANCE_SUFFICIENT_MIN_LEVEL = 3` and `isSelfSufficient(level: number | undefined): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
import { isSelfSufficient, SELF_RELIANCE_SUFFICIENT_MIN_LEVEL } from './self-reliance';
it('treats level >= 3 as self-sufficient', () => {
  expect(SELF_RELIANCE_SUFFICIENT_MIN_LEVEL).toBe(3);
  expect(isSelfSufficient(3)).toBe(true);
  expect(isSelfSufficient(2)).toBe(false);
  expect(isSelfSufficient(undefined)).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd kapwa-client && npx vitest run src/lib/self-reliance.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the module**

```ts
// Step 4 guide: the recorded self-reliance level decides the recommendation.
// Staff still choose the action; the level does not block either path.
export const SELF_RELIANCE_SUFFICIENT_MIN_LEVEL = 3;

export function isSelfSufficient(level: number | undefined): boolean {
  return typeof level === 'number' && level >= SELF_RELIANCE_SUFFICIENT_MIN_LEVEL;
}
```

- [ ] **Step 4: Render the recommendation** in `StepTransition.tsx` (top of the returned JSX, after the heading):

```tsx
  const sufficient = isSelfSufficient(caseData?.selfRelianceLevel);
  ...
  <div className={`rounded-lg border px-4 py-3 text-sm ${sufficient ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
    {sufficient
      ? t('caseView.transition.selfSufficient', 'Self-sufficient — proceed to Closure.')
      : t('caseView.transition.notSelfSufficient', 'Not self-sufficient — subject to case renewal.')}
  </div>
```

Add both i18n keys to `en`/`fil` (parity list if identical).

- [ ] **Step 5: Run tests**

Run: `cd kapwa-client && npx vitest run src/lib/self-reliance.test.ts src/components/case-view/StepTransition.test.tsx src/i18n/__tests__/fil-parity.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add kapwa-client/src/lib/self-reliance.ts kapwa-client/src/lib/self-reliance.test.ts kapwa-client/src/components/case-view/StepTransition.tsx kapwa-client/src/i18n/locales/en/index.ts kapwa-client/src/i18n/locales/fil/index.ts
git commit -m "feat(case-view): self-reliance recommendation in step 4"
```

---

### Task 9: Verification

**Files:** none (verification only)

- [ ] **Step 1: Full server suite + typecheck**

Run: `cd kapwa-server && npx jest --silent && npm run typecheck`
Expected: all suites pass, no type errors.

- [ ] **Step 2: Full client suite + typecheck**

Run: `cd kapwa-client && npm run test:run && npm run typecheck`
Expected: 106+ files pass, no type errors.

- [ ] **Step 3: Rebuild the dev DB and reseed**

```bash
podman rm -f thesis1-kapwa_postgres_1 && podman volume rm thesis1-kapwa_pgdata && podman volume create thesis1-kapwa_pgdata
podman run -d --name thesis1-kapwa_postgres_1 -p 5432:5432 -e POSTGRES_DB=kapwa -e POSTGRES_USER=kapwa -e POSTGRES_PASSWORD=kapwa -v thesis1-kapwa_pgdata:/var/lib/postgresql/data docker.io/library/postgres:16-alpine
cd kapwa-server && npm run seed && npm run seed:demo
```

- [ ] **Step 4: Browser audit** — extend `test-results/e2e-2026-09-21/` with a driver that:

1. admin opens an `in_review` case and approval fails while a required doc is missing;
2. after uploading/passing the required doc(s), approval succeeds (`active`);
3. `Issue COE` then `Issue PCV` produce both documents; a second click does not duplicate;
4. `active → transitioning` is blocked until the referral decision is recorded;
5. the CSR download for a closed case is a multi-page PDF named `CSR <controlNo>-<YYYY>-<MM>-<DD>.pdf`.

Expected: all checks pass; screenshot each step.

- [ ] **Step 5: Commit the audit artifacts**

```bash
git add test-results/e2e-2026-09-21/AUDIT.md test-results/e2e-2026-09-21/results.json
git commit -m "test(e2e): lifecycle enforcement audit"
```
