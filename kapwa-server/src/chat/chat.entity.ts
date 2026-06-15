import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sender_id' })
  senderId: string;

  @Column({ name: 'sender_name', nullable: true })
  senderName: string;

  @Column({ name: 'recipient_id' })
  recipientId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @Column({ name: 'conversation_id', nullable: true })
  conversationId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
