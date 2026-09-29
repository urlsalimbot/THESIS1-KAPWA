import { MigrationInterface, QueryRunner } from 'typeorm';

// Team workspace amendment fix (invite race): partial unique index so only
// ONE pending invite can exist per (from, to, date). Concurrent duplicate
// pending POSTs can no longer create twin rows — the second insert hits the
// unique constraint (the service-level dedupe catches the common case first;
// this index is the hard guarantee under a race). Accepted/declined invites
// stay out of the index (status <> 'pending'), so the same suggestor may
// invite the same person again on a later date or after a response.
export class ZAddTeamInvitePendingUnique0000000000071 implements MigrationInterface {
  name = 'ZAddTeamInvitePendingUnique0000000000071';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_team_invites_pending ON team_invites (from_user_id, to_user_id, invite_date) WHERE status = 'pending'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_team_invites_pending`);
  }
}