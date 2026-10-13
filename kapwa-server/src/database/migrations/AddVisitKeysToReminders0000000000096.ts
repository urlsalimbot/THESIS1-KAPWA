import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reminder claims for transition-plan follow-up visits: `event_id` cannot hold
 * a visit reference — it FKs to `case_events`. Visits also get regenerated on
 * every plan save, so their row ids are useless as a dedupe key; `visit_key`
 * stores the stable `<caseId>|<visitDate>|<visitType>` instead. One of the two
 * columns is set per claim.
 */
export class AddVisitKeysToReminders0000000000096 implements MigrationInterface {
  name = 'AddVisitKeysToReminders0000000000096';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE case_event_reminders ADD COLUMN IF NOT EXISTS visit_key text`);
    await queryRunner.query(`ALTER TABLE case_event_reminders ALTER COLUMN event_id DROP NOT NULL`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_case_event_reminders_visit`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_case_event_reminders_visit ON case_event_reminders(visit_key, offset_minutes, channel)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_case_event_reminders_visit`);
    await queryRunner.query(`DELETE FROM case_event_reminders WHERE event_id IS NULL`);
    await queryRunner.query(`ALTER TABLE case_event_reminders ALTER COLUMN event_id SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE case_event_reminders DROP COLUMN IF EXISTS visit_key`);
  }
}
