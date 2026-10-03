# Podman stack E2E — findings and fixes

Stack: `kapwa-server/docker-compose.yml` via podman-compose, entry `http://localhost:8090` (Caddy :80).
Method: Playwright MCP only — no direct API queries. Date: 2026-09-30.

## Corrections to the first pass

Two claims in the initial report were wrong. Both are recorded here rather than quietly dropped.

**The register barangay "missing accessible name" was a false positive.** The `<select>` the audit
flagged is Radix's hidden form proxy (`aria-hidden="true"`, `tabindex="-1"`), which is never shown to
a user. The real control is the `[role=combobox]` trigger, which already carried
`aria-label="Select barangay"`. The field was accessible all along; nothing was changed. (A
cosmetic residue remains: `FormLabel` always sets `htmlFor={formItemId}`, and `FormControl`'s Radix
Slot child is the Select root, so the "Barangay" label resolves to nothing. The field is correctly
named by its trigger, the RegisterPage axe test passes, and changing the primitive would touch 100+
call sites — left alone deliberately.)

**`/referrals` was not retired.** I read its absence from `routes.tsx` as deliberate and pointed the
coordinator CTA at `/coordinator/referrals` instead. That was wrong. `9fa73f5` removed the old
`ReferralsPage` because it bundled the inter-agency referral inbox (correctly retired) with the
MSWDO↔barangay referral flow, and dropped both together. The server API for the second flow is fully
intact and role-gated exactly as it should be:

```
POST   /referrals            @Roles('coordinator')                    send
GET    /referrals            @Roles('admin', 'social_worker')         MSWDO queue
GET    /referrals/mine       @Roles('coordinator')                    own referrals
GET    /referrals/counts     @Roles('coordinator')
GET    /referrals/:id        @Roles('admin', 'social_worker', 'coordinator')
PATCH  /referrals/:id/accept @Roles('admin', 'social_worker')         accept
PATCH  /referrals/:id/decline @Roles('admin', 'social_worker')
```

`/referrals` is restored below as a role-aware entry point over those same endpoints.

## Fixed

1. **Retired roles dead-ended on a permanent "Verifying access..."** — `mayor`, `auditor` and the six
   `agency_staff` accounts still authenticate but have no entry in `ROLE_REDIRECT_MAP`, so the guard
   fell back to `/dashboard`, which rejects their role, and redirected to the path it was already on.
   `ProtectedRoute` now detects a role with no home and renders a real screen with a sign-out action
   instead of looping. Regression: two tests in `ProtectedRoute.test.tsx`.
2. **Login password field had no accessible name** — `FormControl` is a Radix `Slot`, and
   `LoginPage` wrapped the password `Input` in a positioned `div.relative` for the show/hide toggle, so
   `id` and `aria-describedby` landed on the `div`. The `div.relative` now sits outside `FormControl`.
   The label resolves to the input again.
3. **Auth pages had no `<h1>`** — `CardTitle` renders a `div`. It now takes an opt-in `as` prop
   (default unchanged, since 84 other usages are widgets inside pages that have their own `h1`); the
   five standalone auth screens use `as="h1"`. This surfaced a real heading-order gap — register's
   section headings were `h3`, now skipping `h2` — so they moved to `h2`.
4. **`apple-touch-icon` pointed at `/icon-192.png`, which does not exist** — `public/` ships SVG. Now
   `/icon-192.svg`; resolves 200 `image/svg+xml`.
5. **`/referrals` restored** for `admin`, `social_worker` and `coordinator`, with the nav entry back.
   The page picks the surface: a coordinator gets their sent referrals and the New Referral button;
   MSWDO gets the pending queue with Accept/Decline. Both verified in the browser.
6. **Caddy config noise** — three `header_up X-Forwarded-*` directives that Caddy already sets, and the
   file was not `caddy fmt` clean (spaces where Caddy uses tabs). Both startup warnings are gone and
   the file is byte-identical to `caddy fmt` output.
