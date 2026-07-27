import { MigrationInterface, QueryRunner } from 'typeorm';

export class ZAddFamilyIncomeStatus2026071500001 implements MigrationInterface {
  name = 'ZAddFamilyIncomeStatus2026071500001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE family_members ADD COLUMN IF NOT EXISTS income DECIMAL(12,2)`);
    await queryRunner.query(`ALTER TABLE family_members ADD COLUMN IF NOT EXISTS status TEXT`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE family_members DROP COLUMN IF EXISTS income`);
    await queryRunner.query(`ALTER TABLE family_members DROP COLUMN IF EXISTS status`);
  }
}
