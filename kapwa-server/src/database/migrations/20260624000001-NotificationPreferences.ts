import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationPreferences20260624000001 implements MigrationInterface {
  name = 'NotificationPreferences20260624000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE notification_preferences (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id varchar NOT NULL,
        channel varchar NOT NULL,
        category varchar NOT NULL,
        opted_in boolean DEFAULT false,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_notif_prefs_user_channel_category
      ON notification_preferences (user_id, channel, category)
    `);

    await queryRunner.query(`
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS consent_skipped boolean DEFAULT false
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE notifications DROP COLUMN IF EXISTS consent_skipped`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_notif_prefs_user_channel_category`);
    await queryRunner.query(`DROP TABLE IF EXISTS notification_preferences`);
  }
}
