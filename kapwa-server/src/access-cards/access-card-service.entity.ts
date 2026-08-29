import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Agency } from '../agencies/agency.entity';

@Entity('access_card_services')
export class AccessCardService extends BaseEntity {

  @Column({ name: 'access_card_code' })
  accessCardCode!: string;

  @Column({ type: 'date', name: 'service_date' })
  serviceDate!: Date;

  @Column({ name: 'service_rendered' })
  serviceRendered!: string;

  @Column({ name: 'cost', type: 'decimal', precision: 12, scale: 2, nullable: true })
  cost?: number;

  @Column({ name: 'agency_id', nullable: true })
  agencyId?: string;

  @ManyToOne(() => Agency, { nullable: true })
  @JoinColumn({ name: 'agency_id' })
  agencyRef?: Agency;

  @Column({ name: 'worker_name_sign', nullable: true })
  workerNameSign?: string;

  @Column({ name: 'category', nullable: true })
  category?: string;

  @Column({ name: 'intervention_id', nullable: true })
  interventionId?: string;

  @Column({ name: 'logged_by', nullable: true })
  loggedBy?: string;

  @Column({ name: 'source_barangay', nullable: true })
  sourceBarangay?: string;
}
