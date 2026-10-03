import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHouseholdMembershipStatusReason0000000000075 implements MigrationInterface {
  name = 'AddHouseholdMembershipStatusReason0000000000075';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Why a household member was marked inactive (moved out, deceased, …).
    // Inactive members are kept for history but drop out of the household count
    // and the intake match roster.
    await queryRunner.query(`ALTER TABLE household_memberships ADD COLUMN IF NOT EXISTS status_reason TEXT`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE household_memberships DROP COLUMN IF EXISTS status_reason`);
  }
}
