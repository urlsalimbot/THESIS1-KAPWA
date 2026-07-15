import { Entity, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Program } from './program.entity';
import { BaseEntity } from '../common/base.entity';

@Entity('form_version_history')
export class FormVersionHistory extends BaseEntity {

  @Column({ name: 'program_id' })
  programId: string;

  @ManyToOne(() => Program)
  @JoinColumn({ name: 'program_id' })
  program?: Program;

  @Column({ type: 'jsonb' })
  formTemplate: Record<string, any>;

  @Column()
  version: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
