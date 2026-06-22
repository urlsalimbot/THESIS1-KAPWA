import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProgramDataTypes20260622000004 implements MigrationInterface {
  name = 'ProgramDataTypes20260622000004';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add new JSONB column for approval_workflow
    await queryRunner.query(`ALTER TABLE programs ADD COLUMN approval_workflow_new jsonb`);

    // 2. Migrate existing text[] data: convert each text array element to structured JSONB
    await queryRunner.query(`
      UPDATE programs SET approval_workflow_new = (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'stepName', 'Step ' || ordinality,
              'approverRole', step,
              'slaDays', 3,
              'order', ordinality - 1
            ) ORDER BY ordinality
          ),
          '[]'::jsonb
        )
        FROM unnest(approval_workflow) WITH ORDINALITY AS step
      )
    `);

    // 3. Drop old column, rename new column
    await queryRunner.query(`ALTER TABLE programs DROP COLUMN approval_workflow`);
    await queryRunner.query(`ALTER TABLE programs RENAME COLUMN approval_workflow_new TO approval_workflow`);

    // 4. Add legal_basis column
    await queryRunner.query(`ALTER TABLE programs ADD COLUMN legal_basis character varying`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE programs DROP COLUMN legal_basis`);

    // Reverse: convert JSONB back to text[]
    await queryRunner.query(`ALTER TABLE programs ADD COLUMN approval_workflow_old text[]`);
    await queryRunner.query(`
      UPDATE programs SET approval_workflow_old = (
        SELECT array_agg(approver_role ORDER BY "order")
        FROM jsonb_to_recordset(COALESCE(approval_workflow, '[]'::jsonb))
          AS x("order" int, "approver_role" text)
      )
    `);
    await queryRunner.query(`ALTER TABLE programs DROP COLUMN approval_workflow`);
    await queryRunner.query(`ALTER TABLE programs RENAME COLUMN approval_workflow_old TO approval_workflow`);
  }
}
