import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { useAuth } from '@/lib/auth-context';
import { useMediaQuery } from '@/hooks/use-media-query';

vi.mock('@/hooks/use-media-query', () => ({
  useMediaQuery: vi.fn(() => true),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: vi.fn(() => ({ user: { role: 'social_worker' } })),
}));

describe('BottomNav', () => {
  it('renders tabs for the authenticated role', () => {
    render(<MemoryRouter><BottomNav /></MemoryRouter>);
    expect(screen.getByText('Dashboard')).toBeTruthy();
  });

  it('shows active tab with bg-muted class', () => {
    render(<MemoryRouter initialEntries={['/dashboard']}><BottomNav /></MemoryRouter>);
    const links = document.querySelectorAll('a');
    let activeLink = null;
    links.forEach(link => {
      if (link.classList.contains('bg-muted')) {
        activeLink = link;
      }
    });
    expect(activeLink).toBeTruthy();
  });

  it('returns null on desktop (useMediaQuery returns false)', () => {
    vi.mocked(useMediaQuery).mockReturnValueOnce(false);
    const { container } = render(<MemoryRouter><BottomNav /></MemoryRouter>);
    expect(container.innerHTML).toBe('');
  });

  describe('role filtering', () => {
    it('shows only agency portal tabs for agency_staff', () => {
      vi.mocked(useAuth).mockReturnValue({ user: { role: 'agency_staff' } } as ReturnType<typeof useAuth>);
      render(<MemoryRouter><BottomNav /></MemoryRouter>);
      expect(screen.queryByText(/cases/i)).toBeNull();
      expect(screen.queryByText(/beneficiaries/i)).toBeNull();
    });

    it('shows intake quick action for social_worker', () => {
      vi.mocked(useAuth).mockReturnValue({ user: { role: 'social_worker' } } as ReturnType<typeof useAuth>);
      render(<MemoryRouter><BottomNav /></MemoryRouter>);
      expect(screen.getByLabelText(/new intake/i)).toBeDefined();
    });
  });
});
