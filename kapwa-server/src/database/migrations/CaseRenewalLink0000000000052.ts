import { MigrationInterface, QueryRunner } from 'typeorm';

// Recurring programs (e.g. 4Ps): each assistance cycle is a new case linked to
// the same beneficiary/household. cases.renewal_of_case_id soft-links the new
// cycle to the case it renews so the recurrence chain is explicit. The case
// history per beneficiary remains the authoritative timeline.
export class CaseRenewalLink0000000000052 implements MigrationInterface {
  name = 'CaseRenewalLink0000000000052';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS renewal_of_case_id UUID`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_cases_renewal_of ON cases(renewal_of_case_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_cases_renewal_of`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS renewal_of_case_id`);
  }
}