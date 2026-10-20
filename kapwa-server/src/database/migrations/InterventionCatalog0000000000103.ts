import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Custom services in the intervention catalog.
 *
 * The built-in vocabulary stays in code (mirrored to the canonical JSON and the
 * client constants), so the catalog parity checks keep describing what ships.
 * This table holds the additions an admin makes in the UI: a code derived from
 * the label, the label itself, whether the service carries money, and whether it
 * is still offered for new work. Old interventions keep their code forever, so
 * retiring an entry deactivates it instead of deleting it.
 */
export class InterventionCatalog0000000000103 implements MigrationInterface {
  name = 'InterventionCatalog0000000000103';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS intervention_catalog (
      code TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      is_financial BOOLEAN NOT NULL DEFAULT false,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS intervention_catalog`);
  }
}
