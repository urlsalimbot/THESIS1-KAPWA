import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { NotificationCategory } from './notification.entity';
import { BaseEntity } from '../common/base.entity';

@Entity('notification_preferences')
export class NotificationPreference extends BaseEntity {

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'channel', type: 'varchar' })
  channel: 'sms' | 'in_app' | 'email';

  @Column({ name: 'category', type: 'enum', enum: NotificationCategory })
  category: NotificationCategory;

  @Column({ name: 'opted_in', default: false })
  optedIn: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