7. **`/analytics` route missing** — the running image predated `b7f4df1` ("enable Insights by
   default"), so the flag evaluated false at build time. No code change; the rebuilt image mounts the
   route and the nav entry for admin and social_worker.
8. **Public program cards were not links** — same stale image; `f9210b3` added the `Link` after the
   build. The rebuilt page exposes 64 `/programs/:id` links and the detail page renders.

## Not fixed, deliberately

- **Announcement detail 404s fire two requests.** `/announcements/public/<slug>` and `…/photos` both
  404 for a bad slug. Correct behaviour, noisy log. No change.
- **`kapwa-client` has `RestartCount: 12`** over its life. Not reproduced in this session; cause not
  identified. Worth a look if it climbs again.

## Verification

- Client: 144 files / 1048 tests pass, `tsc --noEmit` clean. No server source touched.
- Failing-before was demonstrated for the two behavioural fixes: `ProtectedRoute` rendered
  `Verifying access...` with no way out; the coordinator CTA landed on the router's `*` route. The
  `ReferralsPage` test was written after the implementation, so I proved it by removing the
  coordinator branch — the coordinator case failed and the other three passed — then restored it.
- Browser sweep after rebuild: 38 route/role probes, 0 failures, 0 stuck spinners, no `NETFAIL` or
  `PAGEERROR`. `/referrals` renders "My Referrals" for a coordinator and "Referral Review" with
  Accept/Decline for MSWDO; the coordinator's New Referral button opens the send form.
- Caddy: `caddy validate` passes; no `unnecessary header_up` and no `not formatted` warnings on a
  full restart.

## Harness note

The Playwright MCP page goes stale after ~40 navigations: synthetic trusted mouse events stop
reaching the page (`locator.click` and `page.mouse.click` silently no-op with zero `pointerdown` at
a document-level capture listener) while `dispatchEvent` and `form.requestSubmit()` still work. Every
"the button does nothing" result came from this, not the app. The dead-end bug was confirmed real
separately: the button was topmost at its centre, `pointer-events: auto`, fully inside a 2560px
viewport with no overlay, and a DOM click produced the correct end state. Use fresh pages when a run
reports dead controls.

A second trap: an `addInitScript` that clears storage re-runs on **every** navigation, so it wipes the
token the login just stored. Clear storage once via `evaluate` instead.

## Artifacts

- `test-results/pw-stack/*.png` — screenshots (note `05-dashboard.png` predates the storage fix)
- `tests/pw-podman-e2e.js`, `tests/pw-podman-func.js`, `tests/pw-podman-regression.js` — untracked
  Playwright suites
---

# Case step locks and deliberate case actions — end-to-end verification (Task 11)

Date: 2026-10-01. Branch `feature/case-step-locks` at `e5a2fd0`, verified in the worktree
`.worktrees/case-step-locks`.

## Stack actually used

Local dev server against the podman database, no image rebuild, as instructed.

- API: `kapwa-server` under Nest `start:dev`, **:3000**, started with
  `DB_HOST=127.0.0.1 DB_PORT=5432 DB_SSL=false DB_USER=kapwa DB_NAME=kapwa DB_PASSWORD=kapwa`
  layered **over** the variables sourced from `infra/.env.production` (read, never edited).
  The podman `kapwa-db` credentials are `kapwa/kapwa`; the RDS password in that file does not
  authenticate locally, so `DB_USER`/`DB_NAME`/`DB_PASSWORD` must be overridden too or the
  server retries `password authentication failed` forever.
- `case_step_locks` already existed on the podman DB; no migration was re-run.
- Client: Vite on **:3001**, not :5173 — `vite.config.ts` pins `server.port = 3001` and
  proxies `/api` and `/socket.io` to :3000. The brief's ":5173" is wrong.
- Two stale dev processes from the **main checkout** (a `node dist/main.js` 21h old on :3000
  and a Vite on the old port) were holding the ports and had to be killed. They serve
  pre-feature code; leaving them would have tested the wrong server.

## Step 2 — suites, as observed

| Suite | Result |
|---|---|
| `kapwa-server` `npx jest --silent` | **110 suites / 1130 tests passed** |
| `kapwa-server` `npm run typecheck` | clean |
| `kapwa-server` `npm run lint` | clean, 0 errors |
| `kapwa-client` `npx vitest run` | **150 files / 1198 tests passed** |
| `kapwa-client` `npm run typecheck` | clean |

The counts in the brief (1130 / 1198) hold. The first client run also printed
`Errors 1 error` — an unhandled `sonner` timer error originating in
`src/pages/IntakeReviewPage.test.tsx`, unrelated to this feature and **not** reproducible on
re-run. Flaky, pre-existing; noted, not investigated.

## The nine scenarios

Case used for 1-7: **KAPWA-2026-00054** (`01a0ccbf-3895-758a-97bc-42cb9259c5db`), chosen
because it sits at `assessed` with an assessment complete, three interventions, and a linked
program ("Home Visit") that requires the document `Valid ID of client`.

**A structural correction to the brief's scenarios 1, 5 and 6.** The case view renders **one
step at a time**, and the stepper refuses to navigate to a step that is neither done nor
reachable (`aria-disabled`, `CaseStepper.handleClick`). So "each of the five steps shows a
Lock" is not observable in one view, and at `assessed` only steps 0, 1 and 2 are even
navigable. `stepsDueAt('assessed')` = `[0, 1, 2]`, so the gate's "four of five" is really
**"two of three sealed"**. Scenarios 5 and 6 below are reported in those terms. Five
simultaneous Locks would need a case at `transitioning`; four were reachable at `active`.

| # | Scenario | Outcome |
|---|---|---|
| 1 | worker1, five steps show a Lock, disabled with reasons | **PASS** (see note) |
| 2 | complete step 0 -> Lock enables -> seal -> strip names worker -> **attempt an edit** | **FAIL** — see D2 |
| 3 | lock again -> no error, strip updates | **PASS** (see note) |
| 4 | unlock step 0 -> Lock returns | **PASS** |
| 5 | gate names the open step and disables the button | **PASS** |
| 6 | all due steps sealed -> button enables -> confirm -> case moves | **PASS** |
| 7 | admin -> exactly one button, "Approve & activate", signature field | **PASS** |
| 8 | coordinator -> no Lock controls anywhere | **PASS** |
| 9 | worker1 re-issues a referral, letter downloads with no 403 | **FAIL, fixed** — see D1 |

### 1 — Lock controls (PASS)

On KAPWA-2026-00054 (`assessed`): step 1 Lock **enabled** (assessment complete), step 2 Lock
**disabled** with `title="Complete this step before sealing it."` plus the visible hint
(its program document is unmet), step 3 Lock **disabled** with the same reason. Steps 4 and 5
are `aria-disabled` in the stepper. On an empty `enrolled` case (KAPWA-2026-00053) the one
reachable step's Lock is disabled with the reason. Once the case reached `active`, step 4
became navigable and showed its own disabled Lock.

### 2 — the lock is not protected (FAIL, D2)

Sealed step 0, strip read `Locked by Juan Dela Cruz - Oct 1, 2026`, API row present. Then
**edited the step's own data**: client category `Indigent` -> `4Ps`, **Save Assessment**.

- The edit was **accepted** — the case row now reads `clientCategory: "4Ps"`.
- The seal **survived** — `stepLocks` still `[{stepIndex: 0, ...}]`, strip unchanged.

So the answer is **neither** of the two behaviours the brief said to assert. The edit is not
refused *and* the lock is not dropped. A second attempt to blank the required
`Problem/s Presented` was blocked, but by the form's own `required` validation, not by the
lock. Confirmed in code as well: `CasesService` deletes a `case_step_locks` row in exactly
one place — the explicit unlock endpoint. Nothing in `updateCase` invalidates a seal.

### 3 — idempotency (PASS, with a caveat)

Two full unlock->lock cycles, no error toast, strip updated each time. **Caveat:** the UI makes
a double-seal unreachable — the control becomes **Unlock** the moment a step is sealed, so the
`ON CONFLICT DO UPDATE` path in `CaseStepLocksService.lock` cannot be exercised from the
browser. It is covered by `case-step-locks.service.spec.ts`, not by this sweep. Also note the
strip renders `formatDate` (day precision), so a re-seal is not visibly distinguishable from
the original seal.

### 4 — unlock (PASS)

Unlock -> the Lock button returns, the strip disappears, `stepLocks` empties. Re-lock re-stamps
`lockedAt` and the strip returns. No error toasts anywhere in the cycle.

### 5 — the disabled gate (PASS)

At `assessed` with steps 0 and 1 sealed, exactly one `Flag for admin review` button, and:

- `disabled === true`
- `title` = `"Steps still open: Inter-agency Referrals"`
- the rendered list under `Seal these steps before flagging for review:` contains exactly
  **Inter-agency Referrals** — the one open *due* step, correctly excluding sealed step 0 and
  correctly excluding steps 4 and 5, which are not due at this status

### 6 — the enabled gate and the transition (PASS)

Satisfied step 2 the legitimate way (the "No Referrals issued" decision) — see D3 for why the
referral route could not be used. All three due steps sealed -> the Flag button **enabled**,
the gate list gone, hint `Moves this case to In Review.` Click -> confirm dialog
`Flag for admin review?` with the hand-off copy -> Confirm -> case **`in_review`**, seals
intact `[0,1,2]`, the Flag button gone.

### 7 — admin (PASS)

On the same case as `admin@mswdo.test`: **exactly one** bar button, `Approve & activate`,
enabled, hint `Moves this case to Active.` (the worker's "Flag for admin review" label is not
shown to admin). Dialog carries `Approver signature`; Confirm is disabled until signed.
Signing `Rosario Mendoza` and confirming landed `status: active`,
`approvedBySignature: "Rosario Mendoza"`, `approvedByRole: "admin"`.

### 8 — coordinator (PASS)

`coordinator.bigte@mswdo.test` is redirected off `/cases/:id` entirely (the route is
`Private roles={['admin','social_worker']}`). Walked `/coordinator/dashboard`, `/referrals`
and three blocked routes: **zero** Lock, Unlock, "Locked by", Flag or Approve controls. Note
the consequence — because the guard is route-level, a coordinator never reaches
`StepLockBar`, so its `readOnly` branch is not what protects them here.

### 9 — endorsement letter (FAIL, then fixed — D1)

**As found:** worker1 filled the "Issue Endorsement Letter" dialog and pressed Issue. UI
toast: **"Could not issue the endorsement letter — Endorsement letter failed: 403"**. No
referral row was created.

The 403 is **not** an authorization failure. The server log says:

    POST /api/v1/inter-agency-referrals/case/<id>/endorsement-letter - 403 - Missing CSRF token

`CsrfGuard` rejects every unsafe request that omits `X-CSRF-Token`, and
`downloadEndorsementLetter` in `kapwa-client/src/lib/api.ts` is a bare `fetch` that sends
only `Authorization`. Every other unsafe request in that file goes through `rawRequest`, which
attaches the header (or the exported `csrfHeaders()`). Isolated proof, same request:

| Call | Result |
|---|---|
| exactly what the UI sends (no CSRF header) | **403** `Missing CSRF token` |
| same call **with** the CSRF header | **201**, `application/pdf`, 3255 bytes |
| `GET /inter-agency-referrals/:id/endorsement-letter` (safe method) | **200**, PDF |

So Task 1's server-side fix in `InterAgencyReferralsService` is correct and effective — the
403 it removed was never reached, because the request died in the guard first. **Fixed** (see
D1) and re-verified through the UI: **201**, `application/pdf`, the blob anchor fired with
`download="ENDORSEMENT-01A0F539.pdf"`, dialog closed, no error toast, card switched to
"Endorsement letter issued for this case."

## Defects

### D1 — HIGH — social worker still cannot issue an endorsement letter. **FIXED**

- **Owning component:** `kapwa-client/src/lib/api.ts` -> `downloadEndorsementLetter`.
- **What:** the helper omits `X-CSRF-Token`, so `CsrfGuard` answers 403 before the handler.
  Task 1 relaxed the *service* scope check but never touched this client helper, and no task in
  this plan lists `api.ts`.
- **Fix applied:** spread `...csrfHeaders()` into the POST's headers — the same helper the
  rest of the file already uses. The sibling `downloadEndorsementLetterById` is a GET and
  already passes the guard, so it was left alone.
- **After:** client typecheck clean, **1198/1198** still pass, and the UI flow returns 201 + PDF.
- **Committed on this branch as a separate commit, not folded into Task 1.**

### D2 — MEDIUM — a seal does not survive, or resist, an edit to its own step. **REPORTED, not fixed**

- **Owning component:** ambiguous — the done-predicate is this branch's
  (`CaseStepper.stepperStepDone` / `CaseStepLocksService.stepDone`), but the missing
  invalidation belongs to `CasesService.updateCase`, which no task in this plan touches.
- **What:** after step 0 is sealed, editing that step's fields succeeds and the seal remains. A
  seal is presented as a durable claim about the case file, and this lets the claim outlive the
  data it was taken on — including straight through the `assessed -> in_review` gate.
- **Fix shape:** either refuse edits to a sealed step, or drop the seal when the step's data
  changes. Both are design calls, not one-liners.

### D3 — HIGH — issuing an endorsement letter makes step 3 permanently unsealable. **REPORTED, not fixed**

- **Owning component:** ambiguous — spans this branch's step-3 predicate and a pre-existing
  schema seam.
- **What:** two tables, two truths.
  - The dialog writes `inter_agency_referrals`. `StepIntegratedDelivery` reads that table
    (`useSWR` by case) and, once a letter exists, **hides the whole action block** including
    the "No Referrals issued" escape hatch (`StepIntegratedDelivery.tsx:117`).
  - Step 3's done-predicate reads `caseData.referrals`, whose `@Expose()` getter is backed by
    `case_referrals` — a table with **0 rows in the entire database**.

  So: issue the letter -> the card says "Endorsement letter issued", the no-referral button is
  gone, and step 3's Lock stays disabled forever. The case can never be flagged for review.
  This is a hard deadlock, observed live before the sweep data was reset.
- **Fix shape:** have the referral write path populate `case_referrals` too, or have step 3's
  predicate read the referrals the UI actually writes.

### D4 — LOW — pre-existing, out of scope: `GET /cases/:id/history` 500s on every case view

`CasesService.getHistory` joins `users u ON u.id = ch.changed_by_id`, but
`case_history.changed_by_id` is `character varying` and `users.id` is `uuid` —
`operator does not exist: uuid = character varying`. `getHistory` is **untouched by this
branch** (`git diff main...HEAD` on the file shows no change there), so it is not a
regression. It does mean the Case History panel is broken on every case.

## Step 4 — skipped

Skipped, per the brief's explicit carve-out. Verified instead that Task 6's gate test is real
and green: `kapwa-server/src/cases/cases.service.spec.ts` passes 66/66 and contains both the
`Lock every step before flagging this case for admin review. Still open: ...` assertion and the
`caller that omits userRole is treated as the worker` case at line 546. No second, weaker
direct-API assertion was written.

One thing the browser *did* prove about the gate, without querying it as a test method: the
disabled Flag button and its `title` are computed from the same `stepsDueAt` the server gate
uses, and the names rendered (`Inter-agency Referrals`) match `CASE_STEP_LABELS` exactly, so
the two vocabularies agree at runtime.

## What could not be verified

- **All five Locks in one view** — needs a case at `transitioning`; four were reachable at
  `active`.
- **The double-seal upsert from the browser** — the control flips to Unlock on success, so the
  UI cannot produce a second POST. Covered by the Jest spec only.
- **Step 3 sealed via a real referral** — blocked by D3; verified via the no-referral decision
  instead.
- **`StepLockBar`'s `readOnly` branch for a coordinator** — unreachable, the route guard
  excludes them first. It *was* observed at `active`: a sealed step reads
  `Locked by Juan Dela Cruz - Oct 1, 2026` with **no** Unlock and no Lock button, since
  `readOnly` is status-driven (`CaseViewPage.tsx:436`).

## Harness notes (carried forward)

Both traps in the earlier sweep reproduced exactly and cost time:

1. The page went stale after roughly 40 navigations — `locator.click` no-opped with **zero**
   `pointerdown` at a document capture listener, while `dispatchEvent('click')` worked. Every
   "dead control" in this sweep was this, not the app.
2. Clearing storage with `addInitScript` was avoided; `evaluate` once after load.

One addition: **`nav button` by index is unreliable — select stepper steps by
`button[aria-label^="N. "]`**. Index-based clicks silently missed the step several times and
cost three false dead-ends.

## Test data left behind

KAPWA-2026-00054 is now `active`, sealed on steps 0, 1 and 2, approved by "Rosario Mendoza",
with `clientCategory` changed `Indigent` -> `4Ps` by the D2 experiment, a checklist entry
`{"Valid ID of client": true}`, `referral_not_needed` back to `false`, and one
`inter_agency_referrals` row (the scenario-9 letter). One earlier sweep-created referral row
was deleted to reset the D3 deadlock; nothing else was removed.

Both dev servers were left running: API :3000, client :3001.
---

## Intake → FSM lifecycle → Closed (playwright-cli, UI-only)

Case **KAPWA-2026-00061** (beneficiary "Lifecycle M Pwtest", barangay Poblacion),
driven entirely through the UI with `playwright-cli`. No API calls were made.

| Step | UI action | Result |
|---|---|---|
| Intake | Filled General Intake, submitted → prior-records review → **Register as new client** | Case created, **Enrolled** |
| Step 1 | Assessment filled + saved, then **Lock** | Sealed by Juan Dela Cruz |
| Enrolled→Assessed | **✓ Complete Assessment → Proceed to Intervention** | **Assessed** |
| Step 2 | **Add Intervention** (Home Visit) → requirement **Passed on-site, no copy** (1/1) → **Lock** | Sealed |
| Step 3 | **No Referrals issued** → **Lock** | Sealed |
| Assessed→In Review | **Flag for admin review** (disabled until steps 0/1/2 sealed) → Confirm | **In Review** |
| In Review→Active | admin **Approve & activate** + signature "Rosario G. Mendoza" | **Active**, "Approved By" recorded |
| Step 4 | Self-Reliance **Level 3** + sustainability plan + target date → Save → **Mark Ready for Graduation** | **Transitioning** |
| Close (early) | **Close case** before step 5 sealed | **Refused**: toast "The case could not be moved", names **Case Study & Closure** |
| Step 5 | Outcome **Graduated** + exit notes + drawn client signature → Save Progress → **Lock** | Sealed by Rosario G. Mendoza |
| Transitioning→Closed | **Close case** → Confirm | **Closed** |

**Gates confirmed live:** "Flag for admin review" stays disabled until the due
steps are sealed; "Close case" is refused with the open step named until step 5
is sealed — the server gate, surfaced in the UI.

**Findings**

1. **Sealing a step hides its own forward transition.** Sealing step 1 while
   Enrolled removed the "Complete Assessment → Proceed to Intervention" button —
   the sealed card folds to read-only, transition included — so the worker had to
   **Unlock → advance → re-seal**. Same shape at step 4 (sealing would hide "Mark
   Ready for Graduation"). The natural "seal, then submit" order is blocked for
   step-owned hops.
2. **Step 4 (Evaluate Help Given) is never gated.** It was left unsealed and the
   case still closed. Consistent with the recorded gap (active→transitioning is
   admin-only, so a step-4 seal gate would bind nobody), but "all steps sealed"
   is not actually enforced at closure.
3. **Pre-existing 500 on `/cases/:id/history`** — "operator does not exist:
   uuid = character varying" — the case view's history fetch fails (console
   errors). Matches the earlier D4 record; unrelated to the lock feature.

---

## Fixes for the three findings + signature-pad removal (verified)

- **Finding 3 (history 500)** — fixed and verified live. The join compared
  `users.id` (uuid) with `case_history.changed_by_id` (varchar); it now casts
  `u.id::text`. Reopened KAPWA-2026-00061: no `/cases/:id/history` 500 in the
  console, and the trail renders (Enrolled → Assessed → In Review → Approved by
  admin → …).
- **Finding 1 (sealed step hid its own transition)** — fixed and verified live.
  Sealed step 0 on KAPWA-2026-00053: **"✓ Complete Assessment → Proceed to
  Intervention" stays**, "Save Assessment" is gone, the seal strip and Unlock
  show. The seal freezes the data, not the hop it prepares for.
- **Finding 2 (step 4 never gated)** — fixed; covered by the server gate specs.
  `transitioning -> closed` now asks for every step due at `transitioning` (all
  five), so step 4 — whose own edge is admin-only and therefore ungated — is
  required at closure. The refusal message now names every open due step. Not
  re-driven through a full lifecycle live; the gate tests pin it.
- **Signature pad removed** — the canvas component, the dead `StepSignatures`
  card, and the beneficiary view's worker pad are gone; the closure done-predicate,
  the close precondition, the fixture, and both locales drop `clientSignature`.
  The admin's **typed approver signature is kept** — a text field recording who
  approved, not a pad.
