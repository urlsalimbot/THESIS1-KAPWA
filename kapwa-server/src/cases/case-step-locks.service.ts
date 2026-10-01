import { Injectable, BadRequestException, ConflictException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial, In } from 'typeorm';
import { CaseStepLock } from './case-step-lock.entity';
import { CasesService } from './cases.service';
import { AuditLogService } from '../audit/audit-log.service';
import { CaseIntervention } from '../case-interventions/case-intervention.entity';
import { Program } from '../programs/program.entity';
import { InterAgencyReferral } from '../inter-agency-referrals/inter-agency-referral.entity';
import { User } from '../auth/user.entity';

/**
 * Re-exported, not declared here: `CasesService` has to name the open steps in
 * its review gate, and importing the const from this file would make the two
 * services require each other. See `case-step-labels.ts`.
 */
export { CASE_STEP_LABELS, stepsDueAt, CASE_STEP_MIN_STATUS, CASE_STEP_UNGUARDED_FIELDS } from './case-step-labels';
import {
  CASE_STEP_LABELS, CASE_STEP_MIN_STATUS, CASE_STATUS_INDEX, CASE_STEP_UNGUARDED_FIELDS,
} from './case-step-labels';

const LAST_STEP_INDEX = 4;

// Minimum lifecycle position at which a step may be "done" — `CASE_STEP_MIN_STATUS`
// in `case-step-labels.ts`, which is where it now lives. It moved out of this file
// so the review gate in `CasesService` can derive "which steps are due here" from
// the same array rather than keep its own idea of what may be sealed; see
// `stepsDueAt`. `STEP_STATUS_INDEPENDENT` is why steps 0 and 1 ignore the floor
// entirely, which is also why the floors for those two are both 0.

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
  /**
   * How many inter-agency referrals the case has, read off
   * `inter_agency_referrals` — the table the endorsement letter writes.
   *
   * Deliberately *not* `case.referrals`. That getter is over `case_referrals`,
   * which is the **transition plan's** agency list: written by
   * `updateTransitionPlan` from the exit-plan payload, owned by Phase-Out, and
   * 0 rows in every database this project has run. It is a different thing from
   * an inter-agency referral, and a seal taken against it would let a worker
   * close step 2 with referral rows the referral module never wrote. So the
   * count is passed in instead of read off the case, which also keeps the field
   * out of `StepDoneCase` below — the shape itself now says the step does not
   * read it.
   */
  interAgencyReferralCount?: number;
}

