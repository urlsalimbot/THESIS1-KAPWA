# Phase 2: GIS Intake & Beneficiary Registration - Research

**Researched:** 2026-06-19
**Domain:** GIS intake, beneficiary registration, consent management, search, family graph
**Confidence:** HIGH

## Summary

Phase 2 delivers the core beneficiary intake workflow for Kapwa — social workers can register claimants through a dual-mode GIS intake (online/offline) that captures Client Stub fields, family composition, requirements checklist, and assessment notes in a single form. On completion, a consolidated intake transaction creates both a beneficiary record and a case with `control_no` and `status = 'pending_assessment'`. Staff can search beneficiaries with typo-tolerant trigram + BM25 search, view family relationships up to 2 degrees via recursive CTE, and the consent ledger tracks grant/revoke with immediate PII masking on revocation.

**The existing codebase has strong scaffolding:** The IntakePage (`kapwa-client/src/pages/IntakePage.tsx`) already renders the full GIS intake form with offline queuing. The Beneficiary, Household, FamilyMember, ConsentLedger, and Case entities all exist with proper TypeORM decorators and PostgreSQL schema. The `pg_trgm` extension and GIN indexes (`idx_beneficiary_search`, `idx_beneficiary_name_trgm`) are already set up. The `findAll()` method in `BeneficiariesService` already implements basic `tsvector` + `ILIKE` search. The `getFamilyGraph()` endpoint and `family-graph` API function exist.

**What must be built/refactored:**
- **Consolidated intake transaction** (GIS-01, GIS-03): The IntakePage currently POSTs raw data to `/cases` but does not create the Beneficiary + Household + FamilyMembers + Case in one atomic transaction. Need a new `POST /intake` endpoint that wraps all creates in a DB transaction.
- **Category column** (GIS-06): No `category` field exists on `Beneficiary` entity. Need migration + schema update.
- **No standalone PATCH** (GIS-02): Beneficiaries controller already has `update()` but no exposed route. Must enforce that beneficiary edits only happen during active intake sessions.
- **Trigram + BM25 search enhancement** (GIS-04): Current search uses `plainto_tsquery` + `ILIKE`. Needs `similarity()` from `pg_trgm` for typo tolerance + `ts_rank()` for BM25-style ranking.
- **Recursive CTE family graph** (GIS-05): Current `getFamilyGraph()` returns flat same-household members only. Needs recursive CTE up to 2 degrees with consent filtering.
- **PII masking on consent revoke** (CON-02): No automatic masking exists. The AbacGuard checks consent but doesn't null PII fields. Need a PII masking interceptor/middleware that nulls PII fields in responses when consent is revoked.
- **Consent revoke endpoint** (CON-01): ConsentLedger has `status` field but no dedicated revoke flow. Need `POST /beneficiaries/:id/consent/revoke`.
- **Offline sync for intake** (SYNC-02): IntakePage already queues to `offline-queue.ts` for offline mode — but the sync path goes to `/cases` table. Needs to support the consolidated intake structure.

**Primary recommendation:** Build the server-side consolidated intake endpoint first, then beneficiary search enhancement, then consent/PII masking, then family graph, then offline sync coverage.

<user_constraints>
## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for Phase 2. The following constraints are derived from the phase description and project requirements:

### Locked Decisions (from project decisions)
- Brownfield build on existing Kapwa codebase
- Offline-first with SQLCipher
- Post-disbursement intervention logging
- MinIO for document storage
- ABAC + consent ledger for access control

### the agent's Discretion
- Intake endpoint design (single consolidated transaction vs. multiple calls)
- Search algorithm details (trigram similarity threshold, ranking function weights)
- Family graph visualization component approach (custom vs. library)
- Phase partitioning into plans

