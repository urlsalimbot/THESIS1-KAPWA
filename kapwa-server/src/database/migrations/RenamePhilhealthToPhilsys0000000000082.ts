import { MigrationInterface, QueryRunner } from 'typeorm';

// persons.philhealth_number is renamed to philsys_number: the case file keeps
// the national (PhilSys) ID, and the separate PhilHealth member-number column
// is removed. Existing values are preserved by folding philhealth_number into
// philsys_number where no PhilSys value exists, then dropping the column.
// Mirrored by idempotent statements in migrate.ts.
export class RenamePhilhealthToPhilsys0000000000082 implements MigrationInterface {
  name = 'RenamePhilhealthToPhilsys0000000000082';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Conflict-safe: if another person already holds the philhealth value as
    // their philsys number, that value wins and this row's duplicate is
    // simply not copied (the philsys_number unique index must hold).
    await queryRunner.query(
      `UPDATE persons SET philsys_number = philhealth_number
       WHERE philhealth_number IS NOT NULL AND philsys_number IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM persons p2 WHERE p2.philsys_number = persons.philhealth_number
         )`,
    );
    await queryRunner.query(`ALTER TABLE persons DROP COLUMN IF EXISTS philhealth_number`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE persons ADD COLUMN IF NOT EXISTS philhealth_number TEXT`);
  }
}