import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('case_referrals')
export class CaseReferral extends BaseEntity {
  @Column({ name: 'case_id' })
  caseId!: string;

  @Column({ nullable: true })
  agency?: string;

  @Column({ nullable: true })
  status?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}