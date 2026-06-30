import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminPage } from './AdminPage';

describe('AdminPage', () => {
  beforeEach(() => {
    localStorage.setItem('kapwa_token', 'test-token');
  });

  it('renders PageShell heading', async () => {
    render(<MemoryRouter><AdminPage /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Admin Panel' })).toBeTruthy();
  });

  it('renders tab navigation', async () => {
    render(<MemoryRouter><AdminPage /></MemoryRouter>);
    expect(await screen.findByText(/Programs/)).toBeTruthy();
    expect(screen.getByText(/Users/)).toBeTruthy();
    expect(screen.getByText(/Sync Queue/)).toBeTruthy();
    expect(screen.getByText(/Audit Log/)).toBeTruthy();
  });

  it('renders Program Configurator card heading', async () => {
    render(<MemoryRouter><AdminPage /></MemoryRouter>);
    expect(await screen.findByText('Program Configurator')).toBeTruthy();
  });
});
