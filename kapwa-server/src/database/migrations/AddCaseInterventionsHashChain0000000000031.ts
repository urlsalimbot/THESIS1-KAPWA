import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCaseInterventionsHashChain0000000000031 implements MigrationInterface {
  name = 'AddCaseInterventionsHashChain0000000000031';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE IF EXISTS case_interventions ADD COLUMN IF NOT EXISTS hash TEXT`);
    await queryRunner.query(`ALTER TABLE IF EXISTS case_interventions ADD COLUMN IF NOT EXISTS prev_hash TEXT`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE IF EXISTS case_interventions DROP COLUMN IF EXISTS hash`);
    await queryRunner.query(`ALTER TABLE IF EXISTS case_interventions DROP COLUMN IF EXISTS prev_hash`);
  }
}
