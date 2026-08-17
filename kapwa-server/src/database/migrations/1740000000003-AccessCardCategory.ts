import { MigrationInterface, QueryRunner } from 'typeorm';

export class AccessCardCategory1740000000003 implements MigrationInterface {
  name = 'AccessCardCategory1740000000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE IF EXISTS access_card_services ADD COLUMN IF NOT EXISTS category TEXT`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE IF EXISTS access_card_services DROP COLUMN IF EXISTS category`
    );
  }
}
