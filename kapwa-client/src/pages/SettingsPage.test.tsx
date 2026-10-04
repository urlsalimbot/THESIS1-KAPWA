import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SettingsPage } from './SettingsPage';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth-context';
import { SWRConfig } from 'swr';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

function renderWithProviders(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ dedupingInterval: 0, fetcher: (key: unknown) => api.get(key as never), provider: () => new Map() }}>
      <BrowserRouter>
        <AuthProvider>
          {ui}
        </AuthProvider>
      </BrowserRouter>
    </SWRConfig>
  );
}

describe('SettingsPage', () => {
  afterEach(() => {
    localStorage.removeItem('kapwa-lang');
    document.documentElement.lang = 'en';
  });
  it('renders all three tab triggers', () => {
    renderWithProviders(<SettingsPage />);
    expect(screen.getByRole('tab', { name: /profile/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /security/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /notifications/i })).toBeInTheDocument();
  });

  it('shows profile content by default', () => {
    renderWithProviders(<SettingsPage />);
    expect(screen.getByText(/profile information/i)).toBeInTheDocument();
  });

  it('wraps the change-password controls in a real form', () => {
    // Fields not inside a <form> make browsers drop autocomplete/validation
    // semantics — and warn about it on every keystroke.
    renderWithProviders(<SettingsPage />);
    const submit = screen.getByRole('button', { name: /change password/i });
    expect(submit.closest('form')).toBeInstanceOf(HTMLFormElement);
    expect(screen.getByLabelText(/current password/i).closest('form')).toBeInstanceOf(HTMLFormElement);
  });

  it('wraps the change-email controls in a real form', () => {
    renderWithProviders(<SettingsPage />);
    const submit = screen.getByRole('button', { name: /update email/i });
    expect(submit.closest('form')).toBeInstanceOf(HTMLFormElement);
    expect(screen.getByLabelText(/new email/i).closest('form')).toBeInstanceOf(HTMLFormElement);
  });

  it('renders Language preference and switches locale', async () => {
    renderWithProviders(<SettingsPage />);
    expect(await screen.findByText('Language Preference')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Filipino'));
    expect(document.documentElement.lang).toBe('fil-PH');
    expect(localStorage.getItem('kapwa-lang')).toBe('fil');
    fireEvent.click(screen.getByLabelText('English'));
    expect(document.documentElement.lang).toBe('en');
  });

  it('updates the displayed Current phone from the save response', async () => {
    const api = await import('@/lib/api');
    vi.mocked(api.api.post).mockResolvedValue({ phone: '+639170000001' });
    vi.mocked(api.api.get).mockResolvedValue({
      user: { id: 'u1', email: 'a@b', fullName: 'A B', role: 'admin', phone: '+639179999999' },
    });
    renderWithProviders(<SettingsPage />);
    const input = screen.getByLabelText(/phone number/i);
    fireEvent.change(input, { target: { value: '+639170000001' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await vi.waitFor(() => {
      // The POST returned the saved number; "Current:" must show it without a reload.
      expect(screen.getByText(/current:/i).textContent).toContain('+639170000001');
    });
    expect(vi.mocked(api.api.post)).toHaveBeenCalledWith('/auth/update-phone', { phone: '+639170000001' });
  });

  it('translates tab labels and page title in fil mode', async () => {
    renderWithProviders(<SettingsPage />);
    fireEvent.click(screen.getByLabelText('Filipino'));
    expect(await screen.findByText('Mga Setting')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /seguridad/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /mga abiso/i })).toBeInTheDocument();
    // switch back to English for isolation (i18n is a module singleton)
    fireEvent.click(screen.getByLabelText('English'));
  });

  it('hides the SMS preference column when the server reports SMS unconfigured', async () => {
    const api = await import('@/lib/api');
    vi.mocked(api.api.get).mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('config')) return Promise.resolve({ smsEnabled: false });
      if (k.includes('preferences')) return Promise.resolve([]);
      return Promise.resolve(null);
    });
    renderWithProviders(<SettingsPage />);
    fireEvent.click(screen.getByRole('tab', { name: /notifications/i }));
    expect(await screen.findByText('Notification Preferences')).toBeTruthy();
    await vi.waitFor(() => {
      expect(screen.queryByRole('columnheader', { name: 'SMS' })).toBeNull();
    });
    expect(screen.getByRole('columnheader', { name: 'In-App' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Email' })).toBeTruthy();
  });

  it('shows the SMS preference column when SMS is enabled or config is unknown', async () => {
    const api = await import('@/lib/api');
    vi.mocked(api.api.get).mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('config')) return Promise.resolve({ smsEnabled: true });
      if (k.includes('preferences')) return Promise.resolve([]);
      return Promise.resolve(null);
    });
    renderWithProviders(<SettingsPage />);
    fireEvent.click(screen.getByRole('tab', { name: /notifications/i }));
    expect(await screen.findByRole('columnheader', { name: 'SMS' })).toBeTruthy();
  });

  it('renders the reminder settings card with the worker overrides', async () => {
    const api = await import('@/lib/api');
    vi.mocked(api.api.get).mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('config')) return Promise.resolve({ smsEnabled: true });
      if (k.includes('preferences')) return Promise.resolve([]);
      if (k.includes('reminder-settings/me')) {
        return Promise.resolve([{ eventType: 'court_hearing', offsets: [1440] }]);
      }
      if (k.includes('reminder-settings/system')) {
        return Promise.resolve([{ eventType: 'court_hearing', offsets: [4320, 1440, 180] }]);
      }
      return Promise.resolve(null);
    });
    renderWithProviders(<SettingsPage />);
    fireEvent.click(screen.getByRole('tab', { name: /notifications/i }));
    expect(await screen.findByText('Reminder Settings')).toBeTruthy();
    // The card lists both event types with their effective lead times.
    expect(screen.getByText('Court Hearing')).toBeTruthy();
    expect(screen.getByText('Home Visit')).toBeTruthy();
  });
});
