import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAgenciesTable0000000000035 implements MigrationInterface {
  name = 'CreateAgenciesTable0000000000035';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS agencies (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        code VARCHAR(10) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(50),
        contact_info JSONB,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      INSERT INTO agencies (code, name, type, is_active) VALUES
        ('MSWDO', 'Municipal Social Welfare and Development Office', 'social_services', true),
        ('RHU', 'Rural Health Unit - Norzagaray', 'health', true),
        ('WCPD', 'Women and Children Protection Desk (PNP)', 'police', true),
        ('PESO', 'Public Employment Service Office', 'labor', true),
        ('DILG', 'Department of the Interior and Local Government', 'government', true),
        ('DSWD', 'Department of Social Welfare and Development', 'social_services', true),
        ('DepEd', 'Department of Education', 'education', true)
      ON CONFLICT (code) DO NOTHING
    `);
    await queryRunner.query(`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES agencies(id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_users_agency ON users(agency_id)`);
    await queryRunner.query(`
      UPDATE users u SET agency_id = a.id
      FROM agencies a
      WHERE a.code = 'MSWDO' AND u.agency_id IS NULL AND u.role IN ('admin', 'social_worker')
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_agency`);
    await queryRunner.query(`ALTER TABLE IF EXISTS users DROP COLUMN IF EXISTS agency_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS agencies`);
  }
}
