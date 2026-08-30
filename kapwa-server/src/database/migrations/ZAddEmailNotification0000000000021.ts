import { MigrationInterface, QueryRunner } from 'typeorm';

export class ZAddEmailNotification0000000000021 implements MigrationInterface {
  name = 'ZAddEmailNotification0000000000021';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE IF EXISTS notifications ADD COLUMN IF NOT EXISTS email TEXT`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_notifications_email ON notifications(email)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_notifications_email`);
    await queryRunner.query(`ALTER TABLE IF EXISTS notifications DROP COLUMN IF EXISTS email`);
  }
}
