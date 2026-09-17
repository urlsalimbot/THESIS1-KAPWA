# 4Ps Integration + Co-Managed National Programs — Design

- **Date:** 2026-09-17
- **Status:** Approved (brainstorm session, 2026-09-17)
- **Scope umbrella:** Gap I from `docs/superpowers/plans/2026-07-30-spec-gap-implementation.md` (4Ps Program Integration) plus the four co-managed national programs (KALAHI-CIDSS, Walang Gutom, UPLIFT, Listahanan/NHTS-PR).

## 1. Objective

Deliver the never-shipped Gap I 4Ps features on top of the now-complete Gap H (household-bound access cards), and add lightweight support for the co-managed national programs the MSWDO facilitates — without duplicating DSWD's own data or disbursement role.

Success criteria:

- A coordinator can open a 4Ps case, generate a 12-month per-member conditionality horizon, and check compliance items off as verified.
- A coordinator can schedule 4Ps payouts, mark them completed/missed/cancelled, and record beneficiary notifications.
- 4Ps + KALAHI-CIDSS + Walang Gutom + UPLIFT exist as selectable programs in the seed catalog with correct legal basis / fund sources / required documents.
- Households carry a single nullable Listahanan/NHTS-PR reference id (no duplication of Listahanan data).
- All existing tests stay green (58 suites / 478 tests server, client vitest), typechecks and lint pass.

## 2. Decisions (from brainstorm)

| Decision | Choice |
|---|---|
| Storage model | Dedicated `case_compliance_items` + `case_payouts` child tables under cases (3NF-aligned), NOT columns on `access_card_services` |
| Generation trigger | Manual "Generate 12-Month Items" button on the compliance page |
| Payout model | Pure tracking ledger — status changes are manual coordinator entries; no compliance % gate enforcement |
| Co-managed programs (KALAHI-CIDSS, Walang Gutom, UPLIFT) | Seed rows only — facilitation/validation role, no new schema |
| Listahanan | Single nullable `households.nhts_pr_id` reference column; shown on household profile, case detail, access card PDF |
| Compliance eligibility | Age-based: 3–18 → school_attendance; <3 or pregnant/`Female spouse` → health_checkup; primary/spouse → fds. Age computed from stored DOB (NOT the `age` getter / a `p.age` column). |

## 3. Data model

New module `kapwa-server/src/fourps/` holds both child entities. Every schema change lands in **both** a TypeORM migration in `src/database/migrations/` and an idempotent statement in `src/database/migrate.ts` (AGENTS.md double-file rule).

### 3.1 Migration `…0000000000057` — `CreateFourPsTables`

```sql
CREATE TABLE IF NOT EXISTS case_compliance_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  case_id UUID REFERENCES cases(id) NOT NULL,
  household_member_id UUID REFERENCES persons(id),
  compliance_type VARCHAR
    CHECK (compliance_type IN ('school_attendance','health_checkup','fds')),
  due_date DATE NOT NULL,
  month_label VARCHAR,
  met BOOLEAN DEFAULT FALSE,
  met_at TIMESTAMP,
  met_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_compliance_dedupe
  ON case_compliance_items(case_id, household_member_id, compliance_type, due_date);
CREATE INDEX IF NOT EXISTS idx_compliance_case ON case_compliance_items(case_id);
CREATE INDEX IF NOT EXISTS idx_compliance_due ON case_compliance_items(due_date);

CREATE TABLE IF NOT EXISTS case_payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  case_id UUID REFERENCES cases(id) NOT NULL,
  cycle_no VARCHAR,
  scheduled_at DATE NOT NULL,
  amount DECIMAL(12,2),
  status VARCHAR DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','completed','missed','cancelled')),
  notified_at TIMESTAMP,
  notified_by UUID REFERENCES users(id),
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payout_case ON case_payouts(case_id);
CREATE INDEX IF NOT EXISTS idx_payout_date ON case_payouts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_payout_status ON case_payouts(status);
```

The unique index `idx_compliance_dedupe` makes "Generate" idempotent — inserts use `INSERT … ON CONFLICT DO NOTHING`.

### 3.2 Migration `…0000000000058` — `AddNhtsPrIdToHouseholds`

