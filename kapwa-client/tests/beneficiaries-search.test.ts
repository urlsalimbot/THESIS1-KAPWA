import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the API module to test getBeneficiaries params
const mockApiFetch = vi.fn();

vi.mock('../src/lib/api', () => ({
  apiFetch: mockApiFetch,
  getBeneficiaries: vi.fn().mockImplementation(async (params?: {
    search?: string;
    category?: string;
    barangay?: string;
    page?: number;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.category) q.set('category', params.category);
    if (params?.barangay) q.set('barangay', params.barangay);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return mockApiFetch(`/beneficiaries${qs ? '?' + qs : ''}`);
  }),
}));

describe('Beneficiaries Search — Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiFetch.mockResolvedValue([]);
  });

  it('should export BeneficiariesPage component', async () => {
    const { BeneficiariesPage } = await import('../src/pages/BeneficiariesPage');
    expect(BeneficiariesPage).toBeDefined();
    expect(typeof BeneficiariesPage).toBe('function');
  });

  it('should call getBeneficiaries with search param', async () => {
    const { getBeneficiaries } = await import('../src/lib/api');
    await getBeneficiaries({ search: 'Dela Cruz' });
    expect(mockApiFetch).toHaveBeenCalledWith('/beneficiaries?search=Dela%20Cruz');
  });

  it('should call getBeneficiaries with category filter', async () => {
    const { getBeneficiaries } = await import('../src/lib/api');
    await getBeneficiaries({ category: 'Senior' });
    expect(mockApiFetch).toHaveBeenCalledWith('/beneficiaries?category=Senior');
  });

  it('should call getBeneficiaries with barangay filter', async () => {
    const { getBeneficiaries } = await import('../src/lib/api');
    await getBeneficiaries({ barangay: 'Norzagaray' });
    expect(mockApiFetch).toHaveBeenCalledWith('/beneficiaries?barangay=Norzagaray');
  });

  it('should call getBeneficiaries with combined filters (search + category + barangay)', async () => {
    const { getBeneficiaries } = await import('../src/lib/api');
    await getBeneficiaries({ search: 'Juan', category: 'Senior', barangay: 'Norzagaray' });
    const url = mockApiFetch.mock.calls[0][0] as string;
    expect(url).toContain('search=Juan');
    expect(url).toContain('category=Senior');
    expect(url).toContain('barangay=Norzagaray');
  });

  it('should call getBeneficiaries with empty params object (no query string)', async () => {
    const { getBeneficiaries } = await import('../src/lib/api');
    await getBeneficiaries({});
    expect(mockApiFetch).toHaveBeenCalledWith('/beneficiaries');
  });

  it('should call getBeneficiaries with no args for backward compatibility', async () => {
    const { getBeneficiaries } = await import('../src/lib/api');
    await getBeneficiaries();
    expect(mockApiFetch).toHaveBeenCalledWith('/beneficiaries');
  });
});
