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
    // A quiet list: each program is one link row; status and meta are inline.
    const links = await screen.findAllByRole('link');
    expect(links).toHaveLength(3);
    expect(links[0].getAttribute('href')).toBe('/admin/programs/p1');
    expect(screen.getByText('Medical Assistance')).toBeTruthy();
    expect(screen.getByText('Burial Assistance')).toBeTruthy();
    expect(screen.getByText('No Docs Program')).toBeTruthy();
    // The filter row reports the counts instead of stat cards.
    expect(screen.getByRole('button', { name: /Total/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Inactive/ })).toBeTruthy();
    expect(screen.queryByText(/Required Documents/)).toBeNull();
  });
});
