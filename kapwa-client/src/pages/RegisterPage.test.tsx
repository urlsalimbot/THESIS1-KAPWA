import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { RegisterPage } from './RegisterPage';

vi.mock('../lib/auth-context', () => ({
  useAuth: vi.fn(() => ({
    user: null, token: null, login: vi.fn(), logout: vi.fn(),
    loading: false, mfaChallenge: null, resolveMfa: vi.fn(), cancelMfa: vi.fn(),
  })),
}));

vi.mock('react-hook-form', () => ({
  useForm: vi.fn(() => ({
    register: vi.fn(),
    handleSubmit: vi.fn((cb) => (e: any) => { e?.preventDefault?.(); cb({}); }),
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

describe('RegisterPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders registration heading', () => {
    render(<BrowserRouter><RegisterPage /></BrowserRouter>);
    expect(screen.getByText('Claimant Registration')).toBeTruthy();
  });

  it('renders Full Name field', () => {
    render(<BrowserRouter><RegisterPage /></BrowserRouter>);
    expect(screen.getByText('Full Name')).toBeTruthy();
  });

  it('renders Email field', () => {
    render(<BrowserRouter><RegisterPage /></BrowserRouter>);
    expect(screen.getByText('Email')).toBeTruthy();
  });

  it('renders Password field', () => {
    render(<BrowserRouter><RegisterPage /></BrowserRouter>);
    expect(screen.getByText('Password')).toBeTruthy();
  });

  it('renders Barangay field', () => {
    render(<BrowserRouter><RegisterPage /></BrowserRouter>);
    expect(screen.getByText('Barangay')).toBeTruthy();
  });

  it('renders Date of Birth field', () => {
    render(<BrowserRouter><RegisterPage /></BrowserRouter>);
    expect(screen.getByText('Date of Birth')).toBeTruthy();
  });

  it('renders Create Account submit button', () => {
    render(<BrowserRouter><RegisterPage /></BrowserRouter>);
    expect(screen.getByText('Create Account')).toBeTruthy();
  });

  it('renders link back to login', () => {
    render(<BrowserRouter><RegisterPage /></BrowserRouter>);
    expect(screen.getByText(/Already have an account/i)).toBeTruthy();
  });
});
