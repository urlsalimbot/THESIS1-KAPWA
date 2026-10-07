import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Expose, Exclude } from 'class-transformer';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { User } from '../auth/user.entity';
import { BaseEntity } from '../common/base.entity';
import { CaseRequirement } from './case-requirement.entity';
import { CaseReferral } from './case-referral.entity';
import { CaseAssistance } from './case-assistance.entity';
import { CaseFollowUpVisit } from './case-follow-up-visit.entity';

export enum CaseStatus {
  ENROLLED = 'enrolled',
  ASSESSED = 'assessed',
  IN_REVIEW = 'in_review',
  ACTIVE = 'active',
  TRANSITIONING = 'transitioning',
  CLOSED = 'closed',
  // Terminal post-closure phase: the case returns for follow-up after
  // termination of active services (DSWD AO 10 s. 2007 §VIII.G).
  AFTERCARE = 'aftercare'
}

@Entity('cases')
export class Case extends BaseEntity {

  @Column({ name: 'control_no', unique: true })
  controlNo!: string;

  @Column({ name: 'beneficiary_id', nullable: true })
  beneficiaryId?: string;

  // Recurring-program cycles: points at the previous case this one renews
  // (e.g. a new 4Ps cycle). Soft link — the case history per beneficiary is
  // the authoritative chain.
  @Column({ name: 'renewal_of_case_id', nullable: true })
  renewalOfCaseId?: string;

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

  @Exclude()
  @OneToMany(() => CaseFollowUpVisit, v => v.case, { eager: true, cascade: true, orphanedRowAction: 'delete' })
  followUpVisitRows!: CaseFollowUpVisit[];

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
  get followUpVisits(): Array<{ date: string; type: string; notes?: string; outcome?: string }> | undefined {
    if (!this.followUpVisitRows || this.followUpVisitRows.length === 0) return undefined;
    return this.followUpVisitRows.map(v => ({
      date: v.visitDate,
      type: v.visitType,
      notes: v.notes,
      outcome: v.outcome,
    }));
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

  @Column({ name: 'approved_by_name', nullable: true })
  approvedByName?: string;

  @Column({ name: 'referral_not_needed', type: 'boolean', default: false })
  referralNotNeeded?: boolean;

  @Column({ name: 'intervention_not_needed', type: 'boolean', default: false })
  interventionNotNeeded?: boolean;

  /**
   * The office will attend no court hearing on this case — the Court Hearings
   * step's "record that none is needed" completion, so a case with no hearings
   * can still finish the step instead of blocking `active -> transitioning`
   * forever.
   */
  @Column({ name: 'court_hearings_not_needed', type: 'boolean', default: false })
  courtHearingsNotNeeded?: boolean;

  /**
   * How many `inter_agency_referrals` rows this case has.
   *
   * Not a column: `attachInterventionCounts` stamps it per case for the list
   * endpoint, so the approval pipeline's cards and the case view's stepper can be
   * drawn from one `stepperStepDone` and answer the same question about step 2.
   * Declared here rather than assigned through `as any` at the call site, because
   * a field that crosses the wire needs a name both apps can be checked against —
   * the client's `ApprovalCase` declares its side, and `case-fsm-parity.test.ts`
   * reads this declaration to keep the two spellings equal.
   *
   * `inter_agency_referrals`, never the `referrals` getter above: that is the
   * transition plan's agency list over `case_referrals`, which no referral writes.
   */
  interAgencyReferralCount?: number;

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

  @Column({ name: 'case_category', nullable: true })
  caseCategory?: string;

  // Crisis mode: worker-toggled; ad-hoc services (no program) then carry their
  // intervention-anchored documentary minimums instead of none.
  @Column({ name: 'crisis_mode', type: 'boolean', default: false })
  crisisMode!: boolean;

  // Court docket number for legal categories (CICL, VAWC, CNSP court cases).
  @Column({ name: 'court_docket_number', nullable: true })
  courtDocketNumber?: string;

  // CICL step — discernment assessment (R.A. 9344 §22 / DSWD AO 10 s. 2007).
  @Column({ name: 'discernment_assessed_at', type: 'date', nullable: true })
  discernmentAssessedAt?: string;

  @Column({ name: 'discernment_result', nullable: true })
  discernmentResult?: string;

  @Column({ name: 'discernment_notes', type: 'text', nullable: true })
  discernmentNotes?: string;

  // VAWC step — protection order (R.A. 9262 §8/§14–16).
  @Column({ name: 'protection_order_type', nullable: true })
  protectionOrderType?: string;

  @Column({ name: 'protection_order_issued_at', type: 'date', nullable: true })
  protectionOrderIssuedAt?: string;

  @Column({ name: 'protection_order_issued_by', nullable: true })
  protectionOrderIssuedBy?: string;

  @Column({ name: 'protection_order_notes', type: 'text', nullable: true })
  protectionOrderNotes?: string;

  // Enrollments step — explicit "no program needed" decision.
  @Column({ name: 'enrollments_not_needed', type: 'boolean', default: false })
  enrollmentsNotNeeded!: boolean;

  // Solo Parent step — ID issuance (R.A. 8972 §4).
  @Column({ name: 'solo_parent_id_issued_date', type: 'date', nullable: true })
  soloParentIdIssuedDate?: string;

  @Column({ name: 'solo_parent_id_number', nullable: true })
  soloParentIdNumber?: string;

  @Column({ name: 'solo_parent_notes', type: 'text', nullable: true })
  soloParentNotes?: string;

  // Adoption & Foster Care step — document spine (R.A. 11642).
  @Column({ name: 'adoption_dvc_date', type: 'date', nullable: true })
  adoptionDvcDate?: string;

  @Column({ name: 'adoption_case_study_date', type: 'date', nullable: true })
  adoptionCaseStudyDate?: string;

  @Column({ name: 'adoption_cdclaa_received', type: 'boolean', nullable: true })
  adoptionCdclaaReceived?: boolean;

  @Column({ name: 'adoption_notes', type: 'text', nullable: true })
  adoptionNotes?: string;

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

  @Exclude()
  @Column({ nullable: true })
  hash?: string;

  @Exclude()
  @Column({ name: 'prev_hash', nullable: true })
  prevHash?: string;
}
