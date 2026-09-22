import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { axe } from 'vitest-axe';
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

  it('has no a11y violations', async () => {
    const { container } = renderWithSWR(<MfaSetupPage />);
    await screen.findByRole('heading', { name: 'Multi-Factor Authentication' });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('sends an email code when email MFA is chosen', async () => {
    mockApiPost.mockResolvedValueOnce({ message: 'sent', emailDelivered: true });
    renderWithSWR(<MfaSetupPage />);

    fireEvent.click(await screen.findByRole('button', { name: /use email code instead/i }));

    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/auth/mfa/email/setup'));
    expect(await screen.findByText(/enter the 6-digit code we sent to your email/i)).toBeTruthy();
  });

  it('enables email MFA with the emailed code', async () => {
    mockApiPost
      .mockResolvedValueOnce({ message: 'sent', emailDelivered: true })
      .mockResolvedValueOnce({ mfaEnabled: true, mfaMethod: 'email' });
    renderWithSWR(<MfaSetupPage />);

    fireEvent.click(await screen.findByRole('button', { name: /use email code instead/i }));
    const input = await screen.findByLabelText('Email Verification Code');
    fireEvent.change(input, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /verify & enable/i }));

    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/auth/mfa/email/enable', { code: '123456' }));
    expect(await screen.findByText(/protected with email verification codes/i)).toBeTruthy();
  });
});
