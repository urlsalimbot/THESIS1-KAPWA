import { MigrationInterface, QueryRunner } from 'typeorm';

// The Physical Filing feature is removed: its Nest module was never registered
// and nothing ever wrote to `physical_files`, so the browse page could only
// ever render its empty state. Document verification and on-site filing belong
// in the case's required-documents checklist (the Implement HIP step), which is
// where they now live. Drop the orphaned table.
export class DropPhysicalFilesTable0000000000064 implements MigrationInterface {
  name = 'DropPhysicalFilesTable0000000000064';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS physical_files`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
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
}
