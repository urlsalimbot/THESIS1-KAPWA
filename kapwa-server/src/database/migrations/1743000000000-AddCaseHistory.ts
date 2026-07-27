import { MigrationInterface, QueryRunner } from "typeorm";

export class ZAddCaseHistory1743000000000 implements MigrationInterface {
name = 'ZAddCaseHistory1743000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."case_history_from_status_enum" AS ENUM('enrolled', 'assessed', 'in_review', 'active', 'transitioning', 'closed');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."case_history_to_status_enum" AS ENUM('enrolled', 'assessed', 'in_review', 'active', 'transitioning', 'closed');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "case_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v7(),
        "case_id" character varying NOT NULL,
        "from_status" "public"."case_history_from_status_enum",
        "to_status" "public"."case_history_to_status_enum" NOT NULL,
        "changed_by_role" character varying,
        "changed_by_id" character varying,
        "remarks" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "transition_type" character varying NOT NULL DEFAULT 'standard',
        "override_reason" character varying,
        CONSTRAINT "PK_case_history" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_case_history_case_id" ON "case_history" ("case_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_case_history_case_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "case_history"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."case_history_to_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."case_history_from_status_enum"`);
  }
}
