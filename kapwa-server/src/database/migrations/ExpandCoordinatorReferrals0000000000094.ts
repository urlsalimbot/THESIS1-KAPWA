import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Coordinator referrals expand: a control number (RFRL-yyyy-#### series via
 * `referral_control_counters`), a case category the coordinator attaches so
 * the accepted referral reaches the right assessment lane, and the data the
 * referral's GIS-style sheet prints.
 */
export class ExpandCoordinatorReferrals0000000000094 implements MigrationInterface {
  name = 'ExpandCoordinatorReferrals0000000000094';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS referral_control_counters (
      year INT PRIMARY KEY,
      last_seq INT NOT NULL
    )`);
    await queryRunner.query(`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS control_no TEXT`);
    await queryRunner.query(`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS case_category TEXT`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_referrals_control_no ON referrals(control_no)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_referrals_control_no`);
    await queryRunner.query(`ALTER TABLE referrals DROP COLUMN IF EXISTS case_category`);
    await queryRunner.query(`ALTER TABLE referrals DROP COLUMN IF EXISTS control_no`);
    await queryRunner.query(`DROP TABLE IF EXISTS referral_control_counters`);
  }
}