import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailNotification20260719000002 implements MigrationInterface {
  name = 'AddEmailNotification20260719000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email TEXT`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_notifications_email ON notifications(email)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_notifications_email`);
    await queryRunner.query(`ALTER TABLE notifications DROP COLUMN IF EXISTS email`);
  }
}
