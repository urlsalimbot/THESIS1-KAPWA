import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { IrfDetailPage } from './IrfDetailPage';

const { mockApiGet, mockApiPost, mockApiPut, mockUseAuth } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPut: vi.fn(),
  mockUseAuth: vi.fn(),
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

vi.mock('@/lib/auth-context', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
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
    mockUseAuth.mockReturnValue({ user: { role: 'admin' } });
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
    mockUseAuth.mockReturnValue({ user: { role: 'social_worker' } });
    const { container } = render(
      <MemoryRouter initialEntries={['/irf/IRF-001']}>
        <Routes>
          <Route path="/irf/:id" element={<IrfDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText('IRF List');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('shows the Evidence Photos section to an admin and loads photos', async () => {
    mockApiGet.mockResolvedValueOnce({
      id: 'IRF-001',
      blotterEntryNumber: 'BLT-2026-0001',
      caseCategory: 'Physical Assault',
      caseDisposition: 'Under Investigation',
      datetimeReported: '2026-06-15T10:00:00Z',
      datetimeIncident: '2026-06-14T20:00:00Z',
      itemAReportingPerson: { name: 'Jane Doe' },
      itemBPersonReported: { surname: 'Doe', firstName: 'John' },
    });
    mockApiGet.mockResolvedValueOnce([
      { id: 'photo-1', originalName: 'scene.jpg', fileSize: 2048, mimeType: 'image/jpeg' },
    ]);
    render(
      <MemoryRouter initialEntries={['/irf/IRF-001']}>
        <Routes>
          <Route path="/irf/:id" element={<IrfDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect((await screen.findAllByRole('heading', { name: 'Evidence Photos' }, { timeout: 3000 })).length).toBeGreaterThan(0);
    await screen.findByText('scene.jpg');
    expect(mockApiGet).toHaveBeenCalledWith('/filing/irf/IRF-001/photos');
  });

  it('shows the Evidence Photos upload control to a social_worker without loading the photo list', async () => {
    mockUseAuth.mockReturnValue({ user: { role: 'social_worker' } });
    render(
      <MemoryRouter initialEntries={['/irf/IRF-001']}>
        <Routes>
          <Route path="/irf/:id" element={<IrfDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: 'Evidence Photos' }, { timeout: 3000 })).toBeTruthy();
    expect(await screen.findByText('Click to browse or drop files')).toBeTruthy();
    expect(mockApiGet).not.toHaveBeenCalledWith('/filing/irf/IRF-001/photos');
  });
});