### Deferred Ideas (OUT OF SCOPE)
- Full PhilSys/DSWD API integration (CSV/PDF export sufficient for v1)
- Real-time chat between beneficiaries and staff
- Scheduling/appointment system
- Full LGU-wide financial management
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GIS-01 | Dual-mode GIS intake online/offline capturing Client Stub, requirements, family, assessment | IntakePage.tsx exists with full form + offline queue. Need consolidated server endpoint |
| GIS-02 | Profile fields editable ONLY during active intake — no standalone PATCH | `BeneficiariesController` has no PATCH route exposed. `BeneficiariesService.update()` exists but is unused |
| GIS-03 | Intake completion generates case with control_no and status='pending_assessment' | `CasesService.generateControlNo()` + `CaseStatus.PENDING` exist. Need to wire into consolidated intake |
| GIS-04 | Search by name/category/barangay with trigram + BM25 typo tolerance | `findAll()` has basic search. `pg_trgm` + GIN indexes exist. Need `similarity()` enhancement |
| GIS-05 | Family graph via recursive CTE up to 2 degrees, consent-filtered | `getFamilyGraph()` returns flat same-household only. Need recursive CTE rewrite |
| GIS-06 | Beneficiary categorization by type (Senior, PWD, Child, Solo Parent, etc.) | No `category` column on `Beneficiary` entity. Need migration |
| CON-01 | Consent ledger with grant/revoke tracking per beneficiary | `ConsentLedger` entity exists with `status` + `revokedAt`. No revoke endpoint |
| CON-02 | Revoked consent = immediate UI masking or null return on PII fields | `AbacGuard` checks consent but doesn't mask. Need PII masking interceptor |
| SYNC-02 | All core workflows function offline; delta sync on reconnect | IntakePage already queues to offline-queue. Consolidated intake payload must be sync-friendly |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| GIS intake form rendering | Browser / Client | — | React form in IntakePage; offline queue via localStorage |
| Consolidated intake transaction | API / Backend | — | Creates Beneficiary + Household + FamilyMembers + Case atomically |
| control_no generation | API / Backend | — | CasesService.generateControlNo() with SERIALIZABLE isolation |
| Beneficiary search (trigram+BM25) | Database / Storage | API / Backend | PostgreSQL pg_trgm similarity + ts_rank at DB level |
| Family graph (recursive CTE) | Database / Storage | API / Backend | Recursive CTE query executed by TypeORM |
| Consent ledger CRUD | API / Backend | — | ConsentLedger entity + service methods |
| PII masking on consent revoke | API / Backend | Browser / Client | Server-side interceptor nulls PII; client may also check locally for offline |
| Beneficiary categorization | API / Backend | — | category field on Beneficiary entity, set at intake creation |
| Offline queuing for intake | Browser / Client | — | localStorage-based offline-queue.ts already handles this |
| Graph visualization rendering | Browser / Client | — | React component renders family tree from API data |

## Standard Stack

This phase adds NO new npm packages. All work uses the existing stack.

### Core (existing — no changes)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| NestJS + TypeORM | 11.x / 0.4 alpha | Backend framework + ORM | Existing; no changes needed |
| PostgreSQL 16 | 16 | Database with pg_trgm, pgcrypto | Existing extensions already installed |
| TypeScript 5.3+ | 5.3+ | Both client and server | Existing |
| React 18 + Tailwind | 18 / 3.4 | UI framework + styling | Existing; IntakePage uses these |
| SWR | 2.2 | Stale-while-revalidate data fetching | Existing client lib |
| Zod | 3.22 | Schema validation | Existing at API boundary |

### Supporting (existing — no changes)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pg_trgm` | PostgreSQL ext | Trigram similarity + GIN index | Search enhancement (already installed in migrate.ts) |
| `uuid-ossp` | PostgreSQL ext | UUID generation | Existing primary key strategy |
| TypeORM QueryBuilder | — | Building parameterized queries | Existing pattern in BeneficiariesService |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recursive CTE in PostgreSQL | Application-level recursion | CTE is single query, no N+1, runs at DB level. Application recursion adds latency and complexity |
| Server-side PII masking interceptor | Client-side conditional rendering | Server-side masking protects all consumers (API, sync, exports). Client-side is an additional layer |
| Custom family graph component | d3.js / react-flow / cytoscape | Up to 2 degrees = simple tree. Custom Tailwind component avoids adding 100KB+ dependency for a basic use case |

**Installation:** No new packages required.

**Version verification:** Confirm existing pg_trgm extension:
```bash
# Already in migrate.ts: CREATE EXTENSION IF NOT EXISTS "pg_trgm"
# Already in migration: CREATE EXTENSION IF NOT EXISTS "pg_trgm"
```

## Package Legitimacy Audit

No new packages are installed in Phase 2. All work uses:
- Existing npm packages (already verified in Phase 1)
- Built-in PostgreSQL extensions (pg_trgm, uuid-ossp, pgcrypto — all verified)
- Existing TypeORM + NestJS patterns

