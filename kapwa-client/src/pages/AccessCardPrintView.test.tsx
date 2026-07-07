import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AccessCardPrintView } from './AccessCardPrintView';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
  },
}));

describe('AccessCardPrintView', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue({
      code: 'NORZ-AC-2026-0001',
      beneficiary: {
        id: 'BEN-001',
        surname: 'Dela Cruz',
        first_name: 'Juan',
        barangay: 'Barangay 1',
      },
      services: [
        { service_date: '2026-06-28', service_rendered: 'FA', agency: 'MSWDO' },
      ],
    });
  });

  it('renders page shell for beneficiary card print route', async () => {
    render(
      <MemoryRouter initialEntries={['/beneficiaries/BEN-001/card/print']}>
        <Routes>
          <Route path="/beneficiaries/:id/card/print" element={<AccessCardPrintView />} />
        </Routes>
      </MemoryRouter>
    );
    expect((await screen.findAllByText(/NORZ-AC-2026-0001|Print Card/i, {}, { timeout: 3000 })).length).toBeGreaterThan(0);
  });
});
