# KAPWA Case Lifecycle Audit — per category, per program

Audit date: 2026-10-13. Method: read-through of the lifecycle rule engine
(`case-step-labels.ts`, `case-step-locks.service.ts`, `cases.service.ts`, the
case-view components) + a live pass over the running demo app as a social
worker + DB inspection of the local demo data. Findings are ranked:
**P0** = data loss / broken lifecycle, **P1** = blocks a worker, **P2** =
polish. Every finding cites file:line; the smallest fix is proposed.

> Companion doc: `docs/case-lifecycle-research.md` (2026-09-04). That document
> is **stale** — it describes a 5-step stepper and a plain FSM with no seals.
> The implementation has 8–11 steps per category, per-step template floors,
> seal (lock) gates, and phase gates. Do not use it as a reference; the audit
> below describes the implemented model.

---

## 0. The implemented model (verified against code)

- **Statuses**: `enrolled → assessed → in_review → active → transitioning → closed`
  (+ `aftercare` terminal). `closed` reachable from every non-final state.
- **Steps** (`case-step-labels.ts`): common template is
  `assessment, enrollments, interventions, referrals, evaluate, closure`;
  six categories inject category steps:
  - CICL → `+ discernment` and `+ court_hearings` (after referrals)
  - VAWC → `+ protection_order`, `+ court_hearings`
  - CNSP, Indigency/Court-Ordered SCS → `+ court_hearings`
  - Solo Parent → `+ solo_parent`
  - Adoption & Foster Care → `+ adoption`, `+ court_hearings`
- **Floors**: `evaluate` opens at `active`, `closure` at `transitioning`; all
  other steps sealable from `enrolled` (hearings floor at `in_review`).
- **Gates** (seal demands): `assessed→in_review` demands everything due at
  `assessed`; `active→transitioning` demands the whole **implementation
  phase**; `transitioning→closed` demands everything due at `transitioning`.
- **Step-done predicates** live in `CaseStepLocksService.stepDone` + the shared
  `case-step-done-fixture.json`, driven by data counts (interventions,
  enrollments, referrals, hearings) plus explicit `*NotNeeded` flags.
- **Programs**: 38 programs, 111 intervention rows, `required_form` per row
  (15/111 set), required documents per program + per intervention weigh the
  enrollment/intervention seals.

## 1. Findings — verified live or from first-hand code reading

### P1 — copy & identity

| # | Finding | Evidence | Fix |
|---|---------|----------|-----|
| 1.1 | **The case list page is titled "Case Tracker"** with the *tracker's* description ("Real-time view of processed interventions and logs."), and the strings exist in **no locale** — always the English fallback, also for Filipino UI. Two different pages now claim to be "Case Tracker" (the list at `/cases` and "Daily Case Tracker" at `/tracker`). | `pages/CasesPage.tsx:264,272,279` (fallbacks); `cases.title`/`cases.description` absent from `i18n/locales/en|fil/index.ts` | Title the list "Cases" / "Case Registry", the description "All cases and their progress"; add `cases.title`/`cases.description` to en+fil. |
| 1.2 | **Step-number badges concatenate into the accessible name**: "3Intervention & Requirements", "5Evaluate Help Given", "2Protection Order" (screen readers read a run-on number+label). | badge inside the same `<button>` that carries the label (`CaseStepper.tsx`); observed live | Give the button an `aria-label` without the number (`aria-label={label}`), keep the number as a visual badge. |
| 1.3 | **The disabled Lock's only explanation is a native `title` tooltip** ("Complete this step before sealing it."). Disabled buttons do not reliably show `title` tooltips; the worker sees a grey Lock with no reason. | `CaseStepper.tsx` Lock bar; observed live: `disabled:true, title:"Complete this step before sealing it."` | Render a small inline hint under the Lock when disabled ("Complete this step first"), or wrap the button in a span carrying the tooltip. |
| 1.4 | **The case category stays editable at `assessed`, but the server forbids it.** Server: category defines the step template, editable only while `enrolled` (`cases.service.ts:996-1004`). Client: the assessment form (incl. the category select) is `readOnly` only when status leaves `enrolled, assessed` (`CaseViewPage.tsx:570-572`) → at `assessed` a worker can pick a new category and only discovers the rule when the save 400s. (Verify: `StepAssessment.tsx:140-141` binds the select to the draft.) | `cases.service.ts:1000` vs `CaseViewPage.tsx:570`; live-consistent with the gate | Disable the category `Select` when `status !== 'enrolled'` and tell the worker why ("The step template is locked once this case leaves Enrolled"). |

