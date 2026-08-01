# Intake Match Review Redesign — Universally Approachable UI

Supersedes: `2026-07-16-intake-match-check-design.md`

## Problem

When a social worker submits an intake form and the system finds potential prior records, the current match review screen (`/intake/review`) presents results using technical artifacts that confuse non-tech-savvy users:

- Percentage scores ("73%") — no one knows what the threshold means
- Jargon labels ("Link to This Household", "Match #1", "candidates")
- Split-pane layout — sidebar + list forces users to hold info in memory across columns
- Hidden details behind "Show More" — critical comparison data is one click away
- Two equal-strength actions with no guidance
- No context about whether linking will create a new case or just update

## Flow

```
Intake Form → [Submit & Check] → Match Review Page

Same person confirmed:
  → Any beneficiary in household has case < 30 days old?
    → YES: Update household info, NO new case created → back to case view
    → NO:  Update household info AND create new case → back to case view

Different person:
  → Create new household + beneficiary + case → back to case view
```

## Design Goals

| Principle | Application |
|-----------|-------------|
| One clear question per match | "Is this Maria Santos?" — not "Match Candidate #3 with 45%" |
| Plain language, not system terms | "Very likely the same", "Some similarities" — not "score: 0.73" |
| No hidden info | All relevant comparison fields visible without clicking |
| Context-aware actions | Buttons show what WILL happen ("update info" vs "update info & create case") |
| Guidance, not options | Primary "Yes" button is obvious; "No" is secondary; escape hatch is last |
| Accessible | Labels + color, not color alone |

## UI Design

### Page layout

Single-column, top-to-bottom. No sidebar. The intake person's data is shown inline inside each match card so the user never has to look in two places at once.

### Match cards grouped by confidence

1. **"Very likely the same person"** — high similarity (shown first, expanded)
2. **"Some similarities"** — moderate match (shown below)
3. **"Same surname only"** — low match (collapsed by default)

### Card layout

```
┌──────────────────────────────────────────────────────────────────┐
│  ✅ Very likely the same person                                 │
│                                                                  │
│  Is this Maria Santos?                                           │
│                                                                  │
│  You entered:         Existing record:                          │
│  ────────────         ────────────────                           │
│  Maria Santos         Maria Santos         ✅                    │
│  55 yrs              55 yrs               ✅                    │
│  Brgy. Tikay          Brgy. Tikay          ✅                    │
│  No PhilHealth        PhilHealth 12-3456   ✅                    │
│                                                                  │
│  Last case: January 2026 — eligible for a new case               │
│                                                                  │
│  [Yes, update info & create case]  [No, different person]        │
└──────────────────────────────────────────────────────────────────┘
```

Or when a recent case exists:

```
┌──────────────────────────────────────────────────────────────────┐
│  ✅ Very likely the same person                                 │
│                                                                  │
│  Is this Maria Santos?                                           │
│                                                                  │
│  You entered:         Existing record:                          │
│  ────────────         ────────────────                           │
│  Maria Santos         Maria Santos         ✅                    │
│  55 yrs              55 yrs               ✅                    │
│  Brgy. Tikay          Brgy. Tikay          ✅                    │
│  No PhilHealth        PhilHealth 12-3456   ✅                    │
│                                                                  │
│  ⓘ Maria has an active case from June 15, 2026                   │
│  We'll update her info but won't create a new case.              │
│                                                                  │
│  [Yes, update info]  [No, different person]                       │
└──────────────────────────────────────────────────────────────────┘
```

### Escape hatch (always at bottom, after all match cards)

```
[None of these match → Register as new client]
```

## Business Logic — `POST /intake/confirm/:householdId`

When the user clicks "Yes, this is [Name]":

