import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNhtsPrIdToHouseholds0000000000058 implements MigrationInterface {
  name = 'AddNhtsPrIdToHouseholds0000000000058';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE households ADD COLUMN IF NOT EXISTS nhts_pr_id TEXT`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_household_nhts
        ON households(nhts_pr_id) WHERE nhts_pr_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_household_nhts`);
    await queryRunner.query(`ALTER TABLE households DROP COLUMN IF EXISTS nhts_pr_id`);
  }
}
