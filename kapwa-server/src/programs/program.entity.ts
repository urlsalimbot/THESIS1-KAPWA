import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('programs')
export class Program {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  category?: string;

  @Column({ nullable: true })
  waitingPeriodDays?: number;

  @Column({ type: 'jsonb', nullable: true })
  requiredDocuments?: string[];

  @Column({ type: 'jsonb', nullable: true })
  fundSources?: string[];

  @Column({ type: 'jsonb', nullable: true })
  approvalWorkflow?: string[];

  @Column({ type: 'jsonb', nullable: true })
  formTemplate?: Record<string, any>;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}