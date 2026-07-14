import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInterventionTypesTable2026071200001 implements MigrationInterface {
  name = 'CreateInterventionTypesTable2026071200001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS intervention_types (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        code VARCHAR(10) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      INSERT INTO intervention_types (code, name, description) VALUES
        ('FA',   'Financial Assistance', 'Direct financial aid disbursement to beneficiaries'),
        ('C',    'Cash Assistance',      'Cash-based assistance distribution'),
        ('CSR',  'Case Study Report',    'Comprehensive Social Report – assessment documentation'),
        ('R',    'Referral',             'Referral to external agency or service provider'),
        ('H',    'Home Visit',           'Home visit for wellness check or monitoring'),
        ('HV',   'Home Visit Variation', 'Home visit with additional services or distribution'),
        ('Other','Other Intervention',   'Custom intervention type defined by admin')
      ON CONFLICT (code) DO NOTHING
    `);

    await queryRunner.query(`ALTER TABLE interventions DROP CONSTRAINT IF EXISTS interventions_intervention_type_check`);
    await queryRunner.query(`ALTER TABLE interventions DROP CONSTRAINT IF EXISTS ck_intervention_type`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE interventions ADD CONSTRAINT interventions_intervention_type_check
      CHECK (intervention_type IN ('FA','C','CSR','R','H','HV','Other'))
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS intervention_types`);
  }
}
