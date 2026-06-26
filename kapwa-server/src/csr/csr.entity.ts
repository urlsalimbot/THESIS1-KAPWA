import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('csr_reports')
export class CsrRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'case_id' })
  caseId: string;

  @Column({ name: 'control_no', unique: true })
  controlNo: string;

  @Column({ name: 'social_worker_name' })
  socialWorkerName: string;

  @Column({ name: 'social_worker_position', nullable: true })
  socialWorkerPosition?: string;

  @Column({ name: 'referral_origin', nullable: true })
  referralOrigin?: string;

  @Column({ name: 'reason_for_referral', type: 'text', nullable: true })
  reasonForReferral?: string;

  @Column({ name: 'problem_presented', type: 'text', nullable: true })
  problemPresented?: string;

  @Column({ name: 'family_background', type: 'text', nullable: true })
  familyBackground?: string;

  @Column({ name: 'socio_economic_profile', type: 'text', nullable: true })
  socioEconomicProfile?: string;

  @Column({ name: 'assessment_analysis', type: 'text', nullable: true })
  assessmentAnalysis?: string;

  @Column({ name: 'recommendation', type: 'text', nullable: true })
  recommendation?: string;

  @Column({ name: 'intervention_plan', type: 'text', nullable: true })
  interventionPlan?: string;

  @Column({ name: 'client_signature_url', nullable: true })
  clientSignatureUrl?: string;

  @Column({ name: 'worker_signature_url', nullable: true })
  workerSignatureUrl?: string;

  @Column({ default: false })
  finalized: boolean;

  @Column({ name: 'created_by' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
