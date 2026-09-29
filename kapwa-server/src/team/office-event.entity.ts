import { Entity, Column, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { User } from '../auth/user.entity';

// Team workspace: internal office events (meetings, training, celebrations).
// Visible to 'staff' (default), 'team', or the owning user depending on the
// visibility scope; repeat_rule holds an RFC-5545-style recurrence when set.
@Entity('office_events')
export class OfficeEvent extends BaseEntity {
  @Column({ type: 'text' })
  title!: string;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt!: Date;

  @Column({ name: 'ends_at', type: 'timestamptz' })
  endsAt!: Date;

  @Column({ name: 'repeat_rule', type: 'jsonb', nullable: true })
  repeatRule?: Record<string, unknown>;

  @Column({ name: 'visible_to', type: 'varchar', length: 32, default: 'staff' })
  visibleTo!: string;

  @Column({ type: 'text', nullable: true })
  location?: string;

  @Column({ name: 'owner_id' })
  ownerId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner!: User;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}