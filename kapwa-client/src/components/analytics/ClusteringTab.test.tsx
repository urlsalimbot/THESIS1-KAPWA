import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { ClusteringTab } from './ClusteringTab';

const { mockApiGet, mockApiPost, mockUseAuth } = vi.hoisted(() => ({
  mockApiGet: vi.fn(), mockApiPost: vi.fn(), mockUseAuth: vi.fn(),
}));
vi.mock('../../lib/api', () => ({
  api: { get: (...a: unknown[]) => mockApiGet(...a), post: (...a: unknown[]) => mockApiPost(...a) },
  downloadAnalyticsCsv: vi.fn(),
}));
vi.mock('../../lib/auth-context', () => ({ useAuth: (...a: unknown[]) => mockUseAuth(...a) }));

const RUN = {
  id: '11111111-1111-1111-1111-111111111111',
  status: 'completed',
  params: { chosen_k: 2, seed: 42, dataset_size: 60 },
  metrics: { dataset_size: 60, candidates: [{ k: 2, inertia: 10, silhouette: 0.6 }, { k: 3, inertia: 6, silhouette: 0.5 }] },
  createdAt: '2026-09-25T00:00:00Z',
};

function renderTab() {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
      <ClusteringTab filters={{}} />
    </SWRConfig>,
  );
}

describe('ClusteringTab', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue({ user: { id: '1', role: 'admin' } });
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('members')) return Promise.resolve({ rows: [{ householdId: 'h1', clusterIndex: 0, distance: 0.4, barangay: 'Bigte' }], total: 1 });
      if (k.includes(RUN.id)) return Promise.resolve({
        run: RUN,
        clusters: [
          { clusterIndex: 0, size: 30, profile: { household_income_median: 5000, barangay_mix: [{ barangay: 'Poblacion', count: 28 }, { barangay: 'Unspecified', count: { suppressed: true } }] } },
          { clusterIndex: 1, size: 30, profile: { household_income_median: 15000 } },
          { clusterIndex: 2, size: { suppressed: true }, profile: {} },
        ],
      });
      if (k.includes('"runs"')) return Promise.resolve([RUN]);
      return Promise.resolve(null);
    });
    mockApiPost.mockResolvedValue(RUN);
  });

  it('lists runs and renders the chosen run candidates', async () => {
    renderTab();
    expect(await screen.findByText(/Chosen k/i)).toBeTruthy();
    expect(screen.getByText(/Chosen k: 2/)).toBeTruthy();
    expect(screen.getAllByText(/Segment|Segments/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1); // suppressed small cluster size
  });

  it('renders the methodology note and the cluster barangay mix with suppressed counts hidden', async () => {
    renderTab();
    expect(await screen.findByText(/How this is computed/i)).toBeTruthy();
    expect(screen.getByText(/Barangay mix/i)).toBeTruthy();
    expect(screen.getByText('Poblacion')).toBeTruthy();
    expect(screen.getByText('28')).toBeTruthy();
    expect(screen.getByText('Unspecified')).toBeTruthy();
  });

  it('triggers a run and shows members only for worker roles', async () => {
    renderTab();
    const runButton = await screen.findByRole('button', { name: /Run clustering/i });
    fireEvent.click(runButton);
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/analytics/clustering/runs', expect.objectContaining({})));

    fireEvent.click((await screen.findAllByRole('button', { name: /View households/i }))[0]);
    expect(await screen.findByText(/h1/)).toBeTruthy();
  });

  it('rejects an invalid k range before posting', async () => {
    renderTab();
    fireEvent.change(await screen.findByLabelText(/Candidate k range/i), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /Run clustering/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Check the k range/i);
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('surfaces insufficient-data details from a failed run', async () => {
    mockApiPost.mockRejectedValueOnce(Object.assign(new Error('boom'), { body: { code: 'insufficient_data', required: 20, actual: 4 } }));
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: /Run clustering/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Not enough data \(needs 20, found 4\)/);
  });

  it('hides the run controls for the mayor and never posts', async () => {
    mockUseAuth.mockReturnValue({ user: { id: '2', role: 'mayor' } });
    renderTab();
    expect(await screen.findByText(/Chosen k/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Run clustering/i })).toBeNull();
    expect(screen.queryByLabelText(/Candidate k range/i)).toBeNull();
    expect(mockApiPost).not.toHaveBeenCalled();
  });
});
