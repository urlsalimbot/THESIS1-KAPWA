import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Case } from './case.entity';

@Entity('case_referrals')
export class CaseReferral extends BaseEntity {
  @Column({ name: 'case_id' })
  caseId!: string;

  @ManyToOne(() => Case, c => c.referralRows, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'case_id' })
  case!: Case;

  @Column({ nullable: true })
  agency?: string;

  @Column({ nullable: true })
  status?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}