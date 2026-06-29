import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BottomNav } from './BottomNav';

// Mock useMediaQuery
vi.mock('@/hooks/use-media-query', () => ({
  useMediaQuery: vi.fn(() => true),
}));

import { useMediaQuery } from '@/hooks/use-media-query';

function renderWithRouter(ui: React.ReactElement, { initialEntries = ['/'] } = {}) {
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
}

describe('BottomNav', () => {
  it('renders 5 tab items including Dashboard, Cases, Beneficiaries, Profile, and Quick Action', () => {
    renderWithRouter(<BottomNav />);
    expect(screen.getByText('Dashboard')).toBeTruthy();
    expect(screen.getByText('Cases')).toBeTruthy();
    expect(screen.getByText('Beneficiaries')).toBeTruthy();
    expect(screen.getByText('Profile')).toBeTruthy();
    // Quick Action is rendered as Plus icon, verify by href
    const intakeLink = document.querySelector('a[href="/intake"]');
    expect(intakeLink).toBeTruthy();
  });

  it('shows active tab with bg-muted class', () => {
    renderWithRouter(<BottomNav />, { initialEntries: ['/'] });
    // Dashboard should be active on '/'
    const links = document.querySelectorAll('a');
    let activeLink = null;
    links.forEach(link => {
      if (link.classList.contains('bg-muted')) {
        activeLink = link;
      }
    });
    expect(activeLink).toBeTruthy();
  });

  it('Quick Action link has to="/intake"', () => {
    renderWithRouter(<BottomNav />);
    const intakeLink = document.querySelector('a[href="/intake"]');
    expect(intakeLink).toBeTruthy();
  });

  it('Quick Action button has rounded-full class', () => {
    renderWithRouter(<BottomNav />);
    const intakeLink = document.querySelector('a[href="/intake"]');
    expect(intakeLink?.classList.contains('rounded-full')).toBe(true);
  });

  it('returns null on desktop (useMediaQuery returns false)', () => {
    vi.mocked(useMediaQuery).mockReturnValueOnce(false);
    const { container } = renderWithRouter(<BottomNav />);
    expect(container.innerHTML).toBe('');
  });
});
