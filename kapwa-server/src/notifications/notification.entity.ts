import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum NotificationType {
  SMS = 'sms',
  IN_APP = 'in_app'
}

export enum NotificationCategory {
  CASE_UPDATE = 'case_update',
  SYNC_CONFLICT = 'sync_conflict',
  SYSTEM = 'system',
  CHAT = 'chat',
  APPROVAL = 'approval',
  DISBURSEMENT = 'disbursement'
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'recipient_id' })
  recipientId: string;

  @Column()
  title: string;

  @Column()
  message: string;

  @Column({ name: 'category', type: 'enum', enum: NotificationCategory, default: NotificationCategory.SYSTEM })
  category: NotificationCategory;

  @Column({ name: 'reference_id', nullable: true })
  referenceId: string;

  @Column({ type: 'enum', enum: NotificationType, default: NotificationType.IN_APP })
  channel: NotificationType;

  @Column({ nullable: true })
  phone: string;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @Column({ name: 'sent', default: false })
  sent: boolean;

  @Column({ name: 'sent_at', nullable: true })
  sentAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