1. **Check case eligibility**: Query across ALL beneficiaries in the household — `SELECT EXISTS(SELECT 1 FROM cases WHERE beneficiary_id IN (SELECT id FROM beneficiaries WHERE household_id = :householdId) AND created_at > NOW() - INTERVAL '30 days')` . This checks **any case** regardless of status (the user's rule: "any affiliated cases"). 
2. **If a case exists < 30 days**: Update household/beneficiary info with new intake data. Return `{ caseCreated: false, message: "..." }`
3. **If no case < 30 days**: Update household/beneficiary info AND create new case. Return `{ caseCreated: true, caseId, controlNo }`
4. **Response must include**: whether a case was created, the reason, and the existing case date if applicable

### Response shape

```typescript
{
  updated: true;
  caseCreated: boolean;
  caseId?: string;
  controlNo?: string;
  existingCaseDate?: string;
  message: string; // e.g. "Info updated. No new case — an active case already exists."
}
```

## Frontend Components

### Modified files

| File | Change |
|------|--------|
| `IntakeReviewPage.tsx` | Complete redesign — new card layout, inline comparison, plain-language labels, confidence grouping, context-aware buttons |
| `IntakePage.tsx` | Add `lastApprovedCaseDate` and `activeCaseCount` to match-check response handling (may need to update the confirm endpoint to return case info) |

### IntakeReviewPage states

| State | Handling |
|-------|----------|
| **Loading** | Skeleton cards for each match slot |
| **Empty** | "No prior records found" — auto-redirect to `POST /intake` |
| **Error (match-check fails)** | Fall through to `POST /intake` directly (graceful degradation) |
| **Confirm success (case created)** | Navigate to `/cases/:id` with success toast |
| **Confirm success (no case created)** | Navigate to case view or beneficiary view with info toast: "Maria's info updated. No new case — she already has an active case." |
| **Confirm error** | Stay on review page, show error toast |

### Confidence label logic

Maps from backend score to plain language:

| Score range | Label |
|-------------|-------|
| >= 0.8 | "Very likely the same person" |
| >= 0.5 | "Some similarities" |
| < 0.5 | "Same surname only" (collapsed) |

Case eligibility note on each card:
- `lastApprovedCaseDate` is null → "No prior case on record — a new case will be created"
- `lastApprovedCaseDate` is within 30 days → "Has an active case from [date] — info will be updated, no new case"
- `lastApprovedCaseDate` is older than 30 days → "Last case: [date] — eligible for a new case"

## Error scenarios

| Scenario | UX |
|----------|-----|
| Confirm endpoint returns 403 (barangay mismatch) | Toast: "You don't have permission to modify this household" |
| Confirm endpoint returns 500 | Toast: "Something went wrong. Please try again." Stay on review page |
| Network error during confirm | Toast: "Connection lost. Please check your internet and try again." |
| Network error during match-check | Skip review, proceed to `POST /intake` directly |

## Mobile

Cards stack full-width. Side-by-side comparison becomes top-to-bottom on narrow screens: intake info on top, existing record below, with ✅ indicators still visible.

## Backend changes

The existing `POST /intake/confirm/:householdId` endpoint must be modified to:

1. Check for cases within the last 30 days across ALL beneficiaries in the household
2. Return `caseCreated: boolean` in the response
3. Only create a new case if no recent case exists

The 30-day check runs at **both** match-check time (for display) and confirm time (authoritative). The confirm endpoint is the source of truth — a case may have been created between match-check and confirm.

The `POST /intake/match-check` endpoint should include `caseExistsWithin30Days: boolean` in each candidate response so the frontend can show the correct card label upfront. The confirm endpoint re-checks and returns the definitive `caseCreated: boolean`.

## Files Changed

### Backend
| File | Action |
|------|--------|
| `src/intake/intake.service.ts` | Modify `confirmMatch()` — add 30-day check, conditional case creation; modify `matchCheck()` to include `caseExistsWithin30Days` in candidate response |
| `src/intake/intake.controller.ts` | May need response type updates |
| `src/intake/dto/intake.zod.ts` | Update `MatchCandidate` interface to include `caseExistsWithin30Days` |

### Frontend
| File | Action |
|------|--------|
| `src/pages/IntakeReviewPage.tsx` | Complete rewrite: new card layout, inline comparison, confidence badges, context-aware buttons, case eligibility messaging |
| `src/pages/IntakePage.tsx` | Minor: pass additional fields from match-check response if needed |
