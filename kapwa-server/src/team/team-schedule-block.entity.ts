import { Entity, Column, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { User } from '../auth/user.entity';

// Team workspace: staff day blocks (field duty, appointments, etc.). One row
// per user per day, with an optional time window and free-form note.
@Entity('team_schedule_blocks')
export class TeamScheduleBlock extends BaseEntity {
  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'block_date', type: 'date' })
  blockDate!: string;

  // Multi-day blocks (amendment): optional inclusive end date. NULL/absent
  // means single-day — the effective range is
  // [block_date, COALESCE(end_date, block_date)], mirrored by the list
  // overlap predicate and the invites materialization (which stays
  // single-day: accept writes block_date only).
  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate?: string | null;

  @Column({ name: 'block_type', type: 'varchar', length: 32 })
  blockType!: string;

  @Column({ name: 'start_time', type: 'time', nullable: true })
  startTime?: string;

  @Column({ name: 'end_time', type: 'time', nullable: true })
  endTime?: string;

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  // Visibility toggle (amendment): `team` (default) — everyone sees it;
  // `team_coordinators` — coordinators additionally see it. Same
  // varchar(32) + service-level validation shape as block_type.
  @Column({ name: 'visible_to', type: 'varchar', length: 32, default: 'team' })
  visibleTo!: string;

  @Column({ name: 'created_by', nullable: true })
  createdBy?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}