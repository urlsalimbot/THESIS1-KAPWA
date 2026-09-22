import { Entity, Column, CreateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('document_vault')
export class DocumentVault extends BaseEntity {

  @Column()
  fileName!: string;

  @Column({ nullable: true })
  originalName?: string;

  @Column({ nullable: true })
  mimeType?: string;

  @Column({ default: 0 })
  fileSize!: number;

  @Column({ nullable: true })
  caseId?: string;

  @Column({ nullable: true })
  beneficiaryId?: string;

  @Column({ name: 'irf_id', nullable: true })
  irfId?: string;

  @Column({ name: 'announcement_id', nullable: true })
  announcementId?: string;

  @Column({ nullable: true })
  category?: string;

  @Column({ nullable: true })
  notes?: string;

  @Column({ name: 'requirement_key', nullable: true })
  requirementKey?: string;

  // On-site confirmation of a documentary need. Remote (claimant) uploads start
  // unverified; MSWDO staff either confirm them here or upload directly (which
  // is treated as already on-site). Null = pending on-site verification.
  @Column({ name: 'verified_at', type: 'timestamp', nullable: true })
  verifiedAt?: Date;

  @Column({ name: 'verified_by', nullable: true })
  verifiedBy?: string;

  @Column({ name: 'uploaded_by', nullable: true })
  uploadedBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
