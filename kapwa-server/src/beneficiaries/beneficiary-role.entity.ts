import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import type { Person } from './person.entity.js';
import { BaseEntity } from '../common/base.entity.js';

@Entity('beneficiary_roles')
export class BeneficiaryRole extends BaseEntity {

  @Column({ name: 'person_id' })
  personId!: string;

  @Column({ name: 'household_id', nullable: true })
  householdId?: string;

  @Column({ name: 'user_id', nullable: true })
  userId?: string;

  @Column({ name: 'consent_status', default: 'active' })
  consentStatus!: string;

  @Column({ name: 'access_card_code', unique: true, nullable: true })
  accessCardCode?: string;

  @Column({ nullable: true })
  category?: string;

  @ManyToOne('Person', { nullable: false })
  @JoinColumn({ name: 'person_id' })
  person?: Person;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
