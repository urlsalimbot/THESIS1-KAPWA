import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { LatestAnnouncements } from './LatestAnnouncements';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('@/lib/api', () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args) },
}));

function renderSection() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <MemoryRouter><LatestAnnouncements /></MemoryRouter>
    </SWRConfig>
  );
}

function announcement(overrides: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    slug: 's1',
    title: 'One',
    excerpt: '',
    pinned: false,
    publishedAt: '2026-08-01T00:00:00Z',
    photoCount: 0,
    coverPhotoId: null,
    ...overrides,
  };
}

describe('LatestAnnouncements', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue([announcement()]);
  });

  it('renders the cover photo for an announcement with coverPhotoId', async () => {
    mockApiGet.mockResolvedValue([
      announcement({ title: 'With Photo', photoCount: 2, coverPhotoId: 'photo-1' }),
      announcement({ id: 'a2', slug: 's2', title: 'Without Photo' }),
    ]);

    renderSection();

    const img = await screen.findByAltText('Cover photo');
    expect(img.getAttribute('src')).toBe('/announcements/public/photo/photo-1');
    expect(mockApiGet).toHaveBeenCalledWith(['announcements', 'public']);
  });

  it('renders no cover img when no announcement has coverPhotoId', async () => {
    renderSection();

    await screen.findByText('One');
    expect(screen.queryByAltText('Cover photo')).toBeNull();
  });
});