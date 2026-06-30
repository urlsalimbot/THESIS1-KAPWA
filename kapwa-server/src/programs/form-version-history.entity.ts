import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Program } from './program.entity';

@Entity('form_version_history')
export class FormVersionHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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
