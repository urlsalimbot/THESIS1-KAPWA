import { Entity, Column, CreateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('chat_messages')
export class ChatMessage extends BaseEntity {

  @Column({ name: 'sender_id' })
  senderId: string;

  @Column({ name: 'sender_name', nullable: true })
  senderName?: string;

  @Column({ name: 'recipient_id' })
  recipientId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @Column({ name: 'conversation_id' })
  conversationId!: string;

  @Column({ name: 'read_at', type: 'timestamp', nullable: true })
  readAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
