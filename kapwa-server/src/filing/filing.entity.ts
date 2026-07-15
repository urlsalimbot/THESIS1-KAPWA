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

  @Column({ nullable: true })
  category?: string;

  @Column({ nullable: true })
  notes?: string;

  @Column({ name: 'uploaded_by', nullable: true })
  uploadedBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
