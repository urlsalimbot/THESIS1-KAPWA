import { Entity, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { FamilyMember } from './family-member.entity';
import { BaseEntity } from '../common/base.entity';

@Entity('households')
export class Household extends BaseEntity {

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
