import { MigrationInterface, QueryRunner } from 'typeorm';

// Two lifecycle-rule fixes:
//
// 1. Phase-Out follow-up / home visits were dropped when the legacy
//    `cases.follow_up_visits` JSONB column was removed (CaseDecompose 0048) and
//    the feature was never re-implemented. Restore it as a normalized child
//    table so the Evaluate Help Given step can record visits again.
//
// 2. Documentary needs may be uploaded remotely by the client and then "pass
//    on-site", or pass on-site directly. `document_vault` had no verification
//    state, so a remote upload could never be confirmed at the office. Add
//    verified_at / verified_by.
//
// 3. Some seeded program documents are conditional ("... (if applicable)",
//    "... (depending on ...)") but were inserted with mandatory = TRUE, which
//    made routine cases impossible to activate. Flip those to non-mandatory.
export class CaseFollowUpVisitsAndDocVerification0000000000062 implements MigrationInterface {
  name = 'CaseFollowUpVisitsAndDocVerification0000000000062';

  private readonly conditionalDocuments = [
    'Death certificate (for burial-adjacent medical claims)',
    'Medical appointment slip / referral (if medical-related)',
    'Affidavit of need (if emergency travel)',
    'Supporting documents depending on purpose (hospital bill, quotation, assessment)',
    'Bank account details / GCash account (if applicable)',
    'Skills training certificate (if applicable)',
    'Referral letter (if from other agency)',
    'Referral letter (if any)',
    'Medical assessment (if medical-related)',
    'Social case study report (if available)',
    'Medical certificate / hospital bill / quotation (depending on need)',
    'Barangay Certificate of Indigency (for household grantees)',
    'Grades / class card (for continuing)',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS case_follow_up_visits (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        case_id UUID NOT NULL,
        visit_date DATE NOT NULL,
        visit_type TEXT NOT NULL,
        notes TEXT,
        outcome TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_case_follow_up_visits_case ON case_follow_up_visits(case_id);

      ALTER TABLE case_follow_up_visits
        ADD CONSTRAINT fk_case_follow_up_visits_case FOREIGN KEY (case_id)
        REFERENCES cases(id) ON DELETE CASCADE
        NOT VALID;
      DELETE FROM case_follow_up_visits v WHERE NOT EXISTS (SELECT 1 FROM cases c WHERE c.id = v.case_id);
      ALTER TABLE case_follow_up_visits VALIDATE CONSTRAINT fk_case_follow_up_visits_case;

      ALTER TABLE document_vault ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;
      ALTER TABLE document_vault ADD COLUMN IF NOT EXISTS verified_by UUID;

      -- One checklist row per (case, requirement) so on-site confirmation can be
      -- an idempotent upsert and the activation gate cannot double-count.
      DELETE FROM case_requirements a USING case_requirements b
        WHERE a.id < b.id AND a.case_id = b.case_id AND a.requirement_key = b.requirement_key;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_case_requirements_case_key
        ON case_requirements(case_id, requirement_key);
    `);
    await queryRunner.query(
      `UPDATE program_required_documents SET mandatory = FALSE WHERE document_key = ANY($1::text[])`,
      [this.conditionalDocuments],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE case_follow_up_visits DROP CONSTRAINT IF EXISTS fk_case_follow_up_visits_case;
      DROP INDEX IF EXISTS idx_case_follow_up_visits_case;
      DROP TABLE IF EXISTS case_follow_up_visits;
      ALTER TABLE document_vault DROP COLUMN IF EXISTS verified_at;
      ALTER TABLE document_vault DROP COLUMN IF EXISTS verified_by;
      DROP INDEX IF EXISTS uq_case_requirements_case_key;
    `);
  }
}
