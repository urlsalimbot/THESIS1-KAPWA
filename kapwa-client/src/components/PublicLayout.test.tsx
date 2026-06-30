import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PublicLayout } from './PublicLayout';

vi.mock('../lib/auth-context', () => ({
  useAuth: vi.fn(() => ({ user: null, loading: false })),
}));

vi.mock('./PublicHeader', () => ({
  PublicHeader: () => <div data-testid="mock-header">Header</div>,
}));

vi.mock('./PublicFooter', () => ({
  PublicFooter: () => <div data-testid="mock-footer">Footer</div>,
}));

describe('PublicLayout', () => {
  it('renders header and footer', () => {
    render(
      <MemoryRouter>
        <PublicLayout />
      </MemoryRouter>
    );
    expect(screen.getByTestId('mock-header')).toBeTruthy();
    expect(screen.getByTestId('mock-footer')).toBeTruthy();
  });

  it('contains skip-to-content link', () => {
    render(
      <MemoryRouter>
        <PublicLayout />
      </MemoryRouter>
    );
    expect(screen.getByText('Skip to content')).toBeTruthy();
  });

  it('renders main content area with id main-content', () => {
    render(
      <MemoryRouter>
        <PublicLayout />
      </MemoryRouter>
    );
    expect(screen.getByRole('main')).toBeTruthy();
  });
});
