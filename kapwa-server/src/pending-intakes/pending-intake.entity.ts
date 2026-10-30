import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * A claimant's completed self-registration, waiting for MSWDO staff. The
 * payload is the same beneficiary/family shape the General Intake form uses, so
 * staff can review it and continue the normal intake (match check, case
 * creation) without re-typing. It is deliberately not a person/beneficiary/
 * case row yet: nothing enters the registry until staff approve it.
 */
@Entity('pending_intakes')
export class PendingIntake extends BaseEntity {
  @Column({ type: 'text', default: 'pending' })
  status!: 'pending' | 'processed' | 'dismissed';

  @Column({ name: 'submitted_by_user_id', type: 'uuid', nullable: true })
  submittedByUserId?: string | null;

  @Column({ type: 'jsonb' })
  data!: Record<string, any>;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy?: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
