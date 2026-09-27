import { MigrationInterface, QueryRunner } from 'typeorm';

// Case-level flag mirroring `referral_not_needed`: a worker may record that no
// intervention is issued for a case — in which case at least one referral must
// exist before the case can activate (see CasesService.validateTransition).
export class ZAddCaseInterventionNotNeeded0000000000062 implements MigrationInterface {
  name = 'ZAddCaseInterventionNotNeeded0000000000062';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE IF EXISTS cases ADD COLUMN IF NOT EXISTS intervention_not_needed BOOLEAN NOT NULL DEFAULT FALSE`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE IF EXISTS cases DROP COLUMN IF EXISTS intervention_not_needed`);
  }
}