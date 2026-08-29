import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Case } from './case.entity';

@Entity('case_assistances')
export class CaseAssistance extends BaseEntity {
  @Column({ name: 'case_id' })
  caseId!: string;

  @ManyToOne(() => Case, c => c.assistances, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'case_id' })
  case!: Case;

  @Column({ name: 'assistance_type' })
  assistanceType!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  amount?: number;

  @Column({ nullable: true })
  mode?: string;

  @Column({ name: 'source_of_fund', nullable: true })
  sourceOfFund?: string;

  @Column({ name: 'legislator_specify', nullable: true })
  legislatorSpecify?: string;

  @Column({ type: 'jsonb', nullable: true })
  details?: Record<string, unknown>;

  @Column({ name: 'approved_by_signature', nullable: true, type: 'text' })
  approvedBySignature?: string;

  @Column({ name: 'approved_by_role', nullable: true })
  approvedByRole?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}