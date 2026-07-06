import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { AccessCardPage } from './AccessCardPage';

const { mockApiGet, mockApiPost } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
}));

const mockServices = [
  {
    id: 'SL-001',
    accessCardCode: 'NORZ-AC-2026-0001',
    serviceType: 'FA',
    serviceDate: '2026-06-28',
    servedBy: 'SW Juan',
    remarks: 'Monthly assistance',
    createdAt: '2026-06-28T00:00:00Z',
  },
];

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: vi.fn(),
    del: vi.fn(),
  },
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}

describe('AccessCardPage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('accessCards') && k.includes('list')) return Promise.resolve(mockServices);
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders PageShell heading', async () => {
    renderWithSWR(<AccessCardPage />);
    expect(await screen.findByRole('heading', { name: 'Access Cards' })).toBeTruthy();
  });

  it('renders card sections', async () => {
    renderWithSWR(<AccessCardPage />);
    expect(await screen.findByText('Generate & Assign Access Card', {}, { timeout: 3000 })).toBeTruthy();
    expect(await screen.findByText('Quick Print — Card View')).toBeTruthy();
    expect(await screen.findByText('Look Up Beneficiary Card')).toBeTruthy();
    expect(await screen.findByText('Log Service to Access Card')).toBeTruthy();
  });
});
