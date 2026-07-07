import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { axe } from 'vitest-axe';
import { BeneficiariesPage } from './BeneficiariesPage';

const { mockBeneficiaries, mockApiGet } = vi.hoisted(() => ({
  mockBeneficiaries: [
    { id: 'BEN-001', firstName: 'Juan', surname: 'Dela Cruz', barangay: 'Poblacion', status: 'active', category: 'Senior', phone: '09171234567' },
    { id: 'BEN-002', firstName: 'Maria', surname: 'Santos', barangay: 'Poblacion', status: 'approved', category: 'PWD', phone: '09189876543' },
  ],
  mockApiGet: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
  },
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}

describe('BeneficiariesPage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue(mockBeneficiaries);
    // Clear SWR cache so the list refetch fires per test
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders PageShell heading', async () => {
    renderWithSWR(<BeneficiariesPage />);
    expect(await screen.findByRole('heading', { name: 'Beneficiaries' })).toBeTruthy();
  });

  it('renders beneficiary name from mock data', async () => {
    renderWithSWR(<BeneficiariesPage />);
    expect(await screen.findByText('Juan Dela Cruz')).toBeTruthy();
    expect(await screen.findByText('Maria Santos')).toBeTruthy();
  });

  it('renders search input for beneficiaries', async () => {
    renderWithSWR(<BeneficiariesPage />);
    expect(await screen.findByPlaceholderText('Search by name...')).toBeTruthy();
  });

  it('snapshot: BeneficiariesPage rendered DOM with searchable list + action buttons + masked PII', async () => {
    const { container } = renderWithSWR(<BeneficiariesPage />);
    expect(await screen.findByRole('heading', { name: 'Beneficiaries' })).toBeTruthy();
    expect(container).toMatchSnapshot();
  });

  it('api.get is called with a path containing /beneficiaries on mount', async () => {
    renderWithSWR(<BeneficiariesPage />);
    await screen.findByText('Juan Dela Cruz');
    expect(mockApiGet).toHaveBeenCalled();
    const lastCallArg = mockApiGet.mock.calls[mockApiGet.mock.calls.length - 1][0];
    expect(JSON.stringify(lastCallArg)).toContain('beneficiaries');
    expect(JSON.stringify(lastCallArg)).toContain('list');
  });

  it('typing in the search input triggers a second api.get with a search param after the 300ms debounce', async () => {
    renderWithSWR(<BeneficiariesPage />);
    // Wait for the initial mount fetch to complete
    await screen.findByText('Juan Dela Cruz');
    const initialCallCount = mockApiGet.mock.calls.length;
    expect(initialCallCount).toBeGreaterThan(0);

    // Type in the search input — this schedules the 300ms debounce
    const input = screen.getByPlaceholderText('Search by name...');
    fireEvent.change(input, { target: { value: 'Maria' } });

    // Wait > 300ms for the debounced key to update and the SWR fetch to fire.
    // The fetcher is a synchronous mockApiGet (resolves immediately), so the
    // data swap happens as soon as SWR sees the new key.
    await new Promise((r) => setTimeout(r, 400));
    // After the debounce + key update, api.get should have been called again
    // (with a key containing 'Maria' from the search param).
    expect(mockApiGet.mock.calls.length).toBeGreaterThan(initialCallCount);
    const lastCallArg = mockApiGet.mock.calls[mockApiGet.mock.calls.length - 1][0];
    const argJson = JSON.stringify(lastCallArg);
    expect(argJson).toContain('Maria');
  });

  it('has no a11y violations', async () => {
    const { container } = renderWithSWR(<BeneficiariesPage />);
    await screen.findByRole('heading', { name: 'Beneficiaries' });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

