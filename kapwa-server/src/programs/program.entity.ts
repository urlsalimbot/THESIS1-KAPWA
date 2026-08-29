import { Entity, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Expose, Exclude } from 'class-transformer';
import { BaseEntity } from '../common/base.entity';
import { ProgramFundSource } from './program-fund-source.entity';
import { ProgramRequiredDocument } from './program-required-document.entity';

export interface ApprovalStep {
  stepName: string;
  approverRole: string;
  slaDays: number;
  order: number;
}

@Entity('programs')
export class Program extends BaseEntity {

  @Column()
  name!: string;

  @Column({ nullable: true })
  category?: string;

  @Column({ nullable: true })
  waitingPeriodDays?: number;

  @Exclude()
  @OneToMany(() => ProgramFundSource, f => f.program, { eager: true, cascade: true, orphanedRowAction: 'delete' })
  fundSourceRows!: ProgramFundSource[];

  @Exclude()
  @OneToMany(() => ProgramRequiredDocument, d => d.program, { eager: true, cascade: true, orphanedRowAction: 'delete' })
  requiredDocumentRows!: ProgramRequiredDocument[];

  @Expose()
  get fundSources(): string[] | undefined {
    if (!this.fundSourceRows || this.fundSourceRows.length === 0) return undefined;
    return this.fundSourceRows.map(f => f.name);
  }

  @Expose()
  get requiredDocuments(): string[] | undefined {
    if (!this.requiredDocumentRows || this.requiredDocumentRows.length === 0) return undefined;
    return this.requiredDocumentRows.map(d => d.documentKey);
  }

  @Column({ type: 'jsonb', name: 'approval_workflow', nullable: true })
  approvalWorkflow?: ApprovalStep[];       // WAS: string[] (text[])

  @Column({ type: 'jsonb', nullable: true })
  formTemplate?: Record<string, any>;

  @Column({ nullable: true, name: 'legal_basis' })
  legalBasis?: string;                     // NEW

  @Column({ name: 'form_version', default: 1 })
  formVersion!: number;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}