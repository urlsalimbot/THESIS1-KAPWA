import { MigrationInterface, QueryRunner } from 'typeorm';

export class BarangayCoordinatorModule2026072900001 implements MigrationInterface {
  name = 'BarangayCoordinatorModule2026072900001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS referrals (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
      coordinator_id UUID NOT NULL REFERENCES users(id),
      barangay TEXT NOT NULL,
      surname TEXT NOT NULL,
      first_name TEXT NOT NULL,
      middle_name TEXT,
      extension TEXT,
      gender TEXT NOT NULL,
      dob DATE NOT NULL,
      address JSONB,
      phone TEXT,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
      decline_reason TEXT,
      case_id UUID REFERENCES cases(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_referral_coordinator ON referrals(coordinator_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_referral_status ON referrals(status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_referral_barangay ON referrals(barangay)`);

    await queryRunner.query(`ALTER TABLE access_card_services ADD COLUMN IF NOT EXISTS logged_by UUID REFERENCES users(id)`);
    await queryRunner.query(`ALTER TABLE access_card_services ADD COLUMN IF NOT EXISTS source_barangay TEXT`);

    await queryRunner.query(`ALTER TABLE irf_cases ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES cases(id)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_referral_barangay`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_referral_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_referral_coordinator`);
    await queryRunner.query(`DROP TABLE IF EXISTS referrals`);

    await queryRunner.query(`ALTER TABLE access_card_services DROP COLUMN IF EXISTS source_barangay`);
    await queryRunner.query(`ALTER TABLE access_card_services DROP COLUMN IF EXISTS logged_by`);

    await queryRunner.query(`ALTER TABLE irf_cases DROP COLUMN IF EXISTS case_id`);
  }
}
