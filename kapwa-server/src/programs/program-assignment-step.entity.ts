import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('program_assignment_steps')
export class ProgramAssignmentStep {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'assignment_id' })
  assignmentId!: string;

  @Column({ name: 'step_order' })
  stepOrder!: number;

  @Column({ name: 'step_name' })
  stepName!: string;

  @Column({ name: 'approver_role' })
  approverRole!: string;

  @Column({ default: 'pending' })
  status!: 'pending' | 'approved' | 'rejected';

  @Column({ name: 'approved_by', nullable: true })
  approvedBy?: string;

  @Column({ name: 'approved_at', nullable: true })
  approvedAt?: Date;

  @Column({ nullable: true })
  remarks?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
