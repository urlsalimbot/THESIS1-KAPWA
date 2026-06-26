import * as crypto from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncQueue } from './sync-queue.entity';

export interface ConflictResult {
  action: 'server_wins' | 'client_wins' | 'append_notes' | 'queued';
  mergedPayload: Record<string, any> | null;
  reason: string;
}

@Injectable()
export class ConflictResolver {
  constructor(
    @InjectRepository(SyncQueue)
    private readonly queueRepo: Repository<SyncQueue>,
  ) {}

  private readonly FINANCIAL_TABLES = new Set(['interventions', 'disbursements', 'financial_assistance']);
  private readonly NOTE_TABLES = new Set(['case_notes', 'activity_logs', 'remarks']);
  private readonly CONSENT_TABLES = new Set(['consent_ledger']);

  resolve(
    tableName: string,
    serverRecord: Record<string, any> | null,
    clientPayload: Record<string, any>,
    clientUpdatedAt: string,
  ): ConflictResult {
    if (!serverRecord) {
      return {
        action: 'client_wins',
        mergedPayload: clientPayload,
        reason: 'No server record — client create accepted',
      };
    }

    if (this.FINANCIAL_TABLES.has(tableName)) {
      return this.resolveFinancial(tableName, serverRecord, clientPayload);
    }

    if (this.NOTE_TABLES.has(tableName)) {
      return this.resolveNotes(serverRecord, clientPayload, clientUpdatedAt);
    }

    if (this.CONSENT_TABLES.has(tableName)) {
      return {
        action: 'server_wins',
        mergedPayload: { ...serverRecord },
        reason: 'Consent ledger — server revocation overrides client',
      };
    }

    return this.resolveDefault(serverRecord, clientPayload, clientUpdatedAt);
  }

  private resolveFinancial(
    tableName: string,
    serverRecord: Record<string, any>,
    clientPayload: Record<string, any>,
  ): ConflictResult {
    return {
      action: 'server_wins',
      mergedPayload: { ...serverRecord },
      reason: `Financial table '${tableName}' — server record authoritative`,
    };
  }

  private resolveNotes(
    serverRecord: Record<string, any>,
    clientPayload: Record<string, any>,
    clientUpdatedAt: string,
  ): ConflictResult {
    const serverNotes = this.parseNotes(serverRecord.content || serverRecord.notes || '');
    const clientNotes = this.parseNotes(clientPayload.content || clientPayload.notes || '');

    const existingIds = new Set(serverNotes.map((n: any) => n.id));
    const newNotes = clientNotes.filter((n: any) => !existingIds.has(n.id));

    if (newNotes.length === 0) {
      return {
        action: 'server_wins',
        mergedPayload: { ...serverRecord },
        reason: 'No new notes to append',
      };
    }

    const mergedContent = [...serverNotes, ...newNotes];
    const mergedPayload = {
      ...serverRecord,
      content: JSON.stringify(mergedContent),
      notes: JSON.stringify(mergedContent),
      mergedAt: new Date().toISOString(),
    };

    return {
      action: 'append_notes',
      mergedPayload,
      reason: `Appended ${newNotes.length} new note(s) from client`,
    };
  }

  resolveDefault(
    serverRecord: Record<string, any>,
    clientPayload: Record<string, any>,
    clientUpdatedAt: string,
  ): ConflictResult {
    const serverTime = new Date(serverRecord.updated_at || serverRecord.updatedAt || 0);
    const clientTime = new Date(clientUpdatedAt);

    if (clientTime > serverTime) {
      const merged = { ...serverRecord, ...clientPayload, updated_at: new Date().toISOString() };
      return {
        action: 'client_wins',
        mergedPayload: merged,
        reason: 'Client version is newer — merged client changes',
      };
    }

    return {
      action: 'server_wins',
      mergedPayload: { ...serverRecord },
      reason: 'Server version is newer or equal — server authoritative',
    };
  }

  async resortToQueue(
    syncQueueId: string,
    reason: string,
    payload: Record<string, any>,
  ): Promise<ConflictResult> {
    await this.queueRepo.update(syncQueueId, {
      status: 'conflict',
      conflictReason: reason,
    });

    return {
      action: 'queued',
      mergedPayload: payload,
      reason,
    };
  }

  private parseNotes(raw: string | Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    if (Array.isArray(raw)) return raw;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return raw ? [{ id: crypto.createHash('md5').update(raw).digest('hex'), text: raw }] : [];
    }
  }
}
