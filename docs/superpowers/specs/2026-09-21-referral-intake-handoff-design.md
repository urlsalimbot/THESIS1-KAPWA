# Referral → Intake Handoff and Referral Name Schema — Design

Date: 2026-09-21
Status: Design spec
Related: `2026-07-30-referral-ui-enhancement-design.md`,
`2026-08-03-inter-agency-tracking-design.md`, `2026-07-14-intake-redesign-design.md`

## 1. Goal

Accepting a barangay referral, or receiving an inter-agency referral addressed to
MSWDO, hands the worker off to the Intake form pre-filled from the referral. The case
is opened through the standard intake flow instead of being created invisibly by the
accept action, and the referral is linked to the case it produced.

Referral records expose the same name decomposition as `persons`
(surname / first name / middle name / extension) on every surface, including the
inter-agency referral API.

## 2. Problem

1. `referrals.service.accept()` creates a `Beneficiary` and a `Case` server-side and
   stamps `referral.case_id`. The worker never sees or completes an intake; the case
   is opened with only `serviceRequested: [reason]`.
2. Routing acceptance through intake while accept still creates a case would produce
   **two cases per referral**.
3. `inter_agency_referrals` returns the raw `person` relation with no `@Expose()`
   name getters. Its client type declares only `{ id, surname, firstName }`, and two
   screens render `firstName + surname`, dropping the middle name.
4. `IntakePage`'s prefill handler sets person identity fields but ignores `extension`
   and `currentAddress`, even though `PersonForm` carries both and
   `IntakeAddressBlock` renders them.
5. Barangay referral addresses are written only to `person_addresses.raw`; the
   structured `barangay` / `city` / `province` columns stay empty. `Person.currentAddress`
   requires at least one of them, so `Referral.address` is **always `undefined`** today.
   No referral screen displays the address, which is why this went unnoticed.

## 3. Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | `accept` becomes a status change only; the case is created by intake | Avoids the double-case in problem 2; makes the referral's case traceable to a real intake |
| D2 | Inter-agency redirect applies only when `toAgency.code === 'MSWDO'` | `/intake` is admin/social_worker only; an external receiving agency (LTO, RHU) has no MSWDO intake process |
| D3 | The case link is written atomically during intake submit, keyed by an optional `sourceReferral` on the intake payload | One operation, so referral and case can never desync. Mirrors the existing `renewalOfCaseId` pattern |
| D4 | Prefill carries identity + contact + street/barangay + reason; existing raw addresses are not backfilled | Parsing free-text addresses into barangay values can silently mis-assign; the worker confirms address during intake |
| D5 | No database migration | `case_id` columns exist on both referral tables, `person_addresses` already has the structured columns, and no referral table stores a combined name |

## 4. Server

### 4.1 `referrals.service.accept()` — status only

- Remove the `Beneficiary` / `Case` creation block.
- Keep the existing guard (`status` must be `pending`) and set `status = accepted`.
- The response shape is unchanged so existing consumers keep working.

### 4.2 `sourceReferral` on the intake payload

`IntakeInputSchema` gains:

```ts
sourceReferral: z.object({
  type: z.enum(['barangay', 'inter_agency']),
  id: z.string().uuid(),
}).optional()
```

### 4.3 Linking rule

A single shared helper resolves the referral by `type` and id and sets `caseId`.

- Link **whenever the intake yields a case** — the `submitIntake` path (including when
  it returns an existing recent case for an already-known household) and the
  `confirmMatch` path when `caseCreated` is true.
- When the intake yields **no** case (`confirmMatch` info-updated branch), leave the
  referral unlinked so it stays visibly intake-pending rather than silently closing.
- An unknown or already-linked referral id must not fail the intake. Log and continue:
  the intake is the primary operation, the link is bookkeeping.

`IntakeModule` imports `ReferralsModule` and `InterAgencyReferralsModule` (both already
export their services). Neither imports `IntakeModule`, so there is no cycle.

### 4.4 Inter-agency receive

No change to the transition guard. `receive` keeps `referred → received`. The redirect
is a client concern based on `toAgency.code`.

### 4.5 Inter-agency serialization — name schema

Mirror the Wave-2 trio already used by `Referral`:

