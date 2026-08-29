import { Entity, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Person } from './person.entity';

@Entity('person_addresses')
export class PersonAddress extends BaseEntity {
  @ManyToOne(() => Person, p => p.addresses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'person_id' })
  person!: Person;

  @Column({ name: 'person_id' })
  personId!: string;

  @Column({ name: 'address_type' })
  addressType!: string;

  @Column({ nullable: true })
  barangay?: string;

  @Column({ nullable: true })
  city?: string;

  @Column({ nullable: true })
  province?: string;

  @Column({ nullable: true })
  postal?: string;

  @Column({ name: 'is_primary', nullable: true })
  isPrimary?: boolean;

  @Column({ nullable: true })
  raw?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
