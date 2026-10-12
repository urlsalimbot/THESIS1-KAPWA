import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * IAR is letters-only: the endorsement letter is the module's whole surface,
 * so the referral-lifecycle columns (status workflow, consent link, legal
 * basis, outcome, lifecycle timestamps) are removed. The row the letter is
 * made of keeps case/person/agencies/reason/notes/created_by.
 */
export class SimplifyInterAgencyReferrals0000000000092 implements MigrationInterface {
  name = 'SimplifyInterAgencyReferrals0000000000092';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE inter_agency_referrals DROP COLUMN IF EXISTS status`);
    await queryRunner.query(`ALTER TABLE inter_agency_referrals DROP COLUMN IF EXISTS legal_basis_code`);
    // Column drop removes the FK to consent_ledger with it.
    await queryRunner.query(`ALTER TABLE inter_agency_referrals DROP COLUMN IF EXISTS consent_ledger_id`);
    await queryRunner.query(`ALTER TABLE inter_agency_referrals DROP COLUMN IF EXISTS outcome`);
    await queryRunner.query(`ALTER TABLE inter_agency_referrals DROP COLUMN IF EXISTS received_at`);
    await queryRunner.query(`ALTER TABLE inter_agency_referrals DROP COLUMN IF EXISTS actioned_at`);
    await queryRunner.query(`ALTER TABLE inter_agency_referrals DROP COLUMN IF EXISTS closed_at`);
    await queryRunner.query(`ALTER TABLE inter_agency_referrals DROP COLUMN IF EXISTS declined_reason`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_iar_status`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_iar_status ON inter_agency_referrals(status)`);
    await queryRunner.query(`ALTER TABLE inter_agency_referrals ADD COLUMN IF NOT EXISTS declined_reason TEXT`);
    await queryRunner.query(`ALTER TABLE inter_agency_referrals ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE inter_agency_referrals ADD COLUMN IF NOT EXISTS actioned_at TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE inter_agency_referrals ADD COLUMN IF NOT EXISTS received_at TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE inter_agency_referrals ADD COLUMN IF NOT EXISTS outcome TEXT`);
    await queryRunner.query(`ALTER TABLE inter_agency_referrals ADD COLUMN IF NOT EXISTS consent_ledger_id UUID REFERENCES consent_ledger(id)`);
    await queryRunner.query(`ALTER TABLE inter_agency_referrals ADD COLUMN IF NOT EXISTS legal_basis_code TEXT NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE inter_agency_referrals ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'referred' CHECK (status IN ('referred','received','actioned','closed','declined'))`);
  }
}