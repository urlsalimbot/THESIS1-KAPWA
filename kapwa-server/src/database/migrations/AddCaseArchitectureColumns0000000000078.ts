import { MigrationInterface, QueryRunner } from 'typeorm';

// Case-architecture columns: court docket (legal categories), the four
// category-step field groups (CICL discernment, VAWC protection order,
// Solo Parent ID, Adoption & Foster Care), the explicit no-enrollments
// decision, and the terminal `aftercare` status (DSWD AO 10 s. 2007 §VIII.G).
// Mirrored by idempotent statements in src/database/migrate.ts.
export class AddCaseArchitectureColumns0000000000078 implements MigrationInterface {
  name = 'AddCaseArchitectureColumns0000000000078';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS court_docket_number TEXT`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS discernment_assessed_at DATE`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS discernment_result TEXT`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS discernment_notes TEXT`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS protection_order_type TEXT`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS protection_order_issued_at DATE`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS protection_order_issued_by TEXT`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS protection_order_notes TEXT`);
    await queryRunner.query(
      `ALTER TABLE cases ADD COLUMN IF NOT EXISTS enrollments_not_needed BOOLEAN NOT NULL DEFAULT FALSE`,
    );
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS solo_parent_id_issued_date DATE`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS solo_parent_id_number TEXT`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS solo_parent_notes TEXT`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS adoption_dvc_date DATE`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS adoption_case_study_date DATE`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS adoption_cdclaa_received BOOLEAN`);
    await queryRunner.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS adoption_notes TEXT`);

    // Terminal aftercare status. The constraint is rebuilt (not the enum
    // path): cases.status is a TEXT column guarded by `cases_status_check`.
    await queryRunner.query(`ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_status_check`);
    await queryRunner.query(
      `ALTER TABLE cases ADD CONSTRAINT cases_status_check CHECK (status IN ('enrolled','assessed','in_review','active','transitioning','closed','aftercare'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_status_check`);
    await queryRunner.query(
      `ALTER TABLE cases ADD CONSTRAINT cases_status_check CHECK (status IN ('enrolled','assessed','in_review','active','transitioning','closed'))`,
    );
    for (const col of [
      'adoption_notes',
      'adoption_cdclaa_received',
      'adoption_case_study_date',
      'adoption_dvc_date',
      'solo_parent_notes',
      'solo_parent_id_number',
      'solo_parent_id_issued_date',
      'enrollments_not_needed',
      'protection_order_notes',
      'protection_order_issued_by',
      'protection_order_issued_at',
      'protection_order_type',
      'discernment_notes',
      'discernment_result',
      'discernment_assessed_at',
      'court_docket_number',
    ]) {
      await queryRunner.query(`ALTER TABLE cases DROP COLUMN IF EXISTS ${col}`);
    }
  }
}