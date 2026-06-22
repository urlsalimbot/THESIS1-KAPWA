import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProgramAssignments20260622000006 implements MigrationInterface {
  name = 'ProgramAssignments20260622000006';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create program_assignments table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS program_assignments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        case_id UUID NOT NULL,
        program_id UUID NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'pending',
        current_step_order INTEGER NOT NULL DEFAULT 0,
        assigned_worker_id VARCHAR,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 2. Create program_assignment_steps table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS program_assignment_steps (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        assignment_id UUID NOT NULL,
        step_order INTEGER NOT NULL,
        step_name VARCHAR NOT NULL,
        approver_role VARCHAR NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'pending',
        approved_by VARCHAR,
        approved_at TIMESTAMP,
        remarks TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 3. Add foreign keys
    await queryRunner.query(`
      ALTER TABLE program_assignments
        ADD CONSTRAINT fk_program_assignments_case
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE program_assignments
        ADD CONSTRAINT fk_program_assignments_program
        FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE program_assignment_steps
        ADD CONSTRAINT fk_program_assignment_steps_assignment
        FOREIGN KEY (assignment_id) REFERENCES program_assignments(id) ON DELETE CASCADE
    `);

    // 4. Add indexes for query performance
    await queryRunner.query(`CREATE INDEX idx_program_assignments_case_id ON program_assignments(case_id)`);
    await queryRunner.query(`CREATE INDEX idx_program_assignments_program_id ON program_assignments(program_id)`);
    await queryRunner.query(`CREATE INDEX idx_program_assignments_status ON program_assignments(status)`);
    await queryRunner.query(`CREATE INDEX idx_program_assignment_steps_assignment_id ON program_assignment_steps(assignment_id)`);
    await queryRunner.query(`CREATE INDEX idx_program_assignment_steps_status ON program_assignment_steps(status)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_program_assignment_steps_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_program_assignment_steps_assignment_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_program_assignments_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_program_assignments_program_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_program_assignments_case_id`);
    await queryRunner.query(`ALTER TABLE program_assignment_steps DROP CONSTRAINT IF EXISTS fk_program_assignment_steps_assignment`);
    await queryRunner.query(`ALTER TABLE program_assignments DROP CONSTRAINT IF EXISTS fk_program_assignments_program`);
    await queryRunner.query(`ALTER TABLE program_assignments DROP CONSTRAINT IF EXISTS fk_program_assignments_case`);
    await queryRunner.query(`DROP TABLE IF EXISTS program_assignment_steps`);
    await queryRunner.query(`DROP TABLE IF EXISTS program_assignments`);
  }
}
