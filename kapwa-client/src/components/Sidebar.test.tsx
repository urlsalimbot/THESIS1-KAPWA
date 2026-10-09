import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { Sidebar } from './Sidebar';

const { mockRole } = vi.hoisted(() => ({ mockRole: { current: 'social_worker' } }));

vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'a@b.com', fullName: 'A B', role: mockRole.current },
    token: 'test-tok',
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    mfaChallenge: null,
    resolveMfa: vi.fn(),
    cancelMfa: vi.fn(),
  }),
}));

function renderWithRouter(ui: React.ReactElement, { initialEntries = ['/'] } = {}) {
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
}

function activeHrefs(): string[] {
  return [...document.querySelectorAll('a')]
    .filter(link => link.classList.contains('bg-muted'))
    .map(link => link.getAttribute('href') ?? '');
}

describe('Sidebar', () => {
  it('renders without crashing', () => {
    const { container } = renderWithRouter(<Sidebar />);
    expect(container.querySelector('aside')).toBeTruthy();
    expect(container.querySelector('nav[aria-label="Main navigation"]')).toBeTruthy();
  });

  it('shows role-gated nav items for social_worker', () => {
    renderWithRouter(<Sidebar />);
    expect(screen.getByText('Cases')).toBeTruthy();
    expect(screen.getByText('Beneficiaries')).toBeTruthy();
  });

  it('active link has bg-muted class when URL matches', () => {
    renderWithRouter(<Sidebar />, { initialEntries: ['/cases'] });
    const links = document.querySelectorAll('a');
    let activeLink: Element | null = null;
    links.forEach(link => {
      if (link.classList.contains('bg-muted')) {
        activeLink = link;
      }
    });
    expect(activeLink).toBeTruthy();
    expect((activeLink as unknown as HTMLElement)?.getAttribute('href')).toBe('/cases');
  });

  it('on /admin/programs only Programs is highlighted, not the Admin Panel ancestor', () => {
    mockRole.current = 'admin';
    renderWithRouter(<Sidebar />, { initialEntries: ['/admin/programs'] });
    expect(activeHrefs()).toEqual(['/admin/programs']);
  });

  it('on /admin only Admin Panel is highlighted', () => {
    mockRole.current = 'admin';
    renderWithRouter(<Sidebar />, { initialEntries: ['/admin'] });
    expect(activeHrefs()).toEqual(['/admin']);
  });

  it('keeps a parent highlight on detail routes (Cases on /cases/:id)', () => {
    renderWithRouter(<Sidebar />, { initialEntries: ['/cases/abc123'] });
    expect(activeHrefs()).toEqual(['/cases']);
  });

  it('offers Client Deduplication to staff roles', () => {
    mockRole.current = 'social_worker';
    renderWithRouter(<Sidebar />);
    expect(screen.getByRole('link', { name: /client deduplication/i })).toBeTruthy();
    document.body.innerHTML = '';
    mockRole.current = 'admin';
    renderWithRouter(<Sidebar />);
    expect(screen.getByRole('link', { name: /client deduplication/i })).toBeTruthy();
  });

  it('hides Client Deduplication from claimants', () => {
    mockRole.current = 'claimant';
    renderWithRouter(<Sidebar />);
    expect(screen.queryByRole('link', { name: /client deduplication/i })).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = renderWithRouter(<Sidebar />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
