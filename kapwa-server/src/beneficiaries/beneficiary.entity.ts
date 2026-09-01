import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Expose, Exclude } from 'class-transformer';
import { Household } from './household.entity';
import { Person } from './person.entity';
import { BaseEntity } from '../common/base.entity';

@Entity('beneficiaries')
export class Beneficiary extends BaseEntity {

  @Column({ name: 'person_id', nullable: true })
  personId?: string;

  @ManyToOne(() => Person, { nullable: true })
  @JoinColumn({ name: 'person_id' })
  person?: Person;

  @Column({ name: 'user_id', nullable: true })
  userId?: string;

  @Column({ name: 'household_id', nullable: true })
  householdId?: string;

  @ManyToOne(() => Household, { nullable: true })
  @JoinColumn({ name: 'household_id' })
  household?: Household;

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

  // -- Flattened person fields for API backward compatibility --

  @Expose() get category(): string | undefined { return this.person?.roles?.[0]?.category; }
  @Expose() get consentStatus(): string { return this.person?.roles?.[0]?.consentStatus ?? 'active'; }
  @Expose() get accessCardCode(): string | undefined { return this.person?.roles?.[0]?.accessCardCode; }
  @Expose() get surname(): string { return this.person?.surname || ''; }
  @Expose() get firstName(): string { return this.person?.firstName || ''; }
  @Expose() get middleName(): string | undefined { return this.person?.middleName; }
  @Expose() get gender(): string { return this.person?.gender || ''; }
  @Expose() get dob(): Date | undefined { return this.person?.dob; }
  @Expose() get address(): string | undefined { return this.person?.address; }
  @Expose() get phone(): string | undefined { return this.person?.phone; }
  @Expose() get philsysNumber(): string | undefined { return this.person?.philsysNumber; }
  @Expose() get placeOfBirth(): string | undefined { return this.person?.placeOfBirth; }
  @Expose() get civilStatus(): string | undefined { return this.person?.civilStatus; }
  @Expose() get currentAddress(): Record<string, string> | undefined { return this.person?.currentAddress; }
  @Expose() get philhealthNumber(): string | undefined { return this.person?.philhealthNumber; }
  @Expose() get occupation(): string | undefined { return this.person?.occupation; }
  @Expose() get estimatedMonthlyIncome(): number | undefined { return this.person?.estimatedMonthlyIncome; }
  @Expose() get age(): number | undefined { return this.person?.age; }
  @Expose() get extension(): string | undefined { return this.person?.extension; }
}
