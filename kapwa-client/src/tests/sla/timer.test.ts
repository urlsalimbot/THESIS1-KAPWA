import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSlaTimer } from '@/hooks/useSlaTimer';
import { formatElapsed, THRESHOLDS } from '@/lib/sla-utils';

describe('formatElapsed', () => {
  test('returns 0h for negative values', () => {
    expect(formatElapsed(-1)).toBe('0h');
  });

  test('returns hours only when < 24', () => {
    expect(formatElapsed(5)).toBe('5h');
    expect(formatElapsed(0)).toBe('0h');
  });

  test('returns days and hours when >= 24', () => {
    expect(formatElapsed(26)).toBe('1d 2h');
    expect(formatElapsed(48)).toBe('2d 0h');
  });
});

describe('THRESHOLDS', () => {
  test('has expected values', () => {
    expect(THRESHOLDS.warning).toBe(0.7);
    expect(THRESHOLDS.breach).toBe(0.9);
  });
});

describe('useSlaTimer status thresholds', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('status is compliant when fractionUsed < 0.7', () => {
    const stageStartedAt = new Date('2026-07-01T11:00:00Z').toISOString();
    const { result } = renderHook(() => useSlaTimer(stageStartedAt, 24));
    expect(result.current.status).toBe('compliant');
    expect(result.current.fractionUsed).toBeLessThan(0.7);
  });

  test('status is warning when 0.7 <= fractionUsed < 0.9', () => {
    const stageStartedAt = new Date('2026-06-30T16:00:00Z').toISOString();
    const { result } = renderHook(() => useSlaTimer(stageStartedAt, 24));
    expect(result.current.status).toBe('warning');
  });

  test('status is breached when fractionUsed >= 0.9', () => {
    const stageStartedAt = new Date('2026-06-25T12:00:00Z').toISOString();
    const { result } = renderHook(() => useSlaTimer(stageStartedAt, 24));
    expect(result.current.status).toBe('breached');
  });

  test('returns empty display and compliant for missing props', () => {
    const { result } = renderHook(() => useSlaTimer('', 0));
    expect(result.current.elapsedDisplay).toBe('');
    expect(result.current.status).toBe('compliant');
    expect(result.current.fractionUsed).toBe(0);
  });
});
