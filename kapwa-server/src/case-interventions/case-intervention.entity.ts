import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('case_interventions')
export class CaseIntervention extends BaseEntity {

  @Column({ name: 'case_id' })
  caseId!: string;

  @Column({ name: 'program_id', nullable: true })
  programId?: string;

  @Column({ name: 'service_name' })
  serviceName!: string;

  // Typed service from the intervention catalog (spec §4.4); NULL on legacy
  // rows created before typing existed — they render as "uncatalogued".
  @Column({ name: 'intervention_type', nullable: true })
  interventionType?: string;

  // The program enrollment the service was delivered under (optional).
  @Column({ name: 'program_enrollment_id', type: 'uuid', nullable: true })
  programEnrollmentId?: string;

  @Column({ nullable: true })
  category?: string;

  @Column({ name: 'delivery_date', type: 'date', nullable: true })
  deliveryDate?: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  amount?: number;

  @Column({ name: 'mode_of_delivery', nullable: true })
  modeOfDelivery?: string;

  @Column({ name: 'fund_source', nullable: true })
  fundSource?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'delivered_by', nullable: true })
  deliveredBy?: string;

  // Staff who created the intervention (uuid FK users). NULL for legacy rows
  // created before this column existed — they count to nobody in achievements.
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
