import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConsentRevokedReason20260718000001 implements MigrationInterface {
  name = 'AddConsentRevokedReason20260718000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE consent_ledger ADD COLUMN IF NOT EXISTS revoked_reason TEXT`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE consent_ledger DROP COLUMN IF EXISTS revoked_reason`,
    );
  }
}
