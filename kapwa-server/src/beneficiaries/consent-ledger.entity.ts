import { Entity, Column, CreateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('consent_ledger')
export class ConsentLedger extends BaseEntity {

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

  @Column({ name: 'revoked_reason', nullable: true })
  revokedReason?: string;
}
