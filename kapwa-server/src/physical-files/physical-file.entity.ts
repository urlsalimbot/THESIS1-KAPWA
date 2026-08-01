import { Entity, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { CaseIntervention } from '../case-interventions/case-intervention.entity';

@Entity({ name: 'physical_files' })
export class PhysicalFile extends BaseEntity {
  @Column({ name: 'intervention_id', unique: true })
  interventionId!: string;

  @OneToOne(() => CaseIntervention)
  @JoinColumn({ name: 'intervention_id' })
  intervention?: CaseIntervention;

  @Column({ type: 'varchar', length: 50 })
  cabinet!: string;

  @Column({ type: 'varchar', length: 100 })
  folder!: string;

  @Column({ type: 'varchar', length: 100 })
  shelf!: string;

  @Column({ name: 'qr_hash', type: 'varchar', length: 64, unique: true, nullable: true })
  qrHash?: string;

  @Column({ name: 'qr_data_url', type: 'text', nullable: true })
  qrDataUrl?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}