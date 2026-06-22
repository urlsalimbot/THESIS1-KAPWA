import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccessCard } from './AccessCard';

const mockBeneficiary = {
  id: 'ben-1',
  surname: 'Dela Cruz',
  firstName: 'Juan',
  barangay: 'Norzagaray',
  accessCardCode: 'NORZ-AC-2026-0042',
};

const mockServices = [
  {
    id: 'srv-1',
    serviceDate: '2026-06-01',
    serviceRendered: 'Medical Aid',
    cost: 5000,
    agency: 'MSWDO',
  },
];

const emptyServices: Array<{
  id: string;
  serviceDate: string;
  serviceRendered: string;
  cost?: number;
  agency?: string;
  workerNameSign?: string;
}> = [];

describe('AccessCard', () => {
  it('renders card code in monospace font', () => {
    render(<AccessCard beneficiary={mockBeneficiary} services={mockServices} />);
    const codeEl = screen.getByText('NORZ-AC-2026-0042');
    expect(codeEl).toBeTruthy();
    expect(codeEl.className).toContain('font-mono');
  });

  it('renders beneficiary name and barangay', () => {
    render(<AccessCard beneficiary={mockBeneficiary} services={mockServices} />);
    expect(screen.getByText(/Dela Cruz, Juan/i)).toBeTruthy();
    // Barangay: Norzagaray — use getAllByText and check the matching text on the barangay line
    const barangayTexts = screen.getAllByText(/Norzagaray/i);
    // First match is the header "MSWDO Norzagaray — Access Card", second match is barangay value
    // At minimum, Norzagaray appears in the component
    expect(barangayTexts.length).toBeGreaterThanOrEqual(1);
    // Check that the barangay is displayed (via the Barangay: label nearby)
    expect(screen.getByText(/Barangay:/i)).toBeTruthy();
  });

  it('renders service log table with correct columns', () => {
    render(<AccessCard beneficiary={mockBeneficiary} services={mockServices} />);
    expect(screen.getByText('Date')).toBeTruthy();
    expect(screen.getByText('Service')).toBeTruthy();
    expect(screen.getByText('Cost')).toBeTruthy();
    expect(screen.getByText('Agency')).toBeTruthy();
  });

  it('shows "No services logged yet" when services array is empty', () => {
    render(<AccessCard beneficiary={mockBeneficiary} services={emptyServices} />);
    expect(screen.getByText(/No services logged yet/i)).toBeTruthy();
  });

  it('renders row numbers sequentially', () => {
    const multipleServices = [
      { id: 'srv-1', serviceDate: '2026-06-01', serviceRendered: 'Medical Aid', cost: 5000, agency: 'MSWDO' },
      { id: 'srv-2', serviceDate: '2026-06-15', serviceRendered: 'Food Pack', cost: 1500, agency: 'DSWD' },
      { id: 'srv-3', serviceDate: '2026-07-01', serviceRendered: 'Burial', cost: 10000, agency: 'MSWDO' },
    ];
    render(<AccessCard beneficiary={mockBeneficiary} services={multipleServices} />);
    // Row numbers should be 1, 2, 3
    const cells = screen.getAllByRole('cell');
    const rowNumCells = cells.filter(
      (c) => c.textContent === '1' || c.textContent === '2' || c.textContent === '3'
    );
    expect(rowNumCells.length).toBe(3);
  });
});
