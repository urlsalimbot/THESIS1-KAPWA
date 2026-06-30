import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCaseHistory1743000000000 implements MigrationInterface {
name = 'AddCaseHistory1743000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."case_history_from_status_enum" AS ENUM('pending_assessment', 'in_review', 'approved', 'disbursed', 'closed')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."case_history_to_status_enum" AS ENUM('pending_assessment', 'in_review', 'approved', 'disbursed', 'closed')
    `);
    await queryRunner.query(`
      CREATE TABLE "case_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "case_id" character varying NOT NULL,
        "from_status" "public"."case_history_from_status_enum",
        "to_status" "public"."case_history_to_status_enum" NOT NULL,
        "changed_by_role" character varying,
        "changed_by_id" character varying,
        "remarks" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_case_history" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_case_history_case_id" ON "case_history" ("case_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_case_history_case_id"`);
    await queryRunner.query(`DROP TABLE "case_history"`);
    await queryRunner.query(`DROP TYPE "public"."case_history_to_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."case_history_from_status_enum"`);
  }
}
