import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { FourPsCompliancePage } from './FourPsCompliancePage';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
  },
}));

function renderPage() {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
      <MemoryRouter initialEntries={['/cases/C-1/4ps-compliance']}>
        <Routes>
          <Route path="/cases/:caseId/4ps-compliance" element={<FourPsCompliancePage />} />
        </Routes>
      </MemoryRouter>
    </SWRConfig>,
  );
}

describe('FourPsCompliancePage', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('context')) {
        return Promise.resolve({
          controlNo: 'KAPWA-2026-00012',
          beneficiaryId: 'ben-1',
          accessCardCode: 'NORZ-AC-2026-0001',
          members: [
            { id: 'hm-1', fullName: 'Elena Dela Cruz', relationship: 'Spouse', age: 69, occupation: 'Housewife', income: 0, status: null, isPrimary: false },
          ],
        });
      }
      if (k.includes('compliance')) return Promise.resolve({ total: 0, complied: 0, rate: 0, byType: {}, entries: [] });
      if (k.includes('payouts')) return Promise.resolve([]);
      return Promise.resolve(null);
    });
  });

  it('loads the household from the 4Ps context, never the case-detail endpoint', async () => {
    renderPage();
    // Wait for the context to resolve (the access-card action proves it did),
    // then open the Household tab.
    await screen.findByText('NORZ-AC-2026-0001');
    // Radix Tabs activates on mousedown, not click.
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Household/i }));
    expect(await screen.findByText('Elena Dela Cruz')).toBeInTheDocument();

    // Coordinators may use the 4Ps endpoints but not read case details, so the
    // page must not fetch `['cases', id]`.
    const keys = mockApiGet.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(keys.some((k) => k === JSON.stringify(['cases', 'C-1']))).toBe(false);
  });

  it('links to the household access card from the context', async () => {
    renderPage();
    expect(await screen.findByText('NORZ-AC-2026-0001')).toBeInTheDocument();
  });
});
