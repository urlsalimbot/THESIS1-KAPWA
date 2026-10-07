import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The Court Hearings step's second completion, matching the three it already
 * has a sibling flag for: `enrollments_not_needed`, `intervention_not_needed`
 * and `referral_not_needed`.
 *
 * Without it a case on which the office must attend no hearing — a common
 * outcome for the non-statutory categories — had no way to finish the step: the
 * done-predicate counted hearings, and zero rows meant the step stayed open
 * forever, which in turn kept the `active -> transitioning` seal gate
 * unsatisfiable.
 *
 * Default FALSE, so no backfill: every existing case keeps its current
 * behaviour (count > 0 decides) until someone records the decision.
 */
export class ZAddCourtHearingsNotNeeded0000000000085 implements MigrationInterface {
  name = 'ZAddCourtHearingsNotNeeded0000000000085';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE IF EXISTS cases ADD COLUMN IF NOT EXISTS court_hearings_not_needed BOOLEAN NOT NULL DEFAULT FALSE`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE IF EXISTS cases DROP COLUMN IF EXISTS court_hearings_not_needed`);
  }
}
