import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCaseChildTables20260828000003 implements MigrationInterface {
  name = 'CreateCaseChildTables20260828000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS case_requirements (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        case_id UUID NOT NULL,
        requirement_key VARCHAR(100) NOT NULL,
        met BOOLEAN,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_case_requirements_case ON case_requirements(case_id)`);

    // Backfill requirements_checklist jsonb: each jsonb_each key becomes one row.
    await queryRunner.query(`
      INSERT INTO case_requirements (case_id, requirement_key, met)
      SELECT c.id, e.key, e.value::boolean
      FROM cases c, jsonb_each(c.requirements_checklist) AS e
      WHERE c.requirements_checklist IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS case_referrals (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        case_id UUID NOT NULL,
        agency VARCHAR(255),
        status VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_case_referrals_case ON case_referrals(case_id)`);

    // Backfill referrals jsonb array: one row per element.
    await queryRunner.query(`
      INSERT INTO case_referrals (case_id, agency, status, notes)
      SELECT c.id,
             r->>'agencyName',
             r->>'status',
             r->>'notes'
      FROM cases c, jsonb_array_elements(c.referrals) AS r
      WHERE c.referrals IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS case_assistances (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        case_id UUID NOT NULL,
        assistance_type VARCHAR(50) NOT NULL,
        amount DECIMAL(12,2),
        mode VARCHAR(50),
        source_of_fund VARCHAR(100),
        legislator_specify VARCHAR(255),
        details JSONB,
        approved_by_signature TEXT,
        approved_by_role VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_case_assistances_case ON case_assistances(case_id)`);

    // Backfill a financial assistance row from the flat financial columns.
    await queryRunner.query(`
      INSERT INTO case_assistances
        (case_id, assistance_type, amount, mode, source_of_fund, legislator_specify, details)
      SELECT c.id,
             'financial',
             c.amount_assistance,
             c.mode_financial_assistance,
             c.source_of_fund,
             c.legislator_specify,
             c.financial_subsidies
      FROM cases c
      WHERE c.amount_assistance IS NOT NULL OR c.financial_subsidies IS NOT NULL
    `);
    // Backfill other_assistance jsonb object: one row per key.
    await queryRunner.query(`
      INSERT INTO case_assistances (case_id, assistance_type, details)
      SELECT c.id, 'other', jsonb_build_object(e.key, e.value)
      FROM cases c, jsonb_each(c.other_assistance) AS e
      WHERE c.other_assistance IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS case_assistances`);
    await queryRunner.query(`DROP TABLE IF EXISTS case_referrals`);
    await queryRunner.query(`DROP TABLE IF EXISTS case_requirements`);
  }
}