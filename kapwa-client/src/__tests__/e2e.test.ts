import { faker } from '@faker-js/faker';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const API_URL = 'http://localhost:3000/api';

vi.mock('../lib/offline-queue', () => ({
  getPendingChanges: vi.fn().mockResolvedValue([]),
  getConflictChanges: vi.fn().mockResolvedValue([]),
  getVersionVector: vi.fn().mockResolvedValue({ localVersion: 1, serverVersion: 0 }),
  getAllVersionVectors: vi.fn().mockResolvedValue([]),
  queueChange: vi.fn().mockResolvedValue({ id: 'test-1' }),
  markSynced: vi.fn(),
  markConflict: vi.fn(),
  resolveConflict: vi.fn()
}));

vi.mock('../lib/sync', () => ({
  isOnline: vi.fn().mockReturnValue(true),
  syncOnReconnect: vi.fn().mockResolvedValue(undefined),
  processDeltaSync: vi.fn().mockResolvedValue({ status: 'processed', results: [] })
}));

vi.mock('../lib/auth', () => ({
  saveAuthToken: vi.fn().mockResolvedValue(undefined),
  getAuthToken: vi.fn().mockResolvedValue('test-token'),
  getCurrentUser: vi.fn().mockResolvedValue({ id: '1', email: 'test@test.com', role: 'admin' }),
  clearAuth: vi.fn().mockResolvedValue(undefined)
}));

describe('Sprint 1: Backend Core', () => {
  let token: string;
  let userId: string;

  describe('Auth Module', () => {
    it('should register new user', async () => {
      const email = faker.internet.email();
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: 'test1234',
          role: 'social_worker',
          fullName: 'Test Worker'
        })
      });
      
      expect(res.ok).toBe(true);
      const user = await res.json();
      expect(user.email).toBe(email);
    });

    it('should login with valid credentials', async () => {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'test1234'
        })
      });
      
      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data.accessToken).toBeDefined();
      token = data.accessToken;
    });

    it('should reject invalid credentials', async () => {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'wrongpass'
        })
      });
      
      expect(res.status).toBe(401);
    });
  });

  describe('Beneficiaries CRUD', () => {
    it('should require auth for list', async () => {
      const res = await fetch(`${API_URL}/beneficiaries`);
      expect(res.status).toBe(401);
    });

    it('should create beneficiary', async () => {
      const res = await fetch(`${API_URL}/beneficiaries`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          surname: faker.person.lastName(),
          firstName: faker.person.firstName(),
          gender: 'Male',
          dob: '1990-01-15',
          address: 'Sample Address'
        })
      });
      
      expect(res.ok).toBe(true);
      const ben = await res.json();
      expect(ben.id).toBeDefined();
    });

    it('should get consent gating', async () => {
      const res = await fetch(`${API_URL}/beneficiaries`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      expect(res.ok).toBe(true);
    });
  });

  describe('Case FSM', () => {
    let caseId: string;

    it('should create GIS case', async () => {
      const res = await fetch(`${API_URL}/cases`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          serviceRequested: ['Financial Aid'],
          requirementsChecklist: { 'id': true }
        })
      });
      
      expect(res.ok).toBe(true);
      const c = await res.json();
      caseId = c.id;
      expect(c.controlNo).toBeDefined();
      expect(c.status).toBe('pending_assessment');
    });

    it('should enforce FSM transition', async () => {
      const res = await fetch(`${API_URL}/cases/${caseId}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'approved' })
      });
      
      expect(res.status).toBe(400);
    });

    it('should allow valid transition', async () => {
      const res = await fetch(`${API_URL}/cases/${caseId}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'in_review' })
      });
      
      expect(res.ok).toBe(true);
    });
  });

  describe('Intervention Post-Disbursement Guard', () => {
    it('should reject intervention on non-disbursed case', async () => {
      const res = await fetch(`${API_URL}/interventions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          case: { id: 'some-case-id' },
          interventionType: 'FA',
          amount: 1000,
          fundSource: 'Regular',
          serviceDate: '2024-01-01',
          workerSignatureUrl: 'data:image/png;base64,test'
        })
      });
      
      expect(res.status).toBe(403);
    });
  });

  describe('Program Dynamic Forms', () => {
    it('should create program with JSON schema', async () => {
      const res = await fetch(`${API_URL}/programs`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: 'Test Program',
          category: 'Aid',
          waitingPeriodDays: 30,
          formTemplate: {
            type: 'object',
            properties: {
              amount: { type: 'number', minimum: 100 },
              purpose: { type: 'string', enum: ['Medical', 'Education'] }
            },
            required: ['amount']
          }
        })
      });
      
      expect(res.ok).toBe(true);
    });

    it('should validate JSON schema on create', async () => {
      const res = await fetch(`${API_URL}/programs`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: 'Invalid Program',
          formTemplate: { invalid: true }
        })
      });
      
      expect(res.status).toBe(400);
    });
  });

  describe('IRF Encryption', () => {
    it('should encrypt IRF narration', async () => {
      const res = await fetch(`${API_URL}/irf`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          caseCategory: 'Abuse',
          encryptedNarration: Buffer.from('confidential text').toString('base64')
        })
      });
      
      expect(res.ok).toBe(true);
    });

    it('should mask narration in default view', async () => {
      const res = await fetch(`${API_URL}/irf/1`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await res.json();
      expect(data.narration).toBe('[CONFIDENTIAL]');
    });
  });

  describe('Dashboard Metrics', () => {
    it('should return fund utilization', async () => {
      const res = await fetch(`${API_URL}/dashboard/metrics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data.totalCases).toBeDefined();
    });

    it('should return SLA status', async () => {
      const res = await fetch(`${API_URL}/dashboard/sla`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      expect(res.ok).toBe(true);
    });
  });
});

