import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('analysis_runs')
export class AnalysisRun extends BaseEntity {
  @Column({ default: 'household_clustering' })
  model!: string;

  @Column({ type: 'varchar', length: 20, default: 'completed' })
  status!: 'completed' | 'failed';

  @Column({ type: 'jsonb', nullable: true })
  params?: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  metrics?: Record<string, unknown>;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt?: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ type: 'text', nullable: true })
  error?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
