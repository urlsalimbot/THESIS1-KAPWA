import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCaseCategory0000000000076 implements MigrationInterface {
  name = 'AddCaseCategory0000000000076';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // The MSWDO case category recorded during step 1 (Assess & Interview) and
    // shown in the Case Category column of the cases, dashboard and tracker
    // tables.
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS case_category TEXT`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS case_category`);
  }
}