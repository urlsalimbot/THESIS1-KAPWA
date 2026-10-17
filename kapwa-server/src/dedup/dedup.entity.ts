import { BaseEntity } from '../common/base.entity';
import { Column, Entity, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import type { EligibilityCode } from './dedup-eligibility.service';

export type ClientImportStatus = 'defined' | 'reviewing' | 'finalizing' | 'finalized';
export type ClientImportRowStatus = 'pending' | 'no_match' | 'retained' | 'primary' | 'deprioritized';
export type MatchTargetType = 'db_person' | 'import_row' | 'household';
export type MatchStatus = 'pending' | 'primary' | 'deprioritized';
export type RemarkKind = 'import' | 'decision' | 'barangay_update' | 'manual';

/** One import run: source, the declarable column map, and lifecycle state. */
@Entity('client_import_operations')
export class ClientImportOperation extends BaseEntity {
  @Column()
  source!: string;

  /** The intervention this list serves (case code or custom label). */
  @Column({ name: 'intervention_type', default: '' })
  interventionType!: string;

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

  /**
   * The worker's lease on a queued (`finalizing`) operation. Null while queued,
   * stamped when claimed: the claim is `FOR UPDATE SKIP LOCKED`, so two API
   * instances cannot run the same batch, and a lease older than the stale
   * window is reclaimed after a crash.
   */
  @Column({ name: 'finalize_started_at', type: 'timestamptz', nullable: true })
  finalizeStartedAt?: Date | null;

  /** Why the last attempt failed; the operation returns to `reviewing` to retry. */
  @Column({ name: 'finalize_error', type: 'text', nullable: true })
  finalizeError?: string | null;

  /** What the batch saved, set on success (the review screen's summary). */
  @Column({ name: 'finalize_summary', type: 'jsonb', nullable: true })
  finalizeSummary?: { created: number; updated: number; deprioritized: number; barangayUpdates: number } | null;

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
  matchedPersonId?: string | null;

  @Column({ name: 'beneficiary_id', type: 'uuid', nullable: true })
  beneficiaryId?: string;

  @Column({ name: 'decided_by', type: 'uuid', nullable: true })
  decidedBy?: string;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt?: Date;

  /** Serving outcome: allowed or disqualified (undecided until reviewed). */
  @Column({ nullable: true })
  eligibility?: 'allowed' | 'disqualified';

  @Column({ name: 'eligibility_reason', nullable: true })
  eligibilityReason?: string;

  /**
   * Traffic-light code the review colours from — `recent_intervention`
   * (red), `passed_30d` (yellow), `no_intervention`/`new_client` (green),
   * `intra_list`/`household_recent` for the rest — not derived from the
   * reason copy on the client.
   */
  @Column({ name: 'eligibility_code', type: 'text', nullable: true })
  eligibilityCode?: EligibilityCode | null;

  /** Operator review: 'waive' (serve anyway) or 'confirm' (keep disqualified). */
  @Column({ name: 'eligibility_decision', type: 'text', nullable: true })
  eligibilityDecision?: 'waive' | 'confirm' | null;

  @Column({ name: 'eligibility_decided_by', type: 'uuid', nullable: true })
  eligibilityDecidedBy?: string;

  @Column({ name: 'eligibility_decided_at', type: 'timestamptz', nullable: true })
  eligibilityDecidedAt?: Date;

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
  authoredBy?: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}