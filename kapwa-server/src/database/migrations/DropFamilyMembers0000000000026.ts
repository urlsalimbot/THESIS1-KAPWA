import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropFamilyMembers0000000000026 implements MigrationInterface {
  name = 'DropFamilyMembers0000000000026';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS family_members CASCADE`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS family_members (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        household_id UUID REFERENCES households(id),
        full_name TEXT NOT NULL,
        relationship TEXT NOT NULL,
        age INTEGER,
        status_income TEXT,
        is_primary BOOLEAN DEFAULT FALSE,
        income DECIMAL(12,2),
        status TEXT,
        occupation TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
  }
}
