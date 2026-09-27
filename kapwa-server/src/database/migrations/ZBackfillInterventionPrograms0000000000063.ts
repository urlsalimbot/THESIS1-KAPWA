import { MigrationInterface, QueryRunner } from 'typeorm';

// One-time data backfill: link historical interventions that have no program
// to a seeded program by name/category match (exact first, then ILIKE), so the
// program-driven summary report counts historical delivery. Only fills NULLs —
// re-running is a no-op. Fresh boots mark this applied and have no historical
// interventions to backfill, which is correct.
export class ZBackfillInterventionPrograms0000000000063 implements MigrationInterface {
  name = 'ZBackfillInterventionPrograms0000000000063';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE case_interventions ci
      SET program_id = p.id
      FROM programs p
      WHERE ci.program_id IS NULL
        AND (
              LOWER(ci.service_name) = LOWER(p.name)
           OR LOWER(ci.category) = LOWER(p.name)
           OR LOWER(ci.service_name) LIKE '%' || LOWER(p.name) || '%'
           OR LOWER(p.name) LIKE LOWER(ci.service_name) || '%'
        )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Backfill is metadata linkage only; no column is removed by reversion.
    // Left empty so down() never destroys program_id values set later.
  }
}