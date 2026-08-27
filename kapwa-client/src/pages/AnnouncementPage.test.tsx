import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { AnnouncementPage } from './AnnouncementPage';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('@/lib/api', () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args) },
}));

function renderPage(initialEntry: string) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/announcements/:slug" element={<AnnouncementPage />} />
        </Routes>
      </MemoryRouter>
    </SWRConfig>
  );
}

describe('AnnouncementPage', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      if (JSON.stringify(key).includes('photos')) {
        return Promise.resolve([
          { id: 'photo-1', originalName: 'first.jpg', mimeType: 'image/jpeg', fileSize: 1024 },
          { id: 'photo-2', originalName: 'second.jpg', mimeType: 'image/jpeg', fileSize: 2048 },
        ]);
      }
      return Promise.resolve({
        id: 'a1',
        slug: 'my-post',
        title: 'My Post',
        excerpt: 'An excerpt.',
        bodyHtml: '<p>Hello</p>',
        pinned: false,
        publishedAt: '2026-08-01T00:00:00Z',
      });
    });
  });

  it('renders the public photo gallery with the first photo img', async () => {
    renderPage('/announcements/my-post');

    const img = await screen.findByAltText('first.jpg');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('/announcements/public/photo/photo-1');
    expect(mockApiGet).toHaveBeenCalledWith(['announcements', 'public', 'my-post', 'photos']);
  });

  it('renders every gallery photo as a link to the public photo URL', async () => {
    renderPage('/announcements/my-post');

    const link = await screen.findByRole('link', { name: 'second.jpg' });
    expect(link.getAttribute('href')).toBe('/announcements/public/photo/photo-2');
  });

  it('hides the gallery when the announcement has no photos', async () => {
    mockApiGet.mockImplementation((key: unknown) => {
      if (JSON.stringify(key).includes('photos')) return Promise.resolve([]);
      return Promise.resolve({
        id: 'a1',
        slug: 'my-post',
        title: 'My Post',
        excerpt: '',
        bodyHtml: '<p>Hello</p>',
        pinned: false,
        publishedAt: null,
      });
    });

    renderPage('/announcements/my-post');

    await screen.findByRole('heading', { name: 'My Post' });
    expect(screen.queryByAltText('first.jpg')).toBeNull();
  });
});