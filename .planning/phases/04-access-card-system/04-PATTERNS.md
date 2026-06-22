# Phase 4: Access Card System — Pattern Map

**Mapped:** 2026-06-22
**Files analyzed:** 13 new/modified files
**Analogs found:** 13 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `kapwa-server/src/access-cards/access-cards.controller.ts` | controller | request-response | `kapwa-server/src/cases/cases.controller.ts` | exact (same role, same flow) |
| `kapwa-server/src/access-cards/access-cards.service.ts` | service | CRUD | `kapwa-server/src/cases/cases.service.ts`, `kapwa-server/src/beneficiaries/beneficiaries.service.ts` | role-match |
| `kapwa-server/src/access-cards/dto/access-cards.zod.ts` | validation/utility | request-response | `kapwa-server/src/cases/dto/cases.zod.ts` | role-match |
| `kapwa-server/src/access-cards/access-cards.service.spec.ts` | test | CRUD | Its existing self | exact (same file) |
| `kapwa-server/src/interventions/interventions.service.ts` | service | CRUD | Itself — modify No Card block (lines 33-39) | exact (in-place edit) |
| `kapwa-server/src/interventions/dto/interventions.zod.ts` | validation/utility | request-response | Itself — add overrideNoCardCheck field | exact (in-place edit) |
| `kapwa-server/src/sync/sync.service.ts` | service | event-driven / sync | Itself — add to tableMap + ALLOWED_COLUMNS | exact (in-place edit) |
| `kapwa-client/src/pages/AccessCardPage.tsx` | page/component | request-response | Itself — rewrite UI | partial (rewrite) |
| `kapwa-client/src/pages/BeneficiaryViewPage.tsx` | page/component | request-response | Itself — add assign card button | exact (in-place edit) |
| `kapwa-client/src/pages/AccessCardPrintView.tsx` | page/component | request-response | `kapwa-client/src/pages/BeneficiaryViewPage.tsx` | role-match (page) |
| `kapwa-client/src/components/cards/AccessCard.tsx` | component | request-response | `kapwa-client/src/components/consent/ConsentManager.tsx` | role-match (component) |
| `kapwa-client/src/lib/api.ts` | utility | request-response | Itself — add assignCard, getBeneficiaryCard functions | exact (in-place edit) |
| `kapwa-client/src/routes.tsx` | config/route | request-response | Itself — add `/beneficiaries/:id/card/print` route | exact (in-place edit) |

## Pattern Assignments

### `kapwa-server/src/access-cards/access-cards.controller.ts` (controller, request-response)

**Action:** REFACTOR — scaffolded controller → D-01 compliance

**Analog:** `kapwa-server/src/cases/cases.controller.ts` (lines 1-92) — BEST MATCH

**Imports pattern** (cases.controller.ts lines 1-14):
```typescript
import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { CasesService } from './cases.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/types';
import { AbacGuard } from '../auth/guards/abac.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
```

**Auth pattern** (cases.controller.ts line 17):
```typescript
@Controller('access-cards')
@UseGuards(JwtAuthGuard, AbacGuard)
export class AccessCardsController {
```

**Endpoint pattern with `@Roles()` + `@Param()` validation** (cases.controller.ts lines 57-61):
```typescript
@Patch(':id/approve')
@Roles('admin')
async approve(@Param('id') id: string, ...) {
```

**POST endpoint with Roles guard** (cases.controller.ts lines 45-49):
```typescript
@Post()
@Roles('admin', 'social_worker')
async create(@Body(new ZodPipe(CreateCaseSchema)) body: CreateCaseInput) {
```

---

### `kapwa-server/src/access-cards/access-cards.service.ts` (service, CRUD)

**Action:** REFACTOR — `generateCode()` → `generateAndAssign(beneficiaryId)`

**Analog 1:** `kapwa-server/src/cases/cases.service.ts` — `generateControlNo()` transaction pattern (lines 26-48)

**Transaction pattern** (cases.service.ts lines 26-48):
```typescript
async generateAndAssign(beneficiaryId: string): Promise<string> {
  const year = new Date().getFullYear();
  const queryRunner = this.repo.manager.connection.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction('SERIALIZABLE');
  try {
    const result = await queryRunner.manager.query(
      `INSERT INTO access_card_seq (year, created_at) VALUES ($1, NOW()) RETURNING id`,
      [year]
    );
    const seqId = result[0]?.id || 1;
    const code = `NORZ-AC-${year}-${String(seqId).padStart(ACCESS_CARD_PAD_WIDTH, '0')}`;

    // Update beneficiary in same transaction
    await queryRunner.manager.query(
      `UPDATE beneficiaries SET access_card_code = $1 WHERE id = $2`,
      [code, beneficiaryId]
    );

    await queryRunner.commitTransaction();
    return code;
  } catch (e) {
    await queryRunner.rollbackTransaction();
    throw e;
  } finally {
    await queryRunner.release();
  }
}
```

