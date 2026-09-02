import { MigrationInterface, QueryRunner } from 'typeorm';

// Wave 1: additive groundwork only. The actual column drops on `beneficiaries`
// (access_card_code, consent_status, category) are intentionally deferred to
// Wave 2 because services still read them. This migration verifies the columns
// exist and stays a no-op so the normalization intent is recorded in history.
export class DedupBeneficiaryColumns0000000000044 implements MigrationInterface {
  name = 'DedupBeneficiaryColumns0000000000044';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure beneficiary_roles is the authoritative owner; add a defensive index.
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_beneficiary_roles_person ON beneficiary_roles(person_id)`);
    // NO COLUMN DROPS in Wave 1.
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // Nothing to reverse in Wave 1.
  }
}
