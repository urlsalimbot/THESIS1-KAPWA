import { Entity, Column, CreateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

// Dedupe ledger: one row per (event, offset, channel), inserted BEFORE any
// delivery so two overlapping cron ticks cannot double-send. `sentAt` NULL
// means claimed but delivery failed — deliberately not retried.
@Entity('case_event_reminders')
export class CaseEventReminder extends BaseEntity {
  @Column({ name: 'event_id' })
  eventId!: string;

  @Column({ name: 'offset_minutes' })
  offsetMinutes!: number;

  @Column({ type: 'varchar', length: 16 })
  channel!: string;

  @Column({ name: 'sent_at', nullable: true })
  sentAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}