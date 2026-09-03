import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { PublicAnnouncementsPage } from './PublicAnnouncementsPage';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('@/lib/api', () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args) },
}));

function renderPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <MemoryRouter><PublicAnnouncementsPage /></MemoryRouter>
    </SWRConfig>,
  );
}

describe('PublicAnnouncementsPage', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
  });

  it('renders published announcements linking to detail', async () => {
    mockApiGet.mockResolvedValue([
      {
        id: 'a1', slug: 'aid-2026', title: 'AICS Aid Program', excerpt: 'Financial assistance',
        pinned: false, publishedAt: '2026-08-01T00:00:00Z', photoCount: 0, coverPhotoId: null,
      },
    ]);
    renderPage();
    const link = await screen.findByRole('link', { name: /AICS Aid Program/ });
    expect(link.getAttribute('href')).toBe('/announcements/aid-2026');
  });

  it('shows empty state when no announcements', async () => {
    mockApiGet.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('No announcements yet.')).toBeTruthy();
  });
});