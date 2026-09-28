import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { AccessDeniedBanner } from './AccessDeniedBanner';
import { KAPWA_ACCESS_DENIED_EVENT } from '@/lib/api';

function denyWith(message: string, path = '/api/v1/cases') {
  act(() => {
    window.dispatchEvent(
      new CustomEvent(KAPWA_ACCESS_DENIED_EVENT, { detail: { message, path } }),
    );
  });
}

describe('AccessDeniedBanner', () => {
  it('renders nothing until a request is actually refused', () => {
    const { container } = render(<AccessDeniedBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the server reason for a 403 instead of a silently empty table', () => {
    render(<AccessDeniedBanner />);
    denyWith('You are not assigned to Poblacion. Your assignment is Bigte.');
    const banner = screen.getByTestId('access-denied-banner');
    expect(banner.textContent).toContain('You are not assigned to Poblacion');
    expect(banner.getAttribute('role')).toBe('alert');
  });

  it('does not restate a body that says nothing the title has not said', () => {
    render(<AccessDeniedBanner />);
    denyWith('Forbidden resource');
    const banner = screen.getByTestId('access-denied-banner');
    expect(banner.textContent).not.toContain('Forbidden resource');
    expect(banner.textContent).toContain('Access denied');
  });

  it('stays on screen until dismissed — a refusal must not self-clear like a toast', () => {
    render(<AccessDeniedBanner />);
    denyWith('This record is restricted.');
    expect(screen.getByTestId('access-denied-banner')).toBeTruthy();
    act(() => {
      screen.getByLabelText('Dismiss access denied notice').click();
    });
    expect(screen.queryByTestId('access-denied-banner')).toBeNull();
  });

  it('clears a previous refusal when the user navigates to another route', () => {
    const { rerender } = render(<AccessDeniedBanner routeKey="/cases" />);
    denyWith('This record is restricted.');
    expect(screen.getByTestId('access-denied-banner')).toBeTruthy();
    rerender(<AccessDeniedBanner routeKey="/beneficiaries" />);
    expect(screen.queryByTestId('access-denied-banner')).toBeNull();
  });

  it('removes its window listener on unmount so it cannot leak', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<AccessDeniedBanner />);
    unmount();
    const cleaned = removeSpy.mock.calls.some(
      c => c[0] === KAPWA_ACCESS_DENIED_EVENT,
    );
    removeSpy.mockRestore();
    expect(cleaned).toBe(true);
  });
});
