import { MigrationInterface, QueryRunner } from 'typeorm';

// The `mayor` and `auditor` roles are sunset: the role values are gone from the
// enum, no @Roles list accepts them, and no seed account carries them. Their
// RLS policies (read-only SELECT for those roles via app.current_role) had to
// go too — a policy that grants access based on a role that no longer exists is
// dead weight that a future reader would assume still serves a purpose.
//
// Idempotent: DROP POLICY IF EXISTS matches nothing on a second run. Reversible:
// down() recreates exactly the two policies this migration removed.
export class SunsetRolePolicies0000000000068 implements MigrationInterface {
  name = 'SunsetRolePolicies0000000000068';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS ben_mayor_auditor ON beneficiaries`,
    );
    await queryRunner.query(
      `DROP POLICY IF EXISTS cases_mayor_auditor ON cases`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE POLICY ben_mayor_auditor ON beneficiaries FOR SELECT USING (
        current_setting('app.current_role') IN ('mayor', 'auditor')
      )`,
    );
    await queryRunner.query(
      `CREATE POLICY cases_mayor_auditor ON cases FOR SELECT USING (
        current_setting('app.current_role') IN ('mayor', 'auditor')
      )`,
    );
  }
}