**Packages added:** None
**Packages flagged as suspicious:** None

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Client (Browser / PWA)                        │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    IntakePage.tsx                              │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌─────────────────────┐   │   │
│  │  │ Client Stub  │ │Family Comp.  │ │Requirements + Notes │   │   │
│  │  │ (surname,    │ │(add/remove   │ │(checklist,          │   │   │
│  │  │  firstName,  │ │ members,     │ │ signature, consent)  │   │   │
│  │  │  gender, etc)│ │ relationship)│ │                     │   │   │
│  │  └──────┬───────┘ └──────┬───────┘ └──────────┬──────────┘   │   │
│  │         └────────────────┴────────────────────┘               │   │
│  │                            │                                   │   │
│  │                    Online? │ yes → POST /api/intake             │   │
│  │                    no  → queueChange('intake', ...)            │   │
│  └────────────────────────────┴──────────────────────────────────────┘
│                                                                      │
│  ┌────────────────────────────┐    ┌────────────────────────────┐   │
│  │  BeneficiariesPage.tsx      │    │  BeneficiaryViewPage.tsx    │   │
│  │  (search by name/category/  │    │  (profile + family graph   │   │
│  │   barangay with trigram)    │    │   + consent management)    │   │
│  └────────────────────────────┘    └────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │ HTTP / offline queue
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     API / Backend (NestJS 11)                        │
│                                                                      │
│  ┌────────────────────────────┐                                      │
│  │  POST /api/intake           │ ← NEW: Consolidated intake           │
│  │  - Creates Beneficiary     │    in DB transaction                 │
│  │  - Creates Household       │                                      │
│  │  - Creates FamilyMembers   │                                      │
│  │  - Creates Case            │                                      │
│  │  - Creates ConsentLedger   │                                      │
│  └────────────────────────────┘                                      │
│                                                                      │
│  ┌────────────────────────────┐    ┌────────────────────────────┐   │
│  │  BeneficiariesController    │    │  CasesController            │   │
│  │  GET  /              search│    │  POST /              create│   │
│  │  GET  /:id            view │    │  PATCH /:id/status  update │   │
│  │  GET  /:id/family-graph    │    └────────────────────────────┘   │
│  │  POST /:id/consent/revoke  │ ← NEW                              │
│  └────────────────────────────┘                                     │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  AbacGuard (existing)                                          │   │
│  │  Checks consent status before returning data                   │   │
│  │  → PiiMaskingInterceptor (NEW): Nulls surname, firstName,      │   │
│  │    middleName, address, phone, dob, philsysNumber in response  │   │
│  │    when consent_ledger.status = 'revoked'                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │ TypeORM
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     PostgreSQL 16                                     │
│                                                                      │
│  beneficiaries table:                                                │
│  surname, first_name, middle_name, gender, dob, address, phone,      │
│  philsys_number, barangay, category ← NEW, search_vector,            │
│  consent_status, household_id                                         │
│  GIN indexes: idx_beneficiary_search (search_vector),                 │
│               idx_beneficiary_name_trgm (surname, first_name)        │
│                                                                      │
│  Family graph: Recursive CTE:                                        │
│  WITH RECURSIVE family_tree AS (                                     │
│    SELECT ... FROM households WHERE primary_beneficiary_id = X       │
│    UNION                                                             │
│    SELECT ... FROM family_members fm                                  │
│    JOIN family_tree ft ON ... and depth < 2                          │
│  ) WHERE consent_status = 'active'                                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
kapwa-server/src/
├── intake/                       # NEW: Consolidated intake module
│   ├── intake.module.ts
│   ├── intake.controller.ts
│   ├── intake.service.ts
│   └── dto/intake.zod.ts
├── beneficiaries/                # ENHANCED: Add category, search, family graph
│   ├── beneficiaries.service.ts  # Enhanced findAll() with trigram similarity
│   ├── beneficiaries.controller.ts  # Add consent revoke endpoint
│   ├── beneficiary.entity.ts     # Add category column
│   └── dto/beneficiaries.zod.ts  # Add category to schema
├── beneficiaries/pii.interceptor.ts  # NEW: PII masking interceptor
└── database/migrations/
    └── 20260619000002-phase2-gis-intake.ts  # NEW: Migration for category, consent revoke, etc.

kapwa-client/src/
├── pages/
│   ├── IntakePage.tsx            # ENHANCED: Updated for consolidated intake
│   └── BeneficiaryViewPage.tsx   # ENHANCED: Family graph visualization + consent controls
├── components/
│   ├── family/FamilyGraph.tsx    # NEW: Family tree visualization component
│   └── consent/ConsentManager.tsx # NEW: Grant/revoke consent UI
└── lib/
    └── api.ts                    # Enhanced: Add intake, consent revoke, search endpoints