```sql
ALTER TABLE households ADD COLUMN IF NOT EXISTS nhts_pr_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_household_nhts ON households(nhts_pr_id)
  WHERE nhts_pr_id IS NOT NULL;
```

Partial unique index keeps multiple NULLs legal (not every household is a 4Ps/Listahanan target).

### 3.3 Entities

- `kapwa-server/src/fourps/fourps-compliance.entity.ts` → `@Entity('case_compliance_items')` with `@Column`s for `caseId`, `householdMemberId`, `complianceType`, `dueDate`, `monthLabel`, `met` (default false), `metAt`, `metBy`, plus `createdAt`/`updatedAt` from `BaseEntity`.
- `kapwa-server/src/fourps/fourps-payout.entity.ts` → `@Entity('case_payouts')` with `caseId`, `cycleNo`, `scheduledAt`, `amount`, `status`, `notifiedAt`, `notifiedBy`, `remarks`.
- `kapwa-server/src/beneficiaries/household.entity.ts` → add `@Column({ name: 'nhts_pr_id', nullable: true }) nhtsPrId?: string;`

## 4. Server — `fourps` module

Structure mirrors existing modules (`ReferralsModule` / `AccessCardsModule`): `fourps.module.ts`, `fourps.service.ts`, `fourps.controller.ts`, `dto/fourps.zod.ts`, registered in `app.module.ts`.

### 4.1 Service

