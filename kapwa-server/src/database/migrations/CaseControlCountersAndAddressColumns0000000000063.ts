import { MigrationInterface, QueryRunner } from 'typeorm';

// F7: control numbers were generated as max+1, so deleting the newest case let
// the next intake reuse its number (ambiguous printed documents) and concurrent
// intakes collided. Replace the scan with an atomic per-year counter row.
// F10: the intake address schema requires street/region/postalCode but
// person_addresses had no street/region columns, so those values were dropped.
export class CaseControlCountersAndAddressColumns0000000000063 implements MigrationInterface {
  name = 'CaseControlCountersAndAddressColumns0000000000063';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS case_control_counters (
        year INTEGER PRIMARY KEY,
        last_seq INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Seed from existing numbers so a number already printed is never reused.
      INSERT INTO case_control_counters (year, last_seq)
      SELECT (split_part(control_no, '-', 2))::int AS year,
             MAX((split_part(control_no, '-', 3))::int) AS max_seq
        FROM cases
       WHERE control_no ~ '^KAPWA-[0-9]{4}-[0-9]+$'
       GROUP BY 1
      ON CONFLICT (year) DO UPDATE
        SET last_seq = GREATEST(case_control_counters.last_seq, EXCLUDED.last_seq);

      ALTER TABLE person_addresses ADD COLUMN IF NOT EXISTS street TEXT;
      ALTER TABLE person_addresses ADD COLUMN IF NOT EXISTS region TEXT;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE person_addresses DROP COLUMN IF EXISTS street;
      ALTER TABLE person_addresses DROP COLUMN IF EXISTS region;
      DROP TABLE IF EXISTS case_control_counters;
    `);
  }
}
