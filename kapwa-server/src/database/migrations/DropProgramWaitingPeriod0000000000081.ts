import { MigrationInterface, QueryRunner } from 'typeorm';

// waiting_period_days is removed from the schema — the processing-time norms
// belong to the (Phase C) statutory-alerts/processing-time layer, not to the
// program catalogue. Mirrored by an idempotent statement in migrate.ts.
export class DropProgramWaitingPeriod0000000000081 implements MigrationInterface {
  name = 'DropProgramWaitingPeriod0000000000081';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE programs DROP COLUMN IF EXISTS waiting_period_days`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE programs ADD COLUMN IF NOT EXISTS waiting_period_days INTEGER`);
  }
}