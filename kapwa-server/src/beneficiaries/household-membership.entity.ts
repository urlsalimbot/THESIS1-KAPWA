import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Person } from './person.entity';
import { Household } from './household.entity';
import { BaseEntity } from '../common/base.entity';

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

  @ManyToOne(() => Person, { nullable: false })
  @JoinColumn({ name: 'person_id' })
  person?: Person;

  @ManyToOne(() => Household, h => h.members)
  @JoinColumn({ name: 'household_id' })
  household?: Household;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