- `generateComplianceItems(caseId, userId): Promise<number>`
  - Trace `cases.beneficiary_id → beneficiaries.household_id → households.access_card_code`. `NotFoundException('Household has no access card')` when missing.
  - Pull household members via `household_memberships JOIN persons`, using stored **DOB** to compute age (never `p.age` — that's a getter now, not a column).
  - For each member, for each of the next 12 months, compute `complianceType`/`monthLabel` per the eligibility table, insert with `ON CONFLICT DO NOTHING`. Return count of inserted rows.
- `markComplied(id, userId)` / `unmarkComplied(id)` — set/clear `met`, `met_at`, `met_by`.
- `getComplianceStatus(caseId)` — totals, `rate`, `byType` breakdown, entries `ORDER BY due_date ASC`.
- Payouts: `schedulePayout(caseId, {cycleNo,scheduledAt,amount})`, `markCompleted`, `markMissed(remarks?)`, `markCancelled(remarks?)`, `markNotified(id, userId)`, `listByCase(caseId)`.

### 4.2 Controller (roles `admin|social_worker|coordinator`; compliance status also `claimant`)

```
POST   /fourps/:caseId/generate-compliance     → { generated }
PATCH  /fourps/compliance/:id/meet             → mark complied
DELETE /fourps/compliance/:id/meet             → unmark
GET    /fourps/:caseId/compliance              → status + entries
POST   /fourps/:caseId/payouts                 → schedule
GET    /fourps/:caseId/payouts                 → list
PATCH  /fourps/payouts/:id/status              → body {status} ∈ {completed,missed,cancelled}
POST   /fourps/payouts/:id/notify              → mark notified
```

DTO schemas in `dto/fourps.zod.ts` via existing `ZodPipe`: `ComplianceParamsSchema` (caseId uuid), `MarkCompliedSchema` (serviceId uuid), `SchedulePayoutSchema` (cycleNo, scheduledAt date, amount optional), `PayoutStatusSchema` (status enum).

### 4.3 Household NHTS-PR

There is no standalone households controller — households are reached through `beneficiaries` (`beneficiaries.controller.ts:15`, `@Controller('beneficiaries')`). Add to that controller, roles `admin|social_worker|coordinator`:

```
PATCH /beneficiaries/:id/household/nhts-pr   → body { nhtsPrId?: string }
```

backed by a new `setHouseholdNhtsPr(id, nhtsPrId)` in `beneficiaries.service.ts` (loads the beneficiary's household via `relations: ['household']`, updates the column, returns the beneficiary with household serialized). New `NhtsPrSchema = z.object({ nhtsPrId: z.string().max(50).optional() })`. Exposed through the household getter / serializer (already flows through `benRepo.findOne` with `household` relations).

## 5. Seed additions (`seed-programs.ts`)

Four new rows appended to `PROGRAMS`; each writes its `program_fund_sources` + `program_required_documents` child rows (the existing seed loop already does this for the 18 programs).

| Program | category | fundSources | legalBasis |
|---|---|---|---|
| 4Ps — Pantawid Pamilyang Pilipino Program | CCT | DSWD - 4Ps National | RA 11310 |
| KALAHI-CIDSS (Community-Driven Development) | Community Development | DSWD - KALAHI-CIDSS | RA 7160 / DSWD AO 2011-016 |
| Walang Gutom (Food Stamp) | Food & Nutrition | DSWD - Walang Gutom Food Stamp | EO 44 s. 2021 + RA 11953 |
| UPLIFT | Economic Empowerment | DSWD - UPLIFT | EO 44 s. 2021 |

Required documents for each mirror the existing 4Ps-style set (program-specific Household ID, valid ID, barangay certificate of indigency).

Load-bearing caveat: the exact legal citations/names for KALAHI-CIDSS AO, the Walang Gutom food-stamp enabling act, and the UPLIFT program must be verified against the web-validated taxonomy before implementation. The seed rows carry whatever the implementation plan resolves.

## 6. Client

New pages under `kapwa-client/src/pages/`:

- `FourPsComplianceSection.tsx` — embedded card on case detail; rate bar, "Generate 12-Month Items" button, per-member item list (member name, type badge, due date, met/unmet toggle). Data from `GET /fourps/:caseId/compliance`.
- `FourPsCompliancePage.tsx` — standalone page wrapping the section in `PageShell`.
- `PayoutSchedulePage.tsx` — list of `case_payouts` with status badges, schedule-new-payout dialog (date, cycle, amount), actions Notify / Mark Completed / Mark Missed / Cancel.

Routes in `routes.tsx` under `cases/:caseId`, role-gated `admin|social_worker|coordinator`:

```
cases/:caseId/4ps-compliance   → FourPsCompliancePage
cases/:caseId/payouts          → PayoutSchedulePage
```

Entry points: case detail shows the 4Ps compliance section when the case's program is the seeded 4Ps program; coordinator caseload surfaces compliance rate + open payout count (reuses dashboard/trends pattern).

Household NHTS-PR shown on household profile + case detail + access card PDF.

**i18n parity:** every new string gets `en` + `fil` entries; the fil-parity allowlist test is extended for the new `fourps.*` / `payouts.*` keys.

## 7. Error handling

- No-access-card / not-found → `NotFoundException` (reuse existing message pattern).
- Generation conflict → `ON CONFLICT DO NOTHING`, return `{ generated: 0 }`.
- Zod pipe rejects malformed payout/compliance DTOs before the service (existing pattern).
- Invalid payout status transition → zod rejection on the enum.

## 8. Testing

- **Server (jest):** `fourps.service.spec.ts` — generation idempotency (rerun inserts zero), age-band eligibility (school/health/FDS), `markComplied`/`unmarkComplied`, payout status transitions incl. invalid status zod-rejected, controller routes. Seed spec updated to assert the 4 new programs + fund sources.
- **Client (vitest):** `FourPsComplianceSection` + `PayoutSchedulePage` render/generate/toggle/empty-state; fil-parity extended.
- **Migrations:** validate against disposable Postgres (`pg_ctl -D /tmp/opencode/kapwa-pg/data`, port 5433) — `ON CONFLICT` + partial unique index + fresh-boot `migrate.ts`.

## 9. Verification gates

- Server: `npx jest --silent` (58 suites / 478 tests + new specs), `npm run typecheck`, `npm run lint`.
- Client: `npm run typecheck`, `npm run test:run`.

## 10. Docs

- `.superpowers/sdd/progress.md` — ledger entry.
- `docs/inter-agency-beneficiary-tracking.md` — note that `households.nhts_pr_id` now exists.
- `docs/case-lifecycle-research.md` §6 — 4Ps gap list marked addressed.

## 11. Out of scope

- Hard/soft 85% compliance gate on payout completion (chosen: pure tracking).
- Automatic compliance generation on enrollment/approval (chosen: manual button).
- Listahanan reference-list import / validation endpoint (chosen: single reference column only).
- Per-program compliance/payout workflows for KALAHI-CIDSS / Walang Gutom / UPLIFT.
- Applying `Program.approvalWorkflow` at case submission (independent feature; noted as follow-up).