import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export enum UserRole {
  SW = 'social_worker',
  ADMIN = 'admin',
  COORDINATOR = 'coordinator',
  CLAIMANT = 'claimant',
  MAYOR = 'mayor',
  AUDITOR = 'auditor'
}

@Entity('users')
export class User extends BaseEntity {

  @Column({ name: 'email', unique: true })
  email!: string;

  @Column({ name: 'password' })
  password!: string;

  @Column({ name: 'role', type: 'text', default: UserRole.SW })
  role!: UserRole;

  @Column({ name: 'full_name', nullable: true })
  fullName?: string;

  @Column({ name: 'phone', nullable: true })
  phone?: string;

  @Column({ name: 'assigned_barangay', nullable: true })
  assignedBarangay?: string;

  @Column({ name: 'permitted_barangays', type: 'text', array: true, default: [] })
  permittedBarangays!: string[];

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'device_id', nullable: true })
  deviceId?: string;

  @Column({ name: 'mfa_secret', nullable: true })
  mfaSecret?: string;

  @Column({ name: 'mfa_enabled', default: false })
  mfaEnabled!: boolean;

  @Column({ name: 'token_version', default: 0 })
  tokenVersion!: number;

  @Column({ name: 'email_verified', default: true })
  emailVerified!: boolean;

  @Column({ name: 'verification_token', nullable: true })
  verificationToken?: string;

  @Column({ name: 'verification_token_expires_at', nullable: true, type: 'timestamp' })
  verificationTokenExpiresAt?: Date;

  @Column({ name: 'reset_token', nullable: true })
  resetToken?: string;

  @Column({ name: 'reset_token_expires_at', nullable: true, type: 'timestamp' })
  resetTokenExpiresAt?: Date;

  @Column({ name: 'new_email', nullable: true })
  newEmail?: string;

  @Column({ name: 'new_email_token', nullable: true })
  newEmailToken?: string;

  @Column({ name: 'new_email_token_expires_at', nullable: true, type: 'timestamp' })
  newEmailTokenExpiresAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
