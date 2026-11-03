import { Entity, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity.js';
import type { Person } from './person.entity.js';

@Entity('person_contacts')
export class PersonContact extends BaseEntity {
  @ManyToOne('Person', 'contacts', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'person_id' })
  person!: Person;

  @Column({ name: 'person_id' })
  personId!: string;

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
