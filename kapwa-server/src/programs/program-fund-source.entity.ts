import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity.js';
import type { Program } from './program.entity.js';

@Entity('program_fund_sources')
export class ProgramFundSource extends BaseEntity {
  @Column({ name: 'program_id' })
  programId!: string;

  @ManyToOne('Program', 'fundSourceRows', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'program_id' })
  program!: Program;

  @Column()
  name!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}