**Analog 2:** `kapwa-server/src/beneficiaries/beneficiaries.service.ts` — `findById` for beneficiary lookup (lines 102-106):
```typescript
async findById(id: string) {
  const ben = await this.benRepo.findOne({ where: { id }, relations: ['household'] });
  if (!ben) throw new NotFoundException('Beneficiary not found');
  return ben;
}
```

**New `findBeneficiaryCard` endpoint pattern** — new query method:
```typescript
async findBeneficiaryCard(beneficiaryId: string) {
  // Fetch beneficiary info + card services
  const ben = await this.repo.query(
    'SELECT id, access_card_code, surname, first_name, barangay FROM beneficiaries WHERE id = $1',
    [beneficiaryId]
  );
  if (!ben?.[0]?.access_card_code) {
    throw new NotFoundException('No access card found for this beneficiary');
  }
  const services = await this.repo.find({
    where: { accessCardCode: ben[0].access_card_code },
    order: { serviceDate: 'DESC' },
  });
  return { beneficiary: ben[0], code: ben[0].access_card_code, services };
}
```

---

### `kapwa-server/src/access-cards/dto/access-cards.zod.ts` (validation/utility, request-response)

**Action:** EXTEND — add AssignCardSchema

**Analog:** Existing self (lines 1-12) + `kapwa-server/src/cases/dto/cases.zod.ts` for schema patterns

**Existing Zod schema pattern** (lines 1-12):
```typescript
import { z } from 'zod';

export const LogServiceSchema = z.object({
  accessCardCode: z.string().min(1),
  serviceRendered: z.string().min(1),
  serviceDate: z.string().min(1),
  cost: z.number().nonnegative().optional(),
  agency: z.string().optional(),
  workerNameSign: z.string().optional(),
});

export type LogServiceInput = z.infer<typeof LogServiceSchema>;
```

**New `AssignCardSchema`** — assign endpoint takes no body, just param:
```typescript
// No body schema needed — POST /assign/:beneficiaryId uses URL param only
// The controller validates with ParseUUIDPipe on the param
```

---

### `kapwa-server/src/access-cards/access-cards.service.spec.ts` (test, CRUD)

**Action:** EXTEND — add generateAndAssign, findBeneficiaryCard tests

**Analog:** Existing self (lines 1-64) — same mocking pattern for repo

**Test mock pattern** (lines 10-24):
```typescript
repoMock = {
  query: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
};
const module: TestingModule = await Test.createTestingModule({
  providers: [
    AccessCardsService,
    { provide: getRepositoryToken(AccessCardService), useValue: repoMock },
  ],
}).compile();
```

**New test pattern for `generateAndAssign`:**
```typescript
describe('generateAndAssign', () => {
  it('generates code and updates beneficiary in single call', async () => {
    repoMock.query
      .mockResolvedValueOnce([{ id: 42 }])  // INSERT into access_card_seq
      .mockResolvedValueOnce([]);            // UPDATE beneficiaries
    const result = await service.generateAndAssign('beneficiary-uuid');
    expect(result).toMatch(/^NORZ-AC-\d{4}-\d{4}$/);
    expect(repoMock.query).toHaveBeenCalledTimes(2);
  });
});
```

---

### `kapwa-server/src/interventions/interventions.service.ts` (service, CRUD)

**Action:** MODIFY — hard No Card block → soft warning with override per D-03

**Analog:** Itself — lines 33-39 (current hard block)

**Current code to replace** (lines 33-39):
```typescript
const beneficiary = await this.caseRepo.query(
  'SELECT access_card_code FROM beneficiaries WHERE id = $1',
  [caseEntity.beneficiaryId],
);
if (!beneficiary?.[0]?.access_card_code) {
  throw new BadRequestException('Beneficiary has no Access Card — No Card, No Voucher');
}
```

