import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIntakeAutosave, clearDraft, loadDraft, getDraftKey } from './useIntakeAutosave';

describe('useIntakeAutosave scoping', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const draft = { beneficiary: { surname: 'Dela Cruz' }, hasConsent: true };

  it('uses a per-user storage key', () => {
    expect(getDraftKey('user-1')).toBe('kapwa:intake:draft:user-1');
    expect(getDraftKey('user-2')).not.toBe(getDraftKey('user-1'));
  });

  it('persists and loads under the scoped key only', () => {
    renderHook(() => useIntakeAutosave(draft, 'user-1'));
    act(() => vi.advanceTimersByTime(2500));
    expect(loadDraft('user-1')?.data).toMatchObject(draft);
    expect(loadDraft('user-2')).toBeNull();
  });

  it('does not persist before the debounce window', () => {
    renderHook(() => useIntakeAutosave(draft, 'user-1'));
    act(() => vi.advanceTimersByTime(1000));
    expect(loadDraft('user-1')).toBeNull();
  });

  it('clears the debounce timer on unmount', () => {
    const { unmount } = renderHook(() => useIntakeAutosave(draft, 'user-1'));
    unmount();
    act(() => vi.advanceTimersByTime(3000));
    expect(loadDraft('user-1')).toBeNull();
  });

  it('updates draft when formData changes', () => {
    const { rerender } = renderHook(
      ({ data }) => useIntakeAutosave(data, 'user-1'),
      { initialProps: { data: draft } }
    );
    const updated = { beneficiary: { surname: 'Santos' }, hasConsent: false };
    rerender({ data: updated });
    act(() => vi.advanceTimersByTime(2500));
    expect(loadDraft('user-1')?.data).toMatchObject(updated);
  });

  it('does not autosave when no user id is provided', () => {
    renderHook(() => useIntakeAutosave(draft, ''));
    act(() => vi.advanceTimersByTime(3000));
    expect(loadDraft('')).toBeNull();
    expect(localStorage.getItem('kapwa:intake:draft:')).toBeNull();
  });

  it('clears only the scoped draft', () => {
    renderHook(() => useIntakeAutosave(draft, 'user-1'));
    renderHook(() => useIntakeAutosave(draft, 'user-2'));
    act(() => vi.advanceTimersByTime(2500));
    expect(loadDraft('user-1')).not.toBeNull();
    expect(loadDraft('user-2')).not.toBeNull();
    clearDraft('user-1');
    expect(loadDraft('user-1')).toBeNull();
    expect(loadDraft('user-2')).not.toBeNull();
  });

  it('loadDraft returns null when no draft exists', () => {
    expect(loadDraft('user-1')).toBeNull();
  });

  it('loadDraft returns null for corrupted JSON', () => {
    localStorage.setItem(getDraftKey('user-1'), '{invalid json');
    expect(loadDraft('user-1')).toBeNull();
  });

  it('purges the legacy unscoped draft key on module load', async () => {
    localStorage.setItem('kapwa:intake:draft', JSON.stringify({ data: { leaked: true }, savedAt: 'x' }));
    vi.resetModules();
    await import('./useIntakeAutosave');
    expect(localStorage.getItem('kapwa:intake:draft')).toBeNull();
  });
});
