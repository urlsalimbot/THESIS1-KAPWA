import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePersonContactsAddresses0000000000039 implements MigrationInterface {
  name = 'CreatePersonContactsAddresses0000000000039';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS person_contacts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        person_id UUID NOT NULL,
        contact_type VARCHAR(50) NOT NULL,
        value TEXT NOT NULL,
        is_primary BOOLEAN,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_person_contacts_person ON person_contacts(person_id)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS person_addresses (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        person_id UUID NOT NULL,
        address_type VARCHAR(50) NOT NULL,
        barangay VARCHAR(255),
        city VARCHAR(255),
        province VARCHAR(255),
        postal VARCHAR(20),
        is_primary BOOLEAN,
        raw TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_person_addresses_person ON person_addresses(person_id)`);

    // Backfill contacts from persons.phone / persons.email (only when non-null).
    await queryRunner.query(`
      INSERT INTO person_contacts (person_id, contact_type, value, is_primary)
      SELECT id, 'phone', phone, true FROM persons WHERE phone IS NOT NULL AND phone <> ''
    `);
    await queryRunner.query(`
      INSERT INTO person_contacts (person_id, contact_type, value, is_primary)
      SELECT id, 'email', email, true FROM persons WHERE email IS NOT NULL AND email <> ''
    `);

    // Backfill addresses from persons.address (free-form) and persons.current_address (jsonb).
    await queryRunner.query(`
      INSERT INTO person_addresses (person_id, address_type, raw, is_primary)
      SELECT id, 'current', address, true FROM persons WHERE address IS NOT NULL AND address <> ''
    `);
    await queryRunner.query(`
      INSERT INTO person_addresses (person_id, address_type, barangay, city, province, is_primary)
      SELECT id, 'current',
             current_address->>'barangay',
             current_address->>'city',
             current_address->>'province',
             true
      FROM persons
      WHERE current_address IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS person_addresses`);
    await queryRunner.query(`DROP TABLE IF EXISTS person_contacts`);
  }
}
