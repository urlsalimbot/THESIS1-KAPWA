import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SyncStatusBanner } from './SyncStatusBanner';

describe('SyncStatusBanner', () => {
  it('renders nothing when online with no pending changes', () => {
    const { container } = render(
      <SyncStatusBanner pendingCount={0} isOnline onOpenQueue={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders an in-flow strip, never a fixed overlay, when offline', () => {
    render(<SyncStatusBanner pendingCount={0} isOnline={false} onOpenQueue={() => {}} />);
    const banner = screen.getByLabelText('Open sync queue');
    // A fixed top overlay would cover the topbar and make the account badge
    // untappable on mobile portrait.
    expect(banner.className).not.toContain('fixed');
    expect(banner.className).toContain('w-full');
  });

  it('renders when online with pending changes', () => {
    render(<SyncStatusBanner pendingCount={2} isOnline onOpenQueue={() => {}} />);
    expect(screen.getByLabelText('Open sync queue')).toBeTruthy();
  });
});
