import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export type ComplianceType = 'school_attendance' | 'health_checkup' | 'fds';

@Entity('case_compliance_items')
export class CaseComplianceItem extends BaseEntity {
  @Column({ name: 'case_id' })
  caseId!: string;

  @Column({ name: 'household_member_id', nullable: true })
  householdMemberId?: string;

  @Column({ name: 'compliance_type', type: 'varchar', nullable: true })
  complianceType?: ComplianceType;

  @Column({ name: 'due_date', type: 'date' })
  dueDate!: string;

  @Column({ name: 'month_label', nullable: true })
  monthLabel?: string;

  @Column({ default: false })
  met!: boolean;

  @Column({ name: 'met_at', type: 'timestamp', nullable: true })
  metAt?: Date | null;

  @Column({ name: 'met_by', nullable: true })
  metBy?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
