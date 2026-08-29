import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Case } from './case.entity';

@Entity('case_requirements')
export class CaseRequirement extends BaseEntity {
  @Column({ name: 'case_id' })
  caseId!: string;

  @ManyToOne(() => Case, c => c.requirements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'case_id' })
  case!: Case;

  @Column({ name: 'requirement_key' })
  requirementKey!: string;

  @Column({ nullable: true })
  met?: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}