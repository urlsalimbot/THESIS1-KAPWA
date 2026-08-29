import { Entity, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Expose } from 'class-transformer';
import { BaseEntity } from '../common/base.entity';
import { PersonContact } from './person-contact.entity';
import { PersonAddress } from './person-address.entity';

@Entity('persons')
export class Person extends BaseEntity {
  @Column() surname!: string;
  @Column({ name: 'first_name' }) firstName!: string;
  @Column({ name: 'middle_name', nullable: true }) middleName?: string;
  @Column({ name: 'extension', nullable: true }) extension?: string;
  @Column({ name: 'gender', type: 'enum', enum: ['Male', 'Female'] }) gender!: 'Male' | 'Female';
  @Column({ name: 'dob', type: 'date' }) dob!: Date;
  @Column({ name: 'philsys_number', unique: true, nullable: true }) philsysNumber?: string;
  @Column({ name: 'place_of_birth', nullable: true }) placeOfBirth?: string;
  @Column({ name: 'civil_status', nullable: true }) civilStatus?: string;
  @Column({ name: 'philhealth_number', nullable: true }) philhealthNumber?: string;
  @Column({ nullable: true }) occupation?: string;
  @Column({ name: 'estimated_monthly_income', type: 'decimal', precision: 12, scale: 2, nullable: true }) estimatedMonthlyIncome?: number;
  @Column({ type: 'tsvector', name: 'search_vector', select: false, nullable: true }) searchVector?: string;

  @OneToMany(() => PersonContact, c => c.person, { eager: true, cascade: true, orphanedRowAction: 'delete' })
  contacts!: PersonContact[];

  @OneToMany(() => PersonAddress, a => a.person, { eager: true, cascade: true, orphanedRowAction: 'delete' })
  addresses!: PersonAddress[];

  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;

  // --- Legacy flattened shape, now assembled from child rows ---
  @Expose() get phone(): string | undefined {
    return this.contacts?.find(c => c.contactType === 'phone')?.value ?? this.contacts?.[0]?.value;
  }
  @Expose() get email(): string | undefined {
    return this.contacts?.find(c => c.contactType === 'email')?.value;
  }
  @Expose() get address(): string | undefined {
    return this.addresses?.find(a => a.addressType === 'current')?.raw ?? this.addresses?.[0]?.raw;
  }
  @Expose() get currentAddress(): Record<string, string> | undefined {
    const a = this.addresses?.find(x => x.addressType === 'current');
    if (!a || (!a.barangay && !a.city && !a.province)) return undefined;
    const out: Record<string, string> = {};
    if (a.barangay) out.barangay = a.barangay;
    if (a.city) out.city = a.city;
    if (a.province) out.province = a.province;
    return out;
  }
  @Expose() get age(): number | undefined {
    if (!this.dob) return undefined;
    return Math.floor((Date.now() - new Date(this.dob).getTime()) / 31557600000);
  }
}