import { Logger, Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SyncQueue } from './sync-queue.entity';
import { VersionVector } from './version-vector.entity';
import { ConflictResolver } from './conflict-resolver';
import { SyncRequestInput } from './dto/sync.zod';
import { IntakeService } from '../intake/intake.service';

const IDEMPOTENCY_TTL_MS = 86_400_000; // 24h
const MAX_CACHE_SIZE = 10_000;

const ALLOWED_COLUMNS = new Set([
  "id","name","surname","first_name","middle_name","gender","dob","address","phone",
  "email","password","role","full_name","assigned_barangay","permitted_barangays",
  "is_active","device_id","category","waiting_period_days","required_documents",
  "fund_sources","approval_workflow","form_template","created_at","updated_at","barangay",
  "estimated_income","verified_by","status","control_no","beneficiary_id",
  "service_requested","requirements_checklist","certificate_url","petty_cash_voucher_url",
  "assigned_worker_id","case_id","intervention_type","amount","fund_source","agency",
  "service_rendered","service_date","voucher_no","or_reference","worker_signature_url","worker_name_sign","logged_by","hash",
  "philsys_number","access_card_code","consent_status","cost","search_vector","household_id",
  "age","occupation","is_primary","blotter_entry_number","case_category",
  "datetime_reported","datetime_incident","item_a_reporting_person","item_b_person_reported",
  "encrypted_narration","case_disposition","msdw_signature_url","reporting_signature_url",
  "recipient_id","title","message","channel","phone","sent","sent_at","is_read","reference_id",
  "sender_id","content","conversation_id","read_at","purpose","table_name","record_id",
  "operation","payload","client_updated_at","idempotency_key","conflict_reason","resolved_at",
  "local_version","server_version","last_synced_at","social_worker_name",
  "social_worker_position","referral_origin","reason_for_referral","problem_presented",
  "family_background","socio_economic_profile","assessment_analysis","recommendation",
  "intervention_plan","client_signature_url","worker_signature_url","finalized","created_by",
  "daily_seq_num","transaction_date","age_range","client_category","intervention_remarks",
  "full_name","relationship","intervention_id",
  // Allow SLA field on cases
  "sla_overdue"
]);

const FSM_CONTROL_FIELDS = new Set(['_fsmTransition', '_clientUpdatedAt']);

function sanitizePayload(payload: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (FSM_CONTROL_FIELDS.has(k)) continue; // strip FSM control fields
    if (ALLOWED_COLUMNS.has(k)) sanitized[k] = v;
  }
  return sanitized;
}

// Per D-04: valid FSM transitions for cases
const VALID_FSM_TRANSITIONS: Record<string, string[]> = {
  pending_assessment: ['in_review'],
  in_review: ['approved', 'pending_assessment'],
  approved: ['disbursed', 'in_review'],
  disbursed: ['closed'],
  closed: [],
};

