import { MigrationInterface, QueryRunner } from 'typeorm';

export class UnifiedPersonModel20260720000001 implements MigrationInterface {
  name = 'UnifiedPersonModel20260720000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    // ==========================================================================
    // 1. CREATE persons TABLE
    // ==========================================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS persons (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        surname TEXT NOT NULL,
        first_name TEXT NOT NULL,
        middle_name TEXT,
        extension TEXT,
        gender TEXT CHECK (gender IN ('Male','Female')),
        dob DATE NOT NULL,
        address TEXT,
        phone TEXT,
        philsys_number TEXT UNIQUE,
        place_of_birth TEXT,
        civil_status TEXT,
        current_address JSONB,
        philhealth_number TEXT,
        occupation TEXT,
        estimated_monthly_income DECIMAL(12,2),
        age INTEGER,
        email TEXT,
        search_vector TSVECTOR,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Ensure columns exist (migrate.ts may have created persons table without these)
    await queryRunner.query(
      `ALTER TABLE IF EXISTS persons ADD COLUMN IF NOT EXISTS email TEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS persons ADD COLUMN IF NOT EXISTS extension TEXT`,
    );
    // Add email index + self-link columns to users table
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_persons_email ON persons(email)`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES persons(id)`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS pending_person_id UUID`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS person_link_code TEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS person_link_code_expires_at TIMESTAMP`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_persons_search ON persons USING gin(search_vector)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_persons_name_trgm ON persons USING gin (surname gin_trgm_ops, first_name gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_persons_address ON persons(address)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_persons_philsys ON persons(philsys_number)`,
    );

    // ==========================================================================
    // 2. ADD person_id TO beneficiaries + MIGRATE DATA
    // ==========================================================================
    await queryRunner.query(
      `ALTER TABLE IF EXISTS beneficiaries ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES persons(id)`,
    );

    // Migrate existing beneficiary data into persons table.
    // Guarded: on a DB that already ran this migration (or bootstrapped via
    // migrate.js), beneficiaries has no legacy surname column — skip the copy
    // instead of failing (persons already populated by the first run).
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'beneficiaries' AND column_name = 'surname') THEN
          INSERT INTO persons (id, surname, first_name, middle_name, gender, dob, address, phone, philsys_number,
            place_of_birth, civil_status, current_address, philhealth_number,
            occupation, estimated_monthly_income, age, email, search_vector)
          SELECT id, surname, first_name, middle_name, gender, dob, address, phone, philsys_number,
            place_of_birth, civil_status, current_address, philhealth_number,
            occupation, estimated_monthly_income, age, NULL, search_vector
          FROM beneficiaries
          WHERE id IS NOT NULL;
        END IF;
      END $$;
    `);

    // Link beneficiaries to their person records
    await queryRunner.query(
      `UPDATE beneficiaries SET person_id = id WHERE person_id IS NULL`,
    );

    // ==========================================================================
    // 3. DROP LEGACY COLUMNS FROM beneficiaries
    // ==========================================================================
    // Drop dependent indexes first
    await queryRunner.query(`DROP INDEX IF EXISTS idx_beneficiary_search`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_beneficiary_name_trgm`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_beneficiary_barangay`);

    // Drop RLS policies that reference beneficiaries.address
    await queryRunner.query(`DROP POLICY IF EXISTS ben_barangay_scope ON beneficiaries`);
    await queryRunner.query(`DROP POLICY IF EXISTS cases_barangay_scope ON cases`);

