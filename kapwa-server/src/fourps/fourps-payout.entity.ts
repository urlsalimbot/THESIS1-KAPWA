import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export type PayoutStatus = 'scheduled' | 'completed' | 'missed' | 'cancelled';

@Entity('case_payouts')
export class CasePayout extends BaseEntity {
  @Column({ name: 'case_id' })
  caseId!: string;

  @Column({ name: 'cycle_no', nullable: true })
  cycleNo?: string;

  @Column({ name: 'scheduled_at', type: 'date' })
  scheduledAt!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  amount?: number;

  @Column({ type: 'varchar', length: 20, default: 'scheduled' })
  status!: PayoutStatus;

  @Column({ name: 'notified_at', type: 'timestamp', nullable: true })
  notifiedAt?: Date;

  @Column({ name: 'notified_by', nullable: true })
  notifiedBy?: string;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
