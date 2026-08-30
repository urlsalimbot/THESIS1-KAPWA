import { MigrationInterface, QueryRunner } from 'typeorm';

// Wave 2 Task 6: agencies/programs carried denormalized legacy columns
// (agencies.contact_info jsonb; programs.fund_sources text[]; programs.required_documents
// jsonb; access_card_services.agency text). Wave 1 backfilled the normalized child
// tables (agency_contacts / program_fund_sources / program_required_documents) and
// access_card_services already links via agency_id. This migration adds the real FK
// constraints and drops the legacy columns; API shape is preserved via @Expose()
// getters that reassemble the flattened shapes from the child rows.
//
// Policy: each parent FK is added NOT VALID, orphans are purged, then the constraint
// is validated (ADD-NOT-VALID -> purge -> VALIDATE), matching 20260829000001/4.
// access_card_services already carries an inline anonymous FK from
// 20260803000003 (AddAgencyIdToAccessCardServices); it is replaced by a named
// ON DELETE CASCADE constraint for consistency with the other child tables.
export class AgencyProgramDrop0000000000050 implements MigrationInterface {
  name = 'AgencyProgramDrop0000000000050';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE agency_contacts
        ADD CONSTRAINT fk_agency_contacts_agency FOREIGN KEY (agency_id)
        REFERENCES agencies(id) ON DELETE CASCADE
        NOT VALID;
      DELETE FROM agency_contacts ac WHERE NOT EXISTS (SELECT 1 FROM agencies a WHERE a.id = ac.agency_id);
      ALTER TABLE agency_contacts VALIDATE CONSTRAINT fk_agency_contacts_agency;

      ALTER TABLE program_fund_sources
        ADD CONSTRAINT fk_program_fund_sources_program FOREIGN KEY (program_id)
        REFERENCES programs(id) ON DELETE CASCADE
        NOT VALID;
      DELETE FROM program_fund_sources pfs WHERE NOT EXISTS (SELECT 1 FROM programs p WHERE p.id = pfs.program_id);
      ALTER TABLE program_fund_sources VALIDATE CONSTRAINT fk_program_fund_sources_program;

      ALTER TABLE program_required_documents
        ADD CONSTRAINT fk_program_required_documents_program FOREIGN KEY (program_id)
        REFERENCES programs(id) ON DELETE CASCADE
        NOT VALID;
      DELETE FROM program_required_documents prd WHERE NOT EXISTS (SELECT 1 FROM programs p WHERE p.id = prd.program_id);
      ALTER TABLE program_required_documents VALIDATE CONSTRAINT fk_program_required_documents_program;

      ALTER TABLE access_card_services DROP CONSTRAINT IF EXISTS access_card_services_agency_id_fkey;
      ALTER TABLE access_card_services
        ADD CONSTRAINT fk_access_card_services_agency FOREIGN KEY (agency_id)
        REFERENCES agencies(id) ON DELETE CASCADE
        NOT VALID;
      DELETE FROM access_card_services s WHERE s.agency_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM agencies a WHERE a.id = s.agency_id);
      ALTER TABLE access_card_services VALIDATE CONSTRAINT fk_access_card_services_agency;

      ALTER TABLE agencies DROP COLUMN IF EXISTS contact_info;
      ALTER TABLE programs DROP COLUMN IF EXISTS fund_sources;
      ALTER TABLE programs DROP COLUMN IF EXISTS required_documents;
      ALTER TABLE access_card_services DROP COLUMN IF EXISTS agency;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE agencies ADD COLUMN IF NOT EXISTS contact_info JSONB;
      ALTER TABLE programs ADD COLUMN IF NOT EXISTS fund_sources TEXT[];
      ALTER TABLE programs ADD COLUMN IF NOT EXISTS required_documents JSONB;
      ALTER TABLE access_card_services ADD COLUMN IF NOT EXISTS agency TEXT;

      -- Backfill the re-added legacy columns from the child rows so a rollback
      -- keeps the flattened shapes intact.
      UPDATE agencies a
        SET contact_info = sub.ci
        FROM (SELECT agency_id, jsonb_object_agg(contact_type, value) AS ci
              FROM agency_contacts GROUP BY agency_id) sub
        WHERE sub.agency_id = a.id;

      UPDATE programs p
        SET fund_sources = sub.fs
        FROM (SELECT program_id, array_agg(name ORDER BY created_at, id) AS fs
              FROM program_fund_sources GROUP BY program_id) sub
        WHERE sub.program_id = p.id;

      UPDATE programs p
        SET required_documents = sub.rd
        FROM (SELECT program_id, jsonb_agg(document_key) AS rd
              FROM program_required_documents GROUP BY program_id) sub
        WHERE sub.program_id = p.id;

      UPDATE access_card_services s
        SET agency = a.name
        FROM agencies a
        WHERE s.agency_id = a.id AND s.agency IS NULL;

      ALTER TABLE agency_contacts DROP CONSTRAINT IF EXISTS fk_agency_contacts_agency;
      ALTER TABLE program_fund_sources DROP CONSTRAINT IF EXISTS fk_program_fund_sources_program;
      ALTER TABLE program_required_documents DROP CONSTRAINT IF EXISTS fk_program_required_documents_program;
      ALTER TABLE access_card_services DROP CONSTRAINT IF EXISTS fk_access_card_services_agency;

      -- Restore the inline anonymous FK that 20260803000003 created.
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'access_card_services_agency_id_fkey') THEN
          ALTER TABLE access_card_services
            ADD CONSTRAINT access_card_services_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id);
        END IF;
      END $$;
    `);
  }
}