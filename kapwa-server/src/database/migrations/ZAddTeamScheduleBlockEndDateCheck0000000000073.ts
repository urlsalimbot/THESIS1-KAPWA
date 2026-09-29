import { MigrationInterface, QueryRunner } from 'typeorm';

// Team workspace amendment (multi-day blocks): DB-level backstop that a set
// end_date stays on or after block_date. The service already validates this
// on create and on every PATCH side of the range, but a raw-API PATCH that
// moves block_date later without sending endDate would otherwise persist
// end_date < block_date; the CHECK closes that gap (and any future writer).
// PostgreSQL has no `ADD CONSTRAINT IF NOT EXISTS` — the DO block guards on
// pg_constraint by constraint name, so re-runs are a no-op.
export class ZAddTeamScheduleBlockEndDateCheck0000000000073 implements MigrationInterface {
  name = 'ZAddTeamScheduleBlockEndDateCheck0000000000073';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_team_schedule_blocks_end_date') THEN
          ALTER TABLE team_schedule_blocks ADD CONSTRAINT chk_team_schedule_blocks_end_date CHECK (end_date IS NULL OR end_date >= block_date);
        END IF;
      END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE team_schedule_blocks DROP CONSTRAINT IF EXISTS chk_team_schedule_blocks_end_date`,
    );
  }
}