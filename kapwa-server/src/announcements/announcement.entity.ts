import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity({ name: 'announcements' })
export class Announcement extends BaseEntity {
  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text', unique: true })
  slug!: string;

  @Column({ type: 'text', default: '' })
  excerpt!: string;

  @Column({ name: 'body_html', type: 'text', default: '' })
  bodyHtml!: string;

  @Column({ name: 'body_text', type: 'text', default: '' })
  bodyText!: string;

  @Column({ type: 'text', default: 'draft' })
  status!: 'draft' | 'published';

  @Column({ type: 'boolean', default: false })
  pinned!: boolean;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
