import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MfaSetupPage } from '../MfaSetupPage';

// Mock API functions used by MfaSetupPage
vi.mock('../../lib/api', () => ({
  setupMfa: vi.fn(),
  enableMfa: vi.fn(),
  disableMfa: vi.fn(),
}));

// Mock auth-context getCurrentUser
vi.mock('../../lib/auth-context', () => ({
  getCurrentUser: vi.fn(),
}));

import { getCurrentUser } from '../../lib/auth-context';

describe('MfaSetupPage', () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 'test-user',
      email: 'admin@norzagaray.gov',
      role: 'admin',
      mfaEnabled: false,
    });
  });

  it('renders PageShell heading', async () => {
    render(<MemoryRouter><MfaSetupPage /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Multi-Factor Authentication' })).toBeTruthy();
  });

  it('renders set up MFA button for eligible roles', async () => {
    render(<MemoryRouter><MfaSetupPage /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: /set up mfa/i })).toBeTruthy();
  });

  it('shows MFA not enabled message', async () => {
    render(<MemoryRouter><MfaSetupPage /></MemoryRouter>);
    expect(await screen.findByText('MFA not enabled')).toBeTruthy();
  });
});