```

### Pattern 1: Consolidated Intake Transaction
**What:** Single endpoint that creates Beneficiary + Household + FamilyMembers + Case + ConsentLedger in one TypeORM transaction. If any step fails, the entire transaction rolls back.
**When to use:** GIS intake submission (online path) — the core workflow of Phase 2.
**Key design:**
```
POST /api/intake
Body: {
  beneficiary: { surname, firstName, middleName, gender, dob, barangay, purok, phone, category },
  familyMembers: [{ fullName, relationship, age, statusIncome }],
  case: { serviceRequested: string[], requirementsChecklist: {...}, assessedBy, workerSignature }
}
Response: {
  beneficiaryId, caseId, controlNo: "KAPWA-2026-00001", status: "pending_assessment"
}
```
**Implementation note:** The `IntakeService` uses `QueryRunner` with `startTransaction()` and `commitTransaction()`. The Case's `controlNo` is generated via `CasesService.generateControlNo()` within the same transaction.

### Pattern 2: Trigram + BM25 Search Enhancement
**What:** Enhance the existing `BeneficiariesService.findAll()` to use `similarity()` from `pg_trgm` for typo tolerance paired with `ts_rank()` for relevance scoring.
**When to use:** Any beneficiary search across name, category, and barangay.
**Key changes:**
```typescript
// Instead of plainto_tsquery + ILIKE:
qb.andWhere(
  `b.surname % :search OR b.first_name % :search 
   OR similarity(b.surname, :search) > 0.3 
   OR similarity(b.first_name, :search) > 0.3
   OR b.search_vector @@ plainto_tsquery(:search)`,
  { search }
);
qb.addSelect(
  `GREATEST(
    similarity(b.surname, :search2), 
    similarity(b.first_name, :search2),
    ts_rank(b.search_vector, plainto_tsquery(:search2))
  )`, 
  'rank'
);
qb.orderBy('rank', 'DESC');
```
- `%` operator requires `pg_trgm` (already installed)
- `similarity()` returns 0.0–1.0 score; threshold > 0.3 catches typos
- `ts_rank()` provides BM25-style relevance for exact/partial matches
- Combined index (`idx_beneficiary_name_trgm` + `idx_beneficiary_search`) covers both paths

### Pattern 3: Recursive CTE Family Graph
**What:** Replace `getFamilyGraph()`'s flat household query with a recursive CTE that navigates up to 2 degrees of relationship through the `households` and `family_members` tables, filtered by consent status.
**When to use:** Family graph endpoint for beneficiary detail view.
**Key SQL:**
```sql
WITH RECURSIVE family_tree AS (
  -- Base: direct household members of the beneficiary
  SELECT fm.id, fm.full_name, fm.relationship, fm.age, fm.status_income,
         fm.is_primary, fm.household_id, 0 AS depth
  FROM family_members fm
  JOIN households h ON h.id = fm.household_id
  WHERE h.primary_beneficiary_id = :beneficiaryId
  
  UNION
  
  -- Recursive: members of households connected through existing family members
  SELECT fm.id, fm.full_name, fm.relationship, fm.age, fm.status_income,
         fm.is_primary, fm.household_id, ft.depth + 1
  FROM family_members fm
  JOIN family_tree ft ON ft.household_id != fm.household_id
  JOIN households h ON h.id = fm.household_id
  WHERE ft.depth < 2
    AND EXISTS (
      SELECT 1 FROM beneficiaries b
      WHERE b.household_id = fm.household_id
        AND b.consent_status = 'active'
    )
)
SELECT DISTINCT id, full_name, relationship, age, status_income, is_primary, depth
FROM family_tree
ORDER BY depth, is_primary DESC, full_name;
```
**Note:** The existing `idx_consent_beneficiary` and `idx_beneficiary_user` indexes support this.

### Pattern 4: PII Masking Interceptor
**What:** A NestJS interceptor that intercepts all responses containing beneficiary data and nulls PII fields (`surname`, `firstName`, `middleName`, `address`, `phone`, `dob`, `philsysNumber`) when the beneficiary's consent status is `revoked`.
**When to use:** On every response that includes beneficiary data — the interceptor applies globally to beneficiary routes.
**Key design:**
```typescript
@Injectable()
export class PiiMaskingInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(ConsentLedger)
    private consentRepo: Repository<ConsentLedger>,
  ) {}
  
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    return next.handle().pipe(
      map(async (data) => {
        if (Array.isArray(data)) {
          return Promise.all(data.map(item => this.maskPii(item)));
        }
        return this.maskPii(data);
      }),
    );
  }
  
  private PII_FIELDS = ['surname', 'firstName', 'middleName', 'address', 'phone', 'dob', 'philsysNumber'];
  
  private async maskPii(data: any): Promise<any> {
    if (!data || !data.id) return data;
    const consent = await this.consentRepo.findOne({
      where: { beneficiaryId: data.id, status: 'revoked' },
    });
    if (consent) {
      for (const field of this.PII_FIELDS) {
        if (field in data) data[field] = null;
      }
    }
    return data;
  }
}
```

### Anti-Patterns to Avoid
- **Adding PATCH /beneficiaries/:id** — GIS-02 explicitly prohibits standalone profile edits. All modifications must go through the intake session flow.
- **Synchronous offline check** — The IntakePage must first try the online path, fall back to offline queue on network failure, not block on connectivity check.
- **Flat family query without recursion** — The current `getFamilyGraph()` returns only same-household members. GIS-05 requires 2-degree traversal.
- **Client-side-only PII masking** — The server must null PII fields in responses (not just hide in UI). The offline-queue already stores encrypted data, but the server response is the canonical data source.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Typo-tolerant search | Custom Levenshtein algorithm | PostgreSQL `pg_trgm` similarity() + GIN index | Already installed; `%` operator and `similarity()` are production-tested for typo correction |
| Full-text relevance ranking | TF-IDF from scratch | PostgreSQL `ts_rank()` | BM25-style ranking built into PostgreSQL; already used in existing search |
| Multi-table atomic transaction | Manual rollback logic | TypeORM `QueryRunner` with transaction | Existing pattern in `CasesService.generateControlNo()` with SERIALIZABLE isolation |
| Family tree navigation | N+1 queries in application code | Recursive CTE | Single query, bounded depth (2 degrees), DB-level optimization |
| Generic PII masking per response | Per-controller masking logic | NestJS `Interceptor` | Cross-cutting concern handled once, applies to all beneficiary routes automatically |

**Key insight:** Each of these hand-roll candidates (search scoring, transaction management, tree traversal, response transformation) has subtle edge cases that the existing PostgreSQL features, TypeORM patterns, and NestJS interceptors already handle correctly.

## Common Pitfalls

### Pitfall 1: Intake Transaction Partial Failure
**What goes wrong:** Beneficiary is created but Case creation fails — orphaned records with no case.
**Why it happens:** Multiple POST calls (one to create beneficiary, another to create case) without a wrapping transaction.
**How to avoid:** Use TypeORM `QueryRunner` with `startTransaction('SERIALIZABLE')` similar to the existing `CasesService.generateControlNo()`. If any step fails, `rollbackTransaction()` undoes all creates.
**Warning signs:** Beneficiaries with no associated case in the database; cases with no beneficiary reference.

### Pitfall 2: Offline Intake Lost on Browser Storage Clear
**What goes wrong:** A social worker fills out an intake form offline but the queued change is lost when the browser/localStorage is cleared.
**Why it happens:** The offline queue (`offline-queue.ts`) stores in `localStorage` which is cleared on browser data reset.
**How to avoid:** This is an accepted risk for the browser fallback. On native Capacitor mobile, `SecureStorage` uses SQLCipher which persists through app reinstalls when key is derived from user password. Document this limitation for the browser PWA path.
**Warning signs:** N/A — expected behavior for browser storage.

### Pitfall 3: Trigram Similarity False Positives with Short Names
**What goes wrong:** Searching "Jo" returns hundreds of results (Jose, Juan, Joel, John, Jon, etc.) with high similarity.
**Why it happens:** `pg_trgm` similarity is high for short strings — "Jo" has only 2 trigrams and matches many 3-letter+ names.
**How to avoid:** Set a minimum query length (3 characters) for trigram matching, or combine with `tsvector` full-text search which requires whole word tokens. Use `strict_word_similarity()` instead of `similarity()` for short queries.
**Warning signs:** Search results seem unreasonably broad for short queries.

### Pitfall 4: Recursive CTE Infinite Loop
**What goes wrong:** The recursive CTE enters an infinite loop because of circular family relationships (e.g., two beneficiaries in different households that reference each other as family members).
**Why it happens:** Family_members links to households, and a person can appear in multiple households (e.g., spouse in one, parents in another).
**How to avoid:** Use bounded recursion (`WHERE depth < 2`) and track visited `beneficiary_id` values with an array `visited_ids` to prevent cycles. The existing `FAMILY_MEMBER_LIMIT = 50` in `BeneficiariesService` is a useful guard.
**Warning signs:** Hanging queries, PostgreSQL process at 100% CPU during family graph requests.

### Pitfall 5: Consent Ledger Without Revoke Reason
**What goes wrong:** Consent is revoked but there's no record of WHY — auditor finds a consent gap but can't determine if it was voluntary.
**Why it happens:** The `ConsentLedger` entity has `purpose`, `channel`, `status`, `granted_at`, `revoked_at` but no `revoked_reason` field.
**How to avoid:** Add a `revoked_reason` column (nullable text) to the consent_ledger table and require it on revoke (e.g., "Beneficiary requested", "Data expired", "Administrative").
**Warning signs:** Audit log for revoked consent shows no context field.

## Code Examples

### Example 1: Consolidated Intake Endpoint
```typescript
// Source: Derived from existing CasesService.create() + BeneficiariesService.createBeneficiary() patterns
// File: kapwa-server/src/intake/intake.service.ts

