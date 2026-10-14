import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Program } from './program.entity';

/**
 * One row per (program, intervention_type): the Program → Interventions
 * matrix. An intervention logged on a case is one the chosen program actually
 * renders, so the logging UI offers only these rows.
 */
@Entity('program_interventions')
@Unique('uq_program_interventions_program_type', ['programId', 'interventionType'])
@Index('idx_program_interventions_program', ['programId'])
export class ProgramIntervention extends BaseEntity {
  @Column({ name: 'program_id' })
  programId!: string;

  // The inverse side of `Program.interventionRows` — TypeORM needs the *relation*
  // here (not the `program_id` column), and without it every Program query
  // fails at `joinColumns`.
  @ManyToOne(() => Program, (p) => p.interventionRows, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'program_id' })
  program!: Program;

  @Column({ name: 'intervention_type' })
  interventionType!: string;

  /** The specific form format this intervention obliges (e.g. 'social_case_study_report'); NULL = none. */
  @Column({ name: 'required_form', type: 'text', nullable: true })
  requiredForm?: string | null;

  /**
   * Display order within the program's matrix. The admin editor's row order is
   * the office's, not the database's: without this the list rendered in
   * whatever order the rows happened to come back (audit 3.2.13).
   */
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}