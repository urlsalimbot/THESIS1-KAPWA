import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { BaseEntity } from '../common/base.entity';

export enum CaseStatus {
  PENDING = 'pending_assessment',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  DISBURSED = 'disbursed',
  CLOSED = 'closed'
}

@Entity('cases')
export class Case extends BaseEntity {

  @Column({ name: 'control_no', unique: true })
  controlNo!: string;

  @Column({ name: 'beneficiary_id', nullable: true })
  beneficiaryId?: string;

  @Column('text', { name: 'service_requested', array: true, nullable: true })
  serviceRequested?: string[];

  @Column({ name: 'requirements_checklist', type: 'jsonb', nullable: true })
  requirementsChecklist?: Record<string, boolean>;

  @Column({ name: 'status', type: 'enum', enum: CaseStatus, default: CaseStatus.PENDING })
  status!: CaseStatus;

  @Column({ name: 'certificate_url', nullable: true })
  certificateUrl?: string;

  @Column({ name: 'petty_cash_voucher_url', nullable: true })
  pettyCashVoucherUrl?: string;

  @Column({ name: 'approved_by_signature', nullable: true, type: 'text' })
  approvedBySignature?: string;

  @Column({ name: 'approved_by_role', nullable: true })
  approvedByRole?: string;

  @Column({ name: 'assigned_worker_id', nullable: true })
  assignedWorkerId?: string;

  @ManyToOne(() => Beneficiary, { nullable: true })
  @JoinColumn({ name: 'beneficiary_id' })
  beneficiary?: Beneficiary;

  @Column({ name: 'problems_presented', nullable: true, type: 'text' })
  problemsPresented?: string;

  @Column({ name: 'social_worker_assessment', nullable: true, type: 'text' })
  socialWorkerAssessment?: string;

  @Column({ name: 'client_category', nullable: true })
  clientCategory?: string;

  @Column('text', { name: 'nature_of_service', array: true, nullable: true })
  natureOfService?: string[];

  @Column({ name: 'financial_subsidies', type: 'jsonb', nullable: true })
  financialSubsidies?: Record<string, unknown>;

  @Column({ name: 'amount_assistance', type: 'decimal', precision: 12, scale: 2, nullable: true })
  amountAssistance?: number;

  @Column({ name: 'mode_financial_assistance', nullable: true })
  modeFinancialAssistance?: string;

  @Column({ name: 'source_of_fund', nullable: true })
  sourceOfFund?: string;

  @Column({ name: 'legislator_specify', nullable: true })
  legislatorSpecify?: string;

  @Column({ name: 'other_assistance', type: 'jsonb', nullable: true })
  otherAssistance?: Record<string, unknown>;

  @Column({ name: 'interviewed_by', nullable: true })
  interviewedBy?: string;

  @Column({ name: 'client_signature', nullable: true, type: 'text' })
  clientSignature?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
