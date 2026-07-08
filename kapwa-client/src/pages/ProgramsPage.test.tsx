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
    expect(await screen.findByRole('heading', { name: /Programs/i })).toBeTruthy();
  });

  it('has no a11y violations', async () => {
    const { container } = render(<MemoryRouter><ProgramsPage /></MemoryRouter>);
    await screen.findByRole('heading', { name: /Programs/i });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
