import { MigrationInterface, QueryRunner } from 'typeorm';

// Spec §Achievements counts per-staff interventions and referrals from
// `case_interventions.created_by` / `case_referrals.created_by`. Neither
// column existed (case_interventions only had client-supplied `delivered_by`
// free text that may hold names/'MSWDO' rather than user ids; case_referrals
// had no staff column at all). Add nullable `created_by` columns so the
// creation points can record the acting staff member; legacy rows stay NULL
// and count to nobody.
export class AddCaseChildCreatedBy0000000000069 implements MigrationInterface {
  name = 'AddCaseChildCreatedBy0000000000069';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE case_interventions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id)`);
    await queryRunner.query(`ALTER TABLE case_referrals ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE case_referrals DROP COLUMN IF EXISTS created_by`);
    await queryRunner.query(`ALTER TABLE case_interventions DROP COLUMN IF EXISTS created_by`);
  }
}