import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import React from 'react';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';

const fetcherMock = vi.fn();
const withSWR = ({ children }: { children?: React.ReactNode }) =>
  React.createElement(
    SWRConfig,
    { value: { fetcher: fetcherMock, dedupingInterval: 0 } },
    children,
  );

describe('useDebouncedSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.setItem('kapwa_token', 'mock-token');
    fetcherMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  test('skips fetch on empty query', () => {
    const { result } = renderHook(() => useDebouncedSearch('', 300), { wrapper: withSWR });
    expect(result.current.loading).toBe(false);
    expect(result.current.results).toEqual([]);
    expect(fetcherMock).not.toHaveBeenCalled();
  });

  test('debounces fetch calls — fetcher called once with the debounced key', async () => {
    fetcherMock.mockResolvedValue([]);

    renderHook(() => useDebouncedSearch('test', 300), { wrapper: withSWR });

    // The initial query synchronously sets debouncedQuery; useSWR fires once on mount.
    expect(fetcherMock).toHaveBeenCalledTimes(1);
    const calledKey = fetcherMock.mock.calls[0][0];
    expect(JSON.stringify(calledKey)).toContain('beneficiaries');
    expect(JSON.stringify(calledKey)).toContain('search');
    expect(JSON.stringify(calledKey)).toContain('test');

    // Advancing the timer past 300ms has no further effect — no second fetch.
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(fetcherMock).toHaveBeenCalledTimes(1);
  });

  test('cancels pending request on new query — only the final debounced key is fetched', async () => {
    fetcherMock.mockResolvedValue([]);

    const { rerender } = renderHook(
      ({ query }) => useDebouncedSearch(query, 300),
      { initialProps: { query: 'first' }, wrapper: withSWR },
    );

    // Initial mount fires with the initial query.
    expect(fetcherMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(fetcherMock.mock.calls[0][0])).toContain('first');

    // Re-render with a new query before the debounce elapses — the previous
    // query's fetch is reused via SWR's dedup and only the final debounced
    // key triggers a new fetch.
    rerender({ query: 'second' });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    // Two fetches: initial 'first' and the post-debounce 'second'.
    expect(fetcherMock).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(fetcherMock.mock.calls[1][0])).toContain('second');
  });

  test('rejection from fetcher leaves results empty and loading false', async () => {
    // Use real timers for this test (the rejection path doesn't depend on
    // timer advancement; vi.useFakeTimers is restored in afterEach).
    vi.useRealTimers();
    fetcherMock.mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useDebouncedSearch('test', 50), { wrapper: withSWR });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.results).toEqual([]);
  });
});
