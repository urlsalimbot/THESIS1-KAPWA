import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Household } from './household.entity';

@Entity('beneficiaries')
export class Beneficiary {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'philsys_number', unique: true, nullable: true })
  philsysNumber?: string;

  @Column({ name: 'surname' })
  surname!: string;

  @Column({ name: 'first_name' })
  firstName!: string;

  @Column({ name: 'middle_name', nullable: true })
  middleName?: string;

  @Column({ name: 'gender', type: 'enum', enum: ['Male', 'Female'] })
  gender!: 'Male' | 'Female';

  @Column({ name: 'dob', type: 'date' })
  dob!: Date;

  @Column({ name: 'address', nullable: true })
  address?: string;

  @Column({ name: 'phone', nullable: true })
  phone?: string;

  @Column({ name: 'access_card_code', unique: true, nullable: true })
  accessCardCode?: string;

  @Column({ name: 'user_id', nullable: true })
  userId?: string;

  @Column({ name: 'consent_status', default: 'active' })
  consentStatus!: string;

  @Column({ name: 'household_id', nullable: true })
  householdId?: string;

  @ManyToOne(() => Household, { nullable: true })
  @JoinColumn({ name: 'household_id' })
  household?: Household;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
