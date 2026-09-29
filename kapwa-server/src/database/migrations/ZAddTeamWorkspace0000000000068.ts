import { MigrationInterface, QueryRunner } from 'typeorm';

// Team workspace: staff day blocks, internal office events, whereabouts status.
export class ZAddTeamWorkspace0000000000068 implements MigrationInterface {
  name = 'ZAddTeamWorkspace0000000000068';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS team_schedule_blocks (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        user_id uuid NOT NULL REFERENCES users(id),
        block_date date NOT NULL,
        block_type varchar(32) NOT NULL,
        start_time time NULL,
        end_time time NULL,
        note text NULL,
        created_by uuid NULL REFERENCES users(id),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_team_blocks_user_date ON team_schedule_blocks (user_id, block_date)`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS office_events (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        title text NOT NULL,
        starts_at timestamptz NOT NULL,
        ends_at timestamptz NOT NULL,
        repeat_rule jsonb NULL,
        visible_to varchar(32) NOT NULL DEFAULT 'staff',
        location text NULL,
        owner_id uuid NOT NULL REFERENCES users(id),
        notes text NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_office_events_start ON office_events (starts_at)`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS team_status (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        user_id uuid NOT NULL UNIQUE REFERENCES users(id),
        status varchar(32) NOT NULL,
        note text NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS team_status`);
    await queryRunner.query(`DROP TABLE IF EXISTS office_events`);
    await queryRunner.query(`DROP TABLE IF EXISTS team_schedule_blocks`);
  }
}