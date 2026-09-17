import { MigrationInterface, QueryRunner } from 'typeorm';

// Service Delivery (stepper step 3) is considered accomplished when an
// inter-agency referral is issued OR the social worker records that a referral
// is not needed. This column persists that decision on the case row.
export class ReferralNotNeededOnCases0000000000059 implements MigrationInterface {
  name = 'ReferralNotNeededOnCases0000000000059';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS referral_not_needed BOOLEAN NOT NULL DEFAULT FALSE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS referral_not_needed`);
  }
}