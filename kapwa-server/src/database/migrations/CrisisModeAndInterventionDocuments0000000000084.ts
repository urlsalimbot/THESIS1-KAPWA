import { MigrationInterface, QueryRunner } from 'typeorm';

// Crisis mode (optional program enrollment) + intervention-anchored documentary
// minimums. Mirrored by idempotent statements in migrate.ts.
export class CrisisModeAndInterventionDocuments0000000000084 implements MigrationInterface {
  name = 'CrisisModeAndInterventionDocuments0000000000084';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN crisis_mode BOOLEAN NOT NULL DEFAULT FALSE`);
    await queryRunner.query(`CREATE TABLE intervention_required_documents (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
      intervention_type VARCHAR(32) NOT NULL,
      document_key VARCHAR(64) NOT NULL,
      mandatory BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_intervention_documents ON intervention_required_documents(intervention_type, document_key)`);
    await queryRunner.query(`INSERT INTO intervention_required_documents (intervention_type, document_key) VALUES
      ('medical_assistance', 'medical_certificate'),
      ('medical_assistance', 'hospital_bill'),
      ('burial_assistance', 'death_certificate'),
      ('burial_assistance', 'burial_permit'),
      ('educational_assistance', 'school_registration'),
      ('educational_assistance', 'report_card'),
      ('transportation_assistance', 'travel_request'),
      ('shelter_assistance', 'shelter_request')`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS intervention_required_documents`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS crisis_mode`);
  }
}