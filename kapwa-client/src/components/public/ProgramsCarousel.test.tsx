import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { ProgramsCarousel } from './ProgramsCarousel';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('@/lib/api', () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args) },
}));

function renderCarousel() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <MemoryRouter>
        <ProgramsCarousel />
      </MemoryRouter>
    </SWRConfig>,
  );
}

function program(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    name: 'Medical Assistance',
    category: 'Medical',
    waitingPeriodDays: 15,
    fundSources: ['LGU - Municipal'],
    requiredDocuments: ['Valid ID', 'Barangay Certificate'],
    legalBasis: 'RA 11223',
    ...overrides,
  };
}

describe('ProgramsCarousel', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
  });

  it('renders a card for every program from the database', async () => {
    mockApiGet.mockResolvedValue([
      program(),
      program({ id: 'p2', name: 'Burial Assistance', category: 'Burial' }),
    ]);

    renderCarousel();

    expect(await screen.findByText('Medical Assistance')).toBeTruthy();
    expect(screen.getByText('Burial Assistance')).toBeTruthy();
    // The catalogue comes from the public programs endpoint.
    expect(mockApiGet).toHaveBeenCalledWith(['programs', 'public']);
    // Document count is summarised rather than listing every requirement.
    expect(screen.getAllByText('2 document(s) required').length).toBe(2);
  });

  it('exposes a focusable carousel region with prev/next controls', async () => {
    mockApiGet.mockResolvedValue([program(), program({ id: 'p2', name: 'Burial Assistance' })]);

    renderCarousel();

    const region = await screen.findByRole('group', { name: 'Programs carousel' });
    expect(region.getAttribute('tabindex')).toBe('0');
    expect(screen.getByRole('button', { name: 'Previous programs' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next programs' })).toBeTruthy();
  });

  it('shows an empty state when no programs are listed', async () => {
    mockApiGet.mockResolvedValue([]);

    renderCarousel();

    expect(await screen.findByText('No programs are currently listed.')).toBeTruthy();
  });

  it('shows an error state when the catalogue fails to load', async () => {
    mockApiGet.mockRejectedValue(new Error('nope'));

    renderCarousel();

    expect(await screen.findByText('Failed to load programs.')).toBeTruthy();
  });
});
