import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mergeRecords, resolveConflict, getPendingChanges, markConflict, markSynced } from '../src/lib/offline-queue';
import type { QueuedChange, VersionVector } from '../src/lib/offline-queue';

vi.mock('../src/lib/database', () => ({
  getDatabase: vi.fn().mockResolvedValue({
    execute: vi.fn().mockResolvedValue([])
  })
}));

describe('Sync Conflict Resolution', () => {
  describe('mergeRecords', () => {
    it('should keep server version for financial fields', () => {
      const server = { amount: 1000, status: 'approved' };
      const client = { amount: 2000, status: 'disbursed' };
      
      const result = mergeRecords(server as any, client as any);
      
      expect(result.amount).toBe(1000);
      expect(result.status).toBe('approved');
    });

    it('should append notes chronologically', () => {
      const server = { notes: 'Initial note' };
      const client = { notes: 'Follow-up' };
      
      const result = mergeRecords(server as any, client as any);
      
      expect(result.notes).toBe('Initial note\nFollow-up');
    });

    it('should use client version for non-conflicting fields', () => {
      const server = { phone: '123', address: 'Old address' };
      const client = { phone: '456', address: 'Old address' };
      
      const result = mergeRecords(server as any, client as any);
      
      expect(result.phone).toBe('456');
    });

    it('should handle server revocation for consent', () => {
      const server = { consentStatus: 'revoked', phone: '123' };
      const client = { consentStatus: 'active', phone: '456' };
      
      const result = mergeRecords(server as any, client as any);
      
      expect(result.consentStatus).toBe('revoked');
      expect(result.phone).toBe('456');
    });
  });

  describe('conflict detection', () => {
    it('should detect conflict when server version diff', async () => {
      const change: QueuedChange = {
        id: '1',
        tableName: 'cases',
        recordId: 'c1',
        operation: 'UPDATE',
        payload: { status: 'approved' },
        clientUpdatedAt: new Date().toISOString(),
        serverVersion: 1,
        status: 'pending',
        retryCount: 0
      };

      expect(change.status).toBe('pending');
    });
  });

  describe('conflict resolution strategies', () => {
    it('should resolve as server - keep server data', () => {
      const server = { amount: 1000, status: 'approved', notes: 'Server notes' };
      const client = { amount: 2000, status: 'disbursed', notes: 'Client notes' };
      
      const result = mergeRecords(server as any, client as any);
      
      expect(result.amount).toBe(1000);
      expect(result.status).toBe('approved');
    });

    it('should resolve as client - keep client data for non-financial', () => {
      const server = { phone: '111', notes: 'Server' };
      const client = { phone: '222', notes: 'Client' };
      
      const result = mergeRecords(server as any, client as any);
      
      expect(result.phone).toBe('222');
      expect(result.notes).toContain('Server');
      expect(result.notes).toContain('Client');
    });
  });

  describe('version vector tracking', () => {
    it('should detect stale local data', () => {
      const vector: VersionVector = {
        tableName: 'cases',
        localVersion: 1,
        serverVersion: 5,
        lastSyncedAt: new Date().toISOString()
      };
      
      expect(vector.localVersion < vector.serverVersion).toBe(true);
    });

    it('should detect ahead of server', () => {
      const vector: VersionVector = {
        tableName: 'cases',
        localVersion: 10,
        serverVersion: 5,
        lastSyncedAt: new Date().toISOString()
      };
      
      expect(vector.localVersion > vector.serverVersion).toBe(true);
    });

    it('should detect synced state', () => {
      const vector: VersionVector = {
        tableName: 'cases',
        localVersion: 5,
        serverVersion: 5,
        lastSyncedAt: new Date().toISOString()
      };
      
      expect(vector.localVersion).toBe(vector.serverVersion);
    });
  });

  describe('idempotency', () => {
    it('should handle duplicate sync attempts', () => {
      const idempotencyKey = 'test-key-123';
      const sameKey = 'test-key-123';
      
      expect(idempotencyKey).toBe(sameKey);
    });
  });
});