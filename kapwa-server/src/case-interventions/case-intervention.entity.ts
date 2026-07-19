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

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
