import { MigrationInterface, QueryRunner } from 'typeorm';

export class KilosUnladPhaseAlignment2026072600001 implements MigrationInterface {
  name = 'KilosUnladPhaseAlignment2026072600001';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add new assessment columns
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS frva_score NUMERIC(5,2)`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS swdi_score NUMERIC(5,2)`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS family_dialogue_notes TEXT`);

    // 2. Add transition/closure columns
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS self_reliance_level INT`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS sustainability_plan TEXT`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS transition_date DATE`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS closure_outcome VARCHAR`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS closure_date DATE`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS follow_up_visits JSONB`);

    // 3. Migrate existing enum values
    //    - 'pending' → 'enrolled'
    await queryRunner.query(`UPDATE cases SET status = 'enrolled' WHERE status = 'pending'`);
    //    - 'approved' → 'active'
    await queryRunner.query(`UPDATE cases SET status = 'active' WHERE status = 'approved'`);
    //    - 'disbursed' → 'transitioning'
    await queryRunner.query(`UPDATE cases SET status = 'transitioning' WHERE status = 'disbursed'`);

    // 4. Drop old enum values and add new ones (TypeORM-safe approach)
    await queryRunner.query(`ALTER TABLE cases ALTER COLUMN status TYPE VARCHAR`);
    await queryRunner.query(`ALTER TABLE cases ALTER COLUMN status SET DEFAULT 'enrolled'`);
    await queryRunner.query(`UPDATE cases SET status = 'enrolled' WHERE status NOT IN ('enrolled', 'assessed', 'in_review', 'active', 'transitioning', 'closed')`);

    // Drop and recreate enum with new values
    await queryRunner.query(`ALTER TABLE cases DROP CONSTRAINT IF EXISTS "cases_status_check"`);
    await queryRunner.query(`ALTER TABLE cases ADD CONSTRAINT "cases_status_check" CHECK (status IN ('enrolled', 'assessed', 'in_review', 'active', 'transitioning', 'closed'))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse enum changes
    await queryRunner.query(`ALTER TABLE cases DROP CONSTRAINT IF EXISTS "cases_status_check"`);
    await queryRunner.query(`ALTER TABLE cases ALTER COLUMN status TYPE VARCHAR`);
    await queryRunner.query(`UPDATE cases SET status = 'pending' WHERE status = 'enrolled'`);
    await queryRunner.query(`UPDATE cases SET status = 'approved' WHERE status = 'active'`);
    await queryRunner.query(`UPDATE cases SET status = 'disbursed' WHERE status = 'transitioning'`);
    await queryRunner.query(`ALTER TABLE cases ALTER COLUMN status SET DEFAULT 'pending'`);
    await queryRunner.query(`ALTER TABLE cases ADD CONSTRAINT "cases_status_check" CHECK (status IN ('pending', 'in_review', 'approved', 'disbursed', 'closed'))`);

    // Drop new columns
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS follow_up_visits`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS closure_date`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS closure_outcome`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS transition_date`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS sustainability_plan`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS self_reliance_level`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS family_dialogue_notes`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS swdi_score`);
    await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS frva_score`);
  }
}
