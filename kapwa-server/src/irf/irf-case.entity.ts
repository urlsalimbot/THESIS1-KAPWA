import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum IrfCategory {
  ABUSE = 'Abuse',
  NEGLECT = 'Neglect',
  EXPLOITATION = 'Exploitation',
  CRIMINAL = 'Criminal'
}

export enum IrfDisposition {
  UNDER_INVESTIGATION = 'Under Investigation',
  REFERRED_TO_PNP = 'Referred to PNP',
  REFERRED_TO_WCPD = 'Referred to WCPD',
  DISMISSED = 'Dismissed',
  CLOSED = 'Closed',
}

export interface KeyWrap {
  userId: string;
  encryptedKey: string; // base64-encoded AES-256 key encrypted with master wrapping key
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

  @Column({ type: 'bytea', nullable: true, name: 'encrypted_narration' })
  encryptedNarration?: Buffer;

  @Column({ type: 'enum', enum: IrfDisposition, default: IrfDisposition.UNDER_INVESTIGATION })
  caseDisposition!: IrfDisposition;

  @Column({ type: 'jsonb', nullable: true, name: 'key_wraps' })
  keyWraps?: KeyWrap[];

  @Column({ nullable: true, name: 'key_version', default: 1 })
  keyVersion?: number;

  @Column({ nullable: true, name: 'dismissal_reason' })
  dismissalReason?: string;

  @Column({ nullable: true })
  msdwSignatureUrl?: string;

  @Column({ nullable: true })
  reportingSignatureUrl?: string;

  @CreateDateColumn()
  createdAt!: Date;
}
