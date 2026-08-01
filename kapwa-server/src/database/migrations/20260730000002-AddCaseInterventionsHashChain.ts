import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCaseInterventionsHashChain2026073000002 implements MigrationInterface {
  name = 'AddCaseInterventionsHashChain2026073000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE case_interventions ADD COLUMN IF NOT EXISTS hash TEXT`);
    await queryRunner.query(`ALTER TABLE case_interventions ADD COLUMN IF NOT EXISTS prev_hash TEXT`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE case_interventions DROP COLUMN IF EXISTS hash`);
    await queryRunner.query(`ALTER TABLE case_interventions DROP COLUMN IF EXISTS prev_hash`);
  }
}
