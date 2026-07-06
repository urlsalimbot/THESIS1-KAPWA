import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { MfaSetupPage } from './MfaSetupPage';

const { mockApiGet, mockApiPost } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: vi.fn(),
    del: vi.fn(),
  },
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}

describe('MfaSetupPage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('auth') && k.includes('me')) return Promise.resolve({ id: 'test-user', email: 'admin@norzagaray.gov', role: 'admin', mfaEnabled: false });
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders PageShell heading', async () => {
    renderWithSWR(<MfaSetupPage />);
    expect(await screen.findByRole('heading', { name: 'Multi-Factor Authentication' })).toBeTruthy();
  });

  it('renders set up MFA button for eligible roles', async () => {
    renderWithSWR(<MfaSetupPage />);
    expect(await screen.findByRole('button', { name: /set up mfa/i })).toBeTruthy();
  });

  it('shows MFA not enabled message', async () => {
    renderWithSWR(<MfaSetupPage />);
    expect(await screen.findByText('MFA not enabled')).toBeTruthy();
  });
});