**New soft warning pattern** (per RESEARCH.md Pattern 2):
```typescript
const beneficiary = await this.caseRepo.query(
  'SELECT access_card_code FROM beneficiaries WHERE id = $1',
  [caseEntity.beneficiaryId],
);
const hasCard = !!beneficiary?.[0]?.access_card_code;
let warning: string | undefined;

if (!hasCard) {
  if (!data.overrideNoCardCheck) {
    throw new BadRequestException(
      'Beneficiary has no Access Card. Set overrideNoCardCheck=true to proceed.'
    );
  }
  warning = 'Beneficiary has no Access Card — intervention logged without card';
}
```

**Return pattern change** — return warning alongside data:
```typescript
return { intervention: saved, ...(warning ? { warning } : {}) };
```

**Method signature change** — accept override flag:
```typescript
async create(data: Partial<Intervention> & { overrideNoCardCheck?: boolean }, userId: string) {
```

---

### `kapwa-server/src/interventions/dto/interventions.zod.ts` (validation/utility, request-response)

**Action:** EXTEND — add optional `overrideNoCardCheck` field

**Analog:** Itself — lines 1-17

**Existing schema** (lines 1-17) — extend with override flag:
```typescript
export const CreateInterventionSchema = z.object({
  caseId: z.string().uuid(),
  interventionType: z.nativeEnum(InterventionType).default(InterventionType.FA),
  amount: z.number().nonnegative().default(0),
  fundSource: z.nativeEnum(FundSource).default(FundSource.REGULAR),
  serviceDate: z.string().datetime().optional(),
  workerSignatureUrl: z.string().url().optional(),
  clientSignatureUrl: z.string().url().optional(),
  signatureStatus: z.nativeEnum(SignatureStatus).optional(),
  clientReceiptUrl: z.string().url().optional(),
  agency: z.string().optional(),
  voucherNo: z.string().optional(),
  orReference: z.string().optional(),
  overrideNoCardCheck: z.boolean().optional(),     // ← NEW per D-03
});
```

---

### `kapwa-server/src/sync/sync.service.ts` (service, event-driven / sync)

**Action:** MODIFY — add `access_card_services` to tableMap + ALLOWED_COLUMNS

**Analog:** Itself — lines 493-508 (tableMap) + lines 13-37 (ALLOWED_COLUMNS)

**tableMap addition** (lines 493-508) — add entry:
```typescript
private resolveTableName(tableName: string): string {
  const tableMap: Record<string, string> = {
    cases: 'cases',
    beneficiaries: 'beneficiaries',
    interventions: 'interventions',
    programs: 'programs',
    users: 'users',
    households: 'households',
    family_members: 'family_members',
    consent_ledger: 'consent_ledger',
    irf_cases: 'irf_cases',
    notifications: 'notifications',
    sync_queue: 'sync_queue',
    sync_events: 'sync_events',
    access_card_services: 'access_card_services',  // ← ADD
  };
  return tableMap[tableName] || tableName;
}
```

**ALLOWED_COLUMNS** — verify `access_card_code` is already present (line 22):
```typescript
// Already present in ALLOWED_COLUMNS (line 22):
"philsys_number","access_card_code","consent_status",...
```

**Secondary fields to add to ALLOWED_COLUMNS** for `access_card_services`:
```typescript
// Add these column names to ALLOWED_COLUMNS if not present:
"service_rendered", "cost", "worker_name_sign", "intervention_id"
```

---

### `kapwa-client/src/pages/AccessCardPage.tsx` (page/component, request-response)

**Action:** REWRITE — remove standalone generate, add assign workflow + print view + loss workflow

**Analog:** Existing self (lines 1-123) — rewrite entire file

**New page structure pattern** — following `BeneficiaryViewPage.tsx` conventions:
```typescript
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { assignCard, getBeneficiaryCard } from '../lib/api';
```

**Assign UI pattern** — search beneficiary, generate & assign in one step:
```tsx
// New AccessCardPage: assign flow (no standalone generate)
async function handleAssign(beneficiaryId: string) {
  try {
    const result = await assignCard(beneficiaryId);
    // result = { accessCardCode: "NORZ-AC-2026-0042" }
    setAssignedCode(result.accessCardCode);
  } catch (e) {
    console.error(e);
  }
}
```

**Print card button** — navigate to print view:
```tsx
<button 
  onClick={() => navigate(`/beneficiary/${beneficiary.id}/card/print`)}
  className="rounded bg-[#2E5C8A] px-4 py-2 text-xs text-white hover:bg-[#1e3d5e]"
>
  Print Card
</button>
```

---