/** The case fields the done-predicate reads, so it takes a plain object. */
interface StepDoneCase {
  status?: string | null;
  problemsPresented?: string | null;
  clientCategory?: string | null;
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
    // The repositories the requirements predicate reads. `CasesService`
    // could own them instead, but the predicate is what needs the programs, and
    // routing it through the cases service would widen that service's
    // constructor for the benefit of a single caller. None of these entities is
    // declared in this module: `CaseIntervention`, `Program` and
    // `InterAgencyReferral` are added to `TypeOrmModule.forFeature` in
    // `cases.module.ts`, which is a registration, not an import edge, so no new
    // require cycle can form through here.
    @InjectRepository(CaseIntervention)
    private readonly interventions: Repository<CaseIntervention>,
    @InjectRepository(Program)
    private readonly programs: Repository<Program>,
    // `inter_agency_referrals` for step 2's "a referral is issued" clause.
    // Registered in `cases.module.ts` beside `CaseIntervention` and `Program`,
    // for the same reason: a repository registration adds no import edge, so
    // this module does not have to require the referrals module.
    @InjectRepository(InterAgencyReferral)
    private readonly interAgencyReferrals: Repository<InterAgencyReferral>,
    @Optional() private readonly auditLog?: AuditLogService,
  ) {}

  /**
   * Seal a step.
   *
   * Written as a single `INSERT ... ON CONFLICT DO UPDATE` rather than the
   * obvious find-then-save. Two staff clicking "seal" on the same step at the
   * same moment is ordinary on a shared case file, and a read-then-write would
   * have both see no existing row and both insert, turning a successful second
   * click into a 500 on `uq_case_step_locks_case_step`. The upsert makes the
   * operation atomic, so the second caller re-stamps the row instead.
   *
   * Only the two identity columns are overwritten. `locked_at` is not in the
   * update list, so the row keeps the timestamp of the *first* seal — that is
   * the moment the step became sealed, which is what a reviewer needs to see.
   */
  async lock(caseId: string, stepIndex: number, caller: User): Promise<CaseStepLock> {
    this.assertKnownStep(stepIndex);

    const done = await this.isStepDone(caseId, stepIndex);
    if (!done) {
      throw new BadRequestException(
        `"${CASE_STEP_LABELS[stepIndex]}" is not complete yet — finish it before sealing it.`,
      );
    }

    const { raw } = await this.repo
      .createQueryBuilder()
      .insert()
      .into(CaseStepLock)
      .values({
        caseId,
        stepIndex,
        lockedBy: caller.id,
        lockedByName: this.displayName(caller),
      })
      .orUpdate(['locked_by', 'locked_by_name'], ['case_id', 'step_index'])
      .returning('*')
      .execute();

    await this.auditLog?.log('case.step_lock', caseId, caller.id, { stepIndex });
    // `RETURNING *` yields raw column names, so map them onto the entity's
    // property names rather than handing back a snake_case object the caller
    // would have to know about. The fallback covers a driver that reports no
    // raw rows, so a successful seal still returns the row it wrote.
    const row = raw?.[0] ?? {};
    return this.repo.create({
      id: row.id,
      caseId: row.case_id ?? caseId,
      stepIndex: row.step_index ?? stepIndex,
      lockedBy: row.locked_by ?? caller.id,
      lockedByName: row.locked_by_name ?? this.displayName(caller),
      lockedAt: row.locked_at,
    } as DeepPartial<CaseStepLock>);
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
    if (!STEP_STATUS_INDEPENDENT.has(i) && !this.statusAtLeast(caseData.status, CASE_STEP_MIN_STATUS[i] ?? 0)) {
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
      // that no referral is needed. The referral is an
      // `inter_agency_referrals` row — what the endorsement letter writes —
      // never `case_referrals`, which is the transition plan's agency list.
      case 2: return (opts.interAgencyReferralCount ?? 0) > 0 || Boolean(opts.referralNotNeeded);
      case 3: return !!caseData.selfRelianceLevel && !!caseData.sustainabilityPlan;
      case 4: return !!caseData.clientSignature && !!caseData.closureOutcome;
      default: return false;
    }
  }

  /** An unknown or missing status (a partial payload) does not cap the step. */
  private statusAtLeast(status: string | null | undefined, min: number): boolean {
    const index = status == null ? undefined : CASE_STATUS_INDEX[status];
    if (index === undefined) return true;
    return index >= min;
  }

  private async isStepDone(caseId: string, stepIndex: number): Promise<boolean> {
    const c = await this.cases.findById(caseId);
    const interventionCount = await this.cases.getInterventionCount(caseId);
    // Step 1 is the only branch that weighs requirements, and the client only
    // weighs programs once an intervention exists, so the two program queries
    // stay off the path for every other step and for a case with nothing to
    // weigh. Answering `true` here is the client's own empty-set answer, not a
    // shortcut around the branch: step 1 still requires an intervention (or the
    // recorded decision) before this value is consulted.
    const requirementsMet =
      stepIndex === 1 && interventionCount > 0
        ? await this.requirementsMet(caseId, c.requirementsChecklist)
        : true;
    // The one extra query step 2 needs, and only step 2 needs it — the same
    // shape as the program queries above, for the same reason: a referral count
    // read on every seal would be a query the other four steps cannot use.
    const interAgencyReferralCount =
      stepIndex === 2 ? await this.countInterAgencyReferrals(caseId) : 0;
    return this.stepDone(
      stepIndex,
      {
        status: c.status,
        problemsPresented: c.problemsPresented,
        clientCategory: c.clientCategory,
        selfRelianceLevel: c.selfRelianceLevel,
        sustainabilityPlan: c.sustainabilityPlan,
        clientSignature: c.clientSignature,
        closureOutcome: c.closureOutcome,
      },
      interventionCount,
      {
        requirementsMet,
        interAgencyReferralCount,
        referralNotNeeded: Boolean(c.referralNotNeeded),
        interventionNotNeeded: Boolean(c.interventionNotNeeded),
      },
    );
  }

  /**
   * The case's referrals as the referrals module wrote them.
   *
   * A `count`, not a load of the rows: step 2 asks whether *any* referral was
   * issued, and the rows themselves are the endorsement letter's business — the
   * same reason the client's step reads the length of the list its own step
   * already fetched and not one row more than that.
   */
  private async countInterAgencyReferrals(caseId: string): Promise<number> {
    return this.interAgencyReferrals.count({ where: { caseId } });
  }

  /**
   * Refuse a write that would change a step whose data has already been sealed.
   *
   * A seal is a claim that the step is finished, so letting the step's own
   * fields move afterwards leaves the claim standing on data nobody agreed to —
   * the all-locked gate would then be satisfiable by a case whose work has
   * drifted, which is the one thing the seal exists to prevent. The alternative
   * (drop the seal on every edit) was rejected: a seal would evaporate as a side
   * effect of an ordinary save, which is a claim disappearing without anyone
   * deciding to release it, and it leaves an audit trail claiming a step was
   * sealed when no act of sealing was ever undone deliberately.
   *
   * Refusing keeps the whole feature's model intact — option (a), soft and
   * reversible: releasing the seal is the same two roles and one click, and the
   * message names it, so a worker who needs to correct a sealed step is never
   * stuck. It is thrown here rather than in each writing service because this is
   * the only place that knows which step a write belongs to, and because the
   * client cannot be the thing that refuses: the PATCH endpoints it would be
   * hiding are callable directly.
   */
  async assertUnsealed(caseId: string, stepIndex: number, body?: unknown): Promise<void> {
    this.assertKnownStep(stepIndex);
    if (this.touchesOnlyUnguardedFields(stepIndex, body)) return;
    const sealed = await this.repo.findOne({ where: { caseId, stepIndex } });
    if (!sealed) return;
    const by = sealed.lockedByName
      ? ` (sealed by ${sealed.lockedByName})`
      : '';
    throw new ConflictException(
      `"${CASE_STEP_LABELS[stepIndex]}" is sealed${by} — release the seal before changing this step, then seal it again.`,
    );
  }

  /**
   * Whether a step currently carries a seal, without deciding anything.
   *
   * The read half of `assertUnsealed`, for a caller that must branch instead of
   * refuse: `GET /filing/:id/download` self-heals a stale document by deleting
   * the row and re-deriving its `case_requirements` entry, and that write is
   * what a sealed step 1 must not suffer. The download itself is a read a worker
   * may legitimately need, so the route skips the heal while sealed rather than
   * refusing the request; this answers the question that decides which.
   */
  async isSealed(caseId: string, stepIndex: number): Promise<boolean> {
    this.assertKnownStep(stepIndex);
    return (await this.repo.findOne({ where: { caseId, stepIndex } })) !== null;
  }

  /**
   * Whether this body touches nothing the seal guards.
   *
   * `assertUnsealed` is about *the step's own data*, not about the route that
   * happens to carry it. One route carries both: `PATCH /cases/:id/transition-plan`
   * writes step 4's self-reliance assessment (which is what the seal claims) and
   * the case's follow-up / home visits (ongoing monitoring, in no step's
   * done-predicate). Guarding the route would mean a worker who sealed the
   * assessment could never record another home visit — the `StepTransition`
   * comment's warning taken as fact, and the comment two lines above the mount
   * would then be asserting two contradictory things.
   *
   * So the decision is made on *which keys the body carries* against
   * `CASE_STEP_UNGUARDED_FIELDS`, and it is made before the seal lookup: a body
   * that cannot change the sealed step does not need to ask whether it is sealed.
   *
   * Three ways this answers false, each deliberate:
   *  - No body at all (`body === undefined`) — the step-field routes that carry
   *    nothing but their own step's data. Blanket refusal, as before.
   *  - A body that is not a plain object (a string, an array, null). Zod has
   *    already run by the time this is called, so this cannot happen in
   *    production; treating it as "guarded" means a surprise shape fails closed.
   *  - A body with **no** keys of its own. `Object.keys` on `{}` is empty, and an
   *    empty body does change nothing — but there is nothing to distinguish an
   *    emptied object from a field the schema added later, so an empty body is
   *    guarded. Refusing a no-op write is a cost paid only on a request that
   *    carries nothing.
   */
  private touchesOnlyUnguardedFields(stepIndex: number, body: unknown): boolean {
    const unguarded = CASE_STEP_UNGUARDED_FIELDS[stepIndex];
    if (!unguarded || body === undefined) return false;
    if (body === null || typeof body !== 'object' || Array.isArray(body)) return false;
    const keys = Object.keys(body as Record<string, unknown>);
    if (keys.length === 0) return false;
    return keys.every((key) => unguarded.includes(key));
  }

  /**
   * Server-side mirror of the client's `interventionRequirementsMet` in
   * `kapwa-client/src/lib/case-progress.ts`.
   *
   * The key set is the *programs'* required documents, not the checklist's keys,
   * because that is what the client's Lock button is gated on and a seal taken
   * against a different key set is a claim the UI never made. The two copies
   * therefore agree on all three inputs: the programs behind the case's
   * interventions, the same `requiredDocumentDetails`-then-`requiredDocuments`
   * preference, and the same `case_requirements` checklist as `Case`'s
   * `requirementsChecklist` getter.
   *
   * The two directions this fixes, both of which an earlier checklist-keyed copy
   * got wrong:
   *  - A program document that never became a checklist row is invisible to a
   *    walk over the checklist's keys, so the server answered "met" on a case
   *    the UI refused to seal. Now the document is in the key set and its
   *    missing row fails the `=== true` test.
   *  - A checklist row belonging to no program of the case is not a program
   *    requirement, so it cannot hold a step hostage. Now it is not in the key
   *    set at all.
   *
   * Read as a whole this is stricter than the copy it replaces and no less
   * strict than the client, which is the only property that matters: the server
   * must never be the surface that permits a seal the UI calls not ready.
   */
  private async requirementsMet(
    caseId: string,
    checklist: Record<string, boolean> | undefined,
  ): Promise<boolean> {
    const programIds = await this.linkedProgramIds(caseId);
    if (programIds.length === 0) return true;
    // `requiredDocumentRows` is `eager: true`, so a plain `find` hands back
    // whole programs and both of the getters the client reads stay derived from
    // real rows rather than from a hand-built shape.
    const programs = await this.programs.find({ where: { id: In(programIds) } });
    // The `In` is the scoping the client does with `programIds.includes(p.id)`
    // over a full program list: only the programs behind *this* case's
    // interventions contribute keys, so a document some other program requires
    // is not this case's requirement.
    const requiredKeys = [...new Set(programs.flatMap((p) => this.requiredDocumentKeys(p)))];
    if (requiredKeys.length === 0) return true;
    const met = checklist || {};
    return requiredKeys.every((key) => met[key] === true);
  }

  /**
   * The distinct programs named by the case's interventions. The same table and
   * the same parameterized-query conventions as `getInterventionCount`, so the
   * count this predicate is paired with and the programs it weighs are two views
   * of one set of rows. `program_id IS NOT NULL` drops the interventions
   * recorded without a program — the client's `.filter(Boolean)` over
   * `programId` drops the same ones.
   */
  private async linkedProgramIds(caseId: string): Promise<string[]> {
    const rows = await this.interventions.query(
      'SELECT DISTINCT program_id FROM case_interventions WHERE case_id = $1 AND program_id IS NOT NULL',
      [caseId],
    );
    return (rows as Array<{ program_id?: string | null }>).map((r) => r.program_id).filter(Boolean) as string[];
  }

  /**
   * Every documentary need of one program — the client's `requiredDocumentKeys`,
   * over the same two getters in the same preference order. `mandatory` is
   * deliberately not consulted: a conditional document counts exactly like any
   * other, so a server that relaxed on the flag would disagree with the client
   * on every program that carries one.
   */
  private requiredDocumentKeys(program: Program): string[] {
    const details = program.requiredDocumentDetails;
    if (Array.isArray(details) && details.length > 0) {
      return details.map((d) => d?.key).filter(Boolean);
    }
    return Array.isArray(program.requiredDocuments) ? program.requiredDocuments : [];
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
