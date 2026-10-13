import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Case-linked team-calendar blocks get their own `case_id` (FK to cases):
 * follow-up visit mirrors key off the case because their `case_follow_up_visits`
 * rows are regenerated on every plan save. `source_ref` cannot carry it — its FK
 * targets `case_events`, so a case id there violates the constraint.
 */
export class AddTeamScheduleCaseId0000000000095 implements MigrationInterface {
  name = 'AddTeamScheduleCaseId0000000000095';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE team_schedule_blocks ADD COLUMN IF NOT EXISTS case_id uuid`);
    await queryRunner.query(`ALTER TABLE team_schedule_blocks DROP CONSTRAINT IF EXISTS fk_blocks_case_id`);
    await queryRunner.query(`ALTER TABLE team_schedule_blocks ADD CONSTRAINT fk_blocks_case_id FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_blocks_case_id ON team_schedule_blocks(case_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_blocks_case_id`);
    await queryRunner.query(`ALTER TABLE team_schedule_blocks DROP CONSTRAINT IF EXISTS fk_blocks_case_id`);
    await queryRunner.query(`ALTER TABLE team_schedule_blocks DROP COLUMN IF EXISTS case_id`);
  }
}
