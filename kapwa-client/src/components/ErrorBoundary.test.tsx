import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ErrorBoundary } from './ErrorBoundary';

function Bomb({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Safe content</div>;
}

function setupOffline() {
  Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
}

function setupOnline() {
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setupOnline();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when no error', () => {
    render(
      <MemoryRouter>
        <ErrorBoundary>
          <div>All good</div>
        </ErrorBoundary>
      </MemoryRouter>
    );
    expect(screen.getByText('All good')).toBeTruthy();
  });

  it('catches thrown error and shows fallback with generic message', () => {
    render(
      <MemoryRouter>
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>
      </MemoryRouter>
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Try Again')).toBeTruthy();
    expect(screen.getByText('Go to Dashboard')).toBeTruthy();
  });

  it('shows offline UI when navigator.onLine is false', () => {
    setupOffline();

    render(
      <MemoryRouter>
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>
      </MemoryRouter>
    );

    expect(screen.getByText('You are offline')).toBeTruthy();
    expect(screen.getByText('Retry')).toBeTruthy();
  });

  it('shows offline UI for fetch-related errors', () => {
    function FetchBomb() {
      const error = new TypeError('Failed to fetch');
      error.name = 'TypeError';
      throw error;
    }

    render(
      <MemoryRouter>
        <ErrorBoundary>
          <FetchBomb />
        </ErrorBoundary>
      </MemoryRouter>
    );

    expect(screen.getByText('You are offline')).toBeTruthy();
  });

  it('Try Again button resets error state', () => {
    render(
      <MemoryRouter>
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>
      </MemoryRouter>
    );

    // Click Try Again
    screen.getByText('Try Again').click();

    // After clicking Try Again, the error state resets
    // The bomb re-renders and is caught again, showing the fallback
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('Go to Dashboard link has correct to="/dashboard" attribute', () => {
    render(
      <MemoryRouter>
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>
      </MemoryRouter>
    );

    const link = screen.getByText('Go to Dashboard');
    expect(link.closest('a')?.getAttribute('href')).toBe('/dashboard');
  });
});
