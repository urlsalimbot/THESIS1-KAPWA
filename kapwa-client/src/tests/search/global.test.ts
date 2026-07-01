import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';

describe('useDebouncedSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.setItem('kapwa_token', 'mock-token');
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  test('skips fetch on empty query', () => {
    const { result } = renderHook(() => useDebouncedSearch('', 300));
    expect(result.current.loading).toBe(false);
    expect(result.current.results).toEqual([]);
  });

  test('debounces fetch calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    );

    renderHook(() => useDebouncedSearch('test', 300));

    expect(fetchSpy).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/beneficiaries?search=test'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer mock-token' }),
      })
    );

    fetchSpy.mockRestore();
  });

  test('cancels pending request on new query', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise(() => {})
    );

    const { rerender } = renderHook(
      ({ query }) => useDebouncedSearch(query, 300),
      { initialProps: { query: 'first' } }
    );

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    rerender({ query: 'second' });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/beneficiaries?search=second'),
      expect.any(Object)
    );

    fetchSpy.mockRestore();
  });

  test('handles AbortError gracefully', async () => {
    vi.useRealTimers();

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new DOMException('The operation was aborted', 'AbortError')
    );

    const { result } = renderHook(() => useDebouncedSearch('test', 50));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.results).toEqual([]);

    fetchSpy.mockRestore();
  });
});
