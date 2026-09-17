import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { ProgramsPage } from './ProgramsPage';

const { mockApiGet, mockApiPost, mockApiPut, mockApiDel } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPut: vi.fn(),
  mockApiDel: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
    del: (...args: unknown[]) => mockApiDel(...args),
  },
}));

vi.mock('../lib/auth-context', () => ({
  getCurrentUser: () => Promise.resolve({ id: 'user-1', role: 'admin', name: 'Admin User' }),
}));

describe('ProgramsPage', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue([]);
  });

  it('renders PageShell heading', async () => {
    render(<MemoryRouter><ProgramsPage /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Programs' })).toBeTruthy();
  });

  it('has no a11y violations', async () => {
    const { container } = render(<MemoryRouter><ProgramsPage /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Programs' });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('lists every required document per program', async () => {
    mockApiGet.mockResolvedValue([
      {
        id: 'p1',
        name: 'Medical Assistance',
        category: 'Health',
        isActive: true,
        requiredDocuments: ['Certificate of Indigency', 'Valid ID', 'Medical Abstract'],
      },
      {
        id: 'p2',
        name: 'Burial Assistance',
        category: 'Crisis',
        isActive: false,
        requiredDocuments: ['Death Certificate', 'Burial Invoice'],
      },
      {
        id: 'p3',
        name: 'No Docs Program',
        isActive: true,
        requiredDocuments: [],
      },
    ]);

    render(<MemoryRouter><ProgramsPage /></MemoryRouter>);
    expect(await screen.findByText('Medical Assistance')).toBeTruthy();
    expect(screen.getByText('Certificate of Indigency')).toBeTruthy();
    expect(screen.getByText('Medical Abstract')).toBeTruthy();
    expect(screen.getByText('Death Certificate')).toBeTruthy();
    expect(screen.getByText('Burial Invoice')).toBeTruthy();
    expect(screen.queryByText(/Docs:/)).toBeNull();
    expect(screen.getAllByText(/Required Documents/).length).toBe(2);
  });
});
