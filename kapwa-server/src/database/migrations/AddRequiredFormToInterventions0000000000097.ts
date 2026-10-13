import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The required-form obligation rides the intervention row: when a typed
 * service is logged, the program matrix's `required_form` is copied onto
 * `case_interventions.required_form` so the obligation survives matrix edits
 * and renders on the saved card (audit 3.2.4 — the hint used to exist only
 * inside the Add dialog and was never persisted or enforced).
 */
export class AddRequiredFormToInterventions0000000000097 implements MigrationInterface {
  name = 'AddRequiredFormToInterventions0000000000097';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE case_interventions ADD COLUMN IF NOT EXISTS required_form text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE case_interventions DROP COLUMN IF EXISTS required_form`);
  }
}