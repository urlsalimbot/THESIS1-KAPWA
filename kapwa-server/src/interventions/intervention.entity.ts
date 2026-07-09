import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Case } from '../cases/case.entity';

export enum FundSource {
  REGULAR = 'Regular',
  PDAF = 'PDAF',
  LEGISLATIVE = 'Legislative',
  DONATION = 'Donation'
}

export enum SignatureStatus {
  PENDING = 'signatures_pending',
  COLLECTED = 'signatures_collected'
}

@Entity('interventions')
export class Intervention {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'case_id', nullable: true })
  caseId?: string;

  // Denormalized for exclusion constraint (populated on create via JOIN)
  @Column({ name: 'household_id', nullable: true })
  householdId?: string;

  @Column({ name: 'intervention_type', type: 'text', nullable: true })
  interventionType?: string;

  @Column({ name: 'amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  amount?: number;

  @Column({ name: 'fund_source', type: 'enum', enum: FundSource, nullable: true })
  fundSource?: FundSource;

  @Column({ name: 'agency', nullable: true })
  agency?: string;

  @Column({ name: 'service_date', type: 'date' })
  serviceDate!: Date;

  @Column({ name: 'voucher_no', nullable: true })
  voucherNo?: string;

  @Column({ name: 'or_reference', nullable: true })
  orReference?: string;

  @Column({ name: 'worker_signature_url' })
  workerSignatureUrl!: string;

  @Column({ name: 'client_signature_url', nullable: true })
  clientSignatureUrl?: string;

  @Column({ name: 'client_receipt_url', nullable: true })
  clientReceiptUrl?: string;

  @Column({ name: 'signature_status', type: 'enum', enum: SignatureStatus, default: SignatureStatus.COLLECTED })
  signatureStatus!: SignatureStatus;

  @Column({ name: 'hash', nullable: true })
  hash?: string;

  @Column({ name: 'prev_hash', nullable: true })
  prevHash?: string;

  @Column({ name: 'logged_by', nullable: true })
  loggedById?: string;

  @ManyToOne(() => Case, { nullable: true })
  @JoinColumn({ name: 'case_id' })
  case?: Case;

  @CreateDateColumn({ name: 'logged_at' })
  loggedAt!: Date;
}
