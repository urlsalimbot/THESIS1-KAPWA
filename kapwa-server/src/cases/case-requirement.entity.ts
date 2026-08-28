import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('case_requirements')
export class CaseRequirement extends BaseEntity {
  @Column({ name: 'case_id' })
  caseId!: string;

  @Column({ name: 'requirement_key' })
  requirementKey!: string;

  @Column({ nullable: true })
  met?: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}