import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropInterventions20260727000001 implements MigrationInterface {
  name = 'DropInterventions20260727000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS interventions CASCADE`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS interventions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        case_id UUID REFERENCES cases(id),
        intervention_type TEXT,
        amount DECIMAL(12,2),
        fund_source TEXT,
        agency TEXT,
        service_rendered TEXT,
        service_date DATE,
        voucher_no TEXT,
        or_reference TEXT,
        worker_signature_url TEXT,
        worker_name_sign TEXT,
        logged_by UUID,
        hash TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
  }
}
