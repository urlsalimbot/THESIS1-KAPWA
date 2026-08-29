import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropPersonLegacyColumns20260829000001 implements MigrationInterface {
  name = 'DropPersonLegacyColumns20260829000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE person_addresses
        ADD CONSTRAINT fk_person_addresses_person FOREIGN KEY (person_id)
        REFERENCES persons(id) ON DELETE CASCADE
        NOT VALID;
      DELETE FROM person_addresses pa WHERE NOT EXISTS (SELECT 1 FROM persons p WHERE p.id = pa.person_id);
      ALTER TABLE person_addresses VALIDATE CONSTRAINT fk_person_addresses_person;

      ALTER TABLE person_contacts
        ADD CONSTRAINT fk_person_contacts_person FOREIGN KEY (person_id)
        REFERENCES persons(id) ON DELETE CASCADE
        NOT VALID;
      DELETE FROM person_contacts pc WHERE NOT EXISTS (SELECT 1 FROM persons p WHERE p.id = pc.person_id);
      ALTER TABLE person_contacts VALIDATE CONSTRAINT fk_person_contacts_person;

      ALTER TABLE persons DROP COLUMN IF EXISTS address;
      ALTER TABLE persons DROP COLUMN IF EXISTS phone;
      ALTER TABLE persons DROP COLUMN IF EXISTS email;
      ALTER TABLE persons DROP COLUMN IF EXISTS current_address;
      ALTER TABLE persons DROP COLUMN IF EXISTS age;

      DROP POLICY IF EXISTS rls_barangay_persons_select ON persons;
      CREATE POLICY rls_barangay_persons_select ON persons
        USING (EXISTS (
          SELECT 1 FROM person_addresses pa
          WHERE pa.person_id = persons.id
            AND (pa.barangay ILIKE '%' || current_setting('app.current_barangay', true) || '%')
        ));

      -- RLS: ben_barangay_scope / cases_barangay_scope referenced the dropped
      -- persons.address column; recreate them scoped to person_addresses.
      DROP POLICY IF EXISTS ben_barangay_scope ON beneficiaries;
      CREATE POLICY ben_barangay_scope ON beneficiaries FOR ALL USING (
        current_setting('app.current_role') IN ('social_worker', 'coordinator')
        AND (current_setting('app.current_barangay') = ''
          OR EXISTS (SELECT 1 FROM person_addresses pa
                     WHERE pa.person_id = beneficiaries.person_id
                       AND (pa.barangay ILIKE '%' || current_setting('app.current_barangay') || '%'
                            OR pa.raw ILIKE '%' || current_setting('app.current_barangay') || '%')))
      );

      DROP POLICY IF EXISTS cases_barangay_scope ON cases;
      CREATE POLICY cases_barangay_scope ON cases FOR ALL USING (
        current_setting('app.current_role') IN ('social_worker', 'coordinator')
        AND EXISTS (
          SELECT 1 FROM beneficiaries b JOIN persons p ON p.id = b.person_id
          WHERE b.id = cases.beneficiary_id
            AND (current_setting('app.current_barangay') = ''
              OR EXISTS (SELECT 1 FROM person_addresses pa
                         WHERE pa.person_id = p.id
                           AND (pa.barangay ILIKE '%' || current_setting('app.current_barangay') || '%'
                                OR pa.raw ILIKE '%' || current_setting('app.current_barangay') || '%')))
        )
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP POLICY IF EXISTS rls_barangay_persons_select ON persons;
      ALTER TABLE persons ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE persons ADD COLUMN IF NOT EXISTS phone TEXT;
      ALTER TABLE persons ADD COLUMN IF NOT EXISTS email TEXT;
      ALTER TABLE persons ADD COLUMN IF NOT EXISTS current_address JSONB;
      ALTER TABLE persons ADD COLUMN IF NOT EXISTS age INTEGER;
      ALTER TABLE person_contacts DROP CONSTRAINT IF EXISTS fk_person_contacts_person;
      ALTER TABLE person_addresses DROP CONSTRAINT IF EXISTS fk_person_addresses_person;

      DROP POLICY IF EXISTS ben_barangay_scope ON beneficiaries;
      CREATE POLICY ben_barangay_scope ON beneficiaries FOR ALL USING (
        current_setting('app.current_role') IN ('social_worker', 'coordinator')
        AND (current_setting('app.current_barangay') = ''
          OR EXISTS (SELECT 1 FROM persons p WHERE p.id = beneficiaries.person_id AND p.address ILIKE '%' || current_setting('app.current_barangay') || '%'))
      );

      DROP POLICY IF EXISTS cases_barangay_scope ON cases;
      CREATE POLICY cases_barangay_scope ON cases FOR ALL USING (
        current_setting('app.current_role') IN ('social_worker', 'coordinator')
        AND EXISTS (
          SELECT 1 FROM beneficiaries b JOIN persons p ON p.id = b.person_id
          WHERE b.id = cases.beneficiary_id
            AND (current_setting('app.current_barangay') = '' OR p.address ILIKE '%' || current_setting('app.current_barangay') || '%')
        )
      );
    `);
  }
}