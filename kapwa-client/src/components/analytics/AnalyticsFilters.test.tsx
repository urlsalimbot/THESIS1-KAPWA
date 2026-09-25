import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnalyticsFilters } from './AnalyticsFilters';

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
