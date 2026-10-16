import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `document_vault.irf_id` / `announcement_id`: the chain was missing columns the
 * application maps (filing.entity.ts) — they existed only in the fresh-boot
 * bootstrap, so an installation upgraded through the migration chain would fail
 * on every filing query. Found by scripts/schema-parity.sh.
 *
 * The other direction of drift (bootstrap-only schema) is the usual risk; this
 * is the rarer one, and the parity check catches both.
 */
export class DocumentVaultLinkColumns0000000000100 implements MigrationInterface {
  name = 'DocumentVaultLinkColumns0000000000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE IF EXISTS document_vault ADD COLUMN IF NOT EXISTS irf_id UUID`);
    await queryRunner.query(`ALTER TABLE IF EXISTS document_vault ADD COLUMN IF NOT EXISTS announcement_id UUID`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_doc_irf ON document_vault(irf_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_doc_announcement ON document_vault(announcement_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The columns are part of the application's mapping; dropping them on
    // revert would break filing queries, so only the indexes are removed.
    await queryRunner.query(`DROP INDEX IF EXISTS idx_doc_irf`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_doc_announcement`);
  }
}
