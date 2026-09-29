import { MigrationInterface, QueryRunner } from 'typeorm';

// Team workspace amendment (multi-day blocks): an optional inclusive end date
// on team_schedule_blocks. NULL/absent keeps the block single-day — the
// treated range is [block_date, COALESCE(end_date, block_date)], which the
// list overlap predicate mirrors (same COALESCE semantics).
export class ZAddTeamScheduleBlockEndDate0000000000072 implements MigrationInterface {
  name = 'ZAddTeamScheduleBlockEndDate0000000000072';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE team_schedule_blocks ADD COLUMN IF NOT EXISTS end_date date NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE team_schedule_blocks DROP COLUMN IF EXISTS end_date`);
  }
}