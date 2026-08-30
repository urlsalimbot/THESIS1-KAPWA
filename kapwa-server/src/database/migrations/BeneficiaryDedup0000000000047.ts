import { MigrationInterface, QueryRunner } from 'typeorm';

// Wave 2 Task 3: beneficiaries.consent_status + beneficiaries.category are now
// owned by the person-keyed beneficiary_roles child table. Backfill anything the
// legacy columns still hold, purge orphan roles, add the physical person FK, then
// drop the two legacy columns. API shape is preserved via Beneficiary getters that
// read Person.roles[0].
export class BeneficiaryDedup0000000000047 implements MigrationInterface {
  name = 'BeneficiaryDedup0000000000047';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Backfill beneficiary_roles from the legacy beneficiary columns (one role row
    //    per person; skip people who already have a role).
    await queryRunner.query(`
      INSERT INTO beneficiary_roles (id, person_id, household_id, user_id, consent_status, category, created_at, updated_at)
      SELECT uuid_generate_v7(), b.person_id, b.household_id, b.user_id, b.consent_status, b.category, NOW(), NOW()
      FROM beneficiaries b
      WHERE b.person_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM beneficiary_roles r WHERE r.person_id = b.person_id);
    `);

    // 2. Purge orphaned role rows whose person no longer exists.
    await queryRunner.query(`
      DELETE FROM beneficiary_roles r
      WHERE NOT EXISTS (SELECT 1 FROM persons p WHERE p.id = r.person_id);
    `);

    // 3. Ensure the physical person FK is present with ON DELETE CASCADE. The
    //    catch-up schema created an anonymous inline `person_id REFERENCES
    //    persons(id)` with NO ACTION (no cascade) which would otherwise block
    //    person deletion; upgrade it to the named CASCADE constraint instead.
    await queryRunner.query(`
      DO $$
      DECLARE
        stale_fk TEXT;
      BEGIN
        -- Drop any existing non-CASCADE FK on beneficiary_roles.person_id -> persons.
        SELECT c.conname INTO stale_fk
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.contype = 'f'
          AND c.conrelid = 'beneficiary_roles'::regclass
          AND c.confrelid = 'persons'::regclass
          AND a.attname = 'person_id'
          AND c.confdeltype <> 'c';

        IF stale_fk IS NOT NULL THEN
          EXECUTE format('ALTER TABLE beneficiary_roles DROP CONSTRAINT %I', stale_fk);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint c
          WHERE c.contype = 'f' AND c.conname = 'fk_beneficiary_roles_person'
            AND c.conrelid = 'beneficiary_roles'::regclass
            AND c.confrelid = 'persons'::regclass
        ) THEN
          ALTER TABLE beneficiary_roles
            ADD CONSTRAINT fk_beneficiary_roles_person
            FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    // 4. Drop the legacy columns now that beneficiary_roles owns the data.
    await queryRunner.query(`ALTER TABLE beneficiaries DROP COLUMN IF EXISTS consent_status`);
    await queryRunner.query(`ALTER TABLE beneficiaries DROP COLUMN IF EXISTS category`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add the legacy columns and backfill from beneficiary_roles.
    await queryRunner.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS consent_status TEXT DEFAULT 'active'`);
    await queryRunner.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS category TEXT`);

    await queryRunner.query(`
      UPDATE beneficiaries b
      SET consent_status = r.consent_status,
          category = r.category
      FROM beneficiary_roles r
      WHERE r.person_id = b.person_id;
    `);

    // 5. Drop the FK constraint added by up().
    await queryRunner.query(`ALTER TABLE beneficiary_roles DROP CONSTRAINT IF EXISTS fk_beneficiary_roles_person`);
  }
}
