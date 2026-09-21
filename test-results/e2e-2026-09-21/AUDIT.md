# KAPWA dev-stack audit — case lifecycle & document exports

Date: 2026-09-21
Environment: Podman Postgres 5432 + MinIO 9000/9001, native NestJS API :3000,
native Vite client :3001. Database rebuilt from scratch (`migrate.ts` bootstrap),
seeded with `seed-accounts` + `seed-demo`.

## Automated coverage

- Server: `npx jest --silent` → 69 suites / 547 tests pass; `npm run typecheck` clean.
- Client: `npm run test:run` → 106 files / 604 tests pass; `npm run typecheck` clean.
- Browser audit (`test-results/e2e-2026-09-21/`, driver `kapwa-e2e.mjs`): 16/16 checks pass.
- Full lifecycle chain verified: `enrolled → assessed → in_review → active → transitioning → closed`.

## Confirmed good

1. **Export filenames follow `docs/FUNCTIONALITY.md §12`** —
   `<CaseType> <caseNo>-<YYYY>-<MM>-<DD>.pdf`, verified via live downloads:
   - `GIS KAPWA-2026-00001-2026-09-21.pdf`
   - `CSR KAPWA-2026-00001-2026-09-21.pdf`
   - `IRF BLT-2026-0001-2026-09-21.pdf`
   - `ACCESS CARD NORZ-AC-2026-0001-2026-09-21.pdf`
2. **Seed creates one stage-themed assistance per case** — 9/9 cases have exactly
   one `serviceRequested` and at most one intervention, matched to the client
   category (PWD → `PWD Assistance`, Senior → `Senior Citizen Social Pension`,
   Indigent → `Financial Assistance (General)` / `Emergency Cash/Food for Work`,
   Family Head → `Livelihood Assistance`).
3. Access Card export button label corrected to “Access Card (PDF)”; route
   renamed `/access-cards/beneficiary/:id/gis-pdf` → `.../access-card-pdf`
   (old path now 404s by design).
4. `csr.controller` (`GET /csr/:controlNo/pdf`) now uses the shared
   `exportFileName('CSR', controlNo)` helper.

## Defects

### D1 — Admin is shown a “Request Review” action that the server rejects (403)
- Client: `kapwa-client/src/pages/CaseViewPage.tsx` `canRequestReview` includes
  `user?.role === 'admin'`.
- Server: `kapwa-server/src/cases/cases.controller.ts` `@Patch(':id/request-review')`
  is `@Roles('social_worker')` only.
- Reproduced in-browser: admin sees the button; the PATCH returns 403.
- Fix options: drop `admin` from the client condition, or add `admin` to the
  endpoint. Given `CASE_FSM_ROLES[ENROLLED] = ['social_worker','coordinator']`,
  dropping `admin` from the client is the smaller, intent-preserving fix.

### D2 — (retracted) `assessed → in_review` already had a UI path
Initial audit looked only at the default step (Assessment) and step 3, so it
missed the existing **“Submit for Review →”** action in `StepImplementHIP`
(step 2), gated on `status === 'assessed' && interventions.length > 0 &&
userRole === 'social_worker'`. It is reachable and works.
Real friction: the action was only visible inside step 2, so a worker on the
default step had no signpost. Fixed by surfacing the same action in the case
header (`CaseViewPage`) under the identical gate.

## Fixes applied after the audit

- **D1** — `CaseViewPage` `canRequestReview` no longer includes `admin`, matching
  the server’s `@Roles('social_worker')`. Verified in-browser: admin sees no
  button; worker sees it and the transition succeeds.
- **D2** — added a `submit-review` action to `useCaseActions` and a header
  “Submit for Review →” button on `CaseViewPage` (same gate as step 2). Verified
  in-browser: `assessed → in_review`.
- **COE/PCV** — removed the Certificate/Voucher links from `ApprovalPipelinePage`;
  they remain on `CaseViewPage` (header strip, `StepImplementHIP`,
  `StepSignatures`, `StepClosure`). Verified in-browser on both pages.
- Browser verification of the fixes: 9/9 checks pass
  (`test-results/e2e-2026-09-21/14..17`).

## Minor / observations

- **IRF JSON filename** is `IRF-<uuid>.json` while the PDF is `IRF BLT-…pdf`.
  Doc §12 covers PDFs only, but the JSON export is inconsistent with it.
- **Closure already closes the case.** `PATCH /cases/:id/closure` transitions to
  `closed`; a following `PATCH /cases/:id/close` returns 400
  (`Invalid transition from closed to closed`). `seed-demo.ts` still calls both,
  which produces the warning seen in seed output.
- `GET /filing/case/:id/id-photo` 404s when a case has no ID photo — expected,
  but logs a console error on every case view.
- **Automation note:** several buttons never satisfy Playwright’s actionability
  stability check (they carry `transition: all`), so the audit driver fires
  DOM `.click()` for those. Human clicks are unaffected.

## Repository changes (uncommitted)

- `kapwa-server/src/csr/csr.controller.ts` — shared export filename helper (+ new `csr.controller.spec.ts`).
- `kapwa-server/src/access-cards/access-cards.controller.ts` — route rename.
- `kapwa-server/src/database/seed-demo.ts` — single stage-themed assistance.
- `kapwa-client/src/lib/export-filename.ts` (+ test), `src/lib/api.ts` — §12 fallbacks.
- `kapwa-client/src/pages/AccessCardViewPage.tsx` (+ test), `src/i18n/locales/{en,fil}/index.ts`, `src/i18n/__tests__/fil-parity.test.ts` — label rename.

## Unexpected workspace change (needs your call)

These tracked files existed at session start but are now deleted from the working
tree; they were not deleted by this audit:
`AUDIT-GAPS.md`, `bugsnow.md`, `login-page.yml`, `wave7-access-card.png`,
`wave8-messages.png`, `mobile-dashboard-header.png`.
Restore with `git checkout -- <paths>` if the deletion was not intentional.
