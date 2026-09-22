import { MigrationInterface, QueryRunner } from 'typeorm';

export class ZAddUserMfaMethod0000000000061 implements MigrationInterface {
  name = 'ZAddUserMfaMethod0000000000061';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS mfa_method VARCHAR`);
    await queryRunner.query(`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS email_otp_code VARCHAR`);
    await queryRunner.query(`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS email_otp_expires_at TIMESTAMP`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE IF EXISTS users DROP COLUMN IF EXISTS email_otp_expires_at`);
    await queryRunner.query(`ALTER TABLE IF EXISTS users DROP COLUMN IF EXISTS email_otp_code`);
    await queryRunner.query(`ALTER TABLE IF EXISTS users DROP COLUMN IF EXISTS mfa_method`);
  }
}
