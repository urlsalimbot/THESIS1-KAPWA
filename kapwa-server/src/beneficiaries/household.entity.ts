import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { FamilyMember } from './family-member.entity';

@Entity('households')
export class Household {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'primary_beneficiary_id', nullable: true })
  primaryBeneficiaryId?: string;

  @Column({ name: 'barangay', nullable: true })
  barangay?: string;

  @Column({ name: 'estimated_income', type: 'decimal', precision: 12, scale: 2, nullable: true })
  estimatedIncome?: number;

  @Column({ name: 'verified_by', nullable: true })
  verifiedBy?: string;

  @CreateDateColumn({ name: 'verified_at' })
  verifiedAt!: Date;

  @OneToMany(() => FamilyMember, fm => fm.household)
  members!: FamilyMember[];
}
