# Access Card View — Design Spec

## Problem

Beneficiaries with an access card need to see a consolidated record of all services rendered (case services, referrals, community services, seminars) linked to their card. Currently the card code exists but there's no UI to browse or manage the service entries.

## Design

### Backend

**1. Add `category` column to `access_card_services`**

Add migration: `ALTER TABLE access_card_services ADD COLUMN category TEXT NOT NULL DEFAULT 'case_service' CHECK (category IN ('case_service','referral','community_service','seminar'))`

Update `AccessCardService` entity with a `category` field.

**2. Auto-log interventions**

When an intervention is created (`POST /interventions`), if the beneficiary has an access card code, auto-append an `access_card_services` entry with:
- `accessCardCode` — from beneficiary
- `serviceDate` — intervention's deliveryDate or createdAt
- `serviceRendered` — intervention's serviceName
- `cost` — intervention's amount
- `interventionId` — intervention's id
- `category` — `'case_service'`

This happens in the intervention creation service (or via an event/hook).

**3. Update log-service endpoint**

`POST /access-cards/log` — add optional `category` field (default `'referral'`). This is for manual entries (referrals, community service, seminars).

**4. Add summary endpoint**

`GET /access-cards/beneficiary/:id/card/summary` — returns:
```json
{
  "cardCode": "NORZ-AC-2025-0012",
  "total": 24,
  "byCategory": {
    "case_service": 12,
    "referral": 5,
    "community_service": 4,
    "seminar": 3
  }
}
```

**5. Open up relevant endpoints to `claimant` role**

- `GET /access-cards/beneficiary/:id/card`
- `GET /access-cards/beneficiary/:id/card/summary`

### Frontend

**6. BeneficiaryViewPage — Access Card preview card**

Replace the current ID References card (lines 594-616) with an Access Card preview in the right column:

- If beneficiary has `accessCardCode`:
  - Card header: "Access Card" with icon
  - Card code (monospace, primary color)
  - Summary chips: e.g., "12 Case Services", "5 Referrals", "4 Community", "3 Seminars"
  - "View Full Record" button → navigates to `/beneficiary/:id/access-card`
  - "Print" and "Reprint" buttons preserved below
- If no access card:
  - "Generate & Assign Card" button (existing behavior)

The summary data comes from `GET /access-cards/beneficiary/:id/card/summary`.

**7. New AccessCardPage**

Route: `/beneficiary/:id/access-card`

Layout:

**Header section:**
- Beneficiary personal info (name, age, gender, barangay, contact) — reused from BeneficiaryViewPage
- Family composition list (name, relationship, age) — reused from family graph data
- Card code displayed prominently

**Table section:**
- Category tab bar: All | Case Services | Referrals | Community Service | Seminars
- Tabular list: Date | Category (badge) | Service Rendered | Cost | Agency/Worker
- Sorted by service_date DESC
- Paginated

**Add Entry button:**
- Opens a modal/collapsible form
- For manually logging referrals, community services, seminars
- Fields: category (dropdown), service rendered (text), service date (date), cost (optional), agency (optional), worker name (optional)
- Posts to `POST /access-cards/log`

**Mobile:** Table collapses to a card-per-row layout.

### Data Flow

```
Intervention created → auto-log to access_card_services
                       (if beneficiary has access card)

Manual "Add Entry" → POST /access-cards/log → saved to access_card_services

BeneficiaryViewPage → GET /.../card/summary → renders preview chips
AccessCardPage → GET /.../card → renders full table
```

### Migration

```sql
ALTER TABLE access_card_services ADD COLUMN category TEXT NOT NULL DEFAULT 'case_service'
  CHECK (category IN ('case_service','referral','community_service','seminar'));
```

### Files Changed

**Backend:**
- `src/access-cards/access-card-service.entity.ts` — add `category` column
- `src/access-cards/access-cards.service.ts` — add summary endpoint, auto-log in intervention creation
- `src/access-cards/access-cards.controller.ts` — add summary endpoint, update log endpoint, add claimant role
- `src/access-cards/dto/access-cards.zod.ts` — add category to schema
- `src/interventions/interventions.service.ts` — auto-log access card entry on creation
- `src/database/migrations/` — migration file

**Frontend:**
- `src/pages/BeneficiaryViewPage.tsx` — replace ID References card with Access Card preview
- `src/pages/AccessCardViewPage.tsx` — new page
- `src/lib/query-keys.ts` — add access card query keys
- `src/router.tsx` — add route for `/beneficiary/:id/access-card`
