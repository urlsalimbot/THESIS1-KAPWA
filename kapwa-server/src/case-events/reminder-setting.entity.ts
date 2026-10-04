import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export const REMINDER_SCOPES = ['system', 'worker'] as const;
export type ReminderScope = (typeof REMINDER_SCOPES)[number];

// Lead-time configuration: `system` rows are the MSWDO Head's defaults
// (user_id NULL, one per event type), `worker` rows override per user
// (user_id NOT NULL). offsets = ordered minutes-before, strictly descending.
// An explicit empty array disables reminders for that scope+type.
@Entity('reminder_settings')
export class ReminderSetting extends BaseEntity {
  @Column({ type: 'varchar', length: 16 })
  scope!: string;

  @Column({ name: 'user_id', nullable: true })
  userId?: string | null;

  @Column({ name: 'event_type', type: 'varchar', length: 32 })
  eventType!: string;

  @Column({ type: 'jsonb' })
  offsets!: number[];

  @Column({ name: 'updated_by', nullable: true })
  updatedBy?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}