import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { CaseStatus } from './case.entity';

@Entity('case_history')
export class CaseHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'case_id' })
  caseId!: string;

  @Column({ name: 'from_status', type: 'enum', enum: CaseStatus, nullable: true })
  fromStatus?: CaseStatus;

  @Column({ name: 'to_status', type: 'enum', enum: CaseStatus })
  toStatus!: CaseStatus;

  @Column({ name: 'changed_by_role', nullable: true })
  changedByRole?: string;

  @Column({ name: 'changed_by_id', nullable: true })
  changedById?: string;

  @Column({ name: 'remarks', nullable: true })
  remarks?: string;

  @Column({ name: 'transition_type', default: 'standard' })
  transitionType: 'standard' | 'override';

  @Column({ name: 'override_reason', nullable: true })
  overrideReason?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
