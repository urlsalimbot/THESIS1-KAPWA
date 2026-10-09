import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Client dedup eligibility (intervention-aware serving rules, 2026-10-09):
 *
 *   client_import_operations.intervention_type — the intervention this list
 *     serves (a case code or a custom label); required for new operations.
 *   client_import_rows.eligibility_*           — per-row serving outcome:
 *     eligibility = 'allowed' | 'disqualified'; disqualified rows carry a
 *     reason and are gated on eligibility_decision ('waive' | 'confirm') by
 *     an operator before finalize can run.
 *   case_interventions.case_id DROP NOT NULL + beneficiary_id + source —
 *     batch servings are recorded as case_interventions too (source='batch',
 *     beneficiary_id set, case_id NULL) so the eligibility window reads one
 *     table for both "via batch" and "via case" history.
 */
export class ZAddClientDedupEligibility0000000000087 implements MigrationInterface {
  name = 'ZAddClientDedupEligibility0000000000087';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE client_import_operations ADD COLUMN IF NOT EXISTS intervention_type TEXT NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE client_import_rows ADD COLUMN IF NOT EXISTS eligibility TEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE client_import_rows ADD COLUMN IF NOT EXISTS eligibility_reason TEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE client_import_rows ADD COLUMN IF NOT EXISTS eligibility_decision TEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE client_import_rows ADD COLUMN IF NOT EXISTS eligibility_decided_by UUID`,
    );
    await queryRunner.query(
      `ALTER TABLE client_import_rows ADD COLUMN IF NOT EXISTS eligibility_decided_at TIMESTAMPTZ`,
    );
    await queryRunner.query(
      `ALTER TABLE case_interventions ALTER COLUMN case_id DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE case_interventions ADD COLUMN IF NOT EXISTS beneficiary_id UUID`,
    );
    await queryRunner.query(
      `ALTER TABLE case_interventions ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'case'`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_case_interventions_beneficiary ON case_interventions (beneficiary_id)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_case_interventions_beneficiary`);
    await queryRunner.query(`ALTER TABLE case_interventions DROP COLUMN IF EXISTS source`);
    await queryRunner.query(`ALTER TABLE case_interventions DROP COLUMN IF EXISTS beneficiary_id`);
    await queryRunner.query(`ALTER TABLE case_interventions ALTER COLUMN case_id SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE client_import_rows DROP COLUMN IF EXISTS eligibility_decided_at`);
    await queryRunner.query(`ALTER TABLE client_import_rows DROP COLUMN IF EXISTS eligibility_decided_by`);
    await queryRunner.query(`ALTER TABLE client_import_rows DROP COLUMN IF EXISTS eligibility_decision`);
    await queryRunner.query(`ALTER TABLE client_import_rows DROP COLUMN IF EXISTS eligibility_reason`);
    await queryRunner.query(`ALTER TABLE client_import_rows DROP COLUMN IF EXISTS eligibility`);
    await queryRunner.query(`ALTER TABLE client_import_operations DROP COLUMN IF EXISTS intervention_type`);
  }
}