import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { LoginPage } from '../../src/pages/LoginPage';

const mockLogin = vi.fn();
const mockResolveMfa = vi.fn();
const mockCancelMfa = vi.fn();

vi.mock('../../src/lib/auth-context', () => ({
  useAuth: vi.fn(() => ({
    user: null,
    token: null,
    login: mockLogin,
    logout: vi.fn(),
    loading: false,
    mfaChallenge: null,
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

vi.mock('../../src/components/ui/form', () => ({
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
  });

  it('renders brand title KAPWA', () => {
    render(<BrowserRouter><LoginPage /></BrowserRouter>);
    expect(screen.getByText('KAPWA')).toBeTruthy();
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
    const useAuthModule = require('../../src/lib/auth-context');
    useAuthModule.useAuth.mockReturnValue({
      user: null, token: null, login: mockLogin, logout: vi.fn(),
      loading: false, mfaChallenge: { tempToken: 'abc123' },
      resolveMfa: mockResolveMfa, cancelMfa: mockCancelMfa,
    });
    render(<BrowserRouter><LoginPage /></BrowserRouter>);
    expect(screen.getByText('Two-Factor Authentication')).toBeTruthy();
    expect(screen.getByText('Verify')).toBeTruthy();
  });
});
