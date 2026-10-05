# Crisis Mode — Optional Program Enrollment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make program enrollment optional in the case workflow by introducing a worker-toggled crisis mode that reduces documentary requirements for ad-hoc services to intervention-anchored minimums, while keeping the review gate intact.

**Architecture:** A `cases.crisis_mode` boolean flag (toggled by the worker) + a new `intervention_required_documents` table defining per-intervention-type documentary minimums. In crisis mode, ad-hoc services (program_id NULL) use intervention-anchored documents; enrolled services still use program-anchored documents; the requirements panel shows the union. The stepper gate is unchanged.

**Tech Stack:** NestJS 11 + TypeORM + Postgres (server), React 19 + Vite + SWR + Tailwind/Radix UI (client), zod DTOs, vitest + jest suites.

**Spec:** `docs/superpowers/specs/2026-10-05-crisis-mode-optional-enrollment-design.md`

## Global Constraints

- Every DB change ships **both** the TypeORM migration (class name ending `…0000000000084`) **and** an idempotent mirror in `kapwa-server/src/database/migrate.ts`. Commit both together.
- Migration key ties at `…62 / …63 / …68` must never gain a 4th entry. Before writing the migration run the tie check from AGENTS.md (must print exactly the three known ties) and confirm `…0083` is the current max (one past: `…0084`).
- Server verification: `npm run typecheck` then `npx jest --silent` (NEVER `npm test`). Client: `npm run typecheck` + `npm run test:run`.
- To restart the dev API: `setsid nohup node dist/main.js … & disown` after killing the old PID (never chain `pkill -f "dist/main.js"` with `&` — it kills the calling shell).
- i18n parity: every new client string goes in `kapwa-client/src/i18n/locales/en/index.ts` AND `fil/index.ts`.
- Commit style: conventional commits; stage explicit paths (never `git add -A`); never commit secrets.
- `case_interventions.program_id` is already nullable — ad-hoc services are already supported in the schema. Crisis mode only adds the documentary minimum for them.

## Review Focus

1. **Crisis mode off → no intervention documents:** with `crisis_mode = false`, ad-hoc services must have zero documentary requirements (current behavior preserved).
2. **Crisis mode on → intervention documents appear:** with `crisis_mode = true`, ad-hoc services must show their intervention-anchored documents in the requirements panel.
3. **Enrolled services unaffected:** interventions with `program_id` must always use program-anchored documents, regardless of crisis mode.
4. **Gate unchanged:** the `assessed → in_review` gate must still require all due steps sealed, including enrollments (via "no program needed" or actual enrollment).
5. **Toggle persistence:** crisis mode must survive a page reload (stored on the case, not in component state).

---

### Task 1: Migration `…0084` + migrate.ts mirror + seed

**Files:**
- Create: `kapwa-server/src/database/migrations/CrisisModeAndInterventionDocuments0000000000084.ts`
- Modify: `kapwa-server/src/database/migrate.ts` (add `crisis_mode` column + `intervention_required_documents` table + seed)

**Interfaces:**
- Produces: `cases.crisis_mode` boolean column; `intervention_required_documents` table with 8 seeded rows.

- [ ] **Step 1: Run the key-tie check and confirm the next key**

Run (from `kapwa-server/src/database/migrations`): `grep -ho "export class [A-Za-z0-9_]*" *.ts | sed 's/export class //' | grep -oE '[0-9]{13}$' | sort -n | uniq -d` and `grep -ho "export class [A-Za-z0-9_]*" *.ts | sed 's/export class //' | grep -oE '[0-9]{13}$' | sort -n | tail -1`
Expected: the dups command prints exactly `0000000000062`/`0000000000063`/`0000000000068`; the tail command prints `0000000000083`. If either differs, STOP and report — do not renumber.

- [ ] **Step 2: Write the migration**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

