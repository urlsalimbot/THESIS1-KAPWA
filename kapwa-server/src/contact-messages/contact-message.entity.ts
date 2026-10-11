import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type ContactMessageStatus = 'new' | 'read';

@Entity('contact_messages')
export class ContactMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  subject: string | null;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'enum', enum: ['new', 'read'], default: 'new' })
  status: ContactMessageStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

/**
 * One staff reply to a contact message: the outbound email AND its in-app
 * record, so the inbox shows the conversation the visitor cannot see.
 */
@Entity('contact_message_replies')
export class ContactMessageReply {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'message_id', type: 'uuid' })
  messageId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'replied_by', type: 'uuid', nullable: true })
  repliedBy?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}