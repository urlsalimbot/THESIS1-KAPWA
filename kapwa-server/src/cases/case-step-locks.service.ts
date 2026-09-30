import { Injectable, BadRequestException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CaseStepLock } from './case-step-lock.entity';
import { CasesService } from './cases.service';
import { AuditLogService } from '../audit/audit-log.service';
import { User } from '../auth/user.entity';

/**
 * The one home for step names. The case-view stepper, this service's own
 * rejection message, and the "every step must be sealed" gate in
 * `CasesService` all read these, so a single error message can never spell one
 * step two different ways. Keys are the `step_index` values in the URL.
 */
export const CASE_STEP_LABELS: Record<number, string> = {
  0: 'Assess & Interview',
  1: 'Intervention & Requirements',
  2: 'Inter-agency Referrals',
  3: 'Evaluate Help Given',
  4: 'Case Study & Closure',
};

const LAST_STEP_INDEX = 4;

// Minimum lifecycle position at which a step may be "done". Steps 3 (Evaluate
// Help Given) and 4 (Case Study & Closure) are Phase-Out work: prefilled data on
// an earlier-status case must not make them look complete.
const STATUS_INDEX: Record<string, number> = {
  enrolled: 0, assessed: 1, in_review: 2, active: 3, transitioning: 4, closed: 5,
};
const STEP_MIN_STATUS = [0, 0, 0, 3, 4];

// Step 1 (Intervention & Requirements) is the step that *submits* an assessed
// case for review, so its completion must not itself require a later status —
// gating it on status >= in_review made "Submit for Review" unreachable and
// trapped assessed cases. Steps 3-4 still require their Phase-Out status.
const STEP_STATUS_INDEPENDENT = new Set([0, 1]);

export interface CaseStepLockSummary {
  stepIndex: number;
  lockedByName?: string;
  lockedAt: Date;
}

interface StepDoneOpts {
  requirementsMet?: boolean;
  referralNotNeeded?: boolean;
  interventionNotNeeded?: boolean;
}

/** The case fields the done-predicate reads, so it takes a plain object. */
interface StepDoneCase {
  status?: string | null;
  problemsPresented?: string | null;
  clientCategory?: string | null;
  referrals?: unknown[] | null;
  selfRelianceLevel?: number | null;
  sustainabilityPlan?: string | null;
  clientSignature?: string | null;
  closureOutcome?: string | null;
}

@Injectable()
export class CaseStepLocksService {
  constructor(
    @InjectRepository(CaseStepLock)
    private readonly repo: Repository<CaseStepLock>,
    private readonly cases: CasesService,
    @Optional() private readonly auditLog?: AuditLogService,
  ) {}

  /**
   * Seal a step. Idempotent: sealing an already-sealed step re-stamps who did
   * it rather than raising a unique violation on
   * `uq_case_step_locks_case_step`, because "two staff both sealed it" is not an
   * error worth a 500. `locked_at` is a CreateDateColumn, so it keeps the
   * moment of the *first* seal.
   */
  async lock(caseId: string, stepIndex: number, caller: User): Promise<CaseStepLock> {
    this.assertKnownStep(stepIndex);

    const done = await this.isStepDone(caseId, stepIndex);
    if (!done) {
      throw new BadRequestException(
        `"${CASE_STEP_LABELS[stepIndex]}" is not complete yet — finish it before sealing it.`,
      );
    }

    const lockedByName = this.displayName(caller);
    const existing = await this.repo.findOne({ where: { caseId, stepIndex } });
    if (existing) {
      existing.lockedBy = caller.id;
      existing.lockedByName = lockedByName;
      const saved = await this.repo.save(existing);
      await this.auditLog?.log('case.step_lock', caseId, caller.id, { stepIndex });
      return saved;
    }

    const row = this.repo.create({
      caseId,
      stepIndex,
      lockedBy: caller.id,
      lockedByName,
    });
    const saved = await this.repo.save(row);
    await this.auditLog?.log('case.step_lock', caseId, caller.id, { stepIndex });
    return saved;
  }

  /**
   * Release a seal. Deliberately does not re-check whether the step is still
   * done: undoing a seal is always allowed, and gating it would strand a case
   * whose data was later corrected.
   */
  async unlock(caseId: string, stepIndex: number, caller: User): Promise<void> {
    this.assertKnownStep(stepIndex);
    await this.repo.delete({ caseId, stepIndex });
    await this.auditLog?.log('case.step_unlock', caseId, caller.id, { stepIndex });
  }

