# Barangay Coordinator Module — Design Doc

## Overview

A dedicated coordinator workspace combining two features:
1. **Referral system** — barangay coordinator refers any resident to MSWDO
2. **Access card management** — verify, assign, and log activities on access cards

Delivered in two phases. Phase 1 ships the referral system. Phase 2 adds access card features.

---

## Phase 1 — Referral System

### Data Model

```sql
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  coordinator_id UUID NOT NULL REFERENCES users(id),
  barangay TEXT NOT NULL,

  -- Person details (any resident, not necessarily existing beneficiary)
  surname TEXT NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  extension TEXT,
  gender TEXT NOT NULL,
  dob DATE NOT NULL,
  address JSONB,
  phone TEXT,

  -- Referral metadata
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined')),
  decline_reason TEXT,
  case_id UUID REFERENCES cases(id),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoints

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `POST` | `/referrals` | coordinator | Submit referral for any resident |
| `GET` | `/referrals` | admin, social_worker | List all referrals (filtered by barangay) |
| `GET` | `/referrals/mine` | coordinator | List my referrals with status |
| `GET` | `/referrals/:id` | admin, social_worker, coordinator | Get referral details |
| `PATCH` | `/referrals/:id/accept` | admin, social_worker | Accept → auto-create intake (Person → Beneficiary → Household → Case) |
| `PATCH` | `/referrals/:id/decline` | admin, social_worker | Decline with reason |

### Flow

```
Coordinator
  │ POST /referrals { surname, first_name, gender, dob, reason, ... }
  ▼
Referral stored with status='pending'
  │
  ▼
MSWDO sees in referral queue (/intake/referrals tab)
  │
  ├─ Accept → system copies referral data into submitIntake()
  │           creates Person → Beneficiary → Household → Case
  │           updates referral.case_id, referral.status='accepted'
  │
  └─ Decline→ PATCH /referrals/:id/decline { reason }
              referral.status='declined'
  │
  ▼
Coordinator sees status on dashboard
```

### Client Pages (Coordinator)

```
/coordinator/dashboard
├── Stats card: "My Referrals" (count + pending count)
├── Recent referrals table (last 5)
└── Quick action: "New Referral" button

/coordinator/referrals
├── Table of all my referrals
├── Status badges (pending/accepted/declined)
└── Click to view detail

/coordinator/referrals/new
├── Form: surname, first_name, middle_name, extension, gender, dob, address, phone
├── Reason textarea
└── Submit → redirects to /coordinator/referrals
```

### Client Pages (MSWDO)

```
/intake/referrals
├── Tab or sub-route on IntakePage
├── Table: pending referrals from all barangays
├── Each row: name, barangay, coordinator, reason, date
└── Actions: Accept (→ creates intake), Decline (→ reason modal)
```

---

## Phase 2 — Access Card Management

### Permission Changes

Update `@Roles()` on existing access card controller endpoints:

| Endpoint | Current Roles | New Roles |
|----------|--------------|-----------|
| `POST assign/:beneficiaryId` | admin, social_worker | admin, social_worker, coordinator |
| `GET beneficiary/:id/card/summary` | admin, social_worker, claimant | admin, social_worker, claimant, coordinator |
| `GET beneficiary/:id/card` | admin, social_worker, claimant | admin, social_worker, claimant, coordinator |
| `POST log` | admin, social_worker | admin, social_worker, coordinator |
| `GET :cardCode` | admin, social_worker, claimant | admin, social_worker, claimant, coordinator |
| `GET` | admin, social_worker | admin, social_worker, coordinator |

### DB Changes

```sql
ALTER TABLE access_card_service
  ADD COLUMN logged_by UUID REFERENCES users(id),
  ADD COLUMN source_barangay TEXT;
```

### Client Pages (Coordinator)

```
/coordinator/access-cards
├── Tab navigation: Verify | Assign | History
│
├── Verify tab
│   ├── Text input for card code
│   ├── Shows beneficiary name, barangay, photo, recent services
│   └── "Log Activity" button → opens form
│
├── Assign tab
│   ├── Search beneficiary by name (scoped to barangay)
│   ├── Shows beneficiary details
│   └── "Assign Card" button → generates code
│
└── History tab
    └── Paginated table of all services logged by this coordinator
```

### ABAC Scoping

Extend `evaluateBarangayScope` in ABAC service to handle access card resources:

- Coordinator can only see/manage access cards of beneficiaries in `assignedBarangay`
- Filter beneficiary search by current user's barangay when role is coordinator

---

## ABAC / RLS Impact

| Resource | Current Sensitivity | Coordinator Access |
|----------|-------------------|--------------------|
| Referrals | `internal` | ✅ Yes (own only) |
| Access cards | `internal` | ✅ Yes (barangay-scoped) |
| Persons / Beneficiaries | `sensitive` | ❌ No direct access |
| Cases | `sensitive` | ❌ No direct access (view-only via case tracker) |

No ABAC sensitivity changes needed — referrals and access card services are already `internal`.

---

## Client Routing

```tsx
// New routes
{ path: '/coordinator/dashboard', element: <Private roles={['coordinator']}><CoordinatorDashboardPage /></Private> },
{ path: '/coordinator/referrals', element: <Private roles={['coordinator']}><CoordinatorReferralListPage /></Private> },
{ path: '/coordinator/referrals/new', element: <Private roles={['coordinator']}><CoordinatorReferralFormPage /></Private> },
{ path: '/coordinator/access-cards', element: <Private roles={['coordinator']}><CoordinatorAccessCardsPage /></Private> },

// Existing route - updated
{ path: '/coordinator', element: <Navigate to="/coordinator/dashboard" replace /> },

// MSWDO side
{ path: '/intake/referrals', element: <Private roles={['admin','social_worker']}><ReferralReviewPage /></Private> },
```
