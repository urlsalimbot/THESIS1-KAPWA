import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * The information-desk logbook. It records every front-door encounter —
 * including inquiries that never become an intake or a case — so walk-in
 * statistics are not limited to clients who reach casework. Links to a person,
 * case, pending intake or referral stay optional; the visit survives without
 * them.
 */
@Entity('walk_in_logs')
export class WalkInLog extends BaseEntity {
  @Column({ name: 'visited_at', type: 'timestamptz', default: () => 'NOW()' })
  visitedAt!: Date;

  @Column({ name: 'queue_no', type: 'int' })
  queueNo!: number;

  @Column({ name: 'first_name', type: 'text', nullable: true })
  firstName?: string | null;

  @Column({ name: 'middle_name', type: 'text', nullable: true })
  middleName?: string | null;

  @Column({ name: 'last_name', type: 'text', nullable: true })
  lastName?: string | null;

  @Column({ name: 'extension', type: 'text', nullable: true })
  extension?: string | null;

  @Column({ name: 'person_id', type: 'uuid', nullable: true })
  personId?: string | null;

  @Column({ name: 'case_id', type: 'uuid', nullable: true })
  caseId?: string | null;

  @Column({ name: 'pending_intake_id', type: 'uuid', nullable: true })
  pendingIntakeId?: string | null;

  @Column({ name: 'referral_id', type: 'uuid', nullable: true })
  referralId?: string | null;

  @Column({ type: 'text', nullable: true })
  barangay?: string | null;

  @Column({ type: 'text', nullable: true })
  sex?: string | null;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth?: string | null;

  @Column({ name: 'age_band', type: 'text', nullable: true })
  ageBand?: string | null;

  @Column({ name: 'contact_number', type: 'text', nullable: true })
  contactNumber?: string | null;

  @Column({ name: 'purpose_code', type: 'text' })
  purposeCode!: string;

  @Column({ name: 'purpose_text', type: 'text', nullable: true })
  purposeText?: string | null;

  @Column({ name: 'is_new_client', type: 'boolean', nullable: true })
  isNewClient?: boolean | null;

  @Column({ type: 'text', default: 'waiting' })
  status!: string;

  @Column({ name: 'assigned_to', type: 'uuid', nullable: true })
  assignedTo?: string | null;

  @Column({ type: 'text', nullable: true })
  outcome?: string | null;

  @Column({ name: 'outcome_notes', type: 'text', nullable: true })
  outcomeNotes?: string | null;

  @Column({ name: 'time_in', type: 'timestamptz', default: () => 'NOW()' })
  timeIn!: Date;

  @Column({ name: 'service_started_at', type: 'timestamptz', nullable: true })
  serviceStartedAt?: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
