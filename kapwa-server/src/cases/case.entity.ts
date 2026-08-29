import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Expose, Exclude } from 'class-transformer';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { User } from '../auth/user.entity';
import { BaseEntity } from '../common/base.entity';
import { CaseRequirement } from './case-requirement.entity';
import { CaseReferral } from './case-referral.entity';
import { CaseAssistance } from './case-assistance.entity';

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

  @Column('text', { name: 'nature_of_service', array: true, nullable: true })
  natureOfService?: string[];

  @Exclude()
  @OneToMany(() => CaseRequirement, r => r.case, { eager: true, cascade: true, orphanedRowAction: 'delete' })
  requirements!: CaseRequirement[];

  @Exclude()
  @OneToMany(() => CaseReferral, r => r.case, { eager: true, cascade: true, orphanedRowAction: 'delete' })
  referralRows!: CaseReferral[];

  @Exclude()
  @OneToMany(() => CaseAssistance, a => a.case, { eager: true, cascade: true, orphanedRowAction: 'delete' })
  assistances!: CaseAssistance[];

  @Expose()
  get requirementsChecklist(): Record<string, boolean> | undefined {
    if (!this.requirements || this.requirements.length === 0) return undefined;
    const out: Record<string, boolean> = {};
    this.requirements.forEach(r => { out[r.requirementKey] = !!r.met; });
    return out;
  }

  @Expose()
  get financialSubsidies(): Record<string, unknown> | undefined {
    return this.assistances?.find(a => a.assistanceType === 'financial')?.details;
  }

  @Expose()
  get amountAssistance(): number | undefined {
    const a = this.assistances?.find(a => a.assistanceType === 'financial');
    return a?.amount != null ? Number(a.amount) : undefined;
  }

  @Expose()
  get modeFinancialAssistance(): string | undefined {
    return this.assistances?.find(a => a.assistanceType === 'financial')?.mode;
  }

  @Expose()
  get sourceOfFund(): string | undefined {
    return this.assistances?.find(a => a.assistanceType === 'financial')?.sourceOfFund;
  }

  @Expose()
  get legislatorSpecify(): string | undefined {
    return this.assistances?.find(a => a.assistanceType === 'financial')?.legislatorSpecify;
  }

  @Expose()
  get otherAssistance(): Record<string, unknown> | undefined {
    const others = this.assistances?.filter(a => a.assistanceType !== 'financial') ?? [];
    if (others.length === 0) return undefined;
    const out: Record<string, unknown> = {};
    others.forEach(o => { out[o.assistanceType] = o.details ?? {}; });
    return out;
  }

  @Expose()
  get referrals(): Array<{ agencyName: string; status: string; notes?: string; reason: string; contactInfo?: string | null }> | undefined {
    if (!this.referralRows || this.referralRows.length === 0) return undefined;
    return this.referralRows.map(r => ({
      agencyName: r.agency ?? '',
      status: r.status ?? 'pending',
      notes: r.notes,
      reason: r.reason,
      contactInfo: r.contactInfo ?? null,
    }));
  }

  @Expose()
  get followUpVisits(): undefined {
    return undefined;
  }

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

  @Column({ name: 'interviewed_by', nullable: true })
  interviewedBy?: string;

  @Column({ name: 'client_signature', nullable: true, type: 'text' })
  clientSignature?: string;

  @Column({ name: 'self_reliance_plan', type: 'text', nullable: true })
  selfReliancePlan?: string;

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

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
