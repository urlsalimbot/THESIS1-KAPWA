# GIS Intake Redesign — Design Spec

## Overview

Redesign the GIS Intake form and CaseViewPage to match the MSWDO case management workflow. Intake captures client registration (Personal Info + Family Composition), then redirects to the case page where Assessment (Section III) and Recommended Services & Assistance (Section IV) are filled.

## Two-Step Flow

1. **Intake Page** (`/intake`) — Sections I (Personal Information) + II (Family Composition). On submit: creates Beneficiary + Household + FamilyMembers + Case. Redirects to `/cases/:id`.
2. **Case View Page** (`/cases/:id`) — existing page gets new editable Sections III (Assessment) + IV (Recommended Services & Assistance). "Interviewed by" auto-filled from logged-in user. Client Signature collected here.

## Data Model Changes

### Beneficiary Entity — New Columns

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `place_of_birth` | TEXT | yes | |
| `civil_status` | TEXT | yes | Single, Married, Widowed, Separated, Annulled |
| `current_address` | JSONB | yes | `{street, barangay, city, province, postalCode}` |
| `provincial_address` | JSONB | yes | Same shape as current_address |
| `philhealth_number` | TEXT | no | nullable |
| `occupation` | TEXT | yes | |
| `estimated_monthly_income` | DECIMAL(12,2) | yes | |
| `age` | INTEGER | no | computed from DOB on frontend, stored for query convenience |

### FamilyMember Entity — Column Changes

- **Replace** `statusIncome` with `occupation` (TEXT, required for family members)

### Case Entity — New Columns

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `problems_presented` | TEXT | yes | Section 13a |
| `social_worker_assessment` | TEXT | yes | Section 13b |
| `client_category` | TEXT | yes | Single select radio |
| `nature_of_service` | TEXT[] | yes | Array of selected service types |
| `financial_subsidies` | JSONB | no | Sub-selections: `{foodSubsidy, livelihood, education, medical, medicalSpecify, guaranteeLetter, burial, transportation}` |
| `amount_assistance` | DECIMAL(12,2) | no | Only when Financial Assistance |
| `mode_financial_assistance` | TEXT | no | "Cash" or "Cheque" or null |
| `source_of_fund` | TEXT | no | Regular Funds, Donation, PDAF, Others |
| `legislator_specify` | TEXT | no | When PDAF selected |
| `other_assistance` | JSONB | no | `{foodPack, usedClothing, hotMeal, assistiveDevices, assistiveDevicesSpecify, other, otherSpecify}` |
| `interviewed_by` | TEXT | yes | Auto-filled from logged-in user |
| `client_signature` | TEXT | yes | Data URL or uploaded URL |

## Intake Form (Section I + II)

### Section I — Personal Information

All required unless marked nullable. Fields grouped into a single card with `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`.

- **Surname** — text input
- **First Name** — text input
- **Middle Name** — text input
- **Sex** — radio group: Male / Female
- **Age** — computed from DOB, displayed as read-only text
- **Date of Birth** — date input
- **Place of Birth** — text input
- **Civil Status** — select: Single, Married, Widowed, Separated, Annulled
- **Cellular Number** — tel input
- **Address** — address block:
  - House/Unit No., Street, Subdivision — text input
  - Barangay — select (from BARANGAYS constant)
  - City/Municipality — select (Norzagaray default, pinned on top)
  - Province — select (Bulacan default, pinned on top)
  - Postal Code — numeric input
- **Provincial Address** — same address block, labeled "Provincial Address"
- **PhilHealth Number** — text input, nullable (no asterisk)
- **Occupation** — text input
- **Estimated Monthly Income** — number input with ₱ prefix

### Section II — Family Composition

Dynamic table with add/remove rows. Each row:

| Field | Input | Required |
|-------|-------|----------|
| Name | text | yes |
| Age | number | yes |
| Relationship | select: Spouse/Child/Parent/Sibling/Grandparent/Other | yes |
| Occupation | text | yes |

Minimum 0 rows. "Remove" button per row, "Add Member" at bottom.

## Intake Backend (POST /intake)

Updated `IntakeInputSchema` with all new Section I fields. `IntakeService.submitIntake()` creates:

