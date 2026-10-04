import { Entity, Column, CreateDateColumn, UpdateDateColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * One row per (program, intervention_type): the Program → Services matrix.
 * An intervention logged on a case is a service the chosen program actually
 * renders, so the logging UI offers only these rows.
 */
@Entity('program_services')
@Unique('uq_program_services_program_type', ['programId', 'interventionType'])
@Index('idx_program_services_program', ['programId'])
export class ProgramService extends BaseEntity {
  @Column({ name: 'program_id' })
  programId!: string;

  @Column({ name: 'intervention_type' })
  interventionType!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}