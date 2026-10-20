import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { InterventionCatalogPage } from './InterventionCatalogPage';

const { mockApiGet, mockApiPost, mockApiPatch } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPatch: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    patch: (...args: unknown[]) => mockApiPatch(...args),
  },
}));

function renderPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <MemoryRouter><InterventionCatalogPage /></MemoryRouter>
    </SWRConfig>,
  );
}

const reliefGoods = {
  code: 'relief_goods',
  label: 'Relief Goods',
  isFinancial: true,
  isActive: true,
};

describe('InterventionCatalogPage', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPatch.mockReset();
    mockApiGet.mockResolvedValue([reliefGoods]);
    mockApiPost.mockResolvedValue({});
    mockApiPatch.mockResolvedValue({});
  });

  it('lists the local services with their code and money flag, next to the built-ins', async () => {
    renderPage();

    expect(await screen.findByText('Relief Goods')).toBeTruthy();
    expect(screen.getByText('relief_goods')).toBeTruthy();
    expect(screen.getByText('Carries money')).toBeTruthy();
    // The built-in vocabulary is visible read-only, so the page is the catalog.
    expect(screen.getByText('Built-in services')).toBeTruthy();
    expect(screen.getByText('Financial Grant')).toBeTruthy();
  });

  it('adds a service with the name and money flag', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /add service/i }));
    await user.type(screen.getByLabelText(/service name/i), 'Barangay medical mission');
    await user.click(screen.getByRole('checkbox', { name: /carries money/i }));
    const submits = screen.getAllByRole('button', { name: /add service/i });
    await user.click(submits[submits.length - 1]);

    await waitFor(() => expect(mockApiPost).toHaveBeenCalledTimes(1));
    expect(mockApiPost).toHaveBeenCalledWith('/intervention-catalog', {
      label: 'Barangay medical mission',
      isFinancial: true,
    });
  });

  it('refuses a name that is too short without calling the API', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /add service/i }));
    await user.type(screen.getByLabelText(/service name/i), 'x');
    const submits = screen.getAllByRole('button', { name: /add service/i });
    await user.click(submits[submits.length - 1]);

    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('deactivates a service instead of deleting it', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('switch', { name: /offer relief goods/i }));

    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/intervention-catalog/relief_goods', { isActive: false }));
  });
});
