import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Case } from './case.entity';

// Follow-up / home visits recorded during the Phase-Out (Evaluate Help Given)
// step. Normalized child table of `cases` so the visit history is queryable and
// the API keeps the `followUpVisits: { date, type, notes, outcome }[]` shape via
// the Case getter.
@Entity('case_follow_up_visits')
export class CaseFollowUpVisit extends BaseEntity {
  @Column({ name: 'case_id' })
  caseId!: string;

  @ManyToOne(() => Case, c => c.followUpVisitRows, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'case_id' })
  case!: Case;

  @Column({ name: 'visit_date', type: 'date' })
  visitDate!: string;

  @Column({ name: 'visit_type' })
  visitType!: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'text', nullable: true })
  outcome?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
