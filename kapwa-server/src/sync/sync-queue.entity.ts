import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('sync_queue')
export class SyncQueue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'device_id' })
  deviceId: string;

  @Column({ name: 'table_name' })
  tableName: string;

  @Column({ name: 'record_id' })
  recordId: string;

  @Column()
  operation: 'INSERT' | 'UPDATE' | 'DELETE';

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ name: 'client_updated_at' })
  clientUpdatedAt: Date;

  @Column({ default: 'pending' })
  status: 'pending' | 'applied' | 'conflict' | 'failed';

  @Column({ name: 'idempotency_key', nullable: true })
  idempotencyKey: string;

  @Column({ name: 'conflict_reason', nullable: true })
  conflictReason: string;

  @Column({ name: 'resolved_at', nullable: true })
  resolvedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
