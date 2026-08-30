import { MigrationInterface, QueryRunner } from 'typeorm';

export class ZAddFamilyMemberTimestamps0000000000019 implements MigrationInterface {
  name = 'ZAddFamilyMemberTimestamps0000000000019';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE IF EXISTS family_members ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
    await queryRunner.query(`ALTER TABLE IF EXISTS family_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE IF EXISTS family_members DROP COLUMN IF EXISTS created_at`);
    await queryRunner.query(`ALTER TABLE IF EXISTS family_members DROP COLUMN IF EXISTS updated_at`);
  }
}
