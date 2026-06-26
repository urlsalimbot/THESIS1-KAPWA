import { MigrationInterface, QueryRunner } from 'typeorm';

export class CaseFsmLifecycle2026062200001 implements MigrationInterface {
  name = 'CaseFsmLifecycle2026062200001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);
    await queryRunner.query(`ALTER TABLE case_history ADD COLUMN IF NOT EXISTS transition_type VARCHAR DEFAULT 'standard'`);
    await queryRunner.query(`ALTER TABLE case_history ADD COLUMN IF NOT EXISTS override_reason VARCHAR`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE case_history DROP COLUMN IF EXISTS override_reason`);
    await queryRunner.query(`ALTER TABLE case_history DROP COLUMN IF EXISTS transition_type`);
  }
}
