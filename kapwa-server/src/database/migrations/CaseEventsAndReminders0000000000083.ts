import { MigrationInterface, QueryRunner } from 'typeorm';

// Case events (court hearings + scheduled home visits), the reminder-dedupe
// ledger, reminder lead-time settings, and the team-schedule sync columns.
// Mirrored by idempotent statements in migrate.ts.
export class CaseEventsAndReminders0000000000083 implements MigrationInterface {
  name = 'CaseEventsAndReminders0000000000083';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE case_events (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
      case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      event_type VARCHAR(32) NOT NULL,
      attended BOOLEAN,
      title TEXT,
      venue TEXT,
      event_date DATE NOT NULL,
      start_time TIME,
      end_time TIME,
      notes TEXT,
      status VARCHAR(32) NOT NULL DEFAULT 'planned',
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`);
    await queryRunner.query(`CREATE INDEX idx_case_events_case ON case_events(case_id)`);
    await queryRunner.query(`CREATE INDEX idx_case_events_date ON case_events(event_date)`);
    await queryRunner.query(`CREATE INDEX idx_case_events_status_date ON case_events(status, event_date)`);

    await queryRunner.query(`ALTER TABLE team_schedule_blocks ADD COLUMN source VARCHAR(32) NOT NULL DEFAULT 'manual'`);
    await queryRunner.query(`ALTER TABLE team_schedule_blocks ADD COLUMN source_ref UUID`);
    await queryRunner.query(`ALTER TABLE team_schedule_blocks ADD CONSTRAINT fk_blocks_source_ref FOREIGN KEY (source_ref) REFERENCES case_events(id) ON DELETE SET NULL`);
    await queryRunner.query(`CREATE INDEX idx_blocks_source_ref ON team_schedule_blocks(source_ref)`);

    await queryRunner.query(`CREATE TABLE case_event_reminders (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
      event_id UUID NOT NULL REFERENCES case_events(id) ON DELETE CASCADE,
      offset_minutes INTEGER NOT NULL,
      channel VARCHAR(16) NOT NULL,
      sent_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_case_event_reminders ON case_event_reminders(event_id, offset_minutes, channel)`);

    await queryRunner.query(`CREATE TABLE reminder_settings (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
      scope VARCHAR(16) NOT NULL,
      user_id UUID REFERENCES users(id),
      event_type VARCHAR(32) NOT NULL,
      offsets JSONB NOT NULL,
      updated_by UUID REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      CHECK (scope IN ('system','worker')),
      CHECK ((scope = 'system' AND user_id IS NULL) OR (scope = 'worker' AND user_id IS NOT NULL))
    )`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_reminder_system_type ON reminder_settings(event_type) WHERE scope = 'system'`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_reminder_worker_type ON reminder_settings(user_id, event_type) WHERE scope = 'worker'`);

    await queryRunner.query(`INSERT INTO reminder_settings (id, scope, event_type, offsets) VALUES
      (uuid_generate_v7(), 'system', 'court_hearing', '[4320,1440,180]'),
      (uuid_generate_v7(), 'system', 'home_visit', '[1440,180]')`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS reminder_settings`);
    await queryRunner.query(`DROP TABLE IF EXISTS case_event_reminders`);
    await queryRunner.query(`ALTER TABLE team_schedule_blocks DROP COLUMN IF EXISTS source`);
    await queryRunner.query(`ALTER TABLE team_schedule_blocks DROP COLUMN IF EXISTS source_ref`);
    await queryRunner.query(`DROP TABLE IF EXISTS case_events`);
  }
}