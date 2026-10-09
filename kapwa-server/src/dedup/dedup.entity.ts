import { BaseEntity } from '../common/base.entity';
import { Column, Entity, ManyToOne, OneToMany, JoinColumn } from 'typeorm';

export type ClientImportStatus = 'defined' | 'reviewing' | 'finalized';
export type ClientImportRowStatus = 'pending' | 'no_match' | 'retained' | 'primary' | 'deprioritized';
export type MatchTargetType = 'db_person' | 'import_row' | 'household';
export type MatchStatus = 'pending' | 'primary' | 'deprioritized';
export type RemarkKind = 'import' | 'decision' | 'barangay_update' | 'manual';

/** One import run: source, the declarable column map, and lifecycle state. */
@Entity('client_import_operations')
export class ClientImportOperation extends BaseEntity {
  @Column()
  source!: string;

  @Column({ default: 'defined' })
  status!: ClientImportStatus;

  /** `{ baseline: {...}, extras: [...] }` — see the parser's `ColumnMap`. */
  @Column({ name: 'column_map', type: 'jsonb', default: () => "'{}'::jsonb" })
  columnMap!: Record<string, unknown>;

  @Column({ name: 'match_threshold', type: 'numeric', precision: 4, scale: 3, default: 0.75 })
  matchThreshold!: number;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  /** Who finalized the operation; null until it is finalized. */
  @Column({ type: 'uuid', nullable: true })
  accomplisher?: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'finalized_at', type: 'timestamptz', nullable: true })
  finalizedAt?: Date;

  /** Stored path of the generated priority-list Excel (Task 8). */
  @Column({ name: 'output_file', nullable: true })
  outputFile?: string;

  @OneToMany(() => ClientImportRow, (r) => r.operation)
  rows!: ClientImportRow[];
}

/** One parsed file row, with its final review status and save outcome. */
@Entity('client_import_rows')
export class ClientImportRow extends BaseEntity {
  @Column({ name: 'operation_id', type: 'uuid' })
  operationId!: string;

  @Column({ name: 'row_index', type: 'int' })
  rowIndex!: number;

  @Column({ name: 'last_name', nullable: true })
  lastName?: string;

  @Column({ name: 'first_name', nullable: true })
  firstName?: string;

  @Column({ name: 'middle_name', nullable: true })
  middleName?: string;

  @Column({ type: 'date', nullable: true })
  dob?: string;

  @Column({ nullable: true })
  barangay?: string;

  @Column({ name: 'original_remarks', nullable: true })
  originalRemarks?: string;

  /** Values of the declared extra fields, keyed by their declared name. */
  @Column({ name: 'extra_data', type: 'jsonb', default: () => "'{}'::jsonb" })
  extraData!: Record<string, unknown>;

  @Column({ default: 'pending' })
  status!: ClientImportRowStatus;

  @Column({ type: 'numeric', precision: 5, scale: 4, nullable: true })
  score?: number;

  /** Updated remarks — the row's `original_remarks` plus decision notes. */
  @Column({ nullable: true })
  remarks?: string;

  @Column({ name: 'matched_person_id', type: 'uuid', nullable: true })
  matchedPersonId?: string;

  @Column({ name: 'beneficiary_id', type: 'uuid', nullable: true })
  beneficiaryId?: string;

  @Column({ name: 'decided_by', type: 'uuid', nullable: true })
  decidedBy?: string;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt?: Date;

  @ManyToOne(() => ClientImportOperation, (o) => o.rows, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'operation_id' })
  operation!: ClientImportOperation;
}

/** A candidate the matcher surfaced for a row; carries the human decision. */
@Entity('client_import_matches')
export class ClientImportMatch extends BaseEntity {
  @Column({ name: 'row_id', type: 'uuid' })
  rowId!: string;

  /** `db_person` | `import_row` | `household`. */
  @Column({ name: 'target_type' })
  targetType!: MatchTargetType;

  @Column({ name: 'target_person_id', type: 'uuid', nullable: true })
  targetPersonId?: string;

  @Column({ name: 'target_import_row_id', type: 'uuid', nullable: true })
  targetImportRowId?: string;

  @Column({ name: 'target_household_id', type: 'uuid', nullable: true })
  targetHouseholdId?: string;

  @Column({ type: 'numeric', precision: 5, scale: 4 })
  score!: number;

  /** Reason tokens + signal breakdown, incl. `householdServed`. */
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  signals!: Record<string, unknown>;

  @Column({ default: 'pending' })
  status!: MatchStatus;

  /** Mandatory when the decision deprioritizes the import row. */
  @Column({ nullable: true })
  remark?: string;

  @Column({ name: 'decided_by', type: 'uuid', nullable: true })
  decidedBy?: string;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt?: Date;
}

/** Append-only remark history per beneficiary (feeds the beneficiary-view card). */
@Entity('beneficiary_remarks')
export class BeneficiaryRemark extends BaseEntity {
  @Column({ name: 'beneficiary_id', type: 'uuid' })
  beneficiaryId!: string;

  @Column({ name: 'operation_id', type: 'uuid', nullable: true })
  operationId?: string;

  /** `import` | `decision` | `barangay_update` | `manual`. */
  @Column()
  kind!: RemarkKind;

  @Column()
  remark!: string;

  @Column({ nullable: true })
  source?: string;

  @Column({ name: 'authored_by', type: 'uuid', nullable: true })
  authoredBy?: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}