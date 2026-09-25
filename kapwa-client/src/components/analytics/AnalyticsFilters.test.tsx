import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnalyticsFilters, rangeToDates } from './AnalyticsFilters';

// rangeToDates formats local calendar dates, so pin the runner to PHT
// (UTC+8) regardless of host/CI timezone: the local-vs-UTC assertion below is
// only observable off UTC. Vitest isolates each test file in its own process.
process.env.TZ = 'Asia/Manila';

describe('AnalyticsFilters', () => {
  it('renders range and barangay selects and reports changes', () => {
    const onChange = vi.fn();
    render(<AnalyticsFilters value={{ range: '1y', barangay: '' }} onChange={onChange} />);
    const range = screen.getByLabelText('Date range');
    expect(range).toHaveValue('1y');
    expect(screen.getAllByRole('option').length).toBeGreaterThanOrEqual(6);
    fireEvent.change(range, { target: { value: '30d' } });
    expect(onChange).toHaveBeenCalledWith({ range: '30d', barangay: '' });
  });
});

describe('rangeToDates', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('clamps the 6m range at a short month instead of overflowing', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 7, 31, 12, 0, 0));
    expect(rangeToDates('6m')).toEqual({ from: '2026-02-28', to: '2026-08-31' });
  });

  it('formats from/to as local dates, not UTC', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // 00:30 local on 1 Mar 2026 is still 28 Feb in UTC — the old
    // toISOString() implementation returned '2026-02-28'.
    const now = new Date(2026, 2, 1, 0, 30, 0);
    expect(now.toISOString().slice(0, 10)).toBe('2026-02-28');
    vi.setSystemTime(now);
    expect(rangeToDates('30d')).toEqual({ from: '2026-01-30', to: '2026-03-01' });
  });
});
