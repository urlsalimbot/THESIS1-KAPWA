import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Person } from './person.entity.js';
import type { Household } from './household.entity.js';
import { BaseEntity } from '../common/base.entity.js';

@Entity('household_memberships')
export class HouseholdMembership extends BaseEntity {

  @Column({ name: 'person_id' })
  personId!: string;

  @Column({ name: 'household_id', nullable: true })
  householdId?: string;

  @Column()
  relationship!: string;

  @Column({ name: 'is_primary', default: false })
  isPrimary!: boolean;

  @Column({ nullable: true })
  status?: string;

  // Why a member was marked inactive (moved out, deceased, …). Null while the
  // member is active. An inactive member is kept for history but drops out of
  // the household count and the intake match roster.
  @Column({ name: 'status_reason', type: 'text', nullable: true })
  statusReason?: string | null;

  @ManyToOne(() => Person, { nullable: false })
  @JoinColumn({ name: 'person_id' })
  person?: Person;

  @ManyToOne('Household', 'members')
  @JoinColumn({ name: 'household_id' })
  household?: Household;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
