import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock API module
vi.mock('../src/lib/api', () => ({
  revokeConsent: vi.fn(),
  getConsentLedger: vi.fn(),
}));

import { revokeConsent, getConsentLedger } from '../src/lib/api';

describe('ConsentManager — Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call revokeConsent with beneficiary ID and reason', async () => {
    const mockResponse = { status: 'revoked', revokedAt: '2026-06-19T06:00:00Z' };
    vi.mocked(revokeConsent).mockResolvedValue(mockResponse);

    const result = await revokeConsent('ben-123', 'No longer needs services');
    expect(revokeConsent).toHaveBeenCalledWith('ben-123', 'No longer needs services');
    expect(result.status).toBe('revoked');
  });

  it('should call revokeConsent without reason when not provided', async () => {
    vi.mocked(revokeConsent).mockResolvedValue({ status: 'revoked', revokedAt: '2026-06-19T06:00:00Z' });

    await revokeConsent('ben-123');
    expect(revokeConsent).toHaveBeenCalledWith('ben-123');
  });

  it('should call getConsentLedger with beneficiary ID', async () => {
    const mockLedger = [
      { id: 'cl-1', status: 'active', grantedAt: '2026-01-15T00:00:00Z' },
    ];
    vi.mocked(getConsentLedger).mockResolvedValue(mockLedger);

    const result = await getConsentLedger('ben-123');
    expect(getConsentLedger).toHaveBeenCalledWith('ben-123');
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('active');
  });
});
