import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { User } from '../auth/user.entity';
import { BaseEntity } from '../common/base.entity';

export enum CaseStatus {
  ENROLLED = 'enrolled',
  ASSESSED = 'assessed',
  IN_REVIEW = 'in_review',
  ACTIVE = 'active',
  TRANSITIONING = 'transitioning',
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

  @Column({ name: 'status', type: 'enum', enum: CaseStatus, default: CaseStatus.ENROLLED })
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

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'assigned_worker_id' })
  assignedWorker?: User;

  @Column({ name: 'assigned_worker_name', nullable: true })
  assignedWorkerName?: string;

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

  @Column({ name: 'self_reliance_plan', type: 'text', nullable: true })
  selfReliancePlan?: string;

  @Column({ name: 'referrals', type: 'jsonb', nullable: true })
  referrals?: Array<{
    agencyName: string;
    contactInfo?: string;
    reason: string;
    status: 'pending' | 'completed' | 'declined';
    notes?: string;
  }>;

  @Column({ name: 'follow_up_date', type: 'date', nullable: true })
  followUpDate?: string;

  @Column({ name: 'exit_notes', type: 'text', nullable: true })
  exitNotes?: string;

  @Column({ name: 'frva_score', type: 'decimal', precision: 5, scale: 2, nullable: true })
  frvaScore?: number;

  @Column({ name: 'swdi_score', type: 'decimal', precision: 5, scale: 2, nullable: true })
  swdiScore?: number;

  @Column({ name: 'family_dialogue_notes', type: 'text', nullable: true })
  familyDialogueNotes?: string;

  @Column({ name: 'self_reliance_level', type: 'int', nullable: true })
  selfRelianceLevel?: number;

  @Column({ name: 'sustainability_plan', type: 'text', nullable: true })
  sustainabilityPlan?: string;

  @Column({ name: 'transition_date', type: 'date', nullable: true })
  transitionDate?: string;

  @Column({ name: 'closure_outcome', nullable: true })
  closureOutcome?: string;

  @Column({ name: 'closure_date', type: 'date', nullable: true })
  closureDate?: string;

  @Column({ name: 'follow_up_visits', type: 'jsonb', nullable: true })
  followUpVisits?: Array<{
    date: string;
    type: string;
    notes: string;
    outcome: string;
  }>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
