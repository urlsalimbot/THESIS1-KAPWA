import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ClaimantDashboardPage } from '../ClaimantDashboardPage';

const { mockPrefs } = vi.hoisted(() => ({
  mockPrefs: [],
}));

vi.mock('../../lib/api', () => ({
  getNotificationPreferences: () => Promise.resolve(mockPrefs),
  updateNotificationPreferences: () => Promise.resolve(),
}));

describe('ClaimantDashboardPage', () => {
  beforeEach(() => {
    localStorage.setItem('kapwa_token', 'test-token');
  });

  it('renders PageShell heading', async () => {
    render(<MemoryRouter><ClaimantDashboardPage /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'My Dashboard' })).toBeTruthy();
  });

  it('renders Access Card section', async () => {
    render(<MemoryRouter><ClaimantDashboardPage /></MemoryRouter>);
    expect(await screen.findByText('View your KAPWA Access Card')).toBeTruthy();
  });

  it('renders View Card link', async () => {
    render(<MemoryRouter><ClaimantDashboardPage /></MemoryRouter>);
    expect(await screen.findByRole('link', { name: 'View Card' })).toBeTruthy();
  });
});