### P1 — data coverage of the "Must accomplish" affordance

| # | Finding | Evidence | Fix |
|---|---------|----------|-----|
| 1.5 | **`required_form` covers 15 of 111 intervention rows — and only two form values exist** (`social_case_study_report` ×14, `referral_form` ×1) even though the catalog defines 5 formats (incl. IRF, Medical Certificate, Death Certificate). For 96 services the "Must accomplish: \<Form>" hint (`StepImplementHIP.tsx:531`) can never appear — the dialog shows only "Requires: docs", so all interventions look equally paperwork-free/paperwork-heavy. | DB: `program_interventions.required_form` distribution; `lib/constants.ts` `INTERVENTION_FORM_FORMATS` (5 formats); seed writes forms only via `scsr_generated` (`seed-programs.ts:100…`) | Fill `required_form` per service in the admin matrix (the editor already supports per-row forms), especially where the service materially produces a form (IRF for CICL blotter steps, medical cert for medical aid). P1 product decision, not a code bug. |
| 1.6 | **Unformatted services still render an empty "Requires:" when the program has no required documents** — the dialog's `Requires:` line has no empty-state copy, leaving a dangling colon. | observed live ("Requires: Valid ID…" only when docs exist; syntax) | Render "No additional documents" or hide the row. |

---

## 2. Findings — automated case-view audit (auditor pass 1)

The following were reported by a dedicated read-through of every case-view
component and `CaseViewPage.tsx`, verified against the code paths. Ranked with
the same P0/P1/P2 scale.

### P0 — data loss

1. **Assessment drafts are silently overwritten by any revalidation.** The
   draft is re-seeded from `caseData` in an effect keyed `[caseData]`
   (`CaseViewPage.tsx:450-470`); SWR is `revalidateOnFocus: true`
   (`routes.tsx:198`) and every header action (`mutate` on crisis toggle
   `:718-721`, reject, COE/PCV issue, any seal) re-fetches. There is no dirty
   flag, no autosave, no `useBlocker`/`beforeunload` anywhere in the client.
   Typing, tabbing away and back → the draft resets to the saved row silently.
   *Fix:* track `assessmentDirty` (set on change, cleared on save); the sync
   effect returns early while dirty.

2. **Follow-up visits can be recorded and then lost.** `StepTransition`
   keeps `followUps` in local state (`StepTransition.tsx:70-88`); the
   visits' own "Save" only renders when the evaluate step is already sealed
   (`:483`), and the Lock that seals it is disabled until
   `selfRelianceLevel && sustainabilityPlan` exist — so on an unsealable
   evaluate step, added visits have no control that persists them, and a
   step click unmounts them. The code comment at `:476-482` says the visits
   keep their own Save; the code only shows it after sealing. *Fix:* show
   Save whenever the local `followUps` differ from the server's, regardless
   of the seal.

3. **Category-step drafts die on step switch.** `StepDiscernment` /
   `StepProtectionOrder` / `StepSoloParent` / `StepAdoption` hold `useState`
   seeded once from `caseData` (`StepCategoryFields.tsx:86-90,154-159,
   219-223,266-271`) with no submit except the Lock. Typing notes then
   clicking another step discards them; notes are in no done-predicate, so
   there is no signal either way. *Fix:* lift drafts into `CaseViewPage`
   (as the assessment already is) or save on blur.

### P1 — UX blocking

