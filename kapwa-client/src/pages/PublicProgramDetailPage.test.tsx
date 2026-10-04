import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PublicProgramDetailPage } from './PublicProgramDetailPage';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('@/lib/api', () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args) },
}));

const program = {
  id: 'p1',
  name: 'Cash Assistance',
  category: 'Financial',
  fundSources: ['DSWD', 'LGU'],
  requiredDocuments: ['Valid ID', 'Proof of Income'],
  legalBasis: 'RA 9262',
};

function renderAt(id = 'p1') {
  return render(
    <MemoryRouter initialEntries={[`/programs/${id}`]}>
      <Routes>
        <Route path="/programs/:id" element={<PublicProgramDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PublicProgramDetailPage', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue(program);
  });

  it('renders the program fetched from the public detail endpoint', async () => {
    renderAt();

    expect(await screen.findByRole('heading', { name: 'Cash Assistance' })).toBeTruthy();
    // The key already existed in query-keys; assert the page actually uses it
    // rather than inventing a second path shape.
    expect(String(mockApiGet.mock.calls[0][0])).toContain('public');
  });

  it('shows the facts a visitor needs before applying', async () => {
    renderAt();

    expect(screen.getByText('DSWD')).toBeTruthy();
    expect(screen.getByText('LGU')).toBeTruthy();
    expect(screen.getByText('Valid ID')).toBeTruthy();
    expect(screen.getByText('Proof of Income')).toBeTruthy();
    expect(screen.getByText('RA 9262')).toBeTruthy();
  });

  it('offers a way back to the catalogue and on to the contact form', async () => {
    renderAt();

    const back = await screen.findAllByRole('link', { name: /Back to programs/i });
    expect(back[0].getAttribute('href')).toBe('/programs');
    const inquire = screen.getByRole('link', { name: /Inquire about this program/i });
    expect(inquire.getAttribute('href')).toBe('/contact');
  });

  it('explains a withdrawn program instead of rendering a blank page', async () => {
    mockApiGet.mockRejectedValue(new Error('404'));
    renderAt('gone');

    expect(await screen.findByRole('heading', { name: /Program not found/i })).toBeTruthy();
    // No empty hero, no stray "undefined" fields.
    expect(screen.queryByRole('heading', { name: 'Cash Assistance' })).toBeNull();
  });
});
