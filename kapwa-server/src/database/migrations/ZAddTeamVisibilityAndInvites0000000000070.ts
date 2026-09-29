import { MigrationInterface, QueryRunner } from 'typeorm';

// Team workspace amendment (owner-strict): per-entry visibility toggles on
// schedule blocks and whereabouts statuses, plus the schedule-invites table.
// Blocks/statuses default to team-visible (`team`); staff may toggle a row to
// `team_coordinators` so barangay coordinators see it. Accepting an invite
// materializes the suggested block as the invitee's own.
export class ZAddTeamVisibilityAndInvites0000000000070 implements MigrationInterface {
  name = 'ZAddTeamVisibilityAndInvites0000000000070';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE team_schedule_blocks ADD COLUMN IF NOT EXISTS visible_to varchar(32) NOT NULL DEFAULT 'team'`,
    );
    await queryRunner.query(
      `ALTER TABLE team_status ADD COLUMN IF NOT EXISTS visible_to varchar(32) NOT NULL DEFAULT 'team'`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS team_invites (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        from_user_id uuid NOT NULL REFERENCES users(id),
        to_user_id uuid NOT NULL REFERENCES users(id),
        invite_date date NOT NULL,
        block_type varchar(32) NOT NULL,
        note text NULL,
        status varchar(16) NOT NULL DEFAULT 'pending',
        created_at timestamptz NOT NULL DEFAULT now(),
        responded_at timestamptz NULL
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_team_invites_to_status ON team_invites (to_user_id, status)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_team_invites_to_status`);
    await queryRunner.query(`DROP TABLE IF EXISTS team_invites`);
    await queryRunner.query(`ALTER TABLE team_status DROP COLUMN IF EXISTS visible_to`);
    await queryRunner.query(`ALTER TABLE team_schedule_blocks DROP COLUMN IF EXISTS visible_to`);
  }
}