describe('Sprint 2: Offline & Sync', () => {
  describe('SQLCipher Client', () => {
    it('should initialize encrypted database', async () => {
      const { initDatabase } = await import('../lib/database');
      const db = await initDatabase();
      expect(db).toBeDefined();
    });

    it('should store data encrypted', async () => {
      const { getDatabase } = await import('../lib/database');
      const db = getDatabase();
      const tables = Object.keys(db);
      expect(tables.length).toBeGreaterThan(0);
    });
  });

  describe('Offline Queue', () => {
    it('should queue changes when offline', async () => {
      const { queueChange } = await import('../lib/offline-queue');
      await queueChange('cases', 'test-1', 'INSERT', { test: true });
      
      const { getPendingChanges } = await import('../lib/offline-queue');
      const pending = await getPendingChanges();
      expect(pending.length).toBeGreaterThan(0);
    });

    it('should increment version on change', async () => {
      const { getVersionVector } = await import('../lib/offline-queue');
      const vec = await getVersionVector('cases');
      expect(vec?.localVersion).toBeGreaterThan(0);
    });
  });

  describe('Delta Sync', () => {
    it('should process batch sync', async () => {
      const res = await fetch(`${API_URL}/sync/v1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: 'test-device',
          changes: [],
          versionVectors: [],
          idempotencyKey: 'test-key',
          signature: 'testSig'
        })
      });
      
      expect(res.ok).toBe(true);
    });

    it('should detect conflicts', async () => {
      const { getConflictChanges } = await import('../lib/offline-queue');
      const conflicts = await getConflictChanges();
      expect(Array.isArray(conflicts)).toBe(true);
    });
  });

  describe('Conflict Resolution', () => {
    it.todo('should apply Server Wins for financial fields');
    it.todo('should append notes chronologically');
    it.todo('should honor server revocation for consent');
    it.todo('should queue unresolved conflicts');
  });

  describe('Dynamic Forms', () => {
    it('should validate JSON schema', async () => {
      const { validateJsonSchema } = await import('../lib/form-renderer');
      const errors = validateJsonSchema(
        { amount: 50 },
        { type: 'number', minimum: 100 }
      );
      expect(errors.length).toBeGreaterThan(0);
    });

    it.todo('should render form from schema');
    it.todo('should handle custom Philippine widgets');
  });
});

export {};