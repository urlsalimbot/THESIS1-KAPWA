import { MigrationInterface, QueryRunner } from 'typeorm';

/** Wrong-guess counter for the pending email OTP (burned at 5). */
export class AddEmailOtpAttempts0000000000090 implements MigrationInterface {
  name = 'AddEmailOtpAttempts0000000000090';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE users ADD COLUMN email_otp_attempts INTEGER NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN email_otp_attempts`);
  }
}
