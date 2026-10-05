import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

// Documentary minimum for ad-hoc crisis services: each intervention type
// defines its own required documents. Seeded in migration 0084.
@Entity('intervention_required_documents')
export class InterventionRequiredDocument extends BaseEntity {
  @Column({ name: 'intervention_type', type: 'varchar', length: 32 })
  interventionType!: string;

  @Column({ name: 'document_key', type: 'varchar', length: 64 })
  documentKey!: string;

  @Column({ type: 'boolean', default: true })
  mandatory!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}