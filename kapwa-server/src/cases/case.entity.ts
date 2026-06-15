import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';

export enum CaseStatus {
  PENDING = 'pending_assessment',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  DISBURSED = 'disbursed',
  CLOSED = 'closed'
}

@Entity('cases')
export class Case {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

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

  @Column({ name: 'assigned_worker_id', nullable: true })
  assignedWorkerId?: string;

  @ManyToOne(() => Beneficiary, { nullable: true })
  @JoinColumn({ name: 'beneficiary_id' })
  beneficiary?: Beneficiary;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
