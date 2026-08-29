import { MigrationInterface, QueryRunner } from 'typeorm';

// Wave 2 Task 5: referrals carried a denormalized person copy (surname, first_name,
// middle_name, extension, gender, dob, address, phone). Those columns are dropped and
// referrals link to the persons table via the existing nullable person_id FK
// (column added by 20260828000005-AddReferralPersonId). API shape is preserved via
// Referral getters that read the joined Person.
//
// Policy: the FK sits on a NULLABLE column, so we backfill every referral whose
// embedded identity (surname + first_name + dob) is present — matching an existing
// person where one matches, otherwise creating one from the embedded data — and leave
// referrals with no resolvable identity with person_id NULL rather than purging the
// referral. Only after backfill do we VALIDATE the constraint and drop the 8 embedded
// columns.
export class ReferralPersonLink20260829000005 implements MigrationInterface {
  name = 'ReferralPersonLink20260829000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE referrals
        ADD CONSTRAINT fk_referrals_person FOREIGN KEY (person_id)
        REFERENCES persons(id) ON DELETE CASCADE
        NOT VALID;

      DO $$
      DECLARE
        ref RECORD;
        matched UUID;
      BEGIN
        FOR ref IN
          SELECT id, surname, first_name, middle_name, extension, gender,
                 dob, address, phone
          FROM referrals
          WHERE person_id IS NULL
            AND surname IS NOT NULL AND surname <> ''
            AND first_name IS NOT NULL AND first_name <> ''
            AND dob IS NOT NULL
        LOOP
          -- 1) Reuse an existing person matching surname + first_name + dob.
          SELECT p.id INTO matched
          FROM persons p
          WHERE p.surname = ref.surname
            AND p.first_name = ref.first_name
            AND p.dob = ref.dob::date
          LIMIT 1;

          -- 2) Otherwise create a person from the embedded data, carrying over
          --    phone/address into the person_contacts/person_addresses child rows.
          IF matched IS NULL THEN
            INSERT INTO persons (id, surname, first_name, middle_name, extension, gender, dob, created_at, updated_at)
            VALUES (uuid_generate_v7(), ref.surname, ref.first_name, ref.middle_name, ref.extension,
                    CASE
                      WHEN NULLIF(BTRIM(ref.gender), '') IS NULL THEN 'Male'
                      WHEN UPPER(BTRIM(ref.gender)) IN ('MALE','M') THEN 'Male'
                      ELSE 'Female'
                    END, ref.dob, NOW(), NOW())
            RETURNING id INTO matched;

            IF ref.phone IS NOT NULL AND ref.phone <> '' THEN
              INSERT INTO person_contacts (id, person_id, contact_type, value, is_primary, created_at, updated_at)
              VALUES (uuid_generate_v7(), matched, 'phone', ref.phone, true, NOW(), NOW());
            END IF;

            IF ref.address IS NOT NULL AND ref.address <> '{}'::jsonb THEN
              INSERT INTO person_addresses (id, person_id, address_type, barangay, raw, is_primary, created_at, updated_at)
              VALUES (uuid_generate_v7(), matched, 'current',
                      NULLIF(ref.address->>'barangay', ''),
                      NULLIF(CONCAT_WS(', ', NULLIF(ref.address->>'street',''), NULLIF(ref.address->>'barangay','')), ''),
                      true, NOW(), NOW());
            END IF;
          END IF;

          UPDATE referrals SET person_id = matched WHERE id = ref.id;
        END LOOP;
      END $$;

      ALTER TABLE referrals VALIDATE CONSTRAINT fk_referrals_person;

      ALTER TABLE referrals DROP COLUMN IF EXISTS surname;
      ALTER TABLE referrals DROP COLUMN IF EXISTS first_name;
      ALTER TABLE referrals DROP COLUMN IF EXISTS middle_name;
      ALTER TABLE referrals DROP COLUMN IF EXISTS extension;
      ALTER TABLE referrals DROP COLUMN IF EXISTS gender;
      ALTER TABLE referrals DROP COLUMN IF EXISTS dob;
      ALTER TABLE referrals DROP COLUMN IF EXISTS address;
      ALTER TABLE referrals DROP COLUMN IF EXISTS phone;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE referrals ADD COLUMN IF NOT EXISTS surname TEXT;
      ALTER TABLE referrals ADD COLUMN IF NOT EXISTS first_name TEXT;
      ALTER TABLE referrals ADD COLUMN IF NOT EXISTS middle_name TEXT;
      ALTER TABLE referrals ADD COLUMN IF NOT EXISTS extension TEXT;
      ALTER TABLE referrals ADD COLUMN IF NOT EXISTS gender TEXT;
      ALTER TABLE referrals ADD COLUMN IF NOT EXISTS dob DATE;
      ALTER TABLE referrals ADD COLUMN IF NOT EXISTS address JSONB;
      ALTER TABLE referrals ADD COLUMN IF NOT EXISTS phone TEXT;

      -- Backfill the re-added embedded columns from the joined person row so clients
      -- that still read the flattened shape keep working after a rollback.
      UPDATE referrals r
        SET surname = p.surname,
            first_name = p.first_name,
            middle_name = p.middle_name,
            extension = p.extension,
            gender = p.gender,
            dob = p.dob,
            phone = p.phone
        FROM persons p
        WHERE r.person_id = p.id;

      -- Preserve the structured { street?, barangay } JSONB by reconstructing it from
      -- the person's current address row.
      UPDATE referrals r
        SET address = jsonb_build_object('barangay', pa.barangay)
        FROM persons p
        JOIN person_addresses pa ON pa.person_id = p.id AND pa.address_type = 'current'
        WHERE r.person_id = p.id;

      ALTER TABLE referrals DROP CONSTRAINT IF EXISTS fk_referrals_person;
    `);
  }
}
