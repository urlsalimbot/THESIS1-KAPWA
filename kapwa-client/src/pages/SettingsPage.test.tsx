import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth-context';
import { SWRConfig } from 'swr';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

function renderWithProviders(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ dedupingInterval: 0, provider: () => new Map() }}>
      <BrowserRouter>
        <AuthProvider>
          {ui}
        </AuthProvider>
      </BrowserRouter>
    </SWRConfig>
  );
}

describe('SettingsPage', () => {
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
});
