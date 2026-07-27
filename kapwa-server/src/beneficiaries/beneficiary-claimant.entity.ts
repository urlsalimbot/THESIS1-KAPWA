import { Entity, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Person } from './person.entity';
import { BaseEntity } from '../common/base.entity';

@Entity('beneficiary_claimants')
export class BeneficiaryClaimant extends BaseEntity {

  @Column({ name: 'beneficiary_id' })
  beneficiaryId!: string;

  @Column({ name: 'claimant_id' })
  claimantId!: string;

  @Column()
  relationship!: string;

  @Column({ name: 'authorization_url', nullable: true })
  authorizationUrl?: string;

  @Column({ name: 'calendar_year', nullable: true })
  calendarYear?: number;

  @Column({ name: 'is_primary', default: true })
  isPrimary!: boolean;

  @ManyToOne(() => Person, { nullable: false })
  @JoinColumn({ name: 'beneficiary_id' })
  beneficiary?: Person;

  @ManyToOne(() => Person, { nullable: false })
  @JoinColumn({ name: 'claimant_id' })
  claimant?: Person;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
