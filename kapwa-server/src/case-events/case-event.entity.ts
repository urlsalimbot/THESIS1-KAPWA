import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Case } from '../cases/case.entity';

export const CASE_EVENT_TYPES = ['court_hearing', 'home_visit'] as const;
export type CaseEventType = (typeof CASE_EVENT_TYPES)[number];
export const CASE_EVENT_STATUSES = ['planned', 'done', 'cancelled'] as const;
export type CaseEventStatus = (typeof CASE_EVENT_STATUSES)[number];

// Court hearings (legal categories) and scheduled home visits (any case).
// `attended` is tri-state: true = the office attends (calendar + reminders),
// NULL/false = not attending (recorded in the case file only).
@Entity('case_events')
export class CaseEvent extends BaseEntity {
  @Column({ name: 'case_id' })
  caseId!: string;

  @ManyToOne(() => Case, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'case_id' })
  case!: Case;

  @Column({ name: 'event_type', type: 'varchar', length: 32 })
  eventType!: string;

  @Column({ type: 'boolean', nullable: true })
  attended?: boolean | null;

  @Column({ type: 'text', nullable: true })
  title?: string | null;

  @Column({ type: 'text', nullable: true })
  venue?: string | null;

  @Column({ name: 'event_date', type: 'date' })
  eventDate!: string;

  @Column({ name: 'start_time', type: 'time', nullable: true })
  startTime?: string | null;

  @Column({ name: 'end_time', type: 'time', nullable: true })
  endTime?: string | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({ type: 'varchar', length: 32, default: 'planned' })
  status!: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}