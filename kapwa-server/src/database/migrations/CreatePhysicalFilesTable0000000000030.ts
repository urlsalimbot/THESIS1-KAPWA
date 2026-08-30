import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePhysicalFilesTable0000000000030 implements MigrationInterface {
  name = 'CreatePhysicalFilesTable0000000000030';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS physical_files (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        intervention_id UUID UNIQUE NOT NULL REFERENCES case_interventions(id),
        cabinet VARCHAR(50) NOT NULL,
        folder VARCHAR(100) NOT NULL,
        shelf VARCHAR(100) NOT NULL,
        qr_hash VARCHAR(64) UNIQUE,
        qr_data_url TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_physical_intervention ON physical_files(intervention_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_physical_cabinet ON physical_files(cabinet)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_physical_folder ON physical_files(folder)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_physical_shelf ON physical_files(shelf)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_physical_qr ON physical_files(qr_hash)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS physical_files`);
  }
}