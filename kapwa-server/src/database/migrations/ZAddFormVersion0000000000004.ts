import { MigrationInterface, QueryRunner } from 'typeorm';

export class ZAddFormVersion0000000000004 implements MigrationInterface {
name = 'ZAddFormVersion0000000000004';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE IF EXISTS programs ADD COLUMN IF NOT EXISTS form_version INTEGER DEFAULT 1`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE IF EXISTS programs DROP COLUMN IF EXISTS form_version`);
  }
}
