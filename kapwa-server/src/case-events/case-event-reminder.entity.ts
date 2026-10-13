import { Entity, Column, CreateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

// Dedupe ledger: one row per (event, offset, channel), inserted BEFORE any
// delivery so two overlapping cron ticks cannot double-send. `sentAt` NULL
// means claimed but delivery failed — deliberately not retried. Visit claims
// set `visitKey` instead of `eventId` (see the entity's case_id analogue); the
// key is `<caseId>|<visitDate>|<visitType>` because visit rows are regenerated
// on every plan save.
@Entity('case_event_reminders')
export class CaseEventReminder extends BaseEntity {
  @Column({ name: 'event_id', type: 'uuid', nullable: true })
  eventId?: string | null;

  @Column({ name: 'visit_key', type: 'text', nullable: true })
  visitKey?: string | null;

  @Column({ name: 'offset_minutes' })
  offsetMinutes!: number;

  @Column({ type: 'varchar', length: 16 })
  channel!: string;

  @Column({ name: 'sent_at', type: 'timestamp', nullable: true })
  sentAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}