import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * IP (Indigenous Person) flag: `persons.is_indigenous` records the flag at
 * intake, and `cases.is_indigenous` carries it onto the case when the intake
 * succeeds, so the assessment step can see it without re-asking.
 */
export class AddIsIndigenousFlags0000000000091 implements MigrationInterface {
  name = 'AddIsIndigenousFlags0000000000091';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE persons ADD COLUMN IF NOT EXISTS is_indigenous BOOLEAN NOT NULL DEFAULT FALSE`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS is_indigenous BOOLEAN NOT NULL DEFAULT FALSE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS is_indigenous`);
    await queryRunner.query(`ALTER TABLE persons DROP COLUMN IF EXISTS is_indigenous`);
  }
}