# Auto-Assign Intake Worker + Case Header Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically assign every new case's worker to the logged-in intake user, and remove the always-empty Certificate URL / Petty Cash Voucher rows from the case header.

**Architecture:** Server: the intake controller passes `req.user.id` into `submitIntake` and `confirmMatch`; the service sets `assignedWorkerId: callerId` (always — the logged-in user, per user decision) at both case-creation sites. Client: delete two header rows from the case-info grid in `CaseViewPage`.

**Tech Stack:** NestJS (server), React 18 + TypeScript (client), Jest (server tests), Vitest (client tests).

## Global Constraints

- Server: `submitIntake(data, callerId)` and `confirmMatch(householdId, data, workerBarangays, callerId)` — `assignedWorkerId: callerId` ALWAYS (any payload value is ignored; the logged-in user is the assigned worker).
- Client: remove ONLY the Certificate URL and Petty Cash Voucher rows from the case-info grid; keep Service Requested, Assigned Worker, Approved By, Remarks. No i18n key changes.
- `submitBatchFamily` is NOT touched (does not create a case).
- The working tree contains unrelated uncommitted changes (a card-overlap bug fix + user docs edits) — commits must NOT include them.
- Server tests: `npx jest <path> --silent`; server typecheck `npm run typecheck` (from `kapwa-server/`). Client tests `npm run test:run` + `npm run typecheck` (from `kapwa-client/`).

---

### Task 1: Server — auto-assign the intake worker to new cases

**Files:**
- Modify: `kapwa-server/src/intake/intake.controller.ts` (`submitIntake` gains `@Request()`; `confirmMatch` passes `req.user.id`)
- Modify: `kapwa-server/src/intake/intake.service.ts` (`submitIntake(data, callerId)`; `confirmMatch(..., callerId)`; `assignedWorkerId: callerId` at both creation sites, lines 178 and 472)
- Test: `kapwa-server/src/intake/intake.service.spec.ts`

**Interfaces:**
- Produces: `IntakeService.submitIntake(data: IntakeInput, callerId: string)` and `IntakeService.confirmMatch(householdId: string, data: ConfirmMatchInput, workerBarangays: string[], callerId: string)`. Both set `assignedWorkerId: callerId` on any case they create.

- [ ] **Step 1: Update the controller**

In `kapwa-server/src/intake/intake.controller.ts`:

1. Change `submitIntake` to pass the authenticated user:
```ts
  @Post()
  @Roles('admin', 'social_worker')
  async submitIntake(
    @Body(new ZodPipe(IntakeInputSchema)) body: IntakeInput,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.intakeService.submitIntake(body, req.user.id);
  }
```

2. Change `confirmMatch` to pass `req.user.id` as the 4th argument:
```ts
    return this.intakeService.confirmMatch(householdId, body, permittedBarangays, req.user.id);
```

`@Request` and `AuthenticatedRequest` are already imported (lines 1 and 9).

- [ ] **Step 2: Write the failing tests**

Update `kapwa-server/src/intake/intake.service.spec.ts`:

1. Every existing `service.submitIntake(validIntakeInput)` call becomes `service.submitIntake(validIntakeInput, 'caller-1')`. There are four: the happy-path test (~line 168), the control-number format test (~line 197), the surname test, and the rollback test. (Grep `submitIntake(` in the file to find all call sites.)
2. Every existing `service.confirmMatch(` call gains a trailing `'caller-1'`: `service.confirmMatch('nonexistent-id', validIntakeInput, [], 'caller-1')` (~line 282), `service.confirmMatch('hh-id', validIntakeInput, ['Matictic'], 'caller-1')` (~line 290), and `service.confirmMatch('existing-hh', validIntakeInput, ['Bigte'], 'caller-1')` (~line 317).
3. Add an assertion to the happy-path submitIntake test (after the `expect(result).toHaveProperty('status', ...)` line) that the case was created with the caller as assigned worker:
```ts
      expect(caseRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          assignedWorkerId: 'caller-1',
          controlNo: 'KAPWA-2026-00001',
          status: CaseStatus.ENROLLED,
        }),
      );
```
4. Add an assertion to the confirmMatch create-case test (after `expect(result).toHaveProperty('status', ...)`, ~line 324):
```ts
      expect(caseRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ assignedWorkerId: 'caller-1' }),
      );
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest src/intake/intake.service.spec.ts --silent` (from `kapwa-server/`)
Expected: FAIL — `service.submitIntake is not a function` / signature mismatch (callerId not accepted), or the `assignedWorkerId` assertion fails because it's undefined.