@Injectable()
export class IntakeService {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
    @InjectRepository(Beneficiary) private benRepo: Repository<Beneficiary>,
    @InjectRepository(Household) private hhRepo: Repository<Household>,
    @InjectRepository(FamilyMember) private fmRepo: Repository<FamilyMember>,
    @InjectRepository(Case) private caseRepo: Repository<Case>,
    @InjectRepository(ConsentLedger) private consentRepo: Repository<ConsentLedger>,
    private casesService: CasesService,
  ) {}

  async submitIntake(data: IntakeInput) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');
    
    try {
      // 1. Create Beneficiary
      const ben = queryRunner.manager.create(Beneficiary, {
        surname: data.beneficiary.surname,
        firstName: data.beneficiary.firstName,
        middleName: data.beneficiary.middleName,
        gender: data.beneficiary.gender,
        dob: data.beneficiary.dob,
        address: `${data.beneficiary.purok ? data.beneficiary.purok + ', ' : ''}${data.beneficiary.barangay}`,
        phone: data.beneficiary.phone,
        category: data.beneficiary.category,
        consentStatus: 'active',
      });
      const savedBen = await queryRunner.manager.save(ben);
      
      // 2. Create Household with primary beneficiary
      const hh = queryRunner.manager.create(Household, {
        primaryBeneficiaryId: savedBen.id,
        barangay: data.beneficiary.barangay,
      });
      const savedHh = await queryRunner.manager.save(hh);
      
      // Link beneficiary to household
      savedBen.householdId = savedHh.id;
      await queryRunner.manager.save(savedBen);
      
      // 3. Create Family Members
      if (data.familyMembers?.length) {
        const members = data.familyMembers.filter(m => m.fullName.trim()).map(m => 
          queryRunner.manager.create(FamilyMember, {
            householdId: savedHh.id,
            fullName: m.fullName,
            relationship: m.relationship,
            age: m.age,
            statusIncome: m.statusIncome,
          })
        );
        await queryRunner.manager.save(members);
      }
      
      // 4. Generate control_no and create Case
      const controlNo = await this.casesService.generateControlNo(); // extracted as public
      const c = queryRunner.manager.create(Case, {
        controlNo,
        beneficiaryId: savedBen.id,
        serviceRequested: data.case.serviceRequested,
        requirementsChecklist: data.case.requirementsChecklist,
        status: CaseStatus.PENDING,
        assignedWorkerId: data.case.assignedWorkerId,
      });
      await queryRunner.manager.save(c);
      
      // 5. Create Consent Ledger entry
      await queryRunner.manager.save(ConsentLedger, {
        beneficiaryId: savedBen.id,
        purpose: 'registration',
        channel: 'web',
        status: 'active',
      });
      
      await queryRunner.commitTransaction();
      
      return {
        beneficiaryId: savedBen.id,
        caseId: c.id,
        controlNo: c.controlNo,
        status: c.status,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
```

### Example 2: Consent Revoke Endpoint
```typescript
// Source: Existing ConsentLedger entity + BeneficiariesController pattern
// File: kapwa-server/src/beneficiaries/beneficiaries.controller.ts

@Post(':id/consent/revoke')
@Roles('admin', 'social_worker')
async revokeConsent(
  @Param('id') id: string,
  @Body(new ZodPipe(RevokeConsentSchema)) body: { reason?: string }
) {
  const ledger = await this.consentRepo.findOne({
    where: { beneficiaryId: id, status: 'active' },
    order: { grantedAt: 'DESC' },
  });
  if (!ledger) {
    throw new NotFoundException('No active consent found for this beneficiary');
  }
  
  ledger.status = 'revoked';
  ledger.revokedAt = new Date();
  if (body.reason) (ledger as any).revokedReason = body.reason;
  await this.consentRepo.save(ledger);
  
  // Also update beneficiary consent_status for quick lookup
  await this.benRepo.update(id, { consentStatus: 'revoked' });
  
  return { status: 'revoked', revokedAt: ledger.revokedAt };
}

// Zod schema for revoke
export const RevokeConsentSchema = z.object({
  reason: z.string().optional(),
});
```

### Example 3: Enhanced Search with Trigram Similarity
```typescript
// Source: PostgreSQL pg_trgm docs + existing BeneficiariesService.findAll()
// File: kapwa-server/src/beneficiaries/beneficiaries.service.ts — enhanced findAll

async findAll(barangay?: string, search?: string, page = 1, limit = DEFAULT_LIST_LIMIT) {
  const qb = this.benRepo.createQueryBuilder('b')
    .leftJoinAndSelect('b.household', 'h');
  
  if (barangay) {
    qb.andWhere('b.address ILIKE :barangay', { barangay: `%${barangay}%` });
  }
  
  if (search && search.length >= 2) {
    // Trigram similarity for typo tolerance, ts_rank for BM25-style ranking
    qb.andWhere(
      `(b.search_vector @@ plainto_tsquery('english', :search)
        OR similarity(b.surname, :search) > 0.3
        OR similarity(b.first_name, :search) > 0.3
        OR b.category ILIKE :categoryMatch)`,
      { search, categoryMatch: `%${search}%` }
    );
    
    // Rank by combined relevance score
    qb.addSelect(`
      COALESCE(
        ts_rank(b.search_vector, plainto_tsquery('english', :search2)), 0
      ) + 
      COALESCE(similarity(b.surname, :search2), 0) + 
      COALESCE(similarity(b.first_name, :search2), 0)
    `, 'rank')
    .orderBy('rank', 'DESC');
    
    qb.setParameters({ search, search2: search });
  }
  
  paginate(qb, page, limit);
  return qb.getMany();
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat family member query (same household) | Recursive CTE (up to 2 degrees) | Phase 2 | Enables cross-household relationship visualization per DSWD standards |
| plainto_tsquery + ILIKE search | Trigram similarity + ts_rank combined | Phase 2 | Typo-tolerant search; "Dela Crus" still finds "Dela Cruz" |
| No beneficiary categorization | category column with typed enum | Phase 2 | Enables program filtering and reporting by beneficiary type |
| Consent check returns boolean | PII masking interceptor auto-nulls fields | Phase 2 | RA 10173 compliance — PII never leaks after revoke |
| No dedicated consent revoke flow | POST /:id/consent/revoke with audit trail | Phase 2 | Full consent lifecycle tracking per CON-01 |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `CasesService.generateControlNo()` can be extracted as a public method for use in IntakeService | Standard Stack | Low — currently private; needs `@public` refactor. Workaround: IntakeService can call CasesService.create() then update |
| A2 | Family relationships beyond 1 degree are stored through shared household_id references | Architecture Patterns | Medium — if family members across different households are linked via `primary_beneficiary_id` instead, the recursive CTE join pattern changes |
| A3 | PII masking interceptor does not cause performance issues on large result sets | Common Pitfalls | Low — beneficiary list queries are paginated (DEFAULT_LIST_LIMIT=100). Consent check per item via IN clause batch, not N+1 |

## Open Questions

1. **How should `CasesService.generateControlNo()` be made reusable?**
   - What we know: Currently private method, uses SERIALIZABLE transaction on the `cases` table.
   - What's unclear: Whether to make it public on CasesService, extract to a shared service, or have IntakeService duplicate the logic.
   - Recommendation: Extract to a shared `SequenceService` — the control_no format `KAPWA-YYYY-XXXXX` will be reused by Access Card codes in Phase 4. Make public on CasesService for now, refactor in Phase 4.

2. **Should the family graph component use a chart library or custom Tailwind?**
   - What we know: The maximum depth is 2 degrees — typically 10-30 nodes. The existing BeneficiaryViewPage already renders a family list.
   - What's unclear: Whether a visual tree (lines connecting nodes) is required per the spec, or a nested list suffices.
   - Recommendation: Start with a simple Tailwind-based tree component (no dependencies). If the UX review asks for lines/connections, add a lightweight SVG-based connector. Avoid d3.js/react-flow for 2-degree depth.

3. **How should the offline intake payload differ from the online one?**
   - What we know: The existing IntakePage builds the same payload for both paths but sends it to `/cases` which expects only Case data.
   - What's unclear: Whether the offline queue should store a consolidated payload (beneficiary + family + case) or the queue processor should call the intake endpoint on sync.
   - Recommendation: Store the consolidated payload in the offline queue (tableName='intake'). The sync processor should call the `POST /api/intake` endpoint instead of direct DB write. This preserves the transactional guarantees.

## Environment Availability

> Skip this section — Phase 2 is purely code/config changes with no new external dependencies. All tools (Node.js, npm, PostgreSQL, TypeORM, NestJS) were verified in Phase 1.

## Validation Architecture

> `workflow.nyquist_validation` is explicitly `true` in config.json.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7 (server) / Vitest 1.2 (client) |
| Config file | `kapwa-server/jest.config.ts` / `kapwa-client/vitest.config.ts` |
| Quick run command | `npm test` in `kapwa-server/` |
| Full suite command | Same as quick (coverage enabled) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GIS-01 | Consolidated intake creates beneficiary + household + family + case atomically | integration | `npm test -- --testPathPattern=intake` | ❌ Wave 0 |
| GIS-02 | No PATCH /beneficiaries/:id endpoint exposed | unit | controller scan | ❌ Wave 0 |
| GIS-03 | Intake generates control_no with format KAPWA-YYYY-XXXXX | unit | `npm test -- --testPathPattern=intake` | ❌ Wave 0 |
| GIS-04 | Trigram search finds "Dela Cruz" when searching "Dela Crus" | integration | `npm test -- --testPathPattern=beneficiaries` | ❌ Wave 0 |
| GIS-05 | Family graph returns up to 2 degrees with consent filter | integration | `npm test -- --testPathPattern=beneficiaries` | ❌ Wave 0 |
| GIS-06 | Beneficiary category enum accepts valid types | unit | `npm test -- --testPathPattern=beneficiaries` | ❌ Wave 0 |
| CON-01 | Consent revoke endpoint changes status and sets revokedAt | integration | `npm test -- --testPathPattern=consent` | ❌ Wave 0 |
| CON-02 | PII fields are nulled in response when consent is revoked | integration | `npm test -- --testPathPattern=pii` | ❌ Wave 0 |
| SYNC-02 | Offline intake queued to storage, sent on reconnect | integration | `npm test -- --testPathPattern=sync` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test` in server directory (quick unit/integration)
- **Per wave merge:** Full suite + manual IntakePage flow test
- **Phase gate:** All automated tests green + manual intake flow (online + offline) verified

### Wave 0 Gaps
- [ ] `tests/intake.service.spec.ts` — covers consolidated intake transaction
- [ ] `tests/beneficiaries.search.spec.ts` — covers trigram + ts_rank search
- [ ] `tests/beneficiaries.family-graph.spec.ts` — covers recursive CTE + consent filter
- [ ] `tests/consent.revoke.spec.ts` — covers consent revoke + PII masking
- [ ] `tests/pii.masking.spec.ts` — covers PII nulling interceptor
- [ ] Vitest tests for IntakePage enhanced form and consent management UI

## Security Domain

> `security_enforcement` is `true` in config.json. ASVS Level 1 applies.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | JWT + passport (existing) |
| V3 Session Management | yes | JWT with tokenVersion (existing) |
| V4 Access Control | yes | RolesGuard + AbacGuard (existing) + new PiiMaskingInterceptor |
| V5 Input Validation | yes | ZodPipe at API boundary (existing) — new Zod schemas for intake, consent revoke |
| V6 Cryptography | yes | Existing AES-256-GCM for offline; pgcrypto for DB |

### Known Threat Patterns for NestJS/PostgreSQL Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| PII leakage via search results | Information Disclosure | PiiMaskingInterceptor nulls PII fields when consent revoked |
| Consent bypass via direct DB access | Tampering | RLS on consent_ledger prevents unauthorized status changes |
| Intake payload injection | Tampering | ZodPipe validates all fields; Zod schemas reject unknown keys |
| Family graph data exposure | Information Disclosure | Recursive CTE includes consent filter clause; AbacGuard checks role before endpoint access |
| Offline queue replay with stale consent | Spoofing | Ed25519 signatures + idempotency keys validate queued changes; consent status rechecked at sync time |

## Sources

### Primary (HIGH confidence)
- **Codebase audit**: All files in `kapwa-server/src/beneficiaries/`, `kapwa-server/src/cases/`, `kapwa-client/src/pages/IntakePage.tsx`, `kapwa-client/src/lib/` — verified by direct file reads
- **Database schema**: `kapwa-server/src/database/migrate.ts` — verified pg_trgm extension, GIN indexes, all entity tables
- **Existing search implementation**: `BeneficiariesService.findAll()` — currently uses `plainto_tsquery` + `ILIKE`
- **Existing family graph**: `BeneficiariesService.getFamilyGraph()` — flat same-household query
- **Consent ledger entity**: `ConsentLedger` — `status`, `grantedAt`, `revokedAt` fields
- **Phase 1 summary files**: All 4 plan summaries verified

### Secondary (MEDIUM confidence)
- PostgreSQL `pg_trgm` documentation — `similarity()`, `%` operator, GIN index behavior [CITED: postgresql.org/docs/16/pgtrgm.html]
- PostgreSQL recursive CTE syntax — `WITH RECURSIVE` with bounded depth [CITED: postgresql.org/docs/16/queries-with.html]
- NestJS Interceptors — `PiiMaskingInterceptor` pattern follows NestJS documentation [CITED: docs.nestjs.com/interceptors]

### Tertiary (LOW confidence)
- None — all findings verified against existing codebase or official PostgreSQL docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all existing stack verified
- Architecture: HIGH — patterns derived directly from existing codebase patterns (CasesService transaction pattern, BeneficiariesService search pattern, AbacGuard consent pattern)
- Pitfalls: MEDIUM — some derived from experience with similar stacks (trigram with short queries, recursive CTE cycles)

**Research date:** 2026-06-19
**Valid until:** 2026-07-19 (stable; all work is on existing stack)

## Implementation Order Recommendation

Based on dependency analysis, build in this order:

### Wave 1: Consolidated Intake Endpoint
1. **Migration**: Add `category` column to beneficiaries table. Add `revoked_reason` to consent_ledger.
2. **IntakeModule**: Create `intake/` module with `IntakeService.submitIntake()` — Atomically creates Beneficiary + Household + FamilyMembers + Case + ConsentLedger
3. **IntakeController**: `POST /api/intake` with Zod validation
4. **Refactor CasesService**: Extract `generateControlNo()` as public method for reuse
5. **Enhanced IntakePage**: Wire the UI to call `POST /api/intake` (not raw `/cases`)

### Wave 2: Search Enhancement
6. **Enhanced findAll()**: Add `similarity()` from pg_trgm + `ts_rank()` combined ranking
7. **Search by category**: Add `category` filter to findAll (exact match + ILIKE from search term)
8. **API function**: Add typed search parameters to `api.ts`

### Wave 3: Consent & PII Masking
9. **Consent revoke endpoint**: `POST /beneficiaries/:id/consent/revoke` with Zod schema
10. **PiiMaskingInterceptor**: Create global interceptor for beneficiary routes
11. **ConsentManager UI component**: Grant/revoke consent controls on BeneficiaryViewPage

### Wave 4: Family Graph
12. **Recursive CTE query**: Replace `getFamilyGraph()` flat query with bounded recursive CTE
13. **FamilyGraph component**: Tailwind-based tree visualization on BeneficiaryViewPage
14. **Consent filter**: Add `consent_status = 'active'` check in CTE

### Wave 5: Offline Sync Coverage
15. **Intake offline queue**: Ensure `queueChange('intake', ...)` stores consolidated payload
16. **Sync processor**: Handle `tableName='intake'` by calling the intake endpoint on sync instead of direct DB insert

### Verification
17. **Integration tests**: All new endpoints tested (intake, search, consent revoke, family graph, PII masking)