### `kapwa-client/src/pages/BeneficiaryViewPage.tsx` (page/component, request-response)

**Action:** EXTEND — add "Generate & Assign Card" button in beneficiary detail view

**Analog:** Itself — add button near consent management or in personal info card

**Button insertion point** — in the Personal Info card (after line 199):
```tsx
<div className="mt-4 border-t border-gray-100 pt-4">
  {beneficiary.accessCardCode ? (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs text-gray-500">Access Card</p>
        <p className="font-mono text-sm font-medium text-[#2E5C8A]">
          {beneficiary.accessCardCode}
        </p>
      </div>
      <button
        onClick={() => navigate(`/beneficiary/${id}/card/print`)}
        className="rounded bg-[#2E5C8A] px-3 py-1.5 text-xs text-white hover:bg-[#1e3d5e]"
      >
        Print Card
      </button>
    </div>
  ) : (
    <button
      onClick={handleAssignCard}
      disabled={assigning}
      className="w-full rounded bg-[#2E5C8A] px-4 py-2 text-sm text-white hover:bg-[#1e3d5e] disabled:opacity-50"
    >
      {assigning ? 'Assigning...' : 'Generate & Assign Access Card'}
    </button>
  )}
</div>
```

---

### `kapwa-client/src/pages/AccessCardPrintView.tsx` (page/component, request-response)

**Action:** NEW — printable card view at route `/beneficiary/:id/card/print`

**Analog:** `kapwa-client/src/pages/BeneficiaryViewPage.tsx` — page pattern with hooks, params, API calls

**Print page pattern** — dedicated print route:
```tsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getBeneficiaryCard } from '../lib/api';

export function AccessCardPrintView() {
  const { id } = useParams<{ id: string }>();
  const [card, setCard] = useState<{ code: string; beneficiary: any; services: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getBeneficiaryCard(id)
      .then(setCard)
      .catch(() => setCard(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>;
  if (!card) return <div className="p-8 text-center text-gray-400">No card found</div>;

  return (
    <div className="print-container">
      <div className="no-print">
        <button onClick={() => window.print()} className="...">Print Card</button>
      </div>
      <div className="access-card">
        {/* Card content with service table */}
      </div>
    </div>
  );
}
```

**CSS `@media print` pattern** (from RESEARCH.md Pattern 3):
```css
@media print {
  @page { size: A4 portrait; margin: 15mm; }
  body { background: white; font-size: 10.5pt; }
  .no-print { display: none !important; }
  .access-card { width: 100%; }
  .card-code { font-family: monospace; font-size: 18pt; text-align: center; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #000; padding: 4px 8px; text-align: left; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
```

---

### `kapwa-client/src/components/cards/AccessCard.tsx` (component, request-response)

**Action:** NEW — shared card component for display + print view

**Analog:** `kapwa-client/src/components/consent/ConsentManager.tsx` — component with props, states, API calls

**Component interface pattern** (ConsentManager.tsx lines 14-18):
```typescript
interface AccessCardProps {
  beneficiary: {
    id: string;
    surname: string;
    firstName: string;
    barangay: string;
    accessCardCode: string;
  };
  services: Array<{
    id: string;
    serviceDate: string;
    serviceRendered: string;
    cost?: number;
    agency?: string;
    workerNameSign?: string;
  }>;
  printable?: boolean;
}

export function AccessCard({ beneficiary, services, printable = false }: AccessCardProps) {
  return (
    <div className={`access-card ${printable ? 'print-version' : ''}`}>
      <div className="card-header">
        <h1>MSWDO Norzagaray — Access Card</h1>
        <div className="card-code">{beneficiary.accessCardCode}</div>
      </div>
      <div className="card-body">
        <p><strong>Name:</strong> {beneficiary.surname}, {beneficiary.firstName}</p>
        <p><strong>Barangay:</strong> {beneficiary.barangay}</p>
      </div>
      <table className="service-log">
        <thead>
          <tr><th>#</th><th>Date</th><th>Service</th><th>Cost</th><th>Agency</th></tr>
        </thead>
        <tbody>
          {services.map((s, i) => (
            <tr key={s.id}>
              <td>{i + 1}</td>
              <td>{new Date(s.serviceDate).toLocaleDateString()}</td>
              <td>{s.serviceRendered}</td>
              <td>{s.cost || '-'}</td>
              <td>{s.agency || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

### `kapwa-client/src/lib/api.ts` (utility, request-response)

**Action:** EXTEND — add `assignCard`, `getBeneficiaryCard` functions

**Analog:** Itself — existing API functions (lines 1-214)

**New API functions** — follow existing pattern:
```typescript
// ==== Access Card API ====
export async function assignCard(beneficiaryId: string) {
  return apiFetch(`/access-cards/assign/${beneficiaryId}`, { method: 'POST' });
}

