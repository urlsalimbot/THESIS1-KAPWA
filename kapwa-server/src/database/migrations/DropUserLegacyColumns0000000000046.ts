import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropUserLegacyColumns0000000000046 implements MigrationInterface {
  name = 'DropUserLegacyColumns0000000000046';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE user_tokens
        ADD CONSTRAINT fk_user_tokens_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
        NOT VALID;
      DELETE FROM user_tokens ut WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ut.user_id);
      ALTER TABLE user_tokens VALIDATE CONSTRAINT fk_user_tokens_user;

      ALTER TABLE user_barangay_assignments
        ADD CONSTRAINT fk_user_barangay_assignments_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
        NOT VALID;
      DELETE FROM user_barangay_assignments uba WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = uba.user_id);
      ALTER TABLE user_barangay_assignments VALIDATE CONSTRAINT fk_user_barangay_assignments_user;

      ALTER TABLE user_tokens ADD COLUMN IF NOT EXISTS meta JSONB;
    `);

    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS assigned_barangay`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS permitted_barangays`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS verification_token`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS verification_token_expires_at`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS reset_token`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS reset_token_expires_at`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS new_email`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS new_email_token`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS new_email_token_expires_at`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_barangay TEXT`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS permitted_barangays TEXT[] DEFAULT '{}'`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS new_email TEXT`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS new_email_token TEXT`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS new_email_token_expires_at TIMESTAMP`);

    await queryRunner.query(`ALTER TABLE user_barangay_assignments DROP CONSTRAINT IF EXISTS fk_user_barangay_assignments_user`);
    await queryRunner.query(`ALTER TABLE user_tokens DROP CONSTRAINT IF EXISTS fk_user_tokens_user`);
  }
}
