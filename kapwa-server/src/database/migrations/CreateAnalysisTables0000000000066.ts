import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAnalysisTables0000000000066 implements MigrationInterface {
  name = 'CreateAnalysisTables0000000000066';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS analysis_runs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        model VARCHAR NOT NULL DEFAULT 'household_clustering',
        status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','failed')),
        params JSONB,
        metrics JSONB,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_by UUID REFERENCES users(id),
        error TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS analysis_run_clusters (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        run_id UUID NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
        cluster_index INT NOT NULL,
        size INT NOT NULL,
        centroid JSONB,
        profile JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS analysis_run_members (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        run_id UUID NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
        household_id UUID NOT NULL REFERENCES households(id),
        cluster_index INT NOT NULL,
        distance DECIMAL(12,6),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_run_member_unique ON analysis_run_members(run_id, household_id);
      CREATE INDEX IF NOT EXISTS idx_run_member_cluster ON analysis_run_members(run_id, cluster_index);
      CREATE INDEX IF NOT EXISTS idx_run_cluster_run ON analysis_run_clusters(run_id, cluster_index);
      CREATE INDEX IF NOT EXISTS idx_runs_created ON analysis_runs(created_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS analysis_run_members`);
    await queryRunner.query(`DROP TABLE IF EXISTS analysis_run_clusters`);
    await queryRunner.query(`DROP TABLE IF EXISTS analysis_runs`);
  }
}