  /**
   * The sealed steps of one case, ascending, for the seal strip and for Task 6's
   * "every step sealed" gate. The ascending order is asked of the database
   * rather than sorted here, so a caller never has to re-sort before naming the
   * open steps in an error message.
   */
  async listForCase(caseId: string): Promise<CaseStepLockSummary[]> {
    const rows = await this.repo.find({ where: { caseId }, order: { stepIndex: 'ASC' } });
    return rows.map((l) => ({ stepIndex: l.stepIndex, lockedByName: l.lockedByName, lockedAt: l.lockedAt }));
  }

  private assertKnownStep(stepIndex: number): void {
    if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex > LAST_STEP_INDEX) {
      throw new BadRequestException(
        `Unknown step ${stepIndex} — expected 0..${LAST_STEP_INDEX}`,
      );
    }
  }

  /**
   * Server-side restatement of `stepperStepDone` in
   * `kapwa-client/src/components/case-view/CaseStepper.tsx`. A seal is a
   * durable claim about the case file, so it cannot be taken on the client's
   * word — the same three parts (status-independent guard, status floor, the
   * five branches) are re-derived here from the database. The shared
   * `case-step-done-fixture.json` drives both copies from
   * `case-step-locks.service.spec.ts`, so a branch dropped here fails there.
   */
  private stepDone(
    i: number,
    caseData: StepDoneCase,
    interventionCount: number,
    opts: StepDoneOpts = {},
  ): boolean {
    if (!STEP_STATUS_INDEPENDENT.has(i) && !this.statusAtLeast(caseData.status, STEP_MIN_STATUS[i] ?? 0)) {
      return false;
    }
    switch (i) {
      case 0: return !!caseData.problemsPresented && !!caseData.clientCategory;
      // Implement HIP: an intervention (or the recorded "no intervention"
      // decision) is required; when interventions exist, every required
      // requirement must already be met.
      case 1: return (interventionCount > 0 || Boolean(opts.interventionNotNeeded))
        && (interventionCount === 0 || (opts.requirementsMet ?? true));
      // Service Delivery: a referral is issued, or the social worker recorded
      // that no referral is needed.
      case 2: return (caseData.referrals?.length || 0) > 0 || Boolean(opts.referralNotNeeded);
      case 3: return !!caseData.selfRelianceLevel && !!caseData.sustainabilityPlan;
      case 4: return !!caseData.clientSignature && !!caseData.closureOutcome;
      default: return false;
    }
  }

  /** An unknown or missing status (a partial payload) does not cap the step. */
  private statusAtLeast(status: string | null | undefined, min: number): boolean {
    const index = status == null ? undefined : STATUS_INDEX[status];
    if (index === undefined) return true;
    return index >= min;
  }

  private async isStepDone(caseId: string, stepIndex: number): Promise<boolean> {
    const c = await this.cases.findById(caseId);
    return this.stepDone(
      stepIndex,
      {
        status: c.status,
        problemsPresented: c.problemsPresented,
        clientCategory: c.clientCategory,
        // `referrals` is the @Expose() getter over case_referrals rows.
        referrals: c.referrals,
        selfRelianceLevel: c.selfRelianceLevel,
        sustainabilityPlan: c.sustainabilityPlan,
        clientSignature: c.clientSignature,
        closureOutcome: c.closureOutcome,
      },
      await this.cases.getInterventionCount(caseId),
      {
        requirementsMet: this.requirementsMet(c.requirementsChecklist),
        referralNotNeeded: Boolean(c.referralNotNeeded),
        interventionNotNeeded: Boolean(c.interventionNotNeeded),
      },
    );
  }

  /**
   * Server-side stand-in for the client's `interventionRequirementsMet`, which
   * also weighs the linked programs' required-document keys. The server reads
   * the same source the client's gate reads — `case_requirements`, surfaced as
   * the `requirementsChecklist` getter — and treats "nothing recorded" as
   * nothing outstanding, so the two surfaces cannot disagree about a seal.
   */
  private requirementsMet(checklist: Record<string, boolean> | undefined): boolean {
    const keys = Object.keys(checklist || {});
    if (keys.length === 0) return true;
    return keys.every((k) => checklist?.[k] === true);
  }

  /**
   * First name first, then the extension, over the same four `users` columns
   * `transition()` joins — staff read as "Juan Dela Cruz", never as the
   * "Dela Cruz, Juan" resident format.
   */
  private displayName(user: User): string | undefined {
    const name = [user.firstName, user.middleName, user.lastName, user.nameExtension]
      .filter(Boolean)
      .join(' ');
    return name || undefined;
  }
}
