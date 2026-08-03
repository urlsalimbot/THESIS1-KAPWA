# Inter-Agency Roles & Agency Portal Design

> **Status:** Approved (Section 1–5 reviewed by user)
> **Date:** 2026-08-03
> **Feature:** Dedicated `agency_staff` role + agency-facing portal (non-MSWDO agencies only)

## 1. Problem Statement

The inter-agency tracking feature (Phase 0+1, shipped) added `agencies`, `inter_agency_referrals`, and agency-aware access-card summaries — but agency staff outside MSWDO have no clear role and no dedicated UI:

- **No agency-staff role.** `UserRole` is `admin | social_worker | coordinator | claimant | mayor | auditor`. An RHU/DepEd/PESO user must be created as `social_worker` with an `agencyId` that the client never reads.
- **No dedicated pages.** The inter-agency referrals page sits under the MSWDO "Core" nav with `roles: ['admin','social_worker']`. A non-MSWDO agency user who is a `social_worker` sees the **entire MSWDO system** (Intake, Cases, Beneficiaries, Tracker, IRF, Approvals) — wrong scope and wrong UX. There is no agency dashboard, no agency-branded inbox, no agency profile.

## 2. Goals

1. Introduce a first-class `agency_staff` role with clean separation from MSWDO staff roles.
2. Deliver a dedicated agency portal (4 pages: dashboard, referrals, card activities, agency profile) for non-MSWDO agencies.
3. Keep agency staff **referral-scoped**: no beneficiary browsing, no cases/intake/IRF access.
4. Reuse the existing service-layer scoping (RLS stays dormant); all portal data flows through caller.agencyId checks.
5. Let admins create agency_staff users with an agency assignment from the Admin UsersPanel.

## 3. Non-Goals (Out of Scope)

- Portal for MSWDO staff (they keep the full KAPWA UI; the existing `/intake/inter-agency-referrals` page remains the MSWDO access point).
- Editing agency contact info from the portal (profile is read-only).
- Consent-grant flow for `inter_agency_sharing` (documented limitation of the shipped feature; portal behaves per the existing consent-masking rules).
- Per-agency-type UX variations (health vs police vs labor each get the same portal).

## 4. Role Model

### 4.1 New role

`UserRole.agency_staff` added to `kapwa-server/src/auth/user.entity.ts` enum. `users.role` is a TEXT column — **no migration needed**. `users.agency_id` already exists.

- An agency_staff user is always expected to have `agencyId` set (non-MSWDO agency).
- Role semantics: can view/manage referrals touching their agency, verify cards, log card activities for their agency, view their agency profile. Cannot access MSWDO-only modules (beneficiaries, cases, intake, IRF, approvals, tracker).
- Admin may also have `agencyId` (MSWDO backfilled in migration 1) and retains full access; admin sees the agency portal too (useful for supervision), scoped to their own agencyId.

### 4.2 Role assignment

- **Admin UsersPanel:** when role `agency_staff` is selected in the create/edit user form, an "Agency" select appears (options from `GET /agencies`). `agencyId` is saved with the user on create and can be edited.
- **Server:** `users` create/update DTOs + service must accept and persist `agencyId`. Existing users endpoint behavior otherwise unchanged.
- **Seed:** no backfill migration. A demo agency_staff user (e.g. RHU) may be added to `seed-accounts.ts` for manual testing.

### 4.3 Redirect & labels

- `ProtectedRoute` redirect map: `agency_staff → /agency/dashboard`.
- Topbar label for `agency_staff`: resolve agency name from `queryKeys.agencies.list()` by `user.agencyId` → e.g. "RHU — Rural Health Unit"; fallback "Agency Staff".

## 5. Server Design

### 5.1 New module: `kapwa-server/src/agency-portal/`

Files: `agency-portal.module.ts`, `agency-portal.controller.ts`, `agency-portal.service.ts`, `agency-portal.service.spec.ts`.

**`GET /agency-portal/dashboard`** — `@Roles('agency_staff','admin')`
```json
{
  "agency": { "id": "...", "code": "RHU", "name": "Rural Health Unit - Norzagaray", "type": "health", "contactInfo": null },
  "counts": {
    "total": 5, "sent": 2, "received": 3,
    "byStatus": { "referred": 3, "received": 1, "actioned": 1, "closed": 2, "declined": 1 }
  },
  "recent": [ /* latest 5 referrals, relations: fromAgency, toAgency, person, case */ ]
}
```
- Implementation: inject `InterAgencyReferralsService`; call `findInbox(caller)` for the scoped list; compute counts in JS (`sent` = fromAgencyId === caller.agencyId, `received` = toAgencyId === caller.agencyId; `byStatus` counts across all scoped rows). Slice `recent` to 5.
- Agency info: `AgenciesService.findById(caller.agencyId)`.
- **403 Forbidden** (`AgencyPortalException` → `ForbiddenException('Your account is not linked to an agency')`) when `caller.agencyId` is missing — no 500.

**`GET /agency-portal/profile`** — `@Roles('agency_staff','admin')`
- Returns the caller's own agency row via `AgenciesService.findById(caller.agencyId)`; 403 if no agencyId.

**Module wiring:** imports `TypeOrmModule.forFeature([InterAgencyReferral])` (if the service needs a repo directly — preferred: use `InterAgencyReferralsService` only, then no repo import needed), `AgenciesModule`, `AuthModule`. Registers in `app.module.ts`.

### 5.2 Guard additions (add `agency_staff` to `@Roles`)

| Controller | Routes | Reason |
|---|---|---|
| `inter-agency-referrals.controller.ts` | all (inbox, person, create, receive, action, close, decline, promote) | agency staff run the closed loop |
| `access-cards.controller.ts` | `GET :code/summary`, `GET :cardCode`, `GET beneficiary/:id/card`, `POST log`, `GET /` | portal verify + log + history; summary already scopes by caller.agencyId |
| `agencies.controller.ts` | `GET /` (list), `GET /:id` (new) | create-referral agency select + profile fallback |

**Deliberately NOT added** (referral-scoped only): beneficiaries, cases, intake, irf, approvals, tracker, announcements-manage controllers.

### 5.3 New endpoint: `GET /agencies/:id`

`AgenciesController` — roles `admin`, `social_worker`, `agency_staff`. Uses existing `AgenciesService.findById(id)`; `NotFoundException` when missing (matches repo patterns). Used by the portal profile page if the portal endpoint is unavailable, and by the UsersPanel agency select (list).

### 5.4 Users API: accept `agencyId`

- Verify the users create/update DTOs (`auth` or `admin` module — locate exact file during implementation); add optional `agencyId: z.string().uuid()` to the schema.
- Service persists `agencyId` on create/update. Role validation must accept `agency_staff` in the role enum checks (any role-list validation in the users service).

## 6. Client Design

### 6.1 Routes (`routes.tsx`) — all behind `Private roles={['agency_staff','admin']}`

| Path | Page |
|---|---|
| `/agency` | redirect → `/agency/dashboard` |
| `/agency/dashboard` | `AgencyDashboardPage` |
| `/agency/referrals` | `AgencyReferralsPage` |
| `/agency/card-activities` | `AgencyCardActivitiesPage` |
| `/agency/profile` | `AgencyProfilePage` |

### 6.2 Nav (`nav-config.tsx`)

New section **"Agency Portal"** (roles `['agency_staff','admin']`):
- Dashboard (`/agency/dashboard`)
- Referrals (`/agency/referrals`)
- Card Activities (`/agency/card-activities`)
- Agency Profile (`/agency/profile`)

### 6.3 Pages (4 new files in `kapwa-client/src/pages/`)

