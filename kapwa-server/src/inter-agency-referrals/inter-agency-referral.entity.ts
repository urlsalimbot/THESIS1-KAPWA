import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, UpdateDateColumn } from 'typeorm';
import { Expose } from 'class-transformer';
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

  // NOTE: this relation stays serialized (Person already @Exclude()s its own
  // child relations), because agency-program-wave2.spec.ts pins it as present and
  // the agency portal reads person.surname/person.phone. The getters below are
  // additive: they give clients a first-class name schema without a breaking
  // removal of `person`.
  @ManyToOne(() => Person, { nullable: true })
  @JoinColumn({ name: 'person_id' })
  person?: Person;

  // --- Identity surface, assembled from the joined Person ------------------
  // Mirrors Referral so both referral payloads carry the persons name schema
  // (surname / first name / middle name / extension) rather than a flat name.
  // Getters need explicit @Expose(): exposeAll covers own enumerable
  // properties, not prototype accessors.
  @Expose() get surname(): string { return this.person?.surname ?? ''; }
  @Expose() get firstName(): string { return this.person?.firstName ?? ''; }
  @Expose() get middleName(): string | undefined { return this.person?.middleName; }
  @Expose() get extension(): string | undefined { return this.person?.extension; }
  @Expose() get gender(): string { return this.person?.gender ?? ''; }
  @Expose() get dob(): string {
    const d = this.person?.dob;
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  // Structured address (mirrors Referral's object shape) plus the raw-backed
  // display string, which is the only place `street` is stored.
  @Expose() get address(): Record<string, string> | undefined {
    return this.person?.currentAddress;
  }
  @Expose() get currentAddress(): Record<string, string> | undefined {
    return this.person?.currentAddress;
  }
  @Expose() get addressLine(): string | undefined { return this.person?.address; }
  @Expose() get phone(): string | undefined { return this.person?.phone; }

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
