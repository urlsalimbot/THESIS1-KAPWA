import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIrfOperations } from './useIrfOperations';

const { mockApiGet, mockApiPost, mockExportIrfPdf } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockExportIrfPdf: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
  },
  exportIrfPdf: (...args: unknown[]) => mockExportIrfPdf(...args),
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

/**
 * A disabled button is an affordance, not a guarantee: these call the handlers
 * directly, without touching the UI, and assert nothing leaves the browser when
 * the legal basis is not one of the recognised values. The basis reaches the API
 * as a query string and a request body, so a tampered or stale value must be
 * refused at the handler.
 */
describe('useIrfOperations legal basis guard', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockExportIrfPdf.mockReset();
    mockApiGet.mockResolvedValue({});
    mockApiPost.mockResolvedValue({ narration: 'text' });
    mockExportIrfPdf.mockResolvedValue(undefined);
  });

  it('refuses to unmask names without a recognised basis', async () => {
    const { result } = renderHook(() => useIrfOperations('irf-1'));

    // No basis at all.
    await act(async () => { await result.current.handleUnmaskNames(); });
    expect(mockApiGet).not.toHaveBeenCalled();

    // A value the select could never produce.
    act(() => { result.current.setLegalBasis('made-up-basis'); });
    await act(async () => { await result.current.handleUnmaskNames(); });
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('refuses to decrypt without a recognised basis', async () => {
    const { result } = renderHook(() => useIrfOperations('irf-1'));

    act(() => { result.current.setLegalBasis('made-up-basis'); });
    await act(async () => { await result.current.handleDecrypt(); });
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('refuses to export a PDF without a recognised basis', async () => {
    const { result } = renderHook(() => useIrfOperations('irf-1'));

    act(() => { result.current.setExportLegalBasis('made-up-basis'); });
    await act(async () => { await result.current.handleExportPdf(); });
    expect(mockExportIrfPdf).not.toHaveBeenCalled();
  });

  it('proceeds when the basis is one of the recognised values', async () => {
    const { result } = renderHook(() => useIrfOperations('irf-1'));

    act(() => { result.current.setLegalBasis('court-order'); });
    await act(async () => { await result.current.handleUnmaskNames(); });
    expect(mockApiGet).toHaveBeenCalledTimes(1);
    expect(String(mockApiGet.mock.calls[0][0])).toContain('legalBasis=court-order');
  });

  it('still exposes the PDF export and no longer exposes a JSON export', () => {
    const { result } = renderHook(() => useIrfOperations('irf-1'));
    expect(typeof result.current.handleExportPdf).toBe('function');
    expect((result.current as Record<string, unknown>).handleExportJson).toBeUndefined();
  });
});
