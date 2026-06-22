# Phase 4: Access Card System — Research

**Researched:** 2026-06-22
**Domain:** Access Card code generation, service logging, loss/replacement workflow, No Card guard
**Confidence:** HIGH

## Summary

Phase 4 builds on an already-scaffolded module with working code generation (`NORZ-AC-YYYY-####`), service logging, entity/DB schema, and a client page. The core work is refactoring the scaffolded module to match D-01 through D-06 decisions, adding the soft-warning No Card guard to the existing interventions service, implementing a browser-print card view, and enabling offline sync for card operations.

**Key changes from scaffolded code:**
1. **`POST /generate`** → **`POST /assign/:beneficiaryId`** — one-step generate-and-assign per D-01
2. **`interventions.service.ts`**: Hard `BadRequestException` → soft warning with `overrideNoCardCheck` per D-03
3. **Client**: New printable card view (browser print dialog per D-06) + identity verification for reprint per D-04
4. **Sync**: `access_card_services` table added to sync service table map
5. **INT-07**: Not touched — deferred per D-05 (interventionId column exists in entity but no logic wired)

**No new npm packages required.** All changes use existing infrastructure (NestJS guards, Zod validation, TypeORM, existing sync protocol).

**Primary recommendation:** Refactor the scaffolded controller/service, add soft warning to interventions service, build printable card component, and wire sync mapping. Three vertical-slice waves: (1) server changes, (2) No Card guard, (3) client print view + sync.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** One-step generate-and-assign. Admin picks beneficiary → system generates code and attaches it to that beneficiary. No standalone generation.
- **D-02:** Digital-first, print-on-demand. No physical card version tracking. Digital service log is the source of truth. All 18+ rows live in DB; card is printed when needed with whatever rows exist.
- **D-03:** Soft warning with override. When `createIntervention` detects beneficiary has no card, API returns a warning but does not block. Worker can proceed.
- **D-04:** Reprintable with identity verification. Code stays permanently tied to beneficiary. No replacement workflow — reprint existing card after verifying claimant identity.
- **D-05:** Auto-append (INT-07) DEFERRED — needs stakeholder discussion. `interventionId` column exists in entity but no logic wired.
- **D-06:** Browser print dialog. No PDF generation. Card view renders as printable page.

### the agent's Discretion
- How to implement the soft warning mechanism (response body field vs. header)
- What "identity verification" looks like for reprint (simple confirmation vs. OTP)
- Print card layout design (columns, rows, branding)
- Client UI flow for assign vs. standalone generate removal

