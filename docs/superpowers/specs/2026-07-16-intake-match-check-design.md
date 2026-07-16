# Intake Match-Check Design

## Problem
During beneficiary intake, social workers need to detect potential prior records before creating a new entry. The intake process should check existing households for name matches (beneficiary + family members), display ranked results, and allow the worker to either link the new intake to an existing household or proceed as a new client.

## Flow

```
Intake Form → [Submit & Check Matches] → Match Review Page → Link to Household  → Case View
                                                           → Create New Client  → Case View
```

### Step-by-step
1. User fills intake form (existing — unchanged)
2. Submit button calls `POST /intake/match-check` — no records created
3. If matches found → navigate to `/intake/review` with results
4. If no matches → directly call existing `POST /intake` → redirect to case view
5. On review page:
   - **"Link to This Household"** → `POST /intake/confirm/:householdId` → creates beneficiary under existing household, adds family members, creates new case 30d after last approved case → redirect to case view
   - **"Create New Client"** → existing `POST /intake` → redirect to case view

---

## Backend

### Endpoints

#### `POST /intake/match-check`

**Input** (same shape as intake beneficiary + familyMembers):
```typescript
{
  surname: string;
  firstName: string;
  middleName?: string;
  familyMembers?: { fullName: string }[];
  barangay?: string;
}
```

**Logic**:
1. Enable `pg_trgm` similarity matching
2. For each existing household:
   - **Beneficiary score (60%)**: `GREATEST(similarity(b.surname, :surname), similarity(b.first_name, :firstName))` — best match against any beneficiary in the household
   - **Family score (40%)**: for each incoming family member name, find `MAX(similarity(fm.full_name, :memberName))` across all family members in the household, then average
3. Total score = `0.6 * ben_score + 0.4 * family_score`
4. Filter: total score >= 0.6
5. Sort: descending by score
6. Limit: 10 results
7. For each result, include: primary beneficiary details, all beneficiaries in household, all family members, latest case date (MAX of `cases.created_at` where status = 'approved')

**Output**:
```typescript
{
  candidates: {
    householdId: string;
    score: number;
    primaryBeneficiary: {
      id: string;
      surname: string;
      firstName: string;
      middleName?: string;
      gender: string;
      age: number;
      phone: string;
      occupation: string;
      estimatedMonthlyIncome: number;
      civilStatus: string;
      currentAddress: { street?: string; barangay?: string; city?: string; province?: string; postalCode?: string };
      philhealthNumber?: string;
      category?: string;
    };
    allBeneficiaries: Array<{ id: string; surname: string; firstName: string }>;
    familyMembers: Array<{ id: string; fullName: string; relationship: string; age: number; occupation: string; income: number; status: string }>;
    lastApprovedCaseDate: string | null;
  }[];
}
```

#### `POST /intake/confirm/:householdId`

**Input**: Full `IntakeInput` schema (same as existing `POST /intake`)

**Logic**:
1. Start SERIALIZABLE transaction
2. Create beneficiary with `householdId` set to `:householdId`
3. Add family members to the existing household
4. Query latest approved case date across all beneficiaries in the household: `SELECT MAX(created_at) FROM cases WHERE beneficiary_id IN (SELECT id FROM beneficiaries WHERE household_id = :householdId) AND status = 'approved'`
5. Calculate next eligible date: `MAX(lastApprovedCaseDate + INTERVAL '30 days', NOW())` — displayed to worker for reference
6. Create case with `createdAt = NOW()`, status = `pending`
7. Create consent ledger entry
8. Commit

**ABAC**: Before creating, verify the authenticated worker has permission for the target household's barangay via `permittedBarangays`.

**Output**:
```typescript
{
  beneficiaryId: string;
  caseId: string;
  controlNo: string;
  status: string;
  nextEligibleDate: string; // ISO date — 30 days after last approved case
}
```

#### `POST /intake` (existing — unchanged)

Creates a new beneficiary, new household, family members, case, and consent ledger. Used when "Create New Client" is selected.

### Scoring SQL (pseudocode)

```sql
WITH 
incoming_surname AS (VALUES ($1)),
incoming_first AS (VALUES ($2)),
incoming_family AS (VALUES ($3)), -- array of family member names
household_scores AS (
  SELECT 
    h.id,
    GREATEST(
      similarity(b.surname, $1),
      similarity(b.first_name, $2)
    ) AS ben_score,
    CASE WHEN array_length($3::text[], 1) > 0 THEN (
      SELECT AVG(best)
      FROM (
        SELECT MAX(similarity(fm.full_name, unnest)) AS best
        FROM family_members fm
        JOIN unnest($3::text[]) AS u ON true
        WHERE fm.household_id = h.id
        GROUP BY unnest
      ) sub
    ) ELSE 0 END AS family_score
  FROM households h
  JOIN beneficiaries b ON h.primary_beneficiary_id = b.id
)
SELECT 
  hs.*,
  b.id AS ben_id, b.surname, b.first_name, b.address,
  b.phone, b.occupation, b.estimated_monthly_income,
  b.civil_status, b.current_address, b.philhealth_number, b.age,
  (SELECT json_agg(json_build_object('id', b2.id, 'surname', b2.surname, 'first_name', b2.first_name))
   FROM beneficiaries b2 WHERE b2.household_id = h.id) AS all_beneficiaries,
  (SELECT json_agg(json_build_object(
    'id', fm.id, 'fullName', fm.full_name, 'relationship', fm.relationship,
    'age', fm.age, 'occupation', fm.occupation, 'income', fm.income, 'status', fm.status
   )) FROM family_members fm WHERE fm.household_id = h.id) AS family_members,
  (SELECT MAX(c.created_at) FROM cases c 
   JOIN beneficiaries b3 ON b3.id = c.beneficiary_id
   WHERE b3.household_id = h.id AND c.status = 'approved') AS last_case_date
FROM household_scores hs
JOIN households h ON h.id = hs.id
JOIN beneficiaries b ON b.id = h.primary_beneficiary_id
WHERE (0.6 * COALESCE(hs.ben_score, 0) + 0.4 * COALESCE(hs.family_score, 0)) >= 0.6
ORDER BY (0.6 * COALESCE(hs.ben_score, 0) + 0.4 * COALESCE(hs.family_score, 0)) DESC
LIMIT 10
```

