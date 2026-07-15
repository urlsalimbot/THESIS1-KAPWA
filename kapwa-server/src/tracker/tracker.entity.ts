import { Entity, Column, CreateDateColumn, Unique, Check } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('case_tracker_log')
@Unique(['transactionDate', 'dailySeqNum'])
export class CaseTrackerLog extends BaseEntity {

  @Column({ name: 'tracker_id', unique: true, nullable: true })
  trackerId?: string;

  @Column({ name: 'daily_seq_num' })
  dailySeqNum: number;

  @Column({ name: 'transaction_date' })
  transactionDate: Date;

  @Column({ nullable: true })
  surname?: string;

  @Column({ name: 'first_name', nullable: true })
  firstName?: string;

  @Column({ name: 'middle_name', nullable: true })
  middleName?: string;

  @Column({ nullable: true })
  @Check(`"gender" IS NULL OR "gender" IN ('M', 'F', 'Male', 'Female')`)
  gender?: string;

  @Column({ name: 'age_range', nullable: true })
  ageRange?: string;

  @Column({ name: 'client_category', nullable: true })
  clientCategory?: string;

  @Column({ nullable: true })
  barangay?: string;

  @Column({ name: 'intervention_remarks', nullable: true })
  interventionRemarks?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
