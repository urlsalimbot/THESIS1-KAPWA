import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropCaseTrackerLog0000000000023 implements MigrationInterface {
  name = 'DropCaseTrackerLog0000000000023';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS case_tracker_log CASCADE`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS case_tracker_log (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        daily_seq_num INTEGER NOT NULL,
        transaction_date DATE NOT NULL,
        tracker_id TEXT UNIQUE,
        surname TEXT,
        first_name TEXT,
        middle_name TEXT,
        gender TEXT,
        age_range TEXT,
        client_category TEXT,
        barangay TEXT,
        intervention_remarks TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (transaction_date, daily_seq_num)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tracker_date ON case_tracker_log(transaction_date)`);
  }
}