4. **Closure outcome is unchangeable after the first seal.** `readOnly` =
   `stepDone.closure || caseClosed` (`CaseViewPage.tsx:607`), i.e.
   `!!closureOutcome`, which disables the outcome radios and Exit Notes
   (`StepClosure.tsx:86,123`) — including after *unlock* ("Unlock it to make
   changes" is false here: unlock leaves the form grey). Exit Notes also
   cannot be typed while sealed. *Fix:* drive `StepClosure`'s read-only from
   the seal alone (as the page already does for enrollments/interventions,
   `:574-581`).

5. **Court Hearings contradicts itself: stepper says done, Lock says not.**
   The page counts **all** non-cancelled events (`CaseViewPage.tsx:314-316`,
   incl. scheduled home visits from StepTransition) while the step's own bar
   counts only `eventType === 'court_hearing'` (`StepCourtHearings.tsx:148,
   279`); the server's done-predicate uses the same all-events count
   (`case-step-locks.service.ts:400-401`). A case with a scheduled home
   visit and no hearing renders a green check on Court Hearings, a disabled
   Lock, and the `active→transitioning` gate naming Court Hearings as still
   open. *Fix:* filter `eventType === 'court_hearing'` in the page count.

6. **Assessment goes read-only at `in_review`/`active` with no
   explanation.** `readOnly` = `caseClosed || !['enrolled','assessed']
   .includes(status)` (`CaseViewPage.tsx:570-572`); for an unsealed step the
   Lock bar returns `null` (`StepLockBar.tsx:286`), so the only cue is a
   bare lock icon (`StepAssessment.tsx:109`). *Fix:* a status strip
   ("This step is locked once the case leaves Assessed").

7. **"Complete Assessment" failures are swallowed** — `markAssessmentComplete`
   catches and only `console.error`s (`StepAssessment.tsx:86-88`); a 400/409/
   network failure stops the spinner with no message. *Fix:* `toast.error`
   via `humanizeError`, like the Lock bar.

8. **The advance control is invisible until the row is saved.** `assessmentDone`
   reads `caseData`, not the draft (`StepAssessment.tsx:63-65`); a worker who
   has typed everything sees no hint and no button. *Fix:* compute the
   "draft done" state from `{...caseData, ...assessment}`.

9. **The sealed strip instructs an action the UI does not offer.** The locked
   branch always prints "Unlock it to make changes" (`StepLockBar.tsx:262-264`)
   while Unlock is hidden when `readOnly` (:268) — the exact case for every
   step of a closed/aftercare case; `StepDiscernment` repeats the same wrong
   sentence for any `readOnly` (`StepCategoryFields.tsx:140`). *Fix:* render
   the notice only when `!readOnly`; drop the duplicate.

10. **Only one referral can ever be issued, silently.** "Add Referral" is
    hidden once any referral exists (`StepIntegratedDelivery.tsx:140`); the
    server allows many; nothing explains the cap and nothing can revoke a
    referral. *Fix:* keep the button (or an explicit "already referred"
    hint) and add a confirmed delete on the row.

11. **A failed endorsement-letter download reports failure for a write that
    committed.** The referral row saves before the PDF is built
    (`inter-agency-referrals.service.ts:100-110`); the client toasts
    "Could not issue the endorsement letter" and skips revalidation
    (`StepIntegratedDelivery.tsx:101-105`) → the next press duplicates the
    referral. *Fix:* revalidate in `catch`; word the toast "may have been
    recorded".

12. **Three destructive deletes have no confirmation and no undo**:
    enrollment remove (`StepEnrollments.tsx:198→90-101`), intervention delete
    (`StepImplementHIP.tsx:386→216-225`), hearing delete
    (`StepCourtHearings.tsx:222→133-144`) all fire `api.del` on one click.
    *Fix:* reuse the `AlertDialog` pattern from `FileUploadList.tsx:415-430`.

### P2 — polish

13. Downloads fail silently or leak raw strings: `downloadCsrPdf` has no
    `.catch` (`StepClosure.tsx:139`); the GIS menu bare (`CaseViewPage.tsx:747,
    750`); raw `"CSR export failed: 500"` strings reach `humanizeError`
    (`lib/api.ts:380,397,488,504`) despite `lib/errors.ts:81-84` claiming to
    filter them.
14. "Case Not Found" copy for every failure (`CaseViewPage.tsx:508-519`) —
    a 500 or offline reads as "may have been removed"; `useSWR.error` is
    never read. *Fix:* branch on error kind.
15. The close-hop gate heading hard-codes "before flagging for review"
    (`CaseActionBar.tsx:349`) while `transitioning→closed` uses the same
    block (:133-147).
16. No "n of m steps sealed" summary; the done check is `aria-hidden`
    (`CaseStepper.tsx:495`), and `statusAtLeast` returns true for unknown
    statuses (`:229`).
17. Unlabelled required inputs: FRVA/SWDI inputs have `<label>` with no
    `htmlFor`/id (`StepAssessment.tsx:202-213`), all transition-plan fields
    (`StepTransition.tsx:206,246,257,267`), Exit Notes has no accessible name
    (`StepClosure.tsx:114-124`).
18. The program picker's empty state is missing (`StepEnrollments.tsx:225-232`)
    — opens empty with no "no programs match this category" message.

*(Audit pass 1; authority for the audit's claims: code paths cited above.)*

---

## 3. Findings — auditor passes

### §3.1 lifecycle rule engine (auditor pass 2)

#### P1 — worker dead ends and gate integrity

| # | Finding | Evidence | Fix |
|---|---------|----------|-----|
| 3.1.1 | **`requestReview` lets a case reach `assessed` with no `caseCategory`** → the assessment done-predicate requires a category (`case-step-locks.service.ts:263-265`) and the category cannot be set once the case leaves `enrolled` (`cases.service.ts:1000-1004`) → the case can never seal `assessment` → **no non-admin can pass the assessed→in_review gate**; only an admin approve/override rescues it. Legacy rows are exactly this shape (migration `…0076` added a nullable column, no backfill). The client happens to require the category in its gate (`StepAssessment.tsx:63-65`), the API alone does not. | `cases.service.ts:688-690` (precondition checks 3 fields) | Add `!c.caseCategory` to the request-review precondition. |
| 3.1.2 | **Court Hearings' done-predicate counts any non-cancelled `case_events` row — including home visits — and the case page mirrors it** (same defect as §2 P1 #5, root-caused server-side). A single scheduled home visit seals the Court Hearings step; the pipeline chip, which counts `event_type='court_hearing'` only (`cases.service.ts:174-179`), shows 0. | `case-step-locks.service.ts:400-402`; `CaseViewPage.tsx:314-316` | Filter `eventType:'court_hearing'` in `countCourtHearings` and the page count (both). |
| 3.1.3 | **A sealed Court Hearings step still accepts API writes**: `case_events` create/update/delete are unguarded (`case-events.controller.ts:28-47`), unlike interventions/enrollments. A worker can delete or cancel every hearing after sealing; the stale seal then satisfies the `active→transitioning` gate. | `case-events.controller.ts` vs `case-interventions.controller.ts:38-52` | `assertUnsealed(caseId,'court_hearings')` at the top of the three case-event routes. |

#### P2 — gate edge cases

| # | Finding | Evidence | Fix |
|---|---------|----------|-----|
| 3.1.4 | **FRVA/SWDI score is sealed inside step 1 but demanded by the next gate.** Score is written only by PATCH /assessment, which opens with `assertUnsealed('assessment')` (`cases.controller.ts:204`); assessed→in_review demands a score (`cases.service.ts:482-484`); the assessment done-predicate does not include one. Seal step 1 first → the exact field the next gate demands is 409'd. Recoverable (Unlock), but the two client sources disagree (`case-progress.ts:10-17` includes the score, `CaseStepper.tsx:268-271` doesn't). | — | Add `(frvaScore ?? swdiScore)` to the assessment branch of both predicates + the shared fixture. |
| 3.1.5 | **'Abandoned or Neglected Child' and 'PWUD — Aftercare' get the common template and aren't legal categories**, though both are court-adjacent (RA 9523/11642 abandonment/declaration; RA 9165 court-referred aftercare) — CNSP, their sibling, carries `court_hearings`. | `constants.ts:149,178`; `case-step-labels.ts:45-67`; `case-events.constants.ts:3-9` | Add both to the template map (CNSP shape) + `LEGAL_CATEGORIES`. |
| 3.1.6 | **No parity test binds the category picker to the step templates** — the next category added silently gets the common template (the FSM parity spec pins roles/floors/phases but never compares template keys to picker items). | `case-fsm-parity.test.ts`; `case-step-labels.spec.ts:181-188` | Assert every `CASE_CATEGORY_GROUPS` item has an explicit template. |
| 3.1.7 | **Requirements checklist is sealed under `interventions` only but the enrollments predicate reads the same checklist** (`case-step-locks.service.ts:338-341`). Enroll a program after sealing interventions → its missing document cannot be ticked → enrollments seal blocked → assessed→in_review unsatisfiable without an Unlock. | `cases.controller.ts:229` | Refuse the checklist write only when *both* steps are sealed. |
| 3.1.8 | **Doc-gate error message doesn't name the missing keys** — a doc-blocked worker gets "…is not complete yet — finish it before sealing it." (`case-step-locks.service.ts:195`) while the method already holds the checklist. | — | List the missing keys in `notDoneReason`. |

#### Documentation drift (comment-vs-code)

- `cases.service.ts:528-533` claims active→transitioning is "deliberately *not* gated" — the code gates it (`:596-597`).
- `cases.service.ts:852-855` says the "no program needed" decision "is reverted when an enrollment exists" — it is never reverted.
- `case-step-locks.service.ts:490-515` header says the key set is "the *programs'* required documents" — it also unions intervention-anchored docs (the client copy agrees; code is right, comment stale).
- `case-step-locks.service.ts:1066` references `assertUnsealed(id, 4)` — the call is `assertUnsealed(id,'closure')`.
- `cases.service.ts:496` references `CASE_STEP_MIN_STATUS` — renamed `CASE_STEP_FLOORS`.
- **Repo guidance is stale**: AGENTS.md says 77 migration files / next key …75; there are 99 files and keys run to …96. Following the documented "next key is 75" would collide. (The tie-check command still prints exactly 62/63/68.)

### §3.2 programs & interventions (auditor pass 4)

#### P0 — deactivating a program silently bricks in-flight cases

| # | Finding | Evidence | Fix |
|---|---------|----------|-----|
| 3.2.1 | **Every case-view surface fetches programs with the default `activeOnly=true`; the server's seals read the table unfiltered.** Deactivate a program an in-flight case is enrolled in and: (a) its required documents vanish from the case checklist, so the client's `requirementsMet` turns `true` and the Lock looks enabled; (b) the server still unions the inactive program's document keys → every seal 400s with the generic "…is not complete yet" naming nothing; (c) there is no in-UI remedy (the programs list cannot even show inactive rows). Same root cause makes the Add-Intervention dialog a **silent no-op**: `dialogProgram` resolves `null` from the filtered list and `handleAdd` hits a bare `return` with the Save button enabled. | `ProgramDetailPage.tsx:118-135`; `ProgramsPage.tsx:53`; `CaseViewPage.tsx:263`; `StepImplementHIP.tsx:75,145-148,185`; server unfiltered: `case-step-locks.service.ts:556`; silent return `StepImplementHIP.tsx:185` | Case-view consumers fetch `?activeOnly=false` (or a case-scoped programs endpoint); make the silent return an explicit error with a toast. |

#### P1 — gate parity and data integrity

| # | Finding | Evidence | Fix |
|---|---------|----------|-----|
| 3.2.2 | **The Enrollments step's Lock ignores the documentary gate the server enforces** — `opts` passes only `enrollmentsNotNeeded`, so `enrollmentRequirementsMet` defaults to `true`; with an unmet document the header stepper shows pending while the step's own Lock is clickable and 400s. | `StepEnrollments.tsx:258-268` vs `CaseStepper.tsx:272`; server `case-step-locks.service.ts:269-271,338-341` | Compute `enrollmentProgramRequirementsMet` in `StepEnrollments` (it has programs + enrollments) and pass it through `opts`. |
| 3.2.3 | **Every requirement write is guarded by the *interventions* seal, including the enrollments step's checklist** (corroborates §3.1.7) — seal interventions first and the enrolled programs' remaining documents can neither be uploaded nor marked, with a 409 naming a different step. | `filing.controller.ts:42-44,101,156`; `cases.controller.ts:229`; `StepEnrollments.tsx:250-256` | Allow requirement writes on either unsealed step; name both in the refusal. |
| 3.2.4 | **"Must accomplish: \<Form\>" is decorational** — shown only inside the Add dialog while a service is selected, gone from the saved card, never persisted on `case_interventions`, and no gate consults it. A case can log `scsr_generated`, seal, activate and close with no SCSR anywhere; the program's document keys are unrelated strings ("Social case study report (if available)"). Seed comment "a program can override (or clear) it" is false (`??` cannot clear). | `StepImplementHIP.tsx:529-535,361-409`; `program-intervention.entity.ts:28-29`; `seed-programs.ts:71,742-745` | Persist the obligation on the intervention or derive the form's document key into the gate; render the hint on saved cards. |
| 3.2.5 | **Matrix save is delete-then-insert, non-transactional; duplicate rows truncate the matrix** — one duplicate `(program, intervention_type)` fails mid-loop → 500 toast *and* a half-written matrix on disk (silent data loss on a failed edit). The editor freely allows picking the same row twice; the create path duplicates → raw 500 instead of 400. | `programs.service.ts:77-92,35-39`; `ProgramInterventionsEditor.tsx:36-88` | zod-refine uniqueness, filter chosen codes in the editor, wrap the rewrite in a transaction. |
| 3.2.6 | **Server never validates that the logged intervention type belongs to the enrollment's program matrix** (client-only promise), and the update path validates nothing — `programEnrollmentId`/`programId` can be retargeted to another case's enrollment; any of the 22 catalog codes can be logged against any program, dragging that code's `intervention_required_documents` into the case gate. | `case-interventions.service.ts:58-69,96-101`; `dto/case-interventions.zod.ts:11`; `program-intervention.entity.ts:6-8` | Join the matrix on create and update; reject absent types; re-run create's enrollment checks on update. |

#### P2 — program model debt

- **3.2.7 Enrollment statuses are only `active|completed|withdrawn`** (no pending/approved/denied); the gate counts *all* rows regardless of status and the dialog lists every enrollment regardless of status — a withdrawn program still carries its documentary gate and accepts new interventions. The only removal is delete, which leaves `case_interventions.program_enrollment_id` dangling (no FK). No capacity/slots concept exists.
- **3.2.8 Catalog gaps**: `disability_aid` is in **no** mapped category list → PWD Assistance and Assistive Device Support are unenrollable for all six mapped categories; CICL and Adoption lists omit `aics`.
- **3.2.9 Admin editing gaps**: `requiredDocuments`, `fundSources`, `name`, `category`, `legalBasis` cannot be edited after creation (schemas support it); `programType` is absent from both zod schemas → the UI cannot create a catalog-typed program (custom programs are untyped → offerable everywhere); `requiredForm` accepts any string.
- **3.2.10 No migration path for in-flight cases**: gates recompute live from the program's current rows, so editing a seeded program silently loosens/tightens historical cases; deleting one degrades to a raw FK 500.
- **3.2.11 The ProgramsPage "inactive" filter is dead** — it never sends `activeOnly=false`, so deactivated programs are unreachable in the list (makes the P0 remediation awkward).
- **3.2.12 `OPTIONAL_DOCUMENT_KEYS` has no effect anywhere** — the `mandatory` flag is display-only; both gates ignore it, so a conditional "(if applicable)" document still hard-blocks sealing with no N/A path (the only outs: upload, or "Passed on-site, no copy").
- **3.2.13 Matrix rows have no `order` column and the eager join has no ORDER BY** — the admin editor cannot reorder; the case dialog screens all its client-side summaries as-of the program row; matrix edits silently retag all prior interventions from a row.
- **3.2.14 `PATCH /requirements` replaces the whole checklist delete-then-insert, no transaction** — concurrent workers can clobber each other's marks.
- **3.2.15 `enrollmentsNotNeeded` is never reverted** — a case can carry both the flag and enrollment rows; the UI then hides "Enroll in a program" while rows exist (corroborates §3.1 comment-drift).

### §3.3 cross-cutting UX (auditor pass 3)

#### P0 — wrong-surface / dead links

| # | Finding | Evidence | Fix |
|---|---------|----------|-----|
| 3.3.1 | **NotificationsPage re-implements `navTarget` without the claimant/coordinator guard** → notifications open `/cases/:id`, which redirects claimants/coordinators to their dashboards, losing context. The sibling `NotificationsDropdown` has the guard (`NotificationsDropdown.tsx:25-27`), pinned by its test — the page copy was missed. | `pages/NotificationsPage.tsx:23-35` vs `routes.tsx:124,169` | Export `navTarget` from `NotificationsDropdown`; use it in `NotificationsPage`. |
| 3.3.2 | **Coordinator tracker "View" navigates to a route the role cannot open** → `/coordinator/tracker` row click bounces to `/coordinator/dashboard`. The coordinator dashboard already solved this by showing a control number instead of a View link. | `CaseTrackerPage.tsx:106` vs `routes.tsx:156` | Role-aware cell: control number for coordinators, View for staff. |
| 3.3.3 | **"Complete Assessment" fails silently** (same defect as §2 P1 #7 — corroborated from a second angle). | `StepAssessment.tsx:67-90` | `toast.error` + `humanizeError` in the catch. |
| 3.3.4 | **Failed case-view sub-fetches masquerade as empty**: `error` is never destructured; a failed history fetch shows "No activity recorded yet.", documents fetch shows "No documents attached.", the stepper counts 0 interventions/enrollments. A worker may act on a false-empty case. | `CaseViewPage.tsx:201-221`, `:1100-1104`, `:1002-1003` | Per-key `error` → reuse the `ErrorState` pattern (`CasesPage.tsx:270-275`). |
| 3.3.5 | **IRF list fetch has no error path** — unhandled rejection, false empty. | `CaseViewPage.tsx:1270-1272`, `:1283-1289` | `.catch` → error message + retry. |
| 3.3.6 | **GIS PDF / Case Study Report exports fail silently** (fire-and-forget `downloadGisPdf`/`downloadCsrPdf`, both helpers throw). | `CaseViewPage.tsx:747-751,778`; `lib/api.ts:380,397` | Wrap in `toast.error(humanizeError(e))` like `viewGeneratedDoc` (:185-196). |

#### P1 — navigation / i18n

| # | Finding | Evidence | Fix |
|---|---------|----------|-----|
| 3.3.7 | **Coordinators can reach 4Ps/Payouts pages that have no way back** — routes admit `coordinator`, pages have no `backTo`, breadcrumb parent is the staff-only Cases list. | `routes.tsx:125-126`; `FourPsCompliancePage.tsx:59-71`; `PayoutSchedulePage.tsx:11-16` | Role-aware `backTo`. |
| 3.3.8 | **~96 keys the case-view surface requests exist in no locale** — whole steps render English in Filipino mode: the enrollments step, all four category steps, court-hearing decision buttons, the lock-floor hint, the reject dialog. Worst concrete bug: `caseView.generatedDocs/…/viewCertificate/viewVoucher` are defined **only under `caseView.implement.*`** while the page requests them at root — fil translations exist and are dead. | keys vs `locales/en|fil/index.ts` (2,846 keys each, fil parity complete); `CaseViewPage.tsx:1043-1064` | Move the four generated-docs keys to `caseView.*`; add the missing step keys to en (fil auto-parity). |
| 3.3.9 | **The cases filter cannot select Aftercare** — a private `STATUS_LABELS` in `CasesPage` omits it while the table renders aftercare rows; same dead-map pattern in `CaseViewPage`/`CaseTrackerPage` (tracker also omits `closed`). | `CasesPage.tsx:45-53,245,294-295`; `CaseTrackerPage.tsx:42` | Derive filter options from the single `status.*` key set (`i18n/display.ts`). |

#### P2

| # | Finding | Evidence | Fix |
|---|---------|----------|-----|
| 3.3.10 | Misleading transition copy: "Complete Assessment → Proceed to Intervention" actually lands in `assessed`; next real step is "Flag for admin review". | `StepAssessment.tsx:242`; `cases.service.ts:692` | Relabel "→ Proceed to Review". |
| 3.3.11 | Raw English in shared tables: "Loading..." / "No results." untranslated. | `data-table/DataTable.tsx:159,168` | `t()` them. |
| 3.3.12 | The current step is state-only — no `?step=` param, so reloads/deep links always land on the first pending step; `backTo` is always "Back to Cases" even from the tracker. | `CaseViewPage.tsx:198,330-336,661` | `?step=` sync + role/entry-aware back. |
| 3.3.13 | A11y: FRVA/SWDI/family-dialogue labels unassociated (no `htmlFor`/`id`); the focus helper falls back to placeholder selectors. | `StepAssessment.tsx:202-222`; `CaseViewPage.tsx:64-65` | Associate labels/ids. |
| 3.3.14 | Dead role branches: `canUpload` includes roles that cannot mount the page (`StepImplementHIP.tsx:178`, `CaseRequirements.tsx:114`); `CoordinatorWidgets` view-details dead for coordinators; raw `<a href>` page reload instead of `<Link>` (`CaseViewPage.tsx:989`). | — | Remove dead branches; use `<Link>`. |
| 3.3.15 | Label drift "Brgy Coordinator" vs "Barangay Coordinator"; 175 fil values byte-identical to en, incl. the highest-traffic stepper-phase/placeholder keys. | `Topbar.tsx:97` vs `CaseViewPage.tsx:116`; both locales | Unify label; translate the traffic keys. |

---

## 4. Prioritized UX roadmap

**Status:** Phase 1 delivered in `e3d6925`; Phase 2 delivered in `cc263fb`
(see the commit messages for the per-item implementation notes). Phase 3
remains open.

**Phase 1 — stop the leaks (P0) — DONE**

1. Deactivated-program dead end (3.2.1): case views fetch all programs; the silent
   Add-Intervention return becomes a toast; server seal names the missing keys.
2. Draft loss (audit-#1,2,3): `assessmentDirty` guard on the re-seed effect;
   follow-up visits get a Save whenever dirty (not only after the seal);
   category-step drafts lift into `CaseViewPage`; optional `useBlocker` on unload.
3. Court Hearings double-count (audit-#5 = 3.1.2): filter `eventType='court_hearing'`
   in the page count and `countCourtHearings`; guard the events API on the seal (3.1.3).
4. `requestReview` requires `caseCategory` (3.1.1) — the SW dead end.
5. False-empty error handling (3.3.4, 3.3.5): per-key `error` → `ErrorState`,
   IRF fetch `.catch`.

**Phase 2 — gate parity (P1) — DONE**

6. Enrollments Lock honors the documentary gate (3.2.2); requirements writes
   allowed while either owning step is unsealed (3.2.3 = 3.1.7).
7. Intervention-type validated against the enrollment's matrix, create + update (3.2.6).
8. "Must accomplish: \<Form\>" becomes real: persisted obligation on
   `case_interventions`, gate consults it, card shows it (3.2.4). Product
   decision: fill `required_form` beyond the 15 SCSR rows (1.5).
9. Closure outcome editable after unlock (audit-#4). Silent failures get toasts:
   Complete Assessment (audit-#7), GIS/CSR exports (3.3.6).
10. Referral affordance (audit-#10/#11): multiple referrals + revocation with
    confirmation; endorsement-letter failure copy; all destructive deletes get
    the `AlertDialog` treatment (audit-#12).
11. Matrix save transactional + unique (3.2.5); `PATCH /requirements`
    transactional (3.2.14).

**Phase 3 — surface clarity (P2) — DELIVERED (with the program-model debt deferred)**

Done: Cases page identity ("Cases" + description, en+fil); stepper progress
("n of m steps sealed") and state-carrying aria labels; category select locks
outside `enrolled` with the reason shown; "Complete Assessment → Proceed to
Review" copy; DataTable strings through i18n; "Barangay Coordinator" unified;
status filters derive from one shared `CASE_STATUSES` list (aftercare/closed
now filterable); label associations (FRVA/SWDI/family-dialogue/transition/exit
notes); `?step=` deep links; court-adjacent templates + legal categories for
Abandoned/Neglected Child and PWUD aftercare, with a template/picker parity
test that makes every category an explicit decision; catalog gaps closed
(`disability_aid`, `aics`); stale comments and the AGENTS.md migration
guidance refreshed.

Deferred (program-model debt, still open): enrollment status gating (3.2.7),
admin editability + `programType` (3.2.9), the inactive-programs filter
(3.2.11), optional-document N/A path (3.2.12), matrix row order (3.2.13), and
the bulk `required_form` seed fill (1.5) beyond the referral forms.

12. Page identity: list page renamed "Cases", en+fil keys (1.1); accessible step
    names without run-on numbers (1.2); inline reasons on disabled controls (1.3);
    "n of m sealed" summary (audit-#16); `?step=` deep links + entry-aware back
    (3.3.12); category select disabled with reason outside `enrolled` (1.4).
13. Scaffold the untranslated case-view keys (~96) and move the four
    generated-docs keys to the root they're requested under (3.3.8); unify
    "Brgy/Barangay Coordinator" (3.3.15); status filter covers aftercare/closed
    (3.3.9).
14. Program model: enrollment statuses/withdrawn gating (3.2.7), catalog gaps
    `disability_aid`/`aics` (3.2.8), admin editability + `programType` (3.2.9),
    live-deactivate filter (3.2.11), row order (3.2.13), optional-document N/A
    path (3.2.12), legal-category coverage for Abandoned-Neglected/PWUD (3.1.5),
    template/picker parity test (3.1.6), stale comments + AGENTS.md migration
    guidance (3.1 doc-drift).

*(The full detail, code paths and smallest fixes for every item live in §1–§3.)*

---

## Appendix — what the audit did not cover

- Access-card auto-logging, approval-workflow consumers, offline sync payload
  schemas, `evaluate`/`closure` beyond the transition-plan save surface.
- No fuzzing or runtime probes beyond the live walk-through (one case, AICS,
  with a temporary VAWC category swap for the template check).
- Findings marked "auditor pass N" were produced by dedicated read-throughs of
  the cited files and cross-verified where two passes covered the same surface;
  live-runner evidence is marked as such in §1.