- [ ] **Step 4: Implement the service changes**

In `kapwa-server/src/intake/intake.service.ts`:

1. Change the `submitIntake` signature (line 107) and its case creation (line 178):
```ts
  async submitIntake(data: IntakeInput, callerId: string): Promise<{
```
and
```ts
        assignedWorkerId: callerId,
```
(remove `data.case.assignedWorkerId` at line 178).

2. Change the `confirmMatch` signature (line 386) and its case creation (line 472):
```ts
  async confirmMatch(householdId: string, data: ConfirmMatchInput, workerBarangays: string[], callerId: string): Promise<ConfirmMatchResponse> {
```
and
```ts
          assignedWorkerId: callerId,
```
(remove `data.case.assignedWorkerId` at line 472).

3. Update the `@ts-expect-error`/mismatched service calls in specs per Step 2.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest src/intake/intake.service.spec.ts --silent` (from `kapwa-server/`)
Expected: ALL tests pass, including the two new `assignedWorkerId` assertions.

- [ ] **Step 6: Typecheck the server**

Run: `npm run typecheck` (from `kapwa-server/`)
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add kapwa-server/src/intake/intake.controller.ts kapwa-server/src/intake/intake.service.ts kapwa-server/src/intake/intake.service.spec.ts
git commit -m "feat: auto-assign cases to the logged-in intake worker"
```

---

### Task 2: Client — remove Certificate URL and Petty Cash Voucher from case header

**Files:**
- Modify: `kapwa-client/src/pages/CaseViewPage.tsx` (case-info grid, ~lines 266-273)

**Interfaces:**
- Consumes: nothing new — the existing `caseData` object.

- [ ] **Step 1: Remove the two header rows**

In `kapwa-client/src/pages/CaseViewPage.tsx`, inside the case-info grid (`<div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">`), delete these two blocks:

```tsx
              <div>
                <span className="text-muted-foreground">{t('cases.certificateUrl', 'Certificate URL')}</span>
                <p className="font-medium truncate">{caseData.certificateUrl || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t('cases.pettyCashVoucher', 'Petty Cash Voucher')}</span>
                <p className="font-medium truncate">{caseData.pettyCashVoucherUrl || '—'}</p>
              </div>
```

Keep Service Requested, Assigned Worker, Approved By, and Remarks rows. `Download`/`FileText` icons remain used elsewhere — no import changes.

- [ ] **Step 2: Run tests and typecheck**

Run: `npm run test:run` then `npm run typecheck` (from `kapwa-client/`)
Expected: no failures; `tsc` exit 0.

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/src/pages/CaseViewPage.tsx
git commit -m "fix: drop empty certificate/petty-cash rows from case header"
```

---

## Self-Review

**1. Spec coverage:** Server — controller passes `req.user.id` (Task 1 Step 1), service sets `assignedWorkerId: callerId` at both creation sites (Task 1 Step 4), specs updated + assertions (Task 1 Step 2). Client — two rows removed (Task 2 Step 1). `submitBatchFamily` untouched. i18n untouched. ✓

**2. Placeholder scan:** All steps carry complete code/commands. ✓

**3. Type consistency:** `callerId` is `req.user.id` (string) end-to-end; both service signatures and their controller call sites updated together; the two spec call sites and assertion patterns match the existing spec style (`caseRepo.create` mocked via `stubCreates`). ✓