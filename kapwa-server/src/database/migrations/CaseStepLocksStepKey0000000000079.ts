import { MigrationInterface, QueryRunner } from 'typeorm';

// step_index -> step_key: step locks are identified by stable string keys
// (`assessment, interventions, referrals, evaluate, closure` for the common
// template) so category steps can interleave between them (spec §3). The
// (case_id, step_index) unique is rebuilt as (case_id, step_key); the backfill
// is 1:1 because the old unique already guarantees one row per index value.
// Mirrored by idempotent statements in src/database/migrate.ts.
export class CaseStepLocksStepKey0000000000079 implements MigrationInterface {
  name = 'CaseStepLocksStepKey0000000000079';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE case_step_locks ADD COLUMN IF NOT EXISTS step_key TEXT`,
    );
    await queryRunner.query(`
      UPDATE case_step_locks SET step_key = CASE step_index
        WHEN 0 THEN 'assessment'
        WHEN 1 THEN 'interventions'
        WHEN 2 THEN 'referrals'
        WHEN 3 THEN 'evaluate'
        WHEN 4 THEN 'closure'
      END
      WHERE step_key IS NULL
    `);
    await queryRunner.query(
      `ALTER TABLE case_step_locks ALTER COLUMN step_key SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE case_step_locks DROP CONSTRAINT IF EXISTS uq_case_step_locks_case_step`);
    await queryRunner.query(
      `ALTER TABLE case_step_locks ADD CONSTRAINT uq_case_step_locks_case_step_key UNIQUE (case_id, step_key)`,
    );
    await queryRunner.query(`ALTER TABLE case_step_locks DROP COLUMN IF EXISTS step_index`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE case_step_locks ADD COLUMN IF NOT EXISTS step_index SMALLINT`,
    );
    await queryRunner.query(`
      UPDATE case_step_locks SET step_index = CASE step_key
        WHEN 'assessment' THEN 0
        WHEN 'interventions' THEN 1
        WHEN 'referrals' THEN 2
        WHEN 'evaluate' THEN 3
        WHEN 'closure' THEN 4
      END
      WHERE step_index IS NULL
    `);
    await queryRunner.query(`ALTER TABLE case_step_locks ALTER COLUMN step_index SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE case_step_locks DROP CONSTRAINT IF EXISTS uq_case_step_locks_case_step_key`);
    await queryRunner.query(
      `ALTER TABLE case_step_locks ADD CONSTRAINT uq_case_step_locks_case_step UNIQUE (case_id, step_index)`,
    );
    await queryRunner.query(`ALTER TABLE case_step_locks DROP COLUMN IF EXISTS step_key`);
  }
}