import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export interface ApprovalStep {
  stepName: string;
  approverRole: string;
  slaDays: number;
  order: number;
}

@Entity('programs')
export class Program extends BaseEntity {

  @Column()
  name!: string;

  @Column({ nullable: true })
  category?: string;

  @Column({ nullable: true })
  waitingPeriodDays?: number;

  @Column({ type: 'jsonb', nullable: true })
  requiredDocuments?: string[];

  @Column('text', { name: 'fund_sources', array: true, nullable: true })
  fundSources?: string[];

  @Column({ type: 'jsonb', name: 'approval_workflow', nullable: true })
  approvalWorkflow?: ApprovalStep[];       // WAS: string[] (text[])

  @Column({ type: 'jsonb', nullable: true })
  formTemplate?: Record<string, any>;

  @Column({ nullable: true, name: 'legal_basis' })
  legalBasis?: string;                     // NEW

  @Column({ name: 'form_version', default: 1 })
  formVersion!: number;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
