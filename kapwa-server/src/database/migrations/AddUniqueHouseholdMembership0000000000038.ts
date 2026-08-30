import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueHouseholdMembership0000000000038 implements MigrationInterface {
  name = 'AddUniqueHouseholdMembership0000000000038';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Dedup: keep one row per (person_id, household_id) where household_id is not null.
    // ids are uuidv7 (no ordering semantics), so dedup on ctid (physical row order)
    // which is always valid in Postgres.
    await queryRunner.query(`
      DELETE FROM household_memberships a
      USING household_memberships b
      WHERE a.ctid > b.ctid
        AND a.person_id = b.person_id
        AND a.household_id = b.household_id
        AND a.household_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_household_memberships_person_household"
      ON household_memberships (person_id, household_id)
      WHERE household_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_household_memberships_person_household"`);
  }
}
