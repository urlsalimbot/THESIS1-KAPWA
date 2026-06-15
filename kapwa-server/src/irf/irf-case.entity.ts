import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum IrfCategory {
  ABUSE = 'Abuse',
  NEGLECT = 'Neglect',
  EXPLOITATION = 'Exploitation',
  CRIMINAL = 'Criminal'
}

@Entity('irf_cases')
export class IrfCase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  blotterEntryNumber!: string;

  @Column({ type: 'enum', enum: IrfCategory })
  caseCategory!: IrfCategory;

  @Column({ nullable: true })
  datetimeReported?: Date;

  @Column({ nullable: true })
  datetimeIncident?: Date;

  @Column('jsonb', { nullable: true })
  itemAReportingPerson?: Record<string, any>;

  @Column('jsonb', { nullable: true })
  itemBPersonReported?: Record<string, any>;

  @Column({ type: 'bytea', nullable: true })
  encryptedNarration?: Buffer;

  @Column({ nullable: true })
  caseDisposition?: string;

  @Column({ nullable: true })
  msdwSignatureUrl?: string;

  @Column({ nullable: true })
  reportingSignatureUrl?: string;

  @CreateDateColumn()
  createdAt!: Date;
}