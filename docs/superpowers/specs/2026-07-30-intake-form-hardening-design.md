# Intake Form Hardening — Validation, Auto-Fill, and UI Enhancement

Supersedes: `2026-07-14-intake-redesign-design.md` (validation and UI portions)

## Problem

The intake form (`IntakePage.tsx`) has several usability and data-quality gaps:

- **No field-level validation** — one generic error banner, user hunts for the problem
- **Email** accepted in any format
- **Phone** accepts any digits without PH mobile format check
- **DOB** allows any date producing ages outside realistic range (0–120)
- **Income** silently coerces empty to `0` but backend Zod rejects `0` (`.positive()`)
- **Postal code** is free-text with no auto-fill from city/barangay selection
- **Address fields** all optional on backend
- **UI** uses plain card styling without the section-header pattern established in referral pages

## Approach

Approach B: Full validation + auto-fill + card section headers + inline error display. No component extraction refactor.

## Design

### 1. Frontend Validation Schema

Add `useIntakeValidation.ts` hook — a Zod schema matching the PersonForm shape, plus validate/validateField helpers. Mirrors the referral form validation pattern.

| Field | Rule | Error Message |
|-------|------|---------------|
| surname | min(1) | "Surname is required" |
| firstName | min(1) | "First name is required" |
| gender | enum Male/Female | "Sex is required" |
| dob | regex YYYY-MM-DD + age 0–120 computed | "Invalid date of birth" / "Age must be between 0 and 120" |
| placeOfBirth | min(1) | "Place of birth is required" |
| civilStatus | enum Single/Married/Widowed/Separated/Annulled | "Civil status is required" |
| cellularNumber | regex /^09\d{9}$/ | "Must be a valid 11-digit mobile number starting with 09" |
| email | z.string().email() | "Enter a valid email address" |
| street | min(1) | "Street is required" |
| barangay | min(1) | "Barangay is required" |
| city | min(1) | "City/Municipality is required" |
| province | min(1) | "Province is required" |
| region | min(1) | "Region is required" |
| postalCode | min(1) | "Postal code is required" |
| occupation | min(1) | "Occupation is required" |
| estimatedMonthlyIncome | z.number().nonnegative() | "Monthly income must be 0 or higher" |
| philhealthNumber | optional | — |
| middleName | optional | — |
| extension | optional | — |

### 2. Hybrid Error Display

On submit, run full-form validation via Zod `.safeParse()` on each PersonForm (beneficiary and, if not beneficiary-is-claimant, claimant).

- **All errors collected** into a `Record<string, string>` keyed by field path (e.g. `"ben.surname"`)
- If any errors exist: scroll to top, show **summary banner** (destructive/red border, bullet list of all field errors), and set per-field error state
- Each invalid field gets `border-destructive` + inline red error text below the label
- On blur or change: clear that field's error

The summary banner uses the same pattern as the existing error banner but displays a bullet list of all field errors instead of a single message.

### 3. Postal Code Auto-Fill

Add `kapwa-client/src/lib/postal-codes.ts` with a `POSTAL_CODES: Record<string, string>` static lookup map keyed by city/municipality name.

In `IntakeAddressBlock`, when `onChange('city', code)` fires and the selected city name has a match in `POSTAL_CODES`, call `onChange('postalCode', value)`. The postal code field remains editable for manual override. The map covers the project's target cities (Norzagaray, San Jose Del Monte, etc.) with ~50 entries.

### 4. Backend Zod Changes (`intake.zod.ts`)

- `cellularNumber`: add `.regex(/^09\d{9}$/, 'Must be a valid 11-digit PH mobile number starting with 09')`
- `estimatedMonthlyIncome`: change `.positive()` → `.nonnegative('Monthly income must be 0 or higher')`
- `AddressSchema`: change all fields from `.optional()` to `.min(1, '...')` — street, barangay, city, province, region, postalCode
- `dob`: keep existing regex validation; no backend age-range check needed (backend trusts frontend-computed age + external data sources)

### 5. UI Enhancement

Three card sections (Beneficiary, Claimant, Family) adopt the referral page card-section-header pattern:

```
div class="rounded-lg border"
  div class="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2"
    icon class="size-4 text-muted-foreground"
    h3 class="text-sm font-semibold"
  div class="p-6 space-y-4"
    // fields
```

- **Section icons**: `User` (Beneficiary), `UserCheck` (Claimant), `Users` (Family), `ShieldCheck` (Consent)
- **Error field styling**: `border-destructive` ring + red text below the field
- **Error banner**: at top of form, `rounded border border-destructive bg-destructive/10 p-3 text-sm text-destructive` with `<ul>` listing each error
- **Consent card**: gets the section header pattern matching the rest
- **Submit area**: keeps existing layout but aligned with enhanced card styling

## Files Changed

| File | Change |
|------|--------|
| `kapwa-client/src/hooks/useIntakeValidation.ts` | NEW — Zod schema + validate/validateField |
| `kapwa-client/src/lib/postal-codes.ts` | NEW — static city→postal-code map |
| `kapwa-client/src/lib/constants.ts` | UNCHANGED |
| `kapwa-client/src/components/IntakeAddressBlock.tsx` | Add auto-fill postal code on city change; required marks |
| `kapwa-client/src/components/IntakeAddressBlock.test.tsx` | NEW — test auto-fill behavior |
| `kapwa-client/src/pages/IntakePage.tsx` | Integration: validation hook, error display, card headers, postal auto-fill |
| `kapwa-client/src/pages/IntakePage.test.tsx` | Update tests for new validation/error behavior |
| `kapwa-server/src/intake/dto/intake.zod.ts` | Phone regex, income nonnegative, address fields required |
| `kapwa-server/test/intake.service.spec.ts` | Update test payloads for required address fields |

## Testing

- **Frontend**: 5+ new test cases — valid submission passes, invalid phone shows inline error, invalid email shows inline error, missing address fields show errors, postal code auto-fills on city select, age > 120 rejected
- **Backend**: Update existing test payloads to include all required address fields; verify phone regex rejects invalid formats; verify income=0 accepted
- **Lint/typecheck**: Zero new TS errors
