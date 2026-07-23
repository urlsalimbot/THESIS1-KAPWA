import { MigrationInterface, QueryRunner } from 'typeorm';

export class AccessCardCategory1740000000003 implements MigrationInterface {
  name = 'AccessCardCategory1740000000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE access_card_services ADD COLUMN category TEXT`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE access_card_services DROP COLUMN category`
    );
  }
}
