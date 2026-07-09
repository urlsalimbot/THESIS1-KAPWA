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

  @Column({ type: 'tsvector', name: 'search_vector', select: false, nullable: true })
  searchVector?: string;

  @Column({ name: 'user_id', nullable: true })
  userId?: string;

  @Column({ name: 'consent_status', default: 'active' })
  consentStatus!: string;

  @Column({ name: 'household_id', nullable: true })
  householdId?: string;

  @Column({ name: 'category', nullable: true })
  category?: string;

  @Column({ name: 'place_of_birth', nullable: true })
  placeOfBirth?: string;

  @Column({ name: 'civil_status', nullable: true })
  civilStatus?: string;

  @Column({ name: 'current_address', type: 'jsonb', nullable: true })
  currentAddress?: Record<string, string>;

  @Column({ name: 'provincial_address', type: 'jsonb', nullable: true })
  provincialAddress?: Record<string, string>;

  @Column({ name: 'philhealth_number', nullable: true })
  philhealthNumber?: string;

  @Column({ name: 'occupation', nullable: true })
  occupation?: string;

  @Column({ name: 'estimated_monthly_income', type: 'decimal', precision: 12, scale: 2, nullable: true })
  estimatedMonthlyIncome?: number;

  @Column({ name: 'age', nullable: true })
  age?: number;

  @ManyToOne(() => Household, { nullable: true })
  @JoinColumn({ name: 'household_id' })
  household?: Household;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
