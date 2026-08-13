import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { axe } from 'vitest-axe';
import { BeneficiariesPage } from './BeneficiariesPage';

const { mockBeneficiaries, mockApiGet } = vi.hoisted(() => ({
  mockBeneficiaries: [
    { id: 'BEN-001', firstName: 'Juan', surname: 'Dela Cruz', barangay: 'Poblacion', status: 'active', category: 'Senior', phone: '09171234567' },
    { id: 'BEN-002', firstName: 'Maria', surname: 'Santos', barangay: 'Poblacion', status: 'active', category: 'PWD', phone: '09189876543' },
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
    mockApiGet.mockResolvedValue({ data: mockBeneficiaries, total: 2 });
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
  });

  it('typing in the search input then clicking Search triggers a second api.get with a search param', async () => {
    renderWithSWR(<BeneficiariesPage />);
    // Wait for the initial mount fetch to complete
    await screen.findByText('Juan Dela Cruz');
    const initialCallCount = mockApiGet.mock.calls.length;
    expect(initialCallCount).toBeGreaterThan(0);

    // Type in the search input and submit via the Search button
    const input = screen.getByPlaceholderText('Search by name...');
    fireEvent.change(input, { target: { value: 'Maria' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    // Wait for the URL param update + SWR fetch with the search key
    await vi.waitFor(() => {
      expect(mockApiGet.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
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

  it('renders ErrorState with a retry button when the list fails to load', async () => {
    mockApiGet.mockRejectedValue(new Error('network down'));
    renderWithSWR(<BeneficiariesPage />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Could not load beneficiaries')).toBeTruthy();
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
  });

  it('refetches when Try again is clicked after a load failure', async () => {
    mockApiGet.mockRejectedValue(new Error('network down'));
    renderWithSWR(<BeneficiariesPage />);
    await screen.findByRole('alert');
    mockApiGet.mockResolvedValue(mockBeneficiaries);
    const callsBefore = mockApiGet.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await vi.waitFor(() => {
      expect(mockApiGet.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });
});

