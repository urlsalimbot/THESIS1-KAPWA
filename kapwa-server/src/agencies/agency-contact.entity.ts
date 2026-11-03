import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity.js';
import type { Agency } from './agency.entity.js';

@Entity('agency_contacts')
export class AgencyContact extends BaseEntity {
  @Column({ name: 'agency_id' })
  agencyId!: string;

  @ManyToOne('Agency', 'contacts', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agency_id' })
  agency!: Agency;

  @Column({ name: 'contact_type' })
  contactType!: string;

  @Column()
  value!: string;

  @Column({ name: 'is_primary', nullable: true })
  isPrimary?: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}