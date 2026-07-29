import { Entity, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { User } from '../auth/user.entity';
import { Case } from '../cases/case.entity';

export enum ReferralStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
}

@Entity({ name: 'referrals' })
export class Referral extends BaseEntity {
  @Column({ name: 'coordinator_id' })
  coordinatorId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'coordinator_id' })
  coordinator?: User;

  @Column()
  barangay!: string;

  @Column()
  surname!: string;

  @Column({ name: 'first_name' })
  firstName!: string;

  @Column({ name: 'middle_name', nullable: true })
  middleName?: string;

  @Column({ nullable: true })
  extension?: string;

  @Column()
  gender!: string;

  @Column({ type: 'date' })
  dob!: string;

  @Column({ type: 'jsonb', nullable: true })
  address?: Record<string, any>;

  @Column({ nullable: true })
  phone?: string;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'text', default: 'pending' })
  status!: ReferralStatus;

  @Column({ name: 'decline_reason', type: 'text', nullable: true })
  declineReason?: string;

  @Column({ name: 'case_id', nullable: true })
  caseId?: string;

  @ManyToOne(() => Case)
  @JoinColumn({ name: 'case_id' })
  case?: Case;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
