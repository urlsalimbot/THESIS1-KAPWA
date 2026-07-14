import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIntakeFields2026071400003 implements MigrationInterface {
  name = 'AddIntakeFields2026071400003';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS place_of_birth TEXT`);
    await queryRunner.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS civil_status TEXT`);
    await queryRunner.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS current_address JSONB`);
    await queryRunner.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS provincial_address JSONB`);
    await queryRunner.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS philhealth_number TEXT`);
    await queryRunner.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS occupation TEXT`);
    await queryRunner.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS estimated_monthly_income DECIMAL(12,2)`);
    await queryRunner.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS age INTEGER`);

    await queryRunner.query(`ALTER TABLE family_members ADD COLUMN IF NOT EXISTS occupation TEXT`);
    await queryRunner.query(`ALTER TABLE family_members DROP COLUMN IF EXISTS status_income`);

    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS problems_presented TEXT`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS social_worker_assessment TEXT`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS client_category TEXT`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS nature_of_service TEXT[]`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS financial_subsidies JSONB`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS amount_assistance DECIMAL(12,2)`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS mode_financial_assistance TEXT`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS source_of_fund TEXT`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS legislator_specify TEXT`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS other_assistance JSONB`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS interviewed_by TEXT`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS client_signature TEXT`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE beneficiaries DROP COLUMN IF EXISTS place_of_birth`);
    await queryRunner.query(`ALTER TABLE beneficiaries DROP COLUMN IF EXISTS civil_status`);
    await queryRunner.query(`ALTER TABLE beneficiaries DROP COLUMN IF EXISTS current_address`);
    await queryRunner.query(`ALTER TABLE beneficiaries DROP COLUMN IF EXISTS provincial_address`);
    await queryRunner.query(`ALTER TABLE beneficiaries DROP COLUMN IF EXISTS philhealth_number`);
    await queryRunner.query(`ALTER TABLE beneficiaries DROP COLUMN IF EXISTS occupation`);
    await queryRunner.query(`ALTER TABLE beneficiaries DROP COLUMN IF EXISTS estimated_monthly_income`);
    await queryRunner.query(`ALTER TABLE beneficiaries DROP COLUMN IF EXISTS age`);
    await queryRunner.query(`ALTER TABLE family_members ADD COLUMN IF NOT EXISTS status_income TEXT`);
    await queryRunner.query(`ALTER TABLE family_members DROP COLUMN IF EXISTS occupation`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS problems_presented`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS social_worker_assessment`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS client_category`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS nature_of_service`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS financial_subsidies`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS amount_assistance`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS mode_financial_assistance`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS source_of_fund`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS legislator_specify`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS other_assistance`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS interviewed_by`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS client_signature`);
  }
}