---

## Frontend

### Modified IntakePage

- Submit button text changes to "Submit & Check for Prior Records"
- `handleSubmit` calls `POST /intake/match-check` first
  - If candidates returned → navigate to `/intake/review` with `{ candidates, intakeData }` via route state
  - If no candidates (empty array) → proceed directly to existing `POST /intake` → case view
  - On error → proceed directly to existing `POST /intake` (graceful degradation)
- Loading state for the match-check call

### IntakeReviewPage (new)

**Route**: `/intake/review` → `Private roles={['admin','social_worker','coordinator']}`

**Layout** (split-pane, maximizes PageShell width):
```
┌──────────────────────────────────────────────────────────────┐
│  Potential Prior Record Match Review                         │
│                                                              │
│  ┌─── Current Intake ───┐ ┌─── Potential Matches ──────────┐│
│  │                      │ │                                 ││
│  │  Name:               │ │ ┌─── Match #1 · 92% ────────┐ ││
│  │  Dela Cruz, Juan S.  │ │ │ Alcala, Rodolfo G.        │ ││
│  │                      │ │ │ 52, Male · Bigte          │ ││
│  │  Address:            │ │ │ 09171234501               │ ││
│  │  Block 1, Bigte      │ │ │ Farmer · ₱8,500/mo        │ ││
│  │                      │ │ │ PhilHealth: 123456789001  │ ││
│  │  Demographics:       │ │ │ Last case: Jan 20, 2025   │ ││
│  │  Male · 40 yrs       │ │ │ Next eligible: Feb 19     │ ││
│  │  Married             │ │ │ Family: Rosa (Spouse,48)  │ ││
│  │                      │ │ │         Mark (Child,22)   │ ││
│  │  Contact:            │ │ │         Jenny (Child,16)  │ ││
│  │  09171234567         │ │ │ [↓ Details] [Link]       │ ││
│  │                      │ │ └──────────────────────────┘ ││
│  │  Family:             │ │ ┌─── Match #2 · 68% ────────┐ ││
│  │  Maria (Spouse,35)   │ │ │ Cruz, Antonio L.          │ ││
│  │  Jose (Child,10)     │ │ │ Matictic · ...            │ ││
│  │                      │ │ │ [↓ Details] [Link]       │ ││
│  │  Income: ₱8,500/mo   │ │ └──────────────────────────┘ ││
│  │                      │ │ ┌──────────────────────────┐ ││
│  │                      │ │ │ [Create New Client]      │ ││
│  └──────────────────────┘ │ └──────────────────────────┘ ││
└──────────────────────────────────────────────────────────────┘
```

**Expanded section** (collapsible per card):
- Full current address (street, barangay, city)
- All family members table: Name, Relationship, Age, Occupation, Income, Status
- Case history: Last 3 cases with dates, status, service type

**Loading states**:
- Skeleton cards while loading
- Submit button shows spinner during match-check

**Error handling**:
- Match-check fails → fall through to direct `POST /intake` (create new)
- Confirm fails → show error toast, stay on review page
- `POST /intake` fails → existing behavior (error message on form)

---

## Files Changed

### Backend
| File | Action |
|------|--------|
| `src/intake/dto/intake.zod.ts` | Add `MatchCheckSchema` |
| `src/intake/intake.service.ts` | Add `matchCheck()` and `confirmMatch()` methods |
| `src/intake/intake.controller.ts` | Add `POST /match-check` and `POST /confirm/:householdId` |

### Frontend
| File | Action |
|------|--------|
| `src/lib/constants.ts` | Fix barangay list to 13 correct Norzagaray barangays |
| `src/pages/IntakePage.tsx` | Modify submit to call match-check, pass data via route state |
| `src/pages/IntakeReviewPage.tsx` | New page — match review with expandable cards |
| `src/routes.tsx` | Add `/intake/review` route |

---

## Security
- All endpoints protected by `JwtAuthGuard`, `RolesGuard`, `AbacGuard`
- Match-check limited to `admin`, `social_worker`, `coordinator` roles
- All endpoints check worker `permittedBarangays` via ABAC
- Match-check only returns households in barangays the worker can access
- Confirm endpoint validates worker has permission for the target household's barangay

## Testing

### Backend
- `intake.service.spec.ts`: test `matchCheck()` with known household, verify scoring
- Test threshold filtering (0.6 cutoff)
- Test `confirmMatch()` creates beneficiary under existing household
- Test case date calculation (30 days after last approved case)

### Frontend
- `IntakePage.test.tsx`: update for match-check flow
- `IntakeReviewPage.test.tsx`: render with mock candidates, test expand/collapse, test link and create buttons
