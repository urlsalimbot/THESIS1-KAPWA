import { MigrationInterface, QueryRunner } from 'typeorm';

/** Structured traffic-light code for every import row's eligibility outcome. */
export class AddClientDedupEligibilityCode0000000000088 implements MigrationInterface {
  name = 'AddClientDedupEligibilityCode0000000000088';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE client_import_rows ADD COLUMN eligibility_code TEXT`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE client_import_rows DROP COLUMN eligibility_code`);
  }
}