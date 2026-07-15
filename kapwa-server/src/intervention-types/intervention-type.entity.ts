import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('intervention_types')
export class InterventionTypeEntity extends BaseEntity {

  @Column({ name: 'code', length: 10, unique: true })
  code!: string;

  @Column({ name: 'name', length: 100 })
  name!: string;

  @Column({ name: 'description', nullable: true })
  description?: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
