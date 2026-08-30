import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropProgramAssignments0000000000027 implements MigrationInterface {
  name = 'DropProgramAssignments0000000000027';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS program_assignment_steps CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS program_assignments CASCADE`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS program_assignments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        case_id UUID REFERENCES cases(id),
        program_id UUID REFERENCES programs(id),
        status TEXT NOT NULL DEFAULT 'pending',
        current_step_order INTEGER NOT NULL DEFAULT 1,
        assigned_worker_id UUID,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS program_assignment_steps (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        assignment_id UUID REFERENCES program_assignments(id) ON DELETE CASCADE,
        step_order INTEGER NOT NULL,
        step_name TEXT NOT NULL,
        approver_role TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        approved_by UUID,
        approved_at TIMESTAMP,
        remarks TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_program_assignments_case_id ON program_assignments(case_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_program_assignments_program_id ON program_assignments(program_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_program_assignments_status ON program_assignments(status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_program_assignment_steps_assignment_id ON program_assignment_steps(assignment_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_program_assignment_steps_status ON program_assignment_steps(status)`);
  }
}
