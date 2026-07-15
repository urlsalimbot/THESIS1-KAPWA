import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export enum AssignmentStatus {
  PENDING = 'pending',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('program_assignments')
export class ProgramAssignment extends BaseEntity {

  @Column({ name: 'case_id' })
  caseId!: string;

  @Column({ name: 'program_id' })
  programId!: string;

  @Column({ type: 'enum', enum: AssignmentStatus, default: AssignmentStatus.PENDING })
  status!: AssignmentStatus;

  @Column({ name: 'current_step_order', default: 0 })
  currentStepOrder!: number;

  @Column({ name: 'assigned_worker_id' })
  assignedWorkerId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
