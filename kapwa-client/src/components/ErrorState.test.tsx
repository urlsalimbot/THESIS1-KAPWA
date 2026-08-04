import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  it('renders title, message, and a working retry button', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<ErrorState title="Could not load cases" message="Check your connection." onRetry={onRetry} />);
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('renders the title and message text', () => {
    render(<ErrorState title="Could not load cases" message="Check your connection." />);
    expect(screen.getByText('Could not load cases')).toBeTruthy();
    expect(screen.getByText('Check your connection.')).toBeTruthy();
  });

  it('exposes the container as an alert region for assistive tech', () => {
    const { container } = render(<ErrorState title="Could not load cases" />);
    expect(container.firstElementChild?.getAttribute('role')).toBe('alert');
  });

  it('does not render a retry button when onRetry is omitted', () => {
    render(<ErrorState title="Could not load cases" />);
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull();
  });
});
