import { MigrationInterface, QueryRunner } from 'typeorm';

export class InterventionFields2026062200002 implements MigrationInterface {
  name = 'InterventionFields2026062200002';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Enable btree_gist extension (idempotent)
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);

    // 2. Add household_id column to interventions (denormalized for exclusion constraint)
    await queryRunner.query(`ALTER TABLE IF EXISTS interventions ADD COLUMN IF NOT EXISTS household_id UUID`);

    // 3. Backfill household_id via JOIN through cases → beneficiaries → households
    //    (guarded: the legacy interventions table no longer exists in fresh schemas)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.interventions') IS NOT NULL THEN
          UPDATE interventions i
          SET household_id = (
            SELECT h.id FROM households h
            JOIN beneficiaries b ON b.id = h.primary_beneficiary_id
            JOIN cases c ON c.beneficiary_id = b.id
            WHERE c.id = i.case_id
            LIMIT 1
          );
        END IF;
      END $$;
    `);

    // 4. Create signature_status enum type
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."intervention_signature_status_enum" AS ENUM('signatures_pending', 'signatures_collected');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // 5. Add client signature URL column
    await queryRunner.query(`ALTER TABLE IF EXISTS interventions ADD COLUMN IF NOT EXISTS client_signature_url VARCHAR`);

    // 6. Add client receipt URL column
    await queryRunner.query(`ALTER TABLE IF EXISTS interventions ADD COLUMN IF NOT EXISTS client_receipt_url VARCHAR`);

    // 7. Add signature_status column with default
    await queryRunner.query(`ALTER TABLE IF EXISTS interventions ADD COLUMN IF NOT EXISTS signature_status "public"."intervention_signature_status_enum" DEFAULT 'signatures_collected'`);

    // 8. Add exclusion constraint for duplicate detection (defense-in-depth)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'no_duplicate_intervention_30d') THEN
          ALTER TABLE IF EXISTS interventions ADD CONSTRAINT no_duplicate_intervention_30d
            EXCLUDE USING gist (
              household_id WITH =,
              intervention_type WITH =,
              daterange(service_date, (service_date + interval '30 days')::date) WITH &&
            );
        END IF;
      END $$;
    `);


    // 9. Add tracker_id column to case_tracker_log (shared with Plan 3)
    await queryRunner.query(`ALTER TABLE IF EXISTS case_tracker_log ADD COLUMN IF NOT EXISTS tracker_id VARCHAR UNIQUE`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE IF EXISTS interventions DROP CONSTRAINT IF EXISTS no_duplicate_intervention_30d`);
    await queryRunner.query(`ALTER TABLE IF EXISTS interventions DROP COLUMN IF EXISTS signature_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."intervention_signature_status_enum"`);
    await queryRunner.query(`ALTER TABLE IF EXISTS interventions DROP COLUMN IF EXISTS client_receipt_url`);
    await queryRunner.query(`ALTER TABLE IF EXISTS interventions DROP COLUMN IF EXISTS client_signature_url`);
    await queryRunner.query(`ALTER TABLE IF EXISTS interventions DROP COLUMN IF EXISTS household_id`);
    await queryRunner.query(`ALTER TABLE IF EXISTS case_tracker_log DROP COLUMN IF EXISTS tracker_id`);
  }
}
