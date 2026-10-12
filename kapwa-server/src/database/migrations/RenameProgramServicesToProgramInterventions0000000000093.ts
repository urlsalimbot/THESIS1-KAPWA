import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The Program → Interventions matrix, renamed from program_services (the rows
 * are intervention types, not services), plus the per-intervention form-format
 * requirement column: when set, the intervention obliges the worker to
 * accomplish that specific form format (e.g. `scsr_generated` → the Social
 * Case Study Report form).
 */
export class RenameProgramServicesToProgramInterventions0000000000093 implements MigrationInterface {
  name = 'RenameProgramServicesToProgramInterventions0000000000093';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasOld = await queryRunner.query(
      `SELECT to_regclass('public.program_services') AS t`,
    );
    const hasNew = await queryRunner.query(
      `SELECT to_regclass('public.program_interventions') AS t`,
    );
    if (hasOld[0]?.t && !hasNew[0]?.t) {
      await queryRunner.query(`ALTER TABLE program_services RENAME TO program_interventions`);
      await queryRunner.query(`DROP INDEX IF EXISTS idx_program_services_program`);
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_program_interventions_program ON program_interventions(program_id)`,
      );
      await queryRunner.query(
        `ALTER TABLE program_interventions RENAME CONSTRAINT uq_program_services_program_type TO uq_program_interventions_program_type`,
      );
    }
    await queryRunner.query(`ALTER TABLE program_interventions ADD COLUMN IF NOT EXISTS required_form TEXT`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE program_interventions DROP COLUMN IF EXISTS required_form`);
    const hasNew = await queryRunner.query(
      `SELECT to_regclass('public.program_interventions') AS t`,
    );
    const hasOld = await queryRunner.query(
      `SELECT to_regclass('public.program_services') AS t`,
    );
    if (hasNew[0]?.t && !hasOld[0]?.t) {
      await queryRunner.query(
        `ALTER TABLE program_interventions RENAME CONSTRAINT uq_program_interventions_program_type TO uq_program_services_program_type`,
      );
      await queryRunner.query(`DROP INDEX IF EXISTS idx_program_interventions_program`);
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_program_services_program ON program_services(program_id)`,
      );
      await queryRunner.query(`ALTER TABLE program_interventions RENAME TO program_services`);
    }
  }
}