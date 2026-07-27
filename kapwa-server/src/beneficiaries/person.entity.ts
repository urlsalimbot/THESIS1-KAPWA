import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('persons')
export class Person extends BaseEntity {

  @Column()
  surname!: string;

  @Column({ name: 'first_name' })
  firstName!: string;

  @Column({ name: 'middle_name', nullable: true })
  middleName?: string;

  @Column({ name: 'extension', nullable: true })
  extension?: string;

  @Column({ name: 'gender', type: 'enum', enum: ['Male', 'Female'] })
  gender!: 'Male' | 'Female';

  @Column({ name: 'dob', type: 'date' })
  dob!: Date;

  @Column({ nullable: true })
  address?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ name: 'philsys_number', unique: true, nullable: true })
  philsysNumber?: string;

  @Column({ name: 'place_of_birth', nullable: true })
  placeOfBirth?: string;

  @Column({ name: 'civil_status', nullable: true })
  civilStatus?: string;

  @Column({ name: 'current_address', type: 'jsonb', nullable: true })
  currentAddress?: Record<string, string>;

  @Column({ nullable: true })
  email?: string;

  @Column({ name: 'philhealth_number', nullable: true })
  philhealthNumber?: string;

  @Column({ nullable: true })
  occupation?: string;

  @Column({ name: 'estimated_monthly_income', type: 'decimal', precision: 12, scale: 2, nullable: true })
  estimatedMonthlyIncome?: number;

  @Column({ nullable: true })
  age?: number;

  @Column({ type: 'tsvector', name: 'search_vector', select: false, nullable: true })
  searchVector?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
