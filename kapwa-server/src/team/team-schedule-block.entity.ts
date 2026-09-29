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

  @Column({ name: 'block_type', type: 'varchar', length: 32 })
  blockType!: string;

  @Column({ name: 'start_time', type: 'time', nullable: true })
  startTime?: string;

  @Column({ name: 'end_time', type: 'time', nullable: true })
  endTime?: string;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @Column({ name: 'created_by', nullable: true })
  createdBy?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}