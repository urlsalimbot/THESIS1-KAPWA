import { MigrationInterface, QueryRunner } from 'typeorm';

// The case view shows "Approved by {name — role}". The role was already stored
// (`approved_by_role`) but not the actor's name, so the field could only ever
// render a bare role slug. Record the approver's display name on the case when a
// transition is performed.
export class CaseApprovedByName0000000000065 implements MigrationInterface {
  name = 'CaseApprovedByName0000000000065';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS approved_by_name TEXT`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS approved_by_name`);
  }
}
