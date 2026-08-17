import { MigrationInterface, QueryRunner } from 'typeorm';

export class DuplicateDetectionEnhancements2026073000004 implements MigrationInterface {
  name = 'DuplicateDetectionEnhancements2026073000004';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_persons_name_trgm ON persons USING gin (surname gin_trgm_ops, first_name gin_trgm_ops)`);
    await queryRunner.query(`ALTER TABLE IF EXISTS persons ADD COLUMN IF NOT EXISTS merged_into_id UUID REFERENCES persons(id)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_persons_name_trgm`);
    await queryRunner.query(`ALTER TABLE IF EXISTS persons DROP COLUMN IF EXISTS merged_into_id`);
  }
}
