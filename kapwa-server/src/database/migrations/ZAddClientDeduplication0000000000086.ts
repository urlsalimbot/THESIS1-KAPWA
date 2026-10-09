import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Client deduplication subsystem (spec 2026-10-09).
 *
 * Four tables:
 *   client_import_operations — one import run (source, column map, status)
 *   client_import_rows       — one parsed file row with its final status
 *   client_import_matches    — candidate matches (person / import row / household)
 *   beneficiary_remarks      — append-only remark history per beneficiary
 *
 * Status/kind/target values are stored as text to avoid enum migration
 * friction; the app validates them (the repo's case_history precedent).
 */
export class ZAddClientDeduplication0000000000086 implements MigrationInterface {
  name = 'ZAddClientDeduplication0000000000086';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS client_import_operations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
      source TEXT NOT NULL,
      status VARCHAR NOT NULL DEFAULT 'defined',
      column_map JSONB NOT NULL DEFAULT '{}',
      match_threshold NUMERIC(4,3) NOT NULL DEFAULT 0.75,
      created_by UUID,
      accomplisher UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finalized_at TIMESTAMPTZ,
      output_file TEXT
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS client_import_rows (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
      operation_id UUID NOT NULL REFERENCES client_import_operations(id) ON DELETE CASCADE,
      row_index INTEGER NOT NULL,
      last_name TEXT,
      first_name TEXT,
      middle_name TEXT,
      dob DATE,
      barangay TEXT,
      original_remarks TEXT,
      extra_data JSONB NOT NULL DEFAULT '{}',
      status VARCHAR NOT NULL DEFAULT 'pending',
      score NUMERIC(5,4),
      remarks TEXT,
      matched_person_id UUID,
      beneficiary_id UUID,
      decided_by UUID,
      decided_at TIMESTAMPTZ
    )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_client_import_rows_operation ON client_import_rows (operation_id)`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS client_import_matches (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
      row_id UUID NOT NULL REFERENCES client_import_rows(id) ON DELETE CASCADE,
      target_type VARCHAR NOT NULL,
      target_person_id UUID,
      target_import_row_id UUID,
      target_household_id UUID,
      score NUMERIC(5,4) NOT NULL,
      signals JSONB NOT NULL DEFAULT '{}',
      status VARCHAR NOT NULL DEFAULT 'pending',
      remark TEXT,
      decided_by UUID,
      decided_at TIMESTAMPTZ
    )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_client_import_matches_row ON client_import_matches (row_id)`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS beneficiary_remarks (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
      beneficiary_id UUID NOT NULL,
      operation_id UUID,
      kind VARCHAR NOT NULL,
      remark TEXT NOT NULL,
      source TEXT,
      authored_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_beneficiary_remarks_ben ON beneficiary_remarks (beneficiary_id, created_at DESC)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS beneficiary_remarks`);
    await queryRunner.query(`DROP TABLE IF EXISTS client_import_matches`);
    await queryRunner.query(`DROP TABLE IF EXISTS client_import_rows`);
    await queryRunner.query(`DROP TABLE IF EXISTS client_import_operations`);
  }
}