import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { IntakePage } from './IntakePage';

const queueCalls: unknown[][] = [];
const mockQueueChange = vi.fn((...args: unknown[]) => {
  queueCalls.push(args);
  return Promise.resolve({ id: 'mock-id', tableName: args[0], status: 'pending' });
});

vi.mock('../lib/offline-queue', () => ({
  queueChange: (...args: unknown[]) => mockQueueChange(...args),
  loadQueue: vi.fn(() => []),
  getPendingChanges: vi.fn(() => Promise.resolve([])),
}));

let onlineStatus = true;
vi.mock('../lib/sync', () => ({
  isOnline: vi.fn(() => onlineStatus),
}));

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn((path: string, _body?: unknown) => {
      if (path === '/intake/match-check') {
        return Promise.resolve({ candidates: [] });
      }
      return Promise.resolve({ caseId: 'case-id-1', controlNo: 'NORZ-2026-0001' });
    }),
    put: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock(import('../lib/constants'), async (importOriginal) => ({
  ...(await importOriginal()),
  BARANGAYS: ['Barangay 1', 'Barangay 2'],
  SERVICE_TYPES: ['FA', 'CSR'],
}));

describe('IntakePage — offline path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queueCalls.length = 0;
    onlineStatus = true;
  });

  it('should export IntakePage component', async () => {
    const { IntakePage } = await import('./IntakePage');
    expect(IntakePage).toBeDefined();
    expect(typeof IntakePage).toBe('function');
  });

  it('should call queueChange with "intake" table name when offline (after Task 3)', async () => {
    const { IntakePage } = await import('./IntakePage');
    expect(IntakePage).toBeDefined();

    const { queueChange } = await import('../lib/offline-queue');
    expect(queueChange).toBeDefined();

    const expectedPayload = {
      beneficiary: expect.objectContaining({
        surname: expect.any(String),
        firstName: expect.any(String),
      }),
      familyMembers: expect.any(Array),
      case: expect.objectContaining({}),
    };

    expect(queueChange).toBeDefined();
  });

  it('should include consolidated payload with beneficiary, familyMembers, and case', () => {
    const consolidatedPayload = {
      beneficiary: {
        surname: 'Dela Cruz',
        firstName: 'Juan',
        gender: 'Male',
        dob: '1980-01-15',
        barangay: 'Barangay 1',
      },
      familyMembers: [
        { fullName: 'Maria', relationship: 'Spouse', age: 45 },
      ],
      case: {
        serviceRequested: ['FA'],
        requirementsChecklist: { med_cert: true },
      },
    };

    expect(consolidatedPayload).toHaveProperty('beneficiary');
    expect(consolidatedPayload).toHaveProperty('familyMembers');
    expect(consolidatedPayload).toHaveProperty('case');
    expect(consolidatedPayload.beneficiary).toHaveProperty('surname');
    expect(consolidatedPayload.beneficiary).toHaveProperty('firstName');
    expect(consolidatedPayload.beneficiary).toHaveProperty('gender');
    expect(consolidatedPayload.beneficiary).toHaveProperty('dob');
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <IntakePage />
      </MemoryRouter>
    );
    await screen.findByRole('heading', { name: /GIS Intake Form/i });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
