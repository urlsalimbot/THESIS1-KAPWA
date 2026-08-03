# Inter-Agency Beneficiary Tracking — Phase 0+1 + Access Card Design

Date: 2026-08-03
Status: Design spec (Option C, scoped to Phase 0 + 1 + access-card aggregate view)
Related: `docs/inter-agency-beneficiary-tracking.md` (full research)

## 1. Goal

Give intra-municipal inter-agency offices (MSWDO, RHU, PNP-WCPD, PESO, DILG, DepEd)
a closed-loop referral system and an access-card view that shows, per beneficiary:
services rendered, services received from other agencies, and referral history —
built on KAPWA's existing identity/consent/RLS foundations, without creating a second
registry.

## 2. Scope

In scope (this spec):
- **Phase 0** — `agencies` lookup table + seed + module
- **Phase 1** — `inter_agency_referrals` closed-loop table + module + UI route
- **Access card aggregate** — `GET /access-cards/:code/summary` with three sections
- **PSN exact-match check** on beneficiary/access-card creation (no UI)
- **Service-log normalization** — `access_card_services.agency_id` FK, required on new logs

Out of scope (design docs only): probabilistic dedup/matching UI (Phase 2),
consent purpose governance screens (Phase 3), committee report generation (Phase 4).

## 3. Data model

### 3.1 `agencies` (new)

```
id          UUID PK DEFAULT uuid_generate_v7()
code        VARCHAR(10) UNIQUE NOT NULL   -- MSWDO, RHU, WCPD, PESO, DILG, DSWD, DepEd
name        VARCHAR(100) NOT NULL
type        VARCHAR(50)                   -- health, social_services, police, labor, education
contact_info JSONB NULL
is_active   BOOLEAN DEFAULT true
created_at / updated_at
```

Seeded rows: MSWDO, RHU/MHO, PNP-WCPD, PESO, DILG, DSWD, DepEd.

### 3.2 `inter_agency_referrals` (new)

```
id              UUID PK DEFAULT uuid_generate_v7()
case_id         UUID NULL REFERENCES cases(id)          -- case-less referrals allowed
person_id       UUID NOT NULL REFERENCES persons(id)    -- resolve to Person, not freeform
from_agency_id  UUID NOT NULL REFERENCES agencies(id)
to_agency_id    UUID NOT NULL REFERENCES agencies(id)
status          TEXT CHECK IN ('referred','received','actioned','closed','declined')
reason          TEXT NOT NULL
notes           TEXT NULL
legal_basis_code TEXT NOT NULL                          -- e.g. 'public_authority_sec13'
consent_ledger_id UUID NULL REFERENCES consent_ledger(id)
outcome         TEXT NULL
received_at     TIMESTAMP NULL
actioned_at     TIMESTAMP NULL
closed_at       TIMESTAMP NULL
declined_reason TEXT NULL
created_by      UUID NULL REFERENCES users(id)
created_at / updated_at
```

Transition guard (service layer): `referred → received → actioned → closed`;
`declined` allowed from `referred` only. Illegal transitions rejected.

### 3.3 `access_card_services` (modified)

- Add `agency_id UUID NULL REFERENCES agencies(id)`
- Keep legacy `agency` TEXT for old rows
- `logService` endpoint: exactly one of `agency_id` or `agency` (freeform code) must be
  provided; `agency_id` stored as-is, freeform `agency` code resolved to `agency_id` via
  agencies lookup (unknown code → 422)

## 4. RLS

| Table | Policy |
|-------|--------|
| `agencies` | SELECT for authenticated roles; ALL for `admin` |
| `inter_agency_referrals` | admin ALL; agency roles see rows where `from_agency_id` = their agency OR `to_agency_id` = their agency; mayor/auditor SELECT |
| `access_card_services` | existing admin policy; own-agency rows visible per consent scope |

Consent gating: other-agency service rows visible only when `inter_agency_sharing`
consent is `active` in `consent_ledger`; otherwise masked by `pii.interceptor.ts`.

## 5. Backend

### New modules
- `src/agencies/` — `agency.entity.ts`, `agencies.service.ts` (list, seed),
  `agencies.controller.ts`, `agencies.module.ts`, `dto/agencies.zod.ts`
- `src/inter-agency-referrals/` — `inter-agency-referral.entity.ts`,
  `inter-agency-referrals.service.ts` (create, list-inbox, transition with guards,
  promote-to-case), `inter-agency-referrals.controller.ts`, `inter-agency-referrals.module.ts`,
  `dto/inter-agency-referrals.zod.ts`

### Modified
- `access-cards.service.ts` `logService` — resolve/require `agency_id`
- `access-cards.controller.ts` — add `GET /access-cards/:code/summary`
- `irf-export.service.ts` — replace hardcoded `'MSWDO Norzagaray'` with agencies lookup

### New aggregate endpoint
`GET /access-cards/:code/summary` → `{ servicesRendered, servicesFromOtherAgencies, referralHistory }`
- `servicesRendered`: all card rows (admin/MSWDO) or own-agency rows
- `servicesFromOtherAgencies`: rows with `agency_id` ≠ caller's, gated by consent
- `referralHistory`: `inter_agency_referrals` where `person_id` = card's person,
  both directions

### PSN exact-match (no UI)
On beneficiary/access-card creation, if `philsys_number` provided, check for existing
person with same PSN → link instead of creating duplicate. Single service call.

## 6. Frontend

- New route `/intake/inter-agency-referrals` — list inbox (received + sent), create
  referral form (from agency default = caller's, to agency select, reason, legal basis,
  optional case), transition actions with status timeline
- Access card page: three sections (Services Rendered / Services From Other Agencies /
  Referrals History), stacked cards reusing `PageShell` patterns
- Promotes follow existing Zod + SWR + React patterns

## 7. Migrations

1. `20260803000001-CreateAgenciesTable.ts` — table + seed + RLS
2. `20260803000002-CreateInterAgencyReferralsTable.ts` — table + RLS
3. `20260803000003-AddAgencyIdToAccessCardServices.ts` — column + backfill by code/name

## 8. Error handling

- Illegal status transition → `409 Conflict` with allowed-transitions message
- Unknown agency code → `422` on create
- Consent-inactive other-agency read → masked (200 with empty/redacted rows), not 403
- Case-less referral → allowed; `promote-to-case` action creates case and links

## 9. Testing

- Service specs: transition guard (illegal `closed→referred` rejected), promote-to-case,
  PSN exact-match dedup
- Summary endpoint: consent gating returns masked rows when consent revoked
- Migration up/down round-trip
- Client: existing vitest patterns; referential coverage per component

## 10. Non-goals

- No probabilistic matching UI, no consent-management screens, no committee reports
- No changes to existing barangay→MSWDO `referrals` flow