### Deferred Ideas (OUT OF SCOPE)
- INT-07 auto-append — deferred to stakeholder discussion
- Physical card version tracking — not needed per D-02
- PDF generation — browser print per D-06
- Replacement code workflow — code stays tied to beneficiary per D-04
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AC-01 | Generate unique Access Card codes (NORZ-AC-YYYY-####) per beneficiary | Scaffolded `generateCode()` works; needs refactor to accept beneficiaryId + update beneficiary record in one transaction |
| AC-02 | 18-row service log per card with refill/print workflow | Existing `logService()` creates entries; print via `@media print` CSS + `window.print()`; no 18-row limit enforced (digital-first) |
| AC-03 | Loss/replacement workflow with audit trail | Per D-04: reprint existing card with identity verification. No new code generation. Audit trail uses existing CaseHistory or new AccessCardHistory entity |
| AC-04 | "No Card = No Voucher" API guard enforced at intervention logging | Already implemented as hard block in interventions.service.ts line 37-38; needs refactor to soft warning with override per D-03 |
| INT-07 | Auto-append to Access Card service records on intervention creation | DEFERRED per D-05. Entity has unused `interventionId` column — no logic changes |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Card code generation | API / Backend | — | Requires DB sequence (`access_card_seq`) + beneficiary record update in one transaction |
| Card assignment to beneficiary | API / Backend | — | Updates `beneficiaries.access_card_code` — server-authoritative |
| Service logging | API / Backend | — | Creates `access_card_services` rows — server-authoritative |
| No Card warning check | API / Backend | — | Checks `beneficiaries.access_card_code` at intervention creation |
| No Card override flag | Client | API / Backend | Worker sends `overrideNoCardCheck: true` in request body |
| Print card view | Browser / Client | — | CSS `@media print` + `window.print()` — no server-side rendering needed |
| Identity verification | Browser / Client | — | Confirmation dialog; worker already authenticated via JWT |
| Offline sync (card ops) | API / Backend | Client | Existing sync infrastructure; add `access_card_services` to table map |
| Loss/replacement audit | Database | API / Backend | Audit trail in existing CaseHistory or new AccessCardAudit table |

## Standard Stack

### Core — No New Packages Required
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| typeorm | 0.4 alpha | ORM for entity + service operations | Already the project ORM; AccessCardService entity exists |
| zod | 3.22 | Validation for new DTO schemas | Already the validation standard; LogServiceSchema exists |
| @nestjs/common | 11.x | Guards, pipes, decorators | Existing guard pipeline reusable as-is |
| @nestjs/typeorm | 11.x | TypeORM integration | Already the module pattern |
| pg | 8.11 | PostgreSQL client | `access_card_seq` sequence uses raw SQL via repo.query() |

### Supporting — Already Installed
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @nestjs/passport + passport-jwt | 10.0 / latest | JWT auth for role-gated endpoints | All new endpoints use `@UseGuards(JwtAuthGuard, RolesGuard)` |
| zod | 3.22 | Validation for request bodies | LogServiceSchema exists; assign endpoint needs new schema |

**Installation:**
```bash
# No new npm packages required for Phase 4
```

**Version verification:**
```bash
npm view zod version            # 3.22+ (already installed)
npm view typeorm version        # 0.4 alpha (already installed)
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS @media print | react-to-print library | Native CSS is simpler; `window.print()` is already a browser API; react-to-print adds dependency for no benefit when we're not generating PDFs |
| Soft warning via response header | Soft warning via response body field | Header approach is non-standard; response body field (`{ warning: "...", data: {...} }`) is more explicit and easier for client to handle |
| New AccessCardAudit entity | CaseHistory reuse | Loss event is conceptually different from case FSM transitions; separate entity is cleaner but less code reuse |
| OTP for identity verification | Simple confirmation dialog | D-04 says "verify claimant identity" but the worker is already authenticated and authorized; simple confirmation matches the physical office workflow (verifying the person standing in front of you) |

## Package Legitimacy Audit

> **Not required** — Phase 4 installs zero new npm packages. All changes use existing dependencies.

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                      CLIENT (PWA)                         │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │ Beneficiary  │  │ Intervention   │  │ Access Card  │  │
│  │ View Page    │  │ Form           │  │ Page / Print │  │
│  │ (assign btn) │  │ (override flag)│  │ View         │  │
│  └──────┬───────┘  └───────┬────────┘  └──────┬───────┘  │
│         │                  │                   │          │
│  ┌──────▼──────────────────▼───────────────────▼───────┐  │
│  │              lib/api.ts (HTTP client)                │  │
│  │              lib/offline-queue.ts (sync pending)     │  │
│  └─────────────────────┬───────────────────────────────┘  │
└─────────────────────────┬─────────────────────────────────┘
                          │ HTTP
┌─────────────────────────▼─────────────────────────────────┐
│                    SERVER (NestJS)                          │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────────────────┐   │
│  │ AccessCardsModule│  │ InterventionsModule           │   │
│  │                  │  │                              │   │
│  │ assignCard()     │  │ create() [MODIFY: soft warn] │   │
│  │ logService()     │  │  → checks access_card_code   │   │
│  │ findByCard()     │  │  → returns warning + proceeds │   │
│  │ findBeneficiary  │  │  → or blocks if override not │   │
│  │   Card()         │  │    sent                       │   │
│  └────────┬─────────┘  └──────────────────────────────┘   │
│           │                                                │
│  ┌────────▼────────────────────────────────────────────┐  │
│  │  Guard Pipeline (JwtAuthGuard → RolesGuard →         │  │
│  │                     AbacGuard)                       │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Sync Service (tableMap + conflict resolution)       │  │
│  │  ADD: access_card_services → tableMap               │  │
│  │  ADD: access_card_code → ALLOWED_COLUMNS            │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Database: PostgreSQL 16                              │  │
│  │  ┌───────────────────┐  ┌─────────────────────────┐ │  │
│  │  │ access_card_services│  │ beneficiaries           │ │  │
│  │  │ ─ access_card_code  │  │ ─ access_card_code (FK) │ │  │
│  │  │ ─ service_date      │  └─────────────────────────┘ │  │
│  │  │ ─ service_rendered  │  ┌─────────────────────────┐ │  │
│  │  │ ─ cost/agency/worker│  │ access_card_seq         │ │  │
│  │  │ ─ intervention_id   │  │ ─ id (SERIAL → padded) │ │  │
│  │  │   (unused/DEFERRED) │  │ ─ year                  │ │  │
│  │  └───────────────────┘  └─────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

**Data flow (primary use case: assign card to beneficiary):**
1. Admin opens beneficiary detail page
2. Admin clicks "Generate & Assign Access Card"
3. Client POSTs to `POST /access-cards/assign/:beneficiaryId`
4. Server: generates code via `access_card_seq`, updates `beneficiaries.access_card_code` in transaction
5. Returns `{ accessCardCode: "NORZ-AC-2026-0042" }`

**Data flow (secondary: create intervention with No Card override):**
1. Worker fills intervention form for beneficiary without card
2. Client POSTs to `POST /interventions` with `{ ...createData, overrideNoCardCheck: true }`
3. Server checks `access_card_code` — null → adds warning to response but proceeds
4. Returns `{ warning: "Beneficiary has no Access Card", data: { intervention } }`

### Recommended Project Structure
```
kapwa-server/src/access-cards/
├── access-cards.module.ts          # EXTEND: export for sync service import
├── access-cards.controller.ts      # REFACTOR: POST /generate → POST /assign/:id; add GET /beneficiary/:id/card
├── access-cards.service.ts         # REFACTOR: generateAndAssign(beneficiaryId), logService enhancements
├── access-card-service.entity.ts   # READ-ONLY: entity complete
├── dto/
│   ├── access-cards.zod.ts         # EXTEND: add AssignCardSchema
│   └── ...
└── access-cards.service.spec.ts    # EXTEND: add assign tests

kapwa-server/src/interventions/
├── interventions.service.ts        # MODIFY: hard → soft warning, accept overrideNoCardCheck
├── dto/interventions.zod.ts        # EXTEND: add optional overrideNoCardCheck field

kapwa-server/src/sync/
├── sync.service.ts                 # MODIFY: add access_card_services to tableMap
├── conflict-resolver.ts            # READ-ONLY: default resolver handles card_services
└── dto/sync.zod.ts                 # MODIFY: add access_card_code to ALLOWED_COLUMNS

kapwa-client/src/
├── pages/
│   ├── AccessCardPage.tsx          # REWRITE: assign UI, print view, loss workflow
│   ├── BeneficiaryViewPage.tsx     # EXTEND: Add "Generate & Assign Card" button
│   └── AccessCardPrintView.tsx     # NEW: printable card component
├── components/
│   └── cards/
│       └── AccessCard.tsx          # NEW: shared card component (display + print)
└── lib/
    └── api.ts                      # EXTEND: add assignCard, printCard endpoints
```

### Pattern 1: One-Step Generate-and-Assign Transaction
**What:** A single endpoint that generates a card code and assigns it to a beneficiary in one atomic transaction. Uses the existing `access_card_seq` sequence and updates `beneficiaries.access_card_code`.

**When to use:** For the `POST /access-cards/assign/:beneficiaryId` endpoint. Only admin role.

**Implementation approach:**
```typescript
// access-cards.controller.ts
@Post('assign/:beneficiaryId')
@Roles('admin')
@ApiOperation({ summary: 'Generate and assign access card to beneficiary' })
async assignCard(
  @Param('beneficiaryId', new ParseUUIDPipe()) beneficiaryId: string
) {
  const accessCardCode = await this.svc.generateAndAssign(beneficiaryId);
  return { accessCardCode };
}
```

```typescript
// access-cards.service.ts
async generateAndAssign(beneficiaryId: string): Promise<string> {
  const year = new Date().getFullYear();
  const result = await this.repo.query(
    `INSERT INTO access_card_seq (year, created_at) VALUES ($1, NOW()) RETURNING id`,
    [year]
  );
  const seqId = result[0]?.id || 1;
  const code = `NORZ-AC-${year}-${String(seqId).padStart(4, '0')}`;

  // Update beneficiary in same function (or delegate to BeneficiariesService)
  await this.repo.query(
    `UPDATE beneficiaries SET access_card_code = $1 WHERE id = $2`,
    [code, beneficiaryId]
  );

  return code;
}
```

### Pattern 2: Soft Warning with Override
**What:** When `createIntervention` detects beneficiary has no Access Card, the service returns a warning in the response but does NOT throw an exception. The client can override by sending `overrideNoCardCheck: true`.

**When to use:** For the `POST /interventions` endpoint. Per D-03, the warning is informational — the worker decides whether to proceed.

**Implementation approach:**
```typescript
// Modified interventions.service.ts create() — replace throw with warning logic
async create(data: CreateInterventionInput & { overrideNoCardCheck?: boolean }, userId: string) {
  // ... existing case validation ...
  // ... existing duplicate check ...

  // D-03: Soft warning for No Card
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

  // ... existing hash/save logic ...

  const saved = await this.interventionRepo.save(int);
  // Return warning alongside created intervention
  return { intervention: saved, ...(warning ? { warning } : {}) };
}
```

Client-side:
```typescript
// Client sends override flag
const response = await apiFetch('/interventions', {
  method: 'POST',
  body: JSON.stringify({ ...interventionData, overrideNoCardCheck: true }),
});
```

### Pattern 3: Browser Print Card View
**What:** A printable React component styled with `@media print` CSS. Triggered via `window.print()`. No PDF generation.

**When to use:** For the print card button in beneficiary detail page. Worker sees the card on screen, clicks Print, browser print dialog opens.

**Implementation approach:**
```tsx
// AccessCardPrintView.tsx — dedicated route: /beneficiary/:id/card/print
export function AccessCardPrintView() {
  const { id } = useParams();
  const [card, setCard] = useState<{ code: string; beneficiary: any; services: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCard(id).then(setCard).finally(() => setLoading(false)); }, [id]);

  if (loading) return <div>Loading...</div>;
  if (!card) return <div>No card found for this beneficiary</div>;

  return (
    <div className="print-container">
      {/* Screen-only controls */}
      <div className="no-print">
        <button onClick={() => window.print()}>Print Card</button>
      </div>

      {/* Printable card content */}
      <div className="access-card">
        <div className="card-header">
          <h1>MSWDO Norzagaray — Access Card</h1>
          <div className="card-code">{card.code}</div>
        </div>
        <div className="card-body">
          <p><strong>Name:</strong> {card.beneficiary.surname}, {card.beneficiary.firstName}</p>
          <p><strong>Barangay:</strong> {card.beneficiary.barangay}</p>
        </div>
        <table className="service-log">
          <thead>
            <tr><th>#</th><th>Date</th><th>Service</th><th>Cost</th><th>Agency</th></tr>
          </thead>
          <tbody>
            {card.services.map((s, i) => (
              <tr key={s.id}>
                <td>{i + 1}</td>
                <td>{s.serviceDate}</td>
                <td>{s.serviceRendered}</td>
                <td>{s.cost || '-'}</td>
                <td>{s.agency || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

```css
/* Print styles */
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

### Pattern 4: Identity Verification for Reprint
**What:** Per D-04, reprint requires identity verification. The simplest implementation consistent with the physical office workflow: the worker is already authenticated (JWT) and authorized (social_worker/admin). Verification is a confirmation dialog showing the beneficiary name and card code.

**When to use:** When worker clicks "Reprint Card" on a beneficiary who already has a card.

**Implementation approach:**
```typescript
// Client-side confirmation
async function handleReprint(beneficiary: { id: string; surname: string; firstName: string; accessCardCode: string }) {
  const confirmed = window.confirm(
    `Reprint Access Card for ${beneficiary.surname}, ${beneficiary.firstName}?\n\n` +
    `Current card code: ${beneficiary.accessCardCode}\n\n` +
    `Verify claimant identity before proceeding.`
  );
  if (!confirmed) return;
  navigate(`/beneficiary/${beneficiary.id}/card/print`);
}
```

### Pattern 5: Sync Service Table Mapping
**What:** The `access_card_services` table must be added to the sync service's `tableMap` and `ALLOWED_COLUMNS` so offline card operations sync correctly.

**When to use:** One-time modification to `sync.service.ts`.

**Implementation:**
```typescript
// sync.service.ts — add to tableMap
const tableMap: Record<string, string> = {
  // ... existing entries ...
  access_card_services: 'access_card_services',
};

// sync.service.ts — add to ALLOWED_COLUMNS
const ALLOWED_COLUMNS = new Set([
  // ... existing columns ...
  'access_card_code', 'service_rendered', 'service_date', 'cost', 'agency', 'worker_name_sign',
]);
```

### Anti-Patterns to Avoid
- **Standalone code generation:** D-01 says generate-and-assign is one step. Don't keep `POST /generate` as a separate endpoint.
- **Hard-block without override:** Current scaffolded code throws BadRequestException. Change to soft warning per D-03.
- **PDF generation:** D-06 says browser print dialog. Don't install react-pdf or any PDF library.
- **Card version tracking:** D-02 says no physical card versioning. Don't add version columns or history for reprints.
- **Re-verification after confirmation:** Identity verification is "at time of reprint" — don't require separate auth step when worker is already logged in.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Card code sequence | Custom counter logic | PostgreSQL `access_card_seq` table (already exists) | Sequence already scaffolded; uses INSERT...RETURNING id pattern |
| Print dialog | Custom print layout engine | `window.print()` + CSS `@media print` | Browser-native, zero dependencies; D-06 explicitly says browser print |
| Service log table | Custom table component | Existing `@media print` table styling | Simple HTML table with print CSS; no virtual scrolling or complex data grid needed |
| Role-based access | Custom role checks per endpoint | `@Roles()` decorator + RolesGuard | Already the project standard; consistent, declarative |
| Input validation | Manual field checks | ZodPipe + Zod schemas | Already the project standard |
| Offline sync | Custom offline queue for card ops | Existing sync service + tableMap | Card operations are standard INSERT/UPDATE; existing sync infrastructure handles them |

**Key insight:** Phase 4 requires zero new infrastructure. Every pattern is already established in the codebase: Zod validation, JWT guards, offline sync, TypeORM entities. The only "new" work is the soft-warning pattern on interventions (Pattern 2) and the printable card layout (Pattern 3).

## Common Pitfalls

### Pitfall 1: Race Condition on assignCard
**What goes wrong:** Two concurrent assign requests for the same beneficiary create two card sequences but only one code sticks (last write wins on `access_card_code`).
**Why it happens:** The sequence INSERT and beneficiary UPDATE are not wrapped in a DB transaction.
**How to avoid:** Wrap both operations in a transaction using `QueryRunner`. Use `UNIQUE` constraint on `beneficiaries.access_card_code` — the second UPDATE will fail with a constraint violation.
**Warning signs:** Two card codes generated for one beneficiary, or duplicate `access_card_code` errors.

### Pitfall 2: Soft Warning Ignored Client-Side
**What goes wrong:** The API returns a warning but the client ignores it and the worker is not informed that the beneficiary has no card.
**Why it happens:** The warning is in a response field the client doesn't check.
**How to avoid:** The client MUST check for `warning` in the response and display it to the worker. The server enforces this by requiring `overrideNoCardCheck` if no card exists — if the client doesn't send the flag, the request fails with a 400 error.
**Warning signs:** Interventions created silently for beneficiaries without cards.

### Pitfall 3: Print View Shows Wrong Card
**What goes wrong:** The print route loads the wrong beneficiary's card because of a URL parameter mismatch or stale state.
**Why it happens:** The print route doesn't verify that `beneficiary.id` matches the card's beneficiary.
**How to avoid:** The print view should fetch card data by `beneficiaryId` (not by card code) and verify the beneficiary exists and has a card.
**Warning signs:** Printed card shows wrong beneficiary name/code.

### Pitfall 4: Physical 18-Row Limit Confusion
**What goes wrong:** Someone tries to enforce an 18-row max in the DB or service based on the physical card limit.
**Why it happens:** The physical card has 18 rows; the digital system should not replicate this limitation.
**How to avoid:** No row limit in DB or service. The "18-row refill" concept means: when the physical card fills up (18 rows), print a new one with all rows. All rows live in the DB regardless.
**Warning signs:** Service rejects service log entry #19 with an artificial limit.

## Code Examples

### Verified patterns from existing codebase:

### Existing scaffolded generateCode — needs refactor
```typescript
// Source: kapwa-server/src/access-cards/access-cards.service.ts (scaffolded — DELETE and replace)
async generateCode(): Promise<string> {
  const year = new Date().getFullYear();
  const result = await this.repo.query(
    `INSERT INTO access_card_seq (year, created_at) VALUES ($1, NOW()) RETURNING id`,
    [year]
  );
  const seqId = result[0]?.id || 1;
  return `NORZ-AC-${year}-${String(seqId).padStart(4, '0')}`;
}
```
[VERIFIED: codebase scan — access-cards.service.ts lines 15-23]

### Existing hard No Card block in interventions.service.ts — needs refactor
```typescript
// Source: kapwa-server/src/interventions/interventions.service.ts (scaffolded — REPLACE)
const beneficiary = await this.caseRepo.query(
  'SELECT access_card_code FROM beneficiaries WHERE id = $1',
  [caseEntity.beneficiaryId],
);
if (!beneficiary?.[0]?.access_card_code) {
  throw new BadRequestException('Beneficiary has no Access Card — No Card, No Voucher');
}
```
[VERIFIED: codebase scan — interventions.service.ts lines 33-38]

### Existing beneficiary entity with access_card_code
```typescript
// Source: kapwa-server/src/beneficiaries/beneficiary.entity.ts
@Column({ name: 'access_card_code', unique: true, nullable: true })
accessCardCode?: string;
```
[VERIFIED: codebase scan — beneficiary.entity.ts line 33]

### Existing guard pipeline (reusable as-is)
```typescript
// Source: kapwa-server/src/cases/cases.controller.ts
@Controller('cases')
@UseGuards(JwtAuthGuard, AbacGuard)
export class CasesController {
  @Patch(':id/approve')
  @Roles('admin')
  async approve(@Param('id') id: string) { ... }
}
```
[VERIFIED: codebase scan — cases.controller.ts full file]

### Existing sync tableMap — needs extension
```typescript
// Source: kapwa-server/src/sync/sync.service.ts (needs access_card_services added)
const tableMap: Record<string, string> = {
  cases: 'cases',
  beneficiaries: 'beneficiaries',
  interventions: 'interventions',
  // ... access_card_services needs to be added here
};
```
[VERIFIED: codebase scan — sync.service.ts lines 493-508]

### Existing conflict resolver (reusable as-is)
```typescript
// Source: kapwa-server/src/sync/conflict-resolver.ts
// access_card_services falls through to resolveDefault() — client_wins if newer, server_wins if older
// This is correct behavior for service logs (append-only, chronological)
```
[VERIFIED: codebase scan — conflict-resolver.ts full file]

## State of the Art

| Old Approach (Scaffolded) | Current Approach (Phase 4) | When Changed | Impact |
|---------------------------|---------------------------|--------------|--------|
| Standalone POST /generate code | One-step POST /assign/:beneficiaryId | Phase 4 | Prevents orphan card codes; matches D-01 |
| Hard block on No Card (400) | Soft warning with override flag | Phase 4 | Worker decides; matches D-03 |
| No printable card view | CSS @media print + window.print() | Phase 4 | Browser-native print; matches D-06 |
| No sync for access_card_services | Added to sync tableMap + ALLOWED_COLUMNS | Phase 4 | Offline card operations sync correctly |
| Client: generic CRUD page | Client: assign, reprint, print-view pages | Phase 4 | Purpose-built UI for card workflow |

**Deprecated/outdated:**
- `POST /access-cards/generate` — standalone generation removed per D-01
- Hard `BadRequestException` for No Card in interventions.service.ts — replaced with soft warning per D-03
- Generic `AccessCardPage.tsx` generate/log/search UI — replaced with assign workflow + print view

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Identity verification for reprint can be a simple confirmation dialog | Architecture Patterns — Pattern 4 | LOW — Physical office workflow means worker verifies identity in-person; the system just needs a confirmation step |
| A2 | Conflict resolution for access_card_services via default resolveDefault() is correct | Architecture Patterns — Pattern 5 | MEDIUM — If business rules require server-wins for card services, need to add to FINANCIAL_TABLES set in conflict-resolver.ts |
| A3 | No new migration is needed — existing schema covers all columns | Standard Stack | MEDIUM — Entity has all needed columns; only sync table mapping needs code changes |

**All remaining claims are [VERIFIED] via codebase scan (files read directly from disk).**

## Open Questions (RESOLVED)

1. **No Card override field name in DTO**
   - What we know: Client sends an override flag when worker chooses to proceed without card
   - What's unclear: Exact field name — `overrideNoCardCheck`, `skipNoCardCheck`, `proceedWithoutCard`?
   - Recommendation: Use `overrideNoCardCheck: boolean` — explicit about what's being overridden

2. **Print route path**
   - What we know: Print uses browser dialog, not PDF
   - What's unclear: Should print be a dedicated route (`/beneficiary/:id/card/print`) or a modal in the AccessCardPage?
   - Recommendation: Dedicated route — simpler CSS, no modal interaction conflicts with print dialog

3. **Loss/replacement audit trail location**
   - What we know: No replacement workflow per D-04, code stays tied to beneficiary
   - What's unclear: Should reprint events be logged? If so, where — CaseHistory, new AccessCardAudit, or existing audit_trail?
   - Recommendation: Log reprint events to a simple `access_card_audit` table or reuse CaseHistory with a new event type. Defer if not critical.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7 (server) |
| Config file | kapwa-server/jest.config.ts |
| Quick run command | `cd kapwa-server && npx jest --no-coverage --force-exit access-cards interventions` |
| Full suite command | `cd kapwa-server && npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AC-01 | Generate-and-assign creates code + updates beneficiary | unit | `npx jest access-cards.service --testNamePattern="generateAndAssign" -t` | ❌ Wave 0 |
| AC-01 | Code format matches NORZ-AC-YYYY-#### | unit | Already existing test | ✅ |
| AC-02 | logService creates entry with correct fields | unit | Already existing test | ✅ |
| AC-02 | findByCard returns services ordered by date desc | unit | Already existing test | ✅ |
| AC-04 | Soft warning returned when no card + overrideNotSent | unit | `npx jest interventions.service --testNamePattern="no card soft warning" -t` | ❌ Wave 0 |
| AC-04 | Hard block when no card + overrideNotSent | unit | `npx jest interventions.service --testNamePattern="no card hard block" -t` | ❌ Wave 0 |
| AC-03 | Reprint returns same card code for beneficiary | integration | `npx jest access-cards --testNamePattern="reprint" -t` | ❌ Wave 0 |
| AC-02 | Sync tableMap includes access_card_services | unit | `npx jest sync.service --testNamePattern="tableMap" -t` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx jest --no-coverage --force-exit access-cards interventions sync`
- **Per wave merge:** Full suite green
- **Phase gate:** Full suite green before /gsd-verify-work

### Wave 0 Gaps
- [ ] `access-cards.service.spec.ts` — test for `generateAndAssign()` atomic operation
- [ ] `interventions.service.spec.ts` — test for soft warning path (warning returned) and override path (create succeeds)
- [ ] `sync.service.spec.ts` — test for `access_card_services` in tableMap
- [ ] Client print view tests (if client test infrastructure exists)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing JwtAuthGuard (passport-jwt) — no change needed |
| V3 Session Management | yes | Existing JWT with 1h expiry — no change needed |
| V4 Access Control | yes | `@Roles('admin')` on assign endpoint; existing RolesGuard + AbacGuard on interventions |
| V5 Input Validation | yes | ZodPipe on assign endpoint and log service endpoint |
| V6 Cryptography | no | No new crypto requirements; card codes are sequential identifiers, not secrets |
| V8 Data Protection | no | Card codes are not PII; service log data is non-sensitive aggregate data |

### Known Threat Patterns for NestJS + Access Card Domain

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized card assignment | Tampering | `@Roles('admin')` restricts assign to admin only |
| Card code enumeration | Information Disclosure | Card codes are sequential but not secret; they exist on physical cards; this is acceptable for MSWDO workflow |
| Override abuse (No Card guard bypass) | Tampering | Override flag requires intentional client action; audit trail logs the warning + override decision |
| Orphan card codes (generate without assign) | Tampering | One-step generate-and-assign eliminates the race; DB transactional guarantees |
| Print view data exposure | Information Disclosure | Existing AbacGuard + consent gating applies to beneficiary/card data; print view loads via authenticated API call |

## Sources

### Primary (HIGH confidence — all [VERIFIED] via direct filesystem read)
- kapwa-server/src/access-cards/access-cards.service.ts — existing generateCode, logService, findByCard [VERIFIED]
- kapwa-server/src/access-cards/access-cards.controller.ts — existing 4 endpoints [VERIFIED]
- kapwa-server/src/access-cards/access-cards.module.ts — existing module wiring [VERIFIED]
- kapwa-server/src/access-cards/access-card-service.entity.ts — entity with interventionId column [VERIFIED]
- kapwa-server/src/access-cards/dto/access-cards.zod.ts — LogServiceSchema [VERIFIED]
- kapwa-server/src/access-cards/access-cards.service.spec.ts — existing test spec [VERIFIED]
- kapwa-server/src/interventions/interventions.service.ts — No Card hard block (lines 33-38) [VERIFIED]
- kapwa-server/src/interventions/intervention.entity.ts — InterventionType, FundSource, SignatureStatus enums [VERIFIED]
- kapwa-server/src/interventions/dto/interventions.zod.ts — CreateInterventionSchema [VERIFIED]
- kapwa-server/src/beneficiaries/beneficiary.entity.ts — accessCardCode column (line 33) [VERIFIED]
- kapwa-server/src/beneficiaries/beneficiaries.service.ts — findById, update methods [VERIFIED]
- kapwa-server/src/sync/sync.service.ts — tableMap (lines 493-508), ALLOWED_COLUMNS (lines 13-37) [VERIFIED]
- kapwa-server/src/sync/conflict-resolver.ts — FINANCIAL_TABLES set, resolveDefault [VERIFIED]
- kapwa-server/src/database/migrations/1740000000000-InitialSchema.ts — access_card_services table, access_card_seq sequence [VERIFIED]
- kapwa-server/src/auth/guards/abac.guard.ts — guard pipeline [VERIFIED]
- kapwa-server/src/auth/guards/roles.guard.ts — role-based access [VERIFIED]
- kapwa-client/src/pages/AccessCardPage.tsx — existing client UI [VERIFIED]
- kapwa-client/src/routes.tsx — access card route (line 44) [VERIFIED]
- kapwa-server/src/app.module.ts — AccessCardsModule imported (line 73) [VERIFIED]

### Secondary (MEDIUM confidence — WebSearch results)
- CSS @media print patterns — MDN printing guide [CITED: developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Printing]
- NestJS response headers/custom response patterns [CITED: docs.nestjs.com]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all technology already installed and verified; zero new packages needed
- Architecture: HIGH — patterns directly based on existing codebase patterns (guards, sync, Zod, TypeORM)
- Pitfalls: HIGH — based on direct codebase analysis and known patterns in transaction handling, sync mapping, and print rendering

**Research date:** 2026-06-22
**Valid until:** 2026-07-22 (stable)