function isValidFsmTransition(currentStatus: string, requestedStatus: string): boolean {
  const allowed = VALID_FSM_TRANSITIONS[currentStatus];
  return allowed ? allowed.includes(requestedStatus) : false;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly idempotencyCache = new Map<string, { result: unknown; timestamp: number }>();

  constructor(
    @InjectRepository(SyncQueue)
    private readonly queueRepo: Repository<SyncQueue>,
    @InjectRepository(VersionVector)
    private readonly versionRepo: Repository<VersionVector>,
    private readonly conflictResolver: ConflictResolver,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly intakeService: IntakeService,
  ) {}

  async processDelta(batch: SyncRequestInput) {
    const { deviceId, changes, versionVectors, idempotencyKey, signature } = batch;

    const cached = await this.getIdempotencyResult(idempotencyKey);
    if (cached) return cached;

    if (!this.verifySignature(signature, deviceId, changes)) {
      throw new ForbiddenException('Invalid Ed25519 signature');
    }

    const results: Array<{
      changeId: string;
      tableName: string;
      status: 'applied' | 'conflict' | 'failed';
      serverRecord?: Record<string, any>;
      reason?: string;
      currentState?: string;
      requestedState?: string;
    }> = [];

    for (const change of changes) {
      try {
        const existing = await this.queueRepo.findOne({
          where: { idempotencyKey: change.id, deviceId },
        });

        if (existing && existing.status === 'applied') {
          results.push({
            changeId: change.id,
            tableName: change.tableName,
            status: 'applied',
          });
          continue;
        }

        // Special handling for 'intake' tableName — delegate to IntakeService
        if (change.tableName === 'intake') {
          await this.intakeService.submitIntake(change.payload as any);

          const queueEntry = this.queueRepo.create({
            deviceId,
            tableName: change.tableName,
            recordId: change.recordId,
            operation: change.operation as 'INSERT' | 'UPDATE' | 'DELETE',
            payload: change.payload,
            clientUpdatedAt: new Date(change.clientUpdatedAt),
            status: 'applied',
            idempotencyKey: change.id,
          });
          await this.queueRepo.save(queueEntry);

          results.push({
            changeId: change.id,
            tableName: change.tableName,
            status: 'applied',
          });
          continue;
        }

        // D-04: Pre-check FSM transitions before conflict detection
        const isFsm = change.payload?._fsmTransition === true;
        if (isFsm && change.tableName === 'cases') {
          const fsmResult = await this.handleFsmTransition(change.recordId, change.payload.status, change.id);
          if (fsmResult?.status === 'conflict') {
            results.push(fsmResult);
            continue;
          }
          // FSM transition is valid — proceed with normal apply (conflict detection still applies)
        }

        const conflict = await this.detectConflict(change.tableName, change.recordId, change.payload, change.clientUpdatedAt);

        if (conflict) {
          const queueEntry = this.queueRepo.create({
            deviceId,
            tableName: change.tableName,
            recordId: change.recordId,
            operation: change.operation as 'INSERT' | 'UPDATE' | 'DELETE',
            payload: change.payload,
            clientUpdatedAt: new Date(change.clientUpdatedAt),
            status: 'conflict',
            idempotencyKey: change.id,
            conflictReason: conflict.reason,
          });
          await this.queueRepo.save(queueEntry);

          results.push({
            changeId: change.id,
            tableName: change.tableName,
            status: 'conflict',
            serverRecord: conflict.mergedPayload || undefined,
            reason: conflict.reason,
          });
        } else {
          await this.applyChange(change.tableName, change.recordId, change.operation, change.payload);

          const queueEntry = this.queueRepo.create({
            deviceId,
            tableName: change.tableName,
            recordId: change.recordId,
            operation: change.operation as 'INSERT' | 'UPDATE' | 'DELETE',
            payload: change.payload,
            clientUpdatedAt: new Date(change.clientUpdatedAt),
            status: 'applied',
            idempotencyKey: change.id,
          });
          await this.queueRepo.save(queueEntry);

          results.push({
            changeId: change.id,
            tableName: change.tableName,
            status: 'applied',
          });
        }
      } catch (err: unknown) {
        results.push({
          changeId: change.id,
          tableName: change.tableName,
          status: 'failed',
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const updatedVectors = await this.updateVersionVectors(deviceId, versionVectors);

    const serverChanges = await this.getChangesSince(deviceId, versionVectors);

    const result = {
      status: 'processed',
      results,
      serverVersionVectors: updatedVectors,
      serverChanges,
      serverTimestamp: new Date().toISOString(),
    };

    await this.setIdempotencyResult(idempotencyKey, result);
    await this.evictStaleEntries();

    return result;
  }

  async pullFromServer(deviceId: string, versionVectors: Array<{ tableName: string; serverVersion: number }>) {
    const serverChanges = await this.getChangesSince(deviceId, versionVectors);
    const updatedVectors = await this.versionRepo.find({ where: { deviceId } });

    return {
      serverChanges,
      serverVersionVectors: updatedVectors,
      serverTimestamp: new Date().toISOString(),
    };
  }

  async getConflicts(deviceId: string) {
    return this.queueRepo.find({
      where: { deviceId, status: 'conflict' },
      order: { createdAt: 'DESC' },
    });
  }

  async resolveConflict(id: string, resolution: 'server' | 'client') {
    const entry = await this.queueRepo.findOne({ where: { id } });
    if (!entry) {
      throw new BadRequestException('Conflict record not found');
    }

    if (resolution === 'server') {
      await this.queueRepo.update(id, {
        status: 'applied',
        resolvedAt: new Date(),
        conflictReason: `Resolved — ${resolution} chosen`,
      });
    } else {
      await this.applyChange(entry.tableName, entry.recordId, entry.operation, entry.payload);
      await this.queueRepo.update(id, {
        status: 'applied',
        resolvedAt: new Date(),
        conflictReason: `Resolved — ${resolution} chosen`,
      });
    }

    return { status: 'resolved', conflictId: id, resolution };
  }

  /**
   * D-04: Validate an offline FSM transition against the server's current case state.
   * Returns { status: 'conflict', ... } if the transition is invalid,
   * or null if the transition is valid (caller should proceed with normal apply).
   */
  private async handleFsmTransition(
    recordId: string,
    requestedStatus: string,
    changeId: string,
  ): Promise<{
    changeId: string;
    tableName: string;
    status: 'applied' | 'conflict';
    reason?: string;
    currentState?: string;
    requestedState?: string;
  } | null> {
    try {
      const rows = await this.dataSource.query(
        `SELECT status FROM cases WHERE id = $1 LIMIT 1`,
        [recordId],
      );
      if (rows.length === 0) return null; // record doesn't exist — let normal apply handle it

      const currentStatus: string = rows[0].status || 'pending_assessment';

      if (!isValidFsmTransition(currentStatus, requestedStatus)) {
        // D-04: Transition no longer valid — case state has moved past the expected state
        await this.queueRepo.save(this.queueRepo.create({
          deviceId: '__rejected__', // placeholder — will be updated on conflict save
          tableName: 'cases',
          recordId,
          operation: 'UPDATE' as const,
          payload: { status: requestedStatus, _fsmTransition: true },
          clientUpdatedAt: new Date(),
          status: 'conflict',
          idempotencyKey: changeId,
          conflictReason: `FSM rejected: cannot transition from "${currentStatus}" to "${requestedStatus}"`,
        }));

        return {
          changeId,
          tableName: 'cases',
          status: 'conflict',
          reason: `Cannot transition from "${currentStatus}" to "${requestedStatus}" — the case is now in "${currentStatus}" state.`,
          currentState: currentStatus,
          requestedState: requestedStatus,
        };
      }

      // Transition is valid — return null so the caller proceeds with normal apply+conflict detection
      return null;
    } catch (err) {
      this.logger.error(`FSM check error for case ${recordId}:`, err);
      return null; // Fall through to normal apply on error
    }
  }

  private async getIdempotencyResult(key: string): Promise<unknown | null> {
    // 1. Check in-memory cache first (fast path)
    const cached = this.idempotencyCache.get(key);
    if (cached && (Date.now() - cached.timestamp) < IDEMPOTENCY_TTL_MS) {
      return cached.result;
    }

    // 2. Check DB (survives restarts)
    if (this.idempotencyCache.has(key)) {
      this.idempotencyCache.delete(key);
    }
    try {
      const rows = await this.dataSource.query(
        `SELECT result, created_at FROM idempotency_keys WHERE key = $1`,
        [key]
      );
      if (rows.length > 0) {
        const age = Date.now() - new Date(rows[0].created_at).getTime();
        if (age < IDEMPOTENCY_TTL_MS) {
          // Warm back into in-memory cache
          this.idempotencyCache.set(key, { result: rows[0].result, timestamp: Date.now() });
          return rows[0].result;
        }
        // Key expired — remove from DB
        await this.dataSource.query(`DELETE FROM idempotency_keys WHERE key = $1`, [key]);
      }
    } catch (e) {
      this.logger.warn('Idempotency DB lookup failed (table may not exist yet):', e);
    }
    return null;
  }

  private async setIdempotencyResult(key: string, result: unknown): Promise<void> {
    // In-memory cache
    if (this.idempotencyCache.size >= MAX_CACHE_SIZE) {
      const oldest = this.idempotencyCache.keys().next().value;
      if (oldest) this.idempotencyCache.delete(oldest);
    }
    this.idempotencyCache.set(key, { result, timestamp: Date.now() });

    // DB persistence
    try {
      await this.dataSource.query(
        `INSERT INTO idempotency_keys (key, result, created_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET result = $2`,
        [key, JSON.stringify(result)]
      );
    } catch (e) {
      this.logger.warn('Idempotency DB write failed (table may not exist yet):', e);
    }
  }

  private async evictStaleEntries(): Promise<void> {
    if (this.idempotencyCache.size > MAX_CACHE_SIZE) {
      try {
        await this.dataSource.query(
          `DELETE FROM idempotency_keys WHERE created_at < NOW() - INTERVAL '24 hours'`
        );
      } catch (e) {
        this.logger.warn('Idempotency DB eviction failed:', e);
      }
      // Clear half the in-memory cache
      const entries = [...this.idempotencyCache.entries()];
      for (let i = 0; i < entries.length / 2; i++) {
        this.idempotencyCache.delete(entries[i][0]);
      }
    }
  }

  private async detectConflict(
    tableName: string,
    recordId: string,
    clientPayload: Record<string, any>,
    clientUpdatedAt: string,
  ): Promise<{ reason: string; mergedPayload?: Record<string, any> } | null> {
    const serverRecord = await this.fetchServerRecord(tableName, recordId);
    if (!serverRecord) return null;

    const serverUpdatedAt = serverRecord.updated_at || serverRecord.updatedAt;
    if (!serverUpdatedAt) return null;

    const serverTime = new Date(serverUpdatedAt).getTime();
    const clientTime = new Date(clientUpdatedAt).getTime();

    if (clientTime <= serverTime) return null;

    const resolution = this.conflictResolver.resolve(tableName, serverRecord, clientPayload, clientUpdatedAt);

    if (resolution.action === 'server_wins' || resolution.action === 'append_notes') {
      if (resolution.mergedPayload) {
        await this.applyChange(tableName, recordId, 'UPDATE', resolution.mergedPayload);
      }
      return null;
    }

    return {
      reason: resolution.reason,
      mergedPayload: resolution.mergedPayload || undefined,
    };
  }

  private async applyChange(
    tableName: string,
    recordId: string,
    operation: string,
    payload: Record<string, any>,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const tableNameFull = this.resolveTableName(tableName);
      const safePayload = sanitizePayload(payload);

      if (operation === 'INSERT') {
        safePayload.id = recordId;
        if (!safePayload.created_at) safePayload.created_at = new Date().toISOString();
        safePayload.updated_at = new Date().toISOString();

        const columns = Object.keys(safePayload).join(', ');
        const values = Object.values(safePayload);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        const updateSet = Object.keys(safePayload).map(k => `"${k}" = EXCLUDED."${k}"`).join(', ');

        await queryRunner.query(
          `INSERT INTO "${tableNameFull}" (${columns}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${updateSet}`,
          values,
        );
      } else if (operation === 'UPDATE') {
        safePayload.updated_at = new Date().toISOString();
        const keys = Object.keys(safePayload);
        const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
        const values = Object.values(safePayload);

        await queryRunner.query(
          `UPDATE "${tableNameFull}" SET ${setClause} WHERE id = $${keys.length + 1}`,
          [...values, recordId],
        );
      } else if (operation === 'DELETE') {
        await queryRunner.query(
          `DELETE FROM "${tableNameFull}" WHERE id = $1`,
          [recordId],
        );
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private async fetchServerRecord(
    tableName: string,
    recordId: string,
  ): Promise<Record<string, any> | null> {
    try {
      const tableNameFull = this.resolveTableName(tableName);
      const result = await this.dataSource.query(
        `SELECT * FROM "${tableNameFull}" WHERE id = $1 LIMIT 1`,
        [recordId],
      );
      return result.length > 0 ? result[0] : null;
    } catch (e) {
      this.logger.error("sync lookup error:", e);
      return null;
    }
  }

  private resolveTableName(tableName: string): string {
    const tableMap: Record<string, string> = {
      access_card_services: 'access_card_services',
      cases: 'cases',
      beneficiaries: 'beneficiaries',
      interventions: 'interventions',
      programs: 'programs',
      users: 'users',
      households: 'households',
      family_members: 'family_members',
      consent_ledger: 'consent_ledger',
      irf_cases: 'irf_cases',
      notifications: 'notifications',
      sync_queue: 'sync_queue',
      sync_events: 'sync_events',
    };
    return tableMap[tableName] || tableName;
  }

  private async updateVersionVectors(
    deviceId: string,
    clientVectors: Array<{ tableName: string; localVersion: number; serverVersion: number }>,
  ): Promise<VersionVector[]> {
    const updated: VersionVector[] = [];

    for (const cv of clientVectors) {
      const existing = await this.versionRepo.findOne({
        where: { deviceId, tableName: cv.tableName },
      });

      if (existing) {
        existing.serverVersion = Math.max(existing.serverVersion, cv.serverVersion);
        existing.lastSyncedAt = new Date();
        await this.versionRepo.save(existing);
        updated.push(existing);
      } else {
        const created = this.versionRepo.create({
          deviceId,
          tableName: cv.tableName,
          localVersion: cv.localVersion,
          serverVersion: cv.serverVersion,
          lastSyncedAt: new Date(),
        });
        await this.versionRepo.save(created);
        updated.push(created);
      }
    }

    return updated;
  }

  private async getChangesSince(
    deviceId: string,
    clientVectors: Array<{ tableName: string; serverVersion: number }>,
  ): Promise<Array<Record<string, unknown>>> {
    if (!clientVectors || clientVectors.length === 0) return [];

    const changes: Array<Record<string, unknown>> = [];

    for (const vec of clientVectors) {
      try {
        const tableNameFull = this.resolveTableName(vec.tableName);
        const rows = await this.dataSource.query(
          `SELECT * FROM "${tableNameFull}" WHERE updated_at > $1 OR updated_at IS NULL`,
          [new Date(Date.now() - IDEMPOTENCY_TTL_MS).toISOString()],
        );
        changes.push(...rows.map((r: Record<string, unknown>) => ({
          tableName: vec.tableName,
          recordId: r.id,
          payload: r,
          serverUpdatedAt: r.updated_at || r.created_at,
        })));
      } catch (e) {
        this.logger.error("sync query error:", e);
      }
    }

    return changes;
  }

  private verifySignature(
    signature: string,
    deviceId: string,
    changes: Array<Record<string, unknown>>,
  ): boolean {
    try {
      const crypto = require("crypto");
      const message = JSON.stringify({ deviceId, changes });
      const keyBuffer = Buffer.from(deviceId, 'hex');

      if (keyBuffer.length !== 32) return false;

      const derPrefix = Buffer.from('302a300506032b6570032100', 'hex');
      const pubKey = crypto.createPublicKey({
        key: Buffer.concat([derPrefix, keyBuffer]),
        format: 'der',
        type: 'spki',
      });

      return crypto.verify(
        null,
        Buffer.from(message, 'utf-8'),
        pubKey,
        Buffer.from(signature, 'hex'),
      );
    } catch (e) {
      this.logger.error("sync verify error:", e);
      return false;
    }
  }
}
