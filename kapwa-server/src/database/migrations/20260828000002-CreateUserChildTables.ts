import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserChildTables20260828000002 implements MigrationInterface {
  name = 'CreateUserChildTables20260828000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        user_id UUID NOT NULL,
        purpose VARCHAR(50) NOT NULL,
        token TEXT NOT NULL,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_tokens_user ON user_tokens(user_id)`);

    // Backfill existing token columns (only non-null rows).
    await queryRunner.query(`
      INSERT INTO user_tokens (user_id, purpose, token, expires_at)
      SELECT id, 'email_verification', verification_token, verification_token_expires_at
      FROM users WHERE verification_token IS NOT NULL
    `);
    await queryRunner.query(`
      INSERT INTO user_tokens (user_id, purpose, token, expires_at)
      SELECT id, 'password_reset', reset_token, reset_token_expires_at
      FROM users WHERE reset_token IS NOT NULL
    `);
    await queryRunner.query(`
      INSERT INTO user_tokens (user_id, purpose, token, expires_at)
      SELECT id, 'change_email', new_email_token, new_email_token_expires_at
      FROM users WHERE new_email_token IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_barangay_assignments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        user_id UUID NOT NULL,
        barangay VARCHAR(255) NOT NULL,
        is_primary BOOLEAN,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_barangay_user ON user_barangay_assignments(user_id)`);

    // Backfill primary assigned barangay.
    await queryRunner.query(`
      INSERT INTO user_barangay_assignments (user_id, barangay, is_primary)
      SELECT id, assigned_barangay, true FROM users WHERE assigned_barangay IS NOT NULL AND assigned_barangay <> ''
    `);
    // Backfill the permitted_barangays array via unnest.
    await queryRunner.query(`
      INSERT INTO user_barangay_assignments (user_id, barangay, is_primary)
      SELECT u.id, b.barangay, false
      FROM users u, unnest(u.permitted_barangays) AS b(barangay)
      WHERE array_length(u.permitted_barangays, 1) > 0
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_barangay_assignments`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_tokens`);
  }
}