import { Entity, Column, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { User } from '../auth/user.entity';

// Team workspace: current whereabouts status per staff member (in office,
// field visit, on leave, etc.). One row per user (user_id is UNIQUE); the
// latest update wins.
@Entity('team_status')
export class TeamStatus extends BaseEntity {
  @Column({ name: 'user_id', unique: true })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 32 })
  status!: string;

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  // Visibility toggle (amendment): `team` (default) — everyone sees it;
  // `team_coordinators` — coordinators additionally see it. Same
  // varchar(32) + service-level validation shape as status.
  @Column({ name: 'visible_to', type: 'varchar', length: 32, default: 'team' })
  visibleTo!: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}