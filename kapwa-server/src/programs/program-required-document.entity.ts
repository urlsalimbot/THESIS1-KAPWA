import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity.js';
import type { Program } from './program.entity.js';

@Entity('program_required_documents')
export class ProgramRequiredDocument extends BaseEntity {
  @Column({ name: 'program_id' })
  programId!: string;

  @ManyToOne('Program', 'requiredDocumentRows', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'program_id' })
  program!: Program;

  @Column({ name: 'document_key' })
  documentKey!: string;

  @Column({ nullable: true })
  mandatory?: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}