1. Beneficiary (all new fields mapped to entity columns)
2. Household (barangay from currentAddress.barangay, estimatedIncome) 
3. FamilyMembers (with `occupation` instead of `statusIncome`)
4. Case (initial status `pending_assessment`, empty assessment fields)
5. ConsentLedger

Returns `{ beneficiaryId, caseId, controlNo, status }`. Frontend navigates to `/cases/${caseId}`.

## Case View Page (Section III + IV)

### Section III — Assessment

Two `<textarea>` fields + radio group:

- **Problem/s Presented** — multi-line textarea, required
- **Social Worker's Assessment** — multi-line textarea, required
- **Client Category** — radio group, single select, required:
  - Children in Need of Special Protection
  - Youth in Need of Special Protection
  - Women in Especially Difficult Circumstances
  - Person with Disability
  - Senior Citizen
  - Family Head and Other Needy Adult

### Section IV — Recommended Services & Assistance

**15. Nature of Service/Assistance** — radio group:
- Counseling
- Financial Assistance
- Legal Assistance

When **Financial Assistance** selected, show sub-checklist:
- □ Food Subsidy
- □ Livelihood
- □ Education
- □ Medical — check reveals "Specify" text input
- □ Guarantee Letter — when checked, disables Cash/Cheque radio
- □ Burial
- □ Transportation

**15a. Amount** — ₱ number input (visible only when Financial Assistance selected)

**15b. Mode of Financial Assistance** — radio: Cash / Cheque (hidden when Guarantee Letter checked, disabled and nulled when Guarantee Letter checked)

**15c. Source of Fund** — radio with conditional text input:
- ○ Regular Funds
- ○ Donation
- ○ Priority Development Assistance Fund → "Specify Legislator" text input
- ○ Others → "Specify" text input

**16. Other Assistance** — multi-select checkboxes:
- □ Food Pack
- □ Used Clothing
- □ Hot Meal
- □ Assistive Devices → "Specify" text input
- □ Other → "Specify" text input

**Interviewed by**: display-only field, auto-filled from `useAuth()` user's full name

**Client Signature**: SignaturePad component on case page

**Save button**: PATCHes `/cases/:id/assessment` with the form data.

## Backend Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/intake` | Create beneficiary + household + case (Sections I+II) |
| PATCH | `/cases/:id/assessment` | Save Section III+IV data |

## Constants (frontend)

```
CIVIL_STATUSES = ['Single', 'Married', 'Widowed', 'Separated', 'Annulled']
CLIENT_CATEGORIES = [
  'Children in Need of Special Protection',
  'Youth in Need of Special Protection',
  'Women in Especially Difficult Circumstances',
  'Person with Disability',
  'Senior Citizen',
  'Family Head and Other Needy Adult'
]
NATURE_OF_SERVICE = ['Counseling', 'Financial Assistance', 'Legal Assistance']
FINANCIAL_SUBSIDIES = ['Food Subsidy', 'Livelihood', 'Education', 'Medical', 'Guarantee Letter', 'Burial', 'Transportation']
SOURCE_OF_FUND = ['Regular Funds', 'Donation', 'Priority Development Assistance Fund', 'Others']
OTHER_ASSISTANCE = ['Food Pack', 'Used Clothing', 'Hot Meal', 'Assistive Devices', 'Other']
CITIES = ['Norzagaray', 'Angat', 'San Jose del Monte', ...] // full PH city list with Norzagaray first
PROVINCES = ['Bulacan', ...] // full PH province list with Bulacan first
```

## Migration

New TypeORM migration `AddIntakeFieldsYYYYMMDD`:
- ALTER beneficiaries: add place_of_birth, civil_status, current_address (jsonb), provincial_address (jsonb), philhealth_number, occupation, estimated_monthly_income (decimal), age (integer)
- ALTER family_members: rename status_income → occupation (or add occupation, drop status_income)
- ALTER cases: add all assessment+services columns
- CaseTrackerLog created_at already handled

## Error Handling

- Intake form validates all required fields client-side before submit
- Server-side ZodPipe provides error messages per field
- On submit error: show inline error banner, form retains entered data
- Offline: queue change via existing sync mechanism

## Existing Features Preserved

- Consent checkbox + ConsentLedger creation
- Worker signature (moved to case assessment section)
- Offline queue support via `queueChange`
