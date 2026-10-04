import { MigrationInterface, QueryRunner } from 'typeorm';

// Program <-> service matrix: programs get a machine key (`program_type`),
// a new child table lists the intervention types a program renders, and
// case interventions carry their typed service and the enrollment they were
// delivered under (spec §4.4). Mirrored by idempotent statements in
// src/database/migrate.ts.
export class ProgramServicesAndInterventionTypes0000000000080 implements MigrationInterface {
  name = 'ProgramServicesAndInterventionTypes0000000000080';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE programs ADD COLUMN IF NOT EXISTS program_type TEXT`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS program_services (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        program_id UUID NOT NULL REFERENCES programs(id),
        intervention_type TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT uq_program_services_program_type UNIQUE (program_id, intervention_type)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_program_services_program ON program_services(program_id)`,
    );

    await queryRunner.query(
      `ALTER TABLE case_interventions ADD COLUMN IF NOT EXISTS intervention_type TEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE case_interventions ADD COLUMN IF NOT EXISTS program_enrollment_id UUID`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE case_interventions DROP COLUMN IF EXISTS program_enrollment_id`);
    await queryRunner.query(`ALTER TABLE case_interventions DROP COLUMN IF EXISTS intervention_type`);
    await queryRunner.query(`DROP TABLE IF EXISTS program_services`);
    await queryRunner.query(`ALTER TABLE programs DROP COLUMN IF EXISTS program_type`);
  }
}