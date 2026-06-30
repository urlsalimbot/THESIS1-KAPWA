import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('access_card_services')
export class AccessCardService {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'access_card_code' })
  accessCardCode!: string;

  @Column({ type: 'date', name: 'service_date' })
  serviceDate!: Date;

  @Column({ name: 'service_rendered' })
  serviceRendered!: string;

  @Column({ name: 'cost', type: 'decimal', precision: 12, scale: 2, nullable: true })
  cost?: number;

  @Column({ name: 'agency', nullable: true })
  agency?: string;

  @Column({ name: 'worker_name_sign', nullable: true })
  workerNameSign?: string;

  @Column({ name: 'intervention_id', nullable: true })
  interventionId?: string;
}
