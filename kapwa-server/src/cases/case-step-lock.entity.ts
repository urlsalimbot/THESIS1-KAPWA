import { Entity, Column, CreateDateColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

// One row per (case, step). A seal is deliberately reversible: the row is
// deleted on unlock, and the audit log is what records that it happened.
@Entity('case_step_locks')
@Unique('uq_case_step_locks_case_step', ['caseId', 'stepIndex'])
@Index('idx_case_step_locks_case', ['caseId'])
export class CaseStepLock extends BaseEntity {

  @Column({ name: 'case_id' })
  caseId!: string;

  /** 0..4, matching the five stepper steps in CaseStepper.tsx. */
  @Column({ name: 'step_index', type: 'smallint' })
  stepIndex!: number;

  @Column({ name: 'locked_by', type: 'uuid', nullable: true })
  lockedBy?: string;

  // Snapshot, not a join: the strip must render the name even if the user row
  // is later removed, and a welfare case file should not lose who sealed it.
  @Column({ name: 'locked_by_name', nullable: true })
  lockedByName?: string;

  @CreateDateColumn({ name: 'locked_at' })
  lockedAt!: Date;
}