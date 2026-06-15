import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('version_vectors')
export class VersionVector {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'device_id' })
  deviceId: string;

  @Column({ name: 'table_name' })
  tableName: string;

  @Column({ name: 'local_version', default: 0 })
  localVersion: number;

  @Column({ name: 'server_version', default: 0 })
  serverVersion: number;

  @Column({ name: 'last_synced_at', nullable: true })
  lastSyncedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
