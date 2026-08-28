import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('agency_contacts')
export class AgencyContact extends BaseEntity {
  @Column({ name: 'agency_id' })
  agencyId!: string;

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