export async function getBeneficiaryCard(beneficiaryId: string) {
  return apiFetch(`/access-cards/beneficiary/${beneficiaryId}/card`);
}
```

---

### `kapwa-client/src/routes.tsx` (config/route, request-response)

**Action:** EXTEND — add print view route

**Analog:** Itself — line 44 (existing AccessCardPage route)

**New route entry** — add after existing AccessCardPage route:
```typescript
import { AccessCardPrintView } from './pages/AccessCardPrintView';

// Add route:
{ path: '/beneficiaries/:id/card/print', element: <Private roles={['admin','social_worker']}><AccessCardPrintView /></Private> },
```

---

## Shared Patterns

### Authentication & Authorization
**Source:** `kapwa-server/src/auth/`
**Apply to:** All controller files (access-cards.controller.ts, existing)

**Guard pipeline pattern** (cases.controller.ts lines 16-17):
```typescript
@UseGuards(JwtAuthGuard, AbacGuard)
// Endpoint-specific role:
@Roles('admin')
```
- `POST /assign/:beneficiaryId` → `@Roles('admin')` (code generation is admin-only)
- `GET /beneficiary/:id/card` → `@Roles('admin', 'social_worker')`
- `POST /log` → already uses `@Roles('admin', 'social_worker')`

---

### Error Handling Pattern
**Source:** `kapwa-server/src/interventions/interventions.service.ts`
**Apply to:** All service files

**Standard exception pattern:**
```typescript
import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
// throw new NotFoundException('Entity not found');
// throw new BadRequestException('Validation message');
```

---

### Zod Validation Pattern
**Source:** `kapwa-server/src/common/pipes/zod.pipe.ts`
**Apply to:** All controller POST/PUT handlers

**Usage pattern** (from interventions.controller.ts line 30):
```typescript
@Body(new ZodPipe(CreateInterventionSchema)) body: CreateInterventionInput
```

---

### Transaction Pattern
**Source:** `kapwa-server/src/cases/cases.service.ts` lines 26-48
**Apply to:** `access-cards.service.ts` — `generateAndAssign()` method

**SERIALIZABLE transaction with QueryRunner:**
```typescript
const queryRunner = this.repo.manager.connection.createQueryRunner();
await queryRunner.connect();
await queryRunner.startTransaction('SERIALIZABLE');
try {
  // ... DB operations ...
  await queryRunner.commitTransaction();
} catch (e) {
  await queryRunner.rollbackTransaction();
  throw e;
} finally {
  await queryRunner.release();
}
```

---

### Client API Fetch Pattern
**Source:** `kapwa-client/src/lib/api.ts`
**Apply to:** All new client API calls

**Standard API function:**
```typescript
export async function assignCard(beneficiaryId: string) {
  return apiFetch(`/access-cards/assign/${beneficiaryId}`, { method: 'POST' });
}
```

---

### Client Offline Sync (Card Operations)
**Source:** `kapwa-client/src/lib/offline-queue.ts`
**Apply to:** Card assign/log operations when offline

**queueChange pattern** (offline-queue.ts lines 44-49):
```typescript
import { queueChange } from '../lib/offline-queue';

await queueChange(
  'access_card_services',
  entryId,
  'INSERT',
  { accessCardCode, serviceRendered, serviceDate, cost, agency }
);
```

---

## No Analog Found

All files have either an exact analog or a role-match analog. No files require external patterns.

| File | Role | Data Flow | Analog Found |
|---|---|---|---|
| `kapwa-client/src/pages/AccessCardPrintView.tsx` | page/component | request-response | Partial — no existing print view. Use RESEARCH.md Pattern 3 for CSS + page layout. |
| `kapwa-client/src/components/cards/AccessCard.tsx` | component | request-response | Good analog from ConsentManager.tsx component pattern |

## Metadata

**Analog search scope:** 
- Server: kapwa-server/src/cases/, src/interventions/, src/beneficiaries/, src/sync/, src/access-cards/
- Client: kapwa-client/src/pages/, src/components/, src/lib/, src/routes.tsx
**Files scanned:** 25+
**Pattern extraction date:** 2026-06-22
