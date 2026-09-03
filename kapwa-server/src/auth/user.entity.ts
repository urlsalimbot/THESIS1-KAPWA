import { Entity, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Expose, Exclude } from 'class-transformer';
import { BaseEntity } from '../common/base.entity';
import { UserToken } from './user-token.entity';
import { UserBarangayAssignment } from './user-barangay-assignment.entity';

export enum UserRole {
  SW = 'social_worker',
  ADMIN = 'admin',
  COORDINATOR = 'coordinator',
  CLAIMANT = 'claimant',
  MAYOR = 'mayor',
  AUDITOR = 'auditor',
  AGENCY_STAFF = 'agency_staff'
}

@Entity('users')
export class User extends BaseEntity {

  @Column({ name: 'email', unique: true })
  email!: string;

  @Exclude()
  @Column({ name: 'password' })
  password!: string;

  @Column({ name: 'role', type: 'text', default: UserRole.SW })
  role!: UserRole;

  @Column({ name: 'first_name', nullable: true })
  firstName?: string;

  @Column({ name: 'middle_name', nullable: true })
  middleName?: string;

  @Column({ name: 'last_name', nullable: true })
  lastName?: string;

  @Column({ name: 'name_extension', nullable: true })
  nameExtension?: string;

  @Column({ name: 'phone', nullable: true })
  phone?: string;

  @Column({ name: 'person_id', nullable: true })
  personId?: string;

  @Column({ name: 'pending_person_id', nullable: true })
  pendingPersonId?: string;

  @Column({ name: 'person_link_code', nullable: true })
  personLinkCode?: string;

  @Column({ name: 'person_link_code_expires_at', nullable: true, type: 'timestamp' })
  personLinkCodeExpiresAt?: Date;

  @Column({ name: 'agency_id', nullable: true })
  agencyId?: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'device_id', nullable: true })
  deviceId?: string;

  @Exclude()
  @Column({ name: 'mfa_secret', nullable: true })
  mfaSecret?: string;

  @Column({ name: 'mfa_enabled', default: false })
  mfaEnabled!: boolean;

  @Column({ name: 'token_version', default: 0 })
  tokenVersion!: number;

  @Column({ name: 'email_verified', default: true })
  emailVerified!: boolean;

  @Exclude()
  @OneToMany(() => UserToken, t => t.user, { eager: true, cascade: true, orphanedRowAction: 'delete' })
  tokens!: UserToken[];

  @Exclude()
  @OneToMany(() => UserBarangayAssignment, b => b.user, { eager: true, cascade: true, orphanedRowAction: 'delete' })
  barangayAssignments!: UserBarangayAssignment[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // --- Legacy flattened shape, now assembled from name-part columns ---
  @Expose() get fullName(): string | undefined {
    const parts = [this.firstName, this.middleName, this.lastName].filter(Boolean);
    const name = parts.join(' ').trim();
    if (!name) return undefined;
    return this.nameExtension ? `${name} ${this.nameExtension}` : name;
  }

  @Expose() get assignedBarangay(): string | undefined {
    return this.barangayAssignments?.find(b => b.isPrimary)?.barangay ?? this.barangayAssignments?.[0]?.barangay;
  }
  @Expose() get permittedBarangays(): string[] {
    return (this.barangayAssignments ?? []).filter(b => !b.isPrimary).map(b => b.barangay);
  }
  @Expose() get verificationToken(): string | undefined {
    return this.tokens?.find(t => t.purpose === 'email_verification')?.token;
  }
  @Expose() get verificationTokenExpiresAt(): Date | undefined {
    return this.tokens?.find(t => t.purpose === 'email_verification')?.expiresAt;
  }
  @Expose() get resetToken(): string | undefined {
    return this.tokens?.find(t => t.purpose === 'password_reset')?.token;
  }
  @Expose() get resetTokenExpiresAt(): Date | undefined {
    return this.tokens?.find(t => t.purpose === 'password_reset')?.expiresAt;
  }
  @Expose() get newEmail(): string | undefined {
    return (this.tokens?.find(t => t.purpose === 'change_email')?.meta as any)?.newEmail;
  }
  @Expose() get newEmailToken(): string | undefined {
    return this.tokens?.find(t => t.purpose === 'change_email')?.token;
  }
  @Expose() get newEmailTokenExpiresAt(): Date | undefined {
    return this.tokens?.find(t => t.purpose === 'change_email')?.expiresAt;
  }
}
