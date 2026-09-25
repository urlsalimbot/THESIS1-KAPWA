import { Entity, Column, CreateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('analysis_run_clusters')
export class AnalysisRunCluster extends BaseEntity {
  @Column({ name: 'run_id', type: 'uuid' })
  runId!: string;

  @Column({ name: 'cluster_index', type: 'int' })
  clusterIndex!: number;

  @Column({ type: 'int' })
  size!: number;

  @Column({ type: 'jsonb', nullable: true })
  centroid?: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  profile?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
