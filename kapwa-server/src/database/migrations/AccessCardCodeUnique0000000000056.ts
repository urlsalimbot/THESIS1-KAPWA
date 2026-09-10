import { MigrationInterface, QueryRunner } from 'typeorm';

export class AccessCardCodeUnique0000000000056 implements MigrationInterface {
  name = 'AccessCardCodeUnique0000000000056';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Codes are nullable (rows without cards) — Postgres unique indexes allow
    // multiple NULLs, so these only constrain rows that carry a code. Run
    // AFTER duplicate codes have been deduplicated (see seed alignment).
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_beneficiary_roles_access_card_code
        ON beneficiary_roles (access_card_code)
        WHERE access_card_code IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_households_access_card_code
        ON households (access_card_code)
        WHERE access_card_code IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS uq_beneficiary_roles_access_card_code;
      DROP INDEX IF EXISTS uq_households_access_card_code;
    `);
  }
}