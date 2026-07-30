import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntakeAddressBlock } from './IntakeAddressBlock';
import type { AddressFields } from './IntakeAddressBlock';

vi.mock('@/lib/postal-codes', () => ({
  POSTAL_CODES: { 'Norzagaray': '3012', 'City of San Jose Del Monte': '1550' },
}));

const emptyValue: AddressFields = { street: '', barangay: '', city: '', province: '0301400000', region: '03', postalCode: '', psgcCode: '' };

describe('IntakeAddressBlock', () => {
  it('renders all address selectors', () => {
    render(<IntakeAddressBlock value={emptyValue} onChange={vi.fn()} label="Address" />);
    expect(screen.getByText('Address')).toBeInTheDocument();
  });

  it('has a manual entry toggle button', () => {
    render(<IntakeAddressBlock value={emptyValue} onChange={vi.fn()} label="Address" />);
    expect(screen.getByText('Barangay not listed? Enter manually')).toBeInTheDocument();
  });

  it('auto-fills postal code when city is selected', () => {
    const onChange = vi.fn();
    render(<IntakeAddressBlock value={emptyValue} onChange={onChange} label="Address" />);
    const citySelect = screen.getByLabelText('Address City');
    fireEvent.change(citySelect, { target: { value: '0301413000' } });
    expect(onChange).toHaveBeenCalledWith('postalCode', '3012');
  });
});
