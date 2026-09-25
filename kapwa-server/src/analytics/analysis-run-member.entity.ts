import { Entity, Column, CreateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('analysis_run_members')
export class AnalysisRunMember extends BaseEntity {
  @Column({ name: 'run_id' })
  runId!: string;

  @Column({ name: 'household_id' })
  householdId!: string;

  @Column({ name: 'cluster_index', type: 'int' })
  clusterIndex!: number;

  @Column({ type: 'decimal', precision: 12, scale: 6, nullable: true })
  distance?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
