import { MigrationInterface, QueryRunner } from 'typeorm';

// Per-case program enrollment: the case plan step that records which MSWDO
// program(s) a case is enrolled in (treatment plan per DSWD AO 10 s. 2007),
// positioned right after assessment in the common step template.
// Mirrored by an idempotent CREATE TABLE in src/database/migrate.ts.
export class AddProgramEnrollments0000000000077 implements MigrationInterface {
  name = 'AddProgramEnrollments0000000000077';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS program_enrollments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        case_id UUID NOT NULL REFERENCES cases(id),
        program_id UUID NOT NULL REFERENCES programs(id),
        enrolled_at DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT uq_program_enrollments_case_program UNIQUE (case_id, program_id)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_program_enrollments_case ON program_enrollments(case_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS program_enrollments`);
  }
}