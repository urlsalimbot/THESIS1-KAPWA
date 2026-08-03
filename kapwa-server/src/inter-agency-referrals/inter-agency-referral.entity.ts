import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Agency } from '../agencies/agency.entity';
import { Person } from '../beneficiaries/person.entity';
import { Case } from '../cases/case.entity';
import { User } from '../auth/user.entity';

export type InterAgencyReferralStatus = 'referred' | 'received' | 'actioned' | 'closed' | 'declined';

@Entity({ name: 'inter_agency_referrals' })
export class InterAgencyReferral extends BaseEntity {
  @Column({ name: 'case_id', nullable: true })
  caseId?: string;

  @ManyToOne(() => Case, { nullable: true })
  @JoinColumn({ name: 'case_id' })
  case?: Case;

  @Column({ name: 'person_id' })
  personId!: string;

  @ManyToOne(() => Person, { nullable: true })
  @JoinColumn({ name: 'person_id' })
  person?: Person;

  @Column({ name: 'from_agency_id' })
  fromAgencyId!: string;

  @ManyToOne(() => Agency, { nullable: true })
  @JoinColumn({ name: 'from_agency_id' })
  fromAgency?: Agency;

  @Column({ name: 'to_agency_id' })
  toAgencyId!: string;

  @ManyToOne(() => Agency, { nullable: true })
  @JoinColumn({ name: 'to_agency_id' })
  toAgency?: Agency;

  @Column({ type: 'text', default: 'referred' })
  status!: InterAgencyReferralStatus;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'legal_basis_code', type: 'text' })
  legalBasisCode!: string;

  @Column({ name: 'consent_ledger_id', nullable: true })
  consentLedgerId?: string;

  @Column({ type: 'text', nullable: true })
  outcome?: string;

  @Column({ name: 'received_at', type: 'timestamp', nullable: true })
  receivedAt?: Date;

  @Column({ name: 'actioned_at', type: 'timestamp', nullable: true })
  actionedAt?: Date;

  @Column({ name: 'closed_at', type: 'timestamp', nullable: true })
  closedAt?: Date;

  @Column({ name: 'declined_reason', type: 'text', nullable: true })
  declinedReason?: string;

  @Column({ name: 'created_by', nullable: true })
  createdBy?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