// Crisis mode (optional program enrollment) + intervention-anchored documentary
// minimums. Mirrored by idempotent statements in migrate.ts.
export class CrisisModeAndInterventionDocuments0000000000084 implements MigrationInterface {
  name = 'CrisisModeAndInterventionDocuments0000000000084';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN crisis_mode BOOLEAN NOT NULL DEFAULT FALSE`);
    await queryRunner.query(`CREATE TABLE intervention_required_documents (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
      intervention_type VARCHAR(32) NOT NULL,
      document_key VARCHAR(64) NOT NULL,
      mandatory BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_intervention_documents ON intervention_required_documents(intervention_type, document_key)`);
    await queryRunner.query(`INSERT INTO intervention_required_documents (intervention_type, document_key) VALUES
      ('medical_assistance', 'medical_certificate'),
      ('medical_assistance', 'hospital_bill'),
      ('burial_assistance', 'death_certificate'),
      ('burial_assistance', 'burial_permit'),
      ('educational_assistance', 'school_registration'),
      ('educational_assistance', 'report_card'),
      ('transportation_assistance', 'travel_request'),
      ('shelter_assistance', 'shelter_request')`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS intervention_required_documents`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS crisis_mode`);
  }
}
```

- [ ] **Step 3: Mirror idempotently in migrate.ts**

Add to `migrate.ts` (near the other `ALTER TABLE cases ADD COLUMN IF NOT EXISTS` statements and the other `CREATE TABLE IF NOT EXISTS` blocks):

```sql
ALTER TABLE cases ADD COLUMN IF NOT EXISTS crisis_mode BOOLEAN NOT NULL DEFAULT FALSE
```
```sql
CREATE TABLE IF NOT EXISTS intervention_required_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  intervention_type VARCHAR(32) NOT NULL,
  document_key VARCHAR(64) NOT NULL,
  mandatory BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)
```
```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_intervention_documents ON intervention_required_documents(intervention_type, document_key)
```
```sql
INSERT INTO intervention_required_documents (intervention_type, document_key)
SELECT * FROM (VALUES
  ('medical_assistance', 'medical_certificate'),
  ('medical_assistance', 'hospital_bill'),
  ('burial_assistance', 'death_certificate'),
  ('burial_assistance', 'burial_permit'),
  ('educational_assistance', 'school_registration'),
  ('educational_assistance', 'report_card'),
  ('transportation_assistance', 'travel_request'),
  ('shelter_assistance', 'shelter_request')
) AS v(intervention_type, document_key)
WHERE NOT EXISTS (SELECT 1 FROM intervention_required_documents WHERE intervention_type = v.intervention_type AND document_key = v.document_key)
```

- [ ] **Step 4: Build and verify on a disposable PG**

```bash
cd kapwa-server && npm run build
dropdb -h /tmp/opencode/kapwa-pg -p 5433 -U kapwa erdgen 2>/dev/null; createdb -h /tmp/opencode/kapwa-pg -p 5433 -U kapwa erdgen
DB_HOST=/tmp/opencode/kapwa-pg DB_PORT=5433 DB_USER=kapwa DB_PASSWORD=kapwa DB_NAME=erdgen node dist/database/migrate.js
psql -h /tmp/opencode/kapwa-pg -p 5433 -U kapwa -d erdgen -At -c "SELECT count(*) FROM intervention_required_documents"
psql -h /tmp/opencode/kapwa-pg -p 5433 -U kapwa -d erdgen -At -c "SELECT column_name FROM information_schema.columns WHERE table_name='cases' AND column_name='crisis_mode'"
dropdb -h /tmp/opencode/kapwa-pg -p 5433 -U kapwa erdgen
```
Expected: bootstrap prints "Marked 87 TypeORM migrations as applied"; the count query prints `8`; the column query prints `crisis_mode`.

- [ ] **Step 5: Confirm the existing suites still pass**

Run: `cd kapwa-server && npm run typecheck && npx jest --silent 2>&1 | tail -3`
Expected: typecheck clean; jest summary PASS (suites count may stay 114).

- [ ] **Step 6: Commit**

```bash
cd /home/typwtypw/Documents/NC/THESIS1-KAPWA
git add kapwa-server/src/database/migrations/CrisisModeAndInterventionDocuments0000000000084.ts kapwa-server/src/database/migrate.ts
git commit -m "feat(schema): crisis mode flag + intervention documentary minimums

cases.crisis_mode (worker-toggled) and intervention_required_documents
(8 seeded intervention→document pairs) so ad-hoc crisis services carry
their own documentary minimum. Mirrored in migrate.ts."
```

---

### Task 2: Server — crisis_mode toggle in updateCaseMeta

**Files:**
- Modify: `kapwa-server/src/cases/dto/cases.zod.ts` (CaseMetaSchema += crisis_mode)
- Modify: `kapwa-server/src/cases/cases.service.ts` (updateCaseMeta handles crisis_mode)
- Modify: `kapwa-server/src/cases/cases.service.spec.ts` (test)

**Interfaces:**
- Consumes: `CaseMetaInput` (already has `courtDocketNumber`, `assignedWorkerId`).
- Produces: `updateCaseMeta` accepts `crisis_mode` and persists it.

- [ ] **Step 1: Write the failing test**

Add to `cases.service.spec.ts` (in the `reassignment moves synced calendar blocks` describe, or a new describe):

```ts
  describe('crisis mode toggle', () => {
    it('sets and clears crisis_mode via the meta endpoint', async () => {
      repoMock.findOne = jest.fn().mockResolvedValue({ id: 'case-1', controlNo: 'MSWD-2026-00002', crisisMode: false, updatedAt: new Date() });
      repoMock.save = jest.fn().mockImplementation((c) => Promise.resolve({ ...c, crisisMode: true }));
      await service.updateCaseMeta('case-1', { crisisMode: true } as any, 'u1');
      expect(repoMock.save).toHaveBeenCalledWith(expect.objectContaining({ crisisMode: true }));
    });
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `cd kapwa-server && npx jest cases.service -t "crisis mode" --silent 2>&1 | tail -4`
Expected: FAIL — `crisisMode` not handled (or property missing).

- [ ] **Step 3: Implement**

In `dto/cases.zod.ts`, extend `CaseMetaSchema`:
```ts
export const CaseMetaSchema = z.object({
  courtDocketNumber: z.preprocess(v => v === '' || v === null || v === undefined ? undefined : v, z.string().optional()),
  // Reassignment surface: when the assigned worker changes, synced calendar
  // blocks move to the new worker (null clears the assignment and removes
  // the blocks).
  assignedWorkerId: z.string().uuid().nullable().optional(),
  crisisMode: z.boolean().optional(),
});
```

In `cases.service.ts` `updateCaseMeta`:
```ts
async updateCaseMeta(id: string, data: CaseMetaInput, actorId?: string) {
  const c = await this.findById(id);
  const prevWorker = c.assignedWorkerId;
  if (data.courtDocketNumber !== undefined) c.courtDocketNumber = data.courtDocketNumber;
  if (data.assignedWorkerId !== undefined) c.assignedWorkerId = data.assignedWorkerId;
  if (data.crisisMode !== undefined) (c as any).crisisMode = data.crisisMode;
  c.updatedAt = new Date();
  const saved = await this.caseRepo.save(c);
  if (data.assignedWorkerId !== undefined && data.assignedWorkerId !== prevWorker) {
    // Reassignment (spec §6): synced case-event blocks follow the worker.
    await this.syncService?.moveForCase(id, data.assignedWorkerId ?? null);
  }
  await this.auditLog?.log('case.meta', id, actorId, data);
  return saved;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd kapwa-server && npx jest cases.service -t "crisis mode" --silent 2>&1 | tail -4`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/src/cases/dto/cases.zod.ts kapwa-server/src/cases/cases.service.ts kapwa-server/src/cases/cases.service.spec.ts
git commit -m "feat(cases): crisis_mode toggle via the meta endpoint"
```

---

### Task 3: Server — intervention_required_documents entity + wiring

**Files:**
- Create: `kapwa-server/src/cases/intervention-required-document.entity.ts`
- Modify: `kapwa-server/src/cases/cases.module.ts` (forFeature += InterventionRequiredDocument)

**Interfaces:**
- Produces: `InterventionRequiredDocument` entity with `interventionType`, `documentKey`, `mandatory`.

- [ ] **Step 1: Write the entity**

```ts
import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

// Documentary minimum for ad-hoc crisis services: each intervention type
// defines its own required documents. Seeded in migration 0084.
@Entity('intervention_required_documents')
export class InterventionRequiredDocument extends BaseEntity {
  @Column({ name: 'intervention_type', type: 'varchar', length: 32 })
  interventionType!: string;

  @Column({ name: 'document_key', type: 'varchar', length: 64 })
  documentKey!: string;

  @Column({ type: 'boolean', default: true })
  mandatory!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
```

- [ ] **Step 2: Register in cases.module.ts**

Add `InterventionRequiredDocument` to the `TypeOrmModule.forFeature([...])` list in `cases.module.ts` (alongside `CaseEvent`).

- [ ] **Step 3: Typecheck**

Run: `cd kapwa-server && npm run typecheck 2>&1 | tail -1`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add kapwa-server/src/cases/intervention-required-document.entity.ts kapwa-server/src/cases/cases.module.ts
git commit -m "feat(cases): intervention_required_documents entity"
```

---

### Task 4: Server — requirements resolution (union of program + intervention documents)

**Files:**
- Modify: `kapwa-server/src/cases/case-step-locks.service.ts` (requirementsMet + linkedProgramIds)
- Modify: `kapwa-server/src/cases/case-step-locks.service.spec.ts` (test)

**Interfaces:**
- Consumes: `InterventionRequiredDocument` repo, `Case.crisisMode`.
- Produces: `requirementsMet` returns true only when every required document (program-anchored for enrolled services + intervention-anchored for ad-hoc services in crisis mode) is met.

- [ ] **Step 1: Write the failing test**

Add to `case-step-locks.service.spec.ts`:

```ts
  describe('crisis-mode requirements', () => {
    it('requires intervention-anchored documents for ad-hoc services in crisis mode', async () => {
      // An ad-hoc medical_assistance in crisis mode must have its documents met.
      findById.mockResolvedValue({ id: 'c1', status: 'enrolled', crisisMode: true });
      interventionCount.mockResolvedValue(1);
      // The intervention has no program → no program documents.
      // But intervention_required_documents has medical_assistance → medical_certificate.
      // The checklist does not have it → requirementsMet = false.
      const done = await service.lock('c1', 'interventions', swUser);
      // Seal should be refused because the intervention document is missing.
      expect(done).rejects.toThrow(/not complete/i);
    });

    it('does not require intervention documents when crisis mode is off', async () => {
      findById.mockResolvedValue({ id: 'c1', status: 'enrolled', crisisMode: false });
      interventionCount.mockResolvedValue(1);
      // No program documents, no intervention documents (crisis off) → seal allowed.
      await expect(service.lock('c1', 'interventions', swUser)).resolves.toBeDefined();
    });
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `cd kapwa-server && npx jest case-step-locks -t "crisis-mode" --silent 2>&1 | tail -4`
Expected: FAIL — intervention documents not considered.

- [ ] **Step 3: Implement**

In `case-step-locks.service.ts`:

1. Add `@InjectRepository(InterventionRequiredDocument)` + constructor param.
2. Add a helper to get ad-hoc intervention types (program_id NULL):
```ts
  private async adHocInterventionTypes(caseId: string): Promise<string[]> {
    const rows = await this.interventions.query(
      'SELECT DISTINCT intervention_type FROM case_interventions WHERE case_id = $1 AND program_id IS NULL AND intervention_type IS NOT NULL',
      [caseId],
    );
    return (rows as Array<{ intervention_type: string }>).map(r => r.intervention_type);
  }
```
3. Update `requirementsMet` to include intervention-anchored documents when `crisisMode` is true:
```ts
  private async requirementsMet(
    caseId: string,
    checklist: Record<string, boolean> | undefined,
    crisisMode: boolean,
  ): Promise<boolean> {
    const programIds = await this.linkedProgramIds(caseId);
    const requiredKeys = new Set<string>();
    if (programIds.length > 0) {
      const programs = await this.programs.find({ where: { id: In(programIds) } });
      for (const p of programs) {
        for (const k of this.requiredDocumentKeys(p)) requiredKeys.add(k);
      }
    }
    if (crisisMode) {
      const adHocTypes = await this.adHocInterventionTypes(caseId);
      if (adHocTypes.length > 0) {
        const docs = await this.interventionDocs.find({ where: { interventionType: In(adHocTypes) } });
        for (const d of docs) requiredKeys.add(d.documentKey);
      }
    }
    if (requiredKeys.size === 0) return true;
    const met = checklist || {};
    return [...requiredKeys].every((key) => met[key] === true);
  }
```
4. Update the call site in `isStepDone` to pass `crisisMode`:
```ts
    const requirementsMet =
      stepKey === 'interventions' && interventionCount > 0
        ? await this.requirementsMet(caseId, c.requirementsChecklist, Boolean((c as any).crisisMode))
        : true;
```

- [ ] **Step 4: Run to verify pass**

Run: `cd kapwa-server && npx jest case-step-locks --silent 2>&1 | tail -4`
Expected: PASS (all tests including the new crisis-mode ones).

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/src/cases/case-step-locks.service.ts kapwa-server/src/cases/case-step-locks.service.spec.ts
git commit -m "feat(steps): crisis-mode requirements include intervention documents"
```

---

### Task 5: Client — crisis-mode toggle + banner

**Files:**
- Modify: `kapwa-client/src/pages/CaseViewPage.tsx` (header toggle + banner)
- Modify: `kapwa-client/src/i18n/locales/en/index.ts` + `fil/index.ts`

**Interfaces:**
- Consumes: `caseData.crisisMode` (from the case detail endpoint).
- Produces: crisis-mode toggle (admin + social_worker only) + banner.

- [ ] **Step 1: Write the failing test**

Add to `CaseViewPage.test.tsx` (or a new `CrisisModeToggle.test.tsx`):

```tsx
  it('shows the crisis-mode toggle for a social worker and toggles it', async () => {
    const api = await import('@/lib/api');
    vi.mocked(api.api.get).mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('cases.detail')) return Promise.resolve({ id: 'c1', crisisMode: false, controlNo: 'MSWD-2026-00002' });
      return Promise.resolve(null);
    });
    vi.mocked(api.api.patch).mockResolvedValue({});
    renderWithProviders(<CaseViewPage />);
    const toggle = await screen.findByRole('button', { name: /Crisis mode/i });
    expect(toggle).toBeTruthy();
    fireEvent.click(toggle);
    await vi.waitFor(() => expect(api.api.patch).toHaveBeenCalledWith(
      '/cases/c1/meta', expect.objectContaining({ crisisMode: true }),
    ));
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `cd kapwa-client && npx vitest run src/pages/CaseViewPage.test.tsx -t "crisis" 2>&1 | tail -4`
Expected: FAIL — toggle not found.

- [ ] **Step 3: Implement**

In `CaseViewPage.tsx`, add to the case header (near the assigned worker):
```tsx
  const canToggleCrisis = ['admin', 'social_worker'].includes(user?.role ?? '');
  // ...
  {canToggleCrisis && (
    <Button
      size="sm"
      variant={caseData?.crisisMode ? 'default' : 'outline'}
      onClick={async () => {
        await api.patch(`/cases/${id}/meta`, { crisisMode: !caseData?.crisisMode });
        await mutate(queryKeys.cases.detail(id));
      }}
    >
      {caseData?.crisisMode ? t('caseView.exitCrisisMode', 'Exit Crisis Mode') : t('caseView.crisisMode', 'Crisis Mode')}
    </Button>
  )}
  {caseData?.crisisMode && (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      {t('caseView.crisisModeBanner', 'Crisis mode — ad-hoc services use intervention-anchored documents.')}
    </div>
  )}
```

Add i18n keys (en + fil):
- `caseView.crisisMode`: "Crisis Mode" / "Crisis Mode"
- `caseView.exitCrisisMode`: "Exit Crisis Mode" / "Lumabas sa Crisis Mode"
- `caseView.crisisModeBanner`: "Crisis mode — ad-hoc services use intervention-anchored documents." / "Crisis mode — ang mga ad-hoc na serbisyo ay gumagamit ng intervention-anchored na dokumento."

- [ ] **Step 4: Run to verify pass**

Run: `cd kapwa-client && npx vitest run src/pages/CaseViewPage.test.tsx 2>&1 | grep -E "Tests |Test Files" | tail -2`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add kapwa-client/src/pages/CaseViewPage.tsx kapwa-client/src/i18n/locales
git commit -m "feat(case-view): crisis-mode toggle + banner"
```

---

### Task 6: Client — requirements panel + stepper predicate

**Files:**
- Modify: `kapwa-client/src/components/case-view/CaseRequirements.tsx` (intervention documents in crisis mode)
- Modify: `kapwa-client/src/lib/case-progress.ts` (interventionRequirementsMet)
- Modify: `kapwa-client/src/components/case-view/CaseRequirements.test.tsx` (test)

**Interfaces:**
- Consumes: `caseData.crisisMode`, `interventions` (with `programId`), `programs` (with `requiredDocumentDetails`).
- Produces: `interventionRequirementsMet` includes intervention-anchored documents for ad-hoc services in crisis mode.

- [ ] **Step 1: Write the failing test**

Add to `CaseRequirements.test.tsx`:

```tsx
  it('shows intervention-anchored documents for ad-hoc services in crisis mode', async () => {
    render(
      <CaseRequirements
        caseId="c1"
        caseData={{ crisisMode: true }}
        userRole="social_worker"
      />,
    );
    expect(await screen.findByText('medical_certificate')).toBeTruthy();
  });

  it('does not show intervention documents when crisis mode is off', async () => {
    render(
      <CaseRequirements
        caseId="c1"
        caseData={{ crisisMode: false }}
        userRole="social_worker"
      />,
    );
    expect(screen.queryByText('medical_certificate')).toBeNull();
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `cd kapwa-client && npx vitest run src/components/case-view/CaseRequirements.test.tsx -t "crisis" 2>&1 | tail -4`
Expected: FAIL — intervention documents not shown.

- [ ] **Step 3: Implement**

In `CaseRequirements.tsx`, extend the `allRequirements` computation:
```tsx
  // In crisis mode, ad-hoc services (programId null) use intervention-anchored documents.
  const adHocTypes = (Array.isArray(interventions) ? interventions : [])
    .filter((i: any) => !i?.programId && i?.interventionType)
    .map((i: any) => i.interventionType);
  const interventionDocs = crisisMode
    ? [...new Set(
        (interventionRequiredDocuments ?? [])
          .filter((d: any) => adHocTypes.includes(d.interventionType))
          .map((d: any) => d.documentKey),
      )]
    : [];
  const allRequirements = [
    ...new Set([...relevantPrograms.flatMap((p) => requiredDocumentKeys(p)), ...interventionDocs]),
  ];
```

Add a SWR fetch for intervention documents:
```tsx
  const { data: interventionRequiredDocuments = [] } = useSWR<any[]>(
    queryKeys.cases.interventionDocuments?.() ?? null,
  );
```

Add the query key in `query-keys.ts`:
```ts
    interventionDocuments: () => memo('cases.intervention-documents', () => ['cases', 'intervention-documents'] as const),
```

In `case-progress.ts`, update `interventionRequirementsMet`:
```ts
export function interventionRequirementsMet(
  interventions: any[],
  programs: any[],
  requirementsChecklist?: Record<string, boolean> | null,
  crisisMode?: boolean,
  interventionDocs?: any[],
): boolean {
  const programIds = [...new Set(interventions.map((i: any) => i?.programId).filter(Boolean))];
  const requiredKeys = [
    ...new Set(
      programs
        .filter((p) => programIds.includes(p.id))
        .flatMap((p) => requiredDocumentKeys(p)),
    ),
  ];
  if (crisisMode && interventionDocs) {
    const adHocTypes = interventions.filter((i: any) => !i?.programId && i?.interventionType).map((i: any) => i.interventionType);
    for (const d of interventionDocs) {
      if (adHocTypes.includes(d.interventionType)) requiredKeys.push(d.documentKey);
    }
  }
  if (requiredKeys.length === 0) return true;
  const met = requirementsChecklist || {};
  return requiredKeys.every((key) => met[key] === true);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd kapwa-client && npx vitest run src/components/case-view/CaseRequirements.test.tsx 2>&1 | grep -E "Tests |Test Files" | tail -2`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add kapwa-client/src/components/case-view/CaseRequirements.tsx kapwa-client/src/lib/case-progress.ts kapwa-client/src/components/case-view/CaseRequirements.test.tsx kapwa-client/src/lib/query-keys.ts
git commit -m "feat(case-view): crisis-mode requirements panel + stepper predicate"
```

---

### Task 7: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Server suite + typecheck**

Run: `cd kapwa-server && npm run typecheck && npx jest --silent 2>&1 | tail -3`
Expected: PASS, no type errors.

- [ ] **Step 2: Client suite + typecheck**

Run: `cd kapwa-client && npm run typecheck && npm run test:run 2>&1 | tail -4`
Expected: PASS.

- [ ] **Step 3: Dev-stack smoke**

Rebuild the API, restart it, and verify the crisis-mode toggle end-to-end:
```bash
cd kapwa-server && npm run build
# kill old API PID, then:
DB_HOST=/tmp/opencode/kapwa-pg DB_PORT=5433 DB_USER=kapwa DB_PASSWORD=kapwa DB_NAME=kapwa_dev PORT=3000 setsid nohup node dist/main.js > /tmp/opencode/kapwa-api.log 2>&1 & disown
```
Then via the API: PATCH `/cases/:id/meta` with `crisisMode: true` → 200; GET the case → `crisisMode: true`; create an ad-hoc intervention → requirements include `medical_certificate`.

- [ ] **Step 4: Push**

```bash
git push origin main
```
Then confirm CI is green.

---

## Self-Review

**1. Spec coverage:** every spec section maps to a task — §3.1 crisis_mode → Task 2; §3.2 intervention_required_documents → Task 1 + 3; §3.3 seeded data → Task 1; §3.4 requirements resolution → Task 4; §4.1 stepper banner/toggle → Task 5; §4.2 requirements panel → Task 6; §4.3 seal predicate → Task 4 + 6; §5.1 client → Task 5 + 6; §5.2 migration → Task 1; §5.3 testing → Task 7. No gaps.

**2. Placeholder scan:** no TBD/TODO; every step carries concrete code or an executable command.

**3. Typeconsistency:** `crisisMode` (client) ↔ `crisis_mode` (server column) — the meta endpoint already maps camelCase to snake_case via the zod schema; `interventionType`/`documentKey` consistent across entity, service, and client; `interventionRequirementsMet` signature extended with `crisisMode` and `interventionDocs` in both the implementation and the test.

**4. Review Focus:** every line has a pinning test — crisis off → no intervention documents (Task 4 test 2); crisis on → intervention documents appear (Task 4 test 1 + Task 6 test 1); enrolled services unaffected (existing tests); gate unchanged (existing gate tests); toggle persistence (Task 5 test + Task 7 smoke).