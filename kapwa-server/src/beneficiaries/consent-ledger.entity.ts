import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('consent_ledger')
export class ConsentLedger {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'beneficiary_id', nullable: true })
  beneficiaryId?: string;

  @Column({ name: 'purpose', nullable: true })
  purpose?: string;

  @Column({ name: 'channel', nullable: true })
  channel?: string;

  @Column({ name: 'status', default: 'active' })
  status!: string;

  @CreateDateColumn({ name: 'granted_at' })
  grantedAt!: Date;

  @Column({ name: 'revoked_at', nullable: true })
  revokedAt?: Date;
}
