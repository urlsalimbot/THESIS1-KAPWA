import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Program-matrix display order + enrollment-reference integrity (audit 3.2.13,
 * 3.2.7).
 *
 * - `program_interventions.sort_order` freezes the office's row order: the
 *   matrix rendered in whatever order the rows came back, and the admin editor
 *   had no way to arrange it. Existing rows are backfilled from their
 *   `created_at` order, which is the order they were seeded or added in.
 * - `case_interventions.program_enrollment_id` was a bare UUID with no
 *   constraint, so deleting an enrollment left interventions pointing at a row
 *   that no longer existed. Dangling values are cleared first, then the FK
 *   takes over (ON DELETE SET NULL: the intervention stays, its anchor goes).
 */
export class ProgramMatrixOrderAndEnrollmentFk0000000000098 implements MigrationInterface {
  name = 'ProgramMatrixOrderAndEnrollmentFk0000000000098';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE program_interventions ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0`);
    await queryRunner.query(`
      UPDATE program_interventions pi
         SET sort_order = ordered.rn
        FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY program_id ORDER BY created_at, intervention_type) - 1 AS rn
            FROM program_interventions
        ) AS ordered
       WHERE pi.id = ordered.id AND pi.sort_order = 0
    `);
    await queryRunner.query(`
      UPDATE case_interventions ci
         SET program_enrollment_id = NULL
       WHERE ci.program_enrollment_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM program_enrollments pe WHERE pe.id = ci.program_enrollment_id)
    `);
    await queryRunner.query(`ALTER TABLE case_interventions DROP CONSTRAINT IF EXISTS fk_case_interventions_enrollment`);
    await queryRunner.query(`
      ALTER TABLE case_interventions
        ADD CONSTRAINT fk_case_interventions_enrollment
        FOREIGN KEY (program_enrollment_id) REFERENCES program_enrollments(id) ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE case_interventions DROP CONSTRAINT IF EXISTS fk_case_interventions_enrollment`);
    await queryRunner.query(`ALTER TABLE program_interventions DROP COLUMN IF EXISTS sort_order`);
  }
}