- Add `@Exclude()` to the `person` relation so the raw person stops leaking.
- Add `@Expose()` getters reading from `this.person`: `surname`, `firstName`,
  `middleName`, `extension`, `gender`, `dob` (formatted `YYYY-MM-DD`, reusing
  `Referral`'s implementation), `address`, `phone`.
- The controller already carries `@UseInterceptors(ClassSerializerInterceptor)` and
  `@SerializeOptions({ strategy: 'exposeAll' })`, so the getters serialize without
  further wiring.

### 4.6 Referral address write path

In `resolveOrCreatePerson`, when `dto.address` is an object, also populate the
structured `barangay` column alongside the existing `raw` composition. `raw` remains
the full display string because `person_addresses` has no `street` column.

The structured `Referral.address` getter is left **unchanged** — `referral-wave2.spec.ts`
asserts its object shape. A raw-backed `addressLine` getter is added alongside it for the
display string, and `InterAgencyReferral` gains the same `address` / `currentAddress` /
`addressLine` trio so both referral payloads are shaped identically. Populating the structured
barangay (above) is what makes `address` resolve in production.

No backfill: existing rows keep resolving through the `raw` fallback.

## 5. Client

### 5.1 Barangay referral accept (`ReferralsPage`)

After a successful accept, navigate to `/intake` with the prefilled state. If the
referral has no `personId`, there is nothing to prefill: keep the current
toast-and-stay behaviour.

### 5.2 Inter-agency receive (`AgencyReferralDetailPage`)

After a successful `receive`, navigate to `/intake` only when the referral's
`toAgency.code === 'MSWDO'`; otherwise keep today's refetch-and-toast behaviour.

### 5.3 Prefill mapping

Route state gains `sourceReferral: { type, id, reason }` alongside the existing
`prefill`. The `prefill` object is produced by a shared helper so both entry points
build it identically:

- `surname`, `firstName`, `middleName`, `extension`
- `gender`, `dob` (already `YYYY-MM-DD`), `cellularNumber` ← `phone`
- `currentAddress`: `barangay` from the structured value, and `street` from the first
  comma-separated segment of `raw` — the only place street is stored, since
  `person_addresses` has no street column. When there is no structured barangay, street is
  left blank rather than guessed from an unstructured string. Region/province/city keep the
  intake defaults (Norzagaray, Bulacan), already correct for referrals raised by
  Norzagaray barangays.

`IntakePage`'s prefill effect is extended to apply `extension` and `currentAddress`.
The referral `reason` becomes `case.serviceRequested` — an existing, currently always-empty
slot — so the reason is not lost now that accept no longer creates the case.

Because `IntakeReviewPage` submits the same `intakeData` object, `sourceReferral`
travels through both terminal paths without extra plumbing.

### 5.4 Intake-pending state and resume

State is derived, never stored: `(status === 'accepted' || status === 'received') && !caseId`.

- The indicator appears in `ReferralsPage` (coordinator and worker views),
  `CoordinatorReferralListPage`, `AgencyReferralsPage`, and `AgencyReferralDetailPage`.
- Intake-pending rows offer **Continue intake**, which re-enters the same pre-filled flow.
  Without it, a worker who closes the tab leaves an accepted referral with no case and no
  way to re-trigger the handoff, because the Accept action is only available while pending.

### 5.5 Display names

Add a shared full-name helper in `referral-utils.tsx` and use it in the places that
currently build `firstName + surname` (inter-agency incoming list, agency referral
detail) and `surname, firstName` (referral table and dialog), so the middle name is
never silently dropped.

## 6. Error handling

| Case | Behaviour |
|------|-----------|
| Accept on a non-pending referral | Unchanged: `403` |
| Accept succeeds but navigation fails | Referral is accepted; the row shows intake-pending with Continue intake |
| Intake submit with an unknown/already-linked `sourceReferral` | Intake succeeds; link skipped and logged |
| `confirmMatch` returns `caseCreated: false` | No link; referral stays intake-pending |
| Referral has no linked person | Accept + toast, no redirect |

## 7. Testing

Server (`npx jest --silent`):

- `referrals.service.spec.ts` — the existing "creates a beneficiary (when missing) and a
  case, then links and accepts" test is **rewritten** to assert that accept no longer
  creates a case.
- New `linkCase` tests on both referral services: links once, rejects/ignores unknown id,
  does not overwrite an existing link.
- `intake.service` tests: `sourceReferral` links on the create path and on the
  `caseCreated: true` confirm path; no link on the info-updated branch.
- Inter-agency serialization test: response exposes `surname`/`firstName`/`middleName`
  and no longer leaks the raw `person` object.

Client (`npm run test:run`, `npm run typecheck`):

- `ReferralsPage` — accept navigates to `/intake` with the expected state; no-person
  referral does not navigate.
- `AgencyReferralDetailPage` — receive by MSWDO navigates; receive by a non-MSWDO agency
  does not.
- `IntakePage` — prefill applies `extension` and `currentAddress`; `sourceReferral` is
  included in the submitted payload.
- `referral-utils` full-name helper.

No migration tests: this change is migration-free by design (D5).

## 8. Non-goals

- No database migration, no new columns, no backfill of existing raw addresses.
- `agency_staff` does not gain access to `/intake`.
- No change to decline, action, close, or batch-family flows.
- The barangay referral creation form and `inter_agency_referrals` create DTO already
  use the name schema and are not modified.
