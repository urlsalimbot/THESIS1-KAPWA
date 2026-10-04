import { Entity, Column, CreateDateColumn, UpdateDateColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * One row per (case, program): the case plan's enrollment step — a case is
 * enrolled in a program after assessment, and interventions are services
 * rendered under one of these enrollments (program_enrollment_id on
 * case_interventions).
 */
@Entity('program_enrollments')
@Unique('uq_program_enrollments_case_program', ['caseId', 'programId'])
@Index('idx_program_enrollments_case', ['caseId'])
export class ProgramEnrollment extends BaseEntity {
  @Column({ name: 'case_id' })
  caseId!: string;

  @Column({ name: 'program_id' })
  programId!: string;

  @Column({ name: 'enrolled_at', type: 'date' })
  enrolledAt!: string;

  @Column({ type: 'text', default: 'active' })
  status!: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}