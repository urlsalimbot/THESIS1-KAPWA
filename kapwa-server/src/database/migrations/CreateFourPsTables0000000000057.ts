import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFourPsTables0000000000057 implements MigrationInterface {
  name = 'CreateFourPsTables0000000000057';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS case_compliance_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        case_id UUID NOT NULL REFERENCES cases(id),
        household_member_id UUID REFERENCES persons(id),
        compliance_type VARCHAR CHECK (compliance_type IN ('school_attendance','health_checkup','fds')),
        due_date DATE NOT NULL,
        month_label VARCHAR,
        met BOOLEAN DEFAULT FALSE,
        met_at TIMESTAMP,
        met_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_compliance_dedupe
        ON case_compliance_items(case_id, household_member_id, compliance_type, due_date);
      CREATE INDEX IF NOT EXISTS idx_compliance_case ON case_compliance_items(case_id);
      CREATE INDEX IF NOT EXISTS idx_compliance_due ON case_compliance_items(due_date);

      CREATE TABLE IF NOT EXISTS case_payouts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        case_id UUID NOT NULL REFERENCES cases(id),
        cycle_no VARCHAR,
        scheduled_at DATE NOT NULL,
        amount DECIMAL(12,2),
        status VARCHAR(20) DEFAULT 'scheduled'
          CHECK (status IN ('scheduled','completed','missed','cancelled')),
        notified_at TIMESTAMP,
        notified_by UUID REFERENCES users(id),
        remarks TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_payout_case ON case_payouts(case_id);
      CREATE INDEX IF NOT EXISTS idx_payout_date ON case_payouts(scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_payout_status ON case_payouts(status);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS case_payouts`);
    await queryRunner.query(`DROP TABLE IF EXISTS case_compliance_items`);
  }
}
