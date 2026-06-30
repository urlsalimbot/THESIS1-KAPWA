import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFormVersionHistory1742000000000 implements MigrationInterface {
name = 'AddFormVersionHistory1742000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE form_version_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
        form_template JSONB NOT NULL,
        version INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_form_version_history_program_id ON form_version_history(program_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_form_version_history_program_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS form_version_history`);
  }
}
