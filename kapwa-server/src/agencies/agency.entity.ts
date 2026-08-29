import { Entity, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Expose, Exclude } from 'class-transformer';
import { BaseEntity } from '../common/base.entity';
import { AgencyContact } from './agency-contact.entity';

@Entity({ name: 'agencies' })
export class Agency extends BaseEntity {
  @Column({ unique: true })
  code!: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  type?: string;

  @Exclude()
  @OneToMany(() => AgencyContact, c => c.agency, { eager: true, cascade: true, orphanedRowAction: 'delete' })
  contacts!: AgencyContact[];

  @Expose()
  get contactInfo(): Record<string, unknown> | undefined {
    if (!this.contacts || this.contacts.length === 0) return undefined;
    const out: Record<string, unknown> = {};
    this.contacts.forEach(c => { out[c.contactType] = c.value; });
    return out;
  }

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}