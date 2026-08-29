import { Entity, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Expose } from 'class-transformer';
import { BaseEntity } from '../common/base.entity';
import { User } from '../auth/user.entity';
import { Case } from '../cases/case.entity';
import { Person } from '../beneficiaries/person.entity';

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

  @Column({ name: 'person_id', nullable: true })
  personId?: string;

  @ManyToOne(() => Person, { eager: true, nullable: true })
  @JoinColumn({ name: 'person_id' })
  person?: Person;

  // --- Legacy flattened embedded fields, now assembled from the joined Person ---
  @Expose() get surname(): string { return this.person?.surname ?? ''; }
  @Expose() get firstName(): string { return this.person?.firstName ?? ''; }
  @Expose() get middleName(): string | undefined { return this.person?.middleName; }
  @Expose() get extension(): string | undefined { return this.person?.extension; }
  @Expose() get gender(): string { return this.person?.gender ?? ''; }
  @Expose() get dob(): string {
    return this.person?.dob ? new Date(this.person.dob).toISOString().split('T')[0] : '';
  }
  @Expose() get address(): Record<string, any> | undefined {
    return this.person?.currentAddress;
  }
  @Expose() get phone(): string | undefined { return this.person?.phone; }

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
