import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { Sidebar } from './Sidebar';

vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'a@b.com', fullName: 'A B', role: 'social_worker' },
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

describe('Sidebar', () => {
  it('renders without crashing', () => {
    const { container } = renderWithRouter(<Sidebar />);
    expect(container.querySelector('aside')).toBeTruthy();
    expect(container.querySelector('nav[aria-label="Main navigation"]')).toBeTruthy();
  });

  it('shows role-gated nav items for social_worker', () => {
    renderWithRouter(<Sidebar />);
    expect(screen.getByText('Case Tracker')).toBeTruthy();
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
    expect(activeLink?.getAttribute('href')).toBe('/cases');
  });

  it('has no axe violations', async () => {
    const { container } = renderWithRouter(<Sidebar />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
