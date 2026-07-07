import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { IrfDetailPage } from './IrfDetailPage';

const { mockApiGet, mockApiPost, mockApiPut } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPut: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
    del: vi.fn(),
  },
  exportIrfPdf: vi.fn(),
}));

describe('IrfDetailPage', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue({
      id: 'IRF-001',
      blotterEntryNumber: 'BLT-2026-0001',
      caseCategory: 'Physical Assault',
      caseDisposition: 'Under Investigation',
      datetimeReported: '2026-06-15T10:00:00Z',
      datetimeIncident: '2026-06-14T20:00:00Z',
      itemAReportingPerson: { name: 'Jane Doe' },
      itemBPersonReported: { surname: 'Doe', firstName: 'John' },
    });
  });

  it('renders page shell for IRF id route', async () => {
    render(
      <MemoryRouter initialEntries={['/irf/IRF-001']}>
        <Routes>
          <Route path="/irf/:id" element={<IrfDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect((await screen.findAllByRole('heading', { name: /IRF: BLT-2026-0001/i }, { timeout: 3000 })).length).toBeGreaterThan(0);
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/irf/IRF-001']}>
        <Routes>
          <Route path="/irf/:id" element={<IrfDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText('← IRF List');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
