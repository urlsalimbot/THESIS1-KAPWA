import { Entity, Column, CreateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

// Team workspace: schedule suggestions ("invite a colleague to have a
// schedule block on a date"). Any staff member incl. admin may send; only the
// invitee may respond. Accepting materializes the suggested block AS the
// invitee (owner + creator + team-visible); declining records the refusal.
@Entity('team_invites')
export class TeamInvite extends BaseEntity {
  @Column({ name: 'from_user_id' })
  fromUserId!: string;

  @Column({ name: 'to_user_id' })
  toUserId!: string;

  @Column({ name: 'invite_date', type: 'date' })
  inviteDate!: string;

  @Column({ name: 'block_type', type: 'varchar', length: 32 })
  blockType!: string;

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'responded_at', type: 'timestamptz', nullable: true })
  respondedAt?: Date | null;
}