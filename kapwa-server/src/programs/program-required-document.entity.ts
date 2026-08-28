import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('program_required_documents')
export class ProgramRequiredDocument extends BaseEntity {
  @Column({ name: 'program_id' })
  programId!: string;

  @Column({ name: 'document_key' })
  documentKey!: string;

  @Column({ nullable: true })
  mandatory?: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
