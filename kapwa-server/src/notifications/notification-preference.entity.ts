import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { NotificationCategory } from './notification.entity';

@Entity('notification_preferences')
export class NotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'channel', type: 'varchar' })
  channel: 'sms' | 'in_app';

  @Column({ name: 'category', type: 'enum', enum: NotificationCategory })
  category: NotificationCategory;

  @Column({ name: 'opted_in', default: false })
  optedIn: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
