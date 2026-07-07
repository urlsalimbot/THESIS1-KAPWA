import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { Topbar } from './Topbar';

const mockUseAuth = vi.hoisted(() => vi.fn(() => ({
  user: { id: '1', email: 'a@b.com', fullName: 'A B', role: 'social_worker' },
  token: 'test-tok',
  loading: false,
  login: vi.fn(),
  logout: vi.fn(),
  mfaChallenge: null,
  resolveMfa: vi.fn(),
  cancelMfa: vi.fn(),
})));

vi.mock('../lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/lib/theme-context', () => ({
  useTheme: () => ({ theme: 'light', resolvedTheme: 'light', setTheme: vi.fn() }),
}));

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter initialEntries={['/dashboard']}>{ui}</MemoryRouter>);
}

describe('Topbar', () => {
  it('renders without crashing', () => {
    const { container } = renderWithRouter(<Topbar />);
    expect(container.querySelector('header')).toBeTruthy();
  });

  it('shows role-gated buttons (New Intake, Approvals Queue) for social_worker', () => {
    renderWithRouter(<Topbar />);
    expect(screen.getByLabelText('New Intake')).toBeTruthy();
    expect(screen.getByLabelText('Approvals Queue')).toBeTruthy();
  });

  it('hides role-gated buttons for claimant role', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'a@b.com', fullName: 'A B', role: 'claimant' },
      token: 'test-tok',
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      mfaChallenge: null,
      resolveMfa: vi.fn(),
      cancelMfa: vi.fn(),
    });
    renderWithRouter(<Topbar />);
    expect(screen.queryByLabelText('New Intake')).toBeNull();
    expect(screen.queryByLabelText('Approvals Queue')).toBeNull();
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'a@b.com', fullName: 'A B', role: 'social_worker' },
      token: 'test-tok',
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      mfaChallenge: null,
      resolveMfa: vi.fn(),
      cancelMfa: vi.fn(),
    });
  });

  it('has no axe violations', async () => {
    const { container } = renderWithRouter(<Topbar />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
