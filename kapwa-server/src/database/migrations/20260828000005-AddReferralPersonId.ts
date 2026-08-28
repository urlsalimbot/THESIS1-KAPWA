import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReferralPersonId20260828000005 implements MigrationInterface {
  name = 'AddReferralPersonId20260828000005';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS person_id UUID`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_referrals_person ON referrals(person_id)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE referrals DROP COLUMN IF EXISTS person_id`);
  }
}
