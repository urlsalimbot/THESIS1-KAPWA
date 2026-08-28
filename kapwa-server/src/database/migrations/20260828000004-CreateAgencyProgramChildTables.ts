import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAgencyProgramChildTables20260828000004 implements MigrationInterface {
  name = 'CreateAgencyProgramChildTables20260828000004';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS agency_contacts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        agency_id UUID NOT NULL,
        contact_type VARCHAR(50) NOT NULL,
        value TEXT NOT NULL,
        is_primary BOOLEAN,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_agency_contacts_agency ON agency_contacts(agency_id)`);

    // Backfill agencies.contact_info jsonb keys.
    await queryRunner.query(`
      INSERT INTO agency_contacts (agency_id, contact_type, value, is_primary)
      SELECT a.id, e.key, e.value::text, true
      FROM agencies a, jsonb_each_text(a.contact_info) AS e
      WHERE a.contact_info IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS program_fund_sources (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        program_id UUID NOT NULL,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_program_funds_program ON program_fund_sources(program_id)`);

    // Backfill programs.fund_sources text[] via unnest.
    await queryRunner.query(`
      INSERT INTO program_fund_sources (program_id, name)
      SELECT p.id, f.name
      FROM programs p, unnest(p.fund_sources) AS f(name)
      WHERE array_length(p.fund_sources, 1) > 0
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS program_required_documents (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        program_id UUID NOT NULL,
        document_key VARCHAR(100) NOT NULL,
        mandatory BOOLEAN,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_program_docs_program ON program_required_documents(program_id)`);

    // Backfill programs.required_documents jsonb array.
    await queryRunner.query(`
      INSERT INTO program_required_documents (program_id, document_key, mandatory)
      SELECT p.id, doc, true
      FROM programs p, jsonb_array_elements_text(p.required_documents) AS doc
      WHERE p.required_documents IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS program_required_documents`);
    await queryRunner.query(`DROP TABLE IF EXISTS program_fund_sources`);
    await queryRunner.query(`DROP TABLE IF EXISTS agency_contacts`);
  }
}
