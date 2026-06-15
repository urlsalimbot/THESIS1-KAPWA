import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Case } from '../cases/case.entity';

export enum InterventionType {
  FA = 'FA',
  C = 'C',
  CSR = 'CSR',
  R = 'R',
  H = 'H',
  HV = 'HV'
}

export enum FundSource {
  REGULAR = 'Regular',
  PDAF = 'PDAF',
  LEGISLATIVE = 'Legislative',
  DONATION = 'Donation'
}

@Entity('interventions')
export class Intervention {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'case_id', nullable: true })
  caseId?: string;

  @Column({ name: 'intervention_type', type: 'enum', enum: InterventionType, nullable: true })
  interventionType?: InterventionType;

  @Column({ name: 'amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  amount?: number;

  @Column({ name: 'fund_source', type: 'enum', enum: FundSource, nullable: true })
  fundSource?: FundSource;

  @Column({ name: 'agency', nullable: true })
  agency?: string;

  @Column({ name: 'service_date', type: 'date', nullable: true })
  serviceDate?: Date;

  @Column({ name: 'voucher_no', nullable: true })
  voucherNo?: string;

  @Column({ name: 'or_reference', nullable: true })
  orReference?: string;

  @Column({ name: 'worker_signature_url' })
  workerSignatureUrl!: string;

  @Column({ name: 'logged_by', nullable: true })
  loggedById?: string;

  @ManyToOne(() => Case, { nullable: true })
  @JoinColumn({ name: 'case_id' })
  case?: Case;

  @CreateDateColumn({ name: 'logged_at' })
  loggedAt!: Date;
}
