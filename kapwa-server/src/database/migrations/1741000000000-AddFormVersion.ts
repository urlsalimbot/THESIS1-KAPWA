import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFormVersion1741000000000 implements MigrationInterface {
name = 'AddFormVersion1741000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE programs ADD COLUMN IF NOT EXISTS form_version INTEGER DEFAULT 1`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE programs DROP COLUMN IF EXISTS form_version`);
  }
}
