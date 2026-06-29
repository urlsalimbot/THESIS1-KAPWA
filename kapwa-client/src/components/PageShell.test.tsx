import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageShell } from './PageShell';

// Mock useCacheStaleness (implemented in Task 2)
vi.mock('@/hooks/use-cache-staleness', () => ({
  useCacheStaleness: vi.fn(),
}));

import { useCacheStaleness } from '@/hooks/use-cache-staleness';

describe('PageShell', () => {
  beforeEach(() => {
    vi.mocked(useCacheStaleness).mockReturnValue({ isStale: false, ageDisplay: '' });
  });

  it('renders the title text', () => {
    render(<PageShell title="Test Title">content</PageShell>);
    expect(screen.getByText('Test Title')).toBeTruthy();
  });

  it('renders description when provided', () => {
    render(<PageShell title="Title" description="Test description">content</PageShell>);
    expect(screen.getByText('Test description')).toBeTruthy();
  });

  it('does not render description when omitted', () => {
    render(<PageShell title="Title">content</PageShell>);
    expect(screen.queryByText('Test description')).toBeNull();
  });

  it('renders actions slot when provided', () => {
    render(
      <PageShell title="Title" actions={<button>Action</button>}>
        content
      </PageShell>
    );
    expect(screen.getByText('Action')).toBeTruthy();
  });

  it('renders children', () => {
    render(<PageShell title="Title"><span>child content</span></PageShell>);
    expect(screen.getByText('child content')).toBeTruthy();
  });

  it('uses responsive gap classes gap-4 lg:gap-8', () => {
    const { container } = render(<PageShell title="Title">content</PageShell>);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('gap-4');
    expect(wrapper.className).toContain('lg:gap-8');
  });

  // --- cachedAt prop tests (OFF-03) ---

  it('renders normal description text when cachedAt is not provided', () => {
    render(<PageShell title="Title" description="Case records">content</PageShell>);
    expect(screen.getByText('Case records')).toBeTruthy();
    // Ensure no staleness text is appended
    expect(screen.queryByText(/Cached data/)).toBeNull();
  });

  it('does NOT show staleness badge when cachedAt is less than 5 min ago', () => {
    vi.mocked(useCacheStaleness).mockReturnValue({ isStale: false, ageDisplay: '' });
    render(<PageShell title="Title" description="Case records" cachedAt={Date.now() - 60000}>content</PageShell>);
    // Should show only the original description
    expect(screen.getByText('Case records')).toBeTruthy();
    expect(screen.queryByText(/Cached data/)).toBeNull();
  });

  it('shows stale data text when cachedAt exceeds 5 min threshold', () => {
    vi.mocked(useCacheStaleness).mockReturnValue({ isStale: true, ageDisplay: '12 min' });
    render(<PageShell title="Title" description="Case records" cachedAt={Date.now() - 720000}>content</PageShell>);
    expect(screen.getByText(/Cached data.*last sync.*12 min/)).toBeTruthy();
  });

  it('shows clock icon when data is stale', () => {
    vi.mocked(useCacheStaleness).mockReturnValue({ isStale: true, ageDisplay: '12 min' });
    const { container } = render(<PageShell title="Title" description="Case records" cachedAt={Date.now() - 720000}>content</PageShell>);
    // Clock icon from lucide-react renders as an inline SVG
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });
});
