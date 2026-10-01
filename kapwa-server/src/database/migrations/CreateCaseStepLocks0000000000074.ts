import { MigrationInterface, QueryRunner } from 'typeorm';

// One row per (case, step) marking a done step the worker has deliberately
// sealed. Reversible by design — unlocking deletes the row.
//
// `case_id` is TEXT, not UUID: migrate.ts declares case_interventions.case_id
// (and the case-scoped children) as TEXT, and a uuid column cannot be written
// against a text one.
export class CreateCaseStepLocks0000000000074 implements MigrationInterface {
  name = 'CreateCaseStepLocks0000000000074';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS case_step_locks (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
      case_id TEXT NOT NULL,
      step_index SMALLINT NOT NULL,
      locked_by UUID,
      locked_by_name TEXT,
      locked_at TIMESTAMP DEFAULT NOW(),
      CONSTRAINT uq_case_step_locks_case_step UNIQUE (case_id, step_index)
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_case_step_locks_case ON case_step_locks(case_id)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS idx_case_step_locks_case`);
    await q.query(`DROP TABLE IF EXISTS case_step_locks`);
  }
}