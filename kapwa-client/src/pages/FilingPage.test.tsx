import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FilingPage } from './FilingPage';

describe('FilingPage', () => {
  beforeEach(() => {
    localStorage.setItem('kapwa_token', 'test-token');
  });

  it('renders PageShell heading', async () => {
    render(<MemoryRouter><FilingPage /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Digital Filing' })).toBeTruthy();
  });

  it('renders description text', async () => {
    render(<MemoryRouter><FilingPage /></MemoryRouter>);
    expect(await screen.findByText(/Upload and manage case documents/i)).toBeTruthy();
  });

  it('renders Upload Document button', async () => {
    render(<MemoryRouter><FilingPage /></MemoryRouter>);
    expect(await screen.findByText('Upload Document')).toBeTruthy();
  });

  it('renders search placeholder', async () => {
    render(<MemoryRouter><FilingPage /></MemoryRouter>);
    expect(await screen.findByPlaceholderText('Search documents...')).toBeTruthy();
  });
});