1. **AgencyDashboardPage** — fetches `queryKeys.agencyPortal.dashboard()`. Stat cards (Total / Sent / Received / Closed / Declined), recent-referrals list with status badges + agency names, quick actions ("View Inbox" → `/agency/referrals`, "Log Activity" → `/agency/card-activities`). Shows the agency name in the header.
2. **AgencyReferralsPage** — the closed-loop experience (inbox All/Received/Sent filters, create form, transition buttons) branded for the agency. **Shared components:** extract `ReferralCard`, `CreateReferralForm`, `StatusTimeline`, `STATUS_LABELS` from `InterAgencyReferralsPage.tsx` into `kapwa-client/src/components/referrals/` (one `ReferralCard.tsx`, one `CreateReferralForm.tsx`, one `referral-utils.ts`); the MSWDO page (`InterAgencyReferralsPage.tsx`) becomes a thin wrapper over the same components. Behavior unchanged for MSWDO.
3. **AgencyCardActivitiesPage** — verify card (`GET /access-cards/:code` + `GET /access-cards/beneficiary/:code/card` — note: the coordinator page's `beneficiary/:code/card` call 400s because the route expects a UUID; the portal version should use the same pattern as the working access-card summary/verify paths, i.e. `findByCard` + optionally the summary endpoint `GET /access-cards/:code/summary` for the person). Shows service history; **Log Activity form** with agency select **pre-selected to `user.agencyId`** (changeable), POST `/access-cards/log` with `agencyId` (exactly-one DTO rule satisfied).
4. **AgencyProfilePage** — read-only agency info from `queryKeys.agencyPortal.profile()`: name, code, type, contact info.

### 6.4 Query keys (`query-keys.ts`)

- `agencyPortal.dashboard()` → `['agency-portal','dashboard']`
- `agencyPortal.profile()` → `['agency-portal','profile']`

### 6.5 UsersPanel agency select

- When role `agency_staff` selected (create or edit): render Agency `<select>` from `queryKeys.agencies.list()`; value = `user.agencyId`.
- Save: include `agencyId` in the create/update payload; on edit, allow changing agencyId.
- The role dropdown must include the new `agency_staff` option ("Agency Staff").

## 7. Security & Scoping

- All portal data goes through existing service-layer scoping (`caller.agencyId` ∈ {from,to}); RLS stays dormant (consistent with the codebase).
- `agency_staff` without `agencyId`: dashboard/profile → 403; inbox → `[]`; create → 403 (existing guard from the final review); summary → agency branch (no consent → other-agency masked).
- Card summary for agency_staff uses the existing agency branch — own-agency services shown, other-agency services only when `inter_agency_sharing` consent active or admin. No logic change.
- No new PII surface: agency staff cannot browse beneficiaries, cases, or profiles.

## 8. Error Handling

| Case | Behavior |
|---|---|
| agency_staff, no agencyId, hits portal dashboard/profile | `403 Forbidden` with clear message |
| agency_staff, no agencyId, creates referral | `403` (existing guard) |
| unknown agency id in `/agencies/:id` | `404 NotFoundException` |
| log activity with both/neither agencyId+agency | `400` via existing XOR DTO refine |

## 9. Testing

### 9.1 Server

- `agency-portal.service.spec.ts`:
  - dashboard returns scoped counts (sent vs received split; status counts correct)
  - admin caller with agencyId=MSWDO gets MSWDO-scoped dashboard
  - no agencyId → 403 Forbidden
  - recent list shape (≤5, relations present)
  - profile returns own agency; 403 when no agencyId
- `agencies.controller` / service: `GET /:id` returns agency, 404 when missing (extend `agencies.service.spec.ts`).
- Users API: create/update with `agencyId` persists; `agency_staff` role accepted (extend the users spec — locate during implementation).
- Existing specs re-run: agencies, inter-agency-referrals, access-cards (guard changes must not break them).

### 9.2 Client (vitest)

- `AgencyDashboardPage.test.tsx` — stats render from mocked dashboard; error state.
- `AgencyReferralsPage.test.tsx` — shared components render; create + receive/close flows (mirror `InterAgencyReferralsPage.test.tsx` patterns).
- `AgencyCardActivitiesPage.test.tsx` — verify card → history renders; log activity POSTs with agencyId.
- `AgencyProfilePage.test.tsx` — agency info renders.
- Route/nav: `agency_staff` redirects to `/agency/dashboard`; nav section visible for `agency_staff`, hidden for others (extend an existing routing test or add one).
- UsersPanel: selecting agency_staff shows agency select; save payload includes agencyId.

### 9.3 E2E (Playwright MCP — after implementation)

- Admin creates an agency_staff user (RHU) via UsersPanel with agency select.
- RHU agency_staff logs in → lands on `/agency/dashboard`; MSWDO nav items hidden; Topbar shows "RHU …".
- Dashboard counts match seeded referrals; create → receive → action → close a referral from the portal; log a card activity; profile page renders.
- Access attempt to `/beneficiaries` as agency_staff → blocked (redirect).

## 10. File Summary

**Server — new**
- `kapwa-server/src/agency-portal/agency-portal.module.ts`
- `kapwa-server/src/agency-portal/agency-portal.controller.ts`
- `kapwa-server/src/agency-portal/agency-portal.service.ts`
- `kapwa-server/src/agency-portal/agency-portal.service.spec.ts`

**Server — modified**
- `kapwa-server/src/auth/user.entity.ts` — add `agency_staff` to `UserRole`
- `kapwa-server/src/auth/` or `admin/` users controller+service+DTOs — accept/persist `agencyId`, accept `agency_staff` role
- `kapwa-server/src/agencies/agencies.controller.ts` — `GET /:id` + role additions
- `kapwa-server/src/inter-agency-referrals/inter-agency-referrals.controller.ts` — add `agency_staff` roles
- `kapwa-server/src/access-cards/access-cards.controller.ts` — add `agency_staff` roles
- `kapwa-server/src/app.module.ts` — register `AgencyPortalModule`
- `kapwa-server/src/agencies/agencies.service.spec.ts` — `GET /:id` tests
- `kapwa-server/src/database/seed-accounts.ts` — optional demo agency_staff account

**Client — new**
- `kapwa-client/src/pages/AgencyDashboardPage.tsx` (+ `.test.tsx`)
- `kapwa-client/src/pages/AgencyReferralsPage.tsx` (+ `.test.tsx`)
- `kapwa-client/src/pages/AgencyCardActivitiesPage.tsx` (+ `.test.tsx`)
- `kapwa-client/src/pages/AgencyProfilePage.tsx` (+ `.test.tsx`)
- `kapwa-client/src/components/referrals/ReferralCard.tsx`
- `kapwa-client/src/components/referrals/CreateReferralForm.tsx`
- `kapwa-client/src/components/referrals/referral-utils.ts`

**Client — modified**
- `kapwa-client/src/lib/query-keys.ts` — `agencyPortal` group
- `kapwa-client/src/routes.tsx` — 5 agency routes
- `kapwa-client/src/lib/nav-config.tsx` — "Agency Portal" section
- `kapwa-client/src/components/ProtectedRoute.tsx` — redirect map
- `kapwa-client/src/components/Topbar.tsx` — agency_staff label resolution
- `kapwa-client/src/components/UsersPanel.tsx` — agency select for agency_staff
- `kapwa-client/src/pages/InterAgencyReferralsPage.tsx` — thin wrapper over shared components

## 11. Open Questions (resolved during implementation)

- Exact location of the users create/update DTOs and whether role validation is a list — locate in `auth` or `admin` module and extend.
- Whether `AgencyPortalService` needs its own repo import or can rely solely on `InterAgencyReferralsService.findInbox` — prefer the latter (no duplication).
