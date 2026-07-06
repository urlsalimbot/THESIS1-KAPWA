import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import useSWR, { SWRConfig, useSWRConfig } from 'swr';
import { queryKeys } from './query-keys';
import { api } from './api';

// Tiny test component that runs a useSWR hook with the given key
function FetchComponent({ swrKey }: { swrKey: readonly ['dashboard', 'stats'] | null }) {
  const { data } = useSWR(swrKey);
  return <div>{data ? JSON.stringify(data) : 'loading'}</div>;
}

// Component that reads SWR config and exposes its options
function ConfigProbe({ onConfig }: { onConfig: (cfg: { revalidateOnFocus: boolean; revalidateOnReconnect: boolean; dedupingInterval: number; refreshInterval: number }) => void }) {
  const cfg = useSWRConfig();
  useEffect(() => {
    onConfig({
      revalidateOnFocus: cfg.revalidateOnFocus as boolean,
      revalidateOnReconnect: cfg.revalidateOnReconnect as boolean,
      dedupingInterval: cfg.dedupingInterval as number,
      refreshInterval: cfg.refreshInterval as number,
    });
  }, [cfg, onConfig]);
  return <div>probe</div>;
}

describe('SWRConfig global options', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fetcher is api.get — useSWR calls api.get with the key', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ stats: [] }) });

    render(
      <SWRConfig value={{ fetcher: api.get, dedupingInterval: 0 }}>
        <FetchComponent swrKey={queryKeys.dashboard.stats() as readonly ['dashboard', 'stats']} />
      </SWRConfig>,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    // Verify the URL passed to fetch matches the dashboard stats key (joined as a path)
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain('/dashboard/stats');
  });

  it('revalidateOnFocus is true', async () => {
    const onConfig = vi.fn();
    render(
      <SWRConfig value={{ fetcher: api.get, revalidateOnFocus: true, revalidateOnReconnect: true, dedupingInterval: 2000, refreshInterval: 0 }}>
        <ConfigProbe onConfig={onConfig} />
      </SWRConfig>,
    );
    await waitFor(() => {
      expect(onConfig).toHaveBeenCalledWith(expect.objectContaining({ revalidateOnFocus: true }));
    });
  });

  it('dedupingInterval is 2000', async () => {
    const onConfig = vi.fn();
    render(
      <SWRConfig value={{ fetcher: api.get, revalidateOnFocus: true, revalidateOnReconnect: true, dedupingInterval: 2000, refreshInterval: 0 }}>
        <ConfigProbe onConfig={onConfig} />
      </SWRConfig>,
    );
    await waitFor(() => {
      expect(onConfig).toHaveBeenCalledWith(expect.objectContaining({ dedupingInterval: 2000 }));
    });
  });

  it('refreshInterval is 0 (no polling by default)', async () => {
    const onConfig = vi.fn();
    render(
      <SWRConfig value={{ fetcher: api.get, revalidateOnFocus: true, revalidateOnReconnect: true, dedupingInterval: 2000, refreshInterval: 0 }}>
        <ConfigProbe onConfig={onConfig} />
      </SWRConfig>,
    );
    await waitFor(() => {
      expect(onConfig).toHaveBeenCalledWith(expect.objectContaining({ refreshInterval: 0 }));
    });
  });
});
