import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * A service an admin added to the intervention catalog.
 *
 * The built-in vocabulary stays in `common/case-catalog.ts` (mirrored to the
 * canonical JSON, the client constants and the server's zod enums) — this table
 * holds only the additions, so those parity checks keep describing the shipped
 * catalog. Rows here are addressed by `code`, which is also what
 * `case_interventions.intervention_type` stores.
 */
@Entity('intervention_catalog')
export class InterventionCatalogEntry {
  /** Slug of the label, stable once created: rows already point at it. */
  @PrimaryColumn({ type: 'text' })
  code!: string;

  @Column({ type: 'text' })
  label!: string;

  /** Whether the service carries money: amount/mode/fund source apply. */
  @Column({ name: 'is_financial', default: false })
  isFinancial!: boolean;

  /** Inactive entries stay on old rows but cannot be chosen for new work. */
  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