    // Drop redundant person columns
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries DROP COLUMN IF EXISTS surname`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries DROP COLUMN IF EXISTS first_name`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries DROP COLUMN IF EXISTS middle_name`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries DROP COLUMN IF EXISTS gender`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries DROP COLUMN IF EXISTS dob`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries DROP COLUMN IF EXISTS address`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries DROP COLUMN IF EXISTS phone`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries DROP COLUMN IF EXISTS philsys_number`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries DROP COLUMN IF EXISTS place_of_birth`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries DROP COLUMN IF EXISTS civil_status`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries DROP COLUMN IF EXISTS current_address`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries DROP COLUMN IF EXISTS philhealth_number`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries DROP COLUMN IF EXISTS occupation`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries DROP COLUMN IF EXISTS estimated_monthly_income`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries DROP COLUMN IF EXISTS age`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries DROP COLUMN IF EXISTS search_vector`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries DROP COLUMN IF EXISTS provincial_address`);

    // Make person_id NOT NULL after data migration
    await queryRunner.query(
      `ALTER TABLE IF EXISTS beneficiaries ALTER COLUMN person_id SET NOT NULL`,
    );

    // ==========================================================================
    // 4. RECREATE RLS POLICIES with join to persons
    // ==========================================================================
    await queryRunner.query(`
      CREATE POLICY ben_barangay_scope ON beneficiaries
      FOR ALL USING (
        current_setting('app.current_role') IN ('social_worker', 'coordinator')
        AND (current_setting('app.current_barangay') = '' OR
             EXISTS (SELECT 1 FROM persons p WHERE p.id = beneficiaries.person_id
                     AND p.address ILIKE '%' || current_setting('app.current_barangay') || '%'))
      )
    `);

    await queryRunner.query(`
      CREATE POLICY cases_barangay_scope ON cases
      FOR ALL USING (
        current_setting('app.current_role') IN ('social_worker', 'coordinator')
        AND (current_setting('app.current_barangay') = '' OR
             EXISTS (SELECT 1 FROM persons p WHERE p.id = cases.beneficiary_id
                     AND p.address ILIKE '%' || current_setting('app.current_barangay') || '%'))
      )
    `);

    // ==========================================================================
    // 5. CREATE beneficiary_claimants TABLE
    // ==========================================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS beneficiary_claimants (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        beneficiary_id UUID NOT NULL REFERENCES persons(id),
        claimant_id UUID NOT NULL REFERENCES persons(id),
        relationship TEXT NOT NULL,
        authorization_url TEXT,
        calendar_year INTEGER,
        is_primary BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_bc_beneficiary ON beneficiary_claimants(beneficiary_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_bc_claimant ON beneficiary_claimants(claimant_id)`,
    );

    // ==========================================================================
    // 6. CREATE household_memberships TABLE
    // ==========================================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS household_memberships (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        person_id UUID NOT NULL REFERENCES persons(id),
        household_id UUID REFERENCES households(id),
        relationship TEXT NOT NULL,
        is_primary BOOLEAN DEFAULT FALSE,
        status TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_hm_person ON household_memberships(person_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_hm_household ON household_memberships(household_id)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables created by this migration
    await queryRunner.query(`DROP TABLE IF EXISTS household_memberships CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS beneficiary_claimants CASCADE`);

    // Drop RLS policies
    await queryRunner.query(`DROP POLICY IF EXISTS ben_barangay_scope ON beneficiaries`);
    await queryRunner.query(`DROP POLICY IF EXISTS cases_barangay_scope ON cases`);

    // Restore legacy columns
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries ADD COLUMN surname TEXT`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries ADD COLUMN first_name TEXT`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries ADD COLUMN middle_name TEXT`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries ADD COLUMN gender TEXT CHECK (gender IN ('Male','Female'))`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries ADD COLUMN dob DATE`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries ADD COLUMN address TEXT`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries ADD COLUMN phone TEXT`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries ADD COLUMN philsys_number TEXT UNIQUE`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries ADD COLUMN place_of_birth TEXT`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries ADD COLUMN civil_status TEXT`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries ADD COLUMN current_address JSONB`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries ADD COLUMN provincial_address JSONB`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries ADD COLUMN philhealth_number TEXT`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries ADD COLUMN occupation TEXT`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries ADD COLUMN estimated_monthly_income DECIMAL(12,2)`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries ADD COLUMN age INTEGER`);
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries ADD COLUMN search_vector TSVECTOR`);

    // Restore data from persons
    await queryRunner.query(`
      UPDATE beneficiaries b
      SET surname = p.surname,
          first_name = p.first_name,
          middle_name = p.middle_name,
          gender = p.gender,
          dob = p.dob,
          address = p.address,
          phone = p.phone,
          philsys_number = p.philsys_number,
          search_vector = p.search_vector
      FROM persons p
      WHERE b.person_id = p.id
    `);

    // Drop person_id from beneficiaries
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries DROP COLUMN IF EXISTS person_id`);

    // Recreate original indexes
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_beneficiary_search ON beneficiaries USING gin(search_vector)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_beneficiary_name_trgm ON beneficiaries USING gin (surname gin_trgm_ops, first_name gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_beneficiary_barangay ON beneficiaries(address)`,
    );

    // Recreate original RLS policies
    await queryRunner.query(`
      CREATE POLICY ben_barangay_scope ON beneficiaries
      FOR ALL USING (
        current_setting('app.current_role') IN ('social_worker', 'coordinator')
        AND (current_setting('app.current_barangay') = '' OR
             address ILIKE '%' || current_setting('app.current_barangay') || '%')
      )
    `);

    await queryRunner.query(`
      CREATE POLICY cases_barangay_scope ON cases
      FOR ALL USING (
        current_setting('app.current_role') IN ('social_worker', 'coordinator')
        AND (current_setting('app.current_barangay') = '' OR
             EXISTS (SELECT 1 FROM beneficiaries b WHERE b.id = cases.beneficiary_id
                     AND b.address ILIKE '%' || current_setting('app.current_barangay') || '%'))
      )
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_persons_email`);
    await queryRunner.query(`ALTER TABLE IF EXISTS users DROP COLUMN IF EXISTS person_id`);
    await queryRunner.query(`ALTER TABLE IF EXISTS users DROP COLUMN IF EXISTS pending_person_id`);
    await queryRunner.query(`ALTER TABLE IF EXISTS users DROP COLUMN IF EXISTS person_link_code`);
    await queryRunner.query(`ALTER TABLE IF EXISTS users DROP COLUMN IF EXISTS person_link_code_expires_at`);

    await queryRunner.query(`DROP TABLE IF EXISTS persons CASCADE`);
  }
}
