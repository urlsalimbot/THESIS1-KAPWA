import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BeneficiariesPage } from './BeneficiariesPage';

const { mockBeneficiaries } = vi.hoisted(() => ({
  mockBeneficiaries: [
    { id: 'BEN-001', firstName: 'Juan', surname: 'Dela Cruz', barangay: 'Poblacion', status: 'active', category: 'Senior', phone: '09171234567' },
    { id: 'BEN-002', firstName: 'Maria', surname: 'Santos', barangay: 'Poblacion', status: 'approved', category: 'PWD', phone: '09189876543' },
  ],
}));

vi.mock('../lib/api', () => ({
  getBeneficiaries: () => Promise.resolve(mockBeneficiaries),
}));

describe('BeneficiariesPage', () => {
  it('renders PageShell heading', async () => {
    render(
      <MemoryRouter>
        <BeneficiariesPage />
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: 'Beneficiaries' })).toBeTruthy();
  });

  it('renders beneficiary name from mock data', async () => {
    render(
      <MemoryRouter>
        <BeneficiariesPage />
      </MemoryRouter>
    );
    expect(await screen.findByText('Juan Dela Cruz')).toBeTruthy();
    expect(await screen.findByText('Maria Santos')).toBeTruthy();
  });

  it('renders search input for beneficiaries', async () => {
    render(
      <MemoryRouter>
        <BeneficiariesPage />
      </MemoryRouter>
    );
    expect(await screen.findByPlaceholderText('Search by name...')).toBeTruthy();
  });

  it('snapshot: BeneficiariesPage rendered DOM with searchable list + action buttons + masked PII', async () => {
    const { container } = render(
      <MemoryRouter>
        <BeneficiariesPage />
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: 'Beneficiaries' })).toBeTruthy();
    expect(container).toMatchSnapshot();
  });
});
