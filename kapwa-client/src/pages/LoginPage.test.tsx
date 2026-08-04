import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { LoginPage } from './LoginPage';
import { ROLE_REDIRECT_MAP, NOTIFICATION_ROLES, CHAT_ROLES } from '@/lib/role-access';

const mockLogin = vi.fn();
const mockResolveMfa = vi.fn();
const mockCancelMfa = vi.fn();

const mockMfaChallenge = vi.hoisted(() => ({ current: null as { tempToken: string } | null }));

vi.mock('../lib/auth-context', () => ({
  useAuth: vi.fn(() => ({
    user: null,
    token: null,
    login: mockLogin,
    logout: vi.fn(),
    loading: false,
    mfaChallenge: mockMfaChallenge.current,
    resolveMfa: mockResolveMfa,
    cancelMfa: mockCancelMfa,
  })),
}));

vi.mock('react-hook-form', () => ({
  useForm: vi.fn(() => ({
    register: vi.fn(),
    handleSubmit: vi.fn((cb) => (e: any) => { e?.preventDefault?.(); cb({ email: 'test@test.com', password: 'password' }); }),
    formState: { errors: {}, isSubmitting: false },
    control: {},
    reset: vi.fn(),
  })),
  Controller: vi.fn(),
  useController: vi.fn(),
}));

vi.mock('@hookform/resolvers/zod', () => ({ zodResolver: vi.fn(() => (data: any) => ({ values: data, errors: {} })) }));

vi.mock('../components/ui/form', () => ({
  Form: ({ children }: any) => <div data-testid="form">{children}</div>,
  FormField: ({ render }: any) => render({ field: { value: '', onChange: vi.fn() } }),
  FormItem: ({ children }: any) => <div>{children}</div>,
  FormLabel: ({ children }: any) => <label>{children}</label>,
  FormControl: ({ children }: any) => <div>{children}</div>,
  FormMessage: () => <div data-testid="form-message" />,
}));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMfaChallenge.current = null;
  });

  it('renders brand title', () => {
    render(<BrowserRouter><LoginPage /></BrowserRouter>);
    expect(screen.getByText('Welcome to KAPWA')).toBeTruthy();
  });

  it('renders login form with email and password fields', () => {
    render(<BrowserRouter><LoginPage /></BrowserRouter>);
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('Password')).toBeTruthy();
  });

  it('renders submit button with Sign In text', () => {
    render(<BrowserRouter><LoginPage /></BrowserRouter>);
    expect(screen.getByText('Sign In')).toBeTruthy();
  });

  it('renders Register as claimant link', () => {
    render(<BrowserRouter><LoginPage /></BrowserRouter>);
    expect(screen.getByText('Register as claimant')).toBeTruthy();
  });

  it('shows MFA screen when mfaChallenge is set', () => {
    mockMfaChallenge.current = { tempToken: 'abc123' };
    render(<BrowserRouter><LoginPage /></BrowserRouter>);
    expect(screen.getByText('Two-Factor Authentication')).toBeTruthy();
    expect(screen.getByText('Verify')).toBeTruthy();
  });

  it('has no a11y violations', async () => {
    const { container } = render(<BrowserRouter><LoginPage /></BrowserRouter>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('role-access constants', () => {
  it('redirect map covers every known role', () => {
    const roles = ['social_worker', 'admin', 'coordinator', 'claimant', 'mayor', 'auditor', 'agency_staff'];
    for (const r of roles) {
      expect(ROLE_REDIRECT_MAP[r]).toBeDefined();
    }
  });

  it('notification roles are mutually consistent with server @Roles', () => {
    expect(NOTIFICATION_ROLES).toContain('admin');
    expect(NOTIFICATION_ROLES).toContain('auditor');
  });

  it('chat roles exclude mayor, auditor, agency_staff', () => {
    expect(CHAT_ROLES).not.toContain('mayor');
    expect(CHAT_ROLES).not.toContain('auditor');
    expect(CHAT_ROLES).not.toContain('agency_staff');
  });
});
