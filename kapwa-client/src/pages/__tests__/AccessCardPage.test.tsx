import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AccessCardPage } from '../AccessCardPage';

const { mockServices } = vi.hoisted(() => ({
  mockServices: [
    {
      id: 'SL-001',
      accessCardCode: 'NORZ-AC-2026-0001',
      serviceType: 'FA',
      serviceDate: '2026-06-28',
      servedBy: 'SW Juan',
      remarks: 'Monthly assistance',
      createdAt: '2026-06-28T00:00:00Z',
    },
  ],
}));

vi.mock('../../lib/api', () => ({
  assignCard: vi.fn(),
  getBeneficiaryCard: vi.fn(),
}));

describe('AccessCardPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockServices),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders PageShell heading', async () => {
    render(<MemoryRouter><AccessCardPage /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Access Cards' })).toBeTruthy();
  });

  it('renders card sections', async () => {
    render(<MemoryRouter><AccessCardPage /></MemoryRouter>);
    expect(await screen.findByText('Generate & Assign Access Card', {}, { timeout: 3000 })).toBeTruthy();
    expect(await screen.findByText('Quick Print — Card View')).toBeTruthy();
    expect(await screen.findByText('Look Up Beneficiary Card')).toBeTruthy();
    expect(await screen.findByText('Log Service to Access Card')).toBeTruthy();
  });
});
