import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIntakeAutosave, clearDraft, loadDraft } from './useIntakeAutosave';

describe('useIntakeAutosave', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  const draft = { beneficiary: { surname: 'Dela Cruz' }, hasConsent: true };

  it('persists the form to localStorage after the debounce window', async () => {
    renderHook(() => useIntakeAutosave(draft));
    act(() => vi.advanceTimersByTime(2500));
    expect(loadDraft()?.data).toMatchObject(draft);
  });

  it('does not persist before the debounce window', () => {
    renderHook(() => useIntakeAutosave(draft));
    act(() => vi.advanceTimersByTime(1000));
    expect(loadDraft()).toBeNull();
  });

  it('clears the debounce timer on unmount', () => {
    const { unmount } = renderHook(() => useIntakeAutosave(draft));
    unmount();
    act(() => vi.advanceTimersByTime(3000));
    expect(loadDraft()).toBeNull();
  });

  it('updates draft when formData changes', () => {
    const { rerender } = renderHook(
      ({ data }) => useIntakeAutosave(data),
      { initialProps: { data: draft } }
    );
    const updated = { beneficiary: { surname: 'Santos' }, hasConsent: false };
    rerender({ data: updated });
    act(() => vi.advanceTimersByTime(2500));
    expect(loadDraft()?.data).toMatchObject(updated);
  });

  it('clears the draft on explicit clear', () => {
    renderHook(() => useIntakeAutosave(draft));
    act(() => vi.advanceTimersByTime(2500));
    expect(loadDraft()).not.toBeNull();
    clearDraft();
    expect(loadDraft()).toBeNull();
  });

  it('loadDraft returns null when no draft exists', () => {
    expect(loadDraft()).toBeNull();
  });

  it('loadDraft returns null for corrupted JSON', () => {
    localStorage.setItem('kapwa:intake:draft', '{invalid json');
    expect(loadDraft()).toBeNull();
  });
});
