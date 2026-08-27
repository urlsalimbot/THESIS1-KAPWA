import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { AnnouncementsPage } from './AnnouncementsPage';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('@/lib/api', () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args) },
}));

function renderPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <MemoryRouter><AnnouncementsPage /></MemoryRouter>
    </SWRConfig>
  );
}

function announcement(overrides: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    title: 'One',
    slug: 'one',
    excerpt: '',
    status: 'published',
    pinned: false,
    publishedAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    photoCount: 0,
    coverPhotoId: null,
    ...overrides,
  };
}

describe('AnnouncementsPage', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue([announcement()]);
  });

  it('renders the cover thumbnail for an announcement with coverPhotoId', async () => {
    mockApiGet.mockResolvedValue([
      announcement({ title: 'With Photo', photoCount: 1, coverPhotoId: 'photo-1' }),
    ]);

    renderPage();

    const img = await screen.findByAltText('Cover photo');
    expect(img.getAttribute('src')).toBe('/announcements/public/photo/photo-1');
    expect(mockApiGet).toHaveBeenCalledWith(['announcements']);
  });

  it('renders no cover thumbnail when coverPhotoId is null', async () => {
    renderPage();

    await screen.findByText('One');
    expect(screen.queryByAltText('Cover photo')).toBeNull();
  });
});