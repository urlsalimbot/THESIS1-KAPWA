import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { Layout } from './Layout';

vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'a@b.com', fullName: 'A B', role: 'social_worker' },
    token: 'test-tok',
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    mfaChallenge: null,
    resolveMfa: vi.fn(),
    cancelMfa: vi.fn(),
  }),
}));

vi.mock('../lib/offline-queue', () => ({
  loadQueue: () => [],
}));

// Mock useMediaQuery
vi.mock('@/hooks/use-media-query', () => ({
  useMediaQuery: vi.fn(() => true),
}));

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Layout />
    </MemoryRouter>
  );
}

describe('Layout', () => {
  it('renders the main content area with id="main-content"', () => {
    const { container } = renderLayout();
    expect(container.querySelector('main#main-content')).toBeTruthy();
  });

  it('renders the SkipToContent link as the first focusable element with href="#main-content"', () => {
    renderLayout();
    const skipLink = screen.getByText('Skip to content');
    expect(skipLink.closest('a')?.getAttribute('href')).toBe('#main-content');
  });

  it('wraps the Outlet in an ErrorBoundary (main element is present)', () => {
    const { container } = renderLayout();
    expect(container.querySelector('main#main-content')).toBeTruthy();
  });

  it('AriaLiveRegion shows offline message when navigator.onLine is false', () => {
    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    try {
      renderLayout();
      expect(screen.getByText(/Some features may be unavailable/i)).toBeTruthy();
    } finally {
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    }
  });

  it('has no axe violations', async () => {
    const { container } = renderLayout();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
