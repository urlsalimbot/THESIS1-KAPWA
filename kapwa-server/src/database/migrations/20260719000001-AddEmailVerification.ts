import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailVerification20260719000001 implements MigrationInterface {
  name = 'AddEmailVerification20260719000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT TRUE`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS new_email TEXT`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS new_email_token TEXT`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS new_email_token_expires_at TIMESTAMP`);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_users_new_email_token ON users(new_email_token)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_new_email_token`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_reset_token`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_verification_token`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS new_email_token_expires_at`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS new_email_token`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS new_email`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS reset_token_expires_at`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS reset_token`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS verification_token_expires_at`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS verification_token`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS email_verified`);
  }
}
