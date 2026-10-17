import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Client-dedup finalize becomes a background job.
 *
 * Finalizing a whole-municipal-list import takes minutes (measured: ~30 ms per
 * record, 9.2 s for 275). Keeping that on the HTTP request meant a request held
 * open for as long as the batch took, and any proxy or operator timeout lost
 * the response while the work carried on.
 *
 * `status = 'finalizing'` is the queue. `finalize_started_at` is the lease: the
 * worker claims a queued operation with `FOR UPDATE SKIP LOCKED` and stamps it,
 * so several API instances cannot run the same batch and a worker that dies
 * mid-job is picked up again after the stale window. `finalize_error` and
 * `finalize_summary` carry the outcome back to the review screen.
 */
export class DedupFinalizeWorker0000000000102 implements MigrationInterface {
  name = 'DedupFinalizeWorker0000000000102';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE IF EXISTS client_import_operations ADD COLUMN IF NOT EXISTS finalize_started_at TIMESTAMPTZ`);
    await queryRunner.query(`ALTER TABLE IF EXISTS client_import_operations ADD COLUMN IF NOT EXISTS finalize_error TEXT`);
    await queryRunner.query(`ALTER TABLE IF EXISTS client_import_operations ADD COLUMN IF NOT EXISTS finalize_summary JSONB`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE IF EXISTS client_import_operations DROP COLUMN IF EXISTS finalize_summary`);
    await queryRunner.query(`ALTER TABLE IF EXISTS client_import_operations DROP COLUMN IF EXISTS finalize_error`);
    await queryRunner.query(`ALTER TABLE IF EXISTS client_import_operations DROP COLUMN IF EXISTS finalize_started_at`);
  }
}
