import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Household } from './household.entity';

@Entity('family_members')
export class FamilyMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'household_id', nullable: true })
  householdId?: string;

  @Column({ name: 'full_name' })
  fullName!: string;

  @Column({ name: 'relationship' })
  relationship!: string;

  @Column({ name: 'age', nullable: true })
  age?: number;

  @Column({ name: 'occupation', nullable: true })
  occupation?: string;

  @Column({ name: 'income', type: 'decimal', precision: 12, scale: 2, nullable: true })
  income?: number;

  @Column({ name: 'status', nullable: true })
  status?: string;

  @Column({ name: 'is_primary', default: false })
  isPrimary!: boolean;

  @ManyToOne(() => Household, h => h.members)
  @JoinColumn({ name: 'household_id' })
  household?: